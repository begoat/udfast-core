import Peer, { DataConnection } from 'peerjs';

interface ConnectionsEstablished {
  [remotePeerId: string]: {
    dataConn: DataConnection;
    open: boolean;
  };
}

type initialConnection = boolean;
export class DPeerBase {
  protected _mainPeerObj: Peer;
  protected _connEstablished: ConnectionsEstablished;
  constructor(peerObj: Peer) {
    this._mainPeerObj = peerObj;
    this._connEstablished = {};
  }

  public getMainPeerId(): string {
    return this._mainPeerObj.id;
  }

  protected connectToPeerGeneral(remotePeerId: string): Promise<initialConnection> {
    return new Promise(resolve => {
      // for the second connection try, just resolve and do nothing.
      if (this.checkConnectionOpen(remotePeerId)) {
        resolve(false);
        return;
      }

      const dataConn = this._mainPeerObj.connect(remotePeerId, { reliable: true });
      this._connEstablished[remotePeerId] = {
        dataConn,
        open: false,
      };
      dataConn.on('open', () => {
        this._connEstablished[remotePeerId].open = true;
        resolve(true);
      });
    });
  }

  protected checkConnectionOpen(remotePeerId: string) {
    if (!this._connEstablished[remotePeerId] || !this._connEstablished[remotePeerId].open) {
      return false;
    }

    return true;
  }

  protected getConnByRemotePeerId(remotePeerId: string) {
    return this._connEstablished[remotePeerId].dataConn;
  }
}