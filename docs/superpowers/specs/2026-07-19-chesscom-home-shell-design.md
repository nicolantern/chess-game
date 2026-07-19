# chess.com-Style Home Shell — Design

**Date:** 2026-07-19
**Status:** Approved (design), pending implementation plan
**Owner:** Nicholas Wong

## Goal

Rebuild the app's **home screen** as a dark, three-column layout modeled on
chess.com's Play page: a left navigation sidebar, a centered decorative board,
and a right "Play Chess" action panel of cards. Wire it to **only the features
this app actually has** (no dead links), and keep every existing screen working.
This is the **first phase** — the home + shell — with the other screens restyled
to match in a later phase.

## Scope decisions (locked in during brainstorming)

- **Real features only.** The sidebar and cards expose only working features:
  Play Online, Play Bots (vs AI), Play a Friend, Pass & Play (local), plus Stats,
  Settings, How to Play, and account login/logout. Everything chess.com shows that
  this app lacks (Puzzles, Learn beyond how-to, Watch, Community, Coach,
  Tournaments, Variants, Search, Remove Ads, language) is **omitted**.
- **Home + shell first.** Only the home screen becomes the three-column layout.
  The existing one-screen-at-a-time router is unchanged: clicking Settings/Stats/a
  game still swaps the full view. Promoting the sidebar to a persistent shell that
  stays visible during play is a **later phase**, noted below.

## Architecture

The current `App` (`src/ui/App.js`) mounts exactly one screen into `#app` via
`_mount(builder)`. The new home is just a different, richer screen mounted the
same way — **no router refactor**.

- **New component `src/ui/HomeScreen.js`** replaces `Menu` as the home. It renders
  the three-column layout and owns the sub-flows that `Menu` currently renders
  inline (the Play-vs-AI config and the Pass-&-Play config panels), so those keep
  working. It receives the same options `App` passes to `Menu` today
  (`onStart`, `onNavigate`, `resumeAvailable`, `onResume`, `account`) plus an
  `onPlayFriend` callback.
- **`Menu` is retired** and its config-panel logic (`_timeField`, `_bindTimeField`,
  `renderAIConfig`, `renderPvPConfig`, the `TIME_PRESETS` export) moves into
  `HomeScreen` unchanged. `App.showMenu()` mounts `HomeScreen` instead of `Menu`.
- **Decorative board** reuses the existing `BoardView` in non-interactive mode
  with the standard start position (`parseFen(START_FEN)`), inheriting the green
  theme and the new Staunton pieces.
- **Styling** lives in `src/assets/theme.css` under a `.home` scope so it doesn't
  affect other screens. A dark chrome palette wraps the (already green) board.

### Component boundaries

- `HomeScreen` — layout + navigation wiring + the two start-config sub-panels.
  One responsibility: the home experience. Sub-panels are the same code paths as
  today, just relocated.
- `App` — unchanged responsibilities; only `showMenu()` and one new
  `onPlayFriend` handler change.
- `BoardView` — unchanged; used read-only for the decorative board.

## Left navigation (sidebar)

Top-to-bottom, real features only:

- **Brand:** `♞ Chess` (logo + wordmark).
- **Play** — active/home (no-op on the home; highlighted).
- **Learn** — → `onNavigate('howto')` (How to Play).
- **Stats** — → `onNavigate('stats')` (Profile & Stats).
- **Settings** — → `onNavigate('settings')`.
- **Account block** (bottom):
  - Logged out: **Log In / Sign Up** → `onNavigate('account')`.
  - Logged in: `👤 <username>` + **Log out** → `account.onLogout()`.

Nav items are icon + label rows with a hover/active state. On narrow screens the
sidebar collapses to a horizontal top bar (see Responsive).

## Right "Play Chess" panel (action cards)

A titled panel (`♟ Play Chess`) with large cards — icon, title, subtitle — in this
order:

| Card | Subtitle | Action |
|---|---|---|
| **Play Online** | Play vs a person | `onNavigate('online')` if logged in, else `onNavigate('account')`; show a small "log in" hint when logged out (as today) |
| **Play Bots** | Challenge the computer | open the Play-vs-AI config sub-panel (difficulty / color / time) |
| **Play a Friend** | Invite a friend to a game | `onPlayFriend()` — enters the friends/challenge flow |
| **Pass & Play** | Two players, one device | open the local-multiplayer config sub-panel |

Below the cards: a **Game History** link → `onNavigate('stats')`. (Leaderboard is
omitted — no such feature.)

Selecting **Play Bots** or **Pass & Play** shows the existing config panel (the
same markup `Menu.renderAIConfig` / `renderPvPConfig` produce today), from which
**Start Game** calls `onStart(config)` exactly as now. A **Back** button returns
to the home layout.

## Center: decorative board

- `BoardView` mounted non-interactive, start position, not flipped.
- Labels: **Opponent** above, and below either **Player** or the logged-in
  username.
- Clicking it does nothing (games start from the cards). It is purely the home
  visual, matching the reference.

## "Play a Friend" — dependency & sequencing

The friends/challenge feature has an approved design + plan
(`docs/superpowers/specs/2026-07-18-friends-and-challenges-design.md`) but is not
built yet. This redesign is **independent** and ships first (chosen: shell first).
Until friends lands, `onPlayFriend()` routes to the **Play Online** entry with a
brief note ("Friend challenges are coming — playing online for now"), or, if the
friends feature is present, opens its panel. When friends ships, `onPlayFriend()`
is repointed to the friends flow with no other change to the home.

## Theme & responsive

- **Dark chrome** around the green board: background ~`#262421`, panels/sidebar
  ~`#302e2b`, card hover ~`#3d3a37`, text `#e9e7e4` / muted `#a8a29a`, accent green
  `#7fa650`/`#769656` to tie into the board. These are scoped to `.home` (added as
  a small set of CSS variables) so existing screens/themes are untouched.
- **Board stays green** (the default theme set earlier) and keeps the new pieces.
- **Responsive:**
  - Wide (≥ ~980px): three columns — sidebar | board | cards.
  - Medium: two columns — the cards drop below the board; sidebar stays.
  - Narrow (mobile): single column — sidebar collapses to a top bar (brand +
    account + a menu of Learn/Stats/Settings), board next, cards stacked below.
  - Uses CSS grid + `max-width` / `minmax`, no fixed pixel board size (board sizes
    to its column).

## Error handling / edge cases

- **Logged-out Play Online / Play a Friend** — route to the account screen (or the
  friends note), never a broken action.
- **Resume game** — if a game is in progress (`resumeAvailable`), surface a
  **Resume** affordance at the top of the right panel (a highlighted card/button),
  preserving today's resume behavior.
- **No account backend reachable** — the home still renders; only the online/
  friends actions need the server, and they already handle failure with the
  existing alert.

## Testing

The app has no DOM-test harness; UI is verified manually, and pure logic is unit
tested. Accordingly:

- **Keep** the existing engine/AI/store tests green.
- **Preserve `onStart` contracts:** the config objects `HomeScreen` emits for AI
  and PvP must be byte-for-byte what `Menu` emits today (same `mode`, `aiLevel`,
  `aiColor`, `humanColor`, `time` shapes). If `TIME_PRESETS` or the config logic
  moves, add a small unit test asserting the produced config for a couple of
  selections, so the relocation can't silently change behavior.
- **Manual verification:** each card and nav item reaches the right screen; Play
  Bots / Pass & Play start a game with the chosen options; decorative board
  renders; responsive stacking works at wide/medium/narrow widths; logged-in vs
  logged-out states show the right account UI and hints.

## Phasing

- **Phase 1 (this spec):** the home screen becomes the three-column dark shell with
  the nav, decorative board, and action cards wired to real features; `Menu`
  retired into `HomeScreen`.
- **Phase 2 (later, separate spec):** promote the sidebar to a **persistent shell**
  that stays mounted while other screens render in a content area, and restyle the
  in-game / Settings / Stats / Account screens into the same dark theme.

## Out of scope (YAGNI / no such feature)

- Puzzles, Learn courses, Train, Watch, Community, Coach, Tournaments, Chess
  Variants, Search, Leaderboard, Remove Ads, language switcher.
- Any change to game logic, the engine, online protocol, or the board renderer.
- Building the friends feature (separate plan) — only the `onPlayFriend` hook.
