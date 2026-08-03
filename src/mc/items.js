// Non-block items (tools + materials). Item ids live at 1000+ so a single number
// space distinguishes them from block ids (< 1000) in inventory slots. Tools
// carry a mining class + speed multiplier, durability, and attack damage.

import { B } from './blocks.js';

export const ITEM_BASE = 1000;
export const isItem = (id) => id >= ITEM_BASE;

export const I = {
  STICK: 1000,
  WOOD_PICK: 1001, WOOD_AXE: 1002, WOOD_SHOVEL: 1003, WOOD_SWORD: 1004,
  STONE_PICK: 1011, STONE_AXE: 1012, STONE_SHOVEL: 1013, STONE_SWORD: 1014,
  COAL: 1020, IRON_INGOT: 1021, DIAMOND: 1022,
  IRON_PICK: 1031, IRON_AXE: 1032, IRON_SHOVEL: 1033, IRON_SWORD: 1034,
  DIA_PICK: 1041, DIA_AXE: 1042, DIA_SHOVEL: 1043, DIA_SWORD: 1044,
  IRON_HELM: 1051, IRON_CHEST: 1052, IRON_LEGS: 1053, IRON_BOOTS: 1054,
  DIA_HELM: 1061, DIA_CHEST: 1062, DIA_LEGS: 1063, DIA_BOOTS: 1064,
};

// tool: { cls: 'pick'|'axe'|'shovel'|'sword', speed, dur, dmg, tier }
const DEFS = {
  [I.STICK]: { name: 'Stick', icon: '🥢', stack: true },
  [I.WOOD_PICK]: { name: 'Wooden Pickaxe', icon: '⛏️', tier: 'wood', tool: { cls: 'pick', speed: 2, dur: 59, dmg: 2 } },
  [I.WOOD_AXE]: { name: 'Wooden Axe', icon: '🪓', tier: 'wood', tool: { cls: 'axe', speed: 2, dur: 59, dmg: 3 } },
  [I.WOOD_SHOVEL]: { name: 'Wooden Shovel', icon: '🥄', tier: 'wood', tool: { cls: 'shovel', speed: 2, dur: 59, dmg: 2 } },
  [I.WOOD_SWORD]: { name: 'Wooden Sword', icon: '🗡️', tier: 'wood', tool: { cls: 'sword', speed: 1, dur: 59, dmg: 4 } },
  [I.STONE_PICK]: { name: 'Stone Pickaxe', icon: '⛏️', tier: 'stone', tool: { cls: 'pick', speed: 4, dur: 131, dmg: 3 } },
  [I.STONE_AXE]: { name: 'Stone Axe', icon: '🪓', tier: 'stone', tool: { cls: 'axe', speed: 4, dur: 131, dmg: 4 } },
  [I.STONE_SHOVEL]: { name: 'Stone Shovel', icon: '🥄', tier: 'stone', tool: { cls: 'shovel', speed: 4, dur: 131, dmg: 3 } },
  [I.STONE_SWORD]: { name: 'Stone Sword', icon: '🗡️', tier: 'stone', tool: { cls: 'sword', speed: 1, dur: 131, dmg: 5 } },

  [I.COAL]: { name: 'Coal', icon: '⚫', stack: true },
  [I.IRON_INGOT]: { name: 'Iron Ingot', icon: '⬜', stack: true },
  [I.DIAMOND]: { name: 'Diamond', icon: '💎', stack: true },

  [I.IRON_PICK]: { name: 'Iron Pickaxe', icon: '⛏️', tier: 'iron', tool: { cls: 'pick', speed: 6, dur: 250, dmg: 4 } },
  [I.IRON_AXE]: { name: 'Iron Axe', icon: '🪓', tier: 'iron', tool: { cls: 'axe', speed: 6, dur: 250, dmg: 5 } },
  [I.IRON_SHOVEL]: { name: 'Iron Shovel', icon: '🥄', tier: 'iron', tool: { cls: 'shovel', speed: 6, dur: 250, dmg: 4 } },
  [I.IRON_SWORD]: { name: 'Iron Sword', icon: '🗡️', tier: 'iron', tool: { cls: 'sword', speed: 1, dur: 250, dmg: 6 } },

  [I.DIA_PICK]: { name: 'Diamond Pickaxe', icon: '⛏️', tier: 'diamond', tool: { cls: 'pick', speed: 8, dur: 1561, dmg: 5 } },
  [I.DIA_AXE]: { name: 'Diamond Axe', icon: '🪓', tier: 'diamond', tool: { cls: 'axe', speed: 8, dur: 1561, dmg: 6 } },
  [I.DIA_SHOVEL]: { name: 'Diamond Shovel', icon: '🥄', tier: 'diamond', tool: { cls: 'shovel', speed: 8, dur: 1561, dmg: 5 } },
  [I.DIA_SWORD]: { name: 'Diamond Sword', icon: '🗡️', tier: 'diamond', tool: { cls: 'sword', speed: 1, dur: 1561, dmg: 7 } },

  [I.IRON_HELM]: { name: 'Iron Helmet', icon: '🪖', tier: 'iron', armor: { slot: 'head', points: 2, dur: 165 } },
  [I.IRON_CHEST]: { name: 'Iron Chestplate', icon: '🦺', tier: 'iron', armor: { slot: 'chest', points: 6, dur: 240 } },
  [I.IRON_LEGS]: { name: 'Iron Leggings', icon: '👖', tier: 'iron', armor: { slot: 'legs', points: 5, dur: 225 } },
  [I.IRON_BOOTS]: { name: 'Iron Boots', icon: '🥾', tier: 'iron', armor: { slot: 'feet', points: 2, dur: 195 } },
  [I.DIA_HELM]: { name: 'Diamond Helmet', icon: '🪖', tier: 'diamond', armor: { slot: 'head', points: 3, dur: 363 } },
  [I.DIA_CHEST]: { name: 'Diamond Chestplate', icon: '🦺', tier: 'diamond', armor: { slot: 'chest', points: 8, dur: 528 } },
  [I.DIA_LEGS]: { name: 'Diamond Leggings', icon: '👖', tier: 'diamond', armor: { slot: 'legs', points: 6, dur: 495 } },
  [I.DIA_BOOTS]: { name: 'Diamond Boots', icon: '🥾', tier: 'diamond', armor: { slot: 'feet', points: 3, dur: 429 } },
};

