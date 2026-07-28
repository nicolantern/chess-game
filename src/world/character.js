// A low-poly humanoid built from box primitives (no external model needed), with
// a procedural walk animation (swinging arms/legs) and simple physics: gravity,
// jumping, and following the terrain height. The mesh origin sits at the feet, so
// `group.position.y` is the ground height under the character.

import * as THREE from 'three';
import { heightAt, WORLD_SIZE } from './world.js';

const GRAVITY = 22;
const WALK_SPEED = 7;
const SPRINT_SPEED = 13;
const JUMP_SPEED = 9;
const TURN_RATE = 12; // how quickly the body rotates to face travel direction
const EDGE = WORLD_SIZE / 2 - 6;

function box(w, h, d, color) {
  const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

// A limb hanging from a pivot at its top, so rotating the pivot swings it from
// the shoulder/hip. Returns the pivot (add it to the body at the joint height).
function limb(w, h, d, color) {
  const pivot = new THREE.Group();
  const mesh = box(w, h, d, color);
  mesh.position.y = -h / 2; // hang below the pivot
  pivot.add(mesh);
  return pivot;
}

export class Character {
  constructor() {
    const skin = '#e8b98c';
    const shirt = '#2f6fd0';
    const pants = '#33384a';

    const g = new THREE.Group();

    const legL = limb(0.34, 0.95, 0.34, pants);
    const legR = limb(0.34, 0.95, 0.34, pants);
    legL.position.set(-0.22, 0.95, 0);
    legR.position.set(0.22, 0.95, 0);

    const torso = box(0.9, 0.85, 0.5, shirt);
    torso.position.y = 1.4;

    const armL = limb(0.26, 0.8, 0.26, shirt);
    const armR = limb(0.26, 0.8, 0.26, shirt);
    armL.position.set(-0.58, 1.75, 0);
    armR.position.set(0.58, 1.75, 0);

    const head = box(0.5, 0.5, 0.5, skin);
    head.position.y = 2.12;

    g.add(legL, legR, torso, armL, armR, head);
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
   * @param {number} dt        seconds since last frame
   * @param {THREE.Vector3} moveDir  desired horizontal direction (unit or zero), world space
   * @param {boolean} jump     jump requested this frame
   * @param {boolean} sprint   sprint held
   */
  update(dt, moveDir, jump, sprint) {
    const moving = moveDir.lengthSq() > 1e-4;
    const speed = sprint ? SPRINT_SPEED : WALK_SPEED;

    if (moving) {
      this.pos.x += moveDir.x * speed * dt;
      this.pos.z += moveDir.z * speed * dt;
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -EDGE, EDGE);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -EDGE, EDGE);
      // Rotate the body toward the travel direction (shortest way around).
      const target = Math.atan2(moveDir.x, moveDir.z);
      let diff = target - this.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.yaw += diff * Math.min(1, TURN_RATE * dt);
    }

    // Vertical: gravity + jump + land on the terrain.
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

    // Walk cycle: swing limbs while moving on the ground; ease back to rest otherwise.
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
