export const BOARD_SIZE = 8;
export const FILES = 'abcdefgh';
export const RANKS = '12345678';

export function toIndex(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - Number.parseInt(square[1], 10);
  return rank * 8 + file;
}

export function fromIndex(index) {
  const file = index % 8;
  const rank = 8 - Math.floor(index / 8);
  return `${FILES[file]}${rank}`;
}

export function isInsideSquare(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number.parseInt(square[1], 10);
  return file >= 0 && file < 8 && rank >= 1 && rank <= 8;
}

export function createInitialBoard() {
  return [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  ];
}
