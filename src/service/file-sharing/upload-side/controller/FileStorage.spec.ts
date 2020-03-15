import { generateFile } from '@/utils/mock';

import { FileStorage } from './FileStorage';

interface ThisContext {
  testFileName: string;
  testFileContent: string;
  testFile: File;
  testFileStorage: FileStorage;
}


describe('FileStorage', () => {
  beforeEach(function beforeeach(this: ThisContext) {
    this.testFileName = 'noname';
    this.testFileContent = 'COME,thisis a test';
    this.testFile = generateFile(this.testFileName, 0, this.testFileContent);
    this.testFileStorage = new FileStorage(this.testFile);
  });

  it('should always true', function f(this: ThisContext) {
    expect(true).toBe(true);
  });

  it('getBlobByChunk acc', function f(this: ThisContext, done) {
    const testcase = [{ chunkIdx: 0, chunkSize: 4 }, { chunkIdx: 2, chunkSize: 4 }, { chunkIdx: 1, chunkSize: 5}];
    const result = ['COME', 'sis ', 'thisi'];
    const results = testcase.map(async (t, idx: number) => {
      const resultTxt = await this.testFileStorage.getBlobByChunk(t.chunkIdx, t.chunkSize).text();
      expect(result[idx] === resultTxt).toBe(true);
    });

    Promise.all(results).then(() => done());
  });

  it('getFileInfo acc', function f(this: ThisContext) {
    const fileInfo = this.testFileStorage.getFileInfo();
    expect(fileInfo.fileName === this.testFileName).toBe(true);
    expect(fileInfo.fileName === `${this.testFileName}1`).toBe(false);
    expect(fileInfo.fileSize === this.testFileContent.length).toBe(true);
  });

  it('setPassword acc', function f(this: ThisContext) {
    const newPasswd1 = '123123';
    const newPasswd2 = 'asdasd';
    expect(this.testFileStorage.setPassword('', newPasswd1)).toBe(true);
    expect(this.testFileStorage.setPassword('', newPasswd2)).toBe(false);
    expect(this.testFileStorage.setPassword(newPasswd1, newPasswd2)).toBe(true);
  });

  it('validPassword acc', function f(this: ThisContext) {
    const newPasswd1 = '123123';
    const newPasswd2 = 'asdasd';
    expect(this.testFileStorage.validPassword('')).toBe(true);
    this.testFileStorage.setPassword('', newPasswd1);
    expect(this.testFileStorage.validPassword(newPasswd1)).toBe(true);
    this.testFileStorage.setPassword('', newPasswd2);
    expect(this.testFileStorage.validPassword(newPasswd2)).toBe(false);
    expect(this.testFileStorage.validPassword(newPasswd1)).toBe(true);
    this.testFileStorage.setPassword(newPasswd1, newPasswd2);
    expect(this.testFileStorage.validPassword(newPasswd2)).toBe(true);
  });
});
