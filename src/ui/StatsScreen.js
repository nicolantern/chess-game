// Profile & statistics dashboard: editable name, lifetime stats, per-difficulty
// breakdown, and the saved-games list (replay / export PGN / delete).

import { loadProfile, saveProfile, resetStats, computeAchievements } from '../utils/profile.js';
import { toPgn } from '../utils/pgn.js';
import { DIFFICULTY_LABELS } from '../ai/difficulty.js';
import { WHITE } from '../engine/pieces.js';
import { t } from '../utils/i18n.js';

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
      tile(t('stats.rating'), s.rating),
      tile(t('stats.gamesPlayed'), s.total),
      tile(t('stats.winsAi'), s.wins),
      tile(t('stats.lossesAi'), s.losses),
      tile(t('stats.drawsAi'), s.draws),
      tile(t('stats.winRate'), `${winRate}%`),
      tile(t('stats.bestStreak'), s.bestStreak),
      tile(t('stats.flawlessWins'), s.flawlessWins),
      tile(t('stats.fastestMate'), s.fastestMateMoves != null ? t('stats.moves', { n: s.fastestMateMoves }) : '—'),
      tile(t('stats.avgDuration'), avgDur),
      tile(t('stats.avgMoves'), avgMoves),
      tile(t('stats.onlineWld'), `${s.onlineWins || 0}/${s.onlineLosses || 0}/${s.onlineDraws || 0}`),
    ].join('');

    const levelRows = Object.keys(DIFFICULTY_LABELS)
      .map((key) => {
        const b = s.byLevel[key] || { w: 0, l: 0, d: 0 };
        return `<tr><td>${t(`diff.${key}`)}</td><td>${b.w}</td><td>${b.l}</td><td>${b.d}</td></tr>`;
      })
      .join('');

    const saved = this.profile.savedGames.length
      ? this.profile.savedGames
          .map(
            (g) => `
          <div class="saved-game" data-id="${g.id}">
            <div class="sg-info"><strong>${g.name}</strong><span>${g.date} · ${t('stats.plies', { n: g.sans.length })}</span></div>
            <div class="sg-actions">
              <button data-sg="replay">${t('stats.replay')}</button>
              <button data-sg="pgn">${t('stats.pgn')}</button>
              <button data-sg="delete" class="ghost">✕</button>
            </div>
          </div>`,
          )
          .join('')
      : `<p class="subtitle">${t('stats.noSaved')}</p>`;

    this.root.innerHTML = `
      <div class="panel stats">
        <h2>${t('stats.title')}</h2>
        <div class="field row-between">
          <label for="pname">${t('stats.playerName')}</label>
          <input id="pname" class="name-input" type="text" maxlength="24" value="${escapeHtml(this.profile.name)}"/>
        </div>

        <div class="stat-grid">${tiles}</div>

        <h3>${t('stats.byDifficulty')}</h3>
        <table class="level-table">
          <thead><tr><th>${t('stats.level')}</th><th>W</th><th>L</th><th>D</th></tr></thead>
          <tbody>${levelRows}</tbody>
        </table>

        <h3>${t('stats.achievements')}</h3>
        <div class="ach-grid">${this._achievementsHtml()}</div>

        <h3>${t('stats.savedGames')}</h3>
        <div class="saved-list">${saved}</div>

        <div class="actions">
          <button data-act="reset" class="ghost">${t('stats.reset')}</button>
          <button class="primary" data-act="back">${t('common.backToMenu')}</button>
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
      if (confirm(t('stats.resetConfirm'))) {
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
        <h2>${t('pgn.title')}</h2>
        <textarea class="pgn-text" readonly>${escapeHtml(pgn)}</textarea>
        <div class="actions">
          <button data-p="copy">${t('pgn.copy')}</button>
          <button data-p="download">${t('pgn.download')}</button>
          <button class="primary" data-p="close">${t('pgn.close')}</button>
        </div>
      </div>`;
    const close = () => backdrop.remove();
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop) close();
    });
    backdrop.querySelector('[data-p="close"]').onclick = close;
    backdrop.querySelector('[data-p="copy"]').onclick = () => {
      navigator.clipboard?.writeText(pgn).catch(() => {});
      backdrop.querySelector('[data-p="copy"]').textContent = t('pgn.copied');
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
