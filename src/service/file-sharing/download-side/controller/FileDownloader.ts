import _ from 'lodash';

import { BrowserStreamSaver } from '../download-related/BrowserStreamSaver';

export enum ChunkStatus {
  NOT_DOWNLOAD = 'NOT_DOWNLOAD',
  DOWNLOADED_NOT_WRITE = 'DOWNLOADING',
  WRITE_FINISHED = 'WRITE_FINISHED'
}

export interface ChunkEntity {
  status: ChunkStatus;
  blobData: Blob;
  startTime: number;
  endTime?: number;
}

/**
 * This class is used to balance the parallel network download and sequential file writing.
 */
export class FileDownloader {
  _totalNumOfChunks: number;
  _chunkStorage: { [chunkIdx: string]: ChunkEntity };
  _chunkWritePosition: number; // records where the writing process is(meaning if received certain chunk, start writing => waiting for the chunk)
  _writingLock: boolean;
  _writingCheckWaitingNum: number;
  _writingChunkIdxList: Array<number>; // for test only, to check the download cache algorithm is correct.
  _downloadAccCbList: Array<Function>;
  _downloadUtils: BrowserStreamSaver;
  constructor(fileName: string, fileSize: number, chunkSize: number) {
    this._totalNumOfChunks = Math.ceil(fileSize / chunkSize);
    this._chunkWritePosition = 0;
    this._chunkStorage = {};
    this._writingLock = false;
    this._writingCheckWaitingNum = 0;
    this._writingChunkIdxList = [];
    this._downloadAccCbList = [];
    this._downloadUtils = new BrowserStreamSaver(fileName, fileSize);
  }

  public registerDownloadAccCb(cb: Function) {
    this._downloadAccCbList.push(cb);
  }

  public pushCachedBlob(chunkIdx: number, chunkData: Blob): boolean {
    // TODO: set a max cache index, so that for large enough files, the memory will not exceed.
    if (chunkIdx >= this._totalNumOfChunks || chunkIdx < 0) {
      return false;
    }

    // status is undefined, or status is not download will run the condition
    if ([ChunkStatus.WRITE_FINISHED, ChunkStatus.DOWNLOADED_NOT_WRITE].indexOf(_.get(this, `_chunkStorage.${chunkIdx}.status`)) === -1) {
      this._chunkStorage[chunkIdx] = {
        status: ChunkStatus.DOWNLOADED_NOT_WRITE,
        blobData: chunkData,
        startTime: new Date().getTime(),
      };

      if (chunkIdx === this._chunkWritePosition) {
        this.mutexCheckAndWrite();
      }
    }

    return true;
  }

  private mutexCheckAndWrite() {
    if (this._writingLock) { // is locked
      this._writingCheckWaitingNum++;
    } else {
      this._writingLock = true;
      // main check logic
      this.checkAndWrite() // only a function will be executed once
        .then(() => {
          this._writingLock = false;
          while(this._writingCheckWaitingNum > 0) {
            this._writingCheckWaitingNum--;
            this.mutexCheckAndWrite();
          }
        });
    }
  }

  private checkAndWrite(): Promise<any> {
    return new Promise((resolve, reject) => {
      const chunkWritePosition = this._chunkWritePosition;
      if (chunkWritePosition < 0 || chunkWritePosition >= this._totalNumOfChunks) {
        resolve();
        return;
      }

      if (_.get(this, `_chunkStorage.${chunkWritePosition}.status`) === ChunkStatus.DOWNLOADED_NOT_WRITE) {
        this._downloadUtils.saveBlobToFile(this._chunkStorage[chunkWritePosition].blobData)
          .then(() => {
            this._writingChunkIdxList.push(chunkWritePosition);
            // change status of chunkStorage
            this._chunkStorage[chunkWritePosition] = {
              ...this._chunkStorage[chunkWritePosition],
              status: ChunkStatus.WRITE_FINISHED,
              blobData: new Blob([]),
              endTime: new Date().getTime(),
            };

            if (chunkWritePosition < this._totalNumOfChunks - 1) { // if equal to totalNumOfChunks - 1, skip it.
              this._chunkWritePosition++;
              this.checkAndWrite().then(() => {
                resolve();
              });
            } else {
              this._chunkWritePosition++;
              this._downloadUtils.closeFileWrite();
              this._downloadAccCbList.map(a => a());
              resolve();
            }
          })
          .catch(reject);
      } else {
        resolve();
      }
    });
  }

  public cancelDownload() {
    this._downloadUtils.cancelFileWrite();
  }
};
