# Cloudflare Migration + GitHub Actions Deploy — Design

**Date:** 2026-07-18
**Status:** Approved (design), pending implementation plan
**Owner:** Nicholas Wong

## Goal

Migrate the chess game from its current Node/Express single-service deployment
(Render) to a Cloudflare-native architecture, and add a GitHub Action that
deploys it automatically. The target architecture is the one drawn by the user:

- **Cloudflare Pages** — serves the static game (`dist/`, single-file Vite build).
- **Cloudflare Worker** — the REST API (`/api/register`, `/login`, `/profile`,
  `/health`) plus JWT issue/verify.
- **Durable Objects** — one per live match; holds game state and both WebSocket
  connections (real-time online play).
- **Cloudflare D1** (SQLite) — the `users` table: username, bcrypt hash, profile blob.
- **DNS + SSL/TLS** — `chess.jinglebellalltheway.com`, proxied through Cloudflare.

Everything is served same-origin under `chess.jinglebellalltheway.com`:
`/` → Pages, `/api/*` and `/ws` → the Worker (via a Worker Route that intercepts
those paths before Pages).

## Why this shape

The current backend is Express + the `ws` library + a JSON-file store
(`server/index.js`, `server/store.js`, `server/realtime.js`). None of these run
on the Workers runtime: Express and `ws` assume a Node HTTP server, and
`jsonwebtoken` depends on Node's `crypto`. So this is a genuine port, not a
lift-and-shift. The design preserves the existing HTTP contract and message
protocol exactly, so the **frontend needs no changes**: `src/utils/api.js` and
`src/utils/realtime.js` already default to relative paths (empty
`VITE_API_URL` → same origin), which is exactly what the same-origin Cloudflare
layout provides.

## Chosen approach: two boxes (Pages + separate Worker), joined by a Worker Route

This matches the user's diagram literally.

| Concern | Decision |
|---|---|
| Static hosting | Pages project `chess-game`, custom domain `chess.jinglebellalltheway.com` |
| API + realtime | Separate Worker `chess-api`, route `chess.jinglebellalltheway.com/api/*` and `/ws` |
| Same-origin | Worker Routes intercept `/api/*` and `/ws` before Pages serves them |
| Deploy targets | 2 (Pages deploy + Worker deploy), both driven by one GitHub Action |

Alternatives considered and rejected for this project:

- **B — Single Worker with static-assets binding.** Simplest pipeline (one
  deploy), but collapses Pages into the Worker, diverging from the diagram.
- **C — Pages advanced mode (`_worker.js`).** One project, but no separate
  Worker box and historically rougher Durable Object support.

Approach A was chosen because the user explicitly asked to follow the diagram.

## Phasing

Per the user's stated priorities, the work is delivered in two phases. The
**first working deploy** is Phase 1; the Durable Object multiplayer is Phase 2.

### Phase 1 — Pages + Auth Worker + D1 + custom domain + GitHub Action

This is a fully deployable, useful product: the game loads at the custom domain
and accounts/profiles work across devices. Online multiplayer is temporarily
unavailable until Phase 2 (the client shows its existing "offline" behavior).

**Components**

1. **`wrangler.toml`** (Worker `chess-api`)
   - `main = "worker/index.js"`, `compatibility_date` recent, `nodejs_compat`
     flag enabled (needed by `bcryptjs`).
   - D1 binding `DB` → database `chess-users`.
   - Route: `chess.jinglebellalltheway.com/api/*` (zone-scoped). `/ws` route
     added in Phase 2.
   - Secret `JWT_SECRET` (set once via `wrangler secret put`, not in the repo).

2. **Worker API (`worker/`)** — ports `server/index.js`:
   - Router (small hand-rolled switch on `method + pathname`, or `itty-router`).
   - `POST /api/register` — validate username (`/^[A-Za-z0-9_]{3,24}$/`) and
     password (≥6), reject duplicates, `bcrypt.hash(password, 10)`, insert user,
     return `{ token, username, profile }`.
   - `POST /api/login` — look up by lowercased username, `bcrypt.compare`,
     generic failure message, return `{ token, username, profile }`.
   - `GET /api/profile` — Bearer auth → `{ profile }`.
   - `PUT /api/profile` — Bearer auth, validate body → `{ ok: true }`.
   - `GET /api/health` → `{ ok: true }`.
   - CORS: same-origin in production; keep permissive for local dev only.
   - **Hashing:** `bcryptjs` (pure JS, runs on Workers with `nodejs_compat`) —
     preserves the diagram's "bcrypt hash." Note: bcrypt at cost 10 is CPU-heavy;
     if it exceeds the plan's CPU limit under load, fall back to Web Crypto
     PBKDF2. Documented as a known risk, not pre-optimized.
   - **JWT:** `jose` (Web Crypto, HS256) replaces `jsonwebtoken`. Same claims
     (`{ username }`), same 30-day TTL, same secret. Tokens remain
     interchangeable in format with the old server's.

3. **D1 database `chess-users`** — replaces `store.js`/`data.json`:
   ```sql
   CREATE TABLE users (
     id            INTEGER PRIMARY KEY AUTOINCREMENT,
     username      TEXT    NOT NULL,
     username_key  TEXT    NOT NULL UNIQUE,   -- lowercased, for case-insensitive lookup
     password_hash TEXT    NOT NULL,
     profile       TEXT    NOT NULL,          -- JSON blob (stats, Elo, achievements, saved games)
     created_at    INTEGER NOT NULL
   );
   ```
   - `migrations/0001_init.sql` holds this. Applied in CI with
     `wrangler d1 migrations apply chess-users --remote`.
   - Store helpers (`getUser`, `createUser`, `setProfile`) reimplemented against
     D1's prepared-statement API, matching the current signatures/semantics
     (lowercased key, profile round-trips as JSON).

