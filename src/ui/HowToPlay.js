// A static rules-and-controls reference screen. The rules prose lives in the
// i18n catalog (howto.body) so it can be shown in the active language.

import { t } from '../utils/i18n.js';

export class HowToPlay {
  constructor(root, { onBack }) {
    this.root = root;
    this.onBack = onBack;
    this.render();
  }

  render() {
    this.root.innerHTML = `
      <div class="panel howto">
        <h2>${t('howto.title')}</h2>
        ${t('howto.body')}
        <div class="actions"><button class="primary" data-act="back">${t('common.backToMenu')}</button></div>
      </div>`;
    this.root.querySelector('[data-act="back"]').onclick = () => this.onBack();
  }
}
