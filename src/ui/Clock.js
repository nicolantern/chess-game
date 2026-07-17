// Two-sided countdown clock. It measures elapsed time from timestamps rather
// than assuming a fixed tick interval, so it stays accurate even if a tick is
// delayed. `minutes: null` means an unlimited (untimed) game.
//
// Supports two common extra time controls:
//   - increment (Fischer): after a player completes a move, that many seconds
//     are added to their clock.
//   - delay (simple/US delay): at the start of each turn a countdown runs
//     before the main clock begins ticking; time used within the delay is not
//     deducted from the main clock.

export class ChessClock {
  constructor({ minutes, increment = 0, delay = 0, onTick = () => {}, onFlag = () => {} }) {
    this.unlimited = minutes == null;
    const ms = this.unlimited ? 0 : minutes * 60 * 1000;
    this.remaining = [ms, ms]; // [white, black] milliseconds
    this.incrementMs = increment * 1000;
    this.delayMs = delay * 1000;
    this.active = null; // 0 = white, 1 = black
    this.onTick = onTick;
    this.onFlag = onFlag;
    this._interval = null;
    this._lastStamp = 0;
    this._delayLeft = 0; // remaining simple-delay budget for the current turn
  }

  /** Start (or restart) the active side's clock, resetting the per-turn delay. */
  start(side) {
    this.active = side;
    if (this.unlimited) return;
    this.stop();
    this._delayLeft = this.delayMs;
    this._lastStamp = Date.now();
    this._interval = setInterval(() => this._tick(), 100);
  }

  _tick() {
    const now = Date.now();
    let dt = now - this._lastStamp;
    this._lastStamp = now;

    // Consume the simple-delay budget before touching the main clock.
    if (this._delayLeft > 0) {
      const used = Math.min(this._delayLeft, dt);
      this._delayLeft -= used;
      dt -= used;
    }
    if (dt > 0) this.remaining[this.active] -= dt;

    if (this.remaining[this.active] <= 0) {
      this.remaining[this.active] = 0;
      this.stop();
      this.onTick(this.remaining);
      this.onFlag(this.active);
      return;
    }
    this.onTick(this.remaining);
  }

  /**
   * Switch the running clock to `side` after a move.
   * @param {number} side the new side to move
   * @param {boolean} applyIncrement add the increment to the player who moved
   *        (true for real moves, false when reverting via undo)
   */
  switch(side, applyIncrement = true) {
    if (!this.unlimited && applyIncrement && this.active != null && this.active !== side) {
      this.remaining[this.active] += this.incrementMs;
    }
    if (this.unlimited) {
      this.active = side;
      return;
    }
    this.start(side);
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
}
