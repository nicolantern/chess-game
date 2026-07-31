// Voxel game entry: renderer/scene/sky, the world + first-person player, mouse
// look via pointer lock, block targeting (raycast) with a highlight box, mine
// (left) / place (right), and a hotbar. Renders the first frame immediately then
// runs the animation loop.

import * as THREE from 'three';
import { VoxelWorld } from './world.js';
import { Player } from './player.js';
import { raycast } from './raycast.js';
import { B, HOTBAR, NAMES, swatchCss } from './blocks.js';

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

// Wireframe box that hugs the targeted block.
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x111111 }),
);
highlight.visible = false;
scene.add(highlight);

// --- Hotbar ---------------------------------------------------------------
let sel = 0;
function buildHotbar() {
  hotbarEl.innerHTML = '';
  HOTBAR.forEach((t, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === sel ? ' on' : '');
    slot.style.background = swatchCss(t);
    slot.title = NAMES[t];
    slot.innerHTML = `<span>${i + 1}</span>`;
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
canvas.addEventListener('click', () => canvas.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  overlay.classList.toggle('hidden', locked);
});
document.addEventListener('mousemove', (e) => { if (locked) player.look(e.movementX, e.movementY); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => { if (locked) setSel(sel + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });
addEventListener('mousedown', (e) => {
  if (!locked) return;
  const hit = currentHit;
  if (!hit) return;
  if (e.button === 0) {
    world.edit(hit.x, hit.y, hit.z, B.AIR); // mine
  } else if (e.button === 2) {
    const tx = hit.x + hit.nx, ty = hit.y + hit.ny, tz = hit.z + hit.nz;
    if (!placeHitsPlayer(tx, ty, tz)) world.edit(tx, ty, tz, HOTBAR[sel]); // place
  }
});

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

  renderer.render(scene, camera);

  fpsAccum += dt; fpsFrames++;
  if (fpsAccum >= 0.5) { fpsEl.textContent = `${Math.round(fpsFrames / fpsAccum)} fps`; fpsAccum = 0; fpsFrames = 0; }
  requestAnimationFrame(frame);
}
frame(performance.now());
