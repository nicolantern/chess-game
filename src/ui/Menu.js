// Main menu and new-game configuration. Emits a start config
// { mode, aiLevel, aiColor, timeMinutes } via onStart, or navigates to the
// Settings / How-to-Play screens via onNavigate.

import { DIFFICULTY_LABELS } from '../ai/difficulty.js';
import { WHITE, BLACK } from '../engine/pieces.js';

export const TIME_CONTROLS = [
  { label: '1 min', minutes: 1 },
  { label: '3 min', minutes: 3 },
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: 'Unlimited', minutes: null },
];

export class Menu {
  constructor(root, { onStart, onNavigate }) {
    this.root = root;
    this.onStart = onStart;
    this.onNavigate = onNavigate;
    // Defaults for the configuration panels.
    this.config = { aiLevel: 'medium', aiColor: BLACK, timeMinutes: null };
    this.renderMain();
  }

  renderMain() {
    this.root.innerHTML = `
      <div class="menu">
        <h1>♞ Chess</h1>
        <p class="subtitle">A polished chess game — play a friend or the computer.</p>
        <div class="menu-grid">
          <button class="primary" data-act="ai">Play vs AI</button>
          <button data-act="pvp">Local Multiplayer</button>
          <button data-act="settings">Settings</button>
          <button data-act="howto">How to Play</button>
        </div>
      </div>`;
    this.root.querySelector('[data-act="ai"]').onclick = () => this.renderAIConfig();
    this.root.querySelector('[data-act="pvp"]').onclick = () => this.renderPvPConfig();
    this.root.querySelector('[data-act="settings"]').onclick = () => this.onNavigate('settings');
    this.root.querySelector('[data-act="howto"]').onclick = () => this.onNavigate('howto');
  }

  // Reusable time-control chooser bound to this.config.timeMinutes.
  _timeField() {
    const buttons = TIME_CONTROLS.map(
      (tc) =>
        `<button data-min="${tc.minutes}" class="${
          this.config.timeMinutes === tc.minutes ? 'selected' : ''
        }">${tc.label}</button>`,
    ).join('');
    return `<div class="field"><label>Time control</label><div class="option-row">${buttons}</div></div>`;
  }

  _bindTimeField() {
    this.root.querySelectorAll('[data-min]').forEach((btn) => {
      btn.onclick = () => {
        const v = btn.dataset.min;
        this.config.timeMinutes = v === 'null' ? null : Number(v);
        this.root.querySelectorAll('[data-min]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
    });
  }

  renderAIConfig() {
    const levels = Object.entries(DIFFICULTY_LABELS)
      .map(
        ([key, label]) =>
          `<button data-level="${key}" class="${
            this.config.aiLevel === key ? 'selected' : ''
          }">${label}</button>`,
      )
      .join('');
    const colors = [
      ['white', WHITE, 'White'],
      ['black', BLACK, 'Black'],
      ['random', 'random', 'Random'],
    ]
      .map(
        ([id, val, label]) =>
          `<button data-color="${id}" class="${
            this.config.aiColorChoice === id || (!this.config.aiColorChoice && id === 'white')
              ? 'selected'
              : ''
          }">${label}</button>`,
      )
      .join('');

    this.root.innerHTML = `
      <div class="panel">
        <h2>Play vs AI</h2>
        <div class="field"><label>Difficulty</label><div class="option-row">${levels}</div></div>
        <div class="field"><label>You play</label><div class="option-row">${colors}</div></div>
        ${this._timeField()}
        <div class="actions">
          <button data-act="back">Back</button>
          <button class="primary" data-act="start">Start Game</button>
        </div>
      </div>`;

    this.config.aiColorChoice = this.config.aiColorChoice || 'white';
    this.root.querySelectorAll('[data-level]').forEach((btn) => {
      btn.onclick = () => {
        this.config.aiLevel = btn.dataset.level;
        this.root.querySelectorAll('[data-level]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
    });
    this.root.querySelectorAll('[data-color]').forEach((btn) => {
      btn.onclick = () => {
        this.config.aiColorChoice = btn.dataset.color;
        this.root.querySelectorAll('[data-color]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
    });
    this._bindTimeField();
    this.root.querySelector('[data-act="back"]').onclick = () => this.renderMain();
    this.root.querySelector('[data-act="start"]').onclick = () => {
      let human = this.config.aiColorChoice;
      if (human === 'random') human = Math.random() < 0.5 ? 'white' : 'black';
      const humanColor = human === 'white' ? WHITE : BLACK;
      this.onStart({
        mode: 'ai',
        aiLevel: this.config.aiLevel,
        aiColor: humanColor ^ 1,
        humanColor,
        timeMinutes: this.config.timeMinutes,
      });
    };
  }

  renderPvPConfig() {
    this.root.innerHTML = `
      <div class="panel">
        <h2>Local Multiplayer</h2>
        <p class="subtitle">Two players, one device. White moves first.</p>
        ${this._timeField()}
        <div class="actions">
          <button data-act="back">Back</button>
          <button class="primary" data-act="start">Start Game</button>
        </div>
      </div>`;
    this._bindTimeField();
    this.root.querySelector('[data-act="back"]').onclick = () => this.renderMain();
    this.root.querySelector('[data-act="start"]').onclick = () => {
      this.onStart({ mode: 'pvp', humanColor: WHITE, timeMinutes: this.config.timeMinutes });
    };
  }
}
