// Voxel game entry: renderer/scene/sky, the world + first-person player, mouse
// look via pointer lock, block targeting (raycast) with a highlight box, mine
// (left) / place (right), and a hotbar. Renders the first frame immediately then
// runs the animation loop.

import * as THREE from 'three';
import { VoxelWorld } from './world.js';
import { Player } from './player.js';
import { raycast } from './raycast.js';
import { Particles } from './particles.js';
import { B, HOTBAR, NAMES, swatchCss, breakTime } from './blocks.js';

const canvas = document.getElementById('scene');
const fpsEl = document.getElementById('fps');
const overlay = document.getElementById('overlay');
const hotbarEl = document.getElementById('hotbar');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#8ec5ff');
scene.fog = new THREE.Fog(new THREE.Color('#a9d4ff'), 40, 90);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 1000);

const world = new VoxelWorld();
world.build(scene);
const player = new Player(world, camera);
const particles = new Particles(scene);

// Wireframe box that hugs the targeted block.
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x111111 }),
);
highlight.visible = false;
scene.add(highlight);

// Darkening "cracks" cube shown over the block you're mining; opacity tracks
// how far along the break is.
const crack = new THREE.Mesh(
  new THREE.BoxGeometry(1.01, 1.01, 1.01),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }),
);
crack.visible = false;
scene.add(crack);

// --- Hotbar + inventory ---------------------------------------------------
// You start empty and collect blocks by mining them; placing spends one.
let sel = 0;
const inv = {};
HOTBAR.forEach((t) => { inv[t] = 0; });

function buildHotbar() {
  hotbarEl.innerHTML = '';
  HOTBAR.forEach((t, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === sel ? ' on' : '') + (inv[t] > 0 ? '' : ' empty');
    slot.style.background = swatchCss(t);
    slot.title = NAMES[t];
    slot.innerHTML = `<span class="key">${i + 1}</span><span class="count">${inv[t]}</span>`;
    hotbarEl.appendChild(slot);
  });
}
function setSel(i) { sel = (i + HOTBAR.length) % HOTBAR.length; buildHotbar(); }
buildHotbar();

// --- Input ----------------------------------------------------------------
const keys = new Set();
let locked = false;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  const m = e.code.match(/^Digit([1-8])$/);
  if (m) setSel(+m[1] - 1);
});
addEventListener('keyup', (e) => keys.delete(e.code));
// Clicking the canvas OR the "Click to play" overlay (which sits on top of it)
// captures the mouse. Without the overlay handler the overlay would eat the
// first click and pointer lock would never engage.
const lock = () => { if (!locked) canvas.requestPointerLock(); };
canvas.addEventListener('click', lock);
overlay.addEventListener('click', lock);
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  overlay.classList.toggle('hidden', locked);
});
document.addEventListener('mousemove', (e) => { if (locked) player.look(e.movementX, e.movementY); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => { if (locked) setSel(sel + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });
let mining = false; // holding left mouse
addEventListener('mousedown', (e) => {
  if (!locked) return;
  if (e.button === 0) {
    mining = true; // start/continue timed mining in the loop
  } else if (e.button === 2) {
    const hit = currentHit;
    if (!hit) return;
    const bt = HOTBAR[sel];
    if ((inv[bt] || 0) <= 0) return; // nothing of that block to place
    const tx = hit.x + hit.nx, ty = hit.y + hit.ny, tz = hit.z + hit.nz;
    if (!placeHitsPlayer(tx, ty, tz)) { world.edit(tx, ty, tz, bt); inv[bt]--; buildHotbar(); } // place → spend one
  }
});
addEventListener('mouseup', (e) => { if (e.button === 0) mining = false; });
document.addEventListener('pointerlockchange', () => { if (!locked) mining = false; });

// Don't let a placed block spawn inside the player's body.
function placeHitsPlayer(tx, ty, tz) {
  const p = player.pos;
  return (
    tx + 1 > p.x - 0.3 && tx < p.x + 0.3 &&
    tz + 1 > p.z - 0.3 && tz < p.z + 0.3 &&
    ty + 1 > p.y && ty < p.y + 1.8
  );
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Loop -----------------------------------------------------------------
const dirVec = new THREE.Vector3();
let currentHit = null;
let mineKey = null; // "x,y,z" of the block currently being mined
let mineProgress = 0; // seconds held on that block
let last = performance.now();
let fpsAccum = 0, fpsFrames = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  player.update(dt, keys);

  camera.getWorldDirection(dirVec);
  currentHit = raycast(world, camera.position, dirVec, 6);
  if (currentHit) {
    highlight.visible = true;
    highlight.position.set(currentHit.x + 0.5, currentHit.y + 0.5, currentHit.z + 0.5);
  } else {
    highlight.visible = false;
  }

  // Hold-to-mine: accumulate time on the targeted block until it breaks. Looking
  // away (target changes) or releasing resets progress.
  if (mining && currentHit) {
    const key = `${currentHit.x},${currentHit.y},${currentHit.z}`;
    if (key !== mineKey) { mineKey = key; mineProgress = 0; }
    const t = world.get(currentHit.x, currentHit.y, currentHit.z);
    const need = breakTime(t);
    mineProgress += dt;
    crack.visible = true;
    crack.position.set(currentHit.x + 0.5, currentHit.y + 0.5, currentHit.z + 0.5);
    crack.material.opacity = 0.12 + 0.5 * Math.min(1, mineProgress / need);
    if (mineProgress >= need) {
      world.edit(currentHit.x, currentHit.y, currentHit.z, B.AIR);
      if (t in inv) { inv[t]++; buildHotbar(); }
      particles.burst(currentHit.x + 0.5, currentHit.y + 0.5, currentHit.z + 0.5, t);
      mineProgress = 0;
      mineKey = null;
    }
  } else {
    crack.visible = false;
    mineKey = null;
    mineProgress = 0;
  }

  particles.update(dt);
  renderer.render(scene, camera);

  fpsAccum += dt; fpsFrames++;
  if (fpsAccum >= 0.5) { fpsEl.textContent = `${Math.round(fpsFrames / fpsAccum)} fps`; fpsAccum = 0; fpsFrames = 0; }
  requestAnimationFrame(frame);
}
frame(performance.now());
