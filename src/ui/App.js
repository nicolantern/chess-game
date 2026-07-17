import { Game } from '../engine/game.js';
import { Menu } from './Menu.js';
import { BoardView } from './BoardView.js';
import { loadSettings, saveSettings } from '../utils/storage.js';
import { chooseMove } from '../ai/engine.js';
import { Difficulty } from '../ai/difficulty.js';

export class App {
  constructor(container) {
    this.container = container;
    this.screen = 'menu';
    this.game = new Game();
    this.settings = loadSettings();
    this.mode = 'pvp';
    this.difficulty = Difficulty.MEDIUM;
    this.aiThinking = false;
  }

  render() {
    this.container.innerHTML = '';
    if (this.screen === 'menu') {
      this.container.appendChild(new Menu(this).element);
      return;
    }
    this.container.appendChild(new BoardView(this).element);
  }

  startGame(mode) {
    this.mode = mode;
    this.screen = 'game';
    this.render();
  }

  setSettings(next) {
    this.settings = { ...this.settings, ...next };
    saveSettings(this.settings);
    this.render();
  }

  async requestAiMove() {
    if (this.mode !== 'pve' || this.game.turn !== 'w') return;
    this.aiThinking = true;
    this.render();
    const move = chooseMove(this.game, this.difficulty);
    this.aiThinking = false;
    if (move) {
      this.game.makeMove(move);
      this.render();
    }
  }
}
