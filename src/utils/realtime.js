// WebSocket client for online play. Wraps a single connection with a tiny
// event API and typed send helpers. In dev it connects straight to the server
// on :3001; in a deployed build set VITE_API_URL to the server origin.

function wsUrl(token) {
  const httpBase = import.meta.env.VITE_API_URL || `http://${location.hostname}:3001`;
  return `${httpBase.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`;
}

export class Realtime {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
  }

  connect(token) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl(token));
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('Could not connect to the game server.'));
      this.ws.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        this._emit(msg.type, msg);
      };
      this.ws.onclose = () => this._emit('close', {});
    });
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  _emit(type, msg) {
    this.handlers.get(type)?.forEach((fn) => fn(msg));
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  queue(time) {
    this._send({ type: 'queue', time });
  }
  cancel() {
    this._send({ type: 'cancel' });
  }
  move(move, clock) {
    this._send({ type: 'move', move, clock });
  }
  resign() {
    this._send({ type: 'resign' });
  }
  offerDraw() {
    this._send({ type: 'drawOffer' });
  }
  acceptDraw() {
    this._send({ type: 'drawAccept' });
  }
  declineDraw() {
    this._send({ type: 'drawDecline' });
  }
  rematchOffer() {
    this._send({ type: 'rematchOffer' });
  }
  rematchAccept() {
    this._send({ type: 'rematchAccept' });
  }
  leave() {
    this._send({ type: 'leave' });
  }

  close() {
    if (this.ws) {
      this.ws.onclose = null; // don't emit a spurious 'close' on intentional teardown
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
  }
}
