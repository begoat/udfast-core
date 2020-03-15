import { generateFileId, generatePeerId } from './index';

describe('FileId generator', () => {
  it('should always generate different id', () => {
    const id1 = generateFileId();
    const id2 = generateFileId();
    expect(id1 === id2).toBe(false);
  });
});

describe('PeerId generator', () => {
  it('should always generate different id', () => {
    const id1 = generatePeerId();
    const id2 = generatePeerId();
    expect(id1 === id2).toBe(false);
  });
});
