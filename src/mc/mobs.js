// Mobs: low-poly box creatures with simple steering AI, gravity + surface
// following, walk animation, and per-type behavior — a passive Cow that wanders
// and flees when hit, and hostile Zombie (melee), Creeper (approaches then
// explodes, cratering blocks), and Skeleton (shoots arrows). The manager spawns
// passives by day and hostiles by night around the player, updates everything,
// handles arrows and XP orbs, and resolves the player's melee swing.

import * as THREE from 'three';
import { B, isSolid } from './blocks.js';
import { I } from './items.js';
import { SY } from './world.js';

const GRAVITY = 24;
const MAX_MOBS = 14;

const mat = (color) => new THREE.MeshBasicMaterial({ color });
const box = (w, h, d, color) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));

// Shared face materials.
const FBLACK = mat('#161616');
const FWHITE = mat('#efe9df');
const FPINK = mat('#df9a9a');
const FRED = mat('#c23a3a');

// Thin plate stuck on a head face (front is +Z).
function plate(head, w, h, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), material);
  m.position.set(x, y, z);
  head.add(m);
}

// Add eyes/mouth to a head, keyed by mob kind. `hs` is the head edge length.
function faceOn(head, hs, kind) {
  const f = hs / 2 + 0.012; // just proud of the front face
  if (kind === 'creeper') {
    plate(head, 0.17, 0.17, FBLACK, -0.15, 0.1, f);
    plate(head, 0.17, 0.17, FBLACK, 0.15, 0.1, f);
    plate(head, 0.14, 0.3, FBLACK, 0, -0.06, f);
    plate(head, 0.13, 0.13, FBLACK, -0.13, -0.24, f);
    plate(head, 0.13, 0.13, FBLACK, 0.13, -0.24, f);
  } else if (kind === 'skeleton') {
    plate(head, 0.14, 0.14, FBLACK, -0.13, 0.05, f);
    plate(head, 0.14, 0.14, FBLACK, 0.13, 0.05, f);
    plate(head, 0.3, 0.05, FBLACK, 0, -0.17, f);
  } else if (kind === 'zombie') {
    plate(head, 0.13, 0.11, FBLACK, -0.13, 0.06, f);
    plate(head, 0.13, 0.11, FBLACK, 0.13, 0.06, f);
    plate(head, 0.07, 0.07, FRED, -0.13, 0.06, f + 0.006); // sunken red glint
    plate(head, 0.07, 0.07, FRED, 0.13, 0.06, f + 0.006);
    plate(head, 0.26, 0.05, FBLACK, 0, -0.15, f);
  } else if (kind === 'pig') {
    plate(head, 0.08, 0.08, FBLACK, -0.14, 0.1, f);
    plate(head, 0.08, 0.08, FBLACK, 0.14, 0.1, f);
    plate(head, 0.26, 0.2, FPINK, 0, -0.1, f + 0.005); // big snout
    plate(head, 0.05, 0.07, FBLACK, -0.06, -0.1, f + 0.012);
    plate(head, 0.05, 0.07, FBLACK, 0.06, -0.1, f + 0.012);
  } else if (kind === 'sheep') {
    plate(head, 0.09, 0.09, FBLACK, -0.13, 0.07, f);
    plate(head, 0.09, 0.09, FBLACK, 0.13, 0.07, f);
    plate(head, 0.22, 0.05, FBLACK, 0, -0.14, f);
  } else { // cow
    plate(head, 0.12, 0.12, FWHITE, -0.15, 0.08, f);
    plate(head, 0.12, 0.12, FWHITE, 0.15, 0.08, f);
    plate(head, 0.06, 0.06, FBLACK, -0.15, 0.08, f + 0.006);
    plate(head, 0.06, 0.06, FBLACK, 0.15, 0.08, f + 0.006);
    plate(head, 0.32, 0.18, FPINK, 0, -0.14, f);
    plate(head, 0.05, 0.05, FBLACK, -0.07, -0.14, f + 0.006);
    plate(head, 0.05, 0.05, FBLACK, 0.07, -0.14, f + 0.006);
    const horn = (sx) => { const h = box(0.1, 0.12, 0.1, '#e8e2d2'); h.position.set(0.16 * sx, hs / 2 + 0.02, -0.02); head.add(h); };
    horn(-1); horn(1);
  }
}

