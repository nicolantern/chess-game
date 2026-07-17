// Sound effects via the Web Audio API. Each event is a short synthesized tone,
// so there are zero audio files to ship or download. The AudioContext is created
// lazily on first use (browsers require a user gesture), and every method is a
// safe no-op when sound is disabled or Web Audio is unavailable (e.g. in tests).

const PATCHES = {
  move: { freq: 320, dur: 0.06, type: 'sine', gain: 0.18 },
  capture: { freq: 180, dur: 0.1, type: 'square', gain: 0.2 },
  castle: { freq: 260, dur: 0.1, type: 'triangle', gain: 0.18 },
  check: { freq: 660, dur: 0.14, type: 'sawtooth', gain: 0.16 },
  promote: { freq: 880, dur: 0.16, type: 'triangle', gain: 0.18 },
  'game-end': { freq: 200, dur: 0.3, type: 'sine', gain: 0.22 },
  illegal: { freq: 120, dur: 0.08, type: 'square', gain: 0.14 },
};

export class SoundManager {
  constructor({ enabled = true } = {}) {
    this.enabled = enabled;
    this.ctx = null;
  }

  setEnabled(value) {
    this.enabled = value;
  }

  _ensureContext() {
    if (this.ctx) return this.ctx;
    const AudioCtx =
      typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtx) return null;
    this.ctx = new AudioCtx();
    return this.ctx;
  }

  /** Play a named effect (see PATCHES). No-op if disabled/unavailable. */
  play(name) {
    if (!this.enabled) return;
    const ctx = this._ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const patch = PATCHES[name] || PATCHES.move;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = patch.type;
    osc.frequency.value = patch.freq;
    gain.gain.setValueAtTime(patch.gain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + patch.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + patch.dur);
  }
}
