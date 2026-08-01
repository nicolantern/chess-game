// Block types and their properties: per-face colours (for hotbar swatches and
// break particles), atlas tile mapping (see textures.js), solidity/opacity/
// transparency, gravity, and break times. Faces are shaded by direction at mesh
// time so flat colours still read as Minecraft.

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5,
  WOOD: 6, LEAVES: 7, PLANK: 8, COBBLE: 9,
  GRAVEL: 10, GLASS: 11, COAL_ORE: 12, IRON_ORE: 13, SNOW: 14,
};

const C = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// Face colours { top, side, bottom } — used for hotbar swatches and particles.
const DEF = {
  [B.GRASS]: { top: C('#6ab04c'), side: C('#836a3c'), bottom: C('#7a5a38') },
  [B.DIRT]: { top: C('#7a5a38'), side: C('#7a5a38'), bottom: C('#7a5a38') },
  [B.STONE]: { top: C('#909090'), side: C('#909090'), bottom: C('#909090') },
  [B.SAND]: { top: C('#ddd09a'), side: C('#d6c98f'), bottom: C('#d6c98f') },
  [B.WOOD]: { top: C('#b28d52'), side: C('#6f5230'), bottom: C('#b28d52') },
  [B.LEAVES]: { top: C('#428f38'), side: C('#3c8433'), bottom: C('#34742d') },
  [B.PLANK]: { top: C('#b98d54'), side: C('#b98d54'), bottom: C('#a67e49') },
  [B.COBBLE]: { top: C('#828282'), side: C('#7a7a7a'), bottom: C('#727272') },
  [B.GRAVEL]: { top: C('#9a9088'), side: C('#948a82'), bottom: C('#8c837b') },
  [B.GLASS]: { top: C('#bfe6f0'), side: C('#bfe6f0'), bottom: C('#bfe6f0') },
  [B.COAL_ORE]: { top: C('#6f6f6f'), side: C('#6f6f6f'), bottom: C('#6f6f6f') },
  [B.IRON_ORE]: { top: C('#a9968a'), side: C('#a9968a'), bottom: C('#a9968a') },
  [B.SNOW]: { top: C('#eef3f7'), side: C('#e6ecf2'), bottom: C('#dfe6ec') },
  [B.WATER]: { top: C('#3f86c8'), side: C('#3f86c8'), bottom: C('#3f86c8') },
};

// Atlas tile indices (4×4 atlas — see textures.js) and per-face mapping.
export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, SAND: 4,
  WOOD_TOP: 5, WOOD_SIDE: 6, LEAVES: 7, PLANK: 8, COBBLE: 9, WATER: 10,
  GRAVEL: 11, GLASS: 12, COAL_ORE: 13, IRON_ORE: 14, SNOW: 15,
};

export function faceTile(type, cat) {
  switch (type) {
    case B.GRASS: return cat === 'top' ? TILE.GRASS_TOP : cat === 'bottom' ? TILE.DIRT : TILE.GRASS_SIDE;
    case B.DIRT: return TILE.DIRT;
    case B.STONE: return TILE.STONE;
    case B.SAND: return TILE.SAND;
    case B.WOOD: return cat === 'side' ? TILE.WOOD_SIDE : TILE.WOOD_TOP;
    case B.LEAVES: return TILE.LEAVES;
    case B.PLANK: return TILE.PLANK;
    case B.COBBLE: return TILE.COBBLE;
    case B.GRAVEL: return TILE.GRAVEL;
    case B.GLASS: return TILE.GLASS;
    case B.COAL_ORE: return TILE.COAL_ORE;
    case B.IRON_ORE: return TILE.IRON_ORE;
    case B.SNOW: return TILE.SNOW;
    case B.WATER: return TILE.WATER;
    default: return TILE.STONE;
  }
}

// Seconds of holding left-click to break each block.
export const BREAK_TIME = {
  [B.GRASS]: 0.75, [B.DIRT]: 0.75, [B.SAND]: 0.6, [B.GRAVEL]: 0.6, [B.LEAVES]: 0.3,
  [B.SNOW]: 0.2, [B.GLASS]: 0.3, [B.STONE]: 2.5, [B.COBBLE]: 3, [B.WOOD]: 3,
  [B.PLANK]: 2.5, [B.COAL_ORE]: 3, [B.IRON_ORE]: 3.5,
};
export const breakTime = (t) => BREAK_TIME[t] ?? 1;

/** Solid = blocks the player and stops a mining ray (air and water do not). */
export const isSolid = (t) => t !== B.AIR && t !== B.WATER;
/** Opaque = fully hides the face of the neighbour behind it. */
export const isOpaque = (t) => t !== B.AIR && t !== B.WATER && t !== B.GLASS;
/** Transparent solids (glass) render in their own pass. */
export const isGlass = (t) => t === B.GLASS;
/** Gravity blocks fall when unsupported. */
export const isGravity = (t) => t === B.SAND || t === B.GRAVEL;

export function faceColor(type, cat) {
  return (DEF[type] || DEF[B.STONE])[cat];
}

export const NAMES = {
  [B.GRASS]: 'Grass', [B.DIRT]: 'Dirt', [B.STONE]: 'Stone', [B.SAND]: 'Sand',
  [B.WOOD]: 'Wood', [B.LEAVES]: 'Leaves', [B.PLANK]: 'Planks', [B.COBBLE]: 'Cobble',
  [B.GRAVEL]: 'Gravel', [B.GLASS]: 'Glass', [B.COAL_ORE]: 'Coal Ore',
  [B.IRON_ORE]: 'Iron Ore', [B.SNOW]: 'Snow',
};

export const swatchCss = (t) => {
  const c = faceColor(t, 'top');
  return `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
};
