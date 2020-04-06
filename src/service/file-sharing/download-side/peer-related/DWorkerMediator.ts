import Peer, { DataConnection } from 'peerjs';

import { newPeerGeneratorWithReady } from '../../../../utils/peering';
import { generatePeerId, generateTmpChannelId } from '../../../../utils/random';
import { CMD_SETS } from '../../../../constants';
import { REQUEST_FILE_BLOCK_INTERVAL, REQUEST_FILE_BLOCK_TIMEOUT } from '../../../../config/index';

import {
  CbRecords,
  handleCmdRespReceived,
  extractRemotePeerIdFromDataConn,
  pollingSend,
  sendRequestFileBlock
} from './DCommand';
import { DPeerBase } from './DPeerBase';
import { CommunicationData, CommFileBlockResp } from '../../types';

interface CbStorage {
  [remotePeerId: string]: {
    requestFileBlock: {
      [channelId: string]: CbRecords;
    };
  };
}

export class DWorkerMediator extends DPeerBase {
  private _cbStorage: CbStorage;
  constructor(peerObj: Peer) {
    super(peerObj);
    this._cbStorage = {};
  }

  public static async init() {
    const peerObj = await newPeerGeneratorWithReady(generatePeerId());
    const instance = new DWorkerMediator(peerObj);
    return instance;
  }

  public connectToPeer(remotePeerId: string): Promise<void> {
    return new Promise(resolve => {
      this.connectToPeerGeneral(remotePeerId)
        .then((initialConnection: boolean) => {
          if (initialConnection) {
            this.listenOnConnectionForMain(this.getConnByRemotePeerId(remotePeerId));
            this._cbStorage[remotePeerId] = {
              requestFileBlock: {}
            };
          }

          resolve();
        });
    });
  }

  public requestFileBlock(
    remoteWorkerId: string,
    fileId: string,
    chunkIdx: number,
    chunkSize: number
  ): Promise<Omit<CommFileBlockResp, 'channelId'>> {
    return new Promise((resolve, reject) => {
      const result = this._requestFileBlock(
        remoteWorkerId,
        fileId,
        chunkIdx,
        chunkSize,
        (fileBlockResp: Omit<CommFileBlockResp, 'channelId'>) => resolve(fileBlockResp),
        () => reject('requestFileBlock timeout'),
      );

      if (!result) {
        reject();
      }
    });
  }

  private _requestFileBlock(
    remoteWorkerId: string,
    fileId: string,
    chunkIdx: number,
    chunkSize: number,
    requestFileBlockCb?: Function,
    timeoutCb?: Function,
  ) {
    if (!this.checkConnectionOpen(remoteWorkerId)) {
      return false;
    }

    const channelId = generateTmpChannelId();
    const cbStorageForPeer = this._cbStorage[remoteWorkerId];
    cbStorageForPeer.requestFileBlock = {
      ...cbStorageForPeer.requestFileBlock,
      [channelId]: {
        cb: requestFileBlockCb,
        timeout: undefined as any,
        hasBeenCalled: false
      }
    };

    const timeout = pollingSend(() => {
      sendRequestFileBlock(this.getConnByRemotePeerId(remoteWorkerId), channelId, fileId, chunkIdx, chunkSize);
    }, {
      intervalMs: REQUEST_FILE_BLOCK_INTERVAL,
      timeoutMs: REQUEST_FILE_BLOCK_TIMEOUT,
      cbRecords: cbStorageForPeer.requestFileBlock[channelId],
      timeoutFn: timeoutCb,
    });

    cbStorageForPeer.requestFileBlock[channelId].timeout = timeout;

    return true;
  }

  private listenOnConnectionForMain(dataConn: DataConnection) {
    dataConn.on('data', (data: CommunicationData) => {
      const { cmdPacket, cmdData } = data;
      if (cmdPacket === CMD_SETS.REQUEST_FILE_BLOCK) {
        const { channelId, chunkIdx, chunkData, done } = cmdData as CommunicationData<CommFileBlockResp>['cmdData'];
        const uploaderPeerId = extractRemotePeerIdFromDataConn(dataConn);
        const requestFileBlockObj = this._cbStorage[uploaderPeerId].requestFileBlock[channelId];
        // FIXME: don't know why it turned into array buffer
        handleCmdRespReceived(requestFileBlockObj, { chunkIdx, chunkData: new Blob([chunkData]), done });
      }
    });
  }
};
