export enum CMD_SETS {
  GET_FILE_LIST = 'GET_FILE_LIST',
  REQUEST_FILE_INFO = 'REQUEST_FILE_INFO', // DEPRECATED
  REQUEST_FILE_BLOCK = 'REQUEST_FILE_BLOCK',
  START_FILE_DOWNLOAD = 'START_FILE_DOWNLOAD',
}

// TODO: There is an pre-defined env variable called PUBLIC_PATH, maybe we should prefer that one?
const publicPath = process.env.REACT_APP_PUBLIC_PATH;
export const __PUBLIC__: string = (!publicPath || publicPath === '/') ? '' : publicPath;
