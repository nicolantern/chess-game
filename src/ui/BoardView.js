import { Color, PieceType } from '../engine/pieces.js';
import { fromIndex } from '../engine/board.js';

export class BoardView {
  constructor(app) {
    this.app = app;
    this.selected = null;
    this.element = document.createElement('div');
    this.element.className = 'game-screen';
    this.render();
  }

  render() {
    this.element.innerHTML = `
      <div class="panel">
        <h2>${this.app.mode === 'pve' ? 'Player vs AI' : 'Local Multiplayer'}</h2>
        <div class="board-shell">
          <div class="board" id="board"></div>
          <div class="panel">
            <div class="controls">
              <button id="back-menu">Main Menu</button>
              <button id="undo" class="secondary">Undo</button>
              <div>Status: ${this.app.game.status}</div>
              <div>Turn: ${this.app.game.turn === 'w' ? 'White' : 'Black'}</div>
            </div>
            <div class="captured">
              <h3>Captured</h3>
              <div class="list" id="captured"></div>
            </div>
            <div class="history">
              <h3>History</h3>
              <div class="list" id="history"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.renderBoard();
    this.element.querySelector('#back-menu').addEventListener('click', () => {
      this.app.screen = 'menu';
      this.app.render();
    });
    this.element.querySelector('#undo').addEventListener('click', () => {
      this.app.game.undoMove();
      this.render();
    });
  }

  renderBoard() {
    const boardEl = this.element.querySelector('#board');
    boardEl.innerHTML = '';
    const squares = [];
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const square = document.createElement('div');
        const isLight = (row + col) % 2 === 0;
        square.className = `square ${isLight ? 'light' : 'dark'}`;
        const file = String.fromCharCode(97 + col);
        const rank = 8 - row;
        const coord = `${file}${rank}`;
        const piece = this.app.game.getPiece(coord);
        if (piece) {
          const img = document.createElement('div');
          img.className = 'piece';
          img.textContent = piece.symbol;
          square.appendChild(img);
        }
        square.addEventListener('click', () => this.handleSquareClick(coord));
        squares.push(square);
      }
    }
    boardEl.append(...squares);
  }

  handleSquareClick(square) {
    const piece = this.app.game.getPiece(square);
    if (!this.selected && piece) {
      this.selected = square;
      this.render();
      return;
    }
    if (this.selected && this.selected !== square) {
      const move = { from: this.selected, to: square, piece: this.app.game.getPiece(this.selected) };
      this.app.game.makeMove(move);
      this.selected = null;
      this.render();
      return;
    }
    this.selected = null;
    this.render();
  }
}
