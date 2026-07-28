// Builds a Breath-of-the-Wild-flavored world: cel/toon-shaded low-poly terrain
// under a warm golden-hour sky, dense wind-swept tall grass, instanced trees and
// rocks, a water pool, and a few landmarks (a great tree, a glowing shrine, a
// flickering campfire). `heightAt(x, z)` is the single source of truth for ground
// height so the terrain, the scatter, and the hero's footing all agree.

import * as THREE from 'three';

export const WORLD_SIZE = 400;
export const WATER_LEVEL = -1.4;

// Shared 3-step ramp so everything gets the same banded cel look.
export const TOON_GRADIENT = (() => {
  const steps = new Uint8Array([90, 175, 255]);
  const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRADIENT, ...extra });

/** Deterministic rolling-hills height field (sum of a few sine octaves). */
export function heightAt(x, z) {
  return (
    2.6 * Math.sin(x * 0.045) * Math.cos(z * 0.05) +
    1.3 * Math.sin(x * 0.11 + 1.3) * Math.cos(z * 0.09 + 0.7) +
    0.6 * Math.sin(x * 0.23 + 2.1) * Math.cos(z * 0.2 + 1.9)
  );
}

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
  const grass = new THREE.Color('#7bb04a');
  const grassDark = new THREE.Color('#5c9138');
  const rock = new THREE.Color('#8f8672');
  const sand = new THREE.Color('#d8c98c');
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    let c;
    if (y < WATER_LEVEL + 0.7) c = sand;
    else if (y > 3.4) c = grass.clone().lerp(rock, Math.min(1, (y - 3.4) / 2.5));
    else c = grassDark.clone().lerp(grass, (y - WATER_LEVEL) / 5); // richer greens down low
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, toon('#ffffff', { vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

// Dense wind-swept grass. One instanced blade mesh; a vertex-shader sway bends
// each blade more toward its tip, phased by world position so it ripples.
function buildGrass(rng, wind) {
  const blade = new THREE.PlaneGeometry(0.13, 0.9, 1, 3);
  blade.translate(0, 0.45, 0); // base at the origin so it grows upward
  const mat = toon('#78b23f', { side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind;
    sh.vertexShader =
      'uniform float uTime;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           float wx = instanceMatrix[3][0]; float wz = instanceMatrix[3][2];
         #else
           float wx = 0.0; float wz = 0.0;
         #endif
         float ph = wx * 0.35 + wz * 0.35;
         float tip = clamp(position.y / 0.9, 0.0, 1.0);
         transformed.x += sin(uTime * 1.6 + ph) * 0.28 * tip;
         transformed.z += cos(uTime * 1.2 + ph) * 0.12 * tip;`,
      );
  };
  const N = 9000;
  const mesh = new THREE.InstancedMesh(blade, mat, N);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  let n = 0;
  for (let i = 0; i < N * 3 && n < N; i++) {
    const x = (rng() - 0.5) * (WORLD_SIZE - 20);
    const z = (rng() - 0.5) * (WORLD_SIZE - 20);
    const y = heightAt(x, z);
    if (y < WATER_LEVEL + 0.9) continue;
    q.setFromAxisAngle(up, rng() * Math.PI);
    const sc = 0.7 + rng() * 1.1;
    s.set(sc, sc * (0.8 + rng() * 0.6), sc);
    p.set(x, y, z);
    mesh.setMatrixAt(n, m.compose(p, q, s));
    col.setHSL(0.26 + rng() * 0.05, 0.55, 0.35 + rng() * 0.12);
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  return mesh;
}

function buildTrees(rng) {
  const N = 260;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 2, 6), toon('#7a5330'), N);
  const leaf = new THREE.InstancedMesh(new THREE.ConeGeometry(1.8, 3.8, 8), toon('#3f8f3a'), N);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (let i = 0; i < N * 4 && n < N; i++) {
    const x = (rng() - 0.5) * (WORLD_SIZE - 24);
    const z = (rng() - 0.5) * (WORLD_SIZE - 24);
    const y = heightAt(x, z);
    if (y < WATER_LEVEL + 1.2) continue;
    const sc = 0.7 + rng() * 0.9;
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    s.setScalar(sc);
    trunk.setMatrixAt(n, m.compose(p.set(x, y + 1 * sc, z), q, s));
    leaf.setMatrixAt(n, m.compose(p.set(x, y + 3.4 * sc, z), q, s));
    n++;
  }
  trunk.count = n;
  leaf.count = n;
  const g = new THREE.Group();
  g.add(trunk, leaf);
  return g;
}

function buildRocks(rng) {
  const N = 70;
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), toon('#9a9284'), N);
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
    rocks.setMatrixAt(n, m.compose(p.set(x, y + sc * 0.3, z), q, s));
    n++;
  }
  rocks.count = n;
  return rocks;
}

function buildWater() {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshToonMaterial({
    color: '#3aa0b8', gradientMap: TOON_GRADIENT, transparent: true, opacity: 0.8,
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
    uniforms: {
      top: { value: new THREE.Color('#3d7fc4') },
      mid: { value: new THREE.Color('#bfe0ea') },
      bottom: { value: new THREE.Color('#ffd39a') }, // warm horizon glow
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;' +
      'void main(){ float h = normalize(vP).y; vec3 c = h < 0.15 ? mix(bottom, mid, clamp(h/0.15,0.0,1.0)) : mix(mid, top, clamp((h-0.15)/0.85,0.0,1.0)); gl_FragColor = vec4(c, 1.0); }',
  });
  return new THREE.Mesh(geo, mat);
}

// A big canopy tree as a Hyrule-ish landmark.
function buildGreatTree(x, z) {
  const g = new THREE.Group();
  const y = heightAt(x, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 12, 8), toon('#6f4a28'));
  trunk.position.set(x, y + 6, z);
  g.add(trunk);
  const canopy = toon('#3c8a36');
  for (const [dx, dy, dz, r] of [[0, 13, 0, 6], [-3.5, 11.5, 1, 4.2], [3.5, 11.5, -1, 4.4], [0.5, 12, 3.5, 4]]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), canopy);
    b.position.set(x + dx, y + dy, z + dz);
    g.add(b);
  }
  return g;
}

// A glowing shrine: a dark stone block ringed with orange emissive trim.
function buildShrine(x, z) {
  const g = new THREE.Group();
  const y = heightAt(x, z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3.2, 4), toon('#2c3038'));
  base.position.set(x, y + 1.6, z);
  g.add(base);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ff9a3c' });
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(4.05, 0.18, 0.18), glowMat);
    bar.position.set(x, y + 0.7 + i * 0.9, z + 2.02);
    g.add(bar);
    const bar2 = bar.clone();
    bar2.position.z = z - 2.02;
    g.add(bar2);
  }
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), glowMat);
  orb.position.set(x, y + 3.6, z);
  g.add(orb);
  const light = new THREE.PointLight(0xff9a3c, 8, 18, 2);
  light.position.set(x, y + 3.6, z);
  g.add(light);
  return g;
}

// A campfire with logs, a flame, and a warm flickering light.
function buildCampfire(x, z) {
  const g = new THREE.Group();
  const y = heightAt(x, z);
  const logMat = toon('#6a4a2c');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 5), logMat);
    log.position.set(x + Math.cos(a) * 0.4, y + 0.25, z + Math.sin(a) * 0.4);
    log.rotation.set(Math.PI / 2.4, a, 0);
    g.add(log);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.1, 6), new THREE.MeshBasicMaterial({ color: '#ff7326' }));
  flame.position.set(x, y + 0.8, z);
  g.add(flame);
  const light = new THREE.PointLight(0xff7a2e, 6, 14, 2);
  light.position.set(x, y + 1.2, z);
  g.add(light);
  return { group: g, flame, light, baseY: y };
}

/**
 * Populate `scene` with the world. Returns `{ update(dt) }` for ambient motion
 * (grass wind, bobbing water, and the flickering campfire).
 */
export function buildWorld(scene) {
  const rng = mulberry32(1337);
  const wind = { value: 0 };

  scene.fog = new THREE.Fog(new THREE.Color('#e7d3b3'), WORLD_SIZE * 0.3, WORLD_SIZE * 0.66);

  scene.add(new THREE.HemisphereLight(0xffe6c0, 0x5a6b3a, 0.85));
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.25); // warm, low golden-hour sun
  sun.position.set(-70, 60, 90);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xfff1dd, 0.35));

  scene.add(buildSky());
  const water = buildWater();
  scene.add(buildTerrain(), buildGrass(rng, wind), buildTrees(rng), buildRocks(rng), water);
  scene.add(buildGreatTree(-28, -22), buildShrine(34, 18));
  const fire = buildCampfire(9, 6);
  scene.add(fire.group);

  let t = 0;
  return {
    update(dt) {
      t += dt;
      wind.value = t;
      water.position.y = WATER_LEVEL + Math.sin(t * 0.8) * 0.06;
      const flick = 0.75 + Math.sin(t * 18) * 0.12 + Math.sin(t * 7.3) * 0.13;
      fire.light.intensity = 6 * flick;
      fire.flame.scale.y = 0.85 + flick * 0.3;
      fire.flame.position.y = fire.baseY + 0.8 + (flick - 0.85) * 0.1;
    },
  };
}
