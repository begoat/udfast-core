/**
 * mock file thanks to josephhanson
 * https://gist.github.com/josephhanson/372b44f93472f9c5a2d025d40e7bb4cc
 */

export function MockFile() { };
// eslint-disable-next-line @typescript-eslint/space-before-function-paren
MockFile.prototype.create = function m(
  name: string,
  charnum: number,
  blobData: BlobPart,
  mimeType: MimeType['type'],
) {
  name = name || 'mock.txt';
  charnum = charnum || 1024;
  mimeType = mimeType || 'plain/txt';

  function range(count: number) {
    let output = '';
    for (let i = 0; i < count; i++) {
      output += 'a';
    }
    return output;
  }

  const blob = new Blob([blobData || range(charnum)], { type: mimeType }) as any;
  blob.lastModifiedDate = new Date();
  blob.name = name;
  return blob as File;
};

export const generateFile = (
  name?: string,
  charnum?: number,
  blobData?: BlobPart,
  mimeType?: MimeType['type'],
): File => {
  // @ts-ignore
  const tmpFile = new MockFile();
  return tmpFile.create(name, charnum, blobData, mimeType);
};
