// A 36-slot inventory. Slots 0..8 are the hotbar; 9..35 are storage. Each slot is
// null or { id, count, dur? } — id < 1000 is a block, id >= 1000 an item (tools
// carry `dur`). Blocks/materials stack to 64; tools take a slot each and wear out.

import { isStackable, maxDurability } from './items.js';

export const STACK = 64;

export class Inventory {
  constructor(size = 36, hotbar = 9) {
    this.size = size;
    this.hotbar = hotbar;
    this.slots = new Array(size).fill(null);
    this.sel = 0;
  }

  /** Add items; returns leftover that didn't fit. Tools take a slot each. */
  add(id, count = 1) {
    if (!isStackable(id)) {
      let placed = 0;
      for (let i = 0; i < this.size && placed < count; i++) {
        if (!this.slots[i]) { this.slots[i] = { id, count: 1, dur: maxDurability(id) }; placed++; }
      }
      return count - placed;
    }
    for (let i = 0; i < this.size && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < STACK) { const n = Math.min(STACK - s.count, count); s.count += n; count -= n; }
    }
    for (let i = 0; i < this.size && count > 0; i++) {
      if (!this.slots[i]) { const n = Math.min(STACK, count); this.slots[i] = { id, count: n }; count -= n; }
    }
    return count;
  }

  selected() { return this.slots[this.sel]; }
  selectedId() { return this.slots[this.sel] ? this.slots[this.sel].id : null; }

  /** Consume one of the selected item. */
  spendSelected() {
    const s = this.slots[this.sel];
    if (!s) return false;
    s.count -= 1;
    if (s.count <= 0) this.slots[this.sel] = null;
    return true;
  }

  /** Wear a tool in slot i by n; break it (clear the slot) at 0 durability. */
  damageSlot(i, n = 1) {
    const s = this.slots[i];
    if (!s || s.dur == null) return;
    s.dur -= n;
    if (s.dur <= 0) this.slots[i] = null;
  }
}
