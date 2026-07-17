import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { squareFromAlgebraic } from '../src/engine/board.js';

const sq = squareFromAlgebraic;
const play = (game, from, to, promo = 0) => game.moveByCoords(sq(from), sq(to), promo);

describe('Game status', () => {
  it("detects Fool's Mate checkmate", () => {
    const g = new Game();
    play(g, 'f2', 'f3');
    play(g, 'e7', 'e5');
    play(g, 'g2', 'g4');
    play(g, 'd8', 'h4');
    expect(g.status).toBe('checkmate');
    expect(g.winner).toBe(1); // black
    expect(g.isOver).toBe(true);
  });

  it('detects stalemate', () => {
    const g = Game.fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(g.status).toBe('stalemate');
    expect(g.winner).toBe(null);
  });

  it('flags check without ending the game', () => {
    // White king e1 is checked by the rook on e8 but has escape squares.
    const g = Game.fromFen('4r2k/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(g.check).toBe(true);
    expect(g.status).toBe('check');
    expect(g.isOver).toBe(false);
  });

  it('reports threefold repetition as claimable', () => {
    const g = new Game();
    const shuffle = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
    for (let i = 0; i < 3; i += 1) {
      for (const [f, t] of shuffle) play(g, f, t);
    }
    expect(g.canClaimDraw).toBe(true);
  });

  it('handles promotion by choice', () => {
    const g = Game.fromFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const knight = 2;
    play(g, 'a7', 'a8', knight);
    expect(g.fen().startsWith('N3k3')).toBe(true);
  });

  it('undo restores the exact previous position', () => {
    const g = new Game();
    play(g, 'e2', 'e4');
    const fen = g.fen();
    play(g, 'e7', 'e5');
    g.undo();
    expect(g.fen()).toBe(fen);
  });

  it('undo of a capture restores the captured piece', () => {
    const g = Game.fromFen('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    const before = g.fen();
    play(g, 'e4', 'd5');
    g.undo();
    expect(g.fen()).toBe(before);
  });
});
