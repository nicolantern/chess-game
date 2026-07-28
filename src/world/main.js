// Entry point for the 3D world: creates the renderer/scene/camera, builds the
// environment and character, wires input + the third-person camera, and runs the
// render loop (fixed-ish delta, FPS readout).

import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Character } from './character.js';
import { Input, ThirdPersonCamera } from './controls.js';

const canvas = document.getElementById('scene');
const fpsEl = document.getElementById('fps');
const overlay = document.getElementById('overlay');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);

const world = buildWorld(scene);
const player = new Character();
scene.add(player.mesh);

const input = new Input(canvas, overlay);
const rig = new ThirdPersonCamera(camera);

// Place the camera behind the character before the first frame so it doesn't
// swing in from the origin.
rig.update(input, player.pos, 1);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let last = performance.now();
let fpsAccum = 0;
let fpsFrames = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); // clamp big gaps (tab switches)
  last = now;

  const moveDir = rig.moveDirection(input);
  player.update(dt, moveDir, input.consumeJump(), input.sprint);
  rig.update(input, player.pos, dt);
  world.update(dt);

  renderer.render(scene, camera);

  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 0.5) {
    fpsEl.textContent = `${Math.round(fpsFrames / fpsAccum)} fps`;
    fpsAccum = 0;
    fpsFrames = 0;
  }
  requestAnimationFrame(frame);
}
// Render the first frame immediately (don't wait for rAF), then run the loop.
frame(performance.now());
