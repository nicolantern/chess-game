// The voxel world: a fixed block volume, procedural terrain generation, and
// chunked face-culled meshing. Only faces exposed to air/water are emitted, and
// each face's color is pre-shaded by direction so a plain unlit material reads
// as Minecraft. Edits rebuild just the affected chunk (and a neighbor if the
// edit sits on a chunk border).

import * as THREE from 'three';
import { B, isOpaque, isSolid, isGravity, faceTile } from './blocks.js';
import { buildAtlas, COLS, ROWS } from './textures.js';

export const SX = 160;
export const SY = 56;
export const SZ = 160;
export const SEA = 20;
const CHUNK = 16;
const CX = SX / CHUNK;
const CZ = SZ / CHUNK;

// --- Deterministic value noise (2D + 3D) for terrain, biomes, and caves ------
function hash2(x, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function noise2(x, z) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const u = smooth(x - x0), v = smooth(z - z0);
  return lerp(
    lerp(hash2(x0, z0), hash2(x0 + 1, z0), u),
    lerp(hash2(x0, z0 + 1), hash2(x0 + 1, z0 + 1), u),
    v,
  );
}
function noise3(x, y, z) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const u = smooth(x - x0), v = smooth(y - y0), w = smooth(z - z0);
  const c = (dx, dy, dz) => hash3(x0 + dx, y0 + dy, z0 + dz);
  const y00 = lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v);
  const y11 = lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v);
  return lerp(y00, y11, w);
}
function fbm2(x, z, oct) {
  let f = 0, a = 0.5, fr = 1;
  for (let i = 0; i < oct; i++) { f += noise2(x * fr, z * fr) * a; fr *= 2; a *= 0.5; }
  return f;
}
function fbm3(x, y, z, oct) {
  let f = 0, a = 0.5, fr = 1;
  for (let i = 0; i < oct; i++) { f += noise3(x * fr, y * fr, z * fr) * a; fr *= 2; a *= 0.5; }
  return f;
}

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

  // Ground height at a column: rolling hills + sharpened mountain peaks.
  _height(x, z) {
    const roll = fbm2(x * 0.014, z * 0.014, 4);
    const mount = Math.pow(fbm2(x * 0.0055 + 40, z * 0.0055, 4), 2.2);
    const cont = fbm2(x * 0.02 + 7, z * 0.02, 3);
    return Math.min(SY - 2, Math.floor(SEA - 6 + roll * 12 + mount * 40 + cont * 4));
  }

  // Biome from two low-frequency "temperature"/"moisture" fields.
  _biome(x, z) {
    const t = fbm2(x * 0.0045 + 100, z * 0.0045, 3);
    const m = fbm2(x * 0.0045, z * 0.0045 + 100, 3);
    if (t < 0.4) return 'snow';
    if (t > 0.6 && m < 0.45) return 'desert';
    if (m > 0.55) return 'forest';
    return 'plains';
  }

  _cave(x, y, z) {
    return fbm3(x * 0.055, y * 0.09, z * 0.055, 2) > 0.66;
  }

  _oreRng(x, y, z) {
    return hash3(x * 13 + 1, y * 13 + 7, z * 13 + 5);
  }

  _generate() {
    const rng = mulberry32(777);
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        const biome = this._biome(x, z);
        const h = this._height(x, z);
        for (let y = 0; y <= h; y++) {
          let t;
          if (y < h - 4) {
            t = B.STONE;
            const r = this._oreRng(x, y, z);
            if (y < 12 && r < 0.004) t = B.DIAMOND_ORE; // diamonds deep down
            else if (r < 0.01 && y < SEA - 4) t = B.IRON_ORE;
            else if (r < 0.028) t = B.COAL_ORE;
            else if (r < 0.04) t = B.GRAVEL;
          } else if (y < h) {
            t = biome === 'desert' ? B.SAND : B.DIRT;
          } else {
            // Surface block by biome / elevation.
            if (h <= SEA) t = B.SAND; // sea floor
            else if (h > SEA + 30) t = B.SNOW; // mountain cap
            else if (biome === 'desert') t = B.SAND;
            else if (biome === 'snow') t = B.SNOW;
            else if (h <= SEA + 1) t = B.SAND; // beach
            else t = B.GRASS;
          }
          if (y > 2 && y < h - 2 && this._cave(x, y, z)) t = B.AIR; // carve caves
          this._set(x, y, z, t);
        }
        for (let y = h + 1; y <= SEA; y++) this._set(x, y, z, B.WATER); // fill oceans
      }
    }
    // Trees, denser in forests, keeping canopies inside world bounds.
    for (let x = 2; x < SX - 2; x++) {
      for (let z = 2; z < SZ - 2; z++) {
        const biome = this._biome(x, z);
        if (biome === 'desert') continue;
        const h = this._height(x, z);
        if (h < SEA + 1) continue;
        const top = this.get(x, h, z);
        if (top !== B.GRASS && top !== B.SNOW) continue;
        const density = biome === 'forest' ? 0.06 : biome === 'snow' ? 0.02 : 0.014;
        if (hash2(x * 7 + 1, z * 7 + 3) < density) this._tree(x, h + 1, z, rng);
      }
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
