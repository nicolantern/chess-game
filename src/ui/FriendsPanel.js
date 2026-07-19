// Friends UI: add by username, respond to requests, see friends with an online
// dot, challenge them, and negotiate/answer game challenges. Pure view over a
// social snapshot; all mutations go through api.social and then re-fetch via
// onRefresh (authoritative state always comes from the server).

import { api, ApiError } from '../utils/api.js';

export class FriendsPanel {
  /**
   * @param {HTMLElement} root
   * @param {object} opts
   * @param {object} opts.snapshot          latest GET /api/social result (may include __me)
   * @param {() => Promise<void>} opts.onRefresh   re-fetch + re-render
   * @param {(friend:string)=>void} opts.onChallenge  open the challenge picker
   */
  constructor(root, { snapshot, onRefresh, onChallenge }) {
    this.root = root;
    this.snapshot = snapshot || emptySnapshot();
    this.onRefresh = onRefresh || (async () => {});
    this.onChallenge = onChallenge || (() => {});
    this.error = '';
    this._render();
  }

  update(snapshot) {
    this.snapshot = snapshot || emptySnapshot();
    this._render();
  }

  async _do(fn) {
    this.error = '';
    try {
      await fn();
      await this.onRefresh();
    } catch (e) {
      this.error = e instanceof ApiError ? e.message : 'Something went wrong.';
      this._render();
    }
  }

  _meLower() {
    return (this.snapshot.__me || '').toLowerCase();
  }

  _counter(id) {
    const time = pickTime();
    if (time !== undefined) this._do(() => api.social.counterChallenge(id, time));
  }

  _challengesHtml() {
    const ch = this.snapshot.challenges || { incoming: [], outgoing: [] };
    if (!ch.incoming.length && !ch.outgoing.length) return '';
    const me = this._meLower();
    const inc = ch.incoming.map((c) => {
      const myTurn = c.proposedBy.toLowerCase() !== me;
      return `<li><span class="fname">${esc(c.from)} · ${esc(timeLabel(c.time))}</span>
        <span class="row-actions">
          ${myTurn ? `<button data-caccept="${esc(c.id)}">Accept</button>
                      <button data-ccounter="${esc(c.id)}" class="ghost">Counter</button>` : '<span class="muted">their turn</span>'}
          <button data-cdecline="${esc(c.id)}" class="ghost">Decline</button>
        </span></li>`;
    }).join('');
    const out = ch.outgoing.map((c) => {
      const myTurn = c.proposedBy.toLowerCase() !== me;
      const status = c.state === 'accepted' ? 'accepted' : (myTurn ? 'your turn' : 'waiting');
      return `<li><span class="fname">${esc(c.to)} · ${esc(timeLabel(c.time))}</span>
        <span class="row-actions">
          ${myTurn && c.state === 'countered' ? `<button data-caccept="${esc(c.id)}">Accept</button>
                      <button data-ccounter="${esc(c.id)}" class="ghost">Counter</button>` : `<span class="muted">${status}</span>`}
          <button data-cdecline="${esc(c.id)}" class="ghost">Cancel</button>
        </span></li>`;
    }).join('');
    return `<h4>Challenges</h4><ul class="friend-list">${inc}${out}</ul>`;
  }

  _render() {
    const { friends, incoming, outgoing } = this.snapshot;
    this.root.innerHTML = `
      <div class="friends">
        <h3>Friends</h3>
        <form class="friend-add">
          <input name="u" placeholder="Add friend by username" autocomplete="off" maxlength="24" />
          <button type="submit">Add</button>
        </form>
        ${this.error ? `<p class="friend-error">${esc(this.error)}</p>` : ''}
        ${incoming.length ? `<h4>Requests</h4><ul class="friend-list">${incoming.map((r) => `
          <li><span class="fname">${esc(r.from)}</span>
            <span class="row-actions">
              <button data-accept="${esc(r.from)}">Accept</button>
              <button data-decline="${esc(r.from)}" class="ghost">Decline</button>
            </span></li>`).join('')}</ul>` : ''}
        ${outgoing.length ? `<h4>Sent</h4><ul class="friend-list">${outgoing.map((r) => `
          <li><span class="fname">${esc(r.to)}</span><span class="muted">pending</span></li>`).join('')}</ul>` : ''}
        <h4>Your friends</h4>
        ${friends.length ? `<ul class="friend-list">${friends.map((f) => `
          <li>
            <span class="dot ${f.online ? 'on' : 'off'}"></span>
            <span class="fname">${esc(f.username)}</span>
            <span class="row-actions">
              <button data-challenge="${esc(f.username)}" ${f.online ? '' : 'disabled'}>Play</button>
              <button data-unfriend="${esc(f.username)}" class="ghost">Remove</button>
            </span>
          </li>`).join('')}</ul>` : '<p class="muted">No friends yet — add someone above.</p>'}
        ${this._challengesHtml()}
      </div>`;

    this.root.querySelector('.friend-add').addEventListener('submit', (e) => {
      e.preventDefault();
      const u = e.target.u.value.trim();
      if (u) this._do(() => api.social.request(u));
    });
    this.root.querySelectorAll('[data-accept]').forEach((b) =>
      b.addEventListener('click', () => this._do(() => api.social.accept(b.dataset.accept))));
    this.root.querySelectorAll('[data-decline]').forEach((b) =>
      b.addEventListener('click', () => this._do(() => api.social.decline(b.dataset.decline))));
    this.root.querySelectorAll('[data-unfriend]').forEach((b) =>
      b.addEventListener('click', () => this._do(() => api.social.unfriend(b.dataset.unfriend))));
    this.root.querySelectorAll('[data-challenge]').forEach((b) =>
      b.addEventListener('click', () => this.onChallenge(b.dataset.challenge)));
    this.root.querySelectorAll('[data-caccept]').forEach((b) =>
      b.addEventListener('click', () => this._do(() => api.social.acceptChallenge(b.dataset.caccept))));
    this.root.querySelectorAll('[data-cdecline]').forEach((b) =>
      b.addEventListener('click', () => this._do(() => api.social.declineChallenge(b.dataset.cdecline))));
    this.root.querySelectorAll('[data-ccounter]').forEach((b) =>
      b.addEventListener('click', () => this._counter(b.dataset.ccounter)));
  }
}

const emptySnapshot = () => ({ friends: [], incoming: [], outgoing: [], challenges: { incoming: [], outgoing: [] } });

const TIME_OPTIONS = [
  { label: '1 min', time: { minutes: 1, increment: 0 } },
  { label: '3 min', time: { minutes: 3, increment: 0 } },
  { label: '5 min', time: { minutes: 5, increment: 0 } },
  { label: '10 min', time: { minutes: 10, increment: 0 } },
  { label: 'No clock', time: null },
];

export function timeLabel(time) {
  if (!time || time.minutes == null) return 'No clock';
  return `${time.minutes} min${time.increment ? ` +${time.increment}` : ''}`;
}

// Minimal blocking picker via prompt() for v1 (a styled modal can replace this
// later). Returns a time object, null (no clock), or undefined if cancelled.
export function pickTime() {
  const choices = TIME_OPTIONS.map((o, i) => `${i + 1}) ${o.label}`).join('\n');
  const raw = prompt(`Choose a time control:\n${choices}`, '3');
  if (raw == null) return undefined;
  const idx = parseInt(raw, 10) - 1;
  if (idx < 0 || idx >= TIME_OPTIONS.length) return undefined;
  return TIME_OPTIONS[idx].time;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
