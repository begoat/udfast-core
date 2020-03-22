import { generateFile } from '../../../../utils/mock';
import { formatFullDate } from '../../../../utils/date';

import { BrowserStreamSaver } from './BrowserStreamSaver';

describe('BrowserStreamSaver one stream writting', () => {
  it('should always true', () => {
    expect(true).toBe(true);
  });

  it('should write a file obj to filesystem directly with (auto) stream pipe method', done => {
    const tmpFileSize = 14;
    const demoFile = generateFile('demoFile', tmpFileSize);
    const downloadUtils = new BrowserStreamSaver(`a-${tmpFileSize}-${formatFullDate(new Date)}.txt`, tmpFileSize);
    downloadUtils.saveFileObjToFile(demoFile).then(() => {
      downloadUtils.closeFileWrite();
    }).then(() => {
      done();
    });
  });

  it('should write to a blob to filesystem with (auto) stream pipe method', done => {
    const blob = new Blob(['BrowserStreamSaver works well via the help of the awesome streamSaver lib']);
    const downloadUtils = new BrowserStreamSaver(`thanks${formatFullDate(new Date)}.txt`, blob.size);
    downloadUtils.saveBlobToFile(blob).then(() => {
      downloadUtils.closeFileWrite();
    }).then(() => {
      done();
    });
  });

  it('should write a file obj to filesystem directly with (manual) stream write method', done => {
    const tmpFileSize = 59;
    const demoFile = generateFile('demoFile', tmpFileSize);
    const downloadUtils = new BrowserStreamSaver(`a-${tmpFileSize}-${formatFullDate(new Date)}.txt`, tmpFileSize, true);
    downloadUtils.saveFileObjToFile(demoFile).then(() => {
      downloadUtils.closeFileWrite();
      done();
    });
  });

  it('should write to a blob with manual stream write method', done => {
    const blob = new Blob(['BrowserStreamSaver works well via the help of the awesome streamSaver lib']);
    const downloadUtils = new BrowserStreamSaver(`thanks${formatFullDate(new Date)}.txt`, blob.size, true);
    downloadUtils.saveBlobToFile(blob).then(() => {
      console.log('download acc');
      downloadUtils.closeFileWrite();
      done();
    });
  });
});

describe('BrowserStreamSaver accept two stream segment', () => {
  it('should always true', () => {
    expect(true).toBe(true);
  });

  it('should write two stream to the file', done => {
    const blob1 = new Blob(['BrowserStreamSaver works well via the help of the awesome streamSaver lib']);
    const blob2 = new Blob(['\nIsn\'t it?']);
    const downloadUtils = new BrowserStreamSaver(`thanks-v2-${formatFullDate(new Date)}.txt`, blob1.size + blob2.size);
    downloadUtils.saveBlobToFile(blob1).then(() => {
      downloadUtils.saveBlobToFile(blob2).then(() => {
        downloadUtils.closeFileWrite();
        done();
      });
    });
  });

  it('should write two stream to the file', done => {
    const blob1 = new Blob(['BrowserStreamSaver works well via the help of the awesome streamSaver lib']);
    const blob2 = new Blob(['\nIsn\'t it?']);
    const downloadUtils = new BrowserStreamSaver(`thanks-v2-${formatFullDate(new Date)}.txt`, blob1.size + blob2.size, true);
    downloadUtils.saveBlobToFile(blob1).then(() => {
      downloadUtils.saveBlobToFile(blob2).then(() => {
        downloadUtils.closeFileWrite();
        done();
      });
    });
  });
});
