// Perft (performance test): count the number of leaf nodes reachable in exactly
// `depth` plies. Comparing these counts against published reference values is
// the gold-standard correctness test for a move generator — any bug in
// castling, en passant, promotion, or check handling shifts the counts.

import { generateLegalMoves } from './movegen.js';
import { makeMove, unmakeMove } from './moves.js';

/** Count leaf nodes at the given search depth. */
export function perft(board, depth) {
  if (depth === 0) return 1;
  const moves = generateLegalMoves(board);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) {
    makeMove(board, move);
    nodes += perft(board, depth - 1);
    unmakeMove(board, move);
  }
  return nodes;
}

/** Per-root-move breakdown, handy when debugging a wrong perft count. */
export function perftDivide(board, depth) {
  const result = {};
  for (const move of generateLegalMoves(board)) {
    makeMove(board, move);
    result[`${move.from}-${move.to}`] = depth <= 1 ? 1 : perft(board, depth - 1);
    unmakeMove(board, move);
  }
  return result;
}
