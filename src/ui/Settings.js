// Settings screen. Edits the shared settings object in place, persists every
// change, and calls onChange so the rest of the app can react live (theme swap,
// sound toggle, etc.).

import { saveSettings } from '../utils/storage.js';

const TOGGLES = [
  ['sound', 'Sound effects'],
  ['music', 'Background music'],
  ['highlights', 'Move highlights'],
  ['animations', 'Animations'],
];

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
          <span>${label}</span>
          <label class="switch">
            <input type="checkbox" data-key="${key}" ${this.settings[key] ? 'checked' : ''}/>
            <span class="track"></span>
          </label>
        </div>`,
    ).join('');

    const themes = ['wood', 'marble', 'green', 'blue', 'coral', 'slate']
      .map(
        (t) =>
          `<button data-theme="${t}" class="${this.settings.theme === t ? 'selected' : ''}">${
            t[0].toUpperCase() + t.slice(1)
          }</button>`,
      )
      .join('');

    this.root.innerHTML = `
      <div class="panel">
        <h2>Settings</h2>
        ${toggles}
        <div class="field"><label>Board theme</label><div class="option-row">${themes}</div></div>
        <div class="actions"><button class="primary" data-act="back">Back to Menu</button></div>
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
    this.root.querySelector('[data-act="back"]').onclick = () => this.onBack();
  }
}
