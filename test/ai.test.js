import { describe, it, expect } from 'vitest';
import { parseFen, START_FEN } from '../src/engine/fen.js';
import { evaluate } from '../src/ai/evaluation.js';
import { orderMoves } from '../src/ai/ordering.js';
import { generateLegalMoves } from '../src/engine/movegen.js';
import { FLAGS } from '../src/engine/moves.js';
import { searchBestMove } from '../src/ai/search.js';
import { algebraic } from '../src/engine/board.js';
import { Game } from '../src/engine/game.js';
import { ChessAI } from '../src/ai/ai.js';

describe('evaluation', () => {
  it('is near zero and symmetric at the start', () => {
    expect(Math.abs(evaluate(parseFen(START_FEN)))).toBeLessThan(40);
  });
  it('favors the side up a queen', () => {
    const b = parseFen('4k3/8/8/8/8/8/8/3QK3 w - - 0 1');
    expect(evaluate(b)).toBeGreaterThan(700);
  });
  it('flips sign with side to move', () => {
    expect(evaluate(parseFen('4k3/8/8/8/8/8/8/3QK3 w - - 0 1'))).toBeGreaterThan(0);
    expect(evaluate(parseFen('4k3/8/8/8/8/8/8/3QK3 b - - 0 1'))).toBeLessThan(0);
  });
});

describe('move ordering', () => {
  it('orders captures before quiet moves', () => {
    const b = parseFen('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    const ordered = orderMoves(b, generateLegalMoves(b), 0, null);
    const firstCapture = ordered.findIndex((m) => m.flags & FLAGS.CAPTURE);
    const firstQuiet = ordered.findIndex((m) => !(m.flags & FLAGS.CAPTURE));
    expect(firstCapture).toBeLessThan(firstQuiet);
  });
});

describe('search', () => {
  it('finds mate in one', () => {
    const b = parseFen('6k1/5ppp/8/8/8/8/8/R6K w - - 0 1'); // Ra8#
    const { move } = searchBestMove(b, { maxDepth: 3, timeMs: 2000 });
    expect(algebraic(move.from) + algebraic(move.to)).toBe('a1a8');
  });
  it('wins a hanging queen', () => {
    // White rook on e1 can capture the black queen on e5 for free.
    const b = parseFen('4k3/8/8/4q3/8/8/8/4R1K1 w - - 0 1');
    const { move } = searchBestMove(b, { maxDepth: 3, timeMs: 2000 });
    expect(algebraic(move.to)).toBe('e5');
  });
});

describe('ChessAI facade', () => {
  it('returns a legal move at every difficulty', () => {
    for (const level of ['easy', 'medium', 'hard', 'expert']) {
      const g = new Game();
      const move = new ChessAI(level).chooseMove(g.board);
      const legal = g.legalMoves().some((m) => m.from === move.from && m.to === move.to);
      expect(legal).toBe(true);
    }
  });
});
