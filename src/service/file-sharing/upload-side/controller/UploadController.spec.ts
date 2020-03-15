import Peer, { DataConnection } from 'peerjs';
import _ from 'lodash';

import { generatePeerId, generateTmpChannelId } from '@/utils/random';
import { generateFile } from '@/utils/mock';
import { CMD_SETS } from '@/constants/index';
import { newPeerGeneratorWithReady, getWorkerNumBySize } from '@/utils/peering';

import {
  CommunicationData,
  CommAllListReq,
  CommAllListResp,
  CommStartDownloadingReq,
  CommStartDownloadingResp,
  CommFileBlockReq,
  CommFileBlockResp
} from '../../types';
import { UploadController } from './UploadController';
import { BrowserStreamSaver } from '../../download-side/download-related/BrowserStreamSaver';

interface ThisContext {
  _uploadController: UploadController;
  _testPeer: Peer;
  _fileName1: string;
  _fileContent1: string;
  _file1: File;
  _dataConn: DataConnection;
}

describe('UploadController:Basic functionality', () => {
  beforeEach(async function beforeeach(this: ThisContext) {
    this._uploadController = await UploadController.init();
  });

  it('should always true', () => {
    expect(true).toBe(true);
  });

  it('should init peer correctly', function t(this: ThisContext) {
    expect(this._uploadController['_mainPeerObj'].id === this._uploadController.getMainPeerId()).toBe(true);
  });

  it('should registerFile correctly', function t(this: ThisContext) {
    const fileName = 'noname';
    const fileContent = 'COME,thisis a test';
    const file = generateFile(fileName, 0, fileContent);
    const fileId = this._uploadController.registerFile(file);
    const resultStorage = this._uploadController['_fileStorage'][fileId].getFileInfo();
    expect(resultStorage.fileName === fileName).toBe(true);
    expect(resultStorage.fileSize === file.size).toBe(true);
  });

  it('should getAllFileList correctly', function t(this: ThisContext) {
    const file1 = generateFile('file1', 14);
    const file2 = generateFile('file2', 66);
    const fileId1 = this._uploadController.registerFile(file1);
    const fileId2 = this._uploadController.registerFile(file2);
    expect(this._uploadController['_fileStorageList'].length).toBe(2);
    expect(this._uploadController['_fileStorageList'].indexOf(fileId1)).toBe(0);
    expect(this._uploadController['_fileStorageList'].indexOf(fileId2)).toBe(1);
  });
});

