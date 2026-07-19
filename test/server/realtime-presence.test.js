import { describe, it, expect } from 'vitest';
import { createPresence } from '../../server/realtime.js';

describe('presence registry', () => {
  it('tracks online users across multiple sockets', () => {
    const p = createPresence();
    const s1 = { readyState: 1, sent: [], send(m) { this.sent.push(m); } };
    const s2 = { readyState: 1, sent: [], send(m) { this.sent.push(m); } };
    p.add('Alice', s1);
    p.add('Alice', s2);
    expect(p.isOnline('alice')).toBe(true);

    p.pushTo('Alice', { type: 'social', event: 'request' });
    expect(JSON.parse(s1.sent[0]).event).toBe('request');
    expect(JSON.parse(s2.sent[0]).event).toBe('request');

    expect(p.socketFor('alice')).toBe(s1);

    p.remove('Alice', s1);
    expect(p.isOnline('Alice')).toBe(true); // still one socket
    p.remove('Alice', s2);
    expect(p.isOnline('Alice')).toBe(false);
    expect(p.pushTo('Alice', { type: 'x' })).toBe(false); // nobody to push to
    expect(p.socketFor('Alice')).toBe(null);
  });
});
