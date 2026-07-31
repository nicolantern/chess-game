// Block types and their per-face colors. Faces are shaded by direction at mesh
// time (top brightest, bottom darkest) so flat colors still read as Minecraft.

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5,
  WOOD: 6, LEAVES: 7, PLANK: 8, COBBLE: 9,
};

const C = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// Each entry: { top, side, bottom } face colors.
const DEF = {
  [B.GRASS]: { top: C('#6ab04c'), side: C('#836a3c'), bottom: C('#7a5a38') },
  [B.DIRT]: { top: C('#7a5a38'), side: C('#7a5a38'), bottom: C('#7a5a38') },
  [B.STONE]: { top: C('#909090'), side: C('#909090'), bottom: C('#909090') },
  [B.SAND]: { top: C('#ddd09a'), side: C('#d6c98f'), bottom: C('#d6c98f') },
  [B.WOOD]: { top: C('#b28d52'), side: C('#6f5230'), bottom: C('#b28d52') },
  [B.LEAVES]: { top: C('#428f38'), side: C('#3c8433'), bottom: C('#34742d') },
  [B.PLANK]: { top: C('#b98d54'), side: C('#b98d54'), bottom: C('#a67e49') },
  [B.COBBLE]: { top: C('#828282'), side: C('#7a7a7a'), bottom: C('#727272') },
  [B.WATER]: { top: C('#3f86c8'), side: C('#3f86c8'), bottom: C('#3f86c8') },
};

/** Solid = blocks the player and stops a ray (everything but air and water). */
export const isSolid = (t) => t !== B.AIR && t !== B.WATER;
/** Opaque = hides the neighbor face behind it (air and water are see-through). */
export const isOpaque = (t) => t !== B.AIR && t !== B.WATER;

export function faceColor(type, cat) {
  return (DEF[type] || DEF[B.STONE])[cat];
}

// The blocks you can place, in hotbar order.
export const HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.SAND, B.WOOD, B.LEAVES, B.PLANK, B.COBBLE];
export const NAMES = {
  [B.GRASS]: 'Grass', [B.DIRT]: 'Dirt', [B.STONE]: 'Stone', [B.SAND]: 'Sand',
  [B.WOOD]: 'Wood', [B.LEAVES]: 'Leaves', [B.PLANK]: 'Planks', [B.COBBLE]: 'Cobble',
};

export const swatchCss = (t) => {
  const c = faceColor(t, 'top');
  return `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
};
