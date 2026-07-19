# Friends & Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in players friend each other by username, see who's online, and challenge a friend to a game with an offline-capable, negotiable time control — launching into the existing online `GameScreen`.

**Architecture:** REST endpoints (a new `server/social.js` router) own durable state in the JSON store; the existing `ws` server gains a presence registry and pushes live notifications + the game-launch handshake. The client keeps one long-lived WebSocket connection while logged in and renders a Friends panel driven by a `GET /api/social` snapshot.

**Tech Stack:** Node/Express, `ws`, `jsonwebtoken`, JSON-file store; vanilla-DOM ES-module frontend; Vitest (+ `supertest` for the Express router).

Reference spec: `docs/superpowers/specs/2026-07-18-friends-and-challenges-design.md`

---

## File Structure

**Backend**
- `server/store.js` — *modify*: add `friends` to users, `friendRequests` + `challenges` collections, and accessors.
- `server/social.js` — *create*: `createSocialRouter({ store, realtime })` Express router (friend + challenge endpoints).
- `server/realtime.js` — *modify*: presence registry + exported interface (`isOnline`, `pushTo`, `launchGame`) consumed by the router.
- `server/index.js` — *modify*: build the realtime interface, mount the social router, export a `createApp` for tests.

**Frontend**
- `src/utils/api.js` — *modify*: `api.social.*` methods.
- `src/utils/realtime.js` — *modify*: emit `presence` / `social` events; keep `matched` for launch.
- `src/ui/App.js` — *modify*: one long-lived Realtime connection while logged in; expose it + a social snapshot to screens; toasts.
- `src/ui/FriendsPanel.js` — *create*: the panel (add / requests / friends / challenges).
- `src/ui/OnlineScreen.js` — *modify*: reuse the shared connection; add a "Friends" entry.
- `src/assets/theme.css` — *modify*: Friends panel + presence-dot styles.

**Tests**
- `test/server/store-social.test.js`, `test/server/social-friends.test.js`, `test/server/social-challenges.test.js` — *create*.
- `test/api-social.test.js` — *create* (client method shapes against a mocked `fetch`).

---

## PHASE 1 — Friend graph, presence, Friends panel

### Task 1: Store — friends & friend requests

**Files:**
- Modify: `server/store.js`
- Test: `test/server/store-social.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/server/store-social.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The store is a module singleton keyed off DATA_FILE. Load a fresh instance
// pointed at a throwaway file for each test.
async function freshStore() {
  vi.resetModules();
  process.env.DATA_FILE = join(mkdtempSync(join(tmpdir(), 'chess-store-')), 'data.json');
  return import('../../server/store.js');
}

describe('social store', () => {
  let store;
  beforeEach(async () => {
    store = await freshStore();
    store.createUser('Alice', 'h1', { name: 'Alice' });
    store.createUser('Bob', 'h2', { name: 'Bob' });
  });

  it('starts with no friends or requests', () => {
    expect(store.getFriends('Alice')).toEqual([]);
    expect(store.listRequests('Alice')).toEqual({ incoming: [], outgoing: [] });
  });

  it('records and lists a friend request in both directions', () => {
    store.addRequest('Alice', 'Bob');
    expect(store.listRequests('Alice').outgoing).toEqual([{ to: 'Bob', at: expect.any(Number) }]);
    expect(store.listRequests('Bob').incoming).toEqual([{ from: 'Alice', at: expect.any(Number) }]);
    expect(store.hasRequest('Alice', 'Bob')).toBe(true);
  });

  it('makes two users mutual friends and is idempotent', () => {
    store.addFriend('Alice', 'Bob');
    store.addFriend('Alice', 'Bob'); // duplicate no-ops
    expect(store.getFriends('Alice')).toEqual(['Bob']);
    expect(store.getFriends('Bob')).toEqual(['Alice']);
    expect(store.areFriends('Alice', 'bob')).toBe(true); // case-insensitive
  });

  it('removes a friend from both sides', () => {
    store.addFriend('Alice', 'Bob');
    store.removeFriend('Bob', 'Alice');
    expect(store.getFriends('Alice')).toEqual([]);
    expect(store.getFriends('Bob')).toEqual([]);
  });

  it('removeRequest clears a pending request', () => {
    store.addRequest('Alice', 'Bob');
    store.removeRequest('Alice', 'Bob');
    expect(store.hasRequest('Alice', 'Bob')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/server/store-social.test.js`
Expected: FAIL (`store.getFriends is not a function`).

- [ ] **Step 3: Implement store additions**

In `server/store.js`, change the default DB shape and `createUser`, and append the accessors. Replace the `let db = ...` line and `createUser`:

```js
let db = { users: {}, friendRequests: [], challenges: {} }; // key(username) -> user; requests[]; challenges by id
```

In `load()`, after `if (!db.users) db.users = {};` add:

```js
    if (!Array.isArray(db.friendRequests)) db.friendRequests = [];
    if (!db.challenges || typeof db.challenges !== 'object') db.challenges = {};
```

Update `createUser` to seed `friends`:

```js
export function createUser(username, passwordHash, profile) {
  const record = { username, passwordHash, profile, friends: [], createdAt: Date.now() };
  db.users[key(username)] = record;
  persist();
  return record;
}
```

Append at the end of the file:

```js
// --- Friends & requests ----------------------------------------------------
const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

export function getFriends(username) {
  const u = getUser(username);
  return u ? [...(u.friends || [])] : [];
}

export function areFriends(a, b) {
  return getFriends(a).some((f) => sameName(f, b));
}

export function addFriend(a, b) {
  const ua = getUser(a);
  const ub = getUser(b);
  if (!ua || !ub) return false;
  if (!ua.friends) ua.friends = [];
  if (!ub.friends) ub.friends = [];
  if (!ua.friends.some((f) => sameName(f, ub.username))) ua.friends.push(ub.username);
  if (!ub.friends.some((f) => sameName(f, ua.username))) ub.friends.push(ua.username);
  persist();
  return true;
}

export function removeFriend(a, b) {
  const ua = getUser(a);
  const ub = getUser(b);
  if (ua) ua.friends = (ua.friends || []).filter((f) => !sameName(f, b));
  if (ub) ub.friends = (ub.friends || []).filter((f) => !sameName(f, a));
  persist();
  return true;
}

export function hasRequest(from, to) {
  return db.friendRequests.some((r) => sameName(r.from, from) && sameName(r.to, to));
}

export function addRequest(from, to) {
  if (hasRequest(from, to)) return false;
  db.friendRequests.push({ from: getUser(from)?.username || from, to: getUser(to)?.username || to, at: Date.now() });
  persist();
  return true;
}

export function removeRequest(from, to) {
  const before = db.friendRequests.length;
  db.friendRequests = db.friendRequests.filter((r) => !(sameName(r.from, from) && sameName(r.to, to)));
  if (db.friendRequests.length !== before) persist();
  return before !== db.friendRequests.length;
}

export function listRequests(username) {
  const incoming = db.friendRequests
    .filter((r) => sameName(r.to, username))
    .map((r) => ({ from: r.from, at: r.at }));
  const outgoing = db.friendRequests
    .filter((r) => sameName(r.from, username))
    .map((r) => ({ to: r.to, at: r.at }));
  return { incoming, outgoing };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/server/store-social.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/store.js test/server/store-social.test.js
git commit -m "feat(social): store friends and friend requests"
```

