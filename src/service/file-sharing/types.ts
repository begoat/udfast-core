import { CMD_SETS } from '@/constants';

export interface FileAttr {
  fileName: string;
  fileSize: number;
}

// make sure each request can distinguish from each other so that callback can be executed correctly
export interface CommAllListReq {
  channelId: string;
}

export interface CommAllListResp {
  channelId: string;
  fileList: Array<{ fileId: string } & FileAttr>;
}

// make sure each request can distinguish from each other so that callback can be executed correctly
export interface CommStartDownloadingReq {
  channelId: string;
  fileId: string;
}

export interface CommStartDownloadingResp {
  channelId: string;
  peerList: Array<string>;
}

export interface CommFileBlockReq {
  fileId: string;
  channelId: string; // for async message-like data transcation, use a channelId to distinguish
  chunkIdx: number;
  chunkSize: number;
}

export interface CommFileBlockResp {
  channelId: string;
  chunkIdx: number;
  chunkData: Blob;
  done: boolean;
}

export interface CommunicationData<T = any> {
  cmdPacket: CMD_SETS;
  cmdData: T;
}
