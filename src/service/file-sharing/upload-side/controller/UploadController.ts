import Peer, { DataConnection } from 'peerjs';
import _ from 'lodash';

import { log, warn } from '../../../../utils/log';
import { generatePeerId, generateFileId } from '../../../../utils/random';
import { newPeerGeneratorWithReady, getWorkerNumBySize } from '../../../../utils/peering';
import { CMD_SETS } from '../../../../constants';

import {
  CommunicationData,
  CommAllListReq,
  CommAllListResp,
  CommStartDownloadingResp,
  CommStartDownloadingReq,
  CommFileBlockReq,
  CommFileBlockResp,
} from '../../types';
import { FileStorage } from './FileStorage';

interface ConnectionsEstablished {
  // make sure only one connection between two peers
  [remotePeerId: string]: DataConnection;
}

interface FileRegistered {
  [file: string]: FileStorage;
}

interface UploadWorker {
  [remotePeerId: string]: {
    [fileId: string]: Array<string>;
  };
}

interface UploadWorkerStorage {
  [workerId: string]: {
    peerObj: Peer;
  };
}

const generateNBrandNewPeer = (numOfPeer: number) => {
  return Promise.all(Array.from({ length: numOfPeer }, () => {
    const workerId = generatePeerId();
    return newPeerGeneratorWithReady(workerId);
  }));
};

/**
 * This class is used to control the whole flow of upload process.
 * There are two kind of peers in this class: main peer and worker peer.
 * Eeah connection is stored in connectionStroage.
 * UI side call the registerFile method in this class and fileId will be generated.
 * The instance of this class will also listenOnConnection for download Controller,
 * it will react on GET_FILE_LIST and START_FILE_DOWNLOAD cmd.
 * After receiving START_FILE_DOWNLOAD cmd, upload controller will generate a set of peer with ready status, registering a callback on REQUEST_FILE_BLOB cmd.
 * REQUEST_FILE_BLOB cmd will only be received by worker to get certain chunk of certain file.
 */
export class UploadController {
  private _mainPeerObj: Peer;
  private _connEstablished: ConnectionsEstablished;
  private _fileStorage: FileRegistered;
  private _fileStorageList: Array<string>; // TODO: maybe unnecessary because we can store the upload time and sort when get all files.
  private _uploadWorker: UploadWorker;
  private _uploadWorkerStorage: UploadWorkerStorage;
  constructor(peerObj: Peer) {
    this._mainPeerObj = peerObj;
    this._connEstablished = {};
    this._fileStorage = {};
    this._fileStorageList = [];
    this._uploadWorker = {};
    this._uploadWorkerStorage = {};
  }

  public static async init() {
    // For Uploader, we should wait for peer opened
    const peerObj = await newPeerGeneratorWithReady(generatePeerId());
    const instance = new UploadController(peerObj);
    instance.listenOnConnectionForMain();
    return instance;
  }

  public getMainPeerId(): string {
    return this._mainPeerObj.id;
  }

  // TODO: trigger file update cmd to all main connections, info them to getAllFileList again.
  public registerFile(file: File): string {
    const result = generateFileId();
    this._fileStorage[result] = new FileStorage(file);
    this._fileStorageList.push(result);
    return result;
  }

  // TODO: remove file and trigger file update cmd to all main connections, info them to getAllFileList again and cancel download process.
  public removeFile() {
    console.log('this', this);
  }

  public getFileList() {
    return this._fileStorageList.map(f => ({
      fileId: f,
      ...this._fileStorage[f].getFileInfo()
    }));
  }

  private handleCmdGetFilelist(connection: DataConnection, cmdData: CommunicationData<CommAllListReq>['cmdData']) {
    const { channelId: channelIdFromDownloader } = cmdData;
    const reqInfoResp: CommunicationData<CommAllListResp> = {
      cmdPacket: CMD_SETS.GET_FILE_LIST,
      cmdData: {
        channelId: channelIdFromDownloader,
        fileList: this.getFileList()
      },
    };

    log('<upload controller> getFileList CMD send', reqInfoResp);
    connection.send(reqInfoResp);
  }

