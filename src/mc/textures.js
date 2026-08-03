// Procedural texture atlas. Each block face tile is drawn pixel-by-pixel onto a
// canvas at load (no image files to ship), packed into one atlas texture with
// nearest-neighbor filtering for a crisp Minecraft pixel look. world.js UV-maps
// each face to its tile via blocks.faceTile / TILE.

import * as THREE from 'three';
import { TILE } from './blocks.js';

const PX = 16; // tile is 16×16 pixels
export const COLS = 8;
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

  // Gravel: noisy grey-brown with darker pebbles.
  {
    const [ox, oy] = fill(TILE.GRAVEL, 150, 142, 132, 16);
    for (let i = 0; i < 16; i++) set(ox, oy, (Math.random() * PX) | 0, (Math.random() * PX) | 0, 108, 102, 94);
  }
  // Coal ore: stone with black flecks.
  {
    const [ox, oy] = fill(TILE.COAL_ORE, 140, 140, 140, 12);
    for (let i = 0; i < 12; i++) { const x = (Math.random() * PX) | 0, y = (Math.random() * PX) | 0; set(ox, oy, x, y, 30, 30, 30); if (Math.random() < 0.5) set(ox, oy, (x + 1) % PX, y, 26, 26, 26); }
  }
  // Iron ore: stone with tan flecks.
  {
    const [ox, oy] = fill(TILE.IRON_ORE, 140, 140, 140, 12);
    for (let i = 0; i < 12; i++) { const x = (Math.random() * PX) | 0, y = (Math.random() * PX) | 0; set(ox, oy, x, y, 205, 160, 120); if (Math.random() < 0.5) set(ox, oy, x, (y + 1) % PX, 190, 148, 108); }
  }
  fill(TILE.SNOW, 236, 242, 248, 8);

  // Glass: clear centre (alphaTest discards it) with a light frame + shine.
  {
    const [ox, oy] = org(TILE.GLASS);
    ctx.clearRect(ox, oy, PX, PX);
    ctx.fillStyle = 'rgba(214,240,250,0.6)';
    for (let i = 0; i < PX; i++) { ctx.fillRect(ox + i, oy, 1, 1); ctx.fillRect(ox + i, oy + PX - 1, 1, 1); ctx.fillRect(ox, oy + i, 1, 1); ctx.fillRect(ox + PX - 1, oy + i, 1, 1); }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 2; i < 8; i++) ctx.fillRect(ox + i, oy + i, 1, 1);
  }

  // Diamond ore: stone with cyan gems.
  {
    const [ox, oy] = fill(TILE.DIAMOND_ORE, 140, 140, 140, 12);
    for (let i = 0; i < 10; i++) { const x = (Math.random() * PX) | 0, y = (Math.random() * PX) | 0; set(ox, oy, x, y, 120, 230, 220); if (Math.random() < 0.5) set(ox, oy, (x + 1) % PX, y, 90, 200, 195); }
  }
  fill(TILE.FURNACE_SIDE, 120, 120, 120, 10, 0.05, 96, 96, 96);
  // Furnace top: grey with a dark round vent.
  {
    const [ox, oy] = fill(TILE.FURNACE_TOP, 118, 118, 118, 10);
    for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) if (Math.hypot(x - 7.5, y - 7.5) < 3.5) set(ox, oy, x, y, 60, 60, 60);
  }
  // Furnace front: grey with a dark opening + orange glow at the bottom.
  {
    const [ox, oy] = fill(TILE.FURNACE_FRONT, 120, 120, 120, 10);
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) set(ox, oy, x, y, 40, 34, 30);
    for (let x = 5; x < 11; x++) { set(ox, oy, x, 12, 240, 150, 40); set(ox, oy, x, 13, 210, 90, 30); }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
