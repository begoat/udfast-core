import { name } from '../../../package.json';

const logPrefix = `[${name}]`;

export const log = (...args: any[]) => {
  console.log(`${logPrefix}-[${new Date().getTime()}]`, ...args);
};

export const warn = (...args: any[]) => {
  console.warn(logPrefix, ...args);
};

export const err = (...args: any[]) => {
  console.error(logPrefix, ...args);
};