  /**
   * For each fileId and remote peerId, always return the same group of peers
   */
  private getUploaderWorkerListByPeerIdAndFileId(downloadPeerId: string, fileId: string, fileSize: number): Promise<Array<string>> {
    return new Promise((resolve, reject) => {
      const workerIdList = _.get(this._uploadWorker, `${downloadPeerId}.${fileId}`, []) as Array<string>;
      if (workerIdList.length) { // just return the list if exist for the same peer and file
        resolve(workerIdList);
      } else {
        generateNBrandNewPeer(getWorkerNumBySize(fileSize)) // generate peer list
          .then((peerList: Array<Peer>) => {
            const peerIdList = peerList.map(p => {
              this.listenOnConnectionForMainForWorker(p); // bind worker function to each peer
              const workerId = p.id;
              this._uploadWorkerStorage[workerId] = { // store worker obj to storage in memory
                peerObj: p
              };

              return workerId;
            });

            if (!this._uploadWorker[downloadPeerId]) { // bind the workerId info to download peerId
              this._uploadWorker[downloadPeerId] = {};
            }

            this._uploadWorker[downloadPeerId][fileId] = peerIdList;
            resolve(peerIdList);
          }).catch(reject);
      }
    });
  }

  private handleCmdStartFileDownload(connection: DataConnection, cmdData: CommunicationData<CommStartDownloadingReq>['cmdData']) {
    const { peer: downloadPeerId } = connection;
    const { fileId, channelId } = cmdData;
    const { fileSize } = this._fileStorage[fileId].getFileInfo();
    this.getUploaderWorkerListByPeerIdAndFileId(downloadPeerId, fileId, fileSize)
      .then(peerIdList => {
        const reqInfoResp: CommunicationData<CommStartDownloadingResp> = {
          cmdPacket: CMD_SETS.START_FILE_DOWNLOAD,
          cmdData: {
            peerList: peerIdList,
            channelId
          }
        };

        log('<upload controller> startFileDownload CMD send', reqInfoResp);
        connection.send(reqInfoResp);
      });
  }

  private listenOnConnectionForMainForWorker(workerPeerObj: Peer) {
    // TODO: connectionObj is not stored with means we cannot stop it or maybe we should use another version.
    workerPeerObj.on('connection', (workerDataConn: DataConnection) => {
      // also, if data sent before opened, it should be the downloader's responsibility to retry
      workerDataConn.on('open', () => {
        log('<upload worker>', workerPeerObj.id, 'opened');
        workerDataConn.on('data', (workerDataReceived: CommunicationData<CommFileBlockReq>) => {
          const { cmdPacket: workerDataPacket, cmdData: workerDataData } = workerDataReceived;
          if (workerDataPacket === CMD_SETS.REQUEST_FILE_BLOCK) {
            const { fileId: downloadFileId, channelId: downloadId, chunkIdx: downloadChunkIdx, chunkSize: downloadChunkSize } = workerDataData;
            if (this._fileStorageList.indexOf(downloadFileId) !== -1) {
              const fileObj = this._fileStorage[downloadFileId];
              const chunkDataToSend = fileObj.getBlobByChunk(downloadChunkIdx, downloadChunkSize);
              const { fileSize } = fileObj.getFileInfo();
              const reqFileBlock: CommunicationData<CommFileBlockResp> = {
                cmdPacket: CMD_SETS.REQUEST_FILE_BLOCK,
                cmdData: {
                  channelId: downloadId,
                  chunkData: chunkDataToSend,
                  chunkIdx: downloadChunkIdx,
                  done: (downloadChunkSize * (downloadChunkIdx + 1)) >= fileSize // untested and useless
                }
              };

              log('<upload worker>', workerPeerObj.id, 'chunk data sent', reqFileBlock);
              workerDataConn.send(reqFileBlock);
            }
          }
        });
      });
    });
  }

  private listenOnConnectionForMain() {
    this._mainPeerObj.on('connection', (dataConnection: DataConnection) => {
      log('<upload controller>', this._mainPeerObj.id, 'opened');
      const { peer: peerId } = dataConnection; // get peer
      this.subscribeFileInfoReqOnDataConn(dataConnection);
      // FIXME: if the download controller trigger connection twice, the last one will be override in storage.
      this._connEstablished[peerId] = dataConnection;
    });
  }

  /**
   * handle data on connection only after connection is open because it need send
   * But what if a data is sent before connection established, it should be handled by downloader.
   */
  private subscribeFileInfoReqOnDataConn = (connection: DataConnection) => {
    connection.on('open', () => {
      connection.on('data', (data: CommunicationData) => {
        log('<upload controller>', this._mainPeerObj.id, 'data received', data);
        const { cmdPacket, cmdData } = data;
        if (cmdPacket === CMD_SETS.GET_FILE_LIST) {
          this.handleCmdGetFilelist(connection, cmdData);
        } else if (cmdPacket === CMD_SETS.START_FILE_DOWNLOAD) {
          this.handleCmdStartFileDownload(connection, cmdData);
        } else {
          warn('<upload controller>', this._mainPeerObj.id, 'unknown data received', data);
        }
      });
    });
  };
};
