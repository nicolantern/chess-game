export class Move {
  constructor({ from, to, piece, captured, promotion, flags = 0, san = '' }) {
    this.from = from;
    this.to = to;
    this.piece = piece;
    this.captured = captured;
    this.promotion = promotion;
    this.flags = flags;
    this.san = san;
  }
}

export const MoveFlag = {
  CAPTURE: 1 << 0,
  DOUBLE_PUSH: 1 << 1,
  CASTLE: 1 << 2,
  EN_PASSANT: 1 << 3,
  PROMOTION: 1 << 4,
  CHECK: 1 << 5
};
