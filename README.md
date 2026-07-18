# ♞ Chess

A complete, polished, browser-based chess game: Player-vs-Player and
Player-vs-AI, full official rules, a Minimax + alpha-beta AI with four
difficulty levels, and a modern responsive interface. No runtime dependencies
and no network — it runs entirely offline.

## Features

- **Modes** — Local multiplayer and Play vs AI (Easy / Medium / Hard / Expert).
- **Full rules** — castling, en passant, pawn promotion (choose Q/R/B/N), check,
  checkmate, stalemate, and draws by threefold repetition, the fifty-move rule,
  and insufficient material. Move generation is verified against published
  **perft** node counts.
- **Play** — drag-and-drop or click-to-move, legal-move highlights, last-move
  and king-in-check highlights, board flip, undo, captured-piece trays with a
  material advantage, and a SAN move history.
- **Board tools** — right-click to draw arrows and square highlights, review the
  game with ← / → or by clicking any move, keyboard shortcuts, and fullscreen.
- **Profiles & stats** — a player profile with an **Elo rating**, lifetime
  W/L/D, per-difficulty breakdown, streaks, averages, six **achievements**, PGN
  export, replayable saved games, and auto-save/resume of an unfinished game.
- **Optional accounts** — sign up / log in to sync your profile across devices
  (see below); fully offline and local-only when logged out.
- **Online multiplayer** — once logged in, **Play Online** matches you with
  another player by time control for a live, real-time game (moves + clocks
  synced over WebSockets), with resign, draw offers, rematch, and
  opponent-disconnect handling.
- **Analysis & hints** — a best-move **hint** arrow, and post-game **analysis**
  giving each side an accuracy % and per-move symbols (‼ brilliant, ?! / ? / ??
  for inaccuracies, mistakes, and blunders).
- **Clocks** — Bullet / Blitz / Rapid / Classical presets, custom time, and
  Fischer **increment** or simple **delay** — or unlimited.
- **AI** — negamax with alpha-beta pruning, iterative deepening on a time
  budget, quiescence search, MVV-LVA + killer-move ordering, and an evaluation
  combining material, piece-square tables, king safety, mobility, and pawn
  structure.
- **Presentation** — scalable SVG pieces, six board themes (wood, marble, green,
  blue, coral, slate), smooth animations, a loading screen, and synthesized
  sound effects.
- **Settings** — toggle sound, highlights, and animations; pick a board theme.
  Persisted to `localStorage`.

## Getting started

```bash
npm install
npm run dev      # start the dev server (prints a localhost URL)
npm test         # run the unit + perft test suite
npm run build    # production build into dist/
npm run preview  # serve the production build
```

Open the printed localhost URL in any modern browser.

## Accounts (optional online sync)

The game is fully playable with no server — stats and saved games live in the
browser. An optional backend adds **accounts** so your profile (stats, Elo,
achievements, saved games) syncs across devices.

```bash
npm run server:install   # one-time: install the backend's dependencies
npm run server           # start the API on http://localhost:3001
npm run dev              # in another terminal; Vite proxies /api -> :3001
```

Then use **Log in / Sign up** on the main menu. Signing up seeds your account
with your current local progress; logging in pulls your account's profile.
Logged out (or if the server is unreachable), everything falls back to
local-only — no feature is lost.

**How it works:** Express + a small JSON file store (`server/data.json`),
passwords hashed with bcrypt, stateless JWT sessions. The server only stores an
opaque profile blob — it never needs to understand chess. **Online multiplayer**
adds a WebSocket layer (`/ws`) that authenticates with the same JWT, matchmakes
by time control, and relays moves between the two players (each client runs the
identical engine; server-side move validation is a planned hardening).

**Deploying for real cross-device play:** the server also serves the built app,
so the whole thing deploys as **one service**. See **[DEPLOY.md](DEPLOY.md)** for
step-by-step Render instructions (a `render.yaml` blueprint is included). Note
the free tier's storage is ephemeral (accounts reset on restart) — DEPLOY.md
covers how to make it durable. Before production, also restrict CORS and add
rate limiting; the bundled server is intentionally minimal.

## Architecture

The code is split into a DOM-free engine, the AI, and the UI. The engine and AI
share the same move-generation API; moves are applied reversibly
(`makeMove`/`unmakeMove`), which powers AI search, undo, and repetition
detection alike.

```
src/
├─ engine/     Pure rules, zero DOM (perft-verified)
│  ├─ pieces.js      Piece/color encoding and values
│  ├─ board.js       0x88 board geometry and the Board state container
│  ├─ fen.js         FEN parse / serialize
│  ├─ attacks.js     Square-attack and check detection
│  ├─ moves.js       Move flags and reversible make/unmake
│  ├─ movegen.js     Pseudo-legal + legal move generation
│  ├─ perft.js       Node-count correctness harness
│  ├─ notation.js    Standard Algebraic Notation (SAN)
│  ├─ rules.js       Insufficient-material draw
│  └─ game.js        Game state machine, history, status, draws
├─ ai/
│  ├─ psqt.js        Piece-square tables
│  ├─ evaluation.js  Material, PSQT, king safety, mobility, pawn structure
│  ├─ ordering.js    MVV-LVA + killer-move ordering
│  ├─ search.js      Negamax + alpha-beta + iterative deepening + quiescence
│  ├─ difficulty.js  Easy / Medium / Hard / Expert presets
│  └─ ai.js          Facade the UI talks to (Web-Worker-ready seam)
├─ ui/
│  ├─ App.js             Screen router
│  ├─ Menu.js            Main menu + new-game configuration
│  ├─ MatchController.js Game + AI + clock orchestration over an event bus
│  ├─ BoardView.js       Rendering, drag/click input, highlights, flip
│  ├─ Animator.js        Move/capture/castle/promotion animation
│  ├─ PromotionDialog.js Q/R/B/N picker
│  ├─ Sidebar.js         Clocks, captured trays, SAN history, controls
│  ├─ Clock.js           Two-sided countdown clock
│  ├─ Settings.js        Sound/highlights/animations/theme
│  └─ HowToPlay.js       Rules reference
├─ assets/
│  ├─ pieces.js      Inline SVG piece set
│  ├─ audio.js       Web Audio sound-effect synthesizer
│  └─ theme.css      Design tokens, board themes, responsive layout
├─ utils/            Event bus + settings storage
└─ main.js           Bootstrap
```

## Extending

The DOM-free engine and FEN import/export are the seams for future work:

- **Online multiplayer** — serialize moves/positions over the wire; the engine
  already validates every move.
- **Puzzles / analysis** — load any position via FEN and reuse the search.
- **Opening books** — consult a book before calling `searchBestMove`.
- **Web Worker AI** — move `ai/search.js` behind `ai/ai.js`'s async facade
  without touching the UI.

## Testing

`npm test` runs Vitest: engine unit tests, the **perft** suite (start position,
Kiwipete, and other reference positions) as the authoritative move-generation
check, SAN and draw-rule tests, AI sanity (finds mate-in-one, legal at every
difficulty), and UI-logic tests (clock, controller, event bus).