describe('UploadController:Remote Connection Test', () => {
  beforeEach(async function beforeeach(this: ThisContext) {
    console.log('UploadController Unittest beforeEach');
    this._uploadController = await UploadController.init();
    // FIXME: DownloadPeer shouldn't wait for `open signal`
    this._testPeer = await newPeerGeneratorWithReady(generatePeerId());
    this._fileName1 = 'noname';
    this._fileContent1 = 'COME,thisis a test';
    this._file1 = generateFile(this._fileName1, 0, this._fileContent1);
    this._dataConn = this._testPeer.connect(this._uploadController.getMainPeerId(), {
      reliable: true,
    });
  });

  it('should always true', () => {
    console.log('UploadController Unittest should always true');
    expect(true).toBe(true);
  });

  it('connections should be stored correctly', function t(this: ThisContext, done) {
    console.log('UploadController Unittest should be stored correctly');
    const uPeerId = this._uploadController.getMainPeerId();
    const dPeerId = this._testPeer.id;

    this._dataConn.on('open', () => {
      expect(uPeerId === dPeerId).toBe(false);
      expect(uPeerId === this._dataConn.peer).toBe(true);
      expect(dPeerId === this._uploadController['_connEstablished'][dPeerId].peer).toBe(true);
      done();
    });
  });

  it('GET_ALL_FILE CMD', function t(this: ThisContext, done) {
    console.log('UploadController Unittest GET_ALL_FILE CMD');
    let getAllFileInterval: NodeJS.Timeout;
    const fileId1 = this._uploadController.registerFile(this._file1);
    const fileId2 = this._uploadController.registerFile(generateFile());
    const channelId = generateTmpChannelId();
    this._dataConn.on('open', () => {
      const reqInfoCmd: CommunicationData<CommAllListReq> = {
        cmdPacket: CMD_SETS.GET_FILE_LIST,
        cmdData: {
          channelId,
        }
      };

      this._dataConn.on('data', (data: CommunicationData<CommAllListResp>) => {
        const { cmdPacket, cmdData } = data;
        if (cmdPacket === CMD_SETS.GET_FILE_LIST) {
          clearInterval(getAllFileInterval);
          const { channelId: channelIdRespBack, fileList } = cmdData;
          expect(channelId === channelIdRespBack).toBe(true);
          expect(fileList[0].fileId).toBe(fileId1);
          expect(fileList[0].fileName).toBe(this._fileName1);
          expect(fileList[0].fileSize).toBe(this._file1.size);
          expect(fileList[1].fileId).toBe(fileId2);
          done();
        }
      });

      const sendGetFileCmd = () => this._dataConn.send(reqInfoCmd);
      getAllFileInterval = setInterval(() => {
        sendGetFileCmd();
      }, 1000);
      sendGetFileCmd();
    });
  });

  it('START_DOWNLOAD_FILE CMD & REQUEST_FILE_BLOCK', function t(this: ThisContext, done) {
    console.log('UploadController Unittest START_DOWNLOAD_FILE CMD & REQUEST_FILE_BLOCK');
    // for retries that are necessary
    let startDownloadInterval: NodeJS.Timeout;
    let downloadChunkInterval: NodeJS.Timeout;
    // FIXME: don't know why it may fail sometime
    const dPeerId = this._testPeer.id;
    const fileId = this._uploadController.registerFile(this._file1);

    this._dataConn.on('open', () => {
      console.log('[download controller] main connection opened');
      const startDownloadChannelIdReq = generateTmpChannelId();
      const reqInfoCmd: CommunicationData<CommStartDownloadingReq> = {
        cmdPacket: CMD_SETS.START_FILE_DOWNLOAD,
        cmdData: {
          fileId,
          channelId: startDownloadChannelIdReq
        }
      };

      this._dataConn.on('data', (data: CommunicationData<CommStartDownloadingResp>) => {
        const { cmdPacket, cmdData } = data;
        console.log('[download controller] main data received', data);
        if (cmdPacket === CMD_SETS.START_FILE_DOWNLOAD) {
          clearInterval(startDownloadInterval);
          const { peerList, channelId: startDownloadChannelIdResp } = cmdData;
          expect(peerList.length === getWorkerNumBySize(this._file1.size)).toBe(true);
          expect(startDownloadChannelIdResp === startDownloadChannelIdReq).toBe(true);
          expect(_.isEqual(_.sortBy(this._uploadController['_uploadWorker'][dPeerId][fileId]), _.sortBy(peerList))).toBe(true);
          peerList.map(p => expect(this._uploadController['_uploadWorkerStorage'][p].peerObj.id === p).toBe(true));
          // test request file block
          const downloadId = generateTmpChannelId();
          const downloadChunkIdx = 0;
          const downloadChunkSize = 8;
          const reqFileBlock: CommunicationData<CommFileBlockReq> = {
            cmdPacket: CMD_SETS.REQUEST_FILE_BLOCK,
            cmdData: {
              fileId,
              channelId: downloadId,
              chunkIdx: downloadChunkIdx,
              chunkSize: downloadChunkSize
            }
          };

          const connectionBetWorkers = this._testPeer.connect(peerList[0], { reliable: true });
          connectionBetWorkers.on('open', () => {
            console.log('[download controller] worker connection opened');
            connectionBetWorkers.on('data', (fileBlockData: CommunicationData<CommFileBlockResp>) => {
              console.log('[download controller] worker data received', fileBlockData);
              const { cmdPacket: fileBlockDataPacket, cmdData: fileBlockDataData } = fileBlockData;
              if (fileBlockDataPacket === CMD_SETS.REQUEST_FILE_BLOCK) {
                clearInterval(downloadChunkInterval);
                const { channelId, chunkIdx, chunkData, done: finished } = fileBlockDataData;
                // FIXME: don't know why it turned into array buffer
                BrowserStreamSaver.readBlobDataAsText(new Blob([chunkData])).then((tt: string) => {
                  expect(downloadId === channelId).toBe(true);
                  expect(chunkIdx === downloadChunkIdx).toBe(true);
                  expect(finished).toBe(false);
                  expect(tt === this._fileContent1.slice(downloadChunkSize * downloadChunkIdx, downloadChunkSize * (downloadChunkIdx + 1))).toBe(true);
                  done();
                });
              }
            });

            const sendDownloadChunkCmd = () => connectionBetWorkers.send(reqFileBlock);
            downloadChunkInterval = setInterval(() => {
              sendDownloadChunkCmd();
            }, 1000);
            sendDownloadChunkCmd();
          });
        }
      });

      console.log('[download controller] startDownload Cmd send', reqInfoCmd);
      const sendStartDownloadCmd = () => this._dataConn.send(reqInfoCmd);
      startDownloadInterval = setInterval(() => {
        sendStartDownloadCmd();
      }, 1000);

      sendStartDownloadCmd();
    });
  });
});