// Height of the first air block above the surface at a column.
function groundTop(world, x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  for (let y = SY - 1; y >= 0; y--) if (isSolid(world.get(ix, y, iz))) return y + 1;
  return 0;
}

// --- Mob type definitions -------------------------------------------------
// shape 'quad' (cow) or 'biped' (humanoids). behavior handled per `hostile`.
const TYPES = {
  cow: { hostile: false, hp: 8, speed: 1.6, shape: 'quad', face: 'cow', body: '#6a4a34', head: '#e9e2d6', bw: 0.7, bh: 0.7, bl: 1.1, hs: 0.5, legLen: 0.7, xp: 2, drop: { id: I.RAW_BEEF, min: 1, max: 3 } },
  pig: { hostile: false, hp: 8, speed: 1.7, shape: 'quad', face: 'pig', body: '#e79aa0', head: '#eaa6ac', bw: 0.68, bh: 0.66, bl: 1.02, hs: 0.5, legLen: 0.55, xp: 2, drop: { id: I.RAW_PORK, min: 1, max: 3 } },
  sheep: { hostile: false, hp: 8, speed: 1.4, shape: 'quad', face: 'sheep', body: '#ececec', head: '#dcd6ca', bw: 0.78, bh: 0.82, bl: 1.0, hs: 0.46, legLen: 0.5, xp: 2, drop: { id: I.RAW_MUTTON, min: 1, max: 2 } },
  zombie: { hostile: true, kind: 'melee', hp: 10, speed: 2.6, shape: 'biped', face: 'zombie', body: '#3f7a4a', head: '#5a8a5a', legcol: '#3a4a7a', xp: 3, dmg: 3, reach: 1.35 },
  skeleton: { hostile: true, kind: 'ranged', hp: 8, speed: 2.4, shape: 'biped', face: 'skeleton', body: '#d8d8d0', head: '#e6e6de', legcol: '#c9c9c1', xp: 3, range: 13, dmg: 2 },
  creeper: { hostile: true, kind: 'boom', hp: 8, speed: 2.7, shape: 'creeper', face: 'creeper', body: '#4fa64f', head: '#57b257', xp: 4 },
};

function buildMesh(cfg) {
  const g = new THREE.Group();
  const legs = [];
  if (cfg.shape === 'quad') {
    const body = box(cfg.bw, cfg.bh, cfg.bl, cfg.body);
    body.position.y = cfg.legLen + cfg.bh / 2;
    const head = box(cfg.hs, cfg.hs, cfg.hs, cfg.head);
    head.position.set(0, cfg.legLen + cfg.bh * 0.7, cfg.bl / 2 + cfg.hs / 2);
    g.add(body, head);
    faceOn(head, cfg.hs, cfg.face);
    const lx = cfg.bw / 2 - 0.12, lz = cfg.bl / 2 - 0.14;
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const p = new THREE.Group();
      p.position.set(lx * sx, cfg.legLen, lz * sz);
      const leg = box(0.22, cfg.legLen, 0.22, cfg.body);
      leg.position.y = -cfg.legLen / 2;
      p.add(leg);
      g.add(p);
      legs.push(p);
    }
  } else if (cfg.shape === 'creeper') {
    const body = box(0.5, 1.1, 0.34, cfg.body);
    body.position.y = 0.3 + 0.55;
    const head = box(0.52, 0.52, 0.52, cfg.head);
    head.position.y = 0.3 + 1.1 + 0.26;
    g.add(body, head);
    faceOn(head, 0.52, 'creeper');
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const p = new THREE.Group();
      p.position.set(0.16 * sx, 0.3, 0.14 * sz);
      const leg = box(0.24, 0.3, 0.24, cfg.body);
      leg.position.y = -0.15;
      p.add(leg);
      g.add(p);
      legs.push(p);
    }
  } else { // biped
    const body = box(0.5, 0.7, 0.28, cfg.body);
    body.position.y = 0.7 + 0.35;
    const head = box(0.5, 0.5, 0.5, cfg.head);
    head.position.y = 0.7 + 0.7 + 0.25;
    g.add(body, head);
    faceOn(head, 0.5, cfg.face);
    for (const sx of [-1, 1]) {
      const p = new THREE.Group();
      p.position.set(0.14 * sx, 0.7, 0);
      const leg = box(0.22, 0.7, 0.22, cfg.legcol || cfg.body);
      leg.position.y = -0.35;
      p.add(leg);
      g.add(p);
      legs.push(p);
      const arm = box(0.18, 0.6, 0.18, cfg.body); // arms reaching forward
      arm.position.set(0.34 * sx, 1.1, 0.14);
      arm.rotation.x = -1.4;
      g.add(arm);
    }
  }
  return { group: g, legs };
}

