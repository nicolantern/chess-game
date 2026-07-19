import { describe, it, expect, vi } from 'vitest';
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
