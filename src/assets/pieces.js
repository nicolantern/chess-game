// Inline SVG chess pieces (Staunton-style vector silhouettes) on a 45x45
// viewBox. Each piece is drawn once as shared path markup; the color only
// changes the fill and stroke, so the set is consistent and scales crisply from
// ~28px on mobile to ~96px on desktop. Exported as PIECE_SVG[color][type].

import { WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING } from '../engine/pieces.js';

// Inner path markup per piece type. Coordinates share a common base near y≈40.
const SHAPES = {
  [PAWN]:
    '<path d="M22.5 10.5a4.2 4.2 0 0 0-2.6 7.5c-2 1.2-3.3 3.4-3.3 5.9 0 2.3 1.1 4.3 2.8 5.6-3.1 1.3-6.9 4.9-6.9 11h20c0-6.1-3.8-9.7-6.9-11 1.7-1.3 2.8-3.3 2.8-5.6 0-2.5-1.3-4.7-3.3-5.9a4.2 4.2 0 0 0-2.6-7.5z"/>',
  [ROOK]:
    '<path d="M12 36h21v3H12zM13.5 33v-3h18v3zM14 30l1-11h15l1 11zM13 19v-6h4v2.5h3.5V13h4v2.5H31V13h4v6z"/>',
  [KNIGHT]:
    '<path d="M14 39h18c0-3.5-1.2-13-1.6-16.5-.6-5-3.4-9.5-8.4-11.5l-1 2.5c-.4-.4-1.6-1.4-2.6-2l-1 3-3.4 1.9c-2.4 1.6-4 4-4.5 7l-.4 3.3 3.2 1.2 1.2-2 1.3.6-.8 2.2c-1.9 2.4-3 4.9-3.4 7.5z"/><circle cx="15.4" cy="22.2" r="1"/>',
  [BISHOP]:
    '<path d="M22.5 9a2.4 2.4 0 0 0-1.6 4.2c-2.6 1.4-5.2 4.6-5.2 8.6 0 3.1 1.7 5.3 3.6 6.8-1.1.6-2.1 1.4-2.8 2.4h12c-.7-1-1.7-1.8-2.8-2.4 1.9-1.5 3.6-3.7 3.6-6.8 0-4-2.6-7.2-5.2-8.6A2.4 2.4 0 0 0 22.5 9z"/><path d="M13.5 33c2-1.6 5-2.2 9-2.2s7 .6 9 2.2c0 2-2 3.4-3 3.9H16.5c-1-.5-3-1.9-3-3.9z"/><path d="M20.5 20.5h4M22.5 18v5" stroke-width="1.2" fill="none"/>',
  [QUEEN]:
    '<path d="M11 16a2 2 0 1 0-2-2 2 2 0 0 0 2 2zM34 16a2 2 0 1 0-2-2 2 2 0 0 0 2 2zM22.5 13a2 2 0 1 0-2-2 2 2 0 0 0 2 2zM17 16.5a1.7 1.7 0 1 0-1.7-1.7A1.7 1.7 0 0 0 17 16.5zM28 16.5a1.7 1.7 0 1 0-1.7-1.7A1.7 1.7 0 0 0 28 16.5z"/><path d="M11 16l3 14h17l3-14-5.5 5-3.5-9-3.5 9-5.5-5z"/><path d="M12.5 30c3-1.6 17-1.6 20 0l1.2 3.5c-3-1.6-19.4-1.6-22.4 0zM11.3 33.5c3-1.6 19.4-1.6 22.4 0V37H11.3z"/>',
  [KING]:
    '<path d="M22.5 8v3M20.5 9.5h4" stroke-width="1.5" fill="none"/><path d="M22.5 12c-2.6 0-4.6 5-1 7.5-3-.5-9 1-9 6.5 0 3 3 5 5.5 4.2 2-.6 3.6-2.1 4.5-3.7.9 1.6 2.5 3.1 4.5 3.7 2.5.8 5.5-1.2 5.5-4.2 0-5.5-6-7-9-6.5 3.6-2.5 1.6-7.5-1-7.5z"/><path d="M12.5 30.5c3-1.7 17.5-1.7 20 0v3.5c-3-1.7-17-1.7-20 0zM12.5 34.5c3-1.7 17-1.7 20 0V38h-20z"/>',
};

// Build a full <svg> string for a piece in the given color.
function build(color, type) {
  const fill = color === WHITE ? '#f5efe0' : '#33312e';
  const stroke = color === WHITE ? '#2a2724' : '#100f0d';
  const detail = color === WHITE ? '#2a2724' : '#d9d2c4';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" class="piece-svg" ` +
    `aria-hidden="true">` +
    `<g fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" ` +
    `stroke-linecap="round" style="--detail:${detail}">${SHAPES[type]}</g></svg>`
  );
}

export const PIECE_SVG = {
  [WHITE]: {
    [PAWN]: build(WHITE, PAWN),
    [KNIGHT]: build(WHITE, KNIGHT),
    [BISHOP]: build(WHITE, BISHOP),
    [ROOK]: build(WHITE, ROOK),
    [QUEEN]: build(WHITE, QUEEN),
    [KING]: build(WHITE, KING),
  },
  [BLACK]: {
    [PAWN]: build(BLACK, PAWN),
    [KNIGHT]: build(BLACK, KNIGHT),
    [BISHOP]: build(BLACK, BISHOP),
    [ROOK]: build(BLACK, ROOK),
    [QUEEN]: build(BLACK, QUEEN),
    [KING]: build(BLACK, KING),
  },
};

/** Return the SVG markup for a piece. */
export function pieceSvg(color, type) {
  return PIECE_SVG[color][type];
}

// Unicode fallbacks, handy for the captured tray at very small sizes.
export const PIECE_GLYPH = {
  [WHITE]: { [PAWN]: '♙', [KNIGHT]: '♘', [BISHOP]: '♗', [ROOK]: '♖', [QUEEN]: '♕', [KING]: '♔' },
  [BLACK]: { [PAWN]: '♟', [KNIGHT]: '♞', [BISHOP]: '♝', [ROOK]: '♜', [QUEEN]: '♛', [KING]: '♚' },
};
