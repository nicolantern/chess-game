import { createInitialBoard, fromIndex, toIndex } from './board.js';
import { Color, PieceType, otherColor } from './pieces.js';
import { generateLegalMoves } from './movegen.js';
import { MoveFlag } from './moves.js';

export class Game {
  constructor() {
    this.board = createInitialBoard();
    this.turn = Color.WHITE;
    this.history = [];
    this.status = 'ongoing';
    this.check = false;
    this.checkmate = false;
    this.stalemate = false;
    this.draw = false;
    this.repetition = new Map();
    this.halfmoveClock = 0;
    this.moveNumber = 1;
    this.captured = [];
    this.lastMove = null;
  }

  clone() {
    const copy = new Game();
    copy.board = this.board.map((row) => [...row]);
    copy.turn = this.turn;
    copy.history = this.history.map((move) => ({ ...move }));
    copy.status = this.status;
    copy.check = this.check;
    copy.checkmate = this.checkmate;
    copy.stalemate = this.stalemate;
    copy.draw = this.draw;
    copy.repetition = new Map(this.repetition);
    copy.halfmoveClock = this.halfmoveClock;
    copy.moveNumber = this.moveNumber;
    copy.captured = [...this.captured];
    copy.lastMove = this.lastMove ? { ...this.lastMove } : null;
    return copy;
  }

  getPiece(square) {
    const index = toIndex(square);
    const row = Math.floor(index / 8);
    const col = index % 8;
    const symbol = this.board[row][col];
    if (!symbol) return null;
    return { type: symbol.toLowerCase(), color: symbol === symbol.toUpperCase() ? Color.WHITE : Color.BLACK, symbol };
  }

  setPiece(square, piece) {
    const index = toIndex(square);
    const row = Math.floor(index / 8);
    const col = index % 8;
    this.board[row][col] = piece ? piece.symbol : null;
  }

  makeMove(move) {
    const piece = this.getPiece(move.from);
    if (!piece) return false;
    const captured = this.getPiece(move.to);
    this.setPiece(move.from, null);
    this.setPiece(move.to, piece);
    this.lastMove = { from: move.from, to: move.to, piece, captured, promotion: move.promotion };
    this.history.push({ ...move, captured });
    if (captured) {
      this.captured.push(captured);
      this.halfmoveClock = 0;
    } else {
      this.halfmoveClock += 1;
    }
    this.turn = otherColor(this.turn);
    this.updateStatus();
    return true;
  }

  undoMove() {
    const previous = this.history.pop();
    if (!previous) return false;
    const piece = this.getPiece(previous.to);
    this.setPiece(previous.to, null);
    this.setPiece(previous.from, piece);
    this.turn = otherColor(this.turn);
    this.lastMove = null;
    this.updateStatus();
    return true;
  }

  getLegalMoves() {
    return generateLegalMoves(this.board, this.turn);
  }

  updateStatus() {
    const legalMoves = this.getLegalMoves();
    this.check = false;
    this.checkmate = false;
    this.stalemate = false;
    this.draw = false;
    if (legalMoves.length === 0) {
      this.checkmate = true;
      this.stalemate = true;
      this.status = 'checkmate';
      return;
    }
    this.status = 'ongoing';
  }
}
