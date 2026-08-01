// The voxel world: a fixed block volume, procedural terrain generation, and
// chunked face-culled meshing. Only faces exposed to air/water are emitted, and
// each face's color is pre-shaded by direction so a plain unlit material reads
// as Minecraft. Edits rebuild just the affected chunk (and a neighbor if the
// edit sits on a chunk border).

import * as THREE from 'three';
import { B, isOpaque, isSolid, isGravity, faceTile } from './blocks.js';
import { buildAtlas, COLS, ROWS } from './textures.js';

export const SX = 64;
export const SY = 40;
export const SZ = 64;
export const SEA = 14;
const CHUNK = 16;
const CX = SX / CHUNK;
const CZ = SZ / CHUNK;

// Face definitions: direction, face category (for color), corner offsets, shade.
const DIRS = [
  { d: [1, 0, 0], cat: 'side', c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], s: 0.72 },
  { d: [-1, 0, 0], cat: 'side', c: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]], s: 0.72 },
  { d: [0, 1, 0], cat: 'top', c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], s: 1.0 },
  { d: [0, -1, 0], cat: 'bottom', c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5 },
  { d: [0, 0, 1], cat: 'side', c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.86 },
  { d: [0, 0, -1], cat: 'side', c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], s: 0.86 },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class VoxelWorld {
  constructor() {
    this.data = new Uint8Array(SX * SY * SZ);
    this.group = new THREE.Group();
    const atlas = buildAtlas(); // procedural texture atlas (see textures.js)
    // vertexColors carry the per-face directional shade; the atlas map supplies
    // the texture — MeshBasic multiplies them (texture × shade).
    this.opaqueMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, side: THREE.DoubleSide });
    this.waterMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.78, depthWrite: false });
    // Glass: alphaTest discards the clear centre so you see through it, keeping
    // the frame; a distinct pass so it doesn't cull neighbours like opaque blocks.
    this.glassMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, side: THREE.DoubleSide, transparent: true, alphaTest: 0.3 });
    this.meshes = {}; // key `${cx},${cz}` -> { opaque, water }
    this._generate();
  }

  idx(x, y, z) { return x + z * SX + y * SX * SZ; }

  get(x, y, z) {
    if (y < 0) return B.STONE; // solid floor below the world
    if (y >= SY) return B.AIR;
    if (x < 0 || x >= SX || z < 0 || z >= SZ) return B.STONE; // solid walls at edges
    return this.data[this.idx(x, y, z)];
  }

  _set(x, y, z, t) {
    if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return;
    this.data[this.idx(x, y, z)] = t;
  }

  // Height of the ground column at (x,z).
  _height(x, z) {
    return Math.round(
      SEA + 3.5 * Math.sin(x * 0.15) * Math.cos(z * 0.13) +
      2.2 * Math.sin(x * 0.07 + 1) * Math.cos(z * 0.09 + 0.5) +
      1.2 * Math.sin(x * 0.29 + 2) * Math.cos(z * 0.24),
    );
  }

  _generate() {
    const rng = mulberry32(777);
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        const h = this._height(x, z);
        for (let y = 0; y <= h; y++) {
          let t;
          if (y < h - 3) {
            // Stone, occasionally with an ore vein (iron deeper, coal higher).
            t = B.STONE;
            const r = rng();
            if (r < 0.012 && y < SEA - 4) t = B.IRON_ORE;
            else if (r < 0.03) t = B.COAL_ORE;
            else if (r < 0.045) t = B.GRAVEL;
          } else if (y < h) {
            t = B.DIRT;
          } else {
            t = h < SEA + 1 ? B.SAND : h > SEA + 7 ? B.SNOW : B.GRASS; // beaches; snow caps
          }
          this._set(x, y, z, t);
        }
        for (let y = h + 1; y <= SEA; y++) this._set(x, y, z, B.WATER); // fill oceans
      }
    }
    // Scatter trees on grass above the water line.
    for (let i = 0; i < 90; i++) {
      const x = 2 + Math.floor(rng() * (SX - 4));
      const z = 2 + Math.floor(rng() * (SZ - 4));
      const h = this._height(x, z);
      if (h < SEA + 1) continue;
      this._tree(x, h + 1, z, rng);
    }
  }

  _tree(x, y, z, rng) {
    const trunk = 4 + Math.floor(rng() * 2);
    for (let i = 0; i < trunk; i++) this._set(x, y + i, z, B.WOOD);
    const top = y + trunk;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          if (this.get(x + dx, top + dy, z + dz) === B.AIR) this._set(x + dx, top + dy, z + dz, B.LEAVES);
        }
      }
    }
    this._set(x, top + 1, z, B.LEAVES);
  }

  build(scene) {
    for (let cx = 0; cx < CX; cx++) for (let cz = 0; cz < CZ; cz++) this._rebuild(cx, cz);
    scene.add(this.group);
  }

  _rebuild(cx, cz) {
    const key = `${cx},${cz}`;
    const old = this.meshes[key];
    if (old) {
      for (const m of [old.opaque, old.water, old.glass]) { if (m) { this.group.remove(m); m.geometry.dispose(); } }
    }
    const op = { pos: [], col: [], uv: [] };
    const wa = { pos: [], col: [], uv: [] };
    const gl = { pos: [], col: [], uv: [] };
    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;
    for (let x = x0; x < x0 + CHUNK; x++) {
      for (let z = z0; z < z0 + CHUNK; z++) {
        for (let y = 0; y < SY; y++) {
          const t = this.get(x, y, z);
          if (t === B.AIR) continue;
          const isWater = t === B.WATER;
          const glass = t === B.GLASS;
          for (const f of DIRS) {
            const n = this.get(x + f.d[0], y + f.d[1], z + f.d[2]);
            if (isWater) {
              if (n !== B.AIR) continue; // only water surfaces touching air
            } else if (glass) {
              if (isOpaque(n) || n === B.GLASS) continue; // hide behind opaque + adjacent glass
            } else if (isOpaque(n)) {
              continue; // hidden opaque face
            }
            this._pushFace(isWater ? wa : glass ? gl : op, x, y, z, f, t);
          }
        }
      }
    }
    const mk = (buf, mat) => {
      if (!buf.pos.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
      const m = new THREE.Mesh(g, mat);
      this.group.add(m);
      return m;
    };
    this.meshes[key] = { opaque: mk(op, this.opaqueMat), water: mk(wa, this.waterMat), glass: mk(gl, this.glassMat) };
  }

  _pushFace(buf, x, y, z, f, type) {
    const s = f.s; // directional shade, applied as a grey vertex colour
    const tile = faceTile(type, f.cat);
    const c = tile % COLS, r = Math.floor(tile / COLS);
    const u0 = c / COLS, v0 = 1 - (r + 1) / ROWS; // atlas rect (flipY texture)
    const uw = 1 / COLS, vh = 1 / ROWS;
    const uvC = [[0, 0], [0, 1], [1, 1], [1, 0]]; // per-corner tile UVs
    const order = [0, 1, 2, 0, 2, 3]; // two triangles
    for (const k of order) {
      const corner = f.c[k];
      buf.pos.push(x + corner[0], y + corner[1], z + corner[2]);
      buf.col.push(s, s, s);
      buf.uv.push(u0 + uvC[k][0] * uw, v0 + uvC[k][1] * vh);
    }
  }

  _rebuildAround(x, z) {
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    this._rebuild(cx, cz);
    const lx = x % CHUNK, lz = z % CHUNK;
    if (lx === 0 && cx > 0) this._rebuild(cx - 1, cz);
    if (lx === CHUNK - 1 && cx < CX - 1) this._rebuild(cx + 1, cz);
    if (lz === 0 && cz > 0) this._rebuild(cx, cz - 1);
    if (lz === CHUNK - 1 && cz < CZ - 1) this._rebuild(cx, cz + 1);
  }

  /** Place/remove a block, settle any gravity blocks, and rebuild chunk(s). */
  edit(x, y, z, t) {
    if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return;
    this._set(x, y, z, t);
    this._settle(x, z); // sand/gravel above may now fall
    this._rebuildAround(x, z);
  }

  // Let gravity blocks in a column fall into air/water below them. Runs bottom
  // -up so a whole sand stack settles in one pass.
  _settle(x, z) {
    for (let y = 1; y < SY; y++) {
      if (!isGravity(this.get(x, y, z))) continue;
      let ny = y;
      while (ny > 0) {
        const below = this.get(x, ny - 1, z);
        if (below === B.AIR || below === B.WATER) ny--;
        else break;
      }
      if (ny !== y) {
        const g = this.get(x, y, z);
        this._set(x, y, z, B.AIR);
        this._set(x, ny, z, g);
      }
    }
  }

  /** Ground height (first air above the surface) at a column, for spawning. */
  surfaceY(x, z) {
    for (let y = SY - 1; y >= 0; y--) if (isSolid(this.get(x, y, z))) return y + 1;
    return SEA + 1;
  }
}
