import Peer from 'peerjs';

import { TURN_URL, STUN_URL, STUN_TURN_CREDENTIAL, STUN_TURN_USER, LOAD_M_PER_WORKER } from '../../config/index';

import pkg from '../../../package.json';
import { generatePeerId } from '../random';

const iceServerConfig = [
  { urls: TURN_URL, username: STUN_TURN_USER, credential: STUN_TURN_CREDENTIAL },
  { urls: STUN_URL },
  { urls: 'stun:stun.l.google.com:19302' },
];

const genNewPeerWithDefaultConfig = (peerId: string) => new Peer(peerId, {
  debug: 2,
  config: { iceServers: iceServerConfig },
  ...(process.env.NODE_ENV === 'development' && { // todo only use local when developing
    host: '127.0.0.1',
    port: Number(pkg.config.port),
  })
});

export const peerGeneratorForTestOnly = (peerId?: string): Promise<Peer> => {
  return new Promise((resolve, reject) => {
    const peer = genNewPeerWithDefaultConfig(peerId || generatePeerId());
    peer.on('open', () => {
      resolve(peer);
    });

    peer.on('error', e => {
      reject(e);
    });
  });
};

/**
 * You may use the peer before this is emitted, but messages to the server will be queued.
 * You should not wait for this event before connecting to other peers if connection speed is important.
 */
export const newPeerGeneratorWithoutReady = (peerId: string) => {
  const peerInstance = genNewPeerWithDefaultConfig(peerId);
  peerInstance.on('disconnected', () => {
    console.log('[peerInstance] disconnected');
    setTimeout(() => {
      peerInstance.reconnect();
    }, 1000);
  });

  return peerInstance;
};

export const newPeerGeneratorWithReady = (peerId: string): Promise<Peer> => {
  return new Promise((resolve, reject) => {
    const peerInstance = genNewPeerWithDefaultConfig(peerId);
    peerInstance.on('open', () => {
      peerInstance.on('disconnected', () => {
        setTimeout(() => {
          peerInstance.reconnect();
        }, 1000);
      });
      resolve(peerInstance);
    });

    peerInstance.on('error', e => {
      const { type } = e;
      if (['browser-incompatible', 'disconnected'].indexOf(type) === -1) { // destroy if not this kinds of types
        console.log('destroy server', peerId);
        peerInstance.destroy();
      }

      reject(type);
    });
  });
};

export const getWorkerNumBySize = (fileSize?: number) => 3;