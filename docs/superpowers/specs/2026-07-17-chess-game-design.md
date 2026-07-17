# Chess Game — Design Spec

**Date:** 2026-07-17
**Status:** Approved

## Goal

A complete, polished, browser-based chess game with a modern interface, correct
implementation of all official chess rules, Player-vs-Player and Player-vs-AI
modes, and a Minimax + Alpha-Beta AI with four difficulty levels. Code must be
clean, object-oriented, well-commented, split into logical modules, and easy to
extend later (online play, puzzles, analysis, opening books).

## Decisions (locked)

| Area | Decision |
|------|----------|
| Stack | Vanilla JS (ES modules) + Vite build. No runtime framework. |
| Tests | Vitest — unit tests on rules + AI, plus perft node-count checks. |
| Piece art | Bundled SVG vector pieces (Cburnett-style), scale on all devices. |
| Audio | Web Audio API synthesized SFX (move/capture/check/castle/promote/game-end). No background music. |
| Location | `C:\Users\nicho\chess-game` |
| Offline | Fully offline — no external downloads at runtime. |

## Architecture

Strict separation between a **DOM-free deterministic engine**, the **AI**, and
the **UI**. Engine and AI share the same move-generation API. Moves are made and
unmade reversibly, which powers AI search, undo, and repetition detection.

```
chess-game/
├─ index.html
├─ package.json / vite.config.js / vitest.config.js
├─ src/
│  ├─ engine/           Pure rules, zero DOM, fully unit-tested
│  │  ├─ board.js       Board representation (0x88 mailbox), squares
│  │  ├─ pieces.js      Piece types, colors, value constants
│  │  ├─ moves.js       Move object; make/unmake (reversible)
│  │  ├─ movegen.js     Legal move generation (all special moves)
│  │  ├─ rules.js       Check, checkmate, stalemate, all draw rules
│  │  ├─ game.js        Game state machine, history, status
│  │  ├─ fen.js         FEN parse / serialize
│  │  └─ notation.js    SAN (standard algebraic notation)
│  ├─ ai/
│  │  ├─ engine.js      Minimax + alpha-beta + iterative deepening (time-budgeted)
│  │  ├─ evaluation.js  Material, PSQT, king safety, mobility, pawn structure
│  │  ├─ ordering.js    Move ordering (MVV-LVA captures, killer moves)
│  │  └─ difficulty.js  Easy / Medium / Hard / Expert knobs
│  ├─ ui/
│  │  ├─ App.js         Screen router (menu <-> game)
│  │  ├─ Menu.js        Play vs AI / Local Multiplayer / Settings / How to Play
│  │  ├─ BoardView.js   Render board, drag-drop, highlights, flip
│  │  ├─ Animator.js    Animations: move, capture, castle, promotion
│  │  ├─ PromotionDialog.js  Q/R/B/N picker
│  │  ├─ Sidebar.js     Move history (SAN), captured pieces, controls
│  │  ├─ Clock.js       Timers + time-control selection
│  │  └─ Settings.js    Toggle sound / highlights / animations, board theme
│  ├─ assets/
│  │  ├─ pieces/        12 SVG pieces
│  │  ├─ themes.css     Wood / marble board themes
│  │  └─ audio.js       Web Audio SFX synthesizer
│  ├─ utils/            events (pub/sub), storage (localStorage), timing
│  └─ main.js           Bootstrap
└─ test/                movegen, perft, draws, SAN, AI sanity
```

## Rules Coverage (all required, all tested)

- Legal move generation for every piece
- Castling (king/queen side; blocked by occupancy, check, or moving through check)
- En passant
- Pawn promotion with player choice of Q/R/B/N
- Check detection and forced response
- Checkmate
- Stalemate
- Draw by threefold repetition
- Fifty-move rule
- Draw by insufficient material
- FEN import/export for round-trip verification

## AI Design

- **Search:** Minimax with alpha-beta pruning, iterative deepening bounded by a
  per-move time budget so moves return quickly.
- **Move ordering:** MVV-LVA for captures + killer-move heuristic to maximize
  pruning (keeps Expert fast).
- **Evaluation:** material + piece-square tables + king safety + mobility +
  pawn structure (doubled/isolated/passed).
- **Difficulty scaling:**
  - Easy — shallow depth, added randomness, weakened/partial eval.
  - Medium — moderate depth, full eval, slight randomness.
  - Hard — deeper search, full eval, best move.
  - Expert — deepest search within time budget, full ordering, best move.
- **Responsiveness:** `ai/engine.js` is structured so it can be moved into a
  Web Worker later without changing the engine, keeping the UI responsive.

## UI / UX

- Responsive CSS-grid board for desktop, tablet, and mobile.
- Pointer-based drag-and-drop with click-to-move fallback; smooth animations.
- Highlights: selected piece's legal moves, last move made, king in check.
- Board flip; captured-piece tray; SAN move history list.
- Timers with selectable controls: 1, 3, 5, 10, 15, 30 minutes, and unlimited.
- Main menu: Play vs AI, Local Multiplayer, Settings, How to Play.
- Undo moves (available in local/AI play).
- Settings persisted to localStorage: sound on/off, highlights on/off,
  animations on/off, board theme (wood/marble).

## Extensibility

FEN in/out plus a clean, DOM-free engine API make the following drop-in later
without touching core rules: online multiplayer, puzzles, game analysis,
opening books.

## Verification

- Vitest suite green: movegen, perft node counts vs known positions, all draw
  conditions, SAN correctness, AI move-legality sanity.
- Manual browser run exercising each menu path, both modes, all four AI levels,
  and each special rule (castle, en passant, promotion, checkmate, stalemate,
  draws).
