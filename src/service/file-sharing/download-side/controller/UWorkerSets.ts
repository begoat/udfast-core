import _ from 'lodash';

interface UploadWorkerStorage {
  peerId: string;
  connectingNum: number; // how many download worker is connecting to this uploader.
}

export class UWorkerSets {
  private _records: Array<UploadWorkerStorage>;
  constructor(workerList: Array<string>) {
    this._records = this.transformId2Storage(workerList);
  }

  public addWorkers(workerList: Array<string>) {
    this._records = this._records.concat(this.transformId2Storage(workerList));
  }

  public getBestWorker(): string | false {
    const recordsByConnNumAsc = _.orderBy(this._records, ['connectingNum'], ['asc']);
    return recordsByConnNumAsc.length > 0 ? recordsByConnNumAsc[0].peerId : false;
  }

  public increaseConnNumById(workerId: string) {
    for (let i = 0; i < this._records.length; i++) {
      if (this._records[i].peerId === workerId) {
        this._records[i].connectingNum++;
      }
    }
  }

  public decreaseConnNumById(workerId: string) {
    // FIXME: After finishing downloading, the num doesn't decreased to 0
    for (let i = 0; i < this._records.length; i++) {
      if (this._records[i].peerId === workerId) {
        this._records[i].connectingNum = Math.max(0, this._records[i].connectingNum - 1);
      }
    }
  }

  private transformId2Storage = (idList: Array<string>) => {
    return idList.map(i => ({
      peerId: i,
      connectingNum: 0
    }));
  };
};
