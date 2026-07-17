// Top-level router. Mounts exactly one screen at a time into #app, owns the
// shared settings object, and applies the board theme to <body>.

import { Menu } from './Menu.js';
import { GameScreen } from './GameScreen.js';
import { Settings } from './Settings.js';
import { HowToPlay } from './HowToPlay.js';
import { StatsScreen } from './StatsScreen.js';
import { AccountScreen } from './AccountScreen.js';
import { loadSettings } from '../utils/storage.js';
import { loadInProgress } from '../utils/persistence.js';
import { isLoggedIn, currentUser, clearSession } from '../utils/session.js';
import { initSync, pullProfile } from '../utils/sync.js';

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
      new Menu(screen, {
        onStart: (config) => this.showGame(config),
        onNavigate: (dest) => this._navigate(dest),
        resumeAvailable: Boolean(loadInProgress()),
        onResume: () => this.showGame(null, loadInProgress()),
        account: {
          loggedIn: isLoggedIn(),
          username: currentUser(),
          onLogout: () => {
            clearSession();
            this.showMenu();
          },
        },
      }),
    );
  }

  _navigate(dest) {
    if (dest === 'settings') this.showSettings();
    else if (dest === 'howto') this.showHowTo();
    else if (dest === 'stats') this.showStats();
    else if (dest === 'account') this.showAccount();
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
