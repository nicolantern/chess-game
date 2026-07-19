# chess.com-Style Home Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the main menu with a dark, three-column chess.com-style home — left nav, centered decorative board, right "Play Chess" action cards — wired only to real features, with the router otherwise unchanged.

**Architecture:** A new `HomeScreen` component replaces `Menu` and absorbs its config sub-panels; `App.showMenu()` mounts it the same way. Shared time-control data + pure game-config builders move to a neutral module (`timeControls.js`) so they can be unit-tested and reused by `OnlineScreen`. Dark chrome is CSS scoped to `.home`.

**Tech Stack:** Vanilla-DOM ES-module frontend; Vitest for the pure builders; existing `BoardView` for the decorative board.

Reference spec: `docs/superpowers/specs/2026-07-19-chesscom-home-shell-design.md`

---

## File Structure

- `src/ui/timeControls.js` — *create*: `TIME_PRESETS` (moved from `Menu.js`) + pure `buildAiConfig` / `buildPvpConfig`.
- `src/ui/HomeScreen.js` — *create*: the three-column home + relocated AI/PvP config panels.
- `src/ui/OnlineScreen.js` — *modify*: import `TIME_PRESETS` from `timeControls.js`.
- `src/ui/App.js` — *modify*: mount `HomeScreen` instead of `Menu`; add `onPlayFriend`; pass `settings`.
- `src/ui/Menu.js` — *delete* (fully replaced by `HomeScreen`).
- `src/assets/theme.css` — *modify*: `.home` dark shell + card + nav + responsive styles.
- `test/home-config.test.js` — *create*: builder unit tests.

---

### Task 1: Extract time controls + testable config builders

**Files:**
- Create: `src/ui/timeControls.js`
- Test: `test/home-config.test.js`
- Modify: `src/ui/OnlineScreen.js`

- [ ] **Step 1: Write the failing test**

```js
// test/home-config.test.js
import { describe, it, expect } from 'vitest';
import { buildAiConfig, buildPvpConfig, TIME_PRESETS } from '../src/ui/timeControls.js';
import { WHITE, BLACK } from '../src/engine/pieces.js';

describe('game config builders', () => {
  it('AI config with an explicit color flips the AI to the other side', () => {
    const cfg = buildAiConfig({ aiLevel: 'hard', aiColorChoice: 'black', time: { minutes: 5, increment: 0, delay: 0 } });
    expect(cfg).toEqual({
      mode: 'ai',
      aiLevel: 'hard',
      aiColor: WHITE,
      humanColor: BLACK,
      time: { minutes: 5, increment: 0, delay: 0 },
    });
  });

  it('AI config resolves random via the injected rng', () => {
    expect(buildAiConfig({ aiLevel: 'easy', aiColorChoice: 'random', time: {} }, () => 0.1).humanColor).toBe(WHITE);
    expect(buildAiConfig({ aiLevel: 'easy', aiColorChoice: 'random', time: {} }, () => 0.9).humanColor).toBe(BLACK);
  });

  it('PvP config always starts the human as White', () => {
    expect(buildPvpConfig({ minutes: 3 })).toEqual({ mode: 'pvp', humanColor: WHITE, time: { minutes: 3 } });
  });

  it('exposes the time presets', () => {
    expect(TIME_PRESETS[0][0]).toBe('Bullet');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/home-config.test.js`
Expected: FAIL (`Cannot find module '../src/ui/timeControls.js'`).

- [ ] **Step 3: Create `src/ui/timeControls.js`**

