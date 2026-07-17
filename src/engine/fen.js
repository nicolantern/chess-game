import { createInitialBoard } from './board.js';

export function boardToFen(board) {
  return board.map((row) => row.map((cell) => cell ?? '.').join('')).join('/');
}

export function fenToBoard(fen) {
  const rows = fen.split(' ')[0].split('/');
  const board = [];
  for (const row of rows) {
    const cells = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number.parseInt(ch, 10); i += 1) cells.push(null);
      } else {
        cells.push(ch);
      }
    }
    board.push(cells);
  }
  return board;
}

export function initialFen() {
  return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
}
