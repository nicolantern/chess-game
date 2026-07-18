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
import { getUser, createUser, setProfile } from './store.js';
import { attachRealtime } from './realtime.js';

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const TOKEN_TTL = '30d';

if (JWT_SECRET === 'dev-insecure-secret-change-me') {
  console.warn('[chess-server] WARNING: using the default dev JWT secret. Set JWT_SECRET in production.');
}

const app = express();
app.use(cors()); // dev: allow the Vite origin. Restrict in production.
app.use(express.json({ limit: '256kb' }));

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

const server = app.listen(PORT, () => {
  console.log(`[chess-server] listening on http://localhost:${PORT}`);
});

// Attach the real-time (online multiplayer) WebSocket server on /ws.
attachRealtime(server, JWT_SECRET);

