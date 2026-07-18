# Friends & Challenges — Design

**Date:** 2026-07-18
**Status:** Approved (design), pending implementation plan
**Owner:** Nicholas Wong

## Goal

Add a social layer to the online chess game: players with accounts can send and
accept **friend requests** (by exact username), keep a **friends list** that
shows who is online, and **challenge a friend to a game**. Challenges are
**offline-capable** (you can challenge a friend who isn't connected; they see it
next time they log in) and the time control is **negotiable** (the recipient can
counter-propose before accepting).

Built on the current stack: Express + JWT auth, the `ws` WebSocket server, and
the JSON-file user store. No new game UI — an accepted challenge reuses the
existing online `matched` → `GameScreen` flow.

## Architecture

Two channels, each owning what it is good at:

- **REST API** owns durable state — friends, friend requests, challenges. All
  *actions* (send/accept/decline/counter/unfriend) go through REST, so they
  survive disconnects and work while the other party is offline.
- **WebSocket** (existing `realtime.js`) carries *live* signals — presence
  (online/offline), push notifications for new requests/challenges, and the game
  **launch handshake**. The client refreshes durable state from REST when a push
  says something changed.

**Live-update mechanism: WebSocket push** (chosen over polling). New request /
challenge / presence changes are pushed to the affected online users so the
Friends panel updates instantly without polling.

### Module layout

- `server/social.js` — **new.** An Express `Router` mounting the social
  endpoints, plus the domain logic (validation, state transitions). Keeps
  `server/index.js` thin.
- `server/store.js` — extended to persist the new collections and expose
  accessors (see Data model). Persistence stays the same atomic JSON write.
- `server/realtime.js` — extended with a **presence registry**
  (`username -> Set<socket>`), an `isOnline(username)` helper, a way for
  `social.js` to push events to a user's sockets, and the challenge **launch**
  path (reuses `createRoom`).
- `src/utils/api.js` — social client methods.
- `src/utils/realtime.js` — handlers for the new push event types; the launch
  handshake produces the existing `matched` event.
- New UI: a **Friends panel** component + toasts (reusing the existing toast
  system).

Because `social.js` needs both the store (durable) and realtime (push/launch),
realtime exposes a small interface (`isOnline`, `pushTo(username, msg)`,
`launchGame(a, b, time)`) that `social.js` calls; `social.js` does not import
`ws` directly.

## Data model (persisted in `data.json`)

Extend the store's DB shape:

```
{
  users: { <key>: { username, passwordHash, profile, createdAt, friends: string[] } },
  friendRequests: [ { from, to, at } ],          // pending only
  challenges: [ { id, from, to, time, proposedBy, state, at } ]
}
```

- `friends` — array of usernames (canonical/original case; compared
  case-insensitively via the existing lowercased key).
- `friendRequests` — one entry per pending request; removed on accept/decline.
- `challenges`:
  - `id` — unique string.
  - `from` / `to` — challenger and recipient usernames (fixed for the life of the
    challenge).
  - `time` — the currently proposed time control object (same shape matchmaking
    uses, e.g. `{ minutes, increment }` or `null` for unlimited).
  - `proposedBy` — whose proposal `time` currently represents (`from` or `to`).
    Determines whose turn it is to act.
  - `state` — `pending` (sent, awaiting recipient) · `countered` (a counter was
    made, awaiting the other side) · `accepted` (agreed, awaiting both online to
    launch) · `declined` · `launched` (a game was created). Terminal states are
    pruned after delivery.
  - `at` — timestamp.

Store accessors (illustrative): `getFriends(u)`, `addFriend(a,b)`,
`removeFriend(a,b)`, `listRequests(u)`, `addRequest(from,to)`,
`removeRequest(from,to)`, `getChallenge(id)`, `listChallenges(u)`,
`upsertChallenge(c)`, `removeChallenge(id)`.

## REST API (all require Bearer auth; `req.username` is the actor)

- `GET /api/social` → snapshot:
  ```
  {
    friends:   [ { username, online } ],
    incoming:  [ { from, at } ],                 // friend requests to me
    outgoing:  [ { to, at } ],                   // friend requests I sent
    challenges: {
      incoming: [ challenge ],                   // needs my action
      outgoing: [ challenge ]                     // awaiting the other side
    }
  }
  ```
- `POST /api/social/requests { username }` — send a friend request.
  - 400 self-request / unknown user; 409 already friends or duplicate/pending
    (either direction — if they already requested me, this **auto-accepts**).
- `POST /api/social/requests/accept { username }` — accept an incoming request →
  adds each to the other's `friends`, removes the request.
- `POST /api/social/requests/decline { username }` — remove the incoming request.
- `DELETE /api/social/friends/:username` — unfriend (removes from both lists).
- `POST /api/social/challenges { username, time }` — create a challenge (or, if
  an active challenge with that friend exists, this is rejected 409). Must be a
  friend. Delivered live if the recipient is online.
- `POST /api/social/challenges/:id/accept` — accept the current `time`. Allowed
  only for the party who is **not** `proposedBy`. → `state: accepted`, then
  attempt launch.
- `POST /api/social/challenges/:id/counter { time }` — propose a different time.
  Allowed only for the non-`proposedBy` party. Sets `time`, flips `proposedBy`,
  `state: countered`.
- `POST /api/social/challenges/:id/decline` — decline/cancel. Either party may
  end the challenge (proposer "cancels", other party "declines").

