// Facade over the search. The UI talks only to this class, never to the search
// internals — which keeps the door open to move the search into a Web Worker
// later without touching any UI code.

import { searchBestMove } from './search.js';
import { DIFFICULTIES } from './difficulty.js';

export class ChessAI {
  constructor(level = 'medium') {
    this.setLevel(level);
  }

  setLevel(level) {
    this.level = level;
    this.config = DIFFICULTIES[level] || DIFFICULTIES.medium;
  }

  /** Synchronous best-move selection on a throwaway copy of the board. */
  chooseMove(board) {
    const { move } = searchBestMove(board.clone(), this.config);
    return move;
  }

  /**
   * Async wrapper: yields a frame before the (blocking) search so the UI can
   * paint a "thinking…" state first. This is the seam a Web Worker would slot
   * into.
   */
  async chooseMoveAsync(board) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return this.chooseMove(board);
  }
}
