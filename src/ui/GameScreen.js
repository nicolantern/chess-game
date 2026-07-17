// GameScreen assembles one playable game: it wires the MatchController to the
// BoardView, Sidebar, Animator, PromotionDialog, and SoundManager, and keeps
// the view in sync with controller events (including asynchronous AI moves).

import { MatchController } from './MatchController.js';
import { BoardView } from './BoardView.js';
import { Sidebar } from './Sidebar.js';
import { Animator } from './Animator.js';
import { PromotionDialog } from './PromotionDialog.js';
import { SoundManager } from '../assets/audio.js';
import { FLAGS } from '../engine/moves.js';
import { WHITE, BLACK } from '../engine/pieces.js';
import { parseFen } from '../engine/fen.js';
import { inCheck } from '../engine/attacks.js';

const GAMEOVER_TITLE = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  'draw-insufficient': 'Draw',
  'draw-fifty': 'Draw',
  'draw-repetition': 'Draw',
  timeout: 'Time Out',
  resign: 'Resignation',
};

export class GameScreen {
  constructor(root, { config, settings, onExit }) {
    this.root = root;
    this.config = config;
    this.settings = settings;
    this.onExit = onExit;
    this.humanColor = config.humanColor ?? WHITE;
    this.sound = new SoundManager({ enabled: settings.sound });
    this.animator = new Animator({ settings });
    this.promotion = new PromotionDialog();
    this.reviewPly = null; // null = live; otherwise a past position index
    this._keyHandler = (e) => this._onKey(e);
    document.addEventListener('keydown', this._keyHandler);
    this._build();
    this._startMatch();
  }

  _build() {
    this.root.innerHTML = `
      <div class="game">
        <div class="board-area"></div>
        <div class="sidebar"></div>
      </div>`;
    this.boardArea = this.root.querySelector('.board-area');
    this.sidebarEl = this.root.querySelector('.sidebar');
  }

  _startMatch() {
    this.controller = new MatchController(this.config);
    this.flipped = this.humanColor === BLACK; // put the human at the bottom
    this.boardArea.innerHTML = '';

    this.board = new BoardView(this.boardArea, {
      settings: this.settings,
      legalTargetsFor: (sq) => this._legalTargets(sq),
      onMove: (from, to) => this._handleMove(from, to),
    });
    this.board.setFlipped(this.flipped);

    this.sidebar = new Sidebar(this.sidebarEl, {
      controller: this.controller,
      unlimited: this.controller.clock.unlimited,
      onControl: (act) => this._handleControl(act),
      onSeek: (ply) => this._seek(ply),
    });
    this.sidebar.setTopColor(this.flipped ? WHITE : BLACK);
    this.reviewPly = null;

    this._wireController();
    this.board.render(this.controller.game.board);
    this.controller.start();
  }

  _wireController() {
    const bus = this.controller.bus;
    bus.on('move', ({ move }) => this._onMoved(move));
    bus.on('undo', () => this._onUndo());
    bus.on('thinking', (on) => this.board.setInteractive(!on));
    bus.on('gameover', (s) => this._onGameOver(s));
  }

  // Destination squares a human is allowed to move a piece from `sq` to.
  _legalTargets(sq) {
    if (this.controller.game.isOver) return [];
    // In AI mode, only let the human move their own pieces on their turn.
    if (this.controller.mode === 'ai' && this.controller.game.sideToMove !== this.humanColor) return [];
    return this.controller.game.legalMovesFrom(sq).map((m) => m.to);
  }

  async _handleMove(from, to) {
    if (this.controller.isPromotion(from, to)) {
      const type = await this.promotion.choose(this.controller.game.sideToMove);
      if (!type) {
        this.board.render(this.controller.game.board); // restore dragged piece
        return;
      }
      this.controller.tryMove(from, to, type);
    } else {
      this.controller.tryMove(from, to);
    }
  }

  _onMoved(move) {
    const game = this.controller.game;
    this.reviewPly = null; // a new move snaps the view back to live
    this.board.render(game.board);
    this.board.clearAnnotations();
    this.animator.slide(this.board, move.from, move.to);
    this.board.setLastMove(move);
    this._updateCheck();
    this._syncInteractive();
    this._playSound(move);
  }

  // Interactive only when live, not game-over, and (in AI mode) on the human's turn.
  _syncInteractive() {
    const game = this.controller.game;
    const live = this.reviewPly === null;
    const humansTurn =
      this.controller.mode !== 'ai' || game.sideToMove === this.humanColor;
    this.board.setInteractive(live && !game.isOver && humansTurn);
  }

