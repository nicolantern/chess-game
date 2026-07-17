import { BOARD_SIZE, fromIndex, isInsideSquare, toIndex } from './board.js';
import { Color, PieceType, otherColor } from './pieces.js';
import { Move, MoveFlag } from './moves.js';

const DIRECTIONS = {
  [PieceType.PAWN]: { [Color.WHITE]: [-8, -16, -7, -9], [Color.BLACK]: [8, 16, 7, 9] },
  [PieceType.KNIGHT]: [-17, -15, -10, -6, 6, 10, 15, 17],
  [PieceType.BISHOP]: [-9, -7, 7, 9],
  [PieceType.ROOK]: [-8, -1, 1, 8],
  [PieceType.QUEEN]: [-9, -8, -7, -1, 1, 7, 8, 9],
  [PieceType.KING]: [-9, -8, -7, -1, 1, 7, 8, 9]
};

function pieceAt(board, square) {
  const index = toIndex(square);
  const row = Math.floor(index / 8);
  const col = index % 8;
  const raw = board[row][col];
  return raw ? { type: raw.toLowerCase(), color: raw === raw.toUpperCase() ? Color.WHITE : Color.BLACK, symbol: raw } : null;
}

function setBoard(board, square, piece) {
  const index = toIndex(square);
  const row = Math.floor(index / 8);
  const col = index % 8;
  board[row][col] = piece ? piece.symbol : null;
}

function isSameColor(a, b) {
  return a && b && a.color === b.color;
}

function generateSlidingMoves(board, piece, from, moves, color) {
  const directions = DIRECTIONS[piece.type];
  for (const delta of directions) {
    let next = from + delta;
    while (next >= 0 && next < BOARD_SIZE * BOARD_SIZE) {
      const row = Math.floor(next / 8);
      const col = next % 8;
      if (col === 0 && delta === -1) break;
      if (col === 7 && delta === 1) break;
      const square = fromIndex(next);
      const target = pieceAt(board, square);
      if (!target) {
        moves.push(new Move({ from, to: square, piece, captured: null }));
      } else {
        if (!isSameColor(piece, target)) {
          moves.push(new Move({ from, to: square, piece, captured: target }));
        }
        break;
      }
      next += delta;
    }
  }
}

function generatePawnMoves(board, piece, from, moves) {
  const step = piece.color === Color.WHITE ? -8 : 8;
  const oneStep = from + step;
  const row = Math.floor(oneStep / 8);
  if (row >= 0 && row < 8) {
    const oneSquare = fromIndex(oneStep);
    const target = pieceAt(board, oneSquare);
    if (!target) {
      moves.push(new Move({ from, to: oneSquare, piece, captured: null }));
      const twoStep = oneStep + step;
      if ((piece.color === Color.WHITE && from >= 48 && from <= 55) || (piece.color === Color.BLACK && from >= 8 && from <= 15)) {
        const twoSquare = fromIndex(twoStep);
        const twoTarget = pieceAt(board, twoSquare);
        if (!twoTarget) {
          moves.push(new Move({ from, to: twoSquare, piece, captured: null, flags: MoveFlag.DOUBLE_PUSH }));
        }
      }
    }
  }
  for (const delta of piece.color === Color.WHITE ? [-9, -7] : [7, 9]) {
    const targetIndex = from + delta;
    const row = Math.floor(targetIndex / 8);
    const col = targetIndex % 8;
    if (row < 0 || row > 7 || col < 0 || col > 7) continue;
    const square = fromIndex(targetIndex);
    const target = pieceAt(board, square);
    if (target && target.color !== piece.color) {
      moves.push(new Move({ from, to: square, piece, captured: target, flags: MoveFlag.CAPTURE }));
    }
  }
}

export function generateLegalMoves(board, color) {
  const moves = [];
  const pieces = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const symbol = board[row][col];
      if (!symbol) continue;
      const piece = { type: symbol.toLowerCase(), color: symbol === symbol.toUpperCase() ? Color.WHITE : Color.BLACK, symbol };
      if (piece.color === color) pieces.push({ piece, row, col });
    }
  }

  for (const { piece, row, col } of pieces) {
    const from = row * 8 + col;
    if (piece.type === PieceType.PAWN) {
      generatePawnMoves(board, piece, from, moves);
      continue;
    }
    if (piece.type === PieceType.KNIGHT) {
      for (const delta of DIRECTIONS[PieceType.KNIGHT]) {
        const next = from + delta;
        const row2 = Math.floor(next / 8);
        const col2 = next % 8;
        if (row2 < 0 || row2 > 7 || col2 < 0 || col2 > 7) continue;
        const square = fromIndex(next);
        const target = pieceAt(board, square);
        if (!target || target.color !== piece.color) {
          moves.push(new Move({ from, to: square, piece, captured: target }));
        }
      }
      continue;
    }
    if (piece.type === PieceType.KING) {
      for (const delta of DIRECTIONS[PieceType.KING]) {
        const next = from + delta;
        const row2 = Math.floor(next / 8);
        const col2 = next % 8;
        if (row2 < 0 || row2 > 7 || col2 < 0 || col2 > 7) continue;
        const square = fromIndex(next);
        const target = pieceAt(board, square);
        if (!target || target.color !== piece.color) {
          moves.push(new Move({ from, to: square, piece, captured: target }));
        }
      }
      continue;
    }
    generateSlidingMoves(board, piece, from, moves, color);
  }

  return moves;
}
