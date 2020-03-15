import { newPeerGeneratorWithoutReady } from '@/utils/peering';
import { generatePeerId } from '@/utils/random';

import { DPeerBase } from './DPeerBase';

interface ThisContext {
  _dPeer: DPeerBase;
}

describe('DMainMediator:Basic functionality', () => {
  beforeEach(function beforeeach(this: ThisContext) {
    this._dPeer = new DPeerBase(newPeerGeneratorWithoutReady(generatePeerId()));
  });

  it('should always true', () => {
    expect(true).toBe(true);
  });

  it('should init peer correctly', function t(this: ThisContext) {
    expect(this._dPeer['_mainPeerObj'].id === this._dPeer.getMainPeerId()).toBe(true);
  });
});
