// Builds the explorable environment: a rolling low-poly terrain with height-based
// coloring, instanced trees and rocks, a water pool, a gradient sky dome, and
// lighting. `heightAt(x, z)` is the single source of truth for ground height so
// the terrain mesh, the scenery placement, and the character's footing all agree.

import * as THREE from 'three';

export const WORLD_SIZE = 400; // square world, centered on the origin
export const WATER_LEVEL = -1.4;

/** Deterministic rolling-hills height field (sum of a few sine octaves). */
export function heightAt(x, z) {
  return (
    2.6 * Math.sin(x * 0.045) * Math.cos(z * 0.05) +
    1.3 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 + 0.7) +
    0.6 * Math.sin(x * 0.23 + 2.1) * Math.cos(z * 0.2 + 1.9)
  );
}

// Small deterministic PRNG so the scatter is the same every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTerrain() {
  const seg = 200;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;

  const grass = new THREE.Color('#4e8a3a');
  const rock = new THREE.Color('#7d7365');
  const sand = new THREE.Color('#cbbb83');
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    let c;
    if (y < WATER_LEVEL + 0.7) c = sand;
    else if (y > 3.4) c = grass.clone().lerp(rock, Math.min(1, (y - 3.4) / 2.5));
    else c = grass;
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function buildTrees(rng) {
  const N = 300;
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a2b', flatShading: true, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f7d3a', flatShading: true, roughness: 1 });
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 2, 6), trunkMat, N);
  const leaf = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 3.6, 7), leafMat, N);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < N * 4 && n < N; i++) {
    const x = (rng() - 0.5) * (WORLD_SIZE - 24);
    const z = (rng() - 0.5) * (WORLD_SIZE - 24);
    const y = heightAt(x, z);
    if (y < WATER_LEVEL + 1.2) continue; // keep trees out of the water
    const sc = 0.7 + rng() * 0.9;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
    s.setScalar(sc);
    p.set(x, y + 1 * sc, z);
    trunk.setMatrixAt(n, m.compose(p, q, s));
    p.set(x, y + 3.4 * sc, z);
    leaf.setMatrixAt(n, m.compose(p, q, s));
    n++;
  }
  trunk.count = n;
  leaf.count = n;
  const group = new THREE.Group();
  group.add(trunk, leaf);
  return group;
}

function buildRocks(rng) {
  const N = 80;
  const mat = new THREE.MeshStandardMaterial({ color: '#8a8378', flatShading: true, roughness: 1 });
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat, N);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < N * 4 && n < N; i++) {
    const x = (rng() - 0.5) * (WORLD_SIZE - 20);
    const z = (rng() - 0.5) * (WORLD_SIZE - 20);
    const y = heightAt(x, z);
    if (y < WATER_LEVEL + 0.3) continue;
    const sc = 0.5 + rng() * 1.4;
    q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3));
    s.set(sc, sc * (0.6 + rng() * 0.5), sc);
    p.set(x, y + sc * 0.3, z);
    rocks.setMatrixAt(n, m.compose(p, q, s));
    n++;
  }
  rocks.count = n;
  return rocks;
}

function buildWater() {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: '#2f6f8f', transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WATER_LEVEL;
  return mesh;
}

function buildSky() {
  const geo = new THREE.SphereGeometry(WORLD_SIZE * 0.92, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color('#3f86d6') }, bottom: { value: new THREE.Color('#dcefff') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'varying vec3 vP; uniform vec3 top; uniform vec3 bottom;' +
      'void main(){ float h = clamp(normalize(vP).y*0.5+0.5, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * Populate `scene` with the world. Returns an object with an `update(dt)` hook
 * for small ambient animation (a gently bobbing water surface).
 */
export function buildWorld(scene) {
  const rng = mulberry32(1337);

  scene.fog = new THREE.Fog(new THREE.Color('#cfe4f5'), WORLD_SIZE * 0.28, WORLD_SIZE * 0.62);

  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x5a6b3a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.15);
  sun.position.set(60, 120, 40);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  scene.add(buildSky());
  const water = buildWater();
  scene.add(buildTerrain(), buildTrees(rng), buildRocks(rng), water);

  let t = 0;
  return {
    update(dt) {
      t += dt;
      water.position.y = WATER_LEVEL + Math.sin(t * 0.8) * 0.06;
    },
  };
}
