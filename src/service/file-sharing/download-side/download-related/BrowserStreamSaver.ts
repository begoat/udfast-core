import streamSaver from '../../../../libs/StreamSaver';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const webStreamPonyfill = require('web-streams-polyfill/ponyfill');

const manuallyAssignWritableStream = () => {
  /**
   * Here we use ponyfill https://github.com/MattiasBuelens/web-streams-polyfill and build it into this lib
   * use ponyfill to fully replace Writable Stream and Transfer Stream is preferred
   * According to suggestions by https://github.com/jimmywarting/StreamSaver.js?files=1#configuration
   */
  streamSaver.WritableStream = webStreamPonyfill.WritableStream;
  (streamSaver as any).TransformStream = webStreamPonyfill.TransformStream;
};


/**
 * This class is used to control the download process, interacting with the browser.
 * The public APIs are write blob(file) to trigger download, cancel/close download process.
 */
export class BrowserStreamSaver {
  private _fileName: string;
  private _fileSize: number;
  private _wStream: WritableStream; // Stream instance by streamSaver
  // we need this variable because we need close stream programatically
  private _wWriter: WritableStreamDefaultWriter;
  private _downloadAcc: boolean; // represent whether download not finished
  private _cancelled: boolean; // represent whether download is cancelled
  private _unloadEvtHandler: () => void;
  private _beforeUnloadEvtHandler: (e: BeforeUnloadEvent) => void;
  constructor(fileName: string, fileSize: number, onlyUseTraditionalVersionJustForTest = true) {
    manuallyAssignWritableStream();
    this._fileName = fileName;
    this._fileSize = fileSize;
    this._wStream = streamSaver.createWriteStream(this._fileName, {
      size: this._fileSize // Makes the procentage visiable in the download
    }, fileSize);
    // for stream.pipeTo(auto) method, the writer will be lock and should init this variables
    this._wWriter = this._wStream.getWriter();
    this._downloadAcc = true;
    this._cancelled = false;
    this._unloadEvtHandler = this.unloadFn.bind(this);
    this._beforeUnloadEvtHandler = this.beforeUnloadFn.bind(this);
    this.addUnloadEvtListener();
  }

  static readBlobDataAsArrayBuffer = (blob: Blob): Promise<ArrayBuffer | string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('loadend', () => {
        if (!reader.result) {
          reject();
        } else {
          resolve(reader.result);
        }
      });
      reader.addEventListener('error', e => {
        reject(e);
      });
      reader.readAsArrayBuffer(blob);
    });
  };

  static readBlobDataAsText = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('loadend', () => {
        if (!reader.result) {
          reject();
        } else {
          resolve(reader.result as string);
        }
      });
      reader.addEventListener('error', e => {
        reject(e);
      });
      reader.readAsText(blob);
    });
  };

  static arrayBufferToReadableStream = (arrayBuffer: ArrayBuffer | string): ReadableStream => {
    const readableStream = new Response(arrayBuffer).body;
    return readableStream as ReadableStream;
  };

  public closeFileWrite() {
    this._downloadAcc = true;
    if (this._wWriter) {
      this._wWriter!.close();
    }

    this.rmUnloadEvtListener();
  }

  public cancelFileWrite() {
    if (!this._cancelled) { // prevent trigger twice because of catch
      if (this._wWriter) {
        this._wWriter!.abort();
      }

      this._cancelled = true;
      this.rmUnloadEvtListener();
    }
  }

  public async saveFileObjToFile(file: File) {
    return this.saveBlobToFile(file);
  }

  public async saveBlobToFile(blob: Blob) {
    this._downloadAcc = false;
    const arrayBuffer = await BrowserStreamSaver.readBlobDataAsArrayBuffer(blob);
    const readableStream = BrowserStreamSaver.arrayBufferToReadableStream(arrayBuffer);
    return this.pipeReadableStreamToWritable(readableStream);
  }

  private addUnloadEvtListener() {
    window.addEventListener('unload', this._unloadEvtHandler);
    window.addEventListener('beforeunload', this._beforeUnloadEvtHandler);
  }

  private rmUnloadEvtListener() {
    window.removeEventListener('unload', this._unloadEvtHandler);
    window.removeEventListener('beforeunload', this._beforeUnloadEvtHandler);
  }

  private unloadFn() {
    this.cancelFileWrite();
  }

  private beforeUnloadFn(evt: BeforeUnloadEvent) {
    if (!this._downloadAcc) {
      evt.returnValue = 'Are you sure you want to leave?';
    }
  }

  private pipeReadableStreamToWritable(rStream: ReadableStream): Promise<void> {
    // We can use pipeTo directly in newer runtime env but its compatibility is bad.
    const rStreamReader = rStream.getReader();
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const that = this;
      rStreamReader.read()
        .then(function writeProcess({ done, value }) {
          if (done) {
            resolve();
          } else {
            that._wWriter!.write(value).then(() => rStreamReader.read().then(writeProcess));
          }
        })
        .catch(e => {
          console.error('eeeee when writing stream', e);
          reject(e);
        });
    });
  }
};
