// Main menu and new-game configuration. Emits a start config
// { mode, aiLevel, aiColor, humanColor, time } via onStart, or navigates to the
// Settings / How-to-Play screens via onNavigate. `time` is
// { minutes, increment, delay } (minutes null = unlimited).

import { DIFFICULTY_LABELS } from '../ai/difficulty.js';
import { WHITE, BLACK } from '../engine/pieces.js';

// Preset time controls grouped by category. Each item is [label, minutes, increment].
export const TIME_PRESETS = [
  ['Bullet', [['1+0', 1, 0], ['2+1', 2, 1]]],
  ['Blitz', [['3+0', 3, 0], ['3+2', 3, 2], ['5+0', 5, 0], ['5+3', 5, 3]]],
  ['Rapid', [['10+0', 10, 0], ['10+5', 10, 5], ['15+10', 15, 10]]],
  ['Classical', [['30+0', 30, 0], ['30+20', 30, 20]]],
];

const presetKey = (m, i) => `${m}-${i}`;

export class Menu {
  constructor(root, { onStart, onNavigate }) {
    this.root = root;
    this.onStart = onStart;
    this.onNavigate = onNavigate;
    this.config = {
      aiLevel: 'medium',
      aiColorChoice: 'white',
      timeKey: 'unlimited',
      time: { minutes: null, increment: 0, delay: 0 },
    };
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

  // --- Time-control chooser (shared by both config panels) -----------------
  _timeField() {
    const key = this.config.timeKey;
    const categories = TIME_PRESETS.map(([cat, items]) => {
      const buttons = items
        .map(
          ([label, m, i]) =>
            `<button data-tc="${presetKey(m, i)}" data-m="${m}" data-i="${i}" class="${
              key === presetKey(m, i) ? 'selected' : ''
            }">${label}</button>`,
        )
        .join('');
      return `<div class="tc-cat"><span class="tc-label">${cat}</span><div class="option-row">${buttons}</div></div>`;
    }).join('');

    const c = this.config.time;
    const customPanel = `
      <div class="custom-time" ${key === 'custom' ? '' : 'hidden'}>
        <div class="option-row">
          <label class="num">Minutes<input type="number" min="0" max="180" step="1" data-cf="minutes" value="${
            key === 'custom' ? c.minutes ?? 5 : 5
          }"/></label>
          <label class="num">Increment (s)<input type="number" min="0" max="60" step="1" data-cf="increment" value="${
            key === 'custom' ? c.increment : 0
          }"/></label>
          <label class="num">Delay (s)<input type="number" min="0" max="60" step="1" data-cf="delay" value="${
            key === 'custom' ? c.delay : 0
          }"/></label>
        </div>
      </div>`;

    return `
      <div class="field">
        <label>Time control</label>
        <div class="time-presets">
          ${categories}
          <div class="tc-cat"><span class="tc-label">Other</span><div class="option-row">
            <button data-tc="unlimited" class="${key === 'unlimited' ? 'selected' : ''}">Unlimited</button>
            <button data-tc="custom" class="${key === 'custom' ? 'selected' : ''}">Custom…</button>
          </div></div>
        </div>
        ${customPanel}
      </div>`;
  }

  _bindTimeField() {
    const selectButton = (btn) => {
      this.root.querySelectorAll('[data-tc]').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    this.root.querySelectorAll('[data-tc]').forEach((btn) => {
      btn.onclick = () => {
        const tc = btn.dataset.tc;
        this.config.timeKey = tc;
        const panel = this.root.querySelector('.custom-time');
        if (tc === 'unlimited') {
          this.config.time = { minutes: null, increment: 0, delay: 0 };
          if (panel) panel.hidden = true;
        } else if (tc === 'custom') {
          this._readCustom();
          if (panel) panel.hidden = false;
        } else {
          this.config.time = { minutes: Number(btn.dataset.m), increment: Number(btn.dataset.i), delay: 0 };
          if (panel) panel.hidden = true;
        }
        selectButton(btn);
      };
    });
    this.root.querySelectorAll('input[data-cf]').forEach((input) => {
      input.oninput = () => this._readCustom();
    });
  }

  _readCustom() {
    const num = (sel, fallback) => {
      const el = this.root.querySelector(`input[data-cf="${sel}"]`);
      const v = el ? Number(el.value) : fallback;
      return Number.isFinite(v) && v >= 0 ? v : fallback;
    };
    const minutes = num('minutes', 5);
    this.config.time = {
      minutes: minutes === 0 ? null : minutes, // 0 minutes = unlimited
      increment: num('increment', 0),
      delay: num('delay', 0),
    };
  }

  // --- Play vs AI ----------------------------------------------------------
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
      ['white', 'White'],
      ['black', 'Black'],
      ['random', 'Random'],
    ]
      .map(
        ([id, label]) =>
          `<button data-color="${id}" class="${
            this.config.aiColorChoice === id ? 'selected' : ''
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
        time: this.config.time,
      });
    };
  }

  // --- Local multiplayer ---------------------------------------------------
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
      this.onStart({ mode: 'pvp', humanColor: WHITE, time: this.config.time });
    };
  }
}
