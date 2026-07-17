// Entry point: load styles and mount the app.
import './assets/theme.css';
import { App } from './ui/App.js';

const root = document.getElementById('app');
// eslint-disable-next-line no-new
new App(root);
