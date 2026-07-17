// Top-level router. Mounts exactly one screen at a time into #app, owns the
// shared settings object, and applies the board theme to <body>.

import { Menu } from './Menu.js';
import { GameScreen } from './GameScreen.js';
import { Settings } from './Settings.js';
import { HowToPlay } from './HowToPlay.js';
import { loadSettings } from '../utils/storage.js';

export class App {
  constructor(root) {
    this.root = root;
    this.settings = loadSettings();
    this.current = null;
    this._applyTheme();
    this.showMenu();
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
        onNavigate: (dest) => (dest === 'settings' ? this.showSettings() : this.showHowTo()),
      }),
    );
  }

  showGame(config) {
    this._mount(
      (screen) =>
        new GameScreen(screen, {
          config,
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
}
