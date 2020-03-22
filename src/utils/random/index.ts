import { v4 } from 'uuid';

import { peerIdLength, fileIdLength, passwdLength } from '../../config';

export const getUUId = () => {
  return v4();
};

export const generateString = (len: number) => {
  let text = '';
  const possible = 'abcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < len; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
};

export const generatePeerId = () => {
  return generateString(peerIdLength);
};

export const generateFileId = () => {
  return generateString(fileIdLength);
};

export const generatePasswd = () => {
  return generateString(passwdLength);
};

export const generateTmpChannelId = () => {
  return generateString(10);
};

export const generateDownloadId = () => {
  return generateString(16);
};
