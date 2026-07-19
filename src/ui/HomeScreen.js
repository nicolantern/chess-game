// The home screen: a dark, three-column chess.com-style layout — left nav, a
// centered decorative board, and a right "Play Chess" panel of action cards.
// Also owns the two start-config sub-panels (vs AI, Pass & Play), which replace
// the whole home view until Back is pressed. Wired only to real features.

import { DIFFICULTY_LABELS } from '../ai/difficulty.js';
import { TIME_PRESETS, buildAiConfig, buildPvpConfig } from './timeControls.js';
import { BoardView } from './BoardView.js';
import { parseFen, START_FEN } from '../engine/fen.js';
import { randomTagline } from './taglines.js';
import { t, currentLanguageLabel } from '../utils/i18n.js';

const presetKey = (m, i) => `${m}-${i}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class HomeScreen {
  /**
   * @param {HTMLElement} root
   * @param {object} opts  onStart, onNavigate, onPlayFriend, resumeAvailable, onResume, account, settings
   */
  constructor(root, { onStart, onNavigate, onPlayFriend, onLanguage, resumeAvailable = false, onResume, account, settings }) {
    this.root = root;
    this.onStart = onStart;
    this.onNavigate = onNavigate;
    this.onPlayFriend = onPlayFriend || (() => {});
    this.onLanguage = onLanguage || (() => {});
    this.resumeAvailable = resumeAvailable;
    this.onResume = onResume || (() => {});
    this.account = account || { loggedIn: false, username: null, onLogout: () => {} };
    this.settings = settings || { highlights: false };
    this.config = { aiLevel: 'medium', aiColorChoice: 'white', timeKey: 'unlimited', time: { minutes: null, increment: 0, delay: 0 } };
    this.renderHome();
  }

  destroy() {
    clearInterval(this._splashTimer);
    this._board = null;
  }

  // Rotate the playful splash line every few seconds while the home is shown.
  _startSplash() {
    clearInterval(this._splashTimer);
    this._splashTimer = setInterval(() => {
      const el = this.root.querySelector('[data-splash]');
      if (el) el.textContent = randomTagline();
    }, 7000);
  }

  // --- Layout --------------------------------------------------------------
  _sidebar() {
    const acct = this.account.loggedIn
      ? `<div class="nav-account">
           <span class="who">👤 ${esc(this.account.username)}</span>
           <button data-act="logout" class="nav-btn ghost">${esc(t('account.logout'))}</button>
         </div>`
      : `<div class="nav-account">
           <button data-act="account" class="nav-btn login">${esc(t('account.login'))}</button>
           <button data-act="signup" class="nav-btn signup">${esc(t('account.signup'))}</button>
         </div>`;
    return `
      <nav class="home-nav">
        <div class="brand">♞ <span>Chess</span></div>
        <ul class="nav-list">
          <li><button class="nav-item active" data-nav="play"><span class="ni">♟</span> ${esc(t('nav.play'))}</button></li>
          <li><button class="nav-item" data-nav="howto"><span class="ni">🎓</span> ${esc(t('nav.learn'))}</button></li>
          <li><button class="nav-item" data-nav="stats"><span class="ni">📊</span> ${esc(t('nav.stats'))}</button></li>
          <li><button class="nav-item" data-nav="settings"><span class="ni">⚙️</span> ${esc(t('nav.settings'))}</button></li>
        </ul>
        <button class="nav-lang" data-act="language">🌐 ${esc(currentLanguageLabel())}</button>
        ${acct}
      </nav>`;
  }

  _cards() {
    const resume = this.resumeAvailable
      ? `<button class="play-card resume" data-act="resume">
           <span class="pc-icon">▶</span>
           <span class="pc-text"><strong>${esc(t('card.resume.title'))}</strong><small>${esc(t('card.resume.sub'))}</small></span>
         </button>`
      : '';
    const onlineHint = this.account.loggedIn ? '' : ` <span class="hint">${esc(t('card.online.hint'))}</span>`;
    return `
      <aside class="home-play">
        <h2 class="play-title">♟ ${esc(t('play.title'))}</h2>
        <p class="splash" data-splash>${esc(randomTagline())}</p>
        <div class="play-cards">
          ${resume}
          <button class="play-card" data-act="online">
            <span class="pc-icon">⚡</span>
            <span class="pc-text"><strong>${esc(t('card.online.title'))}${onlineHint}</strong><small>${esc(t('card.online.sub'))}</small></span>
          </button>
          <button class="play-card" data-act="ai">
            <span class="pc-icon">🤖</span>
            <span class="pc-text"><strong>${esc(t('card.bots.title'))}</strong><small>${esc(t('card.bots.sub'))}</small></span>
          </button>
          <button class="play-card" data-act="friend">
            <span class="pc-icon">🤝</span>
            <span class="pc-text"><strong>${esc(t('card.friend.title'))}</strong><small>${esc(t('card.friend.sub'))}</small></span>
          </button>
          <button class="play-card" data-act="pvp">
            <span class="pc-icon">👥</span>
            <span class="pc-text"><strong>${esc(t('card.pvp.title'))}</strong><small>${esc(t('card.pvp.sub'))}</small></span>
          </button>
        </div>
        <button class="play-foot" data-act="history">🏁 ${esc(t('home.gameHistory'))}</button>
      </aside>`;
  }

  renderHome() {
    const bottomName = this.account.loggedIn ? esc(this.account.username) : esc(t('home.player'));
    this.root.innerHTML = `
      <div class="home">
        ${this._sidebar()}
        <main class="home-center">
          <div class="board-label top">${esc(t('home.opponent'))}</div>
          <div class="home-board" data-board></div>
          <div class="board-label bottom">${bottomName}</div>
        </main>
        ${this._cards()}
      </div>`;

    // Decorative board: non-interactive start position.
    const host = this.root.querySelector('[data-board]');
    this._board = new BoardView(host, { legalTargetsFor: () => [], onMove: () => {}, settings: this.settings });
    this._board.interactive = false;
    this._board.render(parseFen(START_FEN));

    // Nav.
    this.root.querySelector('[data-nav="play"]').onclick = () => this.renderHome();
    this.root.querySelector('[data-nav="howto"]').onclick = () => this.onNavigate('howto');
    this.root.querySelector('[data-nav="stats"]').onclick = () => this.onNavigate('stats');
    this.root.querySelector('[data-nav="settings"]').onclick = () => this.onNavigate('settings');
    this.root.querySelector('[data-act="language"]').onclick = () => this.onLanguage();
    const logout = this.root.querySelector('[data-act="logout"]');
    if (logout) logout.onclick = () => this.account.onLogout();
    const acct = this.root.querySelector('[data-act="account"]');
    if (acct) acct.onclick = () => this.onNavigate('account');
    const signup = this.root.querySelector('[data-act="signup"]');
    if (signup) signup.onclick = () => this.onNavigate('account');

    // Cards.
    if (this.resumeAvailable) this.root.querySelector('[data-act="resume"]').onclick = () => this.onResume();
    this.root.querySelector('[data-act="online"]').onclick = () =>
      this.onNavigate(this.account.loggedIn ? 'online' : 'account');
    this.root.querySelector('[data-act="ai"]').onclick = () => this.renderAIConfig();
    this.root.querySelector('[data-act="friend"]').onclick = () => this.onPlayFriend();
    this.root.querySelector('[data-act="pvp"]').onclick = () => this.renderPvPConfig();
    this.root.querySelector('[data-act="history"]').onclick = () => this.onNavigate('stats');

    this._startSplash();
  }

  // --- Time-control chooser (shared by both config panels) -----------------
  _timeField() {
    const key = this.config.timeKey;
    const categories = TIME_PRESETS.map(([cat, items]) => {
      const buttons = items
        .map(([label, m, i]) =>
          `<button data-tc="${presetKey(m, i)}" data-m="${m}" data-i="${i}" class="${
            key === presetKey(m, i) ? 'selected' : ''
          }">${label}</button>`)
        .join('');
      return `<div class="tc-cat"><span class="tc-label">${cat}</span><div class="option-row">${buttons}</div></div>`;
    }).join('');

    const c = this.config.time;
    const customPanel = `
      <div class="custom-time" ${key === 'custom' ? '' : 'hidden'}>
        <div class="option-row">
          <label class="num">Minutes<input type="number" min="0" max="180" step="1" data-cf="minutes" value="${key === 'custom' ? c.minutes ?? 5 : 5}"/></label>
          <label class="num">Increment (s)<input type="number" min="0" max="60" step="1" data-cf="increment" value="${key === 'custom' ? c.increment : 0}"/></label>
          <label class="num">Delay (s)<input type="number" min="0" max="60" step="1" data-cf="delay" value="${key === 'custom' ? c.delay : 0}"/></label>
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
    this.config.time = { minutes: minutes === 0 ? null : minutes, increment: num('increment', 0), delay: num('delay', 0) };
  }

  // --- Play vs AI ("Play Bots") --------------------------------------------
  renderAIConfig() {
    const levels = Object.entries(DIFFICULTY_LABELS)
      .map(([key, label]) => `<button data-level="${key}" class="${this.config.aiLevel === key ? 'selected' : ''}">${label}</button>`)
      .join('');
    const colors = [['white', 'White'], ['black', 'Black'], ['random', 'Random']]
      .map(([id, label]) => `<button data-color="${id}" class="${this.config.aiColorChoice === id ? 'selected' : ''}">${label}</button>`)
      .join('');

    this.root.innerHTML = `
      <div class="panel home-panel">
        <h2>Play Bots</h2>
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
    this.root.querySelector('[data-act="back"]').onclick = () => this.renderHome();
    this.root.querySelector('[data-act="start"]').onclick = () =>
      this.onStart(buildAiConfig({ aiLevel: this.config.aiLevel, aiColorChoice: this.config.aiColorChoice, time: this.config.time }));
  }

  // --- Pass & Play (local) -------------------------------------------------
  renderPvPConfig() {
    this.root.innerHTML = `
      <div class="panel home-panel">
        <h2>Pass &amp; Play</h2>
        <p class="subtitle">Two players, one device. White moves first.</p>
        ${this._timeField()}
        <div class="actions">
          <button data-act="back">Back</button>
          <button class="primary" data-act="start">Start Game</button>
        </div>
      </div>`;
    this._bindTimeField();
    this.root.querySelector('[data-act="back"]').onclick = () => this.renderHome();
    this.root.querySelector('[data-act="start"]').onclick = () => this.onStart(buildPvpConfig(this.config.time));
  }
}