Every mutating call that affects another online user triggers a WS push to them
(and to the actor's own other sessions) so panels stay in sync.

## Realtime (WebSocket) additions

On top of the existing matchmaking/relay protocol:

- **Presence.** On connect, register the socket under its username and notify
  online friends (`{ type: 'presence', username, online: true }`); on the last
  socket for a user closing, notify `online: false`.
- **Push notifications** (server → client): `{ type: 'social', event }` where
  `event` is `request` | `challenge` | `presence` — a lightweight nudge telling
  the client to refresh `GET /api/social` (or carrying the changed item).
- **Launch handshake.** When a challenge reaches `accepted`:
  - If **both online** → server calls `createRoom(a, b, time)` (existing code,
    random colors) and emits the existing `matched` to both. Challenge →
    `launched`, then pruned. Clients enter the current online `GameScreen`
    unchanged.
  - If the accepter is online but the challenger is **not** → challenge stays
    `accepted`; when the challenger reconnects, they receive a `social`/`challenge`
    push and the panel offers **"Start now?"**, which triggers the launch (a
    normal accept path with both now online).

`social.js` drives launches via the realtime interface
(`realtime.launchGame(from, to, time)`), which resolves the two sockets and pairs
them through the same `createRoom` used by matchmaking.

## Negotiation state machine (challenge)

```
             counter(time')                 counter(time'')
   pending ─────────────────►  countered ─────────────────►  countered ... (unbounded, alternating)
      │                            │                              │
 recipient acts                the non-proposer acts          ...
      │ accept                     │ accept                       │
      ▼                            ▼                              ▼
  accepted ───────────────────────────────────────────────►  launched (both online)
      │ decline / cancel (either party, any state)
      ▼
  declined
```

Turn rule: the party allowed to `accept`/`counter` is always the one who is
**not** `proposedBy`. The `proposedBy` party may only `decline` (cancel). This
prevents accepting your own proposal and keeps turns unambiguous.

## Frontend

- **Friends panel** — reachable from the online/menu screen. Sections:
  1. *Add friend* — username input + Send; inline validation from API errors.
  2. *Requests* — incoming (Accept / Decline) and outgoing (Pending, Cancel).
  3. *Friends* — each row: online dot, name, **Challenge** button (opens a small
     time-control picker → `POST /api/social/challenges`), and unfriend.
  4. *Challenges* — incoming (Accept / Counter / Decline, Counter opens the time
     picker) and outgoing (Awaiting… / Cancel; "Start now?" when applicable).
- **Toasts** — new friend request or challenge while online → a toast (reusing
  the existing unlock/achievement toast system), which also refreshes the panel.
- `src/utils/api.js` — add `social.get()`, `social.request/accept/decline`,
  `social.unfriend`, `social.challenge/acceptChallenge/counter/declineChallenge`.
- `src/utils/realtime.js` — handle `presence` and `social` events (emit to app so
  the panel/toasts react); the launch still surfaces as the existing `matched`
  event, so the game-entry code path is untouched.

## Error handling

- API errors keep the current `{ error }` + status convention (400 validation,
  401 auth, 404 unknown, 409 conflict/duplicate).
- Acting on a challenge that is not your turn, or already terminal → 409 with a
  clear message; the client refreshes the snapshot (it may be stale).
- Launch attempted while the other party dropped offline mid-handshake → the
  challenge falls back to `accepted` and waits; the actor sees "They just went
  offline — the game will start when they're back."
- All social mutations are validated server-side against the store; the client UI
  is optimistic only for toasts, authoritative state always from `GET /api/social`.

## Testing

- **Store unit tests** — friend add/remove idempotency, request lifecycle,
  challenge state transitions and turn rules (accept only by non-proposer,
  counter flips `proposedBy`, decline from either side, duplicate-challenge
  rejection).
- **API tests** (supertest-style against the Express app with a temp
  `DATA_FILE`) — request → accept makes mutual friends; auto-accept on reciprocal
  request; unfriend; challenge negotiation happy paths and rejections.
- **Realtime tests** — presence toggling notifies friends; a challenge accepted
  with both online produces `matched` for both; accepter-online/challenger-offline
  leaves `accepted` and launches on reconnect.
- Existing Vitest suite stays green; new tests live alongside it.

## Phasing (for the implementation plan)

- **Phase 1 — Friend graph & presence:** store fields + `social.js` request/accept/
  decline/unfriend endpoints, presence registry + `social`/`presence` pushes,
  Friends panel sections 1–3 (add / requests / friends list with online dots).
  Fully useful on its own.
- **Phase 2 — Challenges:** challenge collection + negotiation endpoints and state
  machine, the launch handshake (both-online + reconnect-prompt), Friends panel
  section 4 + the time-control picker + challenge toasts.

Same design; Phase 2 depends on Phase 1's presence + push plumbing.

## Risks / open items

1. **Ephemeral storage on free Render** — friends/challenges reset on redeploy,
   like accounts today. Durable hosting or a DB removes this. Not a blocker.
2. **Cloudflare migration** — these Express endpoints + the challenge realtime
   will need porting to a Worker/Durable Object under the separate migration
   design. This feature is intentionally built on the current live stack.
3. **Abuse surface** — friend-request spam by username. Out of scope for v1;
   could add rate limiting / block later.
4. **Multi-session presence** — a user open in two tabs counts online until the
   last socket closes (handled by the `Set<socket>` registry).

## Out of scope (YAGNI for v1)

- Blocking users, friend suggestions, searchable user directory (explicitly chose
  exact-username add).
- Spectating a friend's game, friend chat/messaging.
- Persisting game history against the friendship.
