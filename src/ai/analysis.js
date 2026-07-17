// Post-game analysis. Replays a game and, at every position, asks the engine
// for its best line. Comparing the engine's best evaluation with what actually
// happened yields a per-move "centipawn loss", which drives move classification
// (inaccuracy / mistake / blunder / brilliant) and a Lichess-style accuracy %.
//
// The heavy lifting is one search per position, run asynchronously with a
// progress callback so the UI stays responsive.

import { Game } from '../engine/game.js';
import { searchBestMove } from './search.js';
import { isSquareAttacked, inCheck } from '../engine/attacks.js';
import { pieceType, pieceColor, PIECE_VALUE, WHITE, BLACK, KNIGHT } from '../engine/pieces.js';

// Centipawn-loss thresholds for classifying a move.
const THRESHOLDS = { blunder: 300, mistake: 150, inaccuracy: 50 };
const EVAL_CLAMP = 2000; // clamp mate-ish scores so the formulas stay sane

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Win probability (0..100) for the side to move, from a centipawn score.
function winPercent(cp) {
  return 100 / (1 + Math.exp(-0.00368208 * cp));
}

// Lichess per-move accuracy from the drop in win% caused by the move.
function moveAccuracy(winBefore, winAfter) {
  const acc = 103.1668 * Math.exp(-0.04354 * (winBefore - winAfter)) - 3.1669;
  return clamp(acc, 0, 100);
}

function classify(cpLoss, isBest, brilliant) {
  if (brilliant) return 'brilliant';
  if (cpLoss >= THRESHOLDS.blunder) return 'blunder';
  if (cpLoss >= THRESHOLDS.mistake) return 'mistake';
  if (cpLoss >= THRESHOLDS.inaccuracy) return 'inaccuracy';
  return isBest ? 'best' : 'good';
}

// Symbols shown next to moves in the history.
export const CLASS_SYMBOL = {
  brilliant: '!!',
  best: '',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};

/**
 * Analyze a coordinate-move list.
 * @param {{from:number,to:number,promotion:number}[]} moves
 * @param {object} [opts]
 * @param {number} [opts.maxDepth]
 * @param {number} [opts.timeMs]
 * @param {(done:number,total:number)=>void} [opts.onProgress]
 * @returns {Promise<{perMove:object[], summary:object}>}
 */
export async function analyzeGame(moves, opts = {}) {
  const cfg = { maxDepth: opts.maxDepth ?? 8, timeMs: opts.timeMs ?? 90 };
  const onProgress = opts.onProgress || (() => {});
  const n = moves.length;

  const scores = []; // best score at each position, side-to-move perspective
  const plies = []; // per-ply metadata gathered during replay

  const game = new Game();
  for (let i = 0; i <= n; i += 1) {
    const { score, move: best } = searchBestMove(game.board.clone(), cfg);
    // A checkmated position is worst-possible for the side to move; the search
    // returns 0 for "no moves", so score it explicitly here.
    const terminal = game.legalMoves().length === 0;
    const s = terminal && inCheck(game.board, game.board.sideToMove)
      ? -EVAL_CLAMP
      : clamp(score, -EVAL_CLAMP, EVAL_CLAMP);
    scores.push(s);

    if (i < n) {
      const m = moves[i];
      const mover = game.board.sideToMove;
      const legal = game.legalMoves().find(
        (x) => x.from === m.from && x.to === m.to && (x.promotion || 0) === (m.promotion || 0),
      );
      if (!legal) break;
      const wasBest =
        best && best.from === legal.from && best.to === legal.to && (best.promotion || 0) === (legal.promotion || 0);
      game.applyMove(legal);
      // Sacrifice heuristic: after the move the piece sits en prise (attacked by
      // the opponent) and is worth at least a knight.
      const movedType = pieceType(game.board.squares[legal.to]);
      const enPrise =
        movedType >= KNIGHT &&
        PIECE_VALUE[movedType] >= PIECE_VALUE[KNIGHT] &&
        isSquareAttacked(game.board, legal.to, mover ^ 1);
      plies.push({ mover, san: game.history[game.history.length - 1].san, wasBest, enPrise });
    }
    onProgress(i, n);
    if ((i & 3) === 0) await new Promise((r) => setTimeout(r, 0)); // yield to the UI
  }

  // Second pass: derive cpLoss / accuracy / class from adjacent best scores.
  const perMove = [];
  const acc = { [WHITE]: [], [BLACK]: [] };
  const counts = {
    [WHITE]: { brilliant: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
    [BLACK]: { brilliant: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
  };

  for (let i = 0; i < plies.length; i += 1) {
    const meta = plies[i];
    const moverBest = scores[i]; // best eval for the mover
    const moverPlayed = -scores[i + 1]; // eval after the move, mover perspective
    const cpLoss = Math.max(0, moverBest - moverPlayed);
    const winBefore = winPercent(moverBest);
    const winAfter = winPercent(moverPlayed);
    const accuracy = moveAccuracy(winBefore, winAfter);
    const brilliant = meta.wasBest && meta.enPrise && moverBest >= 100 && cpLoss <= 30;
    const cls = classify(cpLoss, meta.wasBest, brilliant);

    acc[meta.mover].push(accuracy);
    if (counts[meta.mover][cls] !== undefined) counts[meta.mover][cls] += 1;
    perMove.push({ ply: i, san: meta.san, mover: meta.mover, cpLoss: Math.round(cpLoss), class: cls });
  }

  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 100);
  const summary = {
    [WHITE]: { accuracy: Math.round(mean(acc[WHITE]) * 10) / 10, ...counts[WHITE] },
    [BLACK]: { accuracy: Math.round(mean(acc[BLACK]) * 10) / 10, ...counts[BLACK] },
  };

  return { perMove, summary };
}
