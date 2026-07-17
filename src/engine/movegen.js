// Move generation.
//
// `generatePseudoMoves` produces every move legal by piece movement rules,
// including castling, en passant, and promotion, but WITHOUT verifying that the
// mover's own king is left safe. `generateLegalMoves` filters those by making
// each move and checking king safety. The 0x88 board makes edge wrapping
// impossible, so the only illegality left to filter is self-check.

import {
  onBoard, rankOf, square,
  KNIGHT_DELTAS, KING_DELTAS, BISHOP_DELTAS, ROOK_DELTAS, QUEEN_DELTAS,
} from './board.js';
import {
  pieceColor, pieceType, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE,
} from './pieces.js';
import { FLAGS, makeMove, unmakeMove } from './moves.js';
import { isSquareAttacked, inCheck } from './attacks.js';

// Promotion always offers all four choices; the UI picks one for the human and
// the AI evaluates each. Ordered queen-first for better move ordering.
const PROMO_TYPES = [QUEEN, ROOK, BISHOP, KNIGHT];

/** Push a pawn move, expanding to four promotion moves on the last rank. */
function addPawnMove(list, from, to, flags, color) {
  const promoRank = color === WHITE ? 7 : 0;
  if (rankOf(to) === promoRank) {
    for (const t of PROMO_TYPES) {
      list.push({ from, to, promotion: t, flags: flags | FLAGS.PROMOTION });
    }
  } else {
    list.push({ from, to, promotion: 0, flags });
  }
}

/** All pseudo-legal moves for the side to move (may leave own king in check). */
export function generatePseudoMoves(board) {
  const sqs = board.squares;
  const us = board.sideToMove;
  const them = us ^ 1;
  const list = [];
  const forward = us === WHITE ? 16 : -16;
  const startRank = us === WHITE ? 1 : 6;

  for (let sq = 0; sq < 128; sq += 1) {
    if (!onBoard(sq)) {
      sq += 7; // skip the off-board half of this rank
      continue;
    }
    const piece = sqs[sq];
    if (!piece || pieceColor(piece) !== us) continue;
    const type = pieceType(piece);

    if (type === PAWN) {
      // Single and double pushes onto empty squares.
      const one = sq + forward;
      if (onBoard(one) && !sqs[one]) {
        addPawnMove(list, sq, one, FLAGS.QUIET, us);
        if (rankOf(sq) === startRank) {
          const two = sq + forward * 2;
          if (!sqs[two]) list.push({ from: sq, to: two, promotion: 0, flags: FLAGS.DOUBLE_PUSH });
        }
      }
      // Captures, including en passant onto the ep target square.
      for (const d of [forward - 1, forward + 1]) {
        const to = sq + d;
        if (!onBoard(to)) continue;
        if (sqs[to] && pieceColor(sqs[to]) === them) {
          addPawnMove(list, sq, to, FLAGS.CAPTURE, us);
        } else if (to === board.epSquare) {
          list.push({ from: sq, to, promotion: 0, flags: FLAGS.EN_PASSANT | FLAGS.CAPTURE });
        }
      }
    } else if (type === KNIGHT || type === KING) {
      const deltas = type === KNIGHT ? KNIGHT_DELTAS : KING_DELTAS;
      for (const d of deltas) {
        const to = sq + d;
        if (!onBoard(to)) continue;
        const target = sqs[to];
        if (!target) list.push({ from: sq, to, promotion: 0, flags: FLAGS.QUIET });
        else if (pieceColor(target) === them) list.push({ from: sq, to, promotion: 0, flags: FLAGS.CAPTURE });
      }
    } else {
      const deltas = type === BISHOP ? BISHOP_DELTAS : type === ROOK ? ROOK_DELTAS : QUEEN_DELTAS;
      for (const d of deltas) {
        let to = sq + d;
        while (onBoard(to)) {
          const target = sqs[to];
          if (!target) {
            list.push({ from: sq, to, promotion: 0, flags: FLAGS.QUIET });
          } else {
            if (pieceColor(target) === them) list.push({ from: sq, to, promotion: 0, flags: FLAGS.CAPTURE });
            break;
          }
          to += d;
        }
      }
    }
  }

  addCastling(board, list, us);
  return list;
}

/**
 * Add castling moves. Castling is legal only if the king and rook have their
 * rights, the squares between are empty, the king is not in check, and the king
 * does not pass through or land on an attacked square.
 */
function addCastling(board, list, us) {
  const sqs = board.squares;
  const them = us ^ 1;
  const rank = us === WHITE ? 0 : 7;
  const kingSq = square(4, rank);
  if (board.kings[us] !== kingSq) return;
  if (isSquareAttacked(board, kingSq, them)) return; // cannot castle out of check

  const kingRight = us === WHITE ? 'K' : 'k';
  const queenRight = us === WHITE ? 'Q' : 'q';

  if (board.castling.includes(kingRight)) {
    const f = square(5, rank);
    const g = square(6, rank);
    if (!sqs[f] && !sqs[g] && !isSquareAttacked(board, f, them) && !isSquareAttacked(board, g, them)) {
      list.push({ from: kingSq, to: g, promotion: 0, flags: FLAGS.KING_CASTLE });
    }
  }
  if (board.castling.includes(queenRight)) {
    const d = square(3, rank);
    const c = square(2, rank);
    const b = square(1, rank);
    if (!sqs[d] && !sqs[c] && !sqs[b] && !isSquareAttacked(board, d, them) && !isSquareAttacked(board, c, them)) {
      list.push({ from: kingSq, to: c, promotion: 0, flags: FLAGS.QUEEN_CASTLE });
    }
  }
}

/** Fully legal moves: pseudo-legal moves that do not leave our king in check. */
export function generateLegalMoves(board) {
  const us = board.sideToMove;
  const pseudo = generatePseudoMoves(board);
  const legal = [];
  for (const move of pseudo) {
    makeMove(board, move);
    if (!inCheck(board, us)) legal.push(move);
    unmakeMove(board, move);
  }
  return legal;
}
