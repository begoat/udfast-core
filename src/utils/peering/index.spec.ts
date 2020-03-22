import { generatePeerId } from '../random';
import { peerGeneratorForTestOnly } from './index';

describe('peer instance', () => {
  it('should return the same peer obj', async () => {
    Array.from({length: 4}, async () => {
      const peer = await peerGeneratorForTestOnly();
      return peer;
    }).every((val, i, arr) => val === arr[0]);
  });
});

describe('peer generator for test', () => {
  it('should init acc and return correct value', async () => {
    Array.from({length: 5}, () => generatePeerId()).every(async val => {
      const peerObj = await peerGeneratorForTestOnly(val);
      const {id} = peerObj;
      return id === val;
    });
  });
});
