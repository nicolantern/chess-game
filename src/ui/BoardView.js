// BoardView renders the 8x8 board and pieces and handles input (drag-and-drop
// plus click-to-move). It is a pure view: it never decides legality itself. It
// asks its host for the legal targets of a picked-up piece and reports completed
// moves back, so all rules stay in the engine.
//
// It also supports user annotations (right-drag to draw an arrow, right-click to
// highlight a square) and rendering an arbitrary position for history review.

import { fileOf, rankOf, square } from '../engine/board.js';
import { pieceColor, pieceType } from '../engine/pieces.js';
import { pieceSvg, PIECE_DEFS } from '../assets/pieces.js';

// The pieces' shading gradients live in one shared <defs>, added to the page a
// single time (referenced by every piece by ID). Boards created later reuse it.
function ensurePieceDefs() {
  if (typeof document === 'undefined' || document.getElementById('piece-defs')) return;
  const holder = document.createElement('div');
  holder.id = 'piece-defs';
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = PIECE_DEFS;
  document.body.appendChild(holder);
}

export class BoardView {
  /**
   * @param {HTMLElement} root
   * @param {object} opts
   * @param {(sq:number)=>number[]} opts.legalTargetsFor  legal destination squares for a piece
   * @param {(from:number,to:number)=>void} opts.onMove   user completed a move
   * @param {object} opts.settings                        live settings (highlights, etc.)
   */
  constructor(root, { legalTargetsFor, onMove, settings }) {
    this.root = root;
    this.legalTargetsFor = legalTargetsFor;
    this.onMove = onMove;
    this.settings = settings;
    this.flipped = false;
    this.interactive = true;
    this.selected = -1;
    this.cells = new Map(); // 0x88 square -> cell element
    this.visualIndex = new Map(); // 0x88 square -> 0..63 visual position
    this.lastMove = null;
    this.checkSquare = -1;
    this.annotations = { arrows: [], highlights: new Set() }; // user scratch marks
    this._build();
  }

  _visualOrder() {
    const order = [];
    const ranks = this.flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const files = this.flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    for (const r of ranks) for (const f of files) order.push(square(f, r));
    return order;
  }