---

### Task 2: Realtime presence registry + interface

**Files:**
- Modify: `server/realtime.js`
- Test: `test/server/realtime-presence.test.js`

The router must ask "is this user online?" and "push this message to that user" without importing `ws`. `attachRealtime` will return an interface object exposing those.

- [ ] **Step 1: Write the failing test**

```js
// test/server/realtime-presence.test.js
import { describe, it, expect } from 'vitest';
import { createPresence } from '../../server/realtime.js';

describe('presence registry', () => {
  it('tracks online users across multiple sockets', () => {
    const p = createPresence();
    const s1 = { readyState: 1, sent: [], send(m) { this.sent.push(m); } };
    const s2 = { readyState: 1, sent: [], send(m) { this.sent.push(m); } };
    p.add('Alice', s1);
    p.add('Alice', s2);
    expect(p.isOnline('alice')).toBe(true);

    p.pushTo('Alice', { type: 'social', event: 'request' });
    expect(JSON.parse(s1.sent[0]).event).toBe('request');
    expect(JSON.parse(s2.sent[0]).event).toBe('request');

    p.remove('Alice', s1);
    expect(p.isOnline('Alice')).toBe(true); // still one socket
    p.remove('Alice', s2);
    expect(p.isOnline('Alice')).toBe(false);
    expect(p.pushTo('Alice', { type: 'x' })).toBe(false); // nobody to push to
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/server/realtime-presence.test.js`
Expected: FAIL (`createPresence is not exported`).

- [ ] **Step 3: Implement `createPresence` and use it in `attachRealtime`**

At the top of `server/realtime.js` (after the imports), add and export the registry factory:

```js
// Tracks which usernames have at least one live socket, and pushes messages to
// all of a user's sockets. Case-insensitive by username. Pure/testable.
export function createPresence() {
  const byUser = new Map(); // lowercased username -> Set<socket>
  const key = (u) => u.toLowerCase();
  return {
    add(username, ws) {
      const k = key(username);
      if (!byUser.has(k)) byUser.set(k, new Set());
      byUser.get(k).add(ws);
    },
    remove(username, ws) {
      const set = byUser.get(key(username));
      if (!set) return;
      set.delete(ws);
      if (set.size === 0) byUser.delete(key(username));
    },
    isOnline(username) {
      return byUser.has(key(username));
    },
    pushTo(username, obj) {
      const set = byUser.get(key(username));
      if (!set || set.size === 0) return false;
      const data = JSON.stringify(obj);
      for (const ws of set) if (ws.readyState === 1) ws.send(data);
      return true;
    },
    users() {
      return [...byUser.keys()];
    },
  };
}
```

Now wire it into `attachRealtime`. Inside `attachRealtime(server, jwtSecret)`, create the registry and register/unregister sockets on connect/close. Add after `const rooms = new Map();`:

```js
  const presence = createPresence();

  // Notify a user's friends that their online state changed. Injected later.
  let onPresenceChange = () => {};
```

In `wss.on('connection', ...)`, after `ws.username = username;` add:

```js
    presence.add(username, ws);
    onPresenceChange(username, true);
```

In the same handler, change `ws.on('close', () => cleanup(ws));` to:

```js
    ws.on('close', () => {
      cleanup(ws);
      presence.remove(username, ws);
      if (!presence.isOnline(username)) onPresenceChange(username, false);
    });
```

At the end of `attachRealtime`, replace `return wss;` with an interface object:

```js
  return {
    wss,
    presence,
    isOnline: (u) => presence.isOnline(u),
    pushTo: (u, obj) => presence.pushTo(u, obj),
    setPresenceHandler: (fn) => { onPresenceChange = fn; },
    // launchGame is added in Phase 2 (Task 11).
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/server/realtime-presence.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/realtime.js test/server/realtime-presence.test.js
git commit -m "feat(social): presence registry + realtime interface"
```

---

### Task 3: Social router — friend endpoints

**Files:**
- Create: `server/social.js`
- Test: `test/server/social-friends.test.js`
- Modify: root `package.json` (add `supertest` dev dep)

- [ ] **Step 1: Install supertest**

Run: `npm install -D supertest`
Expected: adds `supertest` to root `devDependencies`.

- [ ] **Step 2: Write the failing test**

```js
// test/server/social-friends.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function appFor(actor) {
  vi.resetModules();
  process.env.DATA_FILE = join(mkdtempSync(join(tmpdir(), 'chess-social-')), 'data.json');
  const store = await import('../../server/store.js');
  const { createSocialRouter } = await import('../../server/social.js');
  store.createUser('Alice', 'h', { name: 'Alice' });
  store.createUser('Bob', 'h', { name: 'Bob' });
  const pushed = [];
  const realtime = {
    isOnline: (u) => u.toLowerCase() === 'bob',
    pushTo: (u, obj) => { pushed.push({ u, obj }); return true; },
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.username = actor; next(); }); // stub auth
  app.use('/api/social', createSocialRouter({ store, realtime }));
  return { app, store, pushed };
}

describe('friend request endpoints', () => {
  it('snapshot shows a friend with online status', async () => {
    const { app, store } = await appFor('Alice');
    store.addFriend('Alice', 'Bob');
    const res = await request(app).get('/api/social');
    expect(res.status).toBe(200);
    expect(res.body.friends).toEqual([{ username: 'Bob', online: true }]);
  });

  it('sends a request and pushes to the recipient', async () => {
    const { app, store, pushed } = await appFor('Alice');
    const res = await request(app).post('/api/social/requests').send({ username: 'Bob' });
    expect(res.status).toBe(200);
    expect(store.hasRequest('Alice', 'Bob')).toBe(true);
    expect(pushed.some((p) => p.u === 'Bob' && p.obj.event === 'request')).toBe(true);
  });

  it('rejects self, unknown, and duplicate requests', async () => {
    const { app } = await appFor('Alice');
    expect((await request(app).post('/api/social/requests').send({ username: 'Alice' })).status).toBe(400);
    expect((await request(app).post('/api/social/requests').send({ username: 'Nobody' })).status).toBe(404);
    await request(app).post('/api/social/requests').send({ username: 'Bob' });
    expect((await request(app).post('/api/social/requests').send({ username: 'Bob' })).status).toBe(409);
  });

  it('auto-accepts when the other user already requested you', async () => {
    const { app, store } = await appFor('Alice');
    store.addRequest('Bob', 'Alice'); // Bob already asked
    const res = await request(app).post('/api/social/requests').send({ username: 'Bob' });
    expect(res.status).toBe(200);
    expect(store.areFriends('Alice', 'Bob')).toBe(true);
    expect(store.hasRequest('Bob', 'Alice')).toBe(false);
  });

  it('accept makes mutual friends; decline clears it', async () => {
    const { app, store } = await appFor('Bob'); // Bob acts on Alice's request
    store.addRequest('Alice', 'Bob');
    const res = await request(app).post('/api/social/requests/accept').send({ username: 'Alice' });
    expect(res.status).toBe(200);
    expect(store.areFriends('Alice', 'Bob')).toBe(true);
  });

  it('unfriend removes both sides', async () => {
    const { app, store } = await appFor('Alice');
    store.addFriend('Alice', 'Bob');
    const res = await request(app).delete('/api/social/friends/Bob');
    expect(res.status).toBe(200);
    expect(store.areFriends('Alice', 'Bob')).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run test/server/social-friends.test.js`
