// The search: negamax with alpha-beta pruning, iterative deepening bounded by a
// time budget, and a quiescence search at the leaves to avoid the horizon
// effect (stopping the search in the middle of a capture sequence).
//
// Negamax is minimax expressed so that a single routine works for both sides:
// score(position) = -score(position after best reply). Evaluation returns the
// score from the side-to-move's perspective, which makes this valid.

import { generateLegalMoves } from '../engine/movegen.js';
import { makeMove, unmakeMove, FLAGS } from '../engine/moves.js';
import { inCheck } from '../engine/attacks.js';
import { evaluate } from './evaluation.js';
import { orderMoves, makeKillers, storeKiller } from './ordering.js';

const MATE = 1000000;
const INF = Infinity;

/**
 * Find the best move for the side to move.
 * options: { maxDepth, timeMs, randomness }
 *   - randomness (0..1): probability of playing a random legal move instead of
 *     the best one, used to weaken the easier difficulty levels.
 * Returns { move, score, depth, nodes }.
 */
export function searchBestMove(board, options = {}) {
  const maxDepth = options.maxDepth ?? 4;
  const timeMs = options.timeMs ?? 1000;
  const deadline = Date.now() + timeMs;
  const killers = makeKillers();
  const ctx = { nodes: 0, deadline, stop: false };

  const rootMoves = generateLegalMoves(board);
  if (rootMoves.length === 0) return { move: null, score: 0, depth: 0, nodes: 0 };

  // Easy/medium: sometimes just play a random legal move.
  if (options.randomness && rootMoves.length > 1 && Math.random() < options.randomness) {
    const move = rootMoves[Math.floor(Math.random() * rootMoves.length)];
    return { move, score: 0, depth: 0, nodes: 0 };
  }

  let best = rootMoves[0];
  let bestScore = -INF;
  let reachedDepth = 0;

  // Iterative deepening: search depth 1, then 2, ... reusing the previous best
  // move as the first move tried so alpha-beta prunes aggressively.
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    let alpha = -INF;
    let localBest = null;
    let localScore = -INF;
    const ordered = orderMoves(board, rootMoves, 0, killers);
    moveToFront(ordered, best);

    for (const move of ordered) {
      makeMove(board, move);
      const score = -negamax(board, depth - 1, -INF, -alpha, 1, ctx, killers);
      unmakeMove(board, move);
      if (ctx.stop) break;
      if (score > localScore) {
        localScore = score;
        localBest = move;
      }
      if (score > alpha) alpha = score;
    }

    if (!ctx.stop && localBest) {
      best = localBest;
      bestScore = localScore;
      reachedDepth = depth;
    }
    // Stop early if out of time or a forced mate is already found.
    if (ctx.stop || Math.abs(bestScore) > MATE - 1000) break;
  }

  return { move: best, score: bestScore, depth: reachedDepth, nodes: ctx.nodes };
}

function negamax(board, depth, alpha, beta, ply, ctx, killers) {
  // Check the clock periodically (cheap: every 1024 nodes).
  if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) {
    ctx.stop = true;
    return 0;
  }
  ctx.nodes += 1;

  const moves = generateLegalMoves(board);
  if (moves.length === 0) {
    // Checkmate is scored by distance to mate so the AI prefers faster mates;
    // stalemate is a draw.
    return inCheck(board, board.sideToMove) ? -MATE + ply : 0;
  }
  if (depth <= 0) return quiescence(board, alpha, beta, ctx);

  const ordered = orderMoves(board, moves, ply, killers);
  let bestScore = -INF;
  for (const move of ordered) {
    makeMove(board, move);
    const score = -negamax(board, depth - 1, -beta, -alpha, ply + 1, ctx, killers);
    unmakeMove(board, move);
    if (ctx.stop) return 0;
    if (score > bestScore) bestScore = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      if (!(move.flags & FLAGS.CAPTURE)) storeKiller(killers, ply, move);
      break; // beta cutoff
    }
  }
  return bestScore;
}

/**
 * Quiescence search: at a leaf, keep searching only "loud" moves (captures)
 * until the position is quiet, so the evaluation isn't taken mid-exchange.
 */
function quiescence(board, alpha, beta, ctx) {
  ctx.nodes += 1;
  const standPat = evaluate(board);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const captures = generateLegalMoves(board).filter((m) => m.flags & FLAGS.CAPTURE);
  const ordered = orderMoves(board, captures, 0, null);
  for (const move of ordered) {
    makeMove(board, move);
    const score = -quiescence(board, -beta, -alpha, ctx);
    unmakeMove(board, move);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

/** Move `target` to the front of `list` if present (in-place). */
function moveToFront(list, target) {
  if (!target) return;
  const i = list.findIndex(
    (m) => m.from === target.from && m.to === target.to && m.promotion === target.promotion,
  );
  if (i > 0) {
    const [x] = list.splice(i, 1);
    list.unshift(x);
  }
}