```js
// Shared time-control presets and pure game-config builders. Extracted from the
// old Menu so both HomeScreen and OnlineScreen can use them and the config logic
// is unit-testable (no DOM).

import { WHITE, BLACK } from '../engine/pieces.js';

// Preset time controls grouped by category. Each item is [label, minutes, increment].
export const TIME_PRESETS = [
  ['Bullet', [['1+0', 1, 0], ['2+1', 2, 1]]],
  ['Blitz', [['3+0', 3, 0], ['3+2', 3, 2], ['5+0', 5, 0], ['5+3', 5, 3]]],
  ['Rapid', [['10+0', 10, 0], ['10+5', 10, 5], ['15+10', 15, 10]]],
  ['Classical', [['30+0', 30, 0], ['30+20', 30, 20]]],
];

/**
 * Build the start config for a game vs the AI.
 * @param {{aiLevel:string, aiColorChoice:'white'|'black'|'random', time:object}} sel
 * @param {() => number} rng  injectable for deterministic tests
 */
export function buildAiConfig({ aiLevel, aiColorChoice, time }, rng = Math.random) {
  let human = aiColorChoice;
  if (human === 'random') human = rng() < 0.5 ? 'white' : 'black';
  const humanColor = human === 'white' ? WHITE : BLACK;
  return { mode: 'ai', aiLevel, aiColor: humanColor ^ 1, humanColor, time };
}

/** Build the start config for local two-player (human is White). */
export function buildPvpConfig(time) {
  return { mode: 'pvp', humanColor: WHITE, time };
}
```

- [ ] **Step 4: Point `OnlineScreen` at the new module**

In `src/ui/OnlineScreen.js`, change:

```js
import { TIME_PRESETS } from './Menu.js';
```

to:

```js
import { TIME_PRESETS } from './timeControls.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/home-config.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/ui/timeControls.js test/home-config.test.js src/ui/OnlineScreen.js
git commit -m "refactor(home): extract TIME_PRESETS + testable game-config builders"
```

---

### Task 2: Create `HomeScreen` (three-column layout + relocated config panels)

**Files:**
- Create: `src/ui/HomeScreen.js`

This absorbs everything `Menu` did. It renders the home layout and, on "Play Bots"/"Pass & Play", the same config panels `Menu` produced.

- [ ] **Step 1: Create `src/ui/HomeScreen.js`**