4. **DNS + SSL/TLS** — `chess.jinglebellalltheway.com` added to the Cloudflare
   zone (proxied, orange cloud), universal SSL. Pages custom domain +
   the Worker Route are attached to this hostname. Mostly a dashboard/one-time
   step; documented in an updated `DEPLOY.md`.

5. **GitHub Action — `.github/workflows/deploy.yml`** (the headline deliverable):
   - Triggers: `push` to `main`, plus `workflow_dispatch`.
   - Steps:
     1. `actions/checkout`
     2. `actions/setup-node` (Node 20), `npm ci`
     3. `npm run build` (produces `dist/`)
     4. `cloudflare/wrangler-action` — `wrangler d1 migrations apply chess-users --remote`
     5. `cloudflare/wrangler-action` — `wrangler deploy` (Worker)
     6. `cloudflare/wrangler-action` — `wrangler pages deploy dist --project-name chess-game --branch=main`
   - Secrets: `CLOUDFLARE_API_TOKEN` (scoped: Workers Scripts, Pages, D1 edit),
     `CLOUDFLARE_ACCOUNT_ID`. `JWT_SECRET` is a Worker secret set out-of-band, not
     a workflow secret.
   - Optional (nice-to-have, may defer): a second job on `pull_request` that runs
     `npm test` and deploys a Pages preview.

**Frontend:** no code changes. It already targets relative `/api/*` and `/ws`.

### Phase 2 — Live multiplayer on Durable Objects

Ports `server/realtime.js` (matchmaking + relay) to Durable Objects on the same
Worker. Preserves the exact WebSocket message protocol
(`queue`/`cancel`/`matched`/`move`/`resign`/`drawOffer`/`drawAccept`/
`drawDecline`/`rematchOffer`/`rematchAccept`/`leave`/`opponentLeft`), so the
client's `src/utils/realtime.js` needs no changes.

- **Lobby DO (singleton)** — the matchmaking queue. Clients connect (JWT in
  `?token=`), send `queue { time }`; the Lobby pairs two waiters with the same
  time-control key, mints a `roomId`, assigns colors randomly, and hands both
  clients off to a **Match** DO. Handles `cancel`.
- **Match DO (one per game)** — holds both players' WebSocket connections
  (WebSocket Hibernation API), relays `move`/`resign`/draw/rematch between them,
  and handles disconnect → `opponentLeft`, plus `rematchAccept` re-pairing.
- **Worker wiring** — `/ws` route upgrades to WebSocket and forwards to the
  Lobby DO. `wrangler.toml` gains `durable_objects` bindings + a migration
  declaring the DO classes. The `/ws` Worker Route is added to the custom domain.
- **CI** — same `deploy.yml`; `wrangler deploy` now also publishes the DO classes.

Auth reuse: the same `jose` HS256 verify with `JWT_SECRET` authenticates
WebSocket connections from `?token=`, exactly as the old server did.

## Data flow (Phase 1)

```
Browser ── HTTPS ──> chess.jinglebellalltheway.com
   ├─ GET /                       → Pages (static dist/)
   ├─ POST /api/register|login    → Worker → bcrypt + jose + D1 insert/select
   ├─ GET/PUT /api/profile        → Worker → jose verify + D1 select/update
   └─ GET /api/health             → Worker
```

## Error handling

- API errors keep the current shape: `{ error: "message" }` with the same HTTP
  status codes (400 validation, 401 auth, 404 not-found, 409 duplicate).
- D1 failures → 500 with a generic message; details logged (`console.error`,
  visible via `wrangler tail`).
- CI: any `wrangler` step failing fails the job; migrations run before deploy so
  a bad migration blocks a broken deploy.
- Worker secret `JWT_SECRET` missing → fail fast at first request with a clear
  log line (mirrors the current dev-secret warning).

## Testing

- **Port existing Vitest suite** where it still applies (pure chess/engine tests
  are unaffected).
- **Worker tests** via `@cloudflare/vitest-pool-workers` (runs handlers in
  `workerd`) with a D1 test binding: register→login→profile round-trip, duplicate
  rejection, bad-password rejection, auth failures.
- **Phase 2:** DO tests for matchmaking pairing and message relay using the pool
  worker's WebSocket support.
- **Smoke test post-deploy:** `GET /api/health` in the Action after deploy
  (optional gate).

## Risks / open items

1. **bcrypt CPU cost on Workers** — cost-10 bcrypt may approach CPU limits. Fallback
   is Web Crypto PBKDF2. Accepted for now (personal-scale traffic).
2. **Worker Route vs Pages precedence** — must confirm `/api/*` and `/ws` routes
   correctly shadow the Pages custom domain. Standard Cloudflare behavior; verify
   during Phase 1 setup.
3. **Domain ownership** — `chess.jinglebellalltheway.com` must be a zone on the
   user's Cloudflare account for Worker Routes + Pages custom domain to attach.
4. **Data migration** — existing `server/data.json` accounts are not migrated
   (they're ephemeral on free Render already). Fresh D1 starts empty. If any real
   accounts must carry over, add a one-off import script (out of scope unless asked).
5. **Free-plan limits** — D1 and Workers free tiers are ample for personal scale;
   Durable Objects require a Workers Paid plan ($5/mo) as of this writing —
   flag to the user before Phase 2.

## Out of scope

- Server-side move validation (the current server is a relay; clients run the
  engine). Unchanged.
- Rewriting the frontend or chess engine.
- Migrating existing Render accounts (unless explicitly requested).