  _build() {
    ensurePieceDefs();
    this.wrap = document.createElement('div');
    this.wrap.className = 'board-wrap';
    this.board = document.createElement('div');
    this.board.className = 'board';
    // Annotation overlay (arrows). pointer-events disabled so clicks pass through.
    this.overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.overlay.setAttribute('class', 'annotations');
    this.overlay.setAttribute('viewBox', '0 0 100 100');
    this.overlay.setAttribute('preserveAspectRatio', 'none');
    this.overlay.innerHTML =
      '<defs><marker id="ah" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto">' +
      '<path d="M0,0 L4,2 L0,4 z" fill="context-stroke"/></marker></defs>';
    this.wrap.appendChild(this.board);
    this.root.appendChild(this.wrap);
    this._layout(); // appends cells and (re)attaches the overlay inside .board

    this.board.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    this.board.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _layout() {
    this.board.textContent = '';
    this.cells.clear();
    this.visualIndex.clear();
    const order = this._visualOrder();
    order.forEach((sq, idx) => {
      const cell = document.createElement('div');
      const dark = (fileOf(sq) + rankOf(sq)) % 2 === 0;
      cell.className = `square ${dark ? 'dark' : 'light'}`;
      cell.dataset.sq = String(sq);

      if (idx >= 56) {
        const f = document.createElement('span');
        f.className = 'coord file';
        f.textContent = 'abcdefgh'[fileOf(sq)];
        cell.appendChild(f);
      }
      if (idx % 8 === 0) {
        const r = document.createElement('span');
        r.className = 'coord rank';
        r.textContent = String(rankOf(sq) + 1);
        cell.appendChild(r);
      }
      this.board.appendChild(cell);
      this.cells.set(sq, cell);
      this.visualIndex.set(sq, idx);
    });
    // The annotation overlay lives inside .board so its 0-100 viewBox maps
    // exactly onto the 8x8 grid regardless of board size.
    this.board.appendChild(this.overlay);
  }

  setFlipped(value) {
    this.flipped = value;
    this._layout();
    if (this._lastBoard) this.render(this._lastBoard);
    this._reapplyHighlights();
    this._renderAnnotations();
  }

  setInteractive(value) {
    this.interactive = value;
  }

  render(engineBoard) {
    this._lastBoard = engineBoard;
    for (const [sq, cell] of this.cells) {
      const existing = cell.querySelector('.piece');
      if (existing) existing.remove();
      const piece = engineBoard.squares[sq];
      if (!piece) continue;
      const el = document.createElement('div');
      el.className = 'piece';
      el.dataset.sq = String(sq);
      el.innerHTML = pieceSvg(pieceColor(piece), pieceType(piece));
      cell.appendChild(el);
    }
  }

  // --- Highlights ----------------------------------------------------------
  clearSelection() {
    this.selected = -1;
    for (const cell of this.cells.values()) {
      cell.classList.remove('sel', 'capture-target');
      const dot = cell.querySelector('.dot');
      if (dot) dot.remove();
    }
  }

  _showTargets(from) {
    if (!this.settings.highlights) return;
    this.cells.get(from)?.classList.add('sel');
    for (const to of this.legalTargetsFor(from)) {
      const cell = this.cells.get(to);
      if (!cell) continue;
      if (this._lastBoard && this._lastBoard.squares[to]) cell.classList.add('capture-target');
      const dot = document.createElement('span');
      dot.className = 'dot';
      cell.appendChild(dot);
    }
  }

  setLastMove(move) {
    this.lastMove = move ? { from: move.from, to: move.to } : null;
    this._reapplyHighlights();
  }

  setCheckSquare(sq) {
    this.checkSquare = sq ?? -1;
    this._reapplyHighlights();
  }

  _reapplyHighlights() {
    for (const cell of this.cells.values()) cell.classList.remove('last', 'check');
    if (this.settings.highlights && this.lastMove) {
      this.cells.get(this.lastMove.from)?.classList.add('last');
      this.cells.get(this.lastMove.to)?.classList.add('last');
    }
    if (this.checkSquare >= 0) this.cells.get(this.checkSquare)?.classList.add('check');
  }

  // --- Annotations (right-click) -------------------------------------------
  clearAnnotations() {
    this.annotations = { arrows: [], highlights: new Set() };
    this._renderAnnotations();
  }

  _center(sq) {
    const idx = this.visualIndex.get(sq);
    const col = idx % 8;
    const row = Math.floor(idx / 8);
    return { x: (col + 0.5) * 12.5, y: (row + 0.5) * 12.5 };
  }

  _renderAnnotations() {
    // Square highlights.
    for (const cell of this.cells.values()) cell.classList.remove('annot');
    for (const sq of this.annotations.highlights) this.cells.get(sq)?.classList.add('annot');
    // Arrows.
    const defs = this.overlay.querySelector('defs').outerHTML;
    let lines = '';
    for (const arrow of this.annotations.arrows) {
      const a = this._center(arrow.from);
      const b = this._center(arrow.to);
      // Shorten the arrow slightly so the head sits inside the target square.
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const bx = b.x - (dx / len) * 4;
      const by = b.y - (dy / len) * 4;
      const color = arrow.color || '#f0a020';
      lines +=
        `<line x1="${a.x}" y1="${a.y}" x2="${bx}" y2="${by}" ` +
        `stroke="${color}" stroke-width="2.2" stroke-linecap="round" ` +
        `marker-end="url(#ah)" opacity="0.85"/>`;
    }
    this.overlay.innerHTML = defs + lines;
  }

  /** Draw a programmatic arrow (e.g. a move hint) in a distinct color. */
  drawArrow(from, to, color = '#3fb37f') {
    this.annotations.arrows.push({ from, to, color });
    this._renderAnnotations();
  }

  // --- Input ---------------------------------------------------------------
  _squareFromEvent(e) {
    const el = e.target.closest('.square');
    return el ? Number(el.dataset.sq) : -1;
  }

  _onPointerDown(e) {
    // Right button: draw annotations (works whether or not it's the player's turn).
    if (e.button === 2) {
      e.preventDefault();
      this._beginAnnotation(e);
      return;
    }
    // Any left click clears annotations.
    if (this.annotations.arrows.length || this.annotations.highlights.size) this.clearAnnotations();

    if (!this.interactive) return;
    const sq = this._squareFromEvent(e);
    if (sq < 0) return;

    if (this.selected >= 0 && this.legalTargetsFor(this.selected).includes(sq)) {
      const from = this.selected;
      this.clearSelection();
      this.onMove(from, sq);
      return;
    }

    const targets = this.legalTargetsFor(sq);
    this.clearSelection();
    if (targets.length === 0) return;

    this.selected = sq;
    this._showTargets(sq);
    this._beginDrag(e, sq);
  }

  // Right-drag: draw an arrow; right-click without moving: toggle a highlight.
  _beginAnnotation(e) {
    const from = this._squareFromEvent(e);
    if (from < 0) return;
    const up = (ev) => {
      window.removeEventListener('pointerup', up);
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const cell = target && target.closest('.square');
      const to = cell ? Number(cell.dataset.sq) : from;
      if (to === from) {
        // toggle square highlight
        if (this.annotations.highlights.has(from)) this.annotations.highlights.delete(from);
        else this.annotations.highlights.add(from);
      } else {
        // toggle arrow (remove if it already exists)
        const i = this.annotations.arrows.findIndex((ar) => ar.from === from && ar.to === to);
        if (i >= 0) this.annotations.arrows.splice(i, 1);
        else this.annotations.arrows.push({ from, to });
      }
      this._renderAnnotations();
    };
    window.addEventListener('pointerup', up);
  }

  _beginDrag(e, from) {
    const cell = this.cells.get(from);
    const pieceEl = cell?.querySelector('.piece');
    if (!pieceEl) return;

    const rect = pieceEl.getBoundingClientRect();
    const ghost = pieceEl.cloneNode(true);
    ghost.classList.add('dragging');
    Object.assign(ghost.style, {
      position: 'fixed',
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      pointerEvents: 'none',
    });
    document.body.appendChild(ghost);
    pieceEl.style.opacity = '0.25';

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const move = (ev) => {
      ghost.style.left = `${ev.clientX - offsetX}px`;
      ghost.style.top = `${ev.clientY - offsetY}px`;
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      ghost.remove();
      pieceEl.style.opacity = '';
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const cellEl = target && target.closest('.square');
      const to = cellEl ? Number(cellEl.dataset.sq) : -1;
      if (to >= 0 && this.legalTargetsFor(from).includes(to)) {
        this.clearSelection();
        this.onMove(from, to);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
}
