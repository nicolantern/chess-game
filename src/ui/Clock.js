// Two-sided countdown clock. It measures elapsed time from timestamps rather
// than assuming a fixed tick interval, so it stays accurate even if a tick is
// delayed. `minutes: null` means an unlimited (untimed) game.

export class ChessClock {
  constructor({ minutes, onTick = () => {}, onFlag = () => {} }) {
    this.unlimited = minutes == null;
    const ms = this.unlimited ? 0 : minutes * 60 * 1000;
    this.remaining = [ms, ms]; // [white, black] milliseconds
    this.active = null; // 0 = white, 1 = black
    this.onTick = onTick;
    this.onFlag = onFlag;
    this._interval = null;
    this._lastStamp = 0;
  }

  /** Start (or switch to) the given side's clock running. */
  start(side) {
    this.active = side;
    if (this.unlimited) return;
    this.stop();
    this._lastStamp = Date.now();
    this._interval = setInterval(() => this._tick(), 100);
  }

  _tick() {
    const now = Date.now();
    this.remaining[this.active] -= now - this._lastStamp;
    this._lastStamp = now;
    if (this.remaining[this.active] <= 0) {
      this.remaining[this.active] = 0;
      this.stop();
      this.onTick(this.remaining);
      this.onFlag(this.active);
      return;
    }
    this.onTick(this.remaining);
  }

  /** Switch the running clock to `side` (called after each move). */
  switch(side) {
    if (this.unlimited) {
      this.active = side;
    } else {
      this.start(side);
    }
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
}
