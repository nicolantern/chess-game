export const PieceType = {
  PAWN: 'p',
  KNIGHT: 'n',
  BISHOP: 'b',
  ROOK: 'r',
  QUEEN: 'q',
  KING: 'k'
};

export const Color = {
  WHITE: 'w',
  BLACK: 'b'
};

export const PieceValue = {
  [PieceType.PAWN]: 100,
  [PieceType.KNIGHT]: 320,
  [PieceType.BISHOP]: 330,
  [PieceType.ROOK]: 500,
  [PieceType.QUEEN]: 900,
  [PieceType.KING]: 20000
};

export function isWhite(piece) {
  return piece && piece.color === Color.WHITE;
}

export function isBlack(piece) {
  return piece && piece.color === Color.BLACK;
}

export function otherColor(color) {
  return color === Color.WHITE ? Color.BLACK : Color.WHITE;
}
