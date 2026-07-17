// Draw rules that depend on material only. Repetition and the fifty-move rule
// live in game.js because they need move history / the halfmove clock.

import { onBoard, fileOf, rankOf } from './board.js';
import { pieceColor, pieceType, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, WHITE, BLACK } from './pieces.js';

/**
 * Insufficient mating material. True for:
 *   - King vs King
 *   - King + single minor (knight or bishop) vs King
 *   - King + Bishop vs King + Bishop with both bishops on same-colored squares
 * Any pawn, rook, or queen means mate is possible, so it is not a draw.
 */
export function isInsufficientMaterial(board) {
  const minors = { [WHITE]: 0, [BLACK]: 0 };
  const bishopSquareColors = [];
  let count = 0;

  for (let sq = 0; sq < 128; sq += 1) {
    if (!onBoard(sq)) {
      sq += 7;
      continue;
    }
    const piece = board.squares[sq];
    if (!piece) continue;
    const type = pieceType(piece);
    if (type === PAWN || type === ROOK || type === QUEEN) return false;
    if (type === KNIGHT || type === BISHOP) {
      minors[pieceColor(piece)] += 1;
      count += 1;
      if (type === BISHOP) bishopSquareColors.push((fileOf(sq) + rankOf(sq)) & 1);
    }
  }

  if (count === 0) return true; // K vs K
  if (count === 1) return true; // K + minor vs K
  if (
    count === 2 &&
    minors[WHITE] === 1 &&
    minors[BLACK] === 1 &&
    bishopSquareColors.length === 2 &&
    bishopSquareColors[0] === bishopSquareColors[1]
  ) {
    return true; // opposite-side bishops on the same square color
  }
  return false;
}
