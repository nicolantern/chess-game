// Online matchmaking: pick a time control, join the queue, and wait for the
// server to pair you. The 'matched' event is handled by the App (which swaps in
// the game screen), so this screen only owns the pick + waiting states.

import { TIME_PRESETS } from './timeControls.js';

export class OnlineScreen {
  constructor(root, { realtime, onCancel }) {
    this.root = root;
    this.realtime = realtime;
    this.onCancel = onCancel;
    this.selected = { key: '3-0', time: { minutes: 3, increment: 0, delay: 0 } };
    this._offQueued = realtime.on('queued', () => this._renderWaiting());
    this.renderPick();
  }

  renderPick() {
    const rows = TIME_PRESETS.map(([cat, items]) => {
      const buttons = items
        .map(
          ([label, m, i]) =>
            `<button data-key="${m}-${i}" data-m="${m}" data-i="${i}" class="${
              this.selected.key === `${m}-${i}` ? 'selected' : ''
            }">${label}</button>`,
        )
        .join('');
      return `<div class="tc-cat"><span class="tc-label">${cat}</span><div class="option-row">${buttons}</div></div>`;
    }).join('');

    this.root.innerHTML = `
      <div class="panel">
        <h2>Play Online</h2>
        <p class="subtitle">You'll be matched with another player choosing the same time control.</p>
        <div class="field"><label>Time control</label>
          <div class="time-presets">
            ${rows}
            <div class="tc-cat"><span class="tc-label">Other</span><div class="option-row">
              <button data-key="unlimited">Unlimited</button>
            </div></div>
          </div>
        </div>
        <div class="actions">
          <button data-act="back">Back</button>
          <button class="primary" data-act="find">Find Opponent</button>
        </div>
      </div>`;

    this.root.querySelectorAll('[data-key]').forEach((btn) => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        this.selected =
          key === 'unlimited'
            ? { key, time: { minutes: null, increment: 0, delay: 0 } }
            : { key, time: { minutes: Number(btn.dataset.m), increment: Number(btn.dataset.i), delay: 0 } };
        this.root.querySelectorAll('[data-key]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
    });
    this.root.querySelector('[data-act="back"]').onclick = () => this.onCancel();
    this.root.querySelector('[data-act="find"]').onclick = () => {
      this.realtime.queue(this.selected.time);
      this._renderWaiting();
    };
  }

  _renderWaiting() {
    this.root.innerHTML = `
      <div class="panel waiting">
        <h2>Finding an opponent…</h2>
        <div class="spinner"></div>
        <p class="subtitle">Waiting for another player. This stays open until someone joins.</p>
        <div class="actions"><button data-act="cancel">Cancel</button></div>
      </div>`;
    this.root.querySelector('[data-act="cancel"]').onclick = () => {
      this.realtime.cancel();
      this.onCancel();
    };
  }

  destroy() {
    if (this._offQueued) this._offQueued();
  }
}
