// FEN (Forsyth–Edwards Notation) parsing and serialization.
//
// FEN is the interchange format for a full position. Keeping a clean round-trip
// (parseFen -> toFen -> identical string) is both a correctness check and the
// seam that later features (online play, puzzles, analysis) plug into.

import { Board, square, algebraic, squareFromAlgebraic } from './board.js';
import {
  makePiece, pieceColor, pieceType, WHITE, BLACK, KING,
  PIECE_LETTERS, LETTER_TO_TYPE,
} from './pieces.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Parse a FEN string into a fresh Board. */
export function parseFen(fen) {
  const board = new Board();
  const [placement, side, castling, ep, half, full] = fen.trim().split(/\s+/);

  let rank = 7;
  let file = 0;
  for (const ch of placement) {
    if (ch === '/') {
      rank -= 1;
      file = 0;
    } else if (ch >= '1' && ch <= '8') {
      file += Number(ch);
    } else {
      const color = ch === ch.toUpperCase() ? WHITE : BLACK;
      const type = LETTER_TO_TYPE[ch.toLowerCase()];
      const sq = square(file, rank);
      board.set(sq, makePiece(color, type));
      if (type === KING) board.kings[color] = sq;
      file += 1;
    }
  }

  board.sideToMove = side === 'w' ? WHITE : BLACK;
  board.castling = castling || '-';
  board.epSquare = !ep || ep === '-' ? -1 : squareFromAlgebraic(ep);
  board.halfmoveClock = half === undefined ? 0 : Number(half);
  board.fullmoveNumber = full === undefined ? 1 : Number(full);
  return board;
}

/** Serialize a Board back to a FEN string. */
export function toFen(board) {
  let placement = '';
  for (let rank = 7; rank >= 0; rank -= 1) {
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const piece = board.get(square(file, rank));
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        placement += empty;
        empty = 0;
      }
      const letter = PIECE_LETTERS[pieceType(piece)];
      placement += pieceColor(piece) === WHITE ? letter.toUpperCase() : letter;
    }
    if (empty) placement += empty;
    if (rank > 0) placement += '/';
  }

  const side = board.sideToMove === WHITE ? 'w' : 'b';
  const ep = board.epSquare === -1 ? '-' : algebraic(board.epSquare);
  return `${placement} ${side} ${board.castling} ${ep} ${board.halfmoveClock} ${board.fullmoveNumber}`;
}