class Mob {
  constructor(type, x, z, world) {
    this.type = type;
    this.cfg = TYPES[type];
    const built = buildMesh(this.cfg);
    this.mesh = built.group;
    this.legs = built.legs;
    this.pos = new THREE.Vector3(x, groundTop(world, x, z), z);
    this.vy = 0;
    this.hp = this.cfg.hp;
    this.yaw = Math.random() * Math.PI * 2;
    this.wanderT = 0;
    this.walk = 0;
    this.flee = 0;
    this.cool = 0; // attack cooldown
    this.fuse = -1; // creeper fuse
    this.flash = 0;
    this.dead = false;
    this.mesh.position.copy(this.pos);
  }

  hit(dmg, dx, dz) {
    this.hp -= dmg;
    this.flash = 0.15;
    this.flee = 4; // passives run; also nudges hostiles back
    this.pos.x += dx * 0.8;
    this.pos.z += dz * 0.8;
    if (this.hp <= 0) this.dead = true;
  }

  update(dt, ctx) {
    const { playerPos, world } = ctx;
    const cfg = this.cfg;
    const dxp = playerPos.x - this.pos.x;
    const dzp = playerPos.z - this.pos.z;
    const dist = Math.hypot(dxp, dzp);
    let dirx = 0, dirz = 0;
    this.cool -= dt;
    if (this.flee > 0) this.flee -= dt;

    if (cfg.hostile && this.flee <= 0) {
      // Chase / behave by kind.
      if (cfg.kind === 'ranged') {
        if (dist > 6) { dirx = dxp; dirz = dzp; } // close to firing range
        if (dist < 13 && this.cool <= 0) { ctx.shoot(this.pos, playerPos); this.cool = 2; }
      } else if (cfg.kind === 'boom') {
        if (dist > 1.8) { dirx = dxp; dirz = dzp; }
        else if (this.fuse < 0) { this.fuse = 1.4; ctx.sfx('hiss'); }
        if (this.fuse >= 0) {
          this.fuse -= dt;
          this.flash = (Math.sin(performance.now() / 60) > 0) ? 0.15 : 0; // blink
          if (this.fuse <= 0 || dist > 5) {
            if (dist < 5) ctx.explode(this.pos, dist);
            this.dead = true;
          }
        }
      } else { // melee
        dirx = dxp; dirz = dzp;
        if (dist < cfg.reach && this.cool <= 0) { ctx.hurtPlayer(cfg.dmg, 'zombie'); this.cool = 0.8; }
      }
    } else {
      // Wander (and flee: move away from player).
      if (this.flee > 0) { dirx = -dxp; dirz = -dzp; }
      else {
        this.wanderT -= dt;
        if (this.wanderT <= 0) { this.yaw = Math.random() * Math.PI * 2; this.wanderT = 2 + Math.random() * 3; }
        dirx = Math.sin(this.yaw); dirz = Math.cos(this.yaw);
      }
    }

    const len = Math.hypot(dirx, dirz);
    const moving = len > 0.001;
    if (moving) {
      dirx /= len; dirz /= len;
      const spd = cfg.speed * (this.flee > 0 ? 1.4 : 1);
      this.pos.x += dirx * spd * dt;
      this.pos.z += dirz * spd * dt;
      this.yaw = Math.atan2(dirx, dirz);
    }

    // Surface follow: climb hills, fall off edges.
    const gy = groundTop(world, this.pos.x, this.pos.z);
    if (this.pos.y < gy) { this.pos.y = gy; this.vy = 0; }
    else {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gy) { this.pos.y = gy; this.vy = 0; }
    }

