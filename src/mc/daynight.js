// Smooth day/night cycle. Advances a time-of-day fraction and, from the sun's
// elevation, drives the sky colour, fog colour, and a global brightness that is
// multiplied into the (unlit) block materials — so the world darkens at night
// and warms at sunrise/sunset. `isNight` lets game logic (e.g. mob spawns) react.

import * as THREE from 'three';

export class DayNight {
  constructor(scene, world, { length = 240, start = 0.3 } = {}) {
    this.scene = scene;
    this.world = world;
    this.length = length; // seconds for a full day+night
    this.t = start; // 0..1 (0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset)

    this.daySky = new THREE.Color('#8ec5ff');
    this.nightSky = new THREE.Color('#070b1c');
    this.dayFog = new THREE.Color('#a9d4ff');
    this.nightFog = new THREE.Color('#070b1c');
    this.warm = new THREE.Color('#ff9a52');

    this._sky = new THREE.Color();
    this._fog = new THREE.Color();
    scene.background = this._sky; // mutated each frame
  }

  update(dt) {
    this.t = (this.t + dt / this.length) % 1;
    const ang = this.t * Math.PI * 2;
    const sun = -Math.cos(ang); // elevation: -1 midnight → +1 noon
    const day = THREE.MathUtils.clamp(sun * 1.3 + 0.25, 0, 1);
    const horizon = THREE.MathUtils.clamp(1 - Math.abs(sun) * 2.4, 0, 1); // sunrise/sunset glow

    this._sky.copy(this.nightSky).lerp(this.daySky, day).lerp(this.warm, horizon * 0.5);
    this._fog.copy(this.nightFog).lerp(this.dayFog, day).lerp(this.warm, horizon * 0.4);
    if (this.scene.fog) this.scene.fog.color.copy(this._fog);

    const bright = 0.26 + 0.74 * day;
    this.world.opaqueMat.color.setScalar(bright);
    this.world.waterMat.color.setScalar(bright);
    this.world.glassMat.color.setScalar(bright);
  }

  get isNight() {
    return -Math.cos(this.t * Math.PI * 2) < -0.1;
  }
}
