// Top-level router. Mounts exactly one screen at a time into #app, owns the
// shared settings object, and applies the board theme to <body>.

import { HomeScreen } from './HomeScreen.js';
import { GameScreen } from './GameScreen.js';
import { Settings } from './Settings.js';
import { HowToPlay } from './HowToPlay.js';
import { StatsScreen } from './StatsScreen.js';
import { AccountScreen } from './AccountScreen.js';
import { OnlineScreen } from './OnlineScreen.js';
import { loadSettings } from '../utils/storage.js';
import { loadInProgress } from '../utils/persistence.js';
import { isLoggedIn, currentUser, clearSession, getToken } from '../utils/session.js';
import { initSync, pullProfile } from '../utils/sync.js';
import { Realtime } from '../utils/realtime.js';
import { api } from '../utils/api.js';

const emptySocial = () => ({ friends: [], incoming: [], outgoing: [], challenges: { incoming: [], outgoing: [] } });

export class App {
  constructor(root) {
    this.root = root;
    this.settings = loadSettings();
    this.current = null;
    this._social = emptySocial();
    this._promptedLaunch = new Set(); // challenge ids we've already offered "start now"
    initSync(); // profile saves now upload while logged in
    this._applyTheme();
    this.showMenu();
    // While logged in, keep one realtime connection open (presence + social pushes).
    if (isLoggedIn()) {
      this._connectRealtime();
      // Refresh the profile from the server on boot (another device may have changed it).
      pullProfile().then((p) => { if (p) this.showMenu(); });
    }
  }

  // --- Realtime + social ---------------------------------------------------
  async _connectRealtime() {
    if (this.realtime) return this.realtime;
    const rt = new Realtime();
    try {
      await rt.connect(getToken());
    } catch {
      return null; // offline; social features just stay empty
    }
    this.realtime = rt;
    rt.on('matched', (info) => this._showOnlineGame(info));
    rt.on('presence', () => this._refreshSocial());
    rt.on('social', () => this._onSocialPush());
    rt.on('close', () => { this.realtime = null; });
    this._refreshSocial();
    return rt;
  }

  async _refreshSocial() {
    if (!isLoggedIn()) return;
    try {
      this._social = await api.social.get();
      this._social.__me = currentUser();
    } catch { /* keep last-known snapshot */ }
    if (this.current && typeof this.current.onSocial === 'function') this.current.onSocial(this._social);
  }

  // A social push means durable state changed: re-fetch, then toast anything new
  // and offer to start a challenge the other side just accepted.
  _onSocialPush() {
    const beforeReq = new Set((this._social.incoming || []).map((r) => r.from.toLowerCase()));
    const beforeCh = new Set((this._social.challenges?.incoming || []).map((c) => c.id));
    this._refreshSocial().then(() => {
      for (const r of this._social.incoming || []) {
        if (!beforeReq.has(r.from.toLowerCase())) this._toast(`${r.from} sent you a friend request`);
      }
      for (const c of this._social.challenges?.incoming || []) {
        if (!beforeCh.has(c.id)) this._toast(`${c.from} challenged you to a game`);
      }
      for (const c of this._social.challenges?.outgoing || []) {
        if (c.state === 'accepted' && !this._promptedLaunch.has(c.id)) {
          this._promptedLaunch.add(c.id);
          if (confirm(`${c.to} accepted your challenge. Start the game now?`)) {
            api.social.acceptChallenge(c.id).then(() => this._refreshSocial());
          }
        }
      }
    });
  }

  async _openChallenge(friend) {
    const { pickTime } = await import('./FriendsPanel.js');
    const time = pickTime();
    if (time === undefined) return;
    try {
      await api.social.challenge(friend, time);
      await this._refreshSocial();
      this._toast(`Challenge sent to ${friend}`);
    } catch (e) {
      this._toast(e?.message || 'Could not send challenge');
    }
  }

  _toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
  }

  _applyTheme() {
    document.body.className = `theme-${this.settings.theme}`;
  }

  _mount(builder) {
    if (this.current && typeof this.current.destroy === 'function') this.current.destroy();
    this.root.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'screen';
    this.root.appendChild(screen);
    this.current = builder(screen);
  }

  showMenu() {
    this._mount((screen) =>
      new HomeScreen(screen, {
        onStart: (config) => this.showGame(config),
        onNavigate: (dest) => this._navigate(dest),
        onPlayFriend: () => this._playFriend(),
        resumeAvailable: Boolean(loadInProgress()),
        onResume: () => this.showGame(null, loadInProgress()),
        settings: this.settings,
        account: {
          loggedIn: isLoggedIn(),
          username: currentUser(),
          onLogout: () => {
            clearSession();
            if (this.realtime) { this.realtime.close(); this.realtime = null; }
            this._social = emptySocial();
            this._promptedLaunch.clear();
            this.showMenu();
          },
        },
      }),
    );
  }

  // "Play a Friend" — the Friends panel lives on the Online screen.
  _playFriend() {
    if (!isLoggedIn()) { this.showAccount(); return; }
    this.showOnline();
  }

  _navigate(dest) {
    if (dest === 'settings') this.showSettings();
    else if (dest === 'howto') this.showHowTo();
    else if (dest === 'stats') this.showStats();
    else if (dest === 'account') this.showAccount();
    else if (dest === 'online') this.showOnline();
  }

  showAccount() {
    this._mount(
      (screen) =>
        new AccountScreen(screen, {
          onDone: () => { this._connectRealtime(); this.showMenu(); },
          onBack: () => this.showMenu(),
        }),
    );
  }

  // Enter online mode, reusing the shared realtime connection. Matchmaking and
  // the Friends panel both live on this screen. The 'matched' handler (registered
  // once in _connectRealtime) mounts the game for matches, rematches, and friend
  // challenges alike.
  async showOnline() {
    const rt = await this._connectRealtime();
    if (!rt) {
      this.showMenu();
      alert('Could not reach the game server. Start it with "npm run server".');
      return;
    }
    this._mount((screen) => new OnlineScreen(screen, {
      realtime: rt,
      onCancel: () => { rt.cancel(); this.showMenu(); },
      snapshot: this._social,
      onRefresh: () => this._refreshSocial(),
      onChallenge: (friend) => this._openChallenge(friend),
    }));
  }

  _showOnlineGame(info) {
    this._mount(
      (screen) =>
        new GameScreen(screen, {
          config: {
            mode: 'online',
            myColor: info.color,
            opponentName: info.opponent,
            time: info.time,
            realtime: this.realtime,
          },
          settings: this.settings,
          onExit: () => this._endOnline(),
        }),
    );
  }

  // Leave the current online game/room but keep the shared socket open (presence
  // + social pushes should keep flowing on the menu).
  _endOnline() {
    if (this.realtime) this.realtime.leave();
    this.showMenu();
  }

  showGame(config, loadData = null) {
    this._mount(
      (screen) =>
        new GameScreen(screen, {
          config,
          loadData,
          settings: this.settings,
          onExit: () => this.showMenu(),
        }),
    );
  }

  showSettings() {
    this._mount(
      (screen) =>
        new Settings(screen, {
          settings: this.settings,
          onChange: () => this._applyTheme(),
          onBack: () => this.showMenu(),
        }),
    );
  }

  showHowTo() {
    this._mount((screen) => new HowToPlay(screen, { onBack: () => this.showMenu() }));
  }

  showStats() {
    this._mount(
      (screen) =>
        new StatsScreen(screen, {
          onBack: () => this.showMenu(),
          onReplay: (game) => this.showGame(null, game),
        }),
    );
  }
}