Expected: FAIL (`createSocialRouter` missing).

- [ ] **Step 4: Implement `server/social.js` (friend half)**

```js
// server/social.js
//
// Social features (friends, requests, and — Phase 2 — game challenges) as an
// Express router. Durable state lives in the store; live delivery goes through
// the injected realtime interface ({ isOnline, pushTo, launchGame }). The router
// never imports ws directly, so it is unit-testable with a fake realtime.

import { Router } from 'express';

const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;

export function createSocialRouter({ store, realtime }) {
  const router = Router();
  const notify = (username, event) => realtime.pushTo(username, { type: 'social', event });

  // Build the caller's full social snapshot.
  router.get('/', (req, res) => {
    const me = req.username;
    const friends = store.getFriends(me).map((username) => ({
      username,
      online: realtime.isOnline(username),
    }));
    const { incoming, outgoing } = store.listRequests(me);
    res.json({ friends, incoming, outgoing, challenges: challengeSnapshot(store, me) });
  });

  router.post('/requests', (req, res) => {
    const me = req.username;
    const { username } = req.body || {};
    if (!USERNAME_RE.test(username || '')) return res.status(400).json({ error: 'Enter a valid username.' });
    if (username.toLowerCase() === me.toLowerCase()) return res.status(400).json({ error: "You can't friend yourself." });
    const target = store.getUser(username);
    if (!target) return res.status(404).json({ error: 'No player with that username.' });
    if (store.areFriends(me, target.username)) return res.status(409).json({ error: 'You are already friends.' });

    // Reciprocal request → auto-accept.
    if (store.hasRequest(target.username, me)) {
      store.removeRequest(target.username, me);
      store.addFriend(me, target.username);
      notify(target.username, 'request');
      return res.json({ ok: true, friended: true });
    }
    if (store.hasRequest(me, target.username)) return res.status(409).json({ error: 'Request already sent.' });
    store.addRequest(me, target.username);
    notify(target.username, 'request');
    res.json({ ok: true });
  });

  router.post('/requests/accept', (req, res) => {
    const me = req.username;
    const { username } = req.body || {};
    if (!store.hasRequest(username || '', me)) return res.status(404).json({ error: 'No such request.' });
    store.removeRequest(username, me);
    store.addFriend(me, username);
    notify(username, 'request');
    res.json({ ok: true });
  });

  router.post('/requests/decline', (req, res) => {
    const me = req.username;
    const { username } = req.body || {};
    store.removeRequest(username || '', me);
    res.json({ ok: true });
  });

  router.delete('/friends/:username', (req, res) => {
    const me = req.username;
    const other = req.params.username;
    store.removeFriend(me, other);
    notify(other, 'request');
    res.json({ ok: true });
  });

  // --- Challenges (Phase 2, Task 10) fill this in ---
  mountChallengeRoutes(router, { store, realtime, notify });

  return router;
}

// Placeholder until Task 10; returns empty so the Phase 1 snapshot is valid.
function challengeSnapshot(store, me) {
  return { incoming: [], outgoing: [] };
}
function mountChallengeRoutes() {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/server/social-friends.test.js`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add server/social.js test/server/social-friends.test.js package.json package-lock.json
git commit -m "feat(social): friend request + unfriend endpoints"
```

---

### Task 4: Mount the router; make `index.js` testable; wire presence pushes

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Refactor `index.js` to build the realtime interface, mount the router, and push presence changes**

In `server/index.js`, add imports near the top:

```js
import { createSocialRouter } from './social.js';
import { getFriends } from './store.js';
```

Replace the block that starts the server + attaches realtime (the `const server = app.listen(...)` through `attachRealtime(server, JWT_SECRET);`) with:

```js
const server = app.listen(PORT, () => {
  console.log(`[chess-server] listening on http://localhost:${PORT}`);
});

// Real-time (online multiplayer) + presence for the social layer.
const realtime = attachRealtime(server, JWT_SECRET);

