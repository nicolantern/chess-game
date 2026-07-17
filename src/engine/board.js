// 0x88 board geometry.
//
// Squares are indexed as `rank * 16 + file` (file 0 = a-file, rank 0 = rank 1).
// The board occupies the low nibble of each rank; the high nibble is "off board".
// The magic of 0x88 is that a square is on the real board iff `(sq & 0x88) === 0`,
// which makes edge-wrap bugs impossible: any knight/king/slider step that would
// wrap to the far side of the board lands on an off-board index instead.

import { EMPTY } from './pieces.js';

/** File (0..7) of a square. */
export const fileOf = (sq) => sq & 7;

/** Rank (0..7, where 0 = rank 1) of a square. */
export const rankOf = (sq) => sq >> 4;

/** True when `sq` is a real board square. */
export const onBoard = (sq) => (sq & 0x88) === 0;

/** Build a square index from file and rank. */
export const square = (file, rank) => rank * 16 + file;

/** Convert a square to algebraic notation, e.g. 0 -> "a1". */
export function algebraic(sq) {
  return 'abcdefgh'[fileOf(sq)] + (rankOf(sq) + 1);
}

/** Parse an algebraic square, e.g. "e4" -> square index. */
export function squareFromAlgebraic(s) {
  const file = s.charCodeAt(0) - 97; // 'a'
  const rank = s.charCodeAt(1) - 49; // '1'
  return square(file, rank);
}

// Movement deltas expressed in 0x88 space.
export const KNIGHT_DELTAS = [33, 31, 18, 14, -33, -31, -18, -14];
export const KING_DELTAS = [16, -16, 1, -1, 17, 15, -15, -17];
export const BISHOP_DELTAS = [17, 15, -15, -17];
export const ROOK_DELTAS = [16, -16, 1, -1];
export const QUEEN_DELTAS = [16, -16, 1, -1, 17, 15, -15, -17];

/** A fresh 128-length board (0x88), every square EMPTY. */
export function emptyBoard() {
  return new Int8Array(128).fill(EMPTY);
}

/**
 * Mutable position: piece placement plus all state that FEN encodes.
 *
 * `squares` is an Int8Array[128] of encoded pieces (see pieces.js). `kings`
 * caches each side's king square so check tests are O(1) to locate.
 */
export class Board {
  constructor() {
    this.squares = emptyBoard();
    this.sideToMove = 0; // WHITE
    this.castling = '-'; // subset of 'KQkq', or '-'
    this.epSquare = -1; // en-passant target square, or -1
    this.halfmoveClock = 0; // for the fifty-move rule
    this.fullmoveNumber = 1;
    this.kings = [-1, -1]; // [whiteKingSq, blackKingSq]
  }

  get(sq) {
    return this.squares[sq];
  }

  set(sq, piece) {
    this.squares[sq] = piece;
  }

  /** Deep copy — used by the AI to search on a throwaway position. */
  clone() {
    const b = new Board();
    b.squares = this.squares.slice();
    b.sideToMove = this.sideToMove;
    b.castling = this.castling;
    b.epSquare = this.epSquare;
    b.halfmoveClock = this.halfmoveClock;
    b.fullmoveNumber = this.fullmoveNumber;
    b.kings = [...this.kings];
    return b;
  }
}
