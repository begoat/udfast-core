import { WORKER_CHUNK_SIZE } from '../../../../config/index';
import { log } from '../../../../utils/log';

import { DMainMediator } from '../peer-related/DMainMediator';
import { CbType } from '../../types';
import { FileDownloader } from './FileDownloader';
import { getNextDownloadIdx } from '../peer-related/DCommand';
import { UWorkerSets } from './UWorkerSets';
import { DWorkerSets } from './DWorkerSets';

interface DownloadRecords {
  [downloadId: string]: {
    fileId: string;
    uWorkerSets: UWorkerSets;
    dWorkerSets: DWorkerSets;
    fileDownload: FileDownloader;
    done: boolean;
    paused: boolean;
    downloadAccCbList: Array<Function>;
    downloadProgressCbList: Array<Function>;
    downloadExceptionCbList: Array<Function>;
    downloadCancelCbList: Array<Function>;
  };
}

interface FileStorage {
  [fileId: string]: {
    fileName: string;
    fileSize: number;
  };
}

export class DController {
  /**
   * It is to used to communicate with N uploadControllers to get their infomation related to registered files,
   * and notify them the download behavior to generate workers.
   */
  private _downloadMainMediator: DMainMediator;
  private _downloadRecords: DownloadRecords;
  private _fileStorage: FileStorage;
  constructor(downloadMainMediator: DMainMediator) {
    this._downloadMainMediator = downloadMainMediator;
    this._downloadRecords = {};
    this._fileStorage = {};
  }

  public static async init(errCbs?: Function[]) {
    const downloadMainMediator = await DMainMediator.init(errCbs);
    const instance = new DController(downloadMainMediator);
    return instance;
  }

  /**
   * get all available files in the uploader-side, store the fileinfo locally.
   */
  public async getFileList(uploadPeerId: string) {
    await this._downloadMainMediator.connectToPeer(uploadPeerId);
    log('getFileList start', 'targetPeerId', uploadPeerId);
    const fileList = await this._downloadMainMediator.getFileList(uploadPeerId);
    log('getFileList end', 'targetPeerId', uploadPeerId);
    fileList.map(f => {
      this._fileStorage[f.fileId] = {
        fileName: f.fileName,
        fileSize: f.fileSize,
      };
    });

    return fileList;
  }

  /**
   * make some preparations for downloading
   * generated the same num of workers as upload workers
   * init the downloadRecords by downloadId.
   */
  public async initDownload(downloadId: string, peerId: string, fileId: string) {
    const { fileName, fileSize } = this._fileStorage[fileId];
    if (!fileName || !fileSize) {
      throw new Error('fileinfo not available');
    }

    if (this._downloadRecords[downloadId]) {
      return Promise.resolve();
    }

    await this._downloadMainMediator.connectToPeer(peerId);
    const uWorkerList = await this._downloadMainMediator.startDownload(peerId, fileId);
    const dWorkerSets = await DWorkerSets.init(uWorkerList.length);
    this._downloadRecords[downloadId] = {
      fileId,
      uWorkerSets: new UWorkerSets(uWorkerList),
      dWorkerSets,
      fileDownload: new FileDownloader(fileName, fileSize, WORKER_CHUNK_SIZE),
      done: false,
      paused: false,
      downloadAccCbList: [],
      downloadProgressCbList: [],
      downloadExceptionCbList: [],
      downloadCancelCbList: [],
    };

    log('initDownload acc', downloadId, this._downloadRecords[downloadId]);
  }

  public registerCbOnDownloadId(downloadId: string, cb: Function, type: CbType) {
    let targetCbList: Array<Function> = [];
    if (type === CbType.ACC) {
      targetCbList = this._downloadRecords[downloadId].downloadAccCbList;
    } else if (type === CbType.PROGRESS) {
      targetCbList = this._downloadRecords[downloadId].downloadProgressCbList;
    } else if (type === CbType.CANCEL) {
      targetCbList = this._downloadRecords[downloadId].downloadCancelCbList;
    } else if (type === CbType.EXCEPTION) {
      targetCbList = this._downloadRecords[downloadId].downloadExceptionCbList;
    }

    targetCbList.push(cb);
  }

  public startDownloadFile(downloadId: string) {
    if (this._downloadRecords[downloadId]) {
      this._downloadRecords[downloadId].paused = false;
      log('download progress start', ':downloadId', downloadId);
      this.triggerDownload(downloadId);
    }
  }

