import { generateFile } from '@/utils/mock';
import { generateDownloadId, generateTmpChannelId } from '@/utils/random';
import { getWorkerNumBySize } from '@/utils/peering';

import { DController } from './DController';
import { UploadController } from '../../upload-side/controller/UploadController';
import { FileDownloader } from './FileDownloader';

interface ThisContext {
  _dController: DController;
  _uController: UploadController;
  _uPeerId: string;
}

describe('DController:Basic functionality', () => {
  beforeEach(async function beforeeach(this: ThisContext) {
    this._dController = await DController.init();
    this._uController = await UploadController.init();
    this._uPeerId = this._uController.getMainPeerId();
  });

  it('should always true', () => {
    expect(true).toBe(true);
  });

  it('should get file list correctly', async function t(this: ThisContext) {
    spyOn(this._dController['_downloadMainMediator'], 'connectToPeer').and.callThrough();
    spyOn(this._dController['_downloadMainMediator'], 'getFileList').and.callThrough();
    const result = await this._dController.getFileList(this._uPeerId);
    expect((this._dController['_downloadMainMediator']['connectToPeer'] as any).calls.count()).toBe(1);
    expect((this._dController['_downloadMainMediator']['getFileList'] as any).calls.count()).toBe(1);
    expect(result).toEqual([]);
    const file = generateFile();
    const fileId = this._uController.registerFile(file);
    await this._dController.getFileList(this._uPeerId);
    expect(this._dController['_fileStorage'][fileId].fileName).toBe(file.name);
    expect(this._dController['_fileStorage'][fileId].fileSize).toBe(file.size);
  });

  it('should get worker list correctly', async function t(this: ThisContext) {
    const file = generateFile();
    const fileId = this._uController.registerFile(file);
    const downloadId = generateTmpChannelId();
    await this._dController.getFileList(this._uPeerId);
    await this._dController.initDownload(downloadId, this._uPeerId, fileId);
    expect(this._dController['_downloadRecords'][downloadId].dWorkerSets.getWorkerList().length)
      .toBe(getWorkerNumBySize(file.size));
  });

  it('should get File list before startDownloadProgress', function t(this: ThisContext, done) {
    const fileId = this._uController.registerFile(generateFile());
    const downloadId = generateDownloadId();
    this._dController.initDownload(downloadId, this._uPeerId, fileId)
      .catch(() => done());
  });

  it('should start download process correctly', async function t(this: ThisContext, done) {
    spyOn<any>(this._dController, 'getFileList').and.callThrough();
    spyOn<any>(this._dController, 'initDownload').and.callThrough();
    spyOn<any>(this._dController, 'startDownloadFile').and.callThrough();
    const file = generateFile();
    const downloadId = generateDownloadId();
    const fileId = this._uController.registerFile(file);
    await this._dController.getFileList(this._uPeerId);
    await this._dController.initDownload(downloadId, this._uPeerId, fileId);
    this._dController.registerDownloadAcc(downloadId, () => {
      const dRecords = this._dController['_downloadRecords'][downloadId];
      expect((this._dController['getFileList'] as any).calls.count()).toBe(1);
      expect((this._dController['initDownload'] as any).calls.count()).toBe(1);
      expect((this._dController['startDownloadFile'] as any).calls.count()).toBe(1);
      expect(dRecords.fileId === fileId).toBe(true);
      expect(dRecords.fileDownload instanceof FileDownloader).toBe(true);
      done();
    });
    this._dController.startDownloadFile(downloadId);
  });

  it('should pause and re-download properly', async function t(this: ThisContext, done) {
    const file = generateFile('test.txt', 1024 * 1024 * 3); // 3M
    const downloadId = generateDownloadId();
    const fileId = this._uController.registerFile(file);
    await this._dController.getFileList(this._uPeerId);
    await this._dController.initDownload(downloadId, this._uPeerId, fileId);
    this._dController.registerDownloadAcc(downloadId, () => {
      done();
    });
    this._dController.startDownloadFile(downloadId);
    this._dController.pauseDownloadFile(downloadId);
    setTimeout(() => {
      this._dController.startDownloadFile(downloadId);
    }, 3000);
  });
});
