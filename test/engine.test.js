import { describe, it, expect } from 'vitest';
import { WHITE, BLACK, PAWN, KING, makePiece, pieceType, pieceColor } from '../src/engine/pieces.js';
import { fileOf, rankOf, algebraic, squareFromAlgebraic, onBoard } from '../src/engine/board.js';
import { parseFen, toFen, START_FEN } from '../src/engine/fen.js';
import { isSquareAttacked, inCheck } from '../src/engine/attacks.js';
import { makeMove, unmakeMove, FLAGS } from '../src/engine/moves.js';
import { generateLegalMoves } from '../src/engine/movegen.js';
import { toSan } from '../src/engine/notation.js';
import { isInsufficientMaterial } from '../src/engine/rules.js';

describe('pieces + board geometry', () => {
  it('encodes and decodes pieces', () => {
    const p = makePiece(BLACK, KING);
    expect(pieceType(p)).toBe(KING);
    expect(pieceColor(p)).toBe(BLACK);
  });
  it('maps squares to algebraic and back', () => {
    expect(algebraic(0)).toBe('a1');
    expect(algebraic(0x77)).toBe('h8');
    expect(algebraic(squareFromAlgebraic('e4'))).toBe('e4');
  });
  it('detects off-board squares and computes file/rank', () => {
    expect(onBoard(0x08)).toBe(false);
    const e4 = squareFromAlgebraic('e4');
    expect(fileOf(e4)).toBe(4);
    expect(rankOf(e4)).toBe(3);
  });
});

describe('FEN', () => {
  it('round-trips the start position', () => {
    expect(toFen(parseFen(START_FEN))).toBe(START_FEN);
  });
  it('parses and re-emits state fields', () => {
    const fen = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
    const b = parseFen(fen);
    expect(b.sideToMove).toBe(WHITE);
    expect(b.castling).toBe('KQkq');
    expect(b.fullmoveNumber).toBe(2);
    expect(toFen(b)).toBe(fen);
  });
});

describe('attacks and check', () => {
  it('detects a knight attack (and non-attack)', () => {
    const b = parseFen('8/8/8/8/4n3/8/8/4K3 w - - 0 1');
    expect(isSquareAttacked(b, squareFromAlgebraic('d2'), BLACK)).toBe(true);
    expect(isSquareAttacked(b, squareFromAlgebraic('a1'), BLACK)).toBe(false);
  });
  it('detects check', () => {
    const b = parseFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(inCheck(b, WHITE)).toBe(true);
  });
});

describe('make/unmake reversibility', () => {
  const mv = (from, to, extra = {}) => ({
    from: squareFromAlgebraic(from), to: squareFromAlgebraic(to), promotion: 0, flags: 0, ...extra,
  });
  it('reverses a double push (with ep target)', () => {
    const b = parseFen(START_FEN);
    const before = toFen(b);
    const m = mv('e2', 'e4', { flags: FLAGS.DOUBLE_PUSH });
    makeMove(b, m);
    expect(b.epSquare).toBe(squareFromAlgebraic('e3'));
    unmakeMove(b, m);
    expect(toFen(b)).toBe(before);
  });
  it('reverses a capture', () => {
    const b = parseFen('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    const before = toFen(b);
    const m = mv('e4', 'd5', { flags: FLAGS.CAPTURE });
    makeMove(b, m);
    unmakeMove(b, m);
    expect(toFen(b)).toBe(before);
  });
});

describe('legal move generation', () => {
  const coords = (b) => generateLegalMoves(b).map((m) => algebraic(m.from) + algebraic(m.to));
  it('start position has 20 legal moves', () => {
    expect(generateLegalMoves(parseFen(START_FEN)).length).toBe(20);
  });
  it('generates castling both sides', () => {
    const b = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(coords(b)).toContain('e1g1');
    expect(coords(b)).toContain('e1c1');
  });
  it('generates en passant', () => {
    const b = parseFen('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
    expect(coords(b)).toContain('e5f6');
  });
  it('respects pins (a pinned rook may only move along the pin)', () => {
    // White rook e2 is pinned to the king e1 by the black rook e8.
    const b = parseFen('4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1');
    const moves = coords(b);
    expect(moves).not.toContain('e2d2'); // sideways would expose the king
    expect(moves).not.toContain('e2f2');
    expect(moves).toContain('e2e3'); // along the pin is fine
    expect(moves).toContain('e2e8'); // capturing the pinner is fine
  });
});

describe('SAN', () => {
  const find = (b, from, to) =>
    generateLegalMoves(b).find(
      (m) => m.from === squareFromAlgebraic(from) && m.to === squareFromAlgebraic(to),
    );
  it('names pawn and piece moves', () => {
    const b = parseFen(START_FEN);
    expect(toSan(b, find(b, 'e2', 'e4'))).toBe('e4');
    expect(toSan(b, find(b, 'g1', 'f3'))).toBe('Nf3');
  });
  it('names castling', () => {
    const b = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(toSan(b, find(b, 'e1', 'g1'))).toBe('O-O');
    expect(toSan(b, find(b, 'e1', 'c1'))).toBe('O-O-O');
  });
  it('disambiguates by file', () => {
    const b = parseFen('4k3/8/8/8/4K3/8/8/R6R w - - 0 1');
    expect(toSan(b, find(b, 'a1', 'd1'))).toBe('Rad1');
  });
});

describe('insufficient material', () => {
  it('KvK and KBvK are draws; KQvK is not', () => {
    expect(isInsufficientMaterial(parseFen('8/8/8/4k3/8/8/8/4K3 w - - 0 1'))).toBe(true);
    expect(isInsufficientMaterial(parseFen('8/8/8/4k3/8/8/8/3BK3 w - - 0 1'))).toBe(true);
    expect(isInsufficientMaterial(parseFen('8/8/8/4k3/8/8/8/3QK3 w - - 0 1'))).toBe(false);
  });
});
