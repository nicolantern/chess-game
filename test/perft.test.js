import { describe, it, expect } from 'vitest';
import { parseFen, START_FEN } from '../src/engine/fen.js';
import { perft } from '../src/engine/perft.js';

// Perft node counts are the authoritative correctness check for move
// generation. Reference values are the well-known published figures.
describe('perft node counts', () => {
  it('start position', () => {
    const b = parseFen(START_FEN);
    expect(perft(b, 1)).toBe(20);
    expect(perft(b, 2)).toBe(400);
    expect(perft(b, 3)).toBe(8902);
    expect(perft(b, 4)).toBe(197281);
  });

  it('Kiwipete (castling, en passant, pins)', () => {
    const b = parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect(perft(b, 1)).toBe(48);
    expect(perft(b, 2)).toBe(2039);
    expect(perft(b, 3)).toBe(97862);
  });

  it('position 3 (en passant and promotions)', () => {
    const b = parseFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect(perft(b, 1)).toBe(14);
    expect(perft(b, 2)).toBe(191);
    expect(perft(b, 3)).toBe(2812);
    expect(perft(b, 4)).toBe(43238);
  });

  it('position 4 (promotions, mirror symmetry)', () => {
    const b = parseFen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    expect(perft(b, 1)).toBe(6);
    expect(perft(b, 2)).toBe(264);
    expect(perft(b, 3)).toBe(9467);
  });

  it('position 5 (tricky, common bug-catcher)', () => {
    const b = parseFen('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8');
    expect(perft(b, 1)).toBe(44);
    expect(perft(b, 2)).toBe(1486);
    expect(perft(b, 3)).toBe(62379);
  });
});
