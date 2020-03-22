import Peer, { DataConnection } from 'peerjs';

import {
  GET_ALL_FILE_INTERVAL,
  GET_ALL_FILE_TIMEOUT,
  START_DOWNLOAD_INTERVAL,
  START_DOWNLOAD_TIMEOUT,
} from '../../../../config/index';
import { CMD_SETS } from '../../../../constants';
import { generatePeerId, generateTmpChannelId } from '../../../../utils/random';
import { newPeerGeneratorWithReady } from '../../../../utils/peering/index';

import { CommunicationData, CommAllListResp, CommStartDownloadingResp } from '../../types';
import {
  CbRecords,
  sendGetFileListCmd,
  sendStartDownloadCmd,
  pollingSend,
  extractRemotePeerIdFromDataConn,
  handleCmdRespReceived
} from './DCommand';
import { DPeerBase } from './DPeerBase';

interface CbStorage {
  [remotePeerId: string]: {
    getAllFileCmdCb: {
      [channelId: string]: CbRecords;
    };
    startDownloadCmdCb: {
      [channelId: string]: CbRecords;
    };
  };
}
/**
 * This class is used to handle communication between Upload Side And Download Side.
 * It will use interval to polling sending cmd and make sure the callback of certain cmd is only exec once.
 * Currently, it supports two cmd set:
 *  GET_ALL_FILE(which will return all the files info back)
 *  START_DOWNLOAD_CMD(which will return peerId of a set of upload workers)
 */
export class DMainMediator extends DPeerBase {
  private _cbStorage: CbStorage;
  constructor(peerObj: Peer) {
    super(peerObj);
    this._cbStorage = {};
  }

  public static async init() {
    // FIXME: for Downloader， should we really need to wait for peer get ready? https://peerjs.com/docs.html#peeron
    const peerObj = await newPeerGeneratorWithReady(generatePeerId());
    const instance = new DMainMediator(peerObj);
    return instance;
  }

  public connectToPeer(remotePeerId: string): Promise<void> {
    return new Promise(resolve => {
      this.connectToPeerGeneral(remotePeerId)
        .then((initialConnection: boolean) => {
          if (initialConnection) {
            this.listenOnConnectionForMain(this.getConnByRemotePeerId(remotePeerId));
            this._cbStorage[remotePeerId] = {
              getAllFileCmdCb: {},
              startDownloadCmdCb: {}
            };
          }

          resolve();
        });
    });
  }

  public getFileList(remotePeerId: string): Promise<CommAllListResp['fileList']> {
    return new Promise((resolve, reject) => {
      const result = this._getFileList(
        remotePeerId,
        (fileList: CommAllListResp['fileList']) => resolve(fileList),
        reject,
      );

      if (!result) {
        reject();
      }
    });
  }

  private _getFileList(remotePeerId: string, getAllFileCb?: Function, timeoutCb?: Function) {
    if (!this.checkConnectionOpen(remotePeerId)) {
      return false;
    }

    const channelId = generateTmpChannelId();
    const cbStorageForPeer = this._cbStorage[remotePeerId];
    const timeout = pollingSend(() => {
      sendGetFileListCmd(this.getConnByRemotePeerId(remotePeerId), channelId);
    }, {
      intervalMs: GET_ALL_FILE_INTERVAL,
      timeoutMs: GET_ALL_FILE_TIMEOUT,
      cbRecords: cbStorageForPeer.getAllFileCmdCb[channelId],
      timeoutFn: timeoutCb
    });

    cbStorageForPeer.getAllFileCmdCb = {
      ...cbStorageForPeer.getAllFileCmdCb,
      [channelId]: {
        cb: getAllFileCb,
        timeout,
        hasBeenCalled: false,
      }
    };

    return true;
  }

  public startDownload(remotePeerId: string, fileId: string): Promise<CommStartDownloadingResp['peerList']> {
    return new Promise((resolve, reject) => {
      const result = this._startDownload(
        remotePeerId,
        fileId,
        (peerList: CommStartDownloadingResp['peerList']) => resolve(peerList),
        reject,
      );

      if (!result) {
        reject();
      }
    });
  }

  private _startDownload(remotePeerId: string, fileId: string, startDownloadCb?: Function, timeoutCb?: Function) {
    if (!this.checkConnectionOpen(remotePeerId)) {
      return false;
    }

    const channelId = generateTmpChannelId();
    const cbStorageForPeer = this._cbStorage[remotePeerId];
    const timeout = pollingSend(() => {
      sendStartDownloadCmd(this.getConnByRemotePeerId(remotePeerId), channelId, fileId);
    }, {
      intervalMs: START_DOWNLOAD_INTERVAL,
      timeoutMs: START_DOWNLOAD_TIMEOUT,
      cbRecords: cbStorageForPeer.startDownloadCmdCb[channelId],
      timeoutFn: timeoutCb
    });

    cbStorageForPeer.startDownloadCmdCb = {
      ...cbStorageForPeer.startDownloadCmdCb,
      [channelId]: {
        cb: startDownloadCb,
        timeout,
        hasBeenCalled: false
      }
    };

    return true;
  }

  private listenOnConnectionForMain(dataConn: DataConnection) {
    dataConn.on('data', (data: CommunicationData) => {
      const { cmdPacket, cmdData } = data;
      if (cmdPacket === CMD_SETS.GET_FILE_LIST) {
        const { channelId, fileList } = cmdData as CommunicationData<CommAllListResp>['cmdData'];
        const uploaderPeerId = extractRemotePeerIdFromDataConn(dataConn);
        const getAllFileCmdCbObj = this._cbStorage[uploaderPeerId].getAllFileCmdCb[channelId];
        handleCmdRespReceived(getAllFileCmdCbObj, fileList);
      } else if (cmdPacket === CMD_SETS.START_FILE_DOWNLOAD) {
        const { channelId, peerList } = cmdData as CommunicationData<CommStartDownloadingResp>['cmdData'];
        const uploaderPeerId = extractRemotePeerIdFromDataConn(dataConn);
        const startDownloadObj = this._cbStorage[uploaderPeerId].startDownloadCmdCb[channelId];
        handleCmdRespReceived(startDownloadObj, peerList);
      }
    });
  }
};
