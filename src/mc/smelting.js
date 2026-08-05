// Furnace smelting: what each input smelts into, and how long fuels burn.

import { B } from './blocks.js';
import { I } from './items.js';

export const SMELT_TIME = 4; // seconds to smelt one item

const SMELT = {
  [B.IRON_ORE]: { id: I.IRON_INGOT, count: 1 },
  [B.SAND]: { id: B.GLASS, count: 1 },
  [B.COBBLE]: { id: B.STONE, count: 1 },
  [I.RAW_BEEF]: { id: I.STEAK, count: 1 }, // cook beef into steak
  [I.RAW_PORK]: { id: I.COOKED_PORK, count: 1 },
  [I.RAW_MUTTON]: { id: I.COOKED_MUTTON, count: 1 },
};
export const smeltResult = (id) => (id == null ? null : SMELT[id] || null);

// Fuel → seconds of burn it provides.
const FUEL = {
  [I.COAL]: 24, [B.WOOD]: 6, [B.PLANK]: 6, [I.STICK]: 2,
};
export const fuelSeconds = (id) => (id == null ? 0 : FUEL[id] || 0);
