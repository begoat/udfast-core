import { DWorkerMediator } from '../peer-related/DWorkerMediator';

export enum DWorkerStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
}

interface DownloadWorkerStorage {
  [downloadWorkerId: string]: {
    obj: DWorkerMediator;
    status: DWorkerStatus;
    currentChunkIdx: number | null;
  };
}

export class DWorkerSets {
  private _records: DownloadWorkerStorage;
  constructor(workerSets: Array<DWorkerMediator>) {
    this._records = {};
    workerSets.map(w => {
      const id = w.getMainPeerId();
      this._records[id] = {
        obj: w,
        status: DWorkerStatus.AVAILABLE,
        currentChunkIdx: null
      };
    });
  }

  public static async init(workerNum: number) {
    const workerSets = await Promise.all(Array.from({ length: workerNum }, () => DWorkerMediator.init()));
    const instance = new DWorkerSets(workerSets);
    return instance;
  }

  public getWorkerList() {
    return Object.keys(this._records).map(r => ({
      ...this._records[r],
      id: r
    }));
  }

  // know which chunks are downloading.
  public getIsDownloadingChunkIdx() {
    const workerIdList = Object.keys(this._records);
    if (!workerIdList.length) return [];
    return workerIdList.reduce((accu, curr) => {
      const dIdx = this._records[curr].currentChunkIdx;
      accu = dIdx === null ? accu : accu.concat([dIdx]);
      return accu;
    }, [] as Array<number>);
  }

  public setCurrentChunkIdxForWorker(workerId: string, currIdx: number) {
    this._records[workerId].currentChunkIdx = currIdx;
  }

  // The timeout is implemented in the worker class
  public async reqFileBlock(workerId: string, uploadId: string, fileId: string, chunkIdx: number, chunkSize: number) {
    return this._records[workerId].obj.requestFileBlock(uploadId, fileId, chunkIdx, chunkSize);
  }

  public cleanupWorker(workerId: string) {
    this._records[workerId].status = DWorkerStatus.AVAILABLE;
    this._records[workerId].currentChunkIdx = null;
  }

  public markWorkerBusy(workerId: string) {
    this._records[workerId].status = DWorkerStatus.BUSY;
  }

  public checkWorkerAvailable(workerId: string) {
    return this._records[workerId].status === DWorkerStatus.AVAILABLE;
  }
};
