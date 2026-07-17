// Move ordering. Good ordering makes alpha-beta prune far more, which is what
// keeps the deeper (Hard/Expert) searches fast. We score captures by MVV-LVA
// (Most Valuable Victim minus Least Valuable Attacker), reward promotions, and
// give a bonus to "killer" moves — quiet moves that caused a cutoff at the same
// ply elsewhere in the tree.

import { pieceType, PIECE_VALUE, PAWN } from '../engine/pieces.js';
import { FLAGS } from '../engine/moves.js';

/** Allocate the killer-move table: two slots per ply. */
export function makeKillers(maxPly = 64) {
  return Array.from({ length: maxPly }, () => [null, null]);
}

/** Record a quiet move that produced a beta cutoff at `ply`. */
export function storeKiller(killers, ply, move) {
  const slot = killers[ply];
  if (slot[0] && slot[0].from === move.from && slot[0].to === move.to) return;
  slot[1] = slot[0];
  slot[0] = move;
}

function scoreMove(board, move, ply, killers) {
  let score = 0;

  if (move.flags & FLAGS.CAPTURE) {
    const victimValue = move.flags & FLAGS.EN_PASSANT
      ? PIECE_VALUE[PAWN]
      : PIECE_VALUE[pieceType(board.squares[move.to])] || 0;
    const attackerValue = PIECE_VALUE[pieceType(board.squares[move.from])] || 0;
    score += 10000 + victimValue * 10 - attackerValue; // MVV-LVA
  }
  if (move.flags & FLAGS.PROMOTION) score += 9000 + PIECE_VALUE[move.promotion];

  if (killers) {
    const slot = killers[ply];
    if (slot && slot[0] && slot[0].from === move.from && slot[0].to === move.to) score += 800;
    else if (slot && slot[1] && slot[1].from === move.from && slot[1].to === move.to) score += 700;
  }
  return score;
}

/** Return `moves` sorted best-first for the given ply. */
export function orderMoves(board, moves, ply, killers) {
  return moves
    .map((m) => ({ m, s: scoreMove(board, m, ply, killers) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}