// When a user connects/disconnects, tell their online friends so their panels
// update the presence dot live.
realtime.setPresenceHandler((username, online) => {
  for (const friend of getFriends(username)) {
    realtime.pushTo(friend, { type: 'presence', username, online });
  }
});
```

Add the social router mount **before** the static-file/SPA fallback block (so `/api/social/*` is not swallowed by the SPA catch-all), right after the `app.put('/api/profile', ...)` handler:

```js
app.use('/api/social', auth, createSocialRouter({ store, realtime: SOCIAL_REALTIME }));
```

This needs `realtime` to exist before routes are mounted, but `attachRealtime` runs after `listen`. Resolve by using a late-bound holder. Add near the top after `const app = express();`:

```js
// Late-bound realtime interface; set once attachRealtime runs below. The social
// router closes over this object and reads its fields at request time.
const SOCIAL_REALTIME = {
  isOnline: () => false,
  pushTo: () => false,
  launchGame: () => false,
};
```

And after `const realtime = attachRealtime(...)`, copy its methods onto the holder:

```js
Object.assign(SOCIAL_REALTIME, {
  isOnline: realtime.isOnline,
  pushTo: realtime.pushTo,
  launchGame: (a, b, time) => realtime.launchGame?.(a, b, time),
});
```

Also import `store` as a namespace for the router. Change the existing `import { getUser, createUser, setProfile } from './store.js';` to additionally import everything the router needs by passing the module. Simplest: add:

```js
import * as store from './store.js';
```

and pass `store` into `createSocialRouter`. (Keep the named imports already used elsewhere in the file.)

- [ ] **Step 2: Verify the server boots and routes respond**

Run: `npm run build && node server/index.js` (in one shell), then in another:
`curl -s -X POST localhost:3001/api/social/requests -H 'content-type: application/json' -d '{}'`
Expected: `{"error":"Not authenticated"}` (401 from `auth` — proves the router is mounted behind auth). Stop the server (Ctrl-C).

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat(social): mount social router + push presence to friends"
```

---

### Task 5: Client API methods

**Files:**
- Modify: `src/utils/api.js`
- Test: `test/api-social.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/api-social.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/utils/session.js', () => ({ getToken: () => 'tok' }));

describe('api.social', () => {
  let api;
  beforeEach(async () => {
    vi.resetModules();
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    ({ api } = await import('../src/utils/api.js'));
  });

  it('GET /api/social with auth header', async () => {
    await api.social.get();
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/social');
    expect(opts.headers.Authorization).toBe('Bearer tok');
  });

  it('sends a friend request', async () => {
    await api.social.request('Bob');
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/social/requests');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ username: 'Bob' });
  });

  it('unfriend uses DELETE with an encoded username', async () => {
    await api.social.unfriend('Bo b');
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/social/friends/Bo%20b');
    expect(opts.method).toBe('DELETE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/api-social.test.js`
Expected: FAIL (`api.social is undefined`).

- [ ] **Step 3: Add `social` to the api object**

In `src/utils/api.js`, add inside the exported `api` object (after `putProfile`):

```js
  social: {
    get: () => request('/api/social', { auth: true }),
    request: (username) => request('/api/social/requests', { method: 'POST', auth: true, body: { username } }),
    accept: (username) => request('/api/social/requests/accept', { method: 'POST', auth: true, body: { username } }),
    decline: (username) => request('/api/social/requests/decline', { method: 'POST', auth: true, body: { username } }),
    unfriend: (username) => request(`/api/social/friends/${encodeURIComponent(username)}`, { method: 'DELETE', auth: true }),
    // Challenge methods added in Task 12.
    challenge: (username, time) => request('/api/social/challenges', { method: 'POST', auth: true, body: { username, time } }),
    acceptChallenge: (id) => request(`/api/social/challenges/${encodeURIComponent(id)}/accept`, { method: 'POST', auth: true }),
    counterChallenge: (id, time) => request(`/api/social/challenges/${encodeURIComponent(id)}/counter`, { method: 'POST', auth: true, body: { time } }),
    declineChallenge: (id) => request(`/api/social/challenges/${encodeURIComponent(id)}/decline`, { method: 'POST', auth: true }),
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/api-social.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/api.js test/api-social.test.js
git commit -m "feat(social): client api.social methods"
```

---

### Task 6: Realtime client events + long-lived connection in App

**Files:**
- Modify: `src/utils/realtime.js`
- Modify: `src/ui/App.js`

- [ ] **Step 1: Emit `presence` and `social` events (already generic)**

`src/utils/realtime.js` `onmessage` already does `this._emit(msg.type, msg)`, so `presence` and `social` messages are emitted by type with no change. Confirm by reading `connect()`. No code change needed unless a typed helper is wanted; none is.

- [ ] **Step 2: Hold one connection while logged in**

In `src/ui/App.js`, the connection is currently opened in `showOnline` and closed in `_endOnline`. Change to a shared connection created on boot/login and reused.

Add a method and call it from the constructor. In the constructor, after `this.showMenu();` add:

```js
    this._social = { friends: [], incoming: [], outgoing: [], challenges: { incoming: [], outgoing: [] } };
    if (isLoggedIn()) this._connectRealtime();
```

Add these methods to the `App` class:

```js
  async _connectRealtime() {
    if (this.realtime) return this.realtime;
    const rt = new Realtime();
    try {
      await rt.connect(getToken());
    } catch {
      return null; // offline; social features simply stay empty
    }
    this.realtime = rt;
    rt.on('matched', (info) => this._showOnlineGame(info));
    rt.on('presence', () => this._refreshSocial());
    rt.on('social', (msg) => this._onSocialPush(msg));
    rt.on('close', () => { this.realtime = null; });
    this._refreshSocial();
    return rt;
  }

  async _refreshSocial() {
    if (!isLoggedIn()) return;
    try {
      const { api } = await import('../utils/api.js');
      this._social = await api.social.get();
    } catch { /* leave last-known snapshot */ }
    if (this.current && typeof this.current.onSocial === 'function') this.current.onSocial(this._social);
  }

  _onSocialPush() {
    // Any social change → refresh the authoritative snapshot (Task 8 adds toasts).
    this._refreshSocial();
  }
```

Now make `showOnline` **reuse** the shared connection instead of creating its own. Replace the body of `showOnline` with:

```js
  async showOnline() {
    const rt = await this._connectRealtime();
    if (!rt) {
      this.showMenu();
      alert('Could not reach the game server. Start it with "npm run server".');
      return;
    }
    this._mount((screen) => new OnlineScreen(screen, {
      realtime: rt,
      onCancel: () => this.showMenu(),
    }));
  }
```

Change `_endOnline` to **not** close the shared socket — only leave the room:

```js
  _endOnline() {
    if (this.realtime) this.realtime.leave();
    this.showMenu();
  }
```

Update logout to drop the connection. In `showMenu`'s `onLogout`, change to:

```js
          onLogout: () => {
            clearSession();
            if (this.realtime) { this.realtime.close(); this.realtime = null; }
            this._social = { friends: [], incoming: [], outgoing: [], challenges: { incoming: [], outgoing: [] } };
            this.showMenu();
          },
```

After a successful login (AccountScreen `onDone`), connect. Change `showAccount`'s `onDone`:

```js
          onDone: () => { this._connectRealtime(); this.showMenu(); },
```

- [ ] **Step 3: Manual verification**

Run: `npm run server` (shell 1) and `npm run dev` (shell 2). Log in as a user in two browsers (two accounts). Open devtools Network → WS: confirm one socket stays open on the menu (not just the online screen). No errors in console.

- [ ] **Step 4: Commit**

```bash
git add src/utils/realtime.js src/ui/App.js
git commit -m "feat(social): keep one realtime connection while logged in"
```

---

### Task 7: Friends panel (add / requests / friends list)

**Files:**
- Create: `src/ui/FriendsPanel.js`
- Modify: `src/ui/OnlineScreen.js` (add a Friends entry)
- Modify: `src/assets/theme.css`

- [ ] **Step 1: Create the panel component**

```js
// src/ui/FriendsPanel.js
//
// Friends UI: add by username, respond to requests, see friends with an online
// dot, and (Phase 2) challenge them. Pure view over a social snapshot; all
// mutations go through api.social and then re-fetch via onRefresh.

import { api, ApiError } from '../utils/api.js';

export class FriendsPanel {
  /**
   * @param {HTMLElement} root
   * @param {object} opts
   * @param {object} opts.snapshot           latest GET /api/social result
   * @param {() => Promise<void>} opts.onRefresh   re-fetch + re-render
   * @param {(friend:string)=>void} opts.onChallenge  open challenge picker (Task 13)
   */
  constructor(root, { snapshot, onRefresh, onChallenge }) {
    this.root = root;
    this.snapshot = snapshot || { friends: [], incoming: [], outgoing: [], challenges: { incoming: [], outgoing: [] } };
    this.onRefresh = onRefresh || (async () => {});
    this.onChallenge = onChallenge || (() => {});
    this.error = '';
    this._render();
  }

