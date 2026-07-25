// Settings screen. Edits the shared settings object in place, persists every
// change, and calls onChange so the rest of the app can react live (theme swap,
// sound toggle, etc.). Also hosts the Language picker.

import { saveSettings } from '../utils/storage.js';
import { t, setLanguage, currentLanguageLabel } from '../utils/i18n.js';
import { LanguageModal } from './LanguageModal.js';

const TOGGLES = [
  ['sound', 'settings.sound'],
  ['music', 'settings.music'],
  ['highlights', 'settings.highlights'],
  ['animations', 'settings.animations'],
];

const THEMES = ['wood', 'marble', 'green', 'blue', 'coral', 'slate'];

export class Settings {
  constructor(root, { settings, onChange, onBack }) {
    this.root = root;
    this.settings = settings;
    this.onChange = onChange;
    this.onBack = onBack;
    this.render();
  }

  render() {
    const toggles = TOGGLES.map(
      ([key, label]) => `
        <div class="field row-between">
          <span>${t(label)}</span>
          <label class="switch">
            <input type="checkbox" data-key="${key}" ${this.settings[key] ? 'checked' : ''}/>
            <span class="track"></span>
          </label>
        </div>`,
    ).join('');

    const themes = THEMES
      .map(
        (name) =>
          `<button data-theme="${name}" class="${this.settings.theme === name ? 'selected' : ''}">${t(`theme.${name}`)}</button>`,
      )
      .join('');

    this.root.innerHTML = `
      <div class="panel">
        <h2>${t('settings.title')}</h2>
        ${toggles}
        <div class="field row-between">
          <span>${t('settings.language')}</span>
          <button class="lang-pick" data-act="language">🌐 ${currentLanguageLabel()}</button>
        </div>
        <div class="field"><label>${t('settings.boardTheme')}</label><div class="option-row">${themes}</div></div>
        <div class="actions"><button class="primary" data-act="back">${t('common.backToMenu')}</button></div>
      </div>`;

    this.root.querySelectorAll('input[data-key]').forEach((input) => {
      input.onchange = () => {
        this.settings[input.dataset.key] = input.checked;
        saveSettings(this.settings);
        this.onChange();
      };
    });
    this.root.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.onclick = () => {
        this.settings.theme = btn.dataset.theme;
        saveSettings(this.settings);
        this.onChange();
        this.root.querySelectorAll('[data-theme]').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      };
    });
    this.root.querySelector('[data-act="language"]').onclick = () => {
      new LanguageModal({
        onChoose: (code) => {
          setLanguage(code);
          this.settings.language = code;
          saveSettings(this.settings);
          this.onChange();
          this.render(); // re-render Settings in the newly chosen language
        },
      });
    };
    this.root.querySelector('[data-act="back"]').onclick = () => this.onBack();
  }
}
