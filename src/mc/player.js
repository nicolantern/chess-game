// First-person controller: an AABB body (0.6 wide, 1.8 tall) with gravity, jump,
// and axis-by-axis collision resolution against solid voxels. It owns the camera
// (placed at eye height) and its yaw/pitch, which main.js drives from the mouse.

import * as THREE from 'three';
import { isSolid } from './blocks.js';
import { SX, SZ } from './world.js';

const GRAVITY = 26;
const JUMP = 8.6;
const WALK = 5.2;
const SPRINT = 9;
const HALF = 0.3; // half body width
const HEIGHT = 1.8;
const EYE = 1.62;
const MAX_PITCH = Math.PI / 2 - 0.05;

export class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.yaw = 0.6;
    this.pitch = -0.2;
    this.vy = 0;
    this.onGround = false;
    this.wasOnGround = true;
    this.apexY = 0; // highest point since leaving the ground
    this.landedFall = 0; // blocks fallen on the frame we land (0 otherwise)
    const cx = Math.floor(SX / 2) + 0.5;
    const cz = Math.floor(SZ / 2) + 0.5;
    this.pos = new THREE.Vector3(cx, world.surfaceY(Math.floor(cx), Math.floor(cz)) + 0.5, cz);
    this._syncCamera();
  }

  respawn() {
    const cx = Math.floor(SX / 2) + 0.5;
    const cz = Math.floor(SZ / 2) + 0.5;
    this.pos.set(cx, this.world.surfaceY(Math.floor(cx), Math.floor(cz)) + 0.5, cz);
    this.vy = 0;
    this.apexY = this.pos.y;
    this.wasOnGround = true;
    this._syncCamera();
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0025;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0025, -MAX_PITCH, MAX_PITCH);
  }

  _collides(px, py, pz) {
    const x0 = Math.floor(px - HALF), x1 = Math.floor(px + HALF);
    const z0 = Math.floor(pz - HALF), z1 = Math.floor(pz + HALF);
    const y0 = Math.floor(py + 0.001), y1 = Math.floor(py + HEIGHT - 0.001);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          if (isSolid(this.world.get(x, y, z))) return true;
    return false;
  }

  update(dt, keys) {
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const str = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    // Camera looks down -Z at yaw 0: forward = (-sin,-cos), right = (cos,-sin).
    let mx = -sin * fwd + cos * str;
    let mz = -cos * fwd - sin * str;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPRINT : WALK;

    // Horizontal move, resolved per axis so you slide along walls.
    this.pos.x += mx * speed * dt;
    if (this._collides(this.pos.x, this.pos.y, this.pos.z)) this.pos.x -= mx * speed * dt;
    this.pos.z += mz * speed * dt;
    if (this._collides(this.pos.x, this.pos.y, this.pos.z)) this.pos.z -= mz * speed * dt;

    // Jump + gravity + vertical collision.
    if (keys.has('Space') && this.onGround) { this.vy = JUMP; this.onGround = false; }
    this.vy -= GRAVITY * dt;
    this.pos.y += this.vy * dt;
    if (this._collides(this.pos.x, this.pos.y, this.pos.z)) {
      this.pos.y -= this.vy * dt;
      this.onGround = this.vy < 0;
      this.vy = 0;
    } else {
      this.onGround = false;
    }
    // Fell out of the world → respawn on the surface.
    if (this.pos.y < -5) {
      this.pos.y = this.world.surfaceY(Math.floor(this.pos.x), Math.floor(this.pos.z)) + 0.5;
      this.vy = 0;
      this.apexY = this.pos.y;
    }

    // Track fall distance; report it on the frame we land so main can apply damage.
    if (this.onGround) {
      this.landedFall = !this.wasOnGround ? Math.max(0, this.apexY - this.pos.y) : 0;
      this.apexY = this.pos.y;
    } else {
      this.landedFall = 0;
      if (this.pos.y > this.apexY) this.apexY = this.pos.y;
    }
    this.wasOnGround = this.onGround;

    this._syncCamera();
  }

  _syncCamera() {
    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
