import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/game.js';
import { generateLegalMoves } from '../src/engine/movegen.js';
import { createInitialBoard } from '../src/engine/board.js';

describe('engine', () => {
  it('starts with a standard opening board', () => {
    const game = new Game();
    expect(game.board).toEqual(createInitialBoard());
  });

  it('generates legal moves for white from initial position', () => {
    const game = new Game();
    const moves = generateLegalMoves(game.board, 'w');
    expect(moves.length).toBeGreaterThan(0);
  });

  it('can make and undo a move', () => {
    const game = new Game();
    const move = { from: 'e2', to: 'e4' };
    const before = game.history.length;
    game.makeMove(move);
    expect(game.history.length).toBe(before + 1);
    game.undoMove();
    expect(game.history.length).toBe(before);
  });
});
