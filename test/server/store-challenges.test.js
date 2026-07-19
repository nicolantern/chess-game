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
