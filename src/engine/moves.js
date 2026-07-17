// Move representation and reversible make/unmake.
//
// A move is a plain object: { from, to, promotion, flags }. `makeMove` mutates
// the board and stashes everything needed to reverse it on `move._undo`, so
// `unmakeMove` restores the exact prior position. This reversibility is the
// backbone of AI search, undo, and repetition detection.

import { rankOf, square } from './board.js';
import { makePiece, pieceType, PAWN, ROOK, KING, WHITE, BLACK, EMPTY } from './pieces.js';

// Move flags (bitfield). A move can combine flags, e.g. an en-passant capture
// is EN_PASSANT | CAPTURE; a promotion capture is PROMOTION | CAPTURE.
export const FLAGS = {
  QUIET: 1,
  CAPTURE: 2,
  DOUBLE_PUSH: 4,
  EN_PASSANT: 8,
  KING_CASTLE: 16,
  QUEEN_CASTLE: 32,
  PROMOTION: 64,
};

/** Remove a castling-right character (e.g. 'K') from the board's rights string. */
function revoke(board, ch) {
  if (board.castling.includes(ch)) {
    board.castling = board.castling.replace(ch, '') || '-';
  }
}

/** Rook home squares whose occupancy/move affects castling rights. */
const CASTLE_ROOK_SQUARES = [
  [square(0, 0), 'Q'],
  [square(7, 0), 'K'],
  [square(0, 7), 'q'],
  [square(7, 7), 'k'],
];

function revokeForRookSquare(board, sq) {
  for (const [rookSq, right] of CASTLE_ROOK_SQUARES) {
    if (sq === rookSq) revoke(board, right);
  }
}

/** Apply `move` to `board`, recording undo data on `move._undo`. */
export function makeMove(board, move) {
  const sqs = board.squares;
  const us = board.sideToMove;
  const them = us ^ 1;
  const piece = sqs[move.from];
  const type = pieceType(piece);

  move._undo = {
    castling: board.castling,
    epSquare: board.epSquare,
    halfmoveClock: board.halfmoveClock,
    fullmoveNumber: board.fullmoveNumber,
    captured: EMPTY,
    capturedSquare: -1,
    whiteKing: board.kings[WHITE],
    blackKing: board.kings[BLACK],
  };

  board.epSquare = -1;

  // Resolve capture (en passant removes a pawn behind the destination).
  if (move.flags & FLAGS.EN_PASSANT) {
    const capSq = move.to + (us === WHITE ? -16 : 16);
    move._undo.captured = sqs[capSq];
    move._undo.capturedSquare = capSq;
    sqs[capSq] = EMPTY;
  } else if (sqs[move.to]) {
    move._undo.captured = sqs[move.to];
    move._undo.capturedSquare = move.to;
  }

  // Move the piece (promotion replaces it with the chosen type).
  sqs[move.to] = (move.flags & FLAGS.PROMOTION) ? makePiece(us, move.promotion) : piece;
  sqs[move.from] = EMPTY;

  // Castling also relocates the rook.
  if (move.flags & FLAGS.KING_CASTLE) {
    const rank = rankOf(move.from);
    sqs[square(5, rank)] = sqs[square(7, rank)];
    sqs[square(7, rank)] = EMPTY;
  } else if (move.flags & FLAGS.QUEEN_CASTLE) {
    const rank = rankOf(move.from);
    sqs[square(3, rank)] = sqs[square(0, rank)];
    sqs[square(0, rank)] = EMPTY;
  }

  // King move updates the cache and forfeits both castling rights.
  if (type === KING) {
    board.kings[us] = move.to;
    revoke(board, us === WHITE ? 'K' : 'k');
    revoke(board, us === WHITE ? 'Q' : 'q');
  }

  // Moving or capturing a rook off its home square forfeits that right.
  if (type === ROOK) revokeForRookSquare(board, move.from);
  if (move._undo.captured && pieceType(move._undo.captured) === ROOK) {
    revokeForRookSquare(board, move._undo.capturedSquare);
  }

  // A double pawn push exposes an en-passant target square.
  if (move.flags & FLAGS.DOUBLE_PUSH) {
    board.epSquare = move.from + (us === WHITE ? 16 : -16);
  }

  // Fifty-move clock resets on a pawn move or any capture.
  if (type === PAWN || move._undo.captured) board.halfmoveClock = 0;
  else board.halfmoveClock += 1;

  if (us === BLACK) board.fullmoveNumber += 1;
  board.sideToMove = them;
}

/** Reverse the last `makeMove` using data stored on `move._undo`. */
export function unmakeMove(board, move) {
  const sqs = board.squares;
  const u = move._undo;
  const us = board.sideToMove ^ 1; // the side that made the move

  board.sideToMove = us;
  board.castling = u.castling;
  board.epSquare = u.epSquare;
  board.halfmoveClock = u.halfmoveClock;
  board.fullmoveNumber = u.fullmoveNumber;
  board.kings[WHITE] = u.whiteKing;
  board.kings[BLACK] = u.blackKing;

  // Restore the moved piece to its origin (undo promotion by restoring a pawn).
  const restored = (move.flags & FLAGS.PROMOTION) ? makePiece(us, PAWN) : sqs[move.to];
  sqs[move.from] = restored;
  sqs[move.to] = EMPTY;

  // Undo the rook relocation for castling.
  if (move.flags & FLAGS.KING_CASTLE) {
    const rank = rankOf(move.from);
    sqs[square(7, rank)] = sqs[square(5, rank)];
    sqs[square(5, rank)] = EMPTY;
  } else if (move.flags & FLAGS.QUEEN_CASTLE) {
    const rank = rankOf(move.from);
    sqs[square(0, rank)] = sqs[square(3, rank)];
    sqs[square(3, rank)] = EMPTY;
  }

  // Put back any captured piece (its square differs from `to` for en passant).
  if (u.captured) sqs[u.capturedSquare] = u.captured;
}
