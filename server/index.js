// Auth + profile-sync API for the chess game.
//
// Endpoints:
//   POST /api/register  { username, password } -> { token, username, profile }
//   POST /api/login     { username, password } -> { token, username, profile }
//   GET  /api/profile   (Bearer token)         -> { profile }
//   PUT  /api/profile   (Bearer token) { profile } -> { ok: true }
//   GET  /api/health                           -> { ok: true }
//
// Passwords are hashed with bcrypt; sessions are stateless JWTs. The profile is
// stored verbatim as the client's profile object (stats, Elo, achievements,
// saved games), so the server never needs to understand chess.

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getUser, createUser, setProfile } from './store.js';
import * as store from './store.js';
import { attachRealtime } from './realtime.js';
import { createSocialRouter } from './social.js';

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const TOKEN_TTL = '30d';

if (JWT_SECRET === 'dev-insecure-secret-change-me') {
  console.warn('[chess-server] WARNING: using the default dev JWT secret. Set JWT_SECRET in production.');
}

const app = express();
app.use(cors()); // dev: allow the Vite origin. Restrict in production.
app.use(express.json({ limit: '256kb' }));

// Late-bound realtime interface; populated once attachRealtime runs below (after
// app.listen). The social router closes over this object and reads its fields at
// request time, so the stub methods are replaced before any request arrives.
const SOCIAL_REALTIME = {
  isOnline: () => false,
  pushTo: () => false,
  launchGame: () => false,
};

const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;

// A blank profile for a brand-new account (the client fills it in over time).
const DEFAULT_PROFILE = { name: 'Player', stats: {}, savedGames: [] };

function signToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Bearer-token auth middleware. Attaches req.username on success.
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.username = jwt.verify(token, JWT_SECRET).username;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired — please log in again' });
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!USERNAME_RE.test(username || '')) {
    return res.status(400).json({ error: 'Username must be 3–24 letters, numbers, or underscores.' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (getUser(username)) {
    return res.status(409).json({ error: 'That username is taken.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const profile = { ...DEFAULT_PROFILE, name: username };
  createUser(username, passwordHash, profile);
  res.json({ token: signToken(username), username, profile });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = getUser(username || '');
  // Generic message so we don't reveal whether the username exists.
  const fail = () => res.status(401).json({ error: 'Invalid username or password.' });
  if (!user || typeof password !== 'string') return fail();
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return fail();
  res.json({ token: signToken(user.username), username: user.username, profile: user.profile });
});

app.get('/api/profile', auth, (req, res) => {
  const user = getUser(req.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ profile: user.profile });
});

app.put('/api/profile', auth, (req, res) => {
  const { profile } = req.body || {};
  if (!profile || typeof profile !== 'object') {
    return res.status(400).json({ error: 'Missing profile' });
  }
  setProfile(req.username, profile);
  res.json({ ok: true });
});

// Social layer (friends + challenges), behind bearer auth. Mounted before the
// SPA catch-all so /api/social/* is not swallowed by the static fallback.
app.use('/api/social', auth, createSocialRouter({ store, realtime: SOCIAL_REALTIME }));

// Serve the built frontend (single-service deployment) if it has been built.
// The app, the API, and the WebSocket all share one origin in production.
const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback for any non-API GET.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(join(distDir, 'index.html'));
  });
  console.log('[chess-server] serving built frontend from /dist');
}

// Load the store (async in Postgres mode) before we start serving requests.
await store.initStore();

const server = app.listen(PORT, () => {
  console.log(`[chess-server] listening on http://localhost:${PORT}`);
});

// On shutdown (Render sends SIGTERM on redeploy/scale), flush any pending
// Postgres write so the last change isn't lost, then exit.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => {
    try { await store.flush(); } catch { /* ignore */ }
    process.exit(0);
  });
}

// Attach the real-time (online multiplayer) WebSocket server on /ws, and wire its
// interface into the social router's late-bound holder.
const realtime = attachRealtime(server, JWT_SECRET);
Object.assign(SOCIAL_REALTIME, {
  isOnline: realtime.isOnline,
  pushTo: realtime.pushTo,
  launchGame: (a, b, time) => realtime.launchGame(a, b, time),
});

// When a user connects/disconnects, tell their online friends so their panels
// update the presence dot live.
realtime.setPresenceHandler((username, online) => {
  for (const friend of store.getFriends(username)) {
    realtime.pushTo(friend, { type: 'presence', username, online });
  }
});

