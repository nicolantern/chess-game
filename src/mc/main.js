// Voxel game entry: renderer/scene/sky, world + first-person player, day/night,
// survival stats (health/hunger/XP + fall damage), a 36-slot inventory with a
// 9-slot hotbar + GUI, mining/placing with particles and sounds. Renders the
// first frame immediately then runs the loop.

import * as THREE from 'three';
import { VoxelWorld } from './world.js';
import { Player } from './player.js';
import { raycast } from './raycast.js';
import { Particles } from './particles.js';
import { DayNight } from './daynight.js';
import { Inventory } from './inventory.js';
import { Mobs } from './mobs.js';
import { initAudio, sfxDig, sfxPlace, sfxMob } from './sound.js';
import { B, NAMES, swatchCss, breakTime } from './blocks.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const overlay = $('overlay');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(new THREE.Color('#a9d4ff'), 40, 90);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 1000);

const world = new VoxelWorld();
world.build(scene);
const player = new Player(world, camera);
const particles = new Particles(scene);
const dayNight = new DayNight(scene, world);
const inv = new Inventory(36, 9);
const mobs = new Mobs(scene, world);

// Targeted-block highlight + a darkening "cracks" cube for mining progress.
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x111111 }),
);
highlight.visible = false;
scene.add(highlight);
const crack = new THREE.Mesh(
  new THREE.BoxGeometry(1.01, 1.01, 1.01),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }),
);
crack.visible = false;
scene.add(crack);

// --- Survival stats -------------------------------------------------------
let health = 20; // 20 = 10 hearts
let hunger = 20; // 20 = 10 drumsticks (float)
let level = 0;
let xp = 0; // points into the current level
const xpNeed = () => 5 + level * 3;
let regenT = 0, starveT = 0;

function hurt(dmg) {
  if (dmg <= 0) return;
  health = Math.max(0, health - dmg);
  drawHealth();
  sfxMob('hurt');
  const f = $('hurtflash');
  if (f) { f.style.opacity = '0.5'; setTimeout(() => { f.style.opacity = '0'; }, 120); }
  if (health <= 0) {
    player.respawn();
    health = 20; hunger = 20;
    drawHealth(); drawHunger();
  }
}
function gainXp(n) {
  xp += n;
  while (xp >= xpNeed()) { xp -= xpNeed(); level++; }
  drawXp();
}

// --- HUD ------------------------------------------------------------------
function drawHotbar() {
  const el = $('hotbar');
  el.innerHTML = '';
  for (let i = 0; i < inv.hotbar; i++) {
    const s = inv.slots[i];
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === inv.sel ? ' on' : '') + (s ? '' : ' empty');
    if (s) { slot.style.background = swatchCss(s.type); slot.title = NAMES[s.type]; }
    slot.innerHTML = `<span class="key">${i + 1}</span>${s ? `<span class="count">${s.count}</span>` : ''}`;
    el.appendChild(slot);
  }
}
function drawHealth() {
  const full = Math.floor(health / 2), half = health % 2;
  let h = '';
  for (let i = 0; i < 10; i++) {
    const cls = i < full ? 'full' : i === full && half ? 'half' : 'empty';
    h += `<span class="hp ${cls}">♥</span>`;
  }
  $('health').innerHTML = h;
}
function drawHunger() {
  const n = Math.round(hunger / 2);
  let h = '';
  for (let i = 0; i < 10; i++) h += `<span class="fd ${i < n ? 'full' : 'empty'}">🍗</span>`;
  $('hunger').innerHTML = h;
}
function drawXp() {
  $('xpfill').style.width = `${(xp / xpNeed()) * 100}%`;
  $('xplevel').textContent = level > 0 ? level : '';
}
function refreshHud() { drawHotbar(); drawHealth(); drawHunger(); drawXp(); }
refreshHud();

// --- Inventory GUI --------------------------------------------------------
const invEl = $('inv');
let invOpen = false;
let held = null; // slot index picked up in the GUI

function slotHtml(i) {
  const s = inv.slots[i];
  const on = held === i ? ' on' : '';
  const bg = s ? `style="background:${swatchCss(s.type)}"` : '';
  return `<div class="slot${s ? '' : ' empty'}${on}" data-i="${i}" ${bg} title="${s ? NAMES[s.type] : ''}">${s ? `<span class="count">${s.count}</span>` : ''}</div>`;
}
function buildInv() {
  let main = '';
  for (let i = inv.hotbar; i < inv.size; i++) main += slotHtml(i); // 27 storage
  let hot = '';
  for (let i = 0; i < inv.hotbar; i++) hot += slotHtml(i); // 9 hotbar
  invEl.querySelector('.inv-main').innerHTML = main;
  invEl.querySelector('.inv-hot').innerHTML = hot;
  invEl.querySelectorAll('.slot').forEach((d) => {
    d.onclick = () => onSlotClick(+d.dataset.i);
  });
}
function onSlotClick(i) {
  if (held === null) { if (inv.slots[i]) held = i; }
  else { inv.moveSlot(held, i); held = null; }
  buildInv();
  drawHotbar();
}
function openInv() { invOpen = true; held = null; document.exitPointerLock(); buildInv(); invEl.classList.add('show'); }
function closeInv() { invOpen = false; invEl.classList.remove('show'); }

