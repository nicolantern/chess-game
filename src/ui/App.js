// Top-level router. Mounts exactly one screen at a time into #app, owns the
// shared settings object, and applies the board theme to <body>.

import { HomeScreen } from './HomeScreen.js';
import { GameScreen } from './GameScreen.js';
import { Settings } from './Settings.js';
import { HowToPlay } from './HowToPlay.js';
import { StatsScreen } from './StatsScreen.js';
import { AccountScreen } from './AccountScreen.js';
import { OnlineScreen } from './OnlineScreen.js';
import { loadSettings } from '../utils/storage.js';
import { loadInProgress } from '../utils/persistence.js';
import { isLoggedIn, currentUser, clearSession, getToken } from '../utils/session.js';
import { initSync, pullProfile } from '../utils/sync.js';
import { Realtime } from '../utils/realtime.js';

export class App {
  constructor(root) {
    this.root = root;
    this.settings = loadSettings();
    this.current = null;
    initSync(); // profile saves now upload while logged in
    this._applyTheme();
    this.showMenu();
    // Refresh the profile from the server on boot (in case another device changed it).
    if (isLoggedIn()) pullProfile().then((p) => { if (p) this.showMenu(); });
  }

  _applyTheme() {
    document.body.className = `theme-${this.settings.theme}`;
  }

  _mount(builder) {
    if (this.current && typeof this.current.destroy === 'function') this.current.destroy();
    this.root.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'screen';
    this.root.appendChild(screen);
    this.current = builder(screen);
  }

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

  // "Play a Friend" — routes to online play until the friends feature ships,
  // at which point this repoints to the friends/challenge flow.
  _playFriend() {
    if (!isLoggedIn()) { this.showAccount(); return; }
    alert('Friend challenges are coming soon — playing online for now.');
    this.showOnline();
  }

  _navigate(dest) {
    if (dest === 'settings') this.showSettings();
    else if (dest === 'howto') this.showHowTo();
    else if (dest === 'stats') this.showStats();
    else if (dest === 'account') this.showAccount();
    else if (dest === 'online') this.showOnline();
  }

  showAccount() {
    this._mount(
      (screen) =>
        new AccountScreen(screen, {
          onDone: () => this.showMenu(),
          onBack: () => this.showMenu(),
        }),
    );
  }

  // Enter online mode: open the realtime connection, then matchmaking. A single
  // 'matched' handler (re)mounts the game for both the first match and rematches.
  async showOnline() {
    this._endOnline(); // tidy any prior session
    this.realtime = new Realtime();
    try {
      await this.realtime.connect(getToken());
    } catch {
      this.realtime = null;
      this.showMenu();
      alert('Could not reach the game server. Start it with "npm run server".');
      return;
    }
    this.realtime.on('matched', (info) => this._showOnlineGame(info));
    this._mount((screen) => new OnlineScreen(screen, {
      realtime: this.realtime,
      onCancel: () => this._endOnline(),
    }));
  }

  _showOnlineGame(info) {
    this._mount(
      (screen) =>
        new GameScreen(screen, {
          config: {
            mode: 'online',
            myColor: info.color,
            opponentName: info.opponent,
            time: info.time,
            realtime: this.realtime,
          },
          settings: this.settings,
          onExit: () => this._endOnline(),
        }),
    );
  }

  _endOnline() {
    if (this.realtime) {
      this.realtime.leave();
      this.realtime.close();
      this.realtime = null;
    }
    this.showMenu();
  }

  showGame(config, loadData = null) {
    this._mount(
      (screen) =>
        new GameScreen(screen, {
          config,
          loadData,
          settings: this.settings,
          onExit: () => this.showMenu(),
        }),
    );
  }

  showSettings() {
    this._mount(
      (screen) =>
        new Settings(screen, {
          settings: this.settings,
          onChange: () => this._applyTheme(),
          onBack: () => this.showMenu(),
        }),
    );
  }

  showHowTo() {
    this._mount((screen) => new HowToPlay(screen, { onBack: () => this.showMenu() }));
  }

  showStats() {
    this._mount(
      (screen) =>
        new StatsScreen(screen, {
          onBack: () => this.showMenu(),
          onReplay: (game) => this.showGame(null, game),
        }),
    );
  }
}
