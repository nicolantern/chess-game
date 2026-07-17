// Attack detection: "is this square attacked by that color?" and "is a king in
// check?". This is the primitive on which legal move filtering, castling
// legality, and check/checkmate detection are all built.

import { onBoard, KNIGHT_DELTAS, KING_DELTAS, BISHOP_DELTAS, ROOK_DELTAS } from './board.js';
import {
  pieceColor, pieceType, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE,
} from './pieces.js';

/**
 * Is square `sq` attacked by any piece of color `by`?
 *
 * We look outward FROM the target square: pawn/knight/king by fixed offsets,
 * bishop/rook/queen by ray casting until we hit a blocker.
 */
export function isSquareAttacked(board, sq, by) {
  const sqs = board.squares;

  // Pawns. A `by`-colored pawn attacks diagonally in its forward direction, so
  // the attacker sits one step "back" along that diagonal from the target.
  const forward = by === WHITE ? 16 : -16;
  for (const d of [forward - 1, forward + 1]) {
    const from = sq - d;
    if (onBoard(from)) {
      const p = sqs[from];
      if (p && pieceColor(p) === by && pieceType(p) === PAWN) return true;
    }
  }

  // Knights.
  for (const d of KNIGHT_DELTAS) {
    const from = sq + d;
    if (onBoard(from)) {
      const p = sqs[from];
      if (p && pieceColor(p) === by && pieceType(p) === KNIGHT) return true;
    }
  }

  // Adjacent king.
  for (const d of KING_DELTAS) {
    const from = sq + d;
    if (onBoard(from)) {
      const p = sqs[from];
      if (p && pieceColor(p) === by && pieceType(p) === KING) return true;
    }
  }

  // Bishops / queens along diagonals.
  for (const d of BISHOP_DELTAS) {
    let t = sq + d;
    while (onBoard(t)) {
      const p = sqs[t];
      if (p) {
        if (pieceColor(p) === by && (pieceType(p) === BISHOP || pieceType(p) === QUEEN)) return true;
        break;
      }
      t += d;
    }
  }

  // Rooks / queens along ranks and files.
  for (const d of ROOK_DELTAS) {
    let t = sq + d;
    while (onBoard(t)) {
      const p = sqs[t];
      if (p) {
        if (pieceColor(p) === by && (pieceType(p) === ROOK || pieceType(p) === QUEEN)) return true;
        break;
      }
      t += d;
    }
  }

  return false;
}

/** Is `color`'s king currently in check? */
export function inCheck(board, color) {
  return isSquareAttacked(board, board.kings[color], color ^ 1);
}
