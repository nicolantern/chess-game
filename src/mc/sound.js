// Procedural block sounds via the Web Audio API — no audio files. Each block
// type gets a short noise burst through a filter (plus a sine "knock" for woody/
// earthy blocks) so stone clicks, wood knocks, sand hisses, and dirt thuds.
// initAudio() must run from a user gesture (the pointer-lock click does this).

import { B } from './blocks.js';

let ctx = null;

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function noise(freq, q, dur, gain, type) {
  if (!ctx) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = freq;
  filt.Q.value = q;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur);
}

function knock(freq, dur, gain) {
  if (!ctx || !freq) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function params(type) {
  switch (type) {
    case B.STONE:
    case B.COBBLE: return { freq: 1500, q: 1.2, dur: 0.09, filt: 'highpass', gain: 0.34, tone: 0 };
    case B.WOOD:
    case B.PLANK: return { freq: 650, q: 1, dur: 0.12, filt: 'bandpass', gain: 0.32, tone: 190 };
    case B.SAND: return { freq: 1000, q: 0.7, dur: 0.11, filt: 'highpass', gain: 0.22, tone: 0 };
    case B.GRASS:
    case B.LEAVES: return { freq: 2600, q: 0.5, dur: 0.10, filt: 'highpass', gain: 0.18, tone: 0 };
    case B.DIRT:
    default: return { freq: 420, q: 0.9, dur: 0.12, filt: 'lowpass', gain: 0.3, tone: 130 };
  }
}

/** Dig sound. `strong` = full volume (block broke) vs a quieter mining tick. */
export function sfxDig(type, strong) {
  const p = params(type);
  const g = p.gain * (strong ? 1 : 0.5);
  noise(p.freq, p.q, p.dur, g, p.filt);
  if (p.tone) knock(p.tone, p.dur * (strong ? 1 : 0.7), g * 0.5);
}

/** Placing thunk — a touch lower and duller than the dig. */
export function sfxPlace(type) {
  const p = params(type);
  noise(p.freq * 0.8, 1, 0.09, 0.28, p.filt);
  knock(p.tone || 150, 0.09, 0.18);
}

// Pitched sine sweep (for blips/twangs).
function sweep(f0, f1, dur, gain, type = 'square') {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

/** Mob / combat sounds, keyed by a short name. */
export function sfxMob(kind) {
  switch (kind) {
    case 'hit': noise(500, 1, 0.08, 0.3, 'bandpass'); knock(160, 0.08, 0.18); break; // melee thwack
    case 'die': sweep(300, 90, 0.35, 0.28, 'sawtooth'); noise(400, 0.6, 0.2, 0.15, 'lowpass'); break;
    case 'orb': sweep(700, 1300, 0.12, 0.14, 'sine'); break;
    case 'bow': sweep(900, 500, 0.14, 0.16, 'triangle'); break;
    case 'hiss': noise(2200, 0.4, 0.5, 0.22, 'highpass'); break; // creeper
    case 'boom': sweep(200, 40, 0.5, 0.35, 'sawtooth'); noise(300, 0.5, 0.4, 0.28, 'lowpass'); break;
    case 'hurt': noise(300, 0.8, 0.14, 0.3, 'lowpass'); knock(120, 0.14, 0.2); break; // player took damage
    case 'eat': noise(600, 0.6, 0.07, 0.2, 'lowpass'); knock(220, 0.06, 0.12); break; // chewing bite
    default: break;
  }
}
