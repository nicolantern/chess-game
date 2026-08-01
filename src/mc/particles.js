// Block-break particles: when a block is mined, a burst of tiny cubes tinted
// like that block flies out, tumbles, falls under gravity, and shrinks away.
// Geometry is shared and materials are cached per block type, so a burst just
// adds a handful of cheap meshes that are removed when their life runs out.

import * as THREE from 'three';
import { faceColor } from './blocks.js';

const GEO = new THREE.BoxGeometry(0.14, 0.14, 0.14);
const GRAVITY = 15;
const MAX_ALIVE = 400;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.alive = [];
    this.mats = new Map();
  }

  _mat(type) {
    let m = this.mats.get(type);
    if (!m) {
      const [r, g, b] = faceColor(type, 'top');
      m = new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
      this.mats.set(type, m);
    }
    return m;
  }

  /** Spawn a burst of debris at a block centre for the given block type. */
  burst(x, y, z, type, count = 12) {
    const mat = this._mat(type);
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(GEO, mat);
      mesh.position.set(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const life = 0.55 + Math.random() * 0.5;
      this.scene.add(mesh);
      this.alive.push({
        mesh, life, max: life,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        vz: (Math.random() - 0.5) * 4,
        rx: (Math.random() - 0.5) * 7,
        ry: (Math.random() - 0.5) * 7,
      });
    }
    while (this.alive.length > MAX_ALIVE) {
      const old = this.alive.shift();
      this.scene.remove(old.mesh);
    }
  }

  update(dt) {
    for (let i = this.alive.length - 1; i >= 0; i--) {
      const p = this.alive[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.alive.splice(i, 1);
        continue;
      }
      p.vy -= GRAVITY * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.rx * dt;
      p.mesh.rotation.y += p.ry * dt;
      p.mesh.scale.setScalar(Math.max(0.02, p.life / p.max)); // shrink as it dies
    }
  }
}
