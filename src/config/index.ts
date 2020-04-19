import pkg from '../../package.json';

export const v = pkg.version;

export const peerIdLength = 8;
export const fileIdLength = 6;
export const passwdLength = 6;
export const DOWNLOAD_CHUNK_SIZE = 1024 * 1024 * 0.2; // 200k split chunk on the client app side
export const STUN_TURN_SERVER_PUB_IP = '175.24.48.46:3478';
export const STUN_TURN_USER = 'william';
export const STUN_TURN_CREDENTIAL = 'github.io';
export const TURN_URL = `turn:${STUN_TURN_SERVER_PUB_IP}`;
export const STUN_URL = `stun:${STUN_TURN_SERVER_PUB_IP}`;
export const LOAD_M_PER_WORKER = 10;
export const GET_ALL_FILE_INTERVAL = 1000;
export const GET_ALL_FILE_TIMEOUT = 10000;
export const START_DOWNLOAD_INTERVAL = 1000;
export const START_DOWNLOAD_TIMEOUT = 10000;
export const REQUEST_FILE_BLOCK_INTERVAL = 1000;
export const REQUEST_FILE_BLOCK_TIMEOUT = 300000;
export const WORKER_CHUNK_SIZE = 1024 * 1024 * 0.2; // 200k