  update(snapshot) {
    this.snapshot = snapshot;
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
          <li><span>${esc(r.from)}</span>
            <span class="row-actions">
              <button data-accept="${esc(r.from)}">Accept</button>
              <button data-decline="${esc(r.from)}" class="ghost">Decline</button>
            </span></li>`).join('')}</ul>` : ''}
        ${outgoing.length ? `<h4>Sent</h4><ul class="friend-list">${outgoing.map((r) => `
          <li><span>${esc(r.to)}</span><span class="muted">pending</span></li>`).join('')}</ul>` : ''}
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
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 2: Mount the panel on the Online screen**

In `src/ui/OnlineScreen.js`, accept `friends` options and render the panel alongside matchmaking. In its constructor options destructure `snapshot`, `onRefresh`, `onChallenge`. After the existing markup is built, append a container and instantiate:

```js
import { FriendsPanel } from './FriendsPanel.js';
// ...in constructor, after this.root.innerHTML = `...`:
const panelHost = document.createElement('div');
panelHost.className = 'friends-host';
this.root.appendChild(panelHost);
this.panel = new FriendsPanel(panelHost, {
  snapshot: this.snapshot,
  onRefresh: this.onRefresh,
  onChallenge: this.onChallenge,
});
// expose a hook so App can push fresh snapshots:
this.onSocial = (snap) => this.panel.update(snap);
```

Add to `OnlineScreen`'s constructor signature the new options (`snapshot`, `onRefresh`, `onChallenge`) with defaults, and store them.

Wire from `App.showOnline` — pass the snapshot + refresh + challenge:

```js
    this._mount((screen) => new OnlineScreen(screen, {
      realtime: rt,
      onCancel: () => this.showMenu(),
      snapshot: this._social,
      onRefresh: () => this._refreshSocial(),
      onChallenge: (friend) => this._openChallenge(friend), // Task 13 defines _openChallenge
    }));
```

For Phase 1, add a temporary stub in `App`:

```js
  _openChallenge(friend) {
    alert(`Challenge flow for ${friend} arrives in Phase 2.`);
  }
```

- [ ] **Step 3: Add styles**

Append to `src/assets/theme.css`:

```css
/* Friends panel */
.friends-host { margin-top: 18px; }
.friends { text-align: left; max-width: 420px; margin: 0 auto; }
.friends h3 { margin: 0 0 10px; }
.friends h4 { margin: 14px 0 6px; font-size: 0.85rem; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.04em; }
.friend-add { display: flex; gap: 8px; }
.friend-add input { flex: 1; padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.2); color: inherit; }
.friend-error { color: var(--danger); font-size: 0.9rem; margin: 6px 0 0; }
.friend-list { list-style: none; padding: 0; margin: 4px 0; }
.friend-list li { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.friend-list .fname { flex: 1; }
.friend-list .row-actions { display: flex; gap: 6px; margin-left: auto; }
.friend-list .muted, .muted { opacity: 0.6; font-size: 0.85rem; }
.friend-list .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.friend-list .dot.on { background: var(--good); box-shadow: 0 0 6px var(--good); }
.friend-list .dot.off { background: #6b6b6b; }
.friends button.ghost { background: transparent; border: 1px solid rgba(255,255,255,0.2); }
.friends button[disabled] { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 4: Manual verification**

With server + dev running and two accounts (A in one browser, B in another):
1. As A, add B by username → B (online) sees the request appear (its panel refreshes via the `social` push).
2. B accepts → both show each other as friends with a green dot.
3. Close B's tab → A's dot for B turns grey within a moment (presence push).
4. Remove friend → disappears on both sides.

- [ ] **Step 5: Commit**

```bash
git add src/ui/FriendsPanel.js src/ui/OnlineScreen.js src/ui/App.js src/assets/theme.css
git commit -m "feat(social): friends panel — add, requests, friends list with presence"
```

---

### Task 8: Toast on incoming request

**Files:**
- Modify: `src/ui/App.js`
- Modify: `src/assets/theme.css` (reuse `.toast`)

- [ ] **Step 1: Add a small toast helper and fire it on relevant pushes**

In `src/ui/App.js`, add a method:

```js
  _toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3200);
  }
```

Change `_onSocialPush` to compare and toast on a *new* incoming request:

```js
  _onSocialPush() {
    const before = new Set((this._social.incoming || []).map((r) => r.from.toLowerCase()));
    this._refreshSocial().then(() => {
      for (const r of this._social.incoming || []) {
        if (!before.has(r.from.toLowerCase())) this._toast(`${r.from} sent you a friend request`);
      }
    });
  }
