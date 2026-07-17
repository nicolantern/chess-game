import { Difficulty, getSearchDepth } from './difficulty.js';
import { evaluate } from './evaluation.js';
import { Color, PieceType } from '../engine/pieces.js';
import { generateLegalMoves } from '../engine/movegen.js';

export function chooseMove(game, difficulty) {
  const legalMoves = game.getLegalMoves();
  if (!legalMoves.length) return null;
  const depth = getSearchDepth(difficulty);

  let bestMove = legalMoves[0];
  let bestScore = -Infinity;
  for (const move of legalMoves) {
    const next = game.clone();
    next.makeMove(move);
    const score = -search(next, depth - 1, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

function search(game, depth, alpha, beta, maximizing) {
  if (depth === 0) return evaluate(game.board, game.turn);
  const moves = game.getLegalMoves();
  if (!moves.length) return -100000;
  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const next = game.clone();
      next.makeMove(move);
      const score = search(next, depth - 1, alpha, beta, false);
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const move of moves) {
    const next = game.clone();
    next.makeMove(move);
    const score = search(next, depth - 1, alpha, beta, true);
    best = Math.min(best, score);
    beta = Math.min(beta, score);
    if (beta <= alpha) break;
  }
  return best;
}
