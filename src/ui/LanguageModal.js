// The "Choose Your Preferred Language" modal — a grid of languages (native name
// over the English name), matching the chess.com picker. Appends an overlay to
// <body>; calls onChoose(code) and closes when a language is picked.

import { LANGUAGES, getLanguage, t } from '../utils/i18n.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class LanguageModal {
  constructor({ onChoose } = {}) {
    this.onChoose = onChoose || (() => {});
    const current = getLanguage();

    this.overlay = document.createElement('div');
    this.overlay.className = 'lang-overlay';
    this.overlay.innerHTML = `
      <div class="lang-modal" role="dialog" aria-modal="true" aria-label="${esc(t('lang.title'))}">
        <div class="lang-head">
          <h2>${esc(t('lang.title'))}</h2>
          <button class="lang-close" aria-label="Close">✕</button>
        </div>
        <div class="lang-grid">
          ${LANGUAGES.map((l) => `
            <button class="lang-item ${l.code === current ? 'selected' : ''}" data-code="${esc(l.code)}">
              <span class="native">${esc(l.native)}</span>
              <span class="eng">${esc(l.english)}</span>
            </button>`).join('')}
        </div>
      </div>`;

    document.body.appendChild(this.overlay);

    this.overlay.querySelector('.lang-close').onclick = () => this.close();
    this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(); };
    this._onKey = (e) => { if (e.key === 'Escape') this.close(); };
    document.addEventListener('keydown', this._onKey);

    this.overlay.querySelectorAll('.lang-item').forEach((btn) => {
      btn.onclick = () => {
        const code = btn.dataset.code;
        this.close();
        this.onChoose(code);
      };
    });
  }

  close() {
    document.removeEventListener('keydown', this._onKey);
    this.overlay.remove();
  }
}
