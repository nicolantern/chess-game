// High-level game: wraps a Board with move history and derived status, and is
// the API the UI talks to. It never contains movement rules itself — those live
// in movegen/moves/rules — it only orchestrates them and tracks game outcome.

import { parseFen, toFen, START_FEN } from './fen.js';
import { generateLegalMoves } from './movegen.js';
import { makeMove, unmakeMove } from './moves.js';
import { toSan } from './notation.js';
import { inCheck } from './attacks.js';
import { isInsufficientMaterial } from './rules.js';

// Terminal statuses (the game is over) vs in-progress ones.
const TERMINAL = new Set([
  'checkmate',
  'stalemate',
  'draw-insufficient',
  'draw-fifty',
  'draw-repetition',
]);

export class Game {
  constructor() {
    this.reset(START_FEN);
  }

  static fromFen(fen) {
    const game = new Game();
    game.reset(fen);
    return game;
  }

  /** Reset to a position and recompute derived state. */
  reset(fen) {
    this.board = parseFen(fen);
    this.history = []; // [{ move, san, captured }]
    this.positionCounts = new Map(); // repetition key -> occurrences
    this._recordPosition();
    this._updateStatus();
  }

  fen() {
    return toFen(this.board);
  }

  get sideToMove() {
    return this.board.sideToMove;
  }

  legalMoves() {
    return generateLegalMoves(this.board);
  }

  legalMovesFrom(sq) {
    return this.legalMoves().filter((m) => m.from === sq);
  }

  /**
   * Attempt a move by squares (with an optional promotion type when a pawn
   * reaches the last rank). Returns the applied move, or null if illegal.
   */
  moveByCoords(from, to, promotion = 0) {
    const candidates = this.legalMoves().filter((m) => m.from === from && m.to === to);
    if (candidates.length === 0) return null;
    const move =
      candidates.length > 1
        ? candidates.find((m) => m.promotion === promotion) || candidates[0]
        : candidates[0];
    return this.applyMove(move);
  }

  /** Apply a fully-formed legal move object, updating history and status. */
  applyMove(move) {
    const san = toSan(this.board, move); // SAN must be built before the move
    makeMove(this.board, move);
    this.history.push({ move, san, captured: move._undo.captured });
    this._recordPosition();
    this._updateStatus();
    return move;
  }

  /** Take back the most recent move. */
  undo() {
    const last = this.history.pop();
    if (!last) return false;
    this._unrecordPosition();
    unmakeMove(this.board, last.move);
    this._updateStatus();
    return true;
  }

  get lastMove() {
    return this.history.length ? this.history[this.history.length - 1].move : null;
  }

  // Repetition is keyed on placement + side + castling + ep (clocks excluded).
  _positionKey() {
    return this.fen().split(' ').slice(0, 4).join(' ');
  }

  _recordPosition() {
    const key = this._positionKey();
    this.positionCounts.set(key, (this.positionCounts.get(key) || 0) + 1);
  }

  _unrecordPosition() {
    const key = this._positionKey();
    const next = (this.positionCounts.get(key) || 1) - 1;
    if (next <= 0) this.positionCounts.delete(key);
    else this.positionCounts.set(key, next);
  }

  /** Recompute check/checkmate/stalemate/draw status and the winner. */
  _updateStatus() {
    const moves = this.legalMoves();
    this.check = inCheck(this.board, this.sideToMove);

    if (moves.length === 0) {
      this.status = this.check ? 'checkmate' : 'stalemate';
      this.winner = this.check ? this.sideToMove ^ 1 : null;
      return;
    }
    if (isInsufficientMaterial(this.board)) {
      this.status = 'draw-insufficient';
      this.winner = null;
      return;
    }
    if (this.board.halfmoveClock >= 100) {
      this.status = 'draw-fifty';
      this.winner = null;
      return;
    }
    if ((this.positionCounts.get(this._positionKey()) || 0) >= 3) {
      this.status = 'draw-repetition';
      this.winner = null;
      return;
    }
    this.status = this.check ? 'check' : 'playing';
    this.winner = null;
  }

  /** A draw the side to move MAY claim (threefold / fifty-move) but isn't forced. */
  get canClaimDraw() {
    return (
      (this.positionCounts.get(this._positionKey()) || 0) >= 3 ||
      this.board.halfmoveClock >= 100
    );
  }

  get isOver() {
    return TERMINAL.has(this.status);
  }
}
