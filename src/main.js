// Entry point: load styles, mount the app, then dismiss the loading screen.
import './assets/theme.css';
import { App } from './ui/App.js';

const root = document.getElementById('app');
// eslint-disable-next-line no-new
new App(root);

// Fade out the loading splash once the first screen is mounted.
const loading = document.getElementById('loading');
if (loading) {
  // A short minimum display avoids a jarring flash on fast loads.
  setTimeout(() => {
    loading.classList.add('hide');
    loading.addEventListener('transitionend', () => loading.remove(), { once: true });
  }, 350);
}
