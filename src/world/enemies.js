// ChuChu-style slime enemies: green jelly blobs that wander, hop toward the hero
// when he's near, squish when they move, flash + get knocked back when struck,
// and pop when defeated (then respawn elsewhere after a delay). The manager owns
// the pool, updates them against the player, and reports contact for damage.

import * as THREE from 'three';
import { heightAt, WORLD_SIZE, TOON_GRADIENT } from './world.js';

const AGGRO = 15; // start chasing within this range
const SPEED = 3.4;
const CONTACT = 1.15; // touch distance that damages the hero
const EDGE = WORLD_SIZE / 2 - 8;
const RESPAWN = 5; // seconds after death

const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRADIENT, ...extra });

function randLandXZ() {
  for (let i = 0; i < 30; i++) {
    const x = (Math.random() - 0.5) * (WORLD_SIZE - 40);
    const z = (Math.random() - 0.5) * (WORLD_SIZE - 40);
    if (heightAt(x, z) > -0.5) return [x, z];
  }
  return [0, 0];
}

class ChuChu {
  constructor() {
    const g = new THREE.Group();
    this.body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 2), toon('#49b86a', { transparent: true, opacity: 0.9, emissive: new THREE.Color(0) }));
    this.body.geometry.scale(1, 0.85, 1);
    g.add(this.body);
    const white = toon('#ffffff');
    const black = new THREE.MeshBasicMaterial({ color: '#141414' });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), white);
      eye.position.set(0.18 * sx, 0.12, 0.5);
      const pup = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), black);
      pup.position.set(0.18 * sx, 0.12, 0.6);
      g.add(eye, pup);
    }
    this.mesh = g;
    this.vel = new THREE.Vector3();
    this.reset();
  }

  reset() {
    const [x, z] = randLandXZ();
    this.pos = new THREE.Vector3(x, heightAt(x, z), z);
    this.hp = 2;
    this.dead = false;
    this.deadT = 0;
    this.facing = Math.random() * Math.PI * 2;
    this.hopTime = Math.random() * 10;
    this.wanderT = 0;
    this.wanderDir = this.facing;
    this.flash = 0;
    this.vel.set(0, 0, 0);
    this.mesh.visible = true;
    this.mesh.scale.setScalar(1);
    this.mesh.position.copy(this.pos);
  }

  hit(dir) {
    if (this.dead) return false;
    this.hp -= 1;
    this.flash = 0.2;
    this.vel.addScaledVector(dir, 9);
    if (this.hp <= 0) {
      this.dead = true;
      this.deadT = 0;
      return true; // defeated
    }
    return false;
  }

  update(dt, playerPos, tmp) {
    if (this.dead) {
      this.deadT += dt;
      const k = Math.max(0, 1 - this.deadT / 0.3);
      this.mesh.scale.set(k * (1 + (1 - k)), k * 0.5, k * (1 + (1 - k)));
      if (this.deadT >= RESPAWN) this.reset();
      return false;
    }

    tmp.subVectors(playerPos, this.pos);
    tmp.y = 0;
    const d = tmp.length();
    const chasing = d < AGGRO;
    if (chasing && d > 0.001) {
      tmp.normalize();
      this.pos.addScaledVector(tmp, SPEED * dt);
      this.facing = Math.atan2(tmp.x, tmp.z);
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderDir = Math.random() * Math.PI * 2; this.wanderT = 2 + Math.random() * 3; }
      this.pos.x += Math.sin(this.wanderDir) * SPEED * 0.35 * dt;
      this.pos.z += Math.cos(this.wanderDir) * SPEED * 0.35 * dt;
      this.facing = this.wanderDir;
    }
    // knockback + damping
    this.pos.addScaledVector(this.vel, dt);
    this.vel.multiplyScalar(Math.pow(0.02, dt));
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -EDGE, EDGE);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -EDGE, EDGE);

    // Hop + jelly squash.
    this.hopTime += dt * (chasing ? 8 : 4);
    const hop = Math.abs(Math.sin(this.hopTime)) * (chasing ? 0.55 : 0.28);
    const squash = 1 - Math.cos(this.hopTime) * 0.12;
    this.mesh.position.set(this.pos.x, heightAt(this.pos.x, this.pos.z) + hop, this.pos.z);
    this.mesh.rotation.y = this.facing;
    this.mesh.scale.set(1 / squash, squash, 1 / squash);

    // Hit flash.
    if (this.flash > 0) {
      this.flash -= dt;
      this.body.material.emissive.setScalar(Math.max(0, this.flash * 4));
    }
    return d < CONTACT; // contact damages the hero
  }
}

export class Enemies {
  constructor(scene, count = 7) {
    this.list = [];
    for (let i = 0; i < count; i++) {
      const e = new ChuChu();
      this.list.push(e);
      scene.add(e.mesh);
    }
    this._tmp = new THREE.Vector3();
  }

  /**
   * Move all enemies. Returns a unit knockback direction (from the touching
   * enemy toward the hero) if any alive enemy is in contact, else null.
   */
  update(dt, playerPos) {
    let contactDir = null;
    for (const e of this.list) {
      if (e.update(dt, playerPos, this._tmp)) {
        contactDir = new THREE.Vector3().subVectors(playerPos, e.pos);
        contactDir.y = 0;
        contactDir.normalize();
      }
    }
    return contactDir;
  }

  /**
   * Apply a sword hit: damage every alive enemy within `range` and inside the
   * forward-facing arc. Returns the number defeated this call.
   * @param {THREE.Vector3} origin  hero position
   * @param {THREE.Vector3} forward hero facing (unit)
   */
  strike(origin, forward, range = 2.6) {
    let defeated = 0;
    const v = this._tmp;
    for (const e of this.list) {
      if (e.dead) continue;
      v.subVectors(e.pos, origin);
      v.y = 0;
      const d = v.length();
      if (d > range || d < 0.001) continue;
      v.normalize();
      if (v.dot(forward) < 0.25) continue; // must be in front
      const knock = v.clone();
      if (e.hit(knock)) defeated++;
    }
    return defeated;
  }
}
