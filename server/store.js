// Tiny persistent store. Keeps all users and their profiles in a single JSON
// file so the backend has zero native/database dependencies and runs anywhere
// Node does. Fine for a personal-scale account service; swap for a real DB
// (Postgres, etc.) before high-scale production use.

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.DATA_FILE || join(here, 'data.json');

let db = { users: {}, friendRequests: [], challenges: {} }; // key(username) -> user; requests[]; challenges by id

function load() {
  if (existsSync(FILE)) {
    try {
      db = JSON.parse(readFileSync(FILE, 'utf8'));
      if (!db.users) db.users = {};
      if (!Array.isArray(db.friendRequests)) db.friendRequests = [];
      if (!db.challenges || typeof db.challenges !== 'object') db.challenges = {};
    } catch {
      db = { users: {}, friendRequests: [], challenges: {} };
    }
  }
}

// Write atomically: dump to a temp file then rename over the real one.
function persist() {
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, FILE);
}

load();

const key = (username) => username.toLowerCase();

export function getUser(username) {
  return db.users[key(username)] || null;
}

export function createUser(username, passwordHash, profile) {
  const record = { username, passwordHash, profile, friends: [], createdAt: Date.now() };
  db.users[key(username)] = record;
  persist();
  return record;
}

export function setProfile(username, profile) {
  const record = db.users[key(username)];
  if (!record) return false;
  record.profile = profile;
  persist();
  return true;
}

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