export const itemDef = (id) => DEFS[id];
export const itemName = (id) => (DEFS[id] ? DEFS[id].name : 'Item');
export const itemIcon = (id) => (DEFS[id] ? DEFS[id].icon : '❔');
export const isTool = (id) => Boolean(DEFS[id] && DEFS[id].tool);
export const isArmor = (id) => Boolean(DEFS[id] && DEFS[id].armor);
export const armorSlot = (id) => (isArmor(id) ? DEFS[id].armor.slot : null);
export const armorPoints = (id) => (isArmor(id) ? DEFS[id].armor.points : 0);
export const isStackable = (id) => !isItem(id) || Boolean(DEFS[id] && DEFS[id].stack);
export const maxDurability = (id) => {
  const d = DEFS[id];
  return d ? (d.tool ? d.tool.dur : d.armor ? d.armor.dur : 0) : 0;
};
// Tier tints the slot border so you can tell wood from stone at a glance.
export const tierColor = (id) => ({ wood: '#8a6a3c', stone: '#8f8f8f', iron: '#dcdcd6', diamond: '#5ad6d0' }[DEFS[id] && DEFS[id].tier] || null);

// Which tool class mines a given block fastest.
function blockClass(bt) {
  if (bt === B.STONE || bt === B.COBBLE || bt === B.COAL_ORE || bt === B.IRON_ORE) return 'pick';
  if (bt === B.WOOD || bt === B.PLANK) return 'axe';
  if (bt === B.DIRT || bt === B.GRASS || bt === B.SAND || bt === B.GRAVEL || bt === B.SNOW) return 'shovel';
  return null;
}

/** Mining speed multiplier for using `toolId` on `blockType` (1 = bare hand). */
export function miningMultiplier(toolId, blockType) {
  const d = DEFS[toolId];
  if (!d || !d.tool) return 1;
  return blockClass(blockType) === d.tool.cls ? d.tool.speed : 1;
}

/** Melee damage for the held item (bare hand = 1). */
export function attackDamage(toolId) {
  const d = DEFS[toolId];
  return d && d.tool ? d.tool.dmg : 1;
}
