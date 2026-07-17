export function toSan(move, board) {
  if (!move) return '';
  const piece = board[move.from[1] - 1][move.from[0].charCodeAt(0) - 97];
  return `${piece ? piece.toUpperCase() : ''}${move.from}${move.to}`;
}
