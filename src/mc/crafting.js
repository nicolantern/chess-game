// Crafting recipe matching for a 3×3 grid (row-major, length 9, ids or null).
// Supports shapeless recipes (multiset of ingredients) and shaped recipes
// (a pattern compared after trimming both to their bounding box, so placement
// within the grid doesn't matter). Crafting consumes one item from each filled
// grid cell; the output count comes from the recipe.

import { B } from './blocks.js';
import { I } from './items.js';

const P = B.PLANK, C = B.COBBLE, S = I.STICK, N = null;

// Trim a size×size grid to the bounding box of its non-null cells.
function bbox(cells, size) {
  let minR = size, maxR = -1, minC = size, maxC = -1;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (cells[r * size + c] != null) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
  }
  if (maxR < 0) return { w: 0, h: 0, cells: [] };
  const w = maxC - minC + 1, h = maxR - minR + 1, out = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) out.push(cells[(minR + r) * size + (minC + c)] ?? null);
  return { w, h, cells: out };
}

// Shaped recipes: pattern rows (already tight) + output.
const RAW_SHAPED = [
  { out: { id: I.STICK, count: 4 }, pat: [[P], [P]] },
  { out: { id: I.WOOD_PICK, count: 1 }, pat: [[P, P, P], [N, S, N], [N, S, N]] },
  { out: { id: I.WOOD_AXE, count: 1 }, pat: [[P, P], [P, S], [N, S]] },
  { out: { id: I.WOOD_SHOVEL, count: 1 }, pat: [[P], [S], [S]] },
  { out: { id: I.WOOD_SWORD, count: 1 }, pat: [[P], [P], [S]] },
  { out: { id: I.STONE_PICK, count: 1 }, pat: [[C, C, C], [N, S, N], [N, S, N]] },
  { out: { id: I.STONE_AXE, count: 1 }, pat: [[C, C], [C, S], [N, S]] },
  { out: { id: I.STONE_SHOVEL, count: 1 }, pat: [[C], [S], [S]] },
  { out: { id: I.STONE_SWORD, count: 1 }, pat: [[C], [C], [S]] },
];
const SHAPED = RAW_SHAPED.map((r) => ({
  out: r.out,
  w: r.pat[0].length,
  h: r.pat.length,
  cells: r.pat.flat().map((v) => v ?? null),
}));

const SHAPELESS = [
  { out: { id: B.PLANK, count: 4 }, need: [B.WOOD] },
];

const sortedIds = (a) => a.slice().sort((x, y) => x - y);
function sameMulti(a, b) {
  if (a.length !== b.length) return false;
  const A = sortedIds(a), Bb = sortedIds(b);
  return A.every((v, i) => v === Bb[i]);
}

/** Return the crafting output for a 3×3 grid (length 9), or null. */
export function craftResult(cells) {
  const ids = cells.filter((c) => c != null);
  if (!ids.length) return null;
  for (const r of SHAPELESS) if (sameMulti(ids, r.need)) return r.out;
  const g = bbox(cells, 3);
  for (const r of SHAPED) {
    if (r.w !== g.w || r.h !== g.h) continue;
    let ok = true;
    for (let i = 0; i < r.cells.length; i++) if ((r.cells[i] ?? null) !== (g.cells[i] ?? null)) { ok = false; break; }
    if (ok) return r.out;
  }
  return null;
}