```js
// The home screen: a dark, three-column chess.com-style layout — left nav, a
// centered decorative board, and a right "Play Chess" panel of action cards.
// Also owns the two start-config sub-panels (vs AI, Pass & Play), which replace
// the whole home view until Back is pressed. Wired only to real features.

import { DIFFICULTY_LABELS } from '../ai/difficulty.js';
import { TIME_PRESETS, buildAiConfig, buildPvpConfig } from './timeControls.js';
import { BoardView } from './BoardView.js';
import { parseFen, START_FEN } from '../engine/fen.js';

const presetKey = (m, i) => `${m}-${i}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class HomeScreen {
  /**
   * @param {HTMLElement} root
   * @param {object} opts  onStart, onNavigate, onPlayFriend, resumeAvailable, onResume, account, settings
   */
  constructor(root, { onStart, onNavigate, onPlayFriend, resumeAvailable = false, onResume, account, settings }) {
    this.root = root;
    this.onStart = onStart;
    this.onNavigate = onNavigate;
    this.onPlayFriend = onPlayFriend || (() => {});
    this.resumeAvailable = resumeAvailable;
    this.onResume = onResume || (() => {});
    this.account = account || { loggedIn: false, username: null, onLogout: () => {} };
    this.settings = settings || { highlights: false };
    this.config = { aiLevel: 'medium', aiColorChoice: 'white', timeKey: 'unlimited', time: { minutes: null, increment: 0, delay: 0 } };
    this.renderHome();
  }

  destroy() {
    this._board = null;
  }

  // --- Layout --------------------------------------------------------------
  _sidebar() {
    const acct = this.account.loggedIn
      ? `<div class="nav-account">
           <span class="who">👤 ${esc(this.account.username)}</span>
           <button data-act="logout" class="nav-btn ghost">Log out</button>
         </div>`
      : `<div class="nav-account">
           <button data-act="account" class="nav-btn login">Log In</button>
           <button data-act="signup" class="nav-btn signup">Sign Up</button>
         </div>`;
    return `
      <nav class="home-nav">
        <div class="brand">♞ <span>Chess</span></div>
        <ul class="nav-list">
          <li><button class="nav-item active" data-nav="play"><span class="ni">♟</span> Play</button></li>
          <li><button class="nav-item" data-nav="howto"><span class="ni">🎓</span> Learn</button></li>
          <li><button class="nav-item" data-nav="stats"><span class="ni">📊</span> Stats</button></li>
          <li><button class="nav-item" data-nav="settings"><span class="ni">⚙️</span> Settings</button></li>
        </ul>
        ${acct}
      </nav>`;
  }

  _cards() {
    const resume = this.resumeAvailable
      ? `<button class="play-card resume" data-act="resume">
           <span class="pc-icon">▶</span>
           <span class="pc-text"><strong>Resume Game</strong><small>Pick up where you left off</small></span>
         </button>`
      : '';
    const onlineHint = this.account.loggedIn ? '' : ' <span class="hint">(log in)</span>';
    return `
      <aside class="home-play">
        <h2 class="play-title">♟ Play Chess</h2>
        <div class="play-cards">
          ${resume}
          <button class="play-card" data-act="online">
            <span class="pc-icon">⚡</span>
            <span class="pc-text"><strong>Play Online${onlineHint}</strong><small>Play vs a person</small></span>
          </button>
          <button class="play-card" data-act="ai">
            <span class="pc-icon">🤖</span>
            <span class="pc-text"><strong>Play Bots</strong><small>Challenge the computer</small></span>
          </button>
          <button class="play-card" data-act="friend">
            <span class="pc-icon">🤝</span>
            <span class="pc-text"><strong>Play a Friend</strong><small>Invite a friend to a game</small></span>
          </button>
          <button class="play-card" data-act="pvp">
            <span class="pc-icon">👥</span>
            <span class="pc-text"><strong>Pass &amp; Play</strong><small>Two players, one device</small></span>
          </button>
        </div>
        <button class="play-foot" data-act="history">🏁 Game History</button>
      </aside>`;
  }

  renderHome() {
    const bottomName = this.account.loggedIn ? esc(this.account.username) : 'Player';
    this.root.innerHTML = `
      <div class="home">
        ${this._sidebar()}
        <main class="home-center">
          <div class="board-label top"><span class="avatar">🙂</span> Opponent</div>
          <div class="home-board" data-board></div>
          <div class="board-label bottom"><span class="avatar">🙂</span> ${bottomName}</div>
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
```

- [ ] **Step 2: Verify it parses**

Run: `node --check src/ui/HomeScreen.js`
Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
git add src/ui/HomeScreen.js
git commit -m "feat(home): HomeScreen component with nav, cards, decorative board"
```

---

### Task 3: Dark shell styles + responsive

**Files:**
- Modify: `src/assets/theme.css`

- [ ] **Step 1: Append `.home` styles**

Add to the end of `src/assets/theme.css`:

```css
/* ===== chess.com-style home shell ===== */
.home {
  --home-bg: #262421;
  --home-panel: #302e2b;
  --home-panel-2: #3d3a37;
  --home-text: #e9e7e4;
  --home-muted: #a8a29a;
  --home-accent: #7fa650;
  display: grid;
  grid-template-columns: 220px minmax(320px, 1fr) minmax(300px, 380px);
  gap: 18px;
  align-items: start;
  max-width: 1200px;
  margin: 0 auto;
  padding: 18px;
  color: var(--home-text);
}

/* Left nav */
.home-nav { background: var(--home-panel); border-radius: 12px; padding: 14px 12px; display: flex; flex-direction: column; gap: 6px; min-height: 60vh; }
.home-nav .brand { font-size: 1.4rem; font-weight: 700; padding: 6px 8px 14px; }
.home-nav .brand span { color: var(--home-accent); }
.nav-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.nav-item { width: 100%; text-align: left; background: transparent; border: 0; color: var(--home-text); padding: 10px 10px; border-radius: 8px; cursor: pointer; font-size: 1rem; display: flex; align-items: center; gap: 10px; }
.nav-item .ni { width: 1.2em; text-align: center; }
.nav-item:hover { background: var(--home-panel-2); }
.nav-item.active { background: var(--home-panel-2); font-weight: 600; }
.nav-account { margin-top: auto; display: flex; flex-direction: column; gap: 8px; padding-top: 12px; }
.nav-account .who { padding: 4px 8px; color: var(--home-muted); }
.nav-btn { border: 0; border-radius: 8px; padding: 10px; cursor: pointer; font-size: 0.95rem; }
.nav-btn.signup { background: var(--home-accent); color: #14240c; font-weight: 700; }
.nav-btn.login { background: var(--home-panel-2); color: var(--home-text); }
.nav-btn.ghost { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: var(--home-text); }

/* Center board */
.home-center { display: flex; flex-direction: column; gap: 8px; }
.home-board { width: 100%; aspect-ratio: 1 / 1; }
.board-label { display: flex; align-items: center; gap: 8px; color: var(--home-text); font-weight: 600; }
.board-label .avatar { width: 28px; height: 28px; border-radius: 6px; background: var(--home-panel-2); display: inline-flex; align-items: center; justify-content: center; }

/* Right play panel */
.home-play { background: var(--home-panel); border-radius: 12px; padding: 16px; }
.play-title { margin: 0 0 14px; font-size: 1.5rem; }
.play-cards { display: flex; flex-direction: column; gap: 10px; }
.play-card { display: flex; align-items: center; gap: 14px; text-align: left; width: 100%; background: var(--home-panel-2); border: 0; border-radius: 10px; padding: 14px; cursor: pointer; color: var(--home-text); transition: transform .05s, background .15s; }
.play-card:hover { background: #47433f; transform: translateY(-1px); }
.play-card .pc-icon { font-size: 1.7rem; width: 40px; text-align: center; }
.play-card .pc-text { display: flex; flex-direction: column; }
.play-card .pc-text strong { font-size: 1.1rem; }
.play-card .pc-text small { color: var(--home-muted); }
.play-card.resume { background: var(--home-accent); color: #14240c; }
.play-card.resume .pc-text small { color: rgba(0,0,0,0.6); }
.play-card .hint { font-size: 0.75rem; color: var(--home-muted); font-weight: 400; }
.play-foot { margin-top: 12px; width: 100%; background: transparent; border: 0; color: var(--home-muted); padding: 10px; cursor: pointer; border-top: 1px solid rgba(255,255,255,0.08); }

/* Home config sub-panels reuse the existing .panel styles but sit on the dark bg */
.home-panel { max-width: 560px; margin: 24px auto; }

/* Responsive: cards drop under the board, then nav becomes a top bar */
@media (max-width: 980px) {
  .home { grid-template-columns: 200px 1fr; }
  .home-play { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  .home { grid-template-columns: 1fr; padding: 10px; }
  .home-nav { min-height: 0; flex-direction: row; flex-wrap: wrap; align-items: center; }
  .home-nav .brand { padding: 6px 8px; }
  .nav-list { flex-direction: row; flex-wrap: wrap; }
  .nav-account { margin: 0 0 0 auto; flex-direction: row; padding-top: 0; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/assets/theme.css
git commit -m "feat(home): dark three-column shell styles + responsive"
```

---

### Task 4: Wire `App` to the new home; delete `Menu`

**Files:**
- Modify: `src/ui/App.js`
- Delete: `src/ui/Menu.js`

- [ ] **Step 1: Swap the import and mount**

In `src/ui/App.js`, change:

```js
import { Menu } from './Menu.js';
```

to:

```js
import { HomeScreen } from './HomeScreen.js';
```

Replace the body of `showMenu()` with a `HomeScreen` mount that passes the new options:

```js
  showMenu() {
    this._mount((screen) =>
      new HomeScreen(screen, {
        onStart: (config) => this.showGame(config),
        onNavigate: (dest) => this._navigate(dest),
        onPlayFriend: () => this._playFriend(),
        resumeAvailable: Boolean(loadInProgress()),
        onResume: () => this.showGame(null, loadInProgress()),
        settings: this.settings,
        account: {
          loggedIn: isLoggedIn(),
          username: currentUser(),
          onLogout: () => {
            clearSession();
            if (this.realtime) { this.realtime.close(); this.realtime = null; }
            this.showMenu();
          },
        },
      }),
    );
  }
```

(If Task 6 of the friends plan has already added realtime cleanup to `onLogout`, keep that version — the important change here is `HomeScreen` + `onPlayFriend` + `settings`.)

Add the `_playFriend` handler (routes to online until the friends feature lands, per the spec):

```js
  _playFriend() {
    if (!isLoggedIn()) { this.showAccount(); return; }
    alert('Friend challenges are coming soon — playing online for now.');
    this.showOnline();
  }
```

- [ ] **Step 2: Delete `Menu.js`**

```bash
git rm src/ui/Menu.js
```

- [ ] **Step 3: Verify nothing still imports `Menu`**

Run: `grep -rn "Menu.js\|{ Menu }\|new Menu" src` (in Git Bash) or `Select-String -Path src\**\*.js -Pattern "Menu"` (PowerShell).
Expected: no results (all references removed).

- [ ] **Step 4: Build + run full suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass (existing + `home-config`).

- [ ] **Step 5: Commit**

```bash
git add src/ui/App.js
git commit -m "feat(home): mount HomeScreen, add Play-a-Friend hook, retire Menu"
```

---

### Task 5: Visual verification in a real browser

**Files:** none (verification task)

- [ ] **Step 1: Run the app**

Run `npm run dev`, open the app.

- [ ] **Step 2: Check the home layout**

Confirm:
- Three columns: left nav (♞ Chess, Play active, Learn, Stats, Settings, and Log In/Sign Up or username/Log out), centered green decorative board with Opponent/Player labels, right "Play Chess" cards.
- **Play Online** → online screen (or account screen when logged out, with the "(log in)" hint shown).
- **Play Bots** → difficulty/color/time panel → Start begins an AI game with the chosen options; Back returns home.
- **Play a Friend** → the "coming soon → online" path (or account when logged out).
- **Pass & Play** → time panel → Start begins a local game.
- Nav Learn/Stats/Settings and Game History reach the right screens.
- Resume card appears only when a game is in progress and resumes it.

- [ ] **Step 3: Check responsiveness**

Narrow the window: cards drop below the board (~≤980px), then the nav becomes a top bar and everything single-columns (~≤640px). No horizontal page scroll.

- [ ] **Step 4: Screenshot for the record (optional)**

Use the run/verify tooling to capture the home at a wide width and confirm it matches the reference intent.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(home): address issues found in visual verification"
```

---

## Notes for the implementer

- **Behavior parity is the contract:** `HomeScreen` must emit the exact same `onStart` config objects `Menu` did — that's why Task 1 extracts and unit-tests `buildAiConfig`/`buildPvpConfig`, and `HomeScreen` calls them instead of rebuilding configs inline.
- **Decorative board is read-only:** set `this._board.interactive = false` before/after `render`; never wire `onMove`.
- **Dark theme is scoped to `.home`:** do not restyle global elements — other screens and the board themes must be untouched (that's Phase 2).
- **`OnlineScreen` import:** it now takes `TIME_PRESETS` from `timeControls.js`; the friends plan also modifies `OnlineScreen` — if both land, keep both edits (different lines).
- **Interaction with the friends plan:** when the friends feature ships, repoint `_playFriend()` to the friends flow (open the friends panel / challenge picker) and drop the "coming soon" alert. No other home change needed.
