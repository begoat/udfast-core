import { DataConnection } from 'peerjs';
import _ from 'lodash';

import { CMD_SETS } from '../../../../constants';

import {
  CommunicationData,
  CommAllListReq,
  CommStartDownloadingReq,
  CommFileBlockReq
} from '../../types';

export interface CbRecords {
  cb: Function | undefined;
  timeout: NodeJS.Timeout;
  hasBeenCalled: boolean;
}

export const sendGetFileListCmd = (dataConn: DataConnection, channelId: string) => {
  const reqCmd: CommunicationData<CommAllListReq> = {
    cmdPacket: CMD_SETS.GET_FILE_LIST,
    cmdData: { channelId },
  };

  dataConn.send(reqCmd);
};

export const sendStartDownloadCmd = (dataConn: DataConnection, channelId: string, fileId: string) => {
  const reqCmd: CommunicationData<CommStartDownloadingReq> = {
    cmdPacket: CMD_SETS.START_FILE_DOWNLOAD,
    cmdData:  { channelId, fileId },
  };

  dataConn.send(reqCmd);
};

export const sendRequestFileBlock = (dataConn: DataConnection, channelId: string, fileId: string, chunkIdx: number, chunkSize: number) => {
  const reqCmd: CommunicationData<CommFileBlockReq> = {
    cmdPacket: CMD_SETS.REQUEST_FILE_BLOCK,
    cmdData: { channelId, fileId, chunkIdx, chunkSize },
  };

  dataConn.send(reqCmd);
};

export const pollingSend = (
  sendFn: Function,
  { intervalMs, timeoutMs, timeoutFn, cbRecords }: { intervalMs: number; timeoutMs: number; timeoutFn?: Function; cbRecords: CbRecords }
): NodeJS.Timeout => {
  const timeout: NodeJS.Timeout = setInterval(() => {
    sendFn();
  }, intervalMs);
  sendFn(); // exec immediately

  // if no related data received, mark it timeout, clear it and exec timeoutFn
  setTimeout(() => {
    // check cbRecords exist first because it maybe gc in test env
    if (cbRecords && cbRecords.timeout !== undefined) { // if cbRecords.timeout equals to undefined, means it's been cleared, otherwise, it's timeout.
      cbRecords.timeout = undefined as any;
      clearInterval(timeout);
      timeoutFn && timeoutFn();
    }
  }, timeoutMs);

  return timeout;
};

export const extractRemotePeerIdFromDataConn = (dataConn: DataConnection) => dataConn.peer;

export const handleCmdRespReceived = (cbRecords: CbRecords, cbParam: any) => {
  const { cb, timeout } = cbRecords;
  if (!timeout) { // means it's timeout
    return;
  }

  clearInterval(timeout);
  cbRecords.timeout = undefined as any; // mark that the interval fn is been cleared. will change the origin object.

  if (_.isFunction(cb) && !cbRecords.hasBeenCalled) { // make sure the function is only be called once
    cb(cbParam);
    cbRecords.hasBeenCalled = true;
  }
};

/**
 * If the return value is -1, means download acc.
 * return the next value
 *
 * current the algorithm relys on the currentWritePos to determine the next download chunkIdx,
 * This can make sure that the blob needed is correctly downloaded.
 *
 * TODO: But maybe a more resource optimized way it maintain an array of chunks. pop the element out of the array when download starts,
 * and re-add it to the array when downloads timeout.
 */
export const getNextDownloadIdx = (totalNumOfChunks: number, currentWritePos: number, isDownloadingChunkList: Array<number>): number => {
  for(let i = currentWritePos; i < totalNumOfChunks; i++) {
    if (isDownloadingChunkList.indexOf(i) === -1) {
      return i;
    }
  }

  return -1;
};
