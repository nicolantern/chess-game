// Login / sign-up screen. On success it stores the session and reconciles the
// profile: signing up seeds the new account with your current local progress;
// logging in adopts the server's profile.

import { api } from '../utils/api.js';
import { setSession } from '../utils/session.js';
import { loadProfile, saveProfile } from '../utils/profile.js';

export class AccountScreen {
  constructor(root, { onDone, onBack }) {
    this.root = root;
    this.onDone = onDone;
    this.onBack = onBack;
    this.mode = 'login'; // 'login' | 'register'
    this.pending = false;
    this.render();
  }

  render() {
    const isLogin = this.mode === 'login';
    this.root.innerHTML = `
      <div class="panel account">
        <h2>${isLogin ? 'Log In' : 'Sign Up'}</h2>
        <p class="subtitle">Sync your stats, rating, achievements, and saved games across devices.</p>

        <div class="tabs">
          <button data-tab="login" class="${isLogin ? 'selected' : ''}">Log In</button>
          <button data-tab="register" class="${!isLogin ? 'selected' : ''}">Sign Up</button>
        </div>

        <form class="account-form">
          <label class="num">Username
            <input name="username" type="text" autocomplete="username" maxlength="24"
                   placeholder="3–24 letters, numbers, _"/></label>
          <label class="num">Password
            <input name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}"
                   placeholder="at least 6 characters"/></label>
          <div class="form-error" role="alert"></div>
          <div class="actions">
            <button type="button" data-act="back">Back</button>
            <button type="submit" class="primary">${isLogin ? 'Log In' : 'Create Account'}</button>
          </div>
        </form>
      </div>`;

    this.root.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.onclick = () => {
        this.mode = btn.dataset.tab;
        this.render();
      };
    });
    this.root.querySelector('[data-act="back"]').onclick = () => this.onBack();
    this.form = this.root.querySelector('.account-form');
    this.errorEl = this.root.querySelector('.form-error');
    this.form.onsubmit = (e) => {
      e.preventDefault();
      this._submit();
    };
  }

  async _submit() {
    if (this.pending) return;
    const username = this.form.username.value.trim();
    const password = this.form.password.value;
    this._setError('');
    this._setPending(true);
    try {
      if (this.mode === 'register') {
        const { token } = await api.register(username, password);
        setSession(token, username);
        // Seed the fresh account with whatever local progress exists.
        const local = loadProfile();
        local.name = username;
        saveProfile(local); // triggers an upload to the server
      } else {
        const { token, profile } = await api.login(username, password);
        setSession(token, username);
        saveProfile(profile, false); // adopt the server profile without re-uploading
      }
      this.onDone();
    } catch (err) {
      this._setError(err.message || 'Something went wrong.');
      this._setPending(false);
    }
  }

  _setPending(on) {
    this.pending = on;
    const submit = this.form.querySelector('button[type="submit"]');
    submit.disabled = on;
    submit.textContent = on ? 'Please wait…' : this.mode === 'login' ? 'Log In' : 'Create Account';
  }

  _setError(msg) {
    this.errorEl.textContent = msg;
  }
}