  public pauseDownloadFile(downloadId: string) {
    if (this._downloadRecords[downloadId]) {
      this._downloadRecords[downloadId].paused = true;
      log('download progress paused', ':downloadId', downloadId);
    }
  }

  public cancelDownloadFile(downloadId: string) {
    if (this._downloadRecords[downloadId]) {
      this._downloadRecords[downloadId].done = true;
      this._downloadRecords[downloadId].fileDownload.cancelDownload();
      log('download progress cancelled', ':downloadId', downloadId);
      this._downloadRecords[downloadId].downloadCancelCbList.forEach(cb => cb());
    }
  }

  // main download algorighm
  private triggerDownload(downloadId: string) {
    const dRecords = this._downloadRecords[downloadId];
    if (!dRecords || dRecords.done) { // skip when records for downloadId not exist or the download process it done.
      return false;
    }

    const {
      dWorkerSets,
      uWorkerSets,
      fileId,
      fileDownload,
      downloadAccCbList,
      downloadProgressCbList,
      downloadExceptionCbList
    } = dRecords;
    dWorkerSets.getWorkerList().forEach(w => {
      const { id: workerId, obj: dWorkerMediatorObj } = w;
      if (dWorkerSets.checkWorkerAvailable(workerId)) {
        if (this.checkPaused(downloadId)) {
          return;
        }

        const bestUploadWorkerId = uWorkerSets.getBestWorker();
        if (!bestUploadWorkerId) {
          throw Error('no worker available');
        }

        uWorkerSets.increaseConnNumById(bestUploadWorkerId);
        dWorkerSets.markWorkerBusy(workerId);
        dWorkerMediatorObj.connectToPeer(bestUploadWorkerId)
          .then(async () => {
            const { _totalNumOfChunks: totalChunks, _chunkWritePosition: currentChunkIdx } = fileDownload;
            const nextDIdx = getNextDownloadIdx(totalChunks, currentChunkIdx, dWorkerSets.getIsDownloadingChunkIdx());
            if (nextDIdx === -1) { // mark download acc
              downloadAccCbList && downloadAccCbList.forEach(cb => cb());
              log('download progress acc', ':downloadId', downloadId);
              dRecords.done = true;
              return;
            }

            uWorkerSets.decreaseConnNumById(workerId);
            const result = await this.downloadChunkAndSave(
              downloadId,
              workerId,
              bestUploadWorkerId,
              nextDIdx,
              fileId,
              fileDownload,
              downloadProgressCbList
            );
            if (result) {
              this.triggerDownload(downloadId);
            }
          })
          .catch(e => {
            log('download chunk', 'exception', e);
            downloadExceptionCbList.forEach(cb => cb(e));
            uWorkerSets.decreaseConnNumById(workerId);
          })
          .finally(() => {
            dWorkerSets.cleanupWorker(workerId);
            this.triggerDownload(downloadId);
          });
      }
    });
  }

  /**
   * current algorithm may performance not so efficient, because it depends on the writing position of chunks
   * So the same chunk will still be downloaded... util the writing process(fileIO) for certain chunk is done.
   */
  private async downloadChunkAndSave(
    downloadId: string,
    workerId: string,
    uploaderId: string,
    chunkIdx: number,
    fileId: string,
    fileDownloader: FileDownloader,
    downloadProgressCbList: Array<Function>,
  ) {
    const { dWorkerSets } = this._downloadRecords[downloadId];
    dWorkerSets.setCurrentChunkIdxForWorker(workerId, chunkIdx);
    downloadProgressCbList && downloadProgressCbList.forEach(cb => cb(chunkIdx, fileDownloader._totalNumOfChunks, 'start'));
    log('download chunk', chunkIdx, 'start');
    const fileBlockResp = await dWorkerSets.reqFileBlock(workerId, uploaderId, fileId, chunkIdx, WORKER_CHUNK_SIZE);
    log('download chunk', chunkIdx, 'end');
    downloadProgressCbList && downloadProgressCbList.forEach(cb => cb(chunkIdx, fileDownloader._totalNumOfChunks, 'end'));
    return fileDownloader.pushCachedBlob(chunkIdx, fileBlockResp.chunkData);
  }

  private checkPaused(downloadId: string) {
    return this._downloadRecords[downloadId].paused;
  }
};
