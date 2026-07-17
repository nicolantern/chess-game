// Piece color and type constants plus compact encode/decode helpers.
//
// A piece is encoded as a single small integer: color<<3 | type. Because the
// six piece types are 1..6, EMPTY (0) is falsy, which keeps board scanning
// cheap ("if (piece) ...").

export const WHITE = 0;
export const BLACK = 1;

export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

// Base material values in centipawns, shared by the AI and MVV-LVA ordering.
export const PIECE_VALUE = {
  [PAWN]: 100,
  [KNIGHT]: 320,
  [BISHOP]: 330,
  [ROOK]: 500,
  [QUEEN]: 900,
  [KING]: 20000,
};

/** Encode a piece from a color and a type. */
export function makePiece(color, type) {
  return (color << 3) | type;
}

/** Extract the piece type (PAWN..KING) from an encoded piece. */
export function pieceType(piece) {
  return piece & 7;
}

/** Extract the color (WHITE/BLACK) from an encoded piece. */
export function pieceColor(piece) {
  return piece >> 3;
}

/** The opposing color. */
export function opposite(color) {
  return color ^ 1;
}

// FEN letter <-> type maps (lowercase letter names the type; case encodes color).
export const PIECE_LETTERS = {
  [PAWN]: 'p',
  [KNIGHT]: 'n',
  [BISHOP]: 'b',
  [ROOK]: 'r',
  [QUEEN]: 'q',
  [KING]: 'k',
};

export const LETTER_TO_TYPE = {
  p: PAWN,
  n: KNIGHT,
  b: BISHOP,
  r: ROOK,
  q: QUEEN,
  k: KING,
};
