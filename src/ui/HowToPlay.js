// A static rules-and-controls reference screen.

export class HowToPlay {
  constructor(root, { onBack }) {
    this.root = root;
    this.onBack = onBack;
    this.render();
  }

  render() {
    this.root.innerHTML = `
      <div class="panel howto">
        <h2>How to Play</h2>

        <h3>Goal</h3>
        <p>Checkmate the opponent's king — attack it so it cannot escape capture.</p>

        <h3>Moving pieces</h3>
        <ul>
          <li><strong>Pawn</strong> — forward one square (two from its start); captures diagonally.</li>
          <li><strong>Knight</strong> — an L-shape; the only piece that jumps over others.</li>
          <li><strong>Bishop</strong> — any distance diagonally.</li>
          <li><strong>Rook</strong> — any distance in straight lines.</li>
          <li><strong>Queen</strong> — any distance in straight lines or diagonals.</li>
          <li><strong>King</strong> — one square in any direction.</li>
        </ul>

        <h3>Special moves</h3>
        <ul>
          <li><strong>Castling</strong> — king and rook move together for safety, if neither has
              moved, the path is clear, and the king is not moving through check.</li>
          <li><strong>En passant</strong> — capture a pawn that just advanced two squares as if it
              had moved one.</li>
          <li><strong>Promotion</strong> — a pawn reaching the far rank becomes a queen, rook,
              bishop, or knight (you choose).</li>
        </ul>

        <h3>Ending the game</h3>
        <ul>
          <li><strong>Checkmate</strong> — the king is in check and cannot escape: the game is won.</li>
          <li><strong>Stalemate</strong> — no legal move but not in check: it is a draw.</li>
          <li><strong>Draws</strong> — also by threefold repetition, the fifty-move rule, or
              insufficient material.</li>
        </ul>

        <h3>Using this app</h3>
        <ul>
          <li><strong>Move</strong> — drag a piece, or click it and then click a highlighted square.</li>
          <li>Legal moves, the last move, and a king in check are highlighted.</li>
          <li><strong>Annotate</strong> — right-click a square to highlight it, or right-drag between
              two squares to draw an arrow. Left-click clears annotations.</li>
          <li><strong>Review</strong> — click any move in the history, or use ← / → to step through
              the game (Home = start, End = latest).</li>
          <li>Use <strong>Flip</strong> to rotate the board, <strong>Undo</strong> to take back a move,
              and the clocks for timed play.</li>
          <li>Toggle sound, highlights, animations, and the board theme in <strong>Settings</strong>.</li>
        </ul>

        <h3>Keyboard shortcuts</h3>
        <ul>
          <li><strong>← / →</strong> — step back / forward through moves; <strong>Home / End</strong> — jump to start / latest.</li>
          <li><strong>F</strong> — flip board · <strong>Shift+F</strong> — fullscreen · <strong>U</strong> — undo · <strong>N</strong> — new game · <strong>Esc</strong> — exit review.</li>
        </ul>

        <div class="actions"><button class="primary" data-act="back">Back to Menu</button></div>
      </div>`;
    this.root.querySelector('[data-act="back"]').onclick = () => this.onBack();
  }
}
