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

  it('counters a challenge with a time', async () => {
    await api.social.counterChallenge('c1', { minutes: 3 });
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/social/challenges/c1/counter');
    expect(JSON.parse(opts.body)).toEqual({ time: { minutes: 3 } });
  });
});
