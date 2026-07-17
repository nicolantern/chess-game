// Tiny persistent store. Keeps all users and their profiles in a single JSON
// file so the backend has zero native/database dependencies and runs anywhere
// Node does. Fine for a personal-scale account service; swap for a real DB
// (Postgres, etc.) before high-scale production use.

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.DATA_FILE || join(here, 'data.json');

let db = { users: {} }; // username(lowercased) -> { username, passwordHash, profile, createdAt }

function load() {
  if (existsSync(FILE)) {
    try {
      db = JSON.parse(readFileSync(FILE, 'utf8'));
      if (!db.users) db.users = {};
    } catch {
      db = { users: {} };
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
  const record = { username, passwordHash, profile, createdAt: Date.now() };
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
