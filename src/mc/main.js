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
import { I, isItem, isTool, isArmor, isFood, foodHunger, armorSlot, armorPoints, isStackable, itemIcon, itemName, maxDurability, tierColor, miningMultiplier, attackDamage } from './items.js';
import { craftResult } from './crafting.js';
import { smeltResult, fuelSeconds, SMELT_TIME } from './smelting.js';

// What a mined block drops (defaults to itself).
const DROP = { [B.STONE]: B.COBBLE, [B.COAL_ORE]: I.COAL, [B.DIAMOND_ORE]: I.DIAMOND };
const dropFor = (t) => DROP[t] ?? t;
const label = (id) => (isItem(id) ? itemName(id) : NAMES[id] || 'Block');

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
// Worn armor by slot; index 0..3 = head/chest/legs/feet.
const ARMOR_NAMES = ['head', 'chest', 'legs', 'feet'];
const armorSlots = [null, null, null, null];
const totalArmor = () => armorSlots.reduce((s, a) => s + (a ? armorPoints(a.id) : 0), 0);

let health = 20; // 20 = 10 hearts
let hunger = 20; // 20 = 10 drumsticks (float)
let level = 0;
let xp = 0; // points into the current level
const xpNeed = () => 5 + level * 3;
let regenT = 0, starveT = 0;

let dead = false;
let lastCause = '';
const DEATH_MSG = {
  zombie: 'You were slain by a Zombie',
  skeleton: 'You were shot by a Skeleton',
  creeper: 'You were blown up by a Creeper',
  fall: 'You fell from a high place',
  starve: 'You starved to death',
};

function hurt(dmg, cause) {
  if (dmg <= 0 || dead) return;
  if (cause) lastCause = cause;
  // Armor absorbs up to 80% (each point = 4%); starvation ignores armor.
  const protect = cause !== 'starve';
  if (protect && totalArmor() > 0) {
    dmg = Math.max(0, Math.round(dmg * (1 - Math.min(0.8, totalArmor() * 0.04))));
    for (let i = 0; i < 4; i++) if (armorSlots[i]) { armorSlots[i].dur -= 1; if (armorSlots[i].dur <= 0) armorSlots[i] = null; } // armor wears
    drawArmor();
  }
  if (dmg <= 0) return;
  health = Math.max(0, health - dmg);
  drawHealth();
  sfxMob('hurt');
  const f = $('hurtflash');
  if (f) { f.style.opacity = '0.5'; setTimeout(() => { f.style.opacity = '0'; }, 120); }
  if (health <= 0) die();
}

function die() {
  dead = true;
  mining = false;
  document.exitPointerLock();
  sfxMob('boom');
  const msg = DEATH_MSG[lastCause] || 'You died';
  $('death-sub').innerHTML = `${msg}<br><span class="death-lvl">Level ${level}</span>`;
  $('killscreen').classList.add('show');
}

function respawn() {
  dead = false;
  player.respawn();
  mobs.clear();
  health = 20; hunger = 20; regenT = 0; starveT = 0;
  refreshHud();
  $('killscreen').classList.remove('show');
}
$('respawn').addEventListener('click', respawn);
function gainXp(n) {
  xp += n;
  while (xp >= xpNeed()) { xp -= xpNeed(); level++; }
  drawXp();
}

