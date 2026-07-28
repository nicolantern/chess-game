// A Link-style hero built from low-poly primitives (green tunic + cap, blonde
// hair, pointy ears, cream leggings, brown boots, and a sword + shield on the
// back), cel-shaded to match the world. Procedural walk animation (swinging
// arms/legs) plus simple physics: gravity, jumping, terrain-following. The mesh
// origin sits at the feet, so `group.position.y` is the ground height.

import * as THREE from 'three';
import { heightAt, WORLD_SIZE, TOON_GRADIENT } from './world.js';

const GRAVITY = 22;
const WALK_SPEED = 7;
const SPRINT_SPEED = 13;
const JUMP_SPEED = 9;
const TURN_RATE = 12;
const EDGE = WORLD_SIZE / 2 - 6;

const COL = {
  tunic: '#2f7d34',
  cap: '#2b7530',
  skin: '#e7b98e',
  hair: '#c8a648',
  legging: '#d8cfa8',
  boot: '#5a3f26',
  belt: '#4a3320',
  steel: '#cdd6e2',
  gold: '#d7b23c',
  shieldBlue: '#2f57b0',
  shieldEdge: '#c9ccd2',
};

const mat = (color) => new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRADIENT });
const box = (w, h, d, color) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));

// A limb hanging from a pivot at its top, so rotating the pivot swings it from
// the shoulder/hip. Extra child meshes (a hand, a boot) can be added after.
function limb(w, h, d, color) {
  const pivot = new THREE.Group();
  const m = box(w, h, d, color);
  m.position.y = -h / 2;
  pivot.add(m);
  return pivot;
}

export class Character {
  constructor() {
    const g = new THREE.Group();

    // Legs (cream leggings) with brown boots attached so they swing together.
    const legL = limb(0.32, 0.7, 0.32, COL.legging);
    const legR = limb(0.32, 0.7, 0.32, COL.legging);
    for (const [leg, sx] of [[legL, -1], [legR, 1]]) {
      leg.position.set(0.2 * sx, 0.95, 0);
      const boot = box(0.36, 0.34, 0.44, COL.boot);
      boot.position.set(0, -0.7, 0.05);
      leg.add(boot);
    }

    // Torso: green tunic with a flared skirt and a brown belt.
    const torso = box(0.86, 0.8, 0.5, COL.tunic);
    torso.position.y = 1.42;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.66, 0.6, 8), mat(COL.tunic));
    skirt.position.y = 1.08;
    const belt = box(0.9, 0.14, 0.54, COL.belt);
    belt.position.y = 1.16;

    // Arms (green sleeves) with small skin hands.
    const armL = limb(0.24, 0.75, 0.24, COL.tunic);
    const armR = limb(0.24, 0.75, 0.24, COL.tunic);
    for (const [arm, sx] of [[armL, -1], [armR, 1]]) {
      arm.position.set(0.56 * sx, 1.7, 0);
      const hand = box(0.24, 0.2, 0.24, COL.skin);
      hand.position.y = -0.75;
      arm.add(hand);
    }

    // Head, hair, pointy ears, and the iconic long cap.
    const headGroup = new THREE.Group();
    headGroup.position.y = 2.02;
    const head = box(0.48, 0.5, 0.46, COL.skin);
    const hairBack = box(0.52, 0.32, 0.5, COL.hair);
    hairBack.position.set(0, 0.12, -0.06);
    const fringe = box(0.5, 0.14, 0.12, COL.hair);
    fringe.position.set(0, 0.16, 0.24);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 5), mat(COL.skin));
      ear.position.set(0.26 * sx, 0.02, -0.02);
      ear.rotation.z = (Math.PI / 2.1) * sx;
      headGroup.add(ear);
      const sideHair = box(0.1, 0.34, 0.4, COL.hair);
      sideHair.position.set(0.24 * sx, 0.0, -0.02);
      headGroup.add(sideHair);
    }
    // Cap: a base cone plus a long droopy tip trailing back.
    const capBase = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.5, 6), mat(COL.cap));
    capBase.position.y = 0.4;
    const capTip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 6), mat(COL.cap));
    capTip.position.set(0, 0.5, -0.5);
    capTip.rotation.x = Math.PI / 1.7;
    headGroup.add(head, hairBack, fringe, capBase, capTip);

    // Sword + shield slung on the back (−Z is the character's back).
    const gear = new THREE.Group();
    const shield = box(0.7, 0.9, 0.1, COL.shieldBlue);
    shield.position.set(-0.12, 1.5, -0.36);
    shield.rotation.set(0.15, 0, 0.15);
    const shieldRim = box(0.78, 0.98, 0.06, COL.shieldEdge);
    shieldRim.position.copy(shield.position);
    shieldRim.position.z -= 0.02;
    shieldRim.rotation.copy(shield.rotation);
    const strap = box(0.12, 1.3, 0.12, COL.belt);
    strap.position.set(0.15, 1.45, -0.1);
    strap.rotation.z = 0.5;
    // Master Sword: hilt + guard + blade, laid diagonally across the back.
    const sword = new THREE.Group();
    const blade = box(0.1, 1.15, 0.05, COL.steel);
    blade.position.y = 0.6;
    const guard = box(0.42, 0.1, 0.1, COL.gold);
    const hilt = box(0.09, 0.34, 0.09, COL.shieldBlue);
    hilt.position.y = -0.22;
    sword.add(blade, guard, hilt);
    sword.position.set(0.3, 1.5, -0.34);
    sword.rotation.set(0.2, 0, -0.7);
    gear.add(shieldRim, shield, strap, sword);

    g.add(legL, legR, torso, skirt, belt, armL, armR, headGroup, gear);
    this.mesh = g;
    this.limbs = { legL, legR, armL, armR };

    this.pos = new THREE.Vector3(0, heightAt(0, 0), 0);
    this.vy = 0;
    this.onGround = true;
    this.yaw = 0;
    this.walkPhase = 0;
    g.position.copy(this.pos);
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} moveDir  desired horizontal direction (unit or zero)
   * @param {boolean} jump
   * @param {boolean} sprint
   */
  update(dt, moveDir, jump, sprint) {
    const moving = moveDir.lengthSq() > 1e-4;
    const speed = sprint ? SPRINT_SPEED : WALK_SPEED;

    if (moving) {
      this.pos.x = THREE.MathUtils.clamp(this.pos.x + moveDir.x * speed * dt, -EDGE, EDGE);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z + moveDir.z * speed * dt, -EDGE, EDGE);
      const target = Math.atan2(moveDir.x, moveDir.z);
      let diff = target - this.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.yaw += diff * Math.min(1, TURN_RATE * dt);
    }

    if (jump && this.onGround) {
      this.vy = JUMP_SPEED;
      this.onGround = false;
    }
    this.vy -= GRAVITY * dt;
    this.pos.y += this.vy * dt;
    const ground = heightAt(this.pos.x, this.pos.z);
    if (this.pos.y <= ground) {
      this.pos.y = ground;
      this.vy = 0;
      this.onGround = true;
    }

    const amp = moving && this.onGround ? (sprint ? 1.1 : 0.8) : 0;
    this.walkPhase += (moving ? speed : 0) * dt * 1.1;
    const swing = Math.sin(this.walkPhase) * amp;
    this.limbs.legL.rotation.x = swing;
    this.limbs.legR.rotation.x = -swing;
    this.limbs.armL.rotation.x = -swing;
    this.limbs.armR.rotation.x = swing;

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
  }
}