// --- Input ----------------------------------------------------------------
const keys = new Set();
const NONE = new Set();
let locked = false;
let mining = false;

const lock = () => { initAudio(); if (!locked && !invOpen) canvas.requestPointerLock(); };
canvas.addEventListener('click', lock);
overlay.addEventListener('click', lock);
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  overlay.classList.toggle('hidden', locked || invOpen);
  if (!locked) mining = false;
});
document.addEventListener('mousemove', (e) => { if (locked) player.look(e.movementX, e.movementY); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') { invOpen ? closeInv() : openInv(); return; }
  if (e.code === 'Escape' && invOpen) { closeInv(); return; }
  keys.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  const m = e.code.match(/^Digit([1-9])$/);
  if (m) { inv.sel = +m[1] - 1; drawHotbar(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('wheel', (e) => {
  if (!locked) return;
  inv.sel = (inv.sel + (e.deltaY > 0 ? 1 : -1) + inv.hotbar) % inv.hotbar;
  drawHotbar();
}, { passive: true });

addEventListener('mousedown', (e) => {
  if (!locked) return;
  if (e.button === 0) {
    // Attack a mob if one is in front within reach; otherwise start mining.
    camera.getWorldDirection(dirVec);
    if (mobs.tryAttack(camera.position, dirVec, 4, 4)) sfxMob('hit');
    else mining = true;
  } else if (e.button === 2) {
    const hit = currentHit;
    const bt = inv.selectedType();
    if (!hit || bt == null) return;
    const tx = hit.x + hit.nx, ty = hit.y + hit.ny, tz = hit.z + hit.nz;
    if (!placeHitsPlayer(tx, ty, tz)) { world.edit(tx, ty, tz, bt); inv.spendSelected(); drawHotbar(); sfxPlace(bt); }
  }
});
addEventListener('mouseup', (e) => { if (e.button === 0) mining = false; });

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
let mineKey = null, mineProgress = 0, digTickT = 0;
const fpsEl = $('fps');
let last = performance.now();
let fpsAccum = 0, fpsFrames = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  player.update(dt, invOpen ? NONE : keys);
  dayNight.update(dt);
  mobs.update(dt, {
    playerPos: player.pos,
    isNight: dayNight.isNight,
    hurtPlayer: hurt,
    gainXp,
    sfx: sfxMob,
  });

  // Fall damage: >3 blocks fallen hurts for (fall − 3).
  if (player.landedFall > 3) hurt(Math.floor(player.landedFall - 3));

  // Hunger drains (faster sprinting); high hunger regenerates health, empty
  // hunger starves.
  const sprinting = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && (keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD'));
  if (!invOpen) hunger = Math.max(0, hunger - dt * (sprinting ? 0.25 : 0.11));
  if (hunger >= 18 && health < 20) { regenT += dt; if (regenT > 3) { regenT = 0; health = Math.min(20, health + 1); drawHealth(); } } else regenT = 0;
  if (hunger <= 0 && health > 0) { starveT += dt; if (starveT > 4) { starveT = 0; hurt(1); } } else starveT = 0;
  drawHunger();

  camera.getWorldDirection(dirVec);
  currentHit = locked ? raycast(world, camera.position, dirVec, 6) : null;
  if (currentHit) {
    highlight.visible = true;
    highlight.position.set(currentHit.x + 0.5, currentHit.y + 0.5, currentHit.z + 0.5);
  } else {
    highlight.visible = false;
  }

  // Hold-to-mine with break times, cracks, particles, sound, drops, and XP.
  if (mining && currentHit) {
    const key = `${currentHit.x},${currentHit.y},${currentHit.z}`;
    if (key !== mineKey) { mineKey = key; mineProgress = 0; }
    const t = world.get(currentHit.x, currentHit.y, currentHit.z);
    const need = breakTime(t);
    mineProgress += dt;
    digTickT += dt;
    if (digTickT >= 0.2) { digTickT = 0; sfxDig(t, false); }
    crack.visible = true;
    crack.position.set(currentHit.x + 0.5, currentHit.y + 0.5, currentHit.z + 0.5);
    crack.material.opacity = 0.12 + 0.5 * Math.min(1, mineProgress / need);
    if (mineProgress >= need) {
      world.edit(currentHit.x, currentHit.y, currentHit.z, B.AIR);
      inv.add(t, 1); drawHotbar();
      particles.burst(currentHit.x + 0.5, currentHit.y + 0.5, currentHit.z + 0.5, t);
      sfxDig(t, true);
      gainXp(t === B.COAL_ORE || t === B.IRON_ORE ? 3 : 1);
      mineProgress = 0; mineKey = null;
    }
  } else {
    crack.visible = false; mineKey = null; mineProgress = 0; digTickT = 0.2;
  }

  particles.update(dt);
  renderer.render(scene, camera);

  fpsAccum += dt; fpsFrames++;
  if (fpsAccum >= 0.5) { fpsEl.textContent = `${Math.round(fpsFrames / fpsAccum)} fps`; fpsAccum = 0; fpsFrames = 0; }
  requestAnimationFrame(frame);
}
frame(performance.now());
