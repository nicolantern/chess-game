// Standard Algebraic Notation (SAN) generation, e.g. "e4", "Nf3", "exd5",
// "O-O", "e8=Q+", "Raxd1", "Qh4#". SAN must be computed against the position
// BEFORE the move is played (disambiguation depends on the other legal moves),
// and the check/mate suffix against the position AFTER.

import { algebraic, fileOf, rankOf } from './board.js';
import { pieceType, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from './pieces.js';
import { FLAGS, makeMove, unmakeMove } from './moves.js';
import { generateLegalMoves } from './movegen.js';
import { inCheck } from './attacks.js';

const PIECE_SAN = {
  [KNIGHT]: 'N',
  [BISHOP]: 'B',
  [ROOK]: 'R',
  [QUEEN]: 'Q',
  [KING]: 'K',
};

/** Produce the SAN string for `move` in the current position. */
export function toSan(board, move) {
  if (move.flags & FLAGS.KING_CASTLE) return addSuffix(board, move, 'O-O');
  if (move.flags & FLAGS.QUEEN_CASTLE) return addSuffix(board, move, 'O-O-O');

  const piece = board.squares[move.from];
  const type = pieceType(piece);
  const isCapture = (move.flags & FLAGS.CAPTURE) !== 0;
  let san = '';

  if (type === PAWN) {
    if (isCapture) san += 'abcdefgh'[fileOf(move.from)] + 'x';
    san += algebraic(move.to);
    if (move.flags & FLAGS.PROMOTION) san += '=' + PIECE_SAN[move.promotion];
  } else {
    san += PIECE_SAN[type];
    san += disambiguate(board, move, type);
    if (isCapture) san += 'x';
    san += algebraic(move.to);
  }

  return addSuffix(board, move, san);
}

/**
 * File/rank disambiguation when another same-type piece could also reach `to`.
 * Prefer file; fall back to rank; use both if neither alone is unique.
 */
function disambiguate(board, move, type) {
  const rivals = generateLegalMoves(board).filter(
    (m) => m.to === move.to && m.from !== move.from && pieceType(board.squares[m.from]) === type,
  );
  if (rivals.length === 0) return '';

  const sameFile = rivals.some((m) => fileOf(m.from) === fileOf(move.from));
  const sameRank = rivals.some((m) => rankOf(m.from) === rankOf(move.from));
  if (!sameFile) return 'abcdefgh'[fileOf(move.from)];
  if (!sameRank) return String(rankOf(move.from) + 1);
  return algebraic(move.from);
}

/** Append '+' for check or '#' for checkmate by probing the resulting position. */
function addSuffix(board, move, san) {
  makeMove(board, move);
  const opponent = board.sideToMove;
  let suffix = '';
  if (inCheck(board, opponent)) {
    suffix = generateLegalMoves(board).length === 0 ? '#' : '+';
  }
  unmakeMove(board, move);
  return san + suffix;
}
