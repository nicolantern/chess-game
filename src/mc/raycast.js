// Amanatides–Woo voxel ray traversal: step through the grid from `origin` along
// `dir`, returning the first solid block hit plus the normal of the face entered
// (used to place a new block against that face). Returns null if nothing within
// `maxDist` blocks.

import { isSolid } from './blocks.js';

export function raycast(world, origin, dir, maxDist = 6) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x);
  const stepY = Math.sign(dir.y);
  const stepZ = Math.sign(dir.z);
  const invX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const invY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const invZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  // Distance to the first grid boundary on each axis.
  let tMaxX = stepX > 0 ? (x + 1 - origin.x) * invX : stepX < 0 ? (origin.x - x) * invX : Infinity;
  let tMaxY = stepY > 0 ? (y + 1 - origin.y) * invY : stepY < 0 ? (origin.y - y) * invY : Infinity;
  let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * invZ : stepZ < 0 ? (origin.z - z) * invZ : Infinity;
  let nx = 0, ny = 0, nz = 0;
  let t = 0;

  while (t <= maxDist) {
    if (isSolid(world.get(x, y, z))) return { x, y, z, nx, ny, nz };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += invX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += invY; nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += invZ; nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return null;
}
