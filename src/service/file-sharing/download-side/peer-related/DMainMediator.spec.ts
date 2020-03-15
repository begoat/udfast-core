import _ from 'lodash';

import { getWorkerNumBySize } from '@/utils/peering';
import { generateFile } from '@/utils/mock';
import { generateFileId } from '@/utils/random';

import { DMainMediator } from './DMainMediator';
import { UploadController } from '../../upload-side/controller/UploadController';

interface ThisContext {
  _dMainMediator: DMainMediator;
  _uploadController: UploadController;
  _uploadPeerId: string;
}

describe('DownloadContoller:Remote Connection Test ', () => {
  beforeEach(async function beforeeach(this: ThisContext) {
    this._uploadController = await UploadController.init();
    this._uploadPeerId = this._uploadController.getMainPeerId();
    this._dMainMediator = await DMainMediator.init();
  });

  it('should always true', () => {
    expect(true).toBe(true);
  });

  it('should store connection obj correctly', async function t(this: ThisContext, done) {
    this._dMainMediator.connectToPeer(this._uploadPeerId)
      .then(() => {
        expect(this._dMainMediator['_connEstablished'][this._uploadPeerId].open === true).toBe(true);
        expect(_.isEmpty(this._dMainMediator['_cbStorage'][this._uploadPeerId].getAllFileCmdCb)).toBe(true);
        expect(_.isEmpty(this._dMainMediator['_cbStorage'][this._uploadPeerId].startDownloadCmdCb)).toBe(true);
        done();
      });
    expect(this._dMainMediator['_connEstablished'][this._uploadPeerId].dataConn.peer === this._uploadPeerId).toBe(true);
    expect(this._dMainMediator['_connEstablished'][this._uploadPeerId].open === false).toBe(true);
  });

  it('should only trigger register on data callback once', async function t(this: ThisContext) {
    spyOn(this._dMainMediator, 'listenOnConnectionForMain' as any).and.callThrough();
    await this._dMainMediator.connectToPeer(this._uploadPeerId);
    await this._dMainMediator.connectToPeer(this._uploadPeerId);
    expect((this._dMainMediator['listenOnConnectionForMain'] as any).calls.count()).toBe(1);
  });

  it('trigger get filelist but not connect will eject', async function t(this: ThisContext, done) {
    this._dMainMediator.getFileList(this._uploadPeerId)
      .catch(() => {
        expect(true).toBe(true);
        done();
      });
  });

  it('should get filelist correctly', async function t(this: ThisContext) {
    const f1 = generateFile('t1');
    const fileId1 = this._uploadController.registerFile(f1);
    await this._dMainMediator.connectToPeer(this._uploadPeerId);
    // trigger getFileList immediately after connection open.
    const fileList1 = await this._dMainMediator.getFileList(this._uploadPeerId);
    expect(fileList1).toEqual([{fileId: fileId1, fileName: f1.name, fileSize: f1.size}]);
    // when the first cb executed, register a new file and send CMD again to test the result.
    const f2 = generateFile('t2');
    const fileId2 = this._uploadController.registerFile(f2);
    const fileList2 = await this._dMainMediator.getFileList(this._uploadPeerId);
    expect(fileList2).toEqual([{fileId: fileId1, fileName: f1.name, fileSize: f1.size}, {fileId: fileId2, fileName: f2.name, fileSize: f2.size}]);
    const { getAllFileCmdCb } = this._dMainMediator['_cbStorage'][this._uploadPeerId];
    // all the interval timeout is cleared
    Object.keys(getAllFileCmdCb).map(o => {
      expect(getAllFileCmdCb[o].timeout === undefined).toBe(true);
    });
  });

  it('trigger start download but not connect will eject', async function t(this: ThisContext, done) {
    this._dMainMediator.startDownload(this._uploadPeerId, 'any')
      .catch(() => {
        expect(true).toBe(true);
        done();
      });
  });

  it('should start download correctly', async function t(this: ThisContext) {
    const f = generateFile();
    const fileId = this._uploadController.registerFile(f);
    await this._dMainMediator.connectToPeer(this._uploadPeerId);
    const fileList = await this._dMainMediator.getFileList(this._uploadPeerId);
    expect(fileList[0].fileId === fileId).toBe(true);
    expect(fileList[0].fileId.length === generateFileId().length).toBe(true);
    const peerList = await this._dMainMediator.startDownload(this._uploadPeerId, fileId);
    expect(peerList.length === getWorkerNumBySize()).toBe(true);
    const { startDownloadCmdCb } = this._dMainMediator['_cbStorage'][this._uploadPeerId];
    // all the interval timeout is cleared
    Object.keys(startDownloadCmdCb).map(o => {
      expect(startDownloadCmdCb[o].timeout === undefined).toBe(true);
    });
  });
});