  // --- History review ------------------------------------------------------
  _seek(ply) {
    const total = this.controller.game.history.length;
    const target = Math.max(0, Math.min(ply, total));
    if (target >= total) {
      this._live();
      return;
    }
    this.reviewPly = target;
    const board = parseFen(this.controller.fens[target]);
    this.board.render(board);
    this.board.clearAnnotations();
    const move = target > 0 ? this.controller.game.history[target - 1].move : null;
    this.board.setLastMove(move);
    this.board.setCheckSquare(inCheck(board, board.sideToMove) ? board.kings[board.sideToMove] : -1);
    this.board.setInteractive(false);
    this.sidebar.highlightPly(target);
  }

  _live() {
    this.reviewPly = null;
    const game = this.controller.game;
    this.board.render(game.board);
    this.board.setLastMove(game.lastMove);
    this._updateCheck();
    this._syncInteractive();
    this.sidebar.highlightPly(game.history.length);
  }

  _step(delta) {
    const current = this.reviewPly ?? this.controller.game.history.length;
    this._seek(current + delta);
  }

  _onUndo() {
    this.reviewPly = null;
    const game = this.controller.game;
    this.board.render(game.board);
    this.board.clearSelection();
    this.board.clearAnnotations();
    this.board.setLastMove(game.lastMove);
    this._updateCheck();
    this._syncInteractive();
  }

  // Keyboard shortcuts. Ignored while typing in a form field.
  _onKey(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this._step(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._step(1);
        break;
      case 'Home':
        e.preventDefault();
        this._seek(0);
        break;
      case 'End':
        e.preventDefault();
        this._live();
        break;
      case 'f':
        this._handleControl('flip');
        break;
      case 'F': // Shift+F
        this._toggleFullscreen();
        break;
      case 'u':
      case 'U':
        this._handleControl('undo');
        break;
      case 'n':
      case 'N':
        this._handleControl('new');
        break;
      case 'Escape':
        if (this.reviewPly !== null) this._live();
        else if (this.modal) this._removeModal();
        break;
      default:
        break;
    }
  }

  _toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch {
      /* fullscreen not permitted — ignore */
    }
  }

  _updateCheck() {
    const game = this.controller.game;
    const kingSq = game.check ? game.board.kings[game.sideToMove] : -1;
    this.board.setCheckSquare(kingSq);
  }

  _playSound(move) {
    if (this.controller.game.isOver) {
      this.sound.play('game-end');
      return;
    }
    if (this.controller.game.check) this.sound.play('check');
    else if (move.flags & FLAGS.PROMOTION) this.sound.play('promote');
    else if (move.flags & (FLAGS.KING_CASTLE | FLAGS.QUEEN_CASTLE)) this.sound.play('castle');
    else if (move.flags & FLAGS.CAPTURE) this.sound.play('capture');
    else this.sound.play('move');
  }

  _handleControl(act) {
    switch (act) {
      case 'undo':
        this.controller.undo();
        break;
      case 'flip':
        this.flipped = !this.flipped;
        this.board.setFlipped(this.flipped);
        this.sidebar.setTopColor(this.flipped ? WHITE : BLACK);
        break;
      case 'draw':
        this.controller.claimDraw();
        break;
      case 'fullscreen':
        this._toggleFullscreen();
        break;
      case 'resign':
        this.controller.resign(this.controller.mode === 'ai' ? this.humanColor : this.controller.game.sideToMove);
        break;
      case 'new':
        this.controller.destroy();
        this._removeModal();
        this._startMatch();
        break;
      case 'menu':
        this.destroy();
        this.onExit();
        break;
      default:
        break;
    }
  }

  _onGameOver(s) {
    this.board.setInteractive(false);
    this.sound.play('game-end');
    let subtitle = '';
    if (s.status === 'stalemate' || s.status.startsWith('draw')) subtitle = 'The game is a draw.';
    else if (s.winner != null) subtitle = `${s.winner === WHITE ? 'White' : 'Black'} wins.`;

    this._removeModal();
    this.modal = document.createElement('div');
    this.modal.className = 'modal-backdrop';
    this.modal.innerHTML = `
      <div class="modal">
        <h2>${GAMEOVER_TITLE[s.status] || 'Game Over'}</h2>
        <p>${subtitle}</p>
        <div class="actions">
          <button data-act="menu">Menu</button>
          <button class="primary" data-act="new">New Game</button>
        </div>
      </div>`;
    this.modal.querySelector('[data-act="new"]').onclick = () => this._handleControl('new');
    this.modal.querySelector('[data-act="menu"]').onclick = () => this._handleControl('menu');
    document.body.appendChild(this.modal);
  }

  _removeModal() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  /** Apply live settings changes (theme handled by App; here: sound + rehighlight). */
  applySettings() {
    this.sound.setEnabled(this.settings.sound);
    this.board.setCheckSquare(this.board.checkSquare); // re-evaluate under new highlight setting
    this._updateCheck();
    this.board.setLastMove(this.controller.game.lastMove);
  }

  destroy() {
    document.removeEventListener('keydown', this._keyHandler);
    this._removeModal();
    this.controller.destroy();
  }
}
