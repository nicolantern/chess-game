// Input + third-person orbit camera. The player clicks the canvas to capture the
// mouse (pointer lock); mouse movement then orbits the camera around the
// character, the scroll wheel zooms, and WASD/Shift/Space drive movement. The
// camera trails behind and above the character, always looking at its head.

import * as THREE from 'three';

const LOOK_SENS = 0.0026;
const MIN_PITCH = -0.35; // radians; how far you can look up
const MAX_PITCH = 1.15; //           and down (toward top-down)
const MIN_DIST = 4;
const MAX_DIST = 16;

export class Input {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0; // start behind the hero (see his back, sword & shield)
    this.pitch = 0.5;
    this.distance = 9;
    this.locked = false;

    this._attack = false;

    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyJ') this._attack = true; // keyboard attack
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Clicking the canvas or the overlay on top of it captures the mouse.
    const lock = () => { if (!this.locked) canvas.requestPointerLock(); };
    canvas.addEventListener('click', lock);
    if (overlay) overlay.addEventListener('click', lock);
    // Left mouse button swings the sword while the mouse is captured.
    document.addEventListener('mousedown', (e) => {
      if (this.locked && e.button === 0) this._attack = true;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (overlay) overlay.classList.toggle('hidden', this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * LOOK_SENS;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * LOOK_SENS, MIN_PITCH, MAX_PITCH);
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * 0.01, MIN_DIST, MAX_DIST);
    }, { passive: false });
  }

  /** True once per attack press (click or J), then cleared. */
  consumeAttack() {
    const a = this._attack;
    this._attack = false;
    return a;
  }

  /** Jump is edge-triggered: true only on the frame Space goes down. */
  consumeJump() {
    const down = this.keys.has('Space');
    const fired = down && !this._jumpWas;
    this._jumpWas = down;
    return fired;
  }

  get sprint() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  /** Local move vector from WASD: x = strafe, z = forward (−1 = forward). */
  moveAxis() {
    const f = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const s = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    return { f, s };
  }
}

/**
 * Third-person camera rig. Given the input angles and the character position,
 * position the camera behind/above and look at the head. Also resolves the
 * world-space move direction (WASD relative to where the camera faces).
 */
export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._move = new THREE.Vector3();
  }

  /** Convert WASD axes into a world-space unit direction on the ground plane. */
  moveDirection(input) {
    const { f, s } = input.moveAxis();
    if (f === 0 && s === 0) return this._move.set(0, 0, 0);
    // Forward is the horizontal direction the camera looks toward the character.
    this._fwd.set(Math.sin(input.yaw), 0, Math.cos(input.yaw)).normalize();
    this._right.crossVectors(this._fwd, this.camera.up).normalize();
    this._move.set(0, 0, 0).addScaledVector(this._fwd, f).addScaledVector(this._right, s);
    return this._move.normalize();
  }

  update(input, targetPos, dt) {
    const headY = targetPos.y + 1.6;
    const cp = Math.cos(input.pitch);
    // Camera sits opposite the look direction, at `distance`, raised by pitch.
    this._pos.set(
      targetPos.x - Math.sin(input.yaw) * cp * input.distance,
      headY + Math.sin(input.pitch) * input.distance,
      targetPos.z - Math.cos(input.yaw) * cp * input.distance,
    );
    // Smooth follow so terrain steps and turns aren't jarring.
    const k = 1 - Math.pow(0.0015, dt);
    this.camera.position.lerp(this._pos, k);
    this._look.set(targetPos.x, headY, targetPos.z);
    this.camera.lookAt(this._look);
  }
}
