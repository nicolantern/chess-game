// Sidebar: clocks, captured-piece trays with material advantage, a status line,
// the SAN move history, and the control buttons. It observes the controller's
// event bus and renders — it holds no game logic of its own.

import { PIECE_GLYPH } from '../assets/pieces.js';
import { pieceColor, pieceType, PIECE_VALUE, WHITE, BLACK } from '../engine/pieces.js';
import { CLASS_SYMBOL as SYMBOL } from '../ai/analysis.js';
import { t } from '../utils/i18n.js';

// Localized status-line text for a game state (empty while simply playing).
const STATUS_KEY = {
  check: 'status.check',
  checkmate: 'status.checkmate',
  stalemate: 'status.stalemate',
  'draw-insufficient': 'status.drawInsufficient',
  'draw-fifty': 'status.drawFifty',
  'draw-repetition': 'status.drawRepetition',
  timeout: 'status.timeout',
  resign: 'status.resign',
};
const statusText = (status) => (STATUS_KEY[status] ? t(STATUS_KEY[status]) : '');

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class Sidebar {
  constructor(root, { controller, unlimited, onControl, onSeek }) {
    this.root = root;
    this.controller = controller;
    this.unlimited = unlimited;
    this.onControl = onControl;
    this.onSeek = onSeek || (() => {});
    this.analysis = null; // per-ply analysis once the game is analyzed
    this.topColor = BLACK; // color shown on the top clock/tray
    this._build();
    this._wire();
    this._renderStatus(controller.statusPayload());
    this._renderClocks(controller.clock.remaining);
  }

  setTopColor(color) {
    this.topColor = color;
    this._renderStatus(this.controller.statusPayload());
    this._renderClocks(this.controller.clock.remaining);
  }

  _build() {
    this.root.innerHTML = `
      <div class="clock top"><span class="who"></span><span class="tray captured"></span><span class="time"></span></div>
      <div class="status-bar"></div>
      <div class="history"><table></table></div>
      <div class="analysis-summary" hidden></div>
      <div class="clock bottom"><span class="who"></span><span class="tray captured"></span><span class="time"></span></div>
      <div class="controls">
        <button data-act="hint" title="${t('ctl.hintTitle')}">${t('ctl.hint')}</button>
        <button data-act="analyze" title="${t('ctl.analyzeTitle')}">${t('ctl.analyze')}</button>
        <button data-act="undo" title="${t('ctl.undoTitle')}">${t('ctl.undo')}</button>
        <button data-act="flip" title="${t('ctl.flipTitle')}">${t('ctl.flip')}</button>
        <button data-act="draw" disabled>${t('ctl.draw')}</button>
        <button data-act="resign">${t('ctl.resign')}</button>
        <button data-act="fullscreen" title="${t('ctl.fullscreenTitle')}">${t('ctl.fullscreen')}</button>
        <button data-act="new" title="${t('ctl.newTitle')}">${t('ctl.new')}</button>
        <button data-act="menu" title="${t('ctl.menuTitle')}">${t('ctl.menu')}</button>
      </div>`;
    this.elTop = this.root.querySelector('.clock.top');
    this.elBottom = this.root.querySelector('.clock.bottom');
    this.elStatus = this.root.querySelector('.status-bar');
    this.elHistory = this.root.querySelector('.history table');
    this.elAnalysis = this.root.querySelector('.analysis-summary');
    this.root.querySelectorAll('.controls button').forEach((btn) => {
      btn.addEventListener('click', () => this.onControl(btn.dataset.act));
    });
    this.drawBtn = this.root.querySelector('[data-act="draw"]');
    if (this.unlimited) {
      this.elTop.querySelector('.time').style.display = 'none';
      this.elBottom.querySelector('.time').style.display = 'none';
    }
  }

  _wire() {
    const bus = this.controller.bus;
    bus.on('move', () => this._renderHistory());
    bus.on('status', (s) => this._renderStatus(s));
    bus.on('tick', (r) => this._renderClocks(r));
    bus.on('thinking', (b) => this._renderThinking(b));
    bus.on('gameover', (s) => this._renderStatus(s));
    bus.on('undo', () => {
      this._renderHistory();
      this._renderStatus(this.controller.statusPayload());
    });
  }

  _renderClocks(remaining) {
    const status = this.controller.statusPayload();
    const active = this.controller.game.isOver ? -1 : status.sideToMove;
    const paint = (el, color) => {
      el.querySelector('.who').textContent = color === WHITE ? t('side.white') : t('side.black');
      el.querySelector('.time').textContent = this.unlimited ? '∞' : formatTime(remaining[color]);
      el.classList.toggle('active', active === color);
      el.classList.toggle('low', !this.unlimited && remaining[color] < 30000);
      el.querySelector('.tray').innerHTML = this._trayHtml(color);
    };
    paint(this.elTop, this.topColor);
    paint(this.elBottom, this.topColor ^ 1);
  }

  // Glyphs of the pieces this color has captured, plus a material advantage badge.
  _trayHtml(color) {
    const captured = this.controller.captured;
    const mine = captured[color ^ 1] || []; // pieces of the OTHER color that this side took
    let html = mine.map((p) => PIECE_GLYPH[pieceColor(p)][pieceType(p)]).join('');
    const myValue = (captured[color ^ 1] || []).reduce((s, p) => s + PIECE_VALUE[pieceType(p)], 0);
    const oppValue = (captured[color] || []).reduce((s, p) => s + PIECE_VALUE[pieceType(p)], 0);
    const adv = Math.round((myValue - oppValue) / 100);
    if (adv > 0) html += `<span class="adv">+${adv}</span>`;
    return html;
  }

  _renderStatus(s) {
    let text = statusText(s.status);
    if (this.controller.game.isOver || s.status === 'timeout' || s.status === 'resign') {
      if (s.status === 'checkmate' || s.status === 'timeout' || s.status === 'resign') {
        const winner = s.winner === WHITE ? t('side.white') : t('side.black');
        text = `${statusText(s.status)} — ${t('status.wins', { name: winner })}`;
      }
    }
    this.elStatus.classList.toggle('alert', Boolean(text));
    this.elStatus.textContent = text;
    if (this.drawBtn) this.drawBtn.disabled = !s.canClaimDraw;
    this._renderClocks(this.controller.clock.remaining);
  }

  _renderThinking(on) {
    if (on) {
      this.elStatus.classList.add('alert');
      this.elStatus.innerHTML = `<span class="thinking-dot"></span> ${t('ai.thinking')}`;
    } else {
      this._renderStatus(this.controller.statusPayload());
    }
  }

  _renderHistory() {
    const sans = this.controller.game.history.map((h) => h.san);
    const a = this.analysis; // per-ply analysis (half-move indexed), or null
    const cell = (halfMove, san) => {
      if (!san) return '<td></td>';
      const info = a && a[halfMove];
      const sym = info ? SYMBOL[info.class] : '';
      const cls = info ? ` an-${info.class}` : '';
      return `<td class="mv${cls}" data-ply="${halfMove + 1}">${san}${sym ? ` <span class="sym">${sym}</span>` : ''}</td>`;
    };
    let rows = '';
    for (let i = 0; i < sans.length; i += 2) {
      const num = i / 2 + 1;
      // data-ply is the position index (after that move) for click-to-review.
      rows += `<tr><td class="num">${num}.</td>${cell(i, sans[i])}${cell(i + 1, sans[i + 1])}</tr>`;
    }
    this.elHistory.innerHTML = rows;
    this.elHistory.querySelectorAll('.mv[data-ply]').forEach((cell) => {
      cell.onclick = () => this.onSeek(Number(cell.dataset.ply));
    });
    this.highlightPly(this.controller.game.history.length);
    const wrap = this.root.querySelector('.history');
    wrap.scrollTop = wrap.scrollHeight;
  }

  /** Mark the move at `ply` (position index) as the current one being viewed. */
  highlightPly(ply) {
    this.elHistory.querySelectorAll('.mv').forEach((cell) => {
      cell.classList.toggle('current', Number(cell.dataset.ply) === ply);
    });
  }

  /** Show a transient message in the status bar (e.g. analysis progress). */
  setMessage(html) {
    this.elStatus.classList.add('alert');
    this.elStatus.innerHTML = html;
  }

  /** Attach analysis results: annotate the history and show a summary panel. */
  setAnalysis(perMove, summary) {
    this.analysis = perMove;
    this._renderHistory();
    this._renderStatus(this.controller.statusPayload());
    const side = (color, label) => {
      const s = summary[color];
      return `<div class="an-side"><span class="an-name">${label}</span>
        <span class="an-acc">${s.accuracy}%</span>
        <span class="an-counts">${s.brilliant}‼ ${s.inaccuracy}?! ${s.mistake}? ${s.blunder}??</span></div>`;
    };
    this.elAnalysis.hidden = false;
    this.elAnalysis.innerHTML =
      `<div class="an-title">${t('analysis.accuracy')}</div>${side(WHITE, t('side.white'))}${side(BLACK, t('side.black'))}`;
  }
}
