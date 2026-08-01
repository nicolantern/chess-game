// Procedural texture atlas. Each block face tile is drawn pixel-by-pixel onto a
// canvas at load (no image files to ship), packed into one atlas texture with
// nearest-neighbor filtering for a crisp Minecraft pixel look. world.js UV-maps
// each face to its tile via blocks.faceTile / TILE.

import * as THREE from 'three';
import { TILE } from './blocks.js';

const PX = 16; // tile is 16×16 pixels
export const COLS = 4;
export const ROWS = 4;

export function buildAtlas() {
  const cv = document.createElement('canvas');
  cv.width = COLS * PX;
  cv.height = ROWS * PX;
  const ctx = cv.getContext('2d');
  const rnd = (n) => (Math.random() * 2 - 1) * n;
  const org = (i) => [(i % COLS) * PX, Math.floor(i / COLS) * PX];
  const set = (ox, oy, x, y, r, g, b) => {
    ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r | 0))},${Math.max(0, Math.min(255, g | 0))},${Math.max(0, Math.min(255, b | 0))})`;
    ctx.fillRect(ox + x, oy + y, 1, 1);
  };
  // Fill a tile with a noisy base colour.
  const fill = (i, r, g, b, v, speckle = 0, sr = 0, sg = 0, sb = 0) => {
    const [ox, oy] = org(i);
    for (let y = 0; y < PX; y++) {
      for (let x = 0; x < PX; x++) {
        if (speckle && Math.random() < speckle) { set(ox, oy, x, y, sr, sg, sb); continue; }
        const d = rnd(v);
        set(ox, oy, x, y, r + d, g + d, b + d);
      }
    }
    return [ox, oy];
  };

  fill(TILE.GRASS_TOP, 96, 156, 74, 14, 0.08, 66, 120, 52);
  fill(TILE.DIRT, 124, 92, 58, 14, 0.05, 96, 70, 44);

  // Grass side: dirt with a green overhang along the top edge.
  {
    const [ox, oy] = fill(TILE.GRASS_SIDE, 124, 92, 58, 14);
    for (let x = 0; x < PX; x++) {
      const top = 3 + (Math.random() < 0.5 ? 1 : 0);
      for (let y = 0; y < top; y++) { const d = rnd(12); set(ox, oy, x, y, 96 + d, 156 + d, 74 + d); }
    }
  }

  fill(TILE.STONE, 140, 140, 140, 12, 0.05, 112, 112, 112);
  fill(TILE.SAND, 221, 208, 150, 10);

  // Wood top: concentric growth rings.
  {
    const [ox, oy] = org(TILE.WOOD_TOP);
    for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
      const r = Math.hypot(x - 7.5, y - 7.5);
      const ring = Math.sin(r * 1.7) * 10 + rnd(7);
      set(ox, oy, x, y, 152 + ring, 114 + ring, 66 + ring);
    }
  }
  // Wood side: vertical bark streaks.
  {
    const [ox, oy] = org(TILE.WOOD_SIDE);
    for (let x = 0; x < PX; x++) {
      const streak = rnd(16);
      for (let y = 0; y < PX; y++) { const d = rnd(7) + streak; set(ox, oy, x, y, 112 + d, 84 + d, 50 + d); }
    }
  }

  fill(TILE.LEAVES, 62, 142, 54, 18, 0.14, 34, 96, 34);

  // Planks: horizontal boards with staggered vertical seams.
  {
    const [ox, oy] = org(TILE.PLANK);
    for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
      let d = rnd(9);
      if (y % 5 === 0) d -= 28; // board gap
      if ((x + (Math.floor(y / 5) % 2 ? 8 : 0)) % 8 === 0) d -= 16; // vertical seam
      set(ox, oy, x, y, 183 + d, 143 + d, 86 + d);
    }
  }

  // Cobble: noisy grey with dark grout blobs.
  {
    const [ox, oy] = fill(TILE.COBBLE, 132, 132, 132, 10);
    for (let i = 0; i < 9; i++) {
      const cx = Math.random() * PX, cy = Math.random() * PX;
      for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
        if (Math.abs(x - cx) + Math.abs(y - cy) < 1.3) set(ox, oy, x, y, 74, 74, 74);
      }
    }
  }

  fill(TILE.WATER, 63, 134, 200, 12);

  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
