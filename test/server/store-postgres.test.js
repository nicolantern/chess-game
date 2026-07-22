import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Exercises the opt-in Postgres backend (DATABASE_URL set) with a fake pg Pool,
// so no real database is needed. Verifies load-on-boot and the coalesced
// write-behind flush.

function makeFakePg(initialDoc = null) {
  const queries = [];
  let stored = initialDoc ? { data: initialDoc } : null;
  const pool = {
    query: vi.fn(async (sql, params) => {
      queries.push({ sql, params });
      if (sql.startsWith('CREATE TABLE')) return { rows: [] };
      if (sql.startsWith('SELECT')) return { rows: stored ? [stored] : [] };
      if (sql.startsWith('INSERT')) {
        stored = { data: JSON.parse(params[1]) };
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };
  return { pool, queries, get stored() { return stored?.data ?? null; } };
}

async function freshPgStore(fake) {
  vi.resetModules();
  process.env.DATABASE_URL = 'postgres://fake/db';
  delete process.env.DATA_FILE; // ensure file backend can't interfere
  vi.doMock('pg', () => ({ default: { Pool: vi.fn(() => fake.pool) } }));
  const store = await import('../../server/store.js');
  await store.initStore();
  return store;
}

describe('postgres store backend', () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
    vi.doUnmock('pg');
    vi.resetModules();
  });

  it('creates the kv table and starts empty when no row exists', async () => {
    const fake = makeFakePg(null);
    const store = await freshPgStore(fake);
    expect(fake.queries[0].sql).toMatch(/CREATE TABLE IF NOT EXISTS kv/);
    expect(store.getUser('nobody')).toBeNull();
  });

  it('loads an existing document from the kv row on boot', async () => {
    const fake = makeFakePg({
      users: { alice: { username: 'Alice', passwordHash: 'h', profile: { name: 'Alice' }, friends: ['Bob'] } },
      friendRequests: [],
      challenges: {},
    });
    const store = await freshPgStore(fake);
    expect(store.getUser('Alice').username).toBe('Alice');
    expect(store.getFriends('Alice')).toEqual(['Bob']);
  });

  it('flushes the latest snapshot after mutations', async () => {
    const fake = makeFakePg(null);
    const store = await freshPgStore(fake);
    store.createUser('Alice', 'h1', { name: 'Alice' });
    store.createUser('Bob', 'h2', { name: 'Bob' });
    store.addFriend('Alice', 'Bob');
    await store.flush();
    expect(fake.stored.users.alice.friends).toEqual(['Bob']);
    expect(fake.stored.users.bob.friends).toEqual(['Alice']);
  });

  it('coalesces rapid mutations into few writes but persists the final state', async () => {
    const fake = makeFakePg(null);
    const store = await freshPgStore(fake);
    for (let i = 0; i < 10; i++) store.createUser(`User${i}`, 'h', { name: `User${i}` });
    await store.flush();
    const inserts = fake.queries.filter((q) => q.sql.startsWith('INSERT')).length;
    expect(inserts).toBeLessThan(10); // write-behind coalesced them
    expect(Object.keys(fake.stored.users)).toHaveLength(10); // but nothing was lost
  });
});
