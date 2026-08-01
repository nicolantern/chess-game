// A 36-slot inventory with 64-stacks. Slots 0..8 are the hotbar; 9..35 are main
// storage. Mining adds items (filling partial stacks first, then empty slots);
// placing spends from the selected hotbar slot. The inventory GUI swaps slots.

export const STACK = 64;

export class Inventory {
  constructor(size = 36, hotbar = 9) {
    this.size = size;
    this.hotbar = hotbar;
    this.slots = new Array(size).fill(null); // each: { type, count } | null
    this.sel = 0; // selected hotbar index (0..hotbar-1)
  }

  /** Add `count` of a block type; returns any leftover that didn't fit. */
  add(type, count = 1) {
    for (let i = 0; i < this.size && count > 0; i++) {
      const s = this.slots[i];
      if (s && s.type === type && s.count < STACK) {
        const n = Math.min(STACK - s.count, count);
        s.count += n;
        count -= n;
      }
    }
    for (let i = 0; i < this.size && count > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(STACK, count);
        this.slots[i] = { type, count: n };
        count -= n;
      }
    }
    return count;
  }

  selected() { return this.slots[this.sel]; }
  selectedType() { return this.slots[this.sel] ? this.slots[this.sel].type : null; }

  /** Consume one of the selected item; returns true if something was spent. */
  spendSelected() {
    const s = this.slots[this.sel];
    if (!s) return false;
    s.count -= 1;
    if (s.count <= 0) this.slots[this.sel] = null;
    return true;
  }

  /** Move/merge slot a into slot b (for the inventory GUI). */
  moveSlot(a, b) {
    if (a === b) return;
    const sa = this.slots[a];
    const sb = this.slots[b];
    if (sa && sb && sa.type === sb.type) {
      const n = Math.min(STACK - sb.count, sa.count); // merge stacks
      sb.count += n;
      sa.count -= n;
      if (sa.count <= 0) this.slots[a] = null;
    } else {
      this.slots[a] = sb; // swap
      this.slots[b] = sa;
    }
  }
}
