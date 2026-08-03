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
};

export const itemDef = (id) => DEFS[id];
export const itemName = (id) => (DEFS[id] ? DEFS[id].name : 'Item');
export const itemIcon = (id) => (DEFS[id] ? DEFS[id].icon : '❔');
export const isTool = (id) => Boolean(DEFS[id] && DEFS[id].tool);
export const isStackable = (id) => !isItem(id) || Boolean(DEFS[id] && DEFS[id].stack);
export const maxDurability = (id) => (isTool(id) ? DEFS[id].tool.dur : 0);
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
