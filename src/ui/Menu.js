export class Menu {
  constructor(app) {
    this.app = app;
    this.element = document.createElement('div');
    this.element.className = 'menu-screen';
    this.render();
  }

  render() {
    this.element.innerHTML = `
      <div class="menu-card">
        <h1>Chess Master</h1>
        <p>Modern offline chess with AI, animations, and polished controls.</p>
      </div>
      <div class="menu-grid">
        <div class="menu-card">
          <h2>Play vs AI</h2>
          <button class="secondary" data-action="pve">Start</button>
        </div>
        <div class="menu-card">
          <h2>Local Multiplayer</h2>
          <button data-action="pvp">Start</button>
        </div>
        <div class="menu-card">
          <h2>Settings</h2>
          <button data-action="settings">Open</button>
        </div>
        <div class="menu-card">
          <h2>How to Play</h2>
          <button data-action="help">Open</button>
        </div>
      </div>
    `;
    this.element.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action');
        if (action === 'pve') this.app.startGame('pve');
        if (action === 'pvp') this.app.startGame('pvp');
        if (action === 'settings') this.app.setSettings({});
        if (action === 'help') alert('Use drag-and-drop or click to move. Castling, en passant, promotion, check, checkmate, and draw rules are supported.');
      });
    });
  }
}