```

Note: `_refreshSocial` must resolve after assigning `this._social`; it already does. Ensure `_refreshSocial` returns the promise (it is `async`, so it does).

- [ ] **Step 2: Ensure `.toast` styles exist globally**

The `.toast` class is defined for GameScreen; confirm it is a global rule in `theme.css` (search for `.toast`). If it is scoped or missing a `.show` state, add:

```css
.toast { position: fixed; left: 50%; bottom: 28px; transform: translate(-50%, 12px); background: rgba(20,20,20,0.95); color: #fff; padding: 10px 16px; border-radius: 10px; opacity: 0; transition: opacity .3s, transform .3s; z-index: 9999; }
.toast.show { opacity: 1; transform: translate(-50%, 0); }
```

(Only add if not already present — check first to avoid duplicate selectors.)

- [ ] **Step 3: Manual verification**

As A on the menu (not the online screen), have B send A a request → A sees a toast "B sent you a friend request".

- [ ] **Step 4: Commit**

```bash
git add src/ui/App.js src/assets/theme.css
git commit -m "feat(social): toast on incoming friend request"
```

---

## PHASE 2 — Challenges (negotiable, offline-capable)

### Task 9: Store — challenges & state transitions

**Files:**
- Modify: `server/store.js`
- Test: `test/server/store-challenges.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/server/store-challenges.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function freshStore() {
  vi.resetModules();
  process.env.DATA_FILE = join(mkdtempSync(join(tmpdir(), 'chess-ch-')), 'data.json');
  return import('../../server/store.js');
}

describe('challenge store', () => {
  let store;
  beforeEach(async () => {
    store = await freshStore();
    store.createUser('Alice', 'h', {});
    store.createUser('Bob', 'h', {});
  });

  it('creates a challenge with a stable id and lists it for both users', () => {
    const c = store.createChallenge('Alice', 'Bob', { minutes: 5, increment: 0 });
    expect(c.id).toBeTruthy();
    expect(c.state).toBe('pending');
    expect(c.proposedBy).toBe('Alice');
    expect(store.listChallenges('Bob').incoming.map((x) => x.id)).toContain(c.id);
    expect(store.listChallenges('Alice').outgoing.map((x) => x.id)).toContain(c.id);
  });

  it('updates and removes a challenge', () => {
    const c = store.createChallenge('Alice', 'Bob', { minutes: 5 });
    store.updateChallenge(c.id, { time: { minutes: 3 }, proposedBy: 'Bob', state: 'countered' });
    expect(store.getChallenge(c.id).time).toEqual({ minutes: 3 });
    store.removeChallenge(c.id);
    expect(store.getChallenge(c.id)).toBeNull();
  });

  it('finds an active challenge between two users', () => {
    store.createChallenge('Alice', 'Bob', { minutes: 5 });
    expect(store.activeChallengeBetween('bob', 'alice')).toBeTruthy();
    expect(store.activeChallengeBetween('Alice', 'Nobody')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/server/store-challenges.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement challenge accessors in `server/store.js`**

Append:

```js
// --- Challenges ------------------------------------------------------------
let challengeSeq = 0;
const ACTIVE = new Set(['pending', 'countered', 'accepted']);

export function createChallenge(from, to, time) {
  const uf = getUser(from);
  const ut = getUser(to);
  const id = `c${Date.now().toString(36)}_${(challengeSeq++).toString(36)}`;
  const c = {
    id,
    from: uf?.username || from,
    to: ut?.username || to,
    time: time || null,
    proposedBy: uf?.username || from,
    state: 'pending',
    at: Date.now(),
  };
  db.challenges[id] = c;
  persist();
  return c;
}

export function getChallenge(id) {
  return db.challenges[id] || null;
}

export function updateChallenge(id, patch) {
  const c = db.challenges[id];
  if (!c) return null;
  Object.assign(c, patch);
  persist();
  return c;
}

export function removeChallenge(id) {
  if (db.challenges[id]) {
    delete db.challenges[id];
    persist();
  }
}

export function listChallenges(username) {
  const all = Object.values(db.challenges).filter((c) => ACTIVE.has(c.state));
  return {
    incoming: all.filter((c) => sameName(c.to, username)),
    outgoing: all.filter((c) => sameName(c.from, username)),
  };
}

export function activeChallengeBetween(a, b) {
  return (
    Object.values(db.challenges).find(
      (c) =>
        ACTIVE.has(c.state) &&
        ((sameName(c.from, a) && sameName(c.to, b)) || (sameName(c.from, b) && sameName(c.to, a))),
    ) || null
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/server/store-challenges.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/store.js test/server/store-challenges.test.js
git commit -m "feat(social): store game challenges"
```

---

### Task 10: Social router — challenge endpoints + turn rules

**Files:**
- Modify: `server/social.js`
- Test: `test/server/social-challenges.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/server/social-challenges.test.js
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function ctx() {
  vi.resetModules();
  process.env.DATA_FILE = join(mkdtempSync(join(tmpdir(), 'chess-chr-')), 'data.json');
  const store = await import('../../server/store.js');
  const { createSocialRouter } = await import('../../server/social.js');
  store.createUser('Alice', 'h', {});
  store.createUser('Bob', 'h', {});
  store.addFriend('Alice', 'Bob');
  const launches = [];
  const realtime = {
    isOnline: () => true,
    pushTo: () => true,
    launchGame: (a, b, time) => { launches.push({ a, b, time }); return true; },
  };
  const mk = (actor) => {
    const app = express();
    app.use(express.json());
    app.use((req, _r, n) => { req.username = actor; n(); });
    app.use('/api/social', createSocialRouter({ store, realtime }));
    return app;
  };
  return { store, mk, launches };
}

describe('challenge endpoints', () => {
  it('rejects challenging a non-friend', async () => {
    const c = await ctx();
    c.store.removeFriend('Alice', 'Bob');
    const res = await request(c.mk('Alice')).post('/api/social/challenges').send({ username: 'Bob', time: { minutes: 5 } });
    expect(res.status).toBe(409);
  });

  it('creates a challenge and shows it in each snapshot', async () => {
    const c = await ctx();
    const res = await request(c.mk('Alice')).post('/api/social/challenges').send({ username: 'Bob', time: { minutes: 5 } });
    expect(res.status).toBe(200);
    const snap = (await request(c.mk('Bob')).get('/api/social')).body;
    expect(snap.challenges.incoming).toHaveLength(1);
  });

  it('only the non-proposer may accept', async () => {
    const c = await ctx();
    const { body } = await request(c.mk('Alice')).post('/api/social/challenges').send({ username: 'Bob', time: { minutes: 5 } });
    const id = body.challenge.id;
    // Alice (proposer) cannot accept her own:
    expect((await request(c.mk('Alice')).post(`/api/social/challenges/${id}/accept`)).status).toBe(409);
    // Bob can, and it launches (both online):
    const ok = await request(c.mk('Bob')).post(`/api/social/challenges/${id}/accept`);
    expect(ok.status).toBe(200);
    expect(c.launches).toHaveLength(1);
    expect(c.store.getChallenge(id)).toBeNull(); // pruned after launch
  });

  it('counter flips the turn', async () => {
    const c = await ctx();
    const { body } = await request(c.mk('Alice')).post('/api/social/challenges').send({ username: 'Bob', time: { minutes: 5 } });
    const id = body.challenge.id;
    const r = await request(c.mk('Bob')).post(`/api/social/challenges/${id}/counter`).send({ time: { minutes: 3 } });
    expect(r.status).toBe(200);
    const ch = c.store.getChallenge(id);
    expect(ch.proposedBy).toBe('Bob');
    expect(ch.time).toEqual({ minutes: 3 });
    // Now Bob (proposer) can't accept; Alice can:
    expect((await request(c.mk('Bob')).post(`/api/social/challenges/${id}/accept`)).status).toBe(409);
    expect((await request(c.mk('Alice')).post(`/api/social/challenges/${id}/accept`)).status).toBe(200);
  });

  it('either party may decline', async () => {
    const c = await ctx();
    const { body } = await request(c.mk('Alice')).post('/api/social/challenges').send({ username: 'Bob', time: { minutes: 5 } });
    const id = body.challenge.id;
    expect((await request(c.mk('Alice')).post(`/api/social/challenges/${id}/decline`)).status).toBe(200);
    expect(c.store.getChallenge(id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/server/social-challenges.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement challenge routes in `server/social.js`**

Replace the placeholder `challengeSnapshot` and `mountChallengeRoutes` at the bottom of `server/social.js` with real implementations:

```js
function challengeSnapshot(store, me) {
  return store.listChallenges(me);
}

function mountChallengeRoutes(router, { store, realtime, notify }) {
  const sameName = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();

  router.post('/challenges', (req, res) => {
    const me = req.username;
    const { username, time } = req.body || {};
    const target = store.getUser(username || '');
    if (!target) return res.status(404).json({ error: 'No player with that username.' });
    if (!store.areFriends(me, target.username)) return res.status(409).json({ error: 'You can only challenge friends.' });
    if (store.activeChallengeBetween(me, target.username)) {
      return res.status(409).json({ error: 'You already have a challenge with this friend.' });
    }
    const challenge = store.createChallenge(me, target.username, time || null);
    notify(target.username, 'challenge');
    res.json({ ok: true, challenge });
  });

  // Guard: load the challenge, ensure the caller is a participant.
  const load = (req, res) => {
    const c = store.getChallenge(req.params.id);
    if (!c) { res.status(404).json({ error: 'Challenge not found.' }); return null; }
    const me = req.username;
    if (!sameName(c.from, me) && !sameName(c.to, me)) { res.status(403).json({ error: 'Not your challenge.' }); return null; }
    return c;
  };

  router.post('/challenges/:id/accept', (req, res) => {
    const c = load(req, res);
    if (!c) return;
    const me = req.username;
    if (sameName(c.proposedBy, me)) return res.status(409).json({ error: "It's the other player's turn." });
    // Terms agreed. Launch if both online, else park as 'accepted'.
    const other = sameName(c.from, me) ? c.to : c.from;
    if (realtime.isOnline(c.from) && realtime.isOnline(c.to)) {
      realtime.launchGame(c.from, c.to, c.time);
      store.removeChallenge(c.id);
      notify(other, 'challenge');
      return res.json({ ok: true, launched: true });
    }
    store.updateChallenge(c.id, { state: 'accepted', proposedBy: me });
    notify(other, 'challenge');
    res.json({ ok: true, launched: false, waiting: true });
  });

  router.post('/challenges/:id/counter', (req, res) => {
    const c = load(req, res);
    if (!c) return;
    const me = req.username;
    if (sameName(c.proposedBy, me)) return res.status(409).json({ error: "It's the other player's turn." });
    const { time } = req.body || {};
    store.updateChallenge(c.id, { time: time || null, proposedBy: me, state: 'countered' });
    notify(sameName(c.from, me) ? c.to : c.from, 'challenge');
    res.json({ ok: true, challenge: store.getChallenge(c.id) });
  });

  router.post('/challenges/:id/decline', (req, res) => {
    const c = load(req, res);
    if (!c) return;
    const me = req.username;
    const other = sameName(c.from, me) ? c.to : c.from;
    store.removeChallenge(c.id);
    notify(other, 'challenge');
    res.json({ ok: true });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/server/social-challenges.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/social.js test/server/social-challenges.test.js
git commit -m "feat(social): challenge endpoints with negotiation turn rules"
```

---

### Task 11: Realtime — `launchGame` pairs two players

**Files:**
- Modify: `server/realtime.js`
- Test: `test/server/realtime-launch.test.js`

The router calls `realtime.launchGame(from, to, time)`. It must find each user's live socket and pair them via the existing `createRoom`.

- [ ] **Step 1: Write the failing test (refactor `createRoom` to be reachable)**

`createRoom` currently lives inside `attachRealtime`'s closure and reads socket-scoped fields (`color`, `roomId`). Extract a pure pairing helper that the test can exercise. Add and export in `server/realtime.js`:

```js
// Pair two sockets into a room: assign colors, roomId, register the room, and
// emit 'matched' to each. Shared by random matchmaking and friend challenges.
export function pairIntoRoom(rooms, a, b, time, makeId, rng = Math.random) {
  const roomId = makeId();
  const aIsWhite = rng() < 0.5;
  a.color = aIsWhite ? 0 : 1;
  b.color = aIsWhite ? 1 : 0;
  a.roomId = roomId;
  b.roomId = roomId;
  rooms.set(roomId, { players: [a, b], time });
  const send = (ws, obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };
  send(a, { type: 'matched', roomId, color: a.color, opponent: b.username, time });
  send(b, { type: 'matched', roomId, color: b.color, opponent: a.username, time });
  return roomId;
}
```

Test:

```js
// test/server/realtime-launch.test.js
import { describe, it, expect } from 'vitest';
import { pairIntoRoom } from '../../server/realtime.js';

describe('pairIntoRoom', () => {
  it('assigns opposite colors and emits matched to both', () => {
    const rooms = new Map();
    const mk = (name) => ({ username: name, readyState: 1, sent: [], send(m) { this.sent.push(JSON.parse(m)); } });
    const a = mk('Alice'); const b = mk('Bob');
    pairIntoRoom(rooms, a, b, { minutes: 5 }, () => 'room1', () => 0.1);
    expect(rooms.get('room1').players).toHaveLength(2);
    expect(a.color).toBe(0); expect(b.color).toBe(1);
    expect(a.sent[0]).toMatchObject({ type: 'matched', opponent: 'Bob', color: 0 });
    expect(b.sent[0]).toMatchObject({ type: 'matched', opponent: 'Alice', color: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/server/realtime-launch.test.js`
Expected: FAIL (`pairIntoRoom` not exported).

- [ ] **Step 3: Add `pairIntoRoom`, refactor `createRoom` to use it, and add `launchGame` to the interface**

Add the `pairIntoRoom` export (Step 1 code). Inside `attachRealtime`, change the existing `createRoom` to delegate:

```js
  function createRoom(a, b, time) {
    pairIntoRoom(rooms, a, b, time, () => randomUUID());
  }
```

Add a `launchGame` that resolves usernames to their first live socket and pairs them. Inside `attachRealtime`, before the `return { ... }`:

```js
  function firstSocket(username) {
    const set = presence; // presence has no direct socket getter; add one
    return null;
  }
```

To resolve sockets, extend `createPresence` with a `socketFor(username)` helper. In `createPresence`'s returned object add:

```js
    socketFor(username) {
      const set = byUser.get(key(username));
      if (!set) return null;
      for (const ws of set) if (ws.readyState === 1) return ws;
      return null;
    },
```

Now implement `launchGame` and expose it. Replace the `firstSocket` stub with nothing and add to the returned interface:

```js
    launchGame: (from, to, time) => {
      const a = presence.socketFor(from);
      const b = presence.socketFor(to);
      if (!a || !b) return false;
      createRoom(a, b, time);
      return true;
    },
```

(Place it inside the `return { ... }` object next to `pushTo`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/server/realtime-launch.test.js test/server/realtime-presence.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/realtime.js test/server/realtime-launch.test.js
git commit -m "feat(social): launchGame pairs friends into an online room"
```

---

### Task 12: Client — challenge realtime events + snapshot plumbing

**Files:**
- Modify: `src/ui/App.js`

The `social` push already triggers `_refreshSocial`, which delivers challenges in the snapshot. Add a toast for a new incoming challenge and a "your challenge was accepted" prompt when the challenger reconnects (the accepted challenge shows in `outgoing`).

- [ ] **Step 1: Extend the social-push handler to toast challenges and offer "Start now?"**

Replace `_onSocialPush` in `src/ui/App.js`:

```js
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
      // If one of my outgoing challenges is 'accepted' and both are online, offer to start.
      for (const c of this._social.challenges?.outgoing || []) {
        if (c.state === 'accepted' && !this._promptedLaunch?.has(c.id)) {
          (this._promptedLaunch ||= new Set()).add(c.id);
          if (confirm(`${c.to} accepted your challenge. Start the game now?`)) {
            import('../utils/api.js').then(({ api }) => api.social.acceptChallenge(c.id).then(() => this._refreshSocial()));
          }
        }
      }
    });
  }
```

- [ ] **Step 2: Manual verification** (covered end-to-end in Task 14).

- [ ] **Step 3: Commit**

```bash
git add src/ui/App.js
git commit -m "feat(social): challenge toasts + start-now prompt"
```

---

### Task 13: Friends panel — challenge picker + challenges inbox

**Files:**
- Modify: `src/ui/FriendsPanel.js`
- Modify: `src/ui/App.js` (`_openChallenge` real implementation)
- Modify: `src/assets/theme.css`

- [ ] **Step 1: Render the challenges section and a time picker in `FriendsPanel`**

In `FriendsPanel._render`, before the closing `</div>` of `.friends`, insert a challenges block built from `this.snapshot.challenges`:

```js
        ${this._challengesHtml()}
```

Add these methods to the class:

```js
  _challengesHtml() {
    const ch = this.snapshot.challenges || { incoming: [], outgoing: [] };
    if (!ch.incoming.length && !ch.outgoing.length) return '';
    const me = this._meLower();
    const label = (c) => timeLabel(c.time);
    const inc = ch.incoming.map((c) => {
      const myTurn = c.proposedBy.toLowerCase() !== me;
      return `<li><span class="fname">${esc(c.from)} · ${label(c)}</span>
        <span class="row-actions">
          ${myTurn ? `<button data-caccept="${c.id}">Accept</button>
                      <button data-ccounter="${c.id}" class="ghost">Counter</button>` : `<span class="muted">their turn</span>`}
          <button data-cdecline="${c.id}" class="ghost">Decline</button>
        </span></li>`;
    }).join('');
    const out = ch.outgoing.map((c) => {
      const myTurn = c.proposedBy.toLowerCase() !== me;
      const status = c.state === 'accepted' ? 'accepted' : (myTurn ? 'your turn' : 'waiting');
      return `<li><span class="fname">${esc(c.to)} · ${label(c)}</span>
        <span class="row-actions">
          ${myTurn && c.state === 'countered' ? `<button data-caccept="${c.id}">Accept</button>
                      <button data-ccounter="${c.id}" class="ghost">Counter</button>` : `<span class="muted">${status}</span>`}
          <button data-cdecline="${c.id}" class="ghost">Cancel</button>
        </span></li>`;
    }).join('');
    return `<h4>Challenges</h4><ul class="friend-list">${inc}${out}</ul>`;
  }

  _meLower() { return (this.snapshot.__me || '').toLowerCase(); }
```

The panel needs to know who "me" is to compute turns. Pass it from App: in `App.showOnline`, set `this._social.__me = currentUser()` before mounting, or include it in the snapshot. Simplest: have `_refreshSocial` stamp it:

```js
      this._social = await api.social.get();
      this._social.__me = currentUser();
```

(Import `currentUser` is already imported in App.js.)

Wire the new buttons at the end of `_render` (after the existing listeners):

```js
    this.root.querySelectorAll('[data-caccept]').forEach((b) =>
      b.addEventListener('click', () => this._do(() => api.social.acceptChallenge(b.dataset.caccept))));
    this.root.querySelectorAll('[data-cdecline]').forEach((b) =>
      b.addEventListener('click', () => this._do(() => api.social.declineChallenge(b.dataset.cdecline))));
    this.root.querySelectorAll('[data-ccounter]').forEach((b) =>
      b.addEventListener('click', () => this._counter(b.dataset.ccounter)));
```

Add the counter + a shared time helper:

```js
  _counter(id) {
    const time = pickTime();
    if (time !== undefined) this._do(() => api.social.counterChallenge(id, time));
  }
```

At the bottom of the file (module scope), add:

```js
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
```

- [ ] **Step 2: Implement `_openChallenge` in `App.js`**

Replace the Phase-1 stub:

```js
  async _openChallenge(friend) {
    const { pickTime } = await import('./FriendsPanel.js');
    const time = pickTime();
    if (time === undefined) return;
    try {
      const { api } = await import('../utils/api.js');
      await api.social.challenge(friend, time);
      await this._refreshSocial();
      this._toast(`Challenge sent to ${friend}`);
    } catch (e) {
      this._toast(e?.message || 'Could not send challenge');
    }
  }
```

- [ ] **Step 3: Manual verification** (covered in Task 14).

- [ ] **Step 4: Commit**

```bash
git add src/ui/FriendsPanel.js src/ui/App.js src/assets/theme.css
git commit -m "feat(social): challenge picker + challenges inbox with negotiation"
```

---

### Task 14: End-to-end verification + full suite

**Files:** none (verification task)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all suites PASS (existing 53 + the new social tests).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 3: Two-account manual E2E**

Start `npm run server` and `npm run dev`. Log in as A (browser 1) and B (browser 2).
1. **Friend:** A adds B → B toast + request → B accepts → mutual friends, green dots.
2. **Challenge (both online):** A opens Online, clicks Play on B, picks 5 min → B gets "A challenged you" → B counters 3 min → A sees "your turn", accepts → both drop into the online `GameScreen` at 3 min, opposite colors. Play a move each to confirm relay works.
3. **Decline:** A challenges B, B declines → challenge clears on both.
4. **Offline accept:** A challenges B, then A closes tab. B accepts → B sees "waiting". A logs back in → gets "B accepted your challenge. Start now?" → confirm → game starts.
5. **Unfriend:** remove → gone both sides; Play button no longer available.

- [ ] **Step 4: Commit any fixes found during E2E**

```bash
git add -A
git commit -m "fix(social): address issues found in end-to-end testing"
```

---

## Notes for the implementer

- **DATA_FILE isolation:** every server test sets a unique `DATA_FILE` and calls `vi.resetModules()` before importing the store, because the store is a module singleton that loads its file at import time. Never share a store instance across tests.
- **Auth in tests:** the router tests stub auth with `app.use((req,_r,n)=>{req.username=actor;n();})`. The real app mounts it behind the existing `auth` middleware in `index.js`.
- **Snapshot is authoritative:** the client always re-fetches `GET /api/social` after a push or a mutation; UI never trusts optimistic local state beyond toasts.
- **Presence needs the persistent socket** (Task 6). If a screen still creates its own short-lived connection, presence will flicker — route everything through `App.realtime`.
- **Ephemeral store caveat** (from the spec) is unchanged: on free Render the JSON file resets on redeploy.
