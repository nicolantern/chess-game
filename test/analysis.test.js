import { describe, it, expect } from 'vitest';
import { analyzeGame } from '../src/ai/analysis.js';
import { DEFAULT_PROFILE, recordGame, computeAchievements } from '../src/utils/profile.js';
import { squareFromAlgebraic } from '../src/engine/board.js';
import { QUEEN, ROOK, BISHOP, KNIGHT, PAWN } from '../src/engine/pieces.js';

const mv = (from, to, promotion = 0) => ({
  from: squareFromAlgebraic(from),
  to: squareFromAlgebraic(to),
  promotion,
});

describe('analyzeGame', () => {
  it('returns per-move classifications and per-side accuracy', async () => {
    const moves = [mv('e2', 'e4'), mv('e7', 'e5'), mv('g1', 'f3'), mv('b8', 'c6')];
    const { perMove, summary } = await analyzeGame(moves, { maxDepth: 4, timeMs: 30 });
    expect(perMove.length).toBe(4);
    for (const m of perMove) {
      expect(m.cpLoss).toBeGreaterThanOrEqual(0);
      expect(typeof m.class).toBe('string');
    }
    expect(summary[0].accuracy).toBeGreaterThanOrEqual(0);
    expect(summary[0].accuracy).toBeLessThanOrEqual(100);
  }, 20000);
});

describe('Elo and achievements', () => {
  it('raises rating on a win and unlocks Giant Slayer vs Hard', () => {
    const p = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
    recordGame(p, {
      mode: 'ai', outcome: 'win', aiLevel: 'hard', flawless: false, mate: false,
      moveCount: 30, durationMs: 1000, endedAt: 1,
    });
    expect(p.stats.rating).toBeGreaterThan(800);
    const ach = computeAchievements(p.stats);
    expect(ach.find((a) => a.key === 'beatHard').done).toBe(true);
  });

  it('unlocks Full Set after mating with all five piece types', () => {
    const p = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
    for (const piece of [QUEEN, ROOK, BISHOP, KNIGHT, PAWN]) {
      recordGame(p, {
        mode: 'ai', outcome: 'win', aiLevel: 'easy', mate: true, matingPiece: piece,
        moveCount: 25, durationMs: 1000, endedAt: 1,
      });
    }
    expect(computeAchievements(p.stats).find((a) => a.key === 'everyPiece').done).toBe(true);
    // Five wins recorded.
    expect(p.stats.wins).toBe(5);
  });
});
