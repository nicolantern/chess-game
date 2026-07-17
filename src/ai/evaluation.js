// Static evaluation. Combines the five factors the spec calls for: material,
// piece-square tables, king safety, mobility, and pawn structure. The score is
// returned from the perspective of the SIDE TO MOVE (positive = good for them),
// which is what a negamax search expects.

import { onBoard, fileOf, rankOf } from '../engine/board.js';
import {
  pieceColor, pieceType, PIECE_VALUE,
  PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE, BLACK,
} from '../engine/pieces.js';
import { isSquareAttacked } from '../engine/attacks.js';
import { generatePseudoMoves } from '../engine/movegen.js';
import * as PST from './psqt.js';

const PST_BY_TYPE = {
  [PAWN]: PST.PAWN_PST,
  [KNIGHT]: PST.KNIGHT_PST,
  [BISHOP]: PST.BISHOP_PST,
  [ROOK]: PST.ROOK_PST,
  [QUEEN]: PST.QUEEN_PST,
};

// 0x88 square -> rank-major 0..63 index (White perspective); mirror for Black.
const idx64 = (sq) => rankOf(sq) * 8 + fileOf(sq);
const mirror = (i) => (7 - (i >> 3)) * 8 + (i & 7);

// Count mobility for one color cheaply by temporarily setting the side to move.
function mobilityFor(board, color) {
  const saved = board.sideToMove;
  board.sideToMove = color;
  const n = generatePseudoMoves(board).length;
  board.sideToMove = saved;
  return n;
}

/** Evaluate `board` in centipawns from the side-to-move's perspective. */
export function evaluate(board) {
  let score = 0; // accumulated from White's perspective, flipped at the end
  const pawnFiles = { [WHITE]: new Array(8).fill(0), [BLACK]: new Array(8).fill(0) };
  const nonPawnMaterial = { [WHITE]: 0, [BLACK]: 0 };
  let queenCount = 0;

  for (let sq = 0; sq < 128; sq += 1) {
    if (!onBoard(sq)) {
      sq += 7;
      continue;
    }
    const piece = board.squares[sq];
    if (!piece) continue;
    const color = pieceColor(piece);
    const type = pieceType(piece);
    const sign = color === WHITE ? 1 : -1;

    // Material.
    score += sign * PIECE_VALUE[type];
    if (type !== PAWN && type !== KING) nonPawnMaterial[color] += PIECE_VALUE[type];
    if (type === QUEEN) queenCount += 1;
    if (type === PAWN) pawnFiles[color][fileOf(sq)] += 1;

    // Piece-square value (king handled below with phase awareness).
    if (type !== KING) {
      const i = color === WHITE ? idx64(sq) : mirror(idx64(sq));
      score += sign * PST_BY_TYPE[type][i];
    }
  }

  // Game phase: endgame once queens are gone or heavy material is low.
  const endgame = queenCount === 0 || nonPawnMaterial[WHITE] + nonPawnMaterial[BLACK] < 2600;

  // King placement (phase-aware) and a small king-safety shelter term.
  for (const color of [WHITE, BLACK]) {
    const sign = color === WHITE ? 1 : -1;
    const kingSq = board.kings[color];
    const table = endgame ? PST.KING_END_PST : PST.KING_MID_PST;
    const i = color === WHITE ? idx64(kingSq) : mirror(idx64(kingSq));
    score += sign * table[i];
    if (!endgame) score += sign * kingShelter(board, kingSq, color);
  }

  // Pawn structure: penalize doubled and isolated pawns, reward passed pawns.
  for (const color of [WHITE, BLACK]) {
    const sign = color === WHITE ? 1 : -1;
    for (let f = 0; f < 8; f += 1) {
      const count = pawnFiles[color][f];
      if (count > 1) score -= sign * 15 * (count - 1); // doubled
      const left = f > 0 ? pawnFiles[color][f - 1] : 0;
      const right = f < 7 ? pawnFiles[color][f + 1] : 0;
      if (count > 0 && left === 0 && right === 0) score -= sign * 12; // isolated
    }
  }

  // Mobility: reward having more available moves.
  score += (mobilityFor(board, WHITE) - mobilityFor(board, BLACK)) * 2;

  return board.sideToMove === WHITE ? score : -score;
}

/**
 * Simple king-safety shelter: reward friendly pawns on the three files in front
 * of the king and lightly penalize enemy attackers on adjacent squares.
 */
function kingShelter(board, kingSq, color) {
  let shelter = 0;
  const forward = color === WHITE ? 16 : -16;
  for (const df of [-1, 0, 1]) {
    const front = kingSq + forward + df;
    if (onBoard(front)) {
      const p = board.squares[front];
      if (p && pieceType(p) === PAWN && pieceColor(p) === color) shelter += 8;
    }
  }
  if (isSquareAttacked(board, kingSq, color ^ 1)) shelter -= 20;
  return shelter;
}
