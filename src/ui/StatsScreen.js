// Profile & statistics dashboard: editable name, lifetime stats, per-difficulty
// breakdown, and the saved-games list (replay / export PGN / delete).

import { loadProfile, saveProfile, resetStats, computeAchievements } from '../utils/profile.js';
import { toPgn } from '../utils/pgn.js';
import { DIFFICULTY_LABELS } from '../ai/difficulty.js';
import { WHITE } from '../engine/pieces.js';

const fmtDuration = (ms) => {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export class StatsScreen {
  constructor(root, { onBack, onReplay }) {
    this.root = root;
    this.onBack = onBack;
    this.onReplay = onReplay;
    this.profile = loadProfile();
    this.render();
  }

  render() {
    const s = this.profile.stats;
    const aiGames = s.wins + s.losses + s.draws;
    const winRate = aiGames ? Math.round((s.wins / aiGames) * 100) : 0;
    const avgDur = s.total ? fmtDuration(s.totalDurationMs / s.total) : '—';
    const avgMoves = s.total ? Math.round(s.totalMoves / s.total) : 0;

    const tile = (label, value) =>
      `<div class="stat-tile"><span class="v">${value}</span><span class="l">${label}</span></div>`;

    const tiles = [
      tile('Rating (Elo)', s.rating),
      tile('Games played', s.total),
      tile('Wins vs AI', s.wins),
      tile('Losses vs AI', s.losses),
      tile('Draws vs AI', s.draws),
      tile('Win rate', `${winRate}%`),
      tile('Best streak', s.bestStreak),
      tile('Flawless wins', s.flawlessWins),
      tile('Fastest mate', s.fastestMateMoves != null ? `${s.fastestMateMoves} moves` : '—'),
      tile('Avg duration', avgDur),
      tile('Avg moves', avgMoves),
    ].join('');

    const levelRows = Object.entries(DIFFICULTY_LABELS)
      .map(([key, label]) => {
        const b = s.byLevel[key] || { w: 0, l: 0, d: 0 };
        return `<tr><td>${label}</td><td>${b.w}</td><td>${b.l}</td><td>${b.d}</td></tr>`;
      })
      .join('');

    const saved = this.profile.savedGames.length
      ? this.profile.savedGames
          .map(
            (g) => `
          <div class="saved-game" data-id="${g.id}">
            <div class="sg-info"><strong>${g.name}</strong><span>${g.date} · ${g.sans.length} plies</span></div>
            <div class="sg-actions">
              <button data-sg="replay">Replay</button>
              <button data-sg="pgn">PGN</button>
              <button data-sg="delete" class="ghost">✕</button>
            </div>
          </div>`,
          )
          .join('')
      : '<p class="subtitle">No saved games yet. Finish a game and choose “Save Game”.</p>';

    this.root.innerHTML = `
      <div class="panel stats">
        <h2>Profile &amp; Stats</h2>
        <div class="field row-between">
          <label for="pname">Player name</label>
          <input id="pname" class="name-input" type="text" maxlength="24" value="${escapeHtml(this.profile.name)}"/>
        </div>

        <div class="stat-grid">${tiles}</div>

        <h3>By difficulty (vs AI)</h3>
        <table class="level-table">
          <thead><tr><th>Level</th><th>W</th><th>L</th><th>D</th></tr></thead>
          <tbody>${levelRows}</tbody>
        </table>

        <h3>Achievements</h3>
        <div class="ach-grid">${this._achievementsHtml()}</div>

        <h3>Saved games</h3>
        <div class="saved-list">${saved}</div>

        <div class="actions">
          <button data-act="reset" class="ghost">Reset stats</button>
          <button class="primary" data-act="back">Back to Menu</button>
        </div>
      </div>`;

    this._wire();
  }

  _achievementsHtml() {
    return computeAchievements(this.profile.stats)
      .map(
        (a) => `
        <div class="ach ${a.done ? 'done' : ''}">
          <span class="a-ico">${a.icon}</span>
          <span class="a-txt">
            <strong>${a.label}${a.done ? ' ✓' : ''}</strong>
            <span>${a.desc}${a.progress && !a.done ? ` (${a.progress})` : ''}</span>
          </span>
        </div>`,
      )
      .join('');
  }

  _wire() {
    const nameInput = this.root.querySelector('#pname');
    nameInput.onchange = () => {
      this.profile.name = nameInput.value.trim() || 'Player';
      saveProfile(this.profile);
    };

    this.root.querySelector('[data-act="back"]').onclick = () => this.onBack();
    this.root.querySelector('[data-act="reset"]').onclick = () => {
      if (confirm('Reset all statistics? Saved games are kept.')) {
        this.profile = resetStats(this.profile);
        this.render();
      }
    };

    this.root.querySelectorAll('.saved-game').forEach((row) => {
      const id = Number(row.dataset.id);
      const game = this.profile.savedGames.find((g) => g.id === id);
      row.querySelector('[data-sg="replay"]').onclick = () => this.onReplay(game);
      row.querySelector('[data-sg="pgn"]').onclick = () => this._showPgn(game);
      row.querySelector('[data-sg="delete"]').onclick = () => {
        this.profile.savedGames = this.profile.savedGames.filter((g) => g.id !== id);
        saveProfile(this.profile);
        this.render();
      };
    });
  }

  _showPgn(game) {
    const white = game.startConfig.humanColor === WHITE ? this.profile.name : 'Computer';
    const black = game.startConfig.humanColor === WHITE ? 'Computer' : this.profile.name;
    const pgn = toPgn({
      sans: game.sans,
      result: game.result,
      winner: game.winner,
      white: game.startConfig.mode === 'ai' ? white : 'White',
      black: game.startConfig.mode === 'ai' ? black : 'Black',
      date: game.date,
    });

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <h2>PGN</h2>
        <textarea class="pgn-text" readonly>${escapeHtml(pgn)}</textarea>
        <div class="actions">
          <button data-p="copy">Copy</button>
          <button data-p="download">Download</button>
          <button class="primary" data-p="close">Close</button>
        </div>
      </div>`;
    const close = () => backdrop.remove();
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop) close();
    });
    backdrop.querySelector('[data-p="close"]').onclick = close;
    backdrop.querySelector('[data-p="copy"]').onclick = () => {
      navigator.clipboard?.writeText(pgn).catch(() => {});
      backdrop.querySelector('[data-p="copy"]').textContent = 'Copied';
    };
    backdrop.querySelector('[data-p="download"]').onclick = () => {
      const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `chess-${game.id}.pgn`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    document.body.appendChild(backdrop);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
