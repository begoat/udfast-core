/**
 * This class is used to encapsulate the process replated to file storage.
 * After instance this class with a fileobj, you can get certain chunk, you can get fileInfo.
 * You can also set passwd and validate passwd.
 */
export class FileStorage {
  private _file: File;
  private _passwd: string;
  constructor(file: File) {
    this._file = file;
    this._passwd = '';
  }

  public getBlobByChunk(chunkIdx: number, chunkSize: number): Blob {
    return this._file.slice(chunkIdx * chunkSize, (chunkIdx + 1) * chunkSize);
  }

  public getFileInfo(): {fileName: string; fileSize: number} {
    return {
      fileName: this._file.name,
      fileSize: this._file.size,
    };
  }

  public setPassword(oldPasswd: string, newPasswd: string): boolean {
    if (oldPasswd !== this._passwd) {
      return false;
    }

    this._passwd = newPasswd;
    return true;
  }

  public validPassword(passwd: string) {
    return passwd === this._passwd;
  }
};
