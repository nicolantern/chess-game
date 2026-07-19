// server/social.js
//
// Social features (friends, requests, and — Phase 2 — game challenges) as an
// Express router. Durable state lives in the store; live delivery goes through
// the injected realtime interface ({ isOnline, pushTo, launchGame }). The router
// never imports ws directly, so it is unit-testable with a fake realtime.

import { Router } from 'express';

const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;

export function createSocialRouter({ store, realtime }) {
  const router = Router();
  const notify = (username, event) => realtime.pushTo(username, { type: 'social', event });

  // Build the caller's full social snapshot.
  router.get('/', (req, res) => {
    const me = req.username;
    const friends = store.getFriends(me).map((username) => ({
      username,
      online: realtime.isOnline(username),
    }));
    const { incoming, outgoing } = store.listRequests(me);
    res.json({ friends, incoming, outgoing, challenges: challengeSnapshot(store, me) });
  });

  router.post('/requests', (req, res) => {
    const me = req.username;
    const { username } = req.body || {};
    if (!USERNAME_RE.test(username || '')) return res.status(400).json({ error: 'Enter a valid username.' });
    if (username.toLowerCase() === me.toLowerCase()) return res.status(400).json({ error: "You can't friend yourself." });
    const target = store.getUser(username);
    if (!target) return res.status(404).json({ error: 'No player with that username.' });
    if (store.areFriends(me, target.username)) return res.status(409).json({ error: 'You are already friends.' });

    // Reciprocal request → auto-accept.
    if (store.hasRequest(target.username, me)) {
      store.removeRequest(target.username, me);
      store.addFriend(me, target.username);
      notify(target.username, 'request');
      return res.json({ ok: true, friended: true });
    }
    if (store.hasRequest(me, target.username)) return res.status(409).json({ error: 'Request already sent.' });
    store.addRequest(me, target.username);
    notify(target.username, 'request');
    res.json({ ok: true });
  });

  router.post('/requests/accept', (req, res) => {
    const me = req.username;
    const { username } = req.body || {};
    if (!store.hasRequest(username || '', me)) return res.status(404).json({ error: 'No such request.' });
    store.removeRequest(username, me);
    store.addFriend(me, username);
    notify(username, 'request');
    res.json({ ok: true });
  });

  router.post('/requests/decline', (req, res) => {
    const me = req.username;
    const { username } = req.body || {};
    store.removeRequest(username || '', me);
    res.json({ ok: true });
  });

  router.delete('/friends/:username', (req, res) => {
    const me = req.username;
    const other = req.params.username;
    store.removeFriend(me, other);
    notify(other, 'request');
    res.json({ ok: true });
  });

  // Game challenges (Phase 2).
  mountChallengeRoutes(router, { store, realtime, notify });

  return router;
}

// Snapshot of the caller's active challenges (incoming = needs their action,
// outgoing = awaiting the other side).
function challengeSnapshot(store, me) {
  return store.listChallenges(me);
}

function mountChallengeRoutes(router, { store, realtime, notify }) {
  const sameName = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();

  router.post('/challenges', (req, res) => {
    const me = req.username;
    const { username, time } = req.body || {};
    const target = store.getUser(username || '');
    if (!target) return res.status(404).json({ error: 'No player with that username.' });
    if (!store.areFriends(me, target.username)) return res.status(409).json({ error: 'You can only challenge friends.' });
    if (store.activeChallengeBetween(me, target.username)) {
      return res.status(409).json({ error: 'You already have a challenge with this friend.' });
    }
    const challenge = store.createChallenge(me, target.username, time || null);
    notify(target.username, 'challenge');
    res.json({ ok: true, challenge });
  });

  // Guard: load the challenge, ensure the caller is a participant.
  const load = (req, res) => {
    const c = store.getChallenge(req.params.id);
    if (!c) { res.status(404).json({ error: 'Challenge not found.' }); return null; }
    const me = req.username;
    if (!sameName(c.from, me) && !sameName(c.to, me)) { res.status(403).json({ error: 'Not your challenge.' }); return null; }
    return c;
  };

  router.post('/challenges/:id/accept', (req, res) => {
    const c = load(req, res);
    if (!c) return;
    const me = req.username;
    if (sameName(c.proposedBy, me)) return res.status(409).json({ error: "It's the other player's turn." });
    const other = sameName(c.from, me) ? c.to : c.from;
    if (realtime.isOnline(c.from) && realtime.isOnline(c.to)) {
      realtime.launchGame(c.from, c.to, c.time);
      store.removeChallenge(c.id);
      notify(other, 'challenge');
      return res.json({ ok: true, launched: true });
    }
    store.updateChallenge(c.id, { state: 'accepted', proposedBy: me });
    notify(other, 'challenge');
    res.json({ ok: true, launched: false, waiting: true });
  });

  router.post('/challenges/:id/counter', (req, res) => {
    const c = load(req, res);
    if (!c) return;
    const me = req.username;
    if (sameName(c.proposedBy, me)) return res.status(409).json({ error: "It's the other player's turn." });
    const { time } = req.body || {};
    store.updateChallenge(c.id, { time: time || null, proposedBy: me, state: 'countered' });
    notify(sameName(c.from, me) ? c.to : c.from, 'challenge');
    res.json({ ok: true, challenge: store.getChallenge(c.id) });
  });

  router.post('/challenges/:id/decline', (req, res) => {
    const c = load(req, res);
    if (!c) return;
    const me = req.username;
    const other = sameName(c.from, me) ? c.to : c.from;
    store.removeChallenge(c.id);
    notify(other, 'challenge');
    res.json({ ok: true });
  });
}
