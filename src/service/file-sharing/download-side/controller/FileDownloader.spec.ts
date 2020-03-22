import { generateFile } from '../../../../utils/mock';
import { getPermutationOfArray } from '../../../../utils/data';

import { FileDownloader, ChunkStatus } from './FileDownloader';
import { FileStorage } from '../../upload-side/controller/FileStorage';

interface ThisContext {
}

const totalNumOfChunks = 5;
const chunkSize = 3;
const generateMockData = () => {
  const file = generateFile('', totalNumOfChunks * chunkSize);
  const fileStorage = new FileStorage(file);
  const fileDownloader = new FileDownloader('', totalNumOfChunks * chunkSize, chunkSize);
  return { file, fileStorage, fileDownloader };
};

describe('FileDownloader', () => {
  it('should always true', function f(this: ThisContext) {
    expect(true).toBe(true);
  });

  it('num of chunk is calced correctly', () => {
    expect(new FileDownloader('', 50, 2)['_totalNumOfChunks']).toBe(25);
    expect(new FileDownloader('', 50, 3)['_totalNumOfChunks']).toBe(17);
    expect(new FileDownloader('', 50, 60)['_totalNumOfChunks']).toBe(1);
    expect(new FileDownloader('', 50, 101)['_totalNumOfChunks']).toBe(1);
    expect(new FileDownloader('', 101, 50)['_totalNumOfChunks']).toBe(3);
  });

  it('pushCachedBlob and the chunkIdx is greater than total chunk num', () => function f(this: ThisContext) {
    const fileDownloader = new FileDownloader('', totalNumOfChunks * chunkSize, chunkSize);
    expect(fileDownloader.pushCachedBlob(totalNumOfChunks, new Blob(['error test']))).toBe(false);
    expect(fileDownloader.pushCachedBlob(-1, new Blob(['error test']))).toBe(false);
    expect(fileDownloader.pushCachedBlob(0, new Blob(['error test']))).toBe(true);
  });

  const originTestCaseArray = Array.from({ length: totalNumOfChunks }, (v, i) => i);
  getPermutationOfArray(originTestCaseArray)
    .map(arr => {
      it(`pushCachedBlob with no duplicate value: ${arr.toString()}`, () => {
        const { fileDownloader, fileStorage } = generateMockData();
        arr.map(idx => {
          const result = fileDownloader.pushCachedBlob(idx, fileStorage.getBlobByChunk(idx, chunkSize));
          expect(result).toBe(true);
          expect(fileDownloader['_chunkStorage'][idx].blobData).toEqual(fileStorage.getBlobByChunk(idx, chunkSize));
          // should ignore dup value
          const startTimeOfCertainChunkIdx = fileDownloader['_chunkStorage'][idx].startTime;
          expect(fileDownloader.pushCachedBlob(idx, new Blob(['test']))).toBe(true);
          expect(fileDownloader._chunkStorage[idx].startTime).toBe(startTimeOfCertainChunkIdx);
        });
      });

      it(`writing chunk with correct sequence of id: ${arr.toString()}`, done => {
        const { fileDownloader, fileStorage } = generateMockData();
        fileDownloader.registerDownloadAccCb(() => {
          expect(fileDownloader['_writingChunkIdxList']).toEqual(originTestCaseArray);
          // should check value cleared
          originTestCaseArray.map(ii => {
            expect(fileDownloader['_chunkStorage'][ii].status === ChunkStatus.WRITE_FINISHED).toBe(true);
            expect(fileDownloader['_chunkStorage'][ii].blobData.size === 0).toBe(true);
            expect(fileDownloader['_chunkStorage'][ii].endTime! > 0).toBe(true);
          });
          expect(fileDownloader._chunkWritePosition === totalNumOfChunks);
          done();
        });

        arr.map(idx => {
          expect(fileDownloader.pushCachedBlob(idx, fileStorage.getBlobByChunk(idx, chunkSize))).toBe(true);
        });
      });
    });

  it('should call function of DownloadUtils correctly', function t(this: ThisContext, done) {
    const { fileDownloader, fileStorage } = generateMockData();
    spyOn(fileDownloader['_downloadUtils'], 'saveBlobToFile').and.callThrough();
    spyOn(fileDownloader['_downloadUtils'], 'closeFileWrite').and.callThrough();
    spyOn(fileDownloader['_downloadUtils'], 'cancelFileWrite').and.callThrough();
    // one more chunk is uesless
    (originTestCaseArray.concat([originTestCaseArray.length])).map(o => {
      fileDownloader.pushCachedBlob(o, fileStorage.getBlobByChunk(o, chunkSize));
    });

    fileDownloader.registerDownloadAccCb(() => {
      fileDownloader.pushCachedBlob(totalNumOfChunks, fileStorage.getBlobByChunk(totalNumOfChunks, chunkSize));
      expect((fileDownloader['_downloadUtils'].saveBlobToFile as any).calls.count()).toBe(originTestCaseArray.length);
      expect((fileDownloader['_downloadUtils'].closeFileWrite as any).calls.count()).toBe(1);
      expect((fileDownloader['_downloadUtils'].cancelFileWrite as any).calls.count()).toBe(0);
      expect(fileDownloader._chunkWritePosition === totalNumOfChunks).toBe(true);
      done();
    });
  });

  it('should cancel correctly', () => {
    const { fileDownloader } = generateMockData();
    spyOn(fileDownloader._downloadUtils, 'cancelFileWrite').and.callThrough();
    fileDownloader.cancelDownload();
    expect((fileDownloader['_downloadUtils'].cancelFileWrite as any).calls.count()).toBe(1);
  });
});
