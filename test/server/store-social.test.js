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
