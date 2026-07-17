// Promotion picker: a modal overlay offering Queen / Rook / Bishop / Knight in
// the promoting side's color. `choose(color)` resolves to the chosen piece type
// constant, or null if the player cancels (backdrop click / Escape).

import { QUEEN, ROOK, BISHOP, KNIGHT } from '../engine/pieces.js';
import { pieceSvg } from '../assets/pieces.js';

const CHOICES = [QUEEN, ROOK, BISHOP, KNIGHT];

export class PromotionDialog {
  constructor(root = document.body) {
    this.root = root;
  }

  choose(color) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = '<h2>Promote to</h2>';
      const row = document.createElement('div');
      row.className = 'promo-choices';

      const done = (value) => {
        window.removeEventListener('keydown', onKey);
        backdrop.remove();
        resolve(value);
      };

      for (const type of CHOICES) {
        const btn = document.createElement('button');
        btn.innerHTML = pieceSvg(color, type);
        btn.title = { [QUEEN]: 'Queen', [ROOK]: 'Rook', [BISHOP]: 'Bishop', [KNIGHT]: 'Knight' }[type];
        btn.addEventListener('click', () => done(type));
        row.appendChild(btn);
      }
      modal.appendChild(row);
      backdrop.appendChild(modal);

      backdrop.addEventListener('pointerdown', (e) => {
        if (e.target === backdrop) done(null);
      });
      const onKey = (e) => {
        if (e.key === 'Escape') done(null);
      };
      window.addEventListener('keydown', onKey);

      this.root.appendChild(backdrop);
    });
  }
}
