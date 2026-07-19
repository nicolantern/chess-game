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
    expect((await request(c.mk('Alice')).post(`/api/social/challenges/${id}/accept`)).status).toBe(409);
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