    // Animation + flash.
    this.walk += (moving ? cfg.speed : 0) * dt * 2.2;
    const sw = Math.sin(this.walk) * 0.7;
    for (let i = 0; i < this.legs.length; i++) this.legs[i].rotation.x = i % 2 ? -sw : sw;
    if (this.flash > 0) this.flash -= dt;

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    this.mesh.scale.setScalar(this.flash > 0 ? 1.1 : 1);
  }
}

// --- Manager --------------------------------------------------------------
export class Mobs {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.arrows = [];
    this.orbs = [];
    this.spawnT = 2;
    this._v = new THREE.Vector3();
  }

  _spawn(type, playerPos) {
    if (this.list.length >= MAX_MOBS) return;
    const a = Math.random() * Math.PI * 2;
    const r = 16 + Math.random() * 14;
    const x = playerPos.x + Math.cos(a) * r;
    const z = playerPos.z + Math.sin(a) * r;
    const m = new Mob(type, x, z, this.world);
    this.list.push(m);
    this.scene.add(m.mesh);
  }

  /** Remove all mobs, arrows, and orbs (e.g. on respawn). */
  clear() {
    for (const m of this.list) this.scene.remove(m.mesh);
    for (const a of this.arrows) this.scene.remove(a.mesh);
    for (const o of this.orbs) this.scene.remove(o.mesh);
    this.list = []; this.arrows = []; this.orbs = [];
    this.spawnT = 6;
  }

  /** Spawn a specific mob at explicit coords (used by tests/spawn eggs). */
  spawnAt(type, x, z) {
    const m = new Mob(type, x, z, this.world);
    this.list.push(m);
    this.scene.add(m.mesh);
    return m;
  }

  _orb(pos, xp) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), mat('#8ef04a'));
    mesh.position.set(pos.x, pos.y + 0.4, pos.z);
    this.scene.add(mesh);
    this.orbs.push({ mesh, xp, t: 0 });
  }

  shoot(from, to) {
    const dir = this._v.set(to.x - from.x, to.y + 1 - (from.y + 1.2), to.z - from.z).normalize();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), mat('#c9c9c1'));
    mesh.position.set(from.x, from.y + 1.2, from.z);
    this.scene.add(mesh);
    this.arrows.push({ mesh, vx: dir.x * 22, vy: dir.y * 22, vz: dir.z * 22, life: 3 });
    if (this._sfx) this._sfx('bow');
  }

  update(dt, ctx) {
    // Spawning: passives by day, hostiles by night, around the player.
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = ctx.isNight ? 2.5 : 5;
      const type = ctx.isNight
        ? ['zombie', 'zombie', 'skeleton', 'creeper'][(Math.random() * 4) | 0]
        : ['cow', 'pig', 'sheep'][(Math.random() * 3) | 0];
      this._spawn(type, ctx.playerPos);
    }

    this._sfx = ctx.sfx;
    const mctx = {
      playerPos: ctx.playerPos,
      world: this.world,
      sfx: ctx.sfx,
      hurtPlayer: ctx.hurtPlayer,
      shoot: (f, t) => this.shoot(f, t),
      explode: (p, d) => { ctx.hurtPlayer(Math.max(1, Math.round(6 - d)), 'creeper'); ctx.sfx('boom'); this._crater(p); },
    };
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      m.update(dt, mctx);
      const far = Math.hypot(m.pos.x - ctx.playerPos.x, m.pos.z - ctx.playerPos.z) > 70;
      if (m.dead || far) {
        if (m.dead) {
          this._orb(m.pos, m.cfg.xp);
          ctx.sfx('die');
          const d = m.cfg.drop;
          if (d && ctx.giveItem) ctx.giveItem(d.id, d.min + Math.floor(Math.random() * (d.max - d.min + 1)));
        }
        this.scene.remove(m.mesh);
        this.list.splice(i, 1);
      }
    }

    // Arrows.
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      a.vy -= 9 * dt;
      a.mesh.position.x += a.vx * dt;
      a.mesh.position.y += a.vy * dt;
      a.mesh.position.z += a.vz * dt;
      a.mesh.lookAt(a.mesh.position.x + a.vx, a.mesh.position.y + a.vy, a.mesh.position.z + a.vz);
      const dp = a.mesh.position.distanceTo(ctx.playerPos.clone().setY(ctx.playerPos.y + 0.9));
      if (dp < 0.8) { ctx.hurtPlayer(2, 'skeleton'); a.life = 0; }
      if (a.life <= 0 || a.mesh.position.y < groundTop(this.world, a.mesh.position.x, a.mesh.position.z) - 1) {
        this.scene.remove(a.mesh);
        this.arrows.splice(i, 1);
      }
    }

    // XP orbs drift to the player and are collected.
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.t += dt;
      const d = Math.hypot(o.mesh.position.x - ctx.playerPos.x, o.mesh.position.z - ctx.playerPos.z);
      if (d < 4) {
        o.mesh.position.lerp(ctx.playerPos.clone().setY(ctx.playerPos.y + 0.6), Math.min(1, dt * 6));
      }
      o.mesh.rotation.y += dt * 3;
      if (d < 0.9) { ctx.gainXp(o.xp); ctx.sfx('orb'); this.scene.remove(o.mesh); this.orbs.splice(i, 1); }
    }
  }

  _crater(pos) {
    const cx = Math.floor(pos.x), cy = Math.floor(pos.y), cz = Math.floor(pos.z);
    for (let dx = -2; dx <= 2; dx++)
      for (let dy = -2; dy <= 2; dy++)
        for (let dz = -2; dz <= 2; dz++)
          if (dx * dx + dy * dy + dz * dz <= 6) this.world.edit(cx + dx, cy + dy, cz + dz, B.AIR);
  }

  /** Resolve a player melee swing: hit the closest mob in front within reach. */
  tryAttack(origin, dir, reach, damage) {
    let best = null, bestT = reach;
    for (const m of this.list) {
      const cx = m.pos.x - origin.x, cy = m.pos.y + 0.8 - origin.y, cz = m.pos.z - origin.z;
      const t = cx * dir.x + cy * dir.y + cz * dir.z; // distance along the view ray
      if (t < 0 || t > reach) continue;
      const px = origin.x + dir.x * t, py = origin.y + dir.y * t, pz = origin.z + dir.z * t;
      const off = Math.hypot(m.pos.x - px, m.pos.y + 0.8 - py, m.pos.z - pz);
      if (off < 0.8 && t < bestT + 0.8) { best = m; bestT = t; }
    }
    if (best) {
      const dx = best.pos.x - origin.x, dz = best.pos.z - origin.z;
      const l = Math.hypot(dx, dz) || 1;
      best.hit(damage, dx / l, dz / l);
      return true;
    }
    return false;
  }
}
