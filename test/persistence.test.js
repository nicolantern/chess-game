import { describe, it, expect } from 'vitest';
import { toPgn } from '../src/utils/pgn.js';
import { DEFAULT_PROFILE, recordGame } from '../src/utils/profile.js';
import { MatchController } from '../src/ui/MatchController.js';
import { squareFromAlgebraic } from '../src/engine/board.js';

const sq = squareFromAlgebraic;

describe('PGN export', () => {
  it('emits tags, numbered movetext, and a result token', () => {
    const pgn = toPgn({
      sans: ['e4', 'e5', 'Nf3'],
      result: 'checkmate',
      winner: 0,
      date: '2026.07.17',
    });
    expect(pgn).toContain('[Result "1-0"]');
    expect(pgn).toContain('1. e4 e5 2. Nf3');
    expect(pgn.trimEnd().endsWith('1-0')).toBe(true);
  });
});

describe('profile stats', () => {
  it('records a win vs Hard and flips the beatHard flag', () => {
    const p = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
    recordGame(p, {
      mode: 'ai', outcome: 'win', aiLevel: 'hard', flawless: true, mate: true,
      moveCount: 18, durationMs: 60000, endedAt: 1,
    });
    expect(p.stats.total).toBe(1);
    expect(p.stats.wins).toBe(1);
    expect(p.stats.flawlessWins).toBe(1);
    expect(p.stats.beatHard).toBe(true);
    expect(p.stats.fastestMateMoves).toBe(18);
    expect(p.stats.byLevel.hard.w).toBe(1);
  });
});

describe('MatchController serialize/deserialize', () => {
  it('round-trips a game to the same position', () => {
    const mc = new MatchController({ mode: 'pvp', time: { minutes: null } });
    mc.tryMove(sq('e2'), sq('e4'));
    mc.tryMove(sq('e7'), sq('e5'));
    mc.tryMove(sq('g1'), sq('f3'));
    const fen = mc.game.fen();
    const data = mc.serialize();

    const restored = MatchController.deserialize(data);
    expect(restored.game.fen()).toBe(fen);
    expect(restored.game.history.length).toBe(3);
    expect(data.sans).toEqual(['e4', 'e5', 'Nf3']);
  });
});
