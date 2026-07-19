// Shared time-control presets and pure game-config builders. Extracted from the
// old Menu so both HomeScreen and OnlineScreen can use them and the config logic
// is unit-testable (no DOM).

import { WHITE, BLACK } from '../engine/pieces.js';

// Preset time controls grouped by category. Each item is [label, minutes, increment].
export const TIME_PRESETS = [
  ['Bullet', [['1+0', 1, 0], ['2+1', 2, 1]]],
  ['Blitz', [['3+0', 3, 0], ['3+2', 3, 2], ['5+0', 5, 0], ['5+3', 5, 3]]],
  ['Rapid', [['10+0', 10, 0], ['10+5', 10, 5], ['15+10', 15, 10]]],
  ['Classical', [['30+0', 30, 0], ['30+20', 30, 20]]],
];

/**
 * Build the start config for a game vs the AI.
 * @param {{aiLevel:string, aiColorChoice:'white'|'black'|'random', time:object}} sel
 * @param {() => number} rng  injectable for deterministic tests
 */
export function buildAiConfig({ aiLevel, aiColorChoice, time }, rng = Math.random) {
  let human = aiColorChoice;
  if (human === 'random') human = rng() < 0.5 ? 'white' : 'black';
  const humanColor = human === 'white' ? WHITE : BLACK;
  return { mode: 'ai', aiLevel, aiColor: humanColor ^ 1, humanColor, time };
}

/** Build the start config for local two-player (human is White). */
export function buildPvpConfig(time) {
  return { mode: 'pvp', humanColor: WHITE, time };
}