// --- HUD ------------------------------------------------------------------
// Slot contents: a block shows its colour swatch (+ stack count); an item shows
// its icon (+ a durability bar for tools, or a count for stackables).
function slotStyle(slot) { return slot && !isItem(slot.id) ? `background:${swatchCss(slot.id)}` : ''; }
function slotInner(slot) {
  if (!slot) return '';
  if (!isItem(slot.id)) return slot.count > 1 ? `<span class="count">${slot.count}</span>` : '';
  let inner = `<span class="icon">${itemIcon(slot.id)}</span>`;
  if (slot.dur != null) {
    const pct = Math.max(0, Math.min(1, slot.dur / maxDurability(slot.id)));
    const col = pct > 0.5 ? '#5fce2f' : pct > 0.25 ? '#e0c020' : '#d63b3b';
    inner += `<span class="durbar"><span style="width:${pct * 100}%;background:${col}"></span></span>`;
  } else if (slot.count > 1) inner += `<span class="count">${slot.count}</span>`;
  return inner;
}
function drawHotbar() {
  const el = $('hotbar');
  el.innerHTML = '';
  for (let i = 0; i < inv.hotbar; i++) {
    const s = inv.slots[i];
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === inv.sel ? ' on' : '') + (s ? '' : ' empty');
    if (s) {
      const st = slotStyle(s); if (st) slot.style.cssText = st;
      slot.title = label(s.id);
      const tc = isItem(s.id) ? tierColor(s.id) : null; if (tc) slot.style.borderColor = tc;
    }
    slot.innerHTML = `<span class="key">${i + 1}</span>${slotInner(s)}`;
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
function drawArmor() {
  const pts = totalArmor();
  const n = Math.round(pts / 2);
  let h = '';
  for (let i = 0; i < 10 && pts > 0; i++) h += `<span class="ar ${i < n ? 'full' : 'empty'}">🛡️</span>`;
  $('armor').innerHTML = h;
}
function refreshHud() { drawHotbar(); drawHealth(); drawHunger(); drawXp(); drawArmor(); }
refreshHud();

// --- Inventory GUI (cursor-held model + 3×3 crafting) ---------------------
const invEl = $('inv');
const furnaceEl = $('furnace');
const cursorEl = $('cursoritem');
let invOpen = false;
let cursor = null; // { id, count, dur? } held on the mouse
const craft = new Array(9).fill(null); // 3×3 crafting grid

// Per-block furnace state, keyed by "x,y,z".
const furnaces = new Map();
let furnaceOpen = false;
let openFurnaceKey = null;
const emptyFurnace = () => ({ input: null, fuel: null, output: null, progress: 0, burnLeft: 0, burnMax: 0 });
const curFurnace = () => furnaces.get(openFurnaceKey);
const guiOpen = () => invOpen || furnaceOpen;

const stackable = (id) => isStackable(id);
const makeStack = (id, count) => (!isStackable(id) ? { id, count: 1, dur: maxDurability(id) } : { id, count });

const getSlot = (store, i) => {
  if (store === 'inv') return inv.slots[i];
  if (store === 'craft') return craft[i];
  if (store === 'armor') return armorSlots[i];
  const f = curFurnace();
  if (!f) return null;
  return store === 'fin' ? f.input : store === 'ffuel' ? f.fuel : store === 'fout' ? f.output : null;
};
const setSlot = (store, i, v) => {
  if (store === 'inv') { inv.slots[i] = v; return; }
  if (store === 'craft') { craft[i] = v; return; }
  if (store === 'armor') { armorSlots[i] = v; return; }
  const f = curFurnace();
  if (!f) return;
  if (store === 'fin') f.input = v; else if (store === 'ffuel') f.fuel = v; else if (store === 'fout') f.output = v;
};
const rebuildGui = () => { if (invOpen) buildInv(); if (furnaceOpen) buildFurnace(); };

function slotDiv(store, i, slot, cls = '') {
  const st = slotStyle(slot);
  return `<div class="slot ${slot ? '' : 'empty'} ${cls}" data-store="${store}" data-i="${i}" style="${st}" title="${slot ? label(slot.id) : ''}">${slotInner(slot)}</div>`;
}

function buildInv() {
  let main = '';
  for (let i = inv.hotbar; i < inv.size; i++) main += slotDiv('inv', i, inv.slots[i]);
  let hot = '';
  for (let i = 0; i < inv.hotbar; i++) hot += slotDiv('inv', i, inv.slots[i]);
  let grid = '';
  for (let i = 0; i < 9; i++) grid += slotDiv('craft', i, craft[i]);
  let arm = '';
  for (let i = 0; i < 4; i++) arm += slotDiv('armor', i, armorSlots[i]);
  const out = craftResult(craft.map((c) => (c ? c.id : null)));
  const outSlot = out ? makeStack(out.id, out.count) : null;
  invEl.querySelector('.inv-main').innerHTML = main;
  invEl.querySelector('.inv-hot').innerHTML = hot;
  invEl.querySelector('.inv-craft').innerHTML = grid;
  invEl.querySelector('.inv-armor').innerHTML = arm;
  invEl.querySelector('.inv-result').innerHTML = slotDiv('result', 0, outSlot);
  invEl.querySelectorAll('.slot').forEach((d) => { d.onclick = () => clickSlot(d.dataset.store, +d.dataset.i); });
  drawHotbar();
  updateCursorEl();
}

function clickSlot(store, i) {
  if (store === 'result') { takeResult(); return; }
  if (store === 'armor') { // equip slot: only the matching armor piece fits
    const s = armorSlots[i];
    if (!cursor) { if (s) { cursor = s; armorSlots[i] = null; } }
    else if (isArmor(cursor.id) && armorSlot(cursor.id) === ARMOR_NAMES[i]) { armorSlots[i] = cursor; cursor = s; }
    drawArmor(); rebuildGui(); return;
  }
  if (store === 'fout') { // furnace output: take only, never place into
    const s = getSlot('fout', 0);
    if (s) {
      if (!cursor) { cursor = s; setSlot('fout', 0, null); }
      else if (cursor.id === s.id && stackable(s.id)) { const n = Math.min(64 - cursor.count, s.count); cursor.count += n; s.count -= n; if (s.count <= 0) setSlot('fout', 0, null); }
    }
    rebuildGui(); return;
  }
  const s = getSlot(store, i);
  if (!cursor) {
    if (s) { cursor = s; setSlot(store, i, null); }
  } else if (!s) {
    setSlot(store, i, cursor); cursor = null;
  } else if (s.id === cursor.id && stackable(s.id)) {
    const n = Math.min(64 - s.count, cursor.count);
    s.count += n; cursor.count -= n;
    if (cursor.count <= 0) cursor = null;
  } else {
    setSlot(store, i, cursor); cursor = s;
  }
  rebuildGui();
}

function takeResult() {
  const out = craftResult(craft.map((c) => (c ? c.id : null)));
  if (!out) return;
  if (cursor && (cursor.id !== out.id || !stackable(out.id))) return;
  if (cursor) cursor.count += out.count;
  else cursor = makeStack(out.id, out.count);
  for (let i = 0; i < 9; i++) { const c = craft[i]; if (c) { c.count -= 1; if (c.count <= 0) craft[i] = null; } } // consume ingredients
  rebuildGui();
}

// --- Furnace GUI + smelting ----------------------------------------------
function buildFurnace() {
  const f = curFurnace();
  if (!f) return;
  furnaceEl.querySelector('.f-in').innerHTML = slotDiv('fin', 0, f.input);
  furnaceEl.querySelector('.f-fuel').innerHTML = slotDiv('ffuel', 0, f.fuel);
  furnaceEl.querySelector('.f-out').innerHTML = slotDiv('fout', 0, f.output);
  furnaceEl.querySelector('.f-flame').style.opacity = f.burnLeft > 0 ? '1' : '0.25';
  furnaceEl.querySelector('.f-progress > span').style.width = `${Math.min(1, f.progress / SMELT_TIME) * 100}%`;
  furnaceEl.querySelectorAll('.slot').forEach((d) => { d.onclick = () => clickSlot(d.dataset.store, +d.dataset.i); });
  drawHotbar();
  updateCursorEl();
}

function smeltTick(dt) {
  const f = curFurnace();
  if (!f) return;
  const recipe = smeltResult(f.input && f.input.id);
  const canOutput = recipe && (!f.output || (f.output.id === recipe.id && f.output.count < 64));
  if (recipe && canOutput) {
    if (f.burnLeft <= 0 && f.fuel) {
      const s = fuelSeconds(f.fuel.id);
      if (s > 0) { f.burnLeft = s; f.burnMax = s; f.fuel.count -= 1; if (f.fuel.count <= 0) f.fuel = null; }
    }
    if (f.burnLeft > 0) {
      f.burnLeft -= dt;
      f.progress += dt;
      if (f.progress >= SMELT_TIME) {
        f.progress = 0;
        f.output = f.output ? { id: recipe.id, count: f.output.count + recipe.count } : { id: recipe.id, count: recipe.count };
        f.input.count -= 1; if (f.input.count <= 0) f.input = null;
      }
    } else f.progress = Math.max(0, f.progress - dt * 2);
  } else {
    f.progress = Math.max(0, f.progress - dt * 2);
  }
  buildFurnace();
}

function openFurnace(key) { furnaceOpen = true; openFurnaceKey = key; document.exitPointerLock(); buildFurnace(); furnaceEl.classList.add('show'); }
function closeFurnace() { furnaceOpen = false; putBack(cursor); cursor = null; openFurnaceKey = null; furnaceEl.classList.remove('show'); drawHotbar(); }

function updateCursorEl() {
  if (!cursor) { cursorEl.style.display = 'none'; return; }
  cursorEl.style.display = 'block';
  cursorEl.style.background = !isItem(cursor.id) ? swatchCss(cursor.id) : 'transparent';
  cursorEl.innerHTML = slotInner(cursor);
}

function putBack(slot) {
  if (!slot) return;
  if (stackable(slot.id)) { inv.add(slot.id, slot.count); return; }
  for (let i = 0; i < inv.size; i++) if (!inv.slots[i]) { inv.slots[i] = slot; return; }
}
function openInv() { invOpen = true; document.exitPointerLock(); buildInv(); invEl.classList.add('show'); }
function closeInv() {
  invOpen = false;
  putBack(cursor); cursor = null;
  for (let i = 0; i < 9; i++) { putBack(craft[i]); craft[i] = null; }
  invEl.classList.remove('show');
  drawHotbar();
}

// --- Input ----------------------------------------------------------------
const keys = new Set();
const NONE = new Set();
let locked = false;
let mining = false;

const lock = () => { initAudio(); if (!locked && !guiOpen() && !dead) canvas.requestPointerLock(); };
canvas.addEventListener('click', lock);
overlay.addEventListener('click', lock);
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  overlay.classList.toggle('hidden', locked || guiOpen() || dead);
  if (!locked) mining = false;
});
document.addEventListener('mousemove', (e) => {
  if (locked) player.look(e.movementX, e.movementY);
  else if (guiOpen()) { cursorEl.style.left = `${e.clientX}px`; cursorEl.style.top = `${e.clientY}px`; }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') { if (furnaceOpen) closeFurnace(); else if (invOpen) closeInv(); else openInv(); return; }
  if (e.code === 'Escape') { if (invOpen) { closeInv(); return; } if (furnaceOpen) { closeFurnace(); return; } }
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
    const sel = inv.selectedId();
    if (mobs.tryAttack(camera.position, dirVec, 4, attackDamage(sel))) {
      sfxMob('hit');
      if (isTool(sel)) { inv.damageSlot(inv.sel); drawHotbar(); }
    } else mining = true;
  } else if (e.button === 2) {
    const sel = inv.selectedId();
    if (sel != null && isFood(sel)) { // eat held food to restore hunger
      if (hunger < 20) { hunger = Math.min(20, hunger + foodHunger(sel)); inv.spendSelected(); drawHunger(); drawHotbar(); sfxMob('eat'); }
      return;
    }
    const hit = currentHit;
    if (!hit) return;
    if (world.get(hit.x, hit.y, hit.z) === B.FURNACE) { openFurnace(`${hit.x},${hit.y},${hit.z}`); return; } // right-click opens the furnace
    const bt = sel;
    if (bt == null || isItem(bt)) return; // only blocks can be placed
    const tx = hit.x + hit.nx, ty = hit.y + hit.ny, tz = hit.z + hit.nz;
    if (!placeHitsPlayer(tx, ty, tz)) {
      world.edit(tx, ty, tz, bt);
      if (bt === B.FURNACE) furnaces.set(`${tx},${ty},${tz}`, emptyFurnace());
      inv.spendSelected(); drawHotbar(); sfxPlace(bt);
    }
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

  player.update(dt, (guiOpen() || dead) ? NONE : keys);
  dayNight.update(dt);
  if (furnaceOpen) smeltTick(dt);
  mobs.update(dt, {
    playerPos: player.pos,
    isNight: dayNight.isNight,
    hurtPlayer: hurt,
    gainXp,
    sfx: sfxMob,
    giveItem: (id, n) => { inv.add(id, n); drawHotbar(); },
  });

  // Fall damage: >3 blocks fallen hurts for (fall − 3).
  if (player.landedFall > 3) hurt(Math.floor(player.landedFall - 3), 'fall');

  // Hunger drains (faster sprinting); high hunger regenerates health, empty
  // hunger starves.
  const sprinting = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && (keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD'));
  if (!guiOpen()) hunger = Math.max(0, hunger - dt * (sprinting ? 0.25 : 0.11));
  if (hunger >= 18 && health < 20) { regenT += dt; if (regenT > 3) { regenT = 0; health = Math.min(20, health + 1); drawHealth(); } } else regenT = 0;
  if (hunger <= 0 && health > 0) { starveT += dt; if (starveT > 4) { starveT = 0; hurt(1, 'starve'); } } else starveT = 0;
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
    const need = breakTime(t) / miningMultiplier(inv.selectedId(), t); // the right tool mines faster
    mineProgress += dt;
    digTickT += dt;
    if (digTickT >= 0.2) { digTickT = 0; sfxDig(t, false); }
    crack.visible = true;
    crack.position.set(currentHit.x + 0.5, currentHit.y + 0.5, currentHit.z + 0.5);
    crack.material.opacity = 0.12 + 0.5 * Math.min(1, mineProgress / need);
    if (mineProgress >= need) {
      const bkey = `${currentHit.x},${currentHit.y},${currentHit.z}`;
      world.edit(currentHit.x, currentHit.y, currentHit.z, B.AIR);
      inv.add(dropFor(t), 1);
      if (t === B.FURNACE && furnaces.has(bkey)) { // spill the furnace's contents
        const f = furnaces.get(bkey);
        for (const s of [f.input, f.fuel, f.output]) if (s) inv.add(s.id, s.count);
        furnaces.delete(bkey);
      }
      if (isTool(inv.selectedId())) inv.damageSlot(inv.sel); // tools wear out
      drawHotbar();
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
