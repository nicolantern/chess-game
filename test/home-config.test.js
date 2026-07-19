// test/home-config.test.js
import { describe, it, expect } from 'vitest';
import { buildAiConfig, buildPvpConfig, TIME_PRESETS } from '../src/ui/timeControls.js';
import { WHITE, BLACK } from '../src/engine/pieces.js';

describe('game config builders', () => {
  it('AI config with an explicit color flips the AI to the other side', () => {
    const cfg = buildAiConfig({ aiLevel: 'hard', aiColorChoice: 'black', time: { minutes: 5, increment: 0, delay: 0 } });
    expect(cfg).toEqual({
      mode: 'ai',
      aiLevel: 'hard',
      aiColor: WHITE,
      humanColor: BLACK,
      time: { minutes: 5, increment: 0, delay: 0 },
    });
  });

  it('AI config resolves random via the injected rng', () => {
    expect(buildAiConfig({ aiLevel: 'easy', aiColorChoice: 'random', time: {} }, () => 0.1).humanColor).toBe(WHITE);
    expect(buildAiConfig({ aiLevel: 'easy', aiColorChoice: 'random', time: {} }, () => 0.9).humanColor).toBe(BLACK);
  });

  it('PvP config always starts the human as White', () => {
    expect(buildPvpConfig({ minutes: 3 })).toEqual({ mode: 'pvp', humanColor: WHITE, time: { minutes: 3 } });
  });

  it('exposes the time presets', () => {
    expect(TIME_PRESETS[0][0]).toBe('Bullet');
  });
});
