import _ from 'lodash';

import { generateFile } from '../../../../utils/mock';

import { UploadController } from '../../upload-side/controller/UploadController';
import { DWorkerMediator } from './DWorkerMediator';
import { DMainMediator } from './DMainMediator';

interface ThisContext {
  _dMainMediator: DMainMediator;
  _uploadController: UploadController;
  _uploadPeerId: string;
}

describe('DWorkerMediator:Basic functionality', () => {
  beforeEach(async function beforeeach(this: ThisContext) {
    this._uploadController = await UploadController.init();
    this._uploadPeerId = this._uploadController.getMainPeerId();
    this._dMainMediator = await DMainMediator.init();
  });

  it('should always true', () => {
    expect(true).toBe(true);
  });

  it('should store connection obj correctly', async function t(this: ThisContext, done) {
    const dWorkerMediator = await DWorkerMediator.init();
    dWorkerMediator.connectToPeer(this._uploadPeerId)
      .then(() => {
        expect(dWorkerMediator['_connEstablished'][this._uploadPeerId].open === true).toBe(true);
        expect(_.isEmpty(dWorkerMediator['_cbStorage'][this._uploadPeerId].requestFileBlock)).toBe(true);
        done();
      });
    expect(dWorkerMediator['_connEstablished'][this._uploadPeerId].dataConn.peer === this._uploadPeerId).toBe(true);
    expect(dWorkerMediator['_connEstablished'][this._uploadPeerId].open === false).toBe(true);
  });

  it('should only trigger register on data callback once', async function t(this: ThisContext) {
    const dWorkerMediator = await DWorkerMediator.init();
    spyOn(dWorkerMediator, 'listenOnConnectionForMain' as any).and.callThrough();
    await dWorkerMediator.connectToPeer(this._uploadPeerId);
    await dWorkerMediator.connectToPeer(this._uploadPeerId);
    expect((dWorkerMediator['listenOnConnectionForMain'] as any).calls.count()).toBe(1);
  });

  it('trigger download but not connect will eject', async function t(this: ThisContext, done) {
    const dWorkerMediator = await DWorkerMediator.init();
    dWorkerMediator.requestFileBlock('any', '1', 0, 1)
      .catch(() => {
        expect(true).toBe(true);
        done();
      });
  });

  it('should download correctly', async function t(this: ThisContext, done) {
    const fileContent = 'COME,thisis a test';
    const f = generateFile('', 0, fileContent);
    const downloadChunkIdx = 0;
    const downloadChunkSize = 8;

    this._uploadController.registerFile(f);
    await this._dMainMediator.connectToPeer(this._uploadPeerId);
    const fileList = await this._dMainMediator.getFileList(this._uploadPeerId);
    const { fileId } = fileList[0];
    const peerList = await this._dMainMediator.startDownload(this._uploadPeerId, fileId);
    const dWorkerGenPromise = peerList.map((p, idx) => {
      return DWorkerMediator.init().then(worker => {
        const certainWorkerId = peerList[idx];
        return worker.connectToPeer(peerList[idx]).then(() => {
          return worker.requestFileBlock(certainWorkerId, fileId, downloadChunkIdx, downloadChunkSize)
            .then(fileBlockResp => {
              expect(fileBlockResp.chunkIdx === downloadChunkIdx).toBe(true);
              expect(fileBlockResp.done === (downloadChunkSize >= fileContent.length)).toBe(true);
              expect(new Blob([fileBlockResp.chunkData])).toEqual(new Blob([fileContent.slice(downloadChunkSize * downloadChunkIdx, downloadChunkSize * (downloadChunkIdx + 1))]));
            });
        });
      });
    });

    Promise.all(dWorkerGenPromise)
      .then(() => {
        done();
      })
      .catch(() => {
        expect(false).toBe(true);
        done();
      });
  });
});
