// BoardView renders the 8x8 board and pieces and handles input (drag-and-drop
// plus click-to-move). It is a pure view: it never decides legality itself. It
// asks its host for the legal targets of a picked-up piece and reports completed
// moves back, so all rules stay in the engine.

import { onBoard, fileOf, rankOf, square, algebraic } from '../engine/board.js';
import { pieceColor, pieceType } from '../engine/pieces.js';
import { pieceSvg } from '../assets/pieces.js';

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
    this.selected = -1; // selected source square, or -1
    this.cells = new Map(); // 0x88 square -> cell element
    this.lastMove = null; // { from, to }
    this.checkSquare = -1;
    this._build();
  }

  // Squares in visual order (a8..h1 normally; reversed when flipped).
  _visualOrder() {
    const order = [];
    const ranks = this.flipped ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const files = this.flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    for (const r of ranks) for (const f of files) order.push(square(f, r));
    return order;
  }

  _build() {
    this.wrap = document.createElement('div');
    this.wrap.className = 'board-wrap';
    this.board = document.createElement('div');
    this.board.className = 'board';
    this.wrap.appendChild(this.board);
    this.root.appendChild(this.wrap);
    this._layout();
    // Pointer handling is delegated from the board container.
    this.board.addEventListener('pointerdown', (e) => this._onPointerDown(e));
  }

  // (Re)create the 64 cells in the current visual order.
  _layout() {
    this.board.textContent = '';
    this.cells.clear();
    const order = this._visualOrder();
    for (const sq of order) {
      const cell = document.createElement('div');
      const dark = (fileOf(sq) + rankOf(sq)) % 2 === 0;
      cell.className = `square ${dark ? 'dark' : 'light'}`;
      cell.dataset.sq = String(sq);

      // Edge coordinate labels (files on the bottom row, ranks on the left col).
      const isBottom = order.indexOf(sq) >= 56;
      const isLeft = order.indexOf(sq) % 8 === 0;
      if (isBottom) {
        const f = document.createElement('span');
        f.className = 'coord file';
        f.textContent = 'abcdefgh'[fileOf(sq)];
        cell.appendChild(f);
      }
      if (isLeft) {
        const r = document.createElement('span');
        r.className = 'coord rank';
        r.textContent = String(rankOf(sq) + 1);
        cell.appendChild(r);
      }
      this.board.appendChild(cell);
      this.cells.set(sq, cell);
    }
  }

  setFlipped(value) {
    this.flipped = value;
    this._layout();
    if (this._lastBoard) this.render(this._lastBoard);
    this._reapplyHighlights();
  }

  setInteractive(value) {
    this.interactive = value;
  }

  /** Draw all pieces for the given engine Board. */
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
    const cellFrom = this.cells.get(from);
    if (cellFrom) cellFrom.classList.add('sel');
    for (const to of this.legalTargetsFor(from)) {
      const cell = this.cells.get(to);
      if (!cell) continue;
      const occupied = this._lastBoard && this._lastBoard.squares[to];
      if (occupied) cell.classList.add('capture-target');
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

  // --- Input ---------------------------------------------------------------
  _squareFromEvent(e) {
    const el = e.target.closest('.square');
    return el ? Number(el.dataset.sq) : -1;
  }

  _onPointerDown(e) {
    if (!this.interactive) return;
    const sq = this._squareFromEvent(e);
    if (sq < 0) return;

    // Completing a move onto a legal target of the current selection.
    if (this.selected >= 0 && this.legalTargetsFor(this.selected).includes(sq)) {
      const from = this.selected;
      this.clearSelection();
      this.onMove(from, sq);
      return;
    }

    // Otherwise try to pick up the piece on this square.
    const targets = this.legalTargetsFor(sq);
    this.clearSelection();
    if (targets.length === 0) return;

    this.selected = sq;
    this._showTargets(sq);
    this._beginDrag(e, sq);
  }

  // Drag a floating clone of the piece so it can be dropped on a target square.
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
      // If not a valid drop, selection stays so click-to-move still works.
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
}
