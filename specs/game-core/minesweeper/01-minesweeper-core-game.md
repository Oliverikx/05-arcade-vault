# SPEC MINESWEEPER-01 — MINESWEEPER core game

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-10-22
> **Objective:** Build a new typed Minesweeper engine (no source game, no assets) playable at `/games/minesweeper/play` with progressive boards and a real Supabase leaderboard.

## Why this spec exists

There is no source game and no starter in `resources/started-games/`. The catalog has no Minesweeper entry (`lib/games.ts` holds arkanoid, tetris, snake, asteroids, froggy). The platform already provides the generic registry with touch layouts (`lib/games/registry.ts`), `lib/games/engine-types.ts`, `components/game-screen.tsx`, React HUD, PAUSE/END/EXIT, GAME OVER modal, `TouchPad`, `saveScore` Server Action and DB-driven boards (specs 05–10). Missing: the engine, a catalog entry with cover, a registry entry and a `games` row for `minesweeper`.

`lib/games/registry.ts` and `engine-types.ts` already exist → this spec only adds a registry entry. New catalog entry → no rename step.

## Scope

**In:**

- Catalog: new entry `minesweeper` / `MINESWEEPER`, `cat: "PUZZLE"`, `color: "yellow"`, cover `cover-minesweeper` in `app/globals.css` (see Data model).
- Engine `lib/games/minesweeper/engine.ts` (split drawing into `lib/games/minesweeper/draw.ts` and board logic into `lib/games/minesweeper/board.ts`; pure functions, no canvas, if > ~400 lines). Mechanics:
  - Canvas 640×480: top strip 32 px (in-canvas MINES / TIME readout) + board area 640×448. Cells 32 px, board centered in the area.
  - Progressive boards (one level = one board): L1 10×8 / 10 mines, L2 14×10 / 24, L3 18×13 / 48, L4 20×14 / 60, L5+ 20×14 / `min(90, 60 + 5 × (level − 4))`.
  - Mines are placed on the first reveal, excluding the clicked cell and its 8 neighbors (first click is always a zero → opens an area).
  - Reveal: flood-fills zero cells (iterative, no recursion). Flagged cells are never revealed by flood or chord.
  - Flag: toggles a flag on a hidden cell. No question-mark state. Flags may exceed mine count (MINES readout may go negative, shown as `-01`).
  - Chord: reveal on an already revealed number whose adjacent flag count equals the number reveals all its unflagged hidden neighbors (a wrong flag can therefore detonate a mine).
  - Revealing a mine → game over: all mines shown, wrong flags crossed, hit mine highlighted; `onGameOver(score)` fires after 1000 ms of simulated time (end-of-run animation). No lives.
  - Board cleared (all non-mine cells revealed) → `clear` state for 1500 ms (banner `BOARD CLEARED`), then next level, back to `ready` for that board.
  - Scoring: +10 × level per safe cell revealed (each flood cell counts); on clear +500 × level + 2 × `max(0, 300 − seconds)` where `seconds` = whole seconds elapsed on that board.
  - Timer starts on first reveal of each board, counts simulated time only (frozen while paused or between boards), shown as `TIME 000` (max 999).
- Input:
  - Mouse: left click reveal (or chord on a revealed number), right click flag (`contextmenu` prevented on the canvas), long press 450 ms (pointer, any type) flags. A press/click also moves the keyboard cursor to that cell.
  - Keyboard: arrows / `WASD` move a cursor (clamped, no wrap), `Space` reveals/chords at the cursor, `F` flags at the cursor. Cursor drawn only after first keyboard use; hover highlight on mouse move.
  - Starts from `ready` with the first reveal (click, `Space`) or any arrow/`WASD` key moving the cursor (does not reveal).
- States `ready` → `playing` → `clear` → (next board `ready`) or `gameover`, plus `paused` flag. Ready text `CLICK OR PRESS SPACE TO START` (only on board 1; later boards show `LEVEL N` + same hint).
- Touch (inherited platform layout): D-pad (4 dirs) moves cursor, buttons `REVEAL` (`Space`) and `FLAG` (`KeyF`); tapping the canvas reveals, long press flags.
- React HUD from callbacks: Player, Score, Lives (`—`), Level. MINES and TIME are drawn in the canvas strip (they are not platform HUD fields).
- Neon palette (table below), `shadowBlur` ≤ 8.
- Pause: button, `P`, `Esc`, tab hidden. END → modal. PLAY AGAIN → ready (score 0, level 1, board 1).
- English strings only.
- Registry entry: no lives, touch layout above; mouse-capable so no `KEYBOARD REQUIRED` note (field does not exist in registry any more).
- Leaderboard: migration `add_minesweeper_leaderboard` inserting the `games` row; SAVE SCORE enabled; Hall tab, detail board, card best and home feeds appear automatically.

**Out of scope (for future specs):** sound, hints / assists, difficulty selector or fixed classic boards, skins, question-mark flags, per-board best time, no-guess boards, auth, anti-cheat, realtime, other games' engines.

## Data model

```ts
// lib/games/engine-types.ts (exists, unchanged)
export interface GameCallbacks {
  onScore(score: number): void;
  onLives(lives: number): void;
  onLevel(level: number): void;
  onGameOver(finalScore: number): void;
}
export interface GameEngine {
  setPaused(paused: boolean): void;
  end(): void;
  reset(): void;
  destroy(): void;
}

// lib/games/minesweeper/board.ts (pure, no DOM)
export interface BoardSpec {
  cols: number;
  rows: number;
  mines: number;
}
export function boardForLevel(level: number): BoardSpec;
export interface Cell {
  mine: boolean;
  adj: number;
  revealed: boolean;
  flagged: boolean;
}
export function placeMines(
  cells: Cell[],
  spec: BoardSpec,
  safeIndex: number,
  rng: () => number,
): void;
export function reveal(
  cells: Cell[],
  spec: BoardSpec,
  index: number,
): { opened: number; hitMine: boolean };
export function chord(
  cells: Cell[],
  spec: BoardSpec,
  index: number,
): { opened: number; hitMine: boolean };

// lib/games/minesweeper/engine.ts
export function createMinesweeperGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameEngine;

// lib/games/registry.ts — new entry
// minesweeper: {
//   create: createMinesweeperGame, width: 640, height: 480, lives: null,
//   touch: {
//     dpad: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"],
//     buttons: [{ label: "REVEAL", code: "Space" }, { label: "FLAG", code: "KeyF" }],
//     repeat: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"],
//   },
// }
```

**Constants:**

| Constant         | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Canvas           | 640×480                                                                                    |
| Strip            | 32 px tall at top; board area 640×448 below                                                |
| Cell             | 32 px                                                                                      |
| Boards           | L1 10×8/10, L2 14×10/24, L3 18×13/48, L4 20×14/60, L5+ 20×14/`min(90, 60+5(L−4))`          |
| Safe first click | clicked cell + 8 neighbors mine-free                                                       |
| Cell points      | `10 × level` per safe cell revealed                                                        |
| Clear bonus      | `500 × level + 2 × max(0, 300 − seconds)`                                                  |
| Timer            | simulated ms, whole seconds, cap 999, starts on first reveal                               |
| Long press       | 450 ms, cancelled if pointer moves > 8 px                                                  |
| Loss delay       | 1000 ms before `onGameOver`                                                                |
| Clear banner     | 1500 ms                                                                                    |
| Loop             | fixed step `1000/60`, accumulator, frame delta capped at 100 ms                            |
| Max score        | far below limit (level 20 board ≈ 190 × 200 + bonus < 100,000); clamp 0..10,000,000 anyway |

**Palette:**

| Element              | Color                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| Background           | `#000`                                                                                 |
| Hidden cell          | fill `#15151f`, 1 px border `#4a4f70`                                                  |
| Hover / cursor       | border `#f5ff00` (yellow), glow 6                                                      |
| Revealed cell        | fill `#05050a`, border `#e6e9ff` at 6% alpha                                           |
| Numbers 1..8         | `#00f5ff`, `#00ff88`, `#ff006e`, `#f5ff00`, `#d97a3a`, `#ffcf3a`, `#c7d0e0`, `#e6e9ff` |
| Flag                 | `#f5ff00` pennant                                                                      |
| Mine                 | `#ff006e` disc with spikes, glow 8; hit mine ringed `#e6e9ff`                          |
| Wrong flag           | flag + `#ff006e` cross                                                                 |
| Strip text / banners | `#e6e9ff`, `--pixel` font; hint at 70% alpha                                           |

**Catalog entry** (new, after `froggy`):

```ts
{ id: "minesweeper", title: "MINESWEEPER", cover: "cover-minesweeper", cat: "PUZZLE", color: "yellow", plays: "5.2K",
  short: "Read the numbers. Flag the mines. Don't blink.",
  long: "A hidden field of neon mines and only the numbers to guide you. Reveal safe cells, flag the danger and clear the board before the clock runs away. Every cleared board unlocks a bigger, deadlier one. One mine ends the run." }
```

`.cover-minesweeper` (in `app/globals.css`, following `.cover-snake` pattern): dark gradient `#1a1a00 → #0a0a18`, `::after` with a small grid of squares (`#15151f` tiles, a few cyan/green/magenta digits via gradients) and one magenta disc. Use `/frontend-design`.

**Migration** `add_minesweeper_leaderboard`:

```sql
insert into public.games (id, title) values ('minesweeper', 'MINESWEEPER');
```

Callbacks fire only on change (score on reveal/clear, level on new board; `onLives` never fires, registry `lives: null`). `onGameOver` fires once per run (mine hit after delay, or `end()` immediately).

**Input handling:** keys on `document`; pointer events and `contextmenu` on the canvas. Ignore keys when target is `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON`, when paused and in `gameover`/`clear`. `preventDefault` on arrows/Space only while mounted. Pointer coordinates are mapped with `getBoundingClientRect()` (canvas is CSS-scaled). `blur` cancels any pending long press.

Conventions: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`) before writing code. Engine framework-free; only `components/game-screen.tsx` touches React. Engine created in `useEffect`, safe under Strict Mode. Use `/frontend-design` for cover art. Reuse `.crt`, `.player-hud`, `.modal`, `.btn`.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. Catalog entry `minesweeper` + `.cover-minesweeper` in `app/globals.css`. Check: `/games` shows card, `/games/minesweeper` renders (practice player, fake ticker).
2. `lib/games/minesweeper/board.ts`: `boardForLevel`, `placeMines` (safe zone), `reveal` (iterative flood), `chord`. Check: build + lint; temporary console assertions removed before commit (first click never a mine, flood skips flags).
3. `lib/games/minesweeper/draw.ts`: strip, cells, numbers, flag, mine, cursor/hover, banners. Check: build + lint.
4. Engine `engine.ts`: fixed-step loop, states, timer, scoring, mouse + keyboard + long-press input, loss delay, clear → next board, callbacks, score clamp, `setPaused`/`end`/`reset`/`destroy`. Check: build + lint.
5. Register `minesweeper` in `lib/games/registry.ts`. Check: playable at `/games/minesweeper/play`; HUD Score/Level update, Lives `—`.
6. Pause/END/PLAY AGAIN flows + palette + touch layout check. Check: Playwright screenshots (ready, playing mid-board, flags, game over with mines, clear banner, 390px touch view) saved to `.playwright-mcp/screenshots`.
7. Apply migration `add_minesweeper_leaderboard` via Supabase MCP `apply_migration`. Check: `execute_sql` shows the row; saving a run inserts a score; Hall MINESWEEPER tab appears.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `/games/minesweeper/play` shows a 640×480 canvas in `.crt-screen` with `CLICK OR PRESS SPACE TO START`; 10×8 hidden board centered; strip shows `MINES 010` and `TIME 000`.
- [ ] First reveal never hits a mine and always opens a zero cell (clicked cell + 8 neighbors mine-free); timer starts then.
- [ ] Left click reveals, right click flags/unflags (no browser context menu on canvas), long press 450 ms flags.
- [ ] Arrows/`WASD` move the cursor (clamped), `Space` reveals, `F` flags; arrows/Space do not scroll the page.
- [ ] Zero cells flood-fill; flagged cells are never revealed by flood.
- [ ] Chord on a satisfied number reveals its unflagged neighbors; a wrong flag can detonate.
- [ ] MINES readout equals mines − flags (can show `-01`).
- [ ] Scoring: each safe cell adds exactly `10 × level` to HUD score; clear adds `500 × level + 2 × max(0, 300 − seconds)`.
- [ ] Clearing board 1 shows `BOARD CLEARED` for 1500 ms, Level HUD becomes `02`, board is 14×10 with 24 mines, ready for first click; timer reset.
- [ ] Boards: L3 18×13/48, L4 20×14/60, L5 20×14/65, capped at 90 mines.
- [ ] Revealing a mine shows all mines, crossed wrong flags and the hit mine; GAME OVER modal opens 1000 ms later with the engine's final score. Lives HUD shows `—`.
- [ ] PAUSE button, `P`, `Esc` freeze timer and input and show PAUSED; same key resumes; tab switch pauses; clicks while paused do nothing.
- [ ] END opens GAME OVER immediately with current score.
- [ ] PLAY AGAIN returns to ready: score 0, level 1, 10×8 board.
- [ ] Touch (390px): D-pad moves cursor, `REVEAL`/`FLAG` buttons work, tap reveals, long press flags, no horizontal scroll, canvas scales.
- [ ] Leaving the page stops rAF and removes listeners; no console errors.
- [ ] Colors match the palette table; `shadowBlur` ≤ 8; no Spanish strings in code or comments.
- [ ] Typing in the SAVE SCORE input does not move the cursor or reveal.
- [ ] `public.games` contains row `minesweeper` / `MINESWEEPER`.
- [ ] SAVE SCORE inserts one `scores` row (`game_id = 'minesweeper'`, uppercase name, modal score), verified with `execute_sql`.
- [ ] Hall of Fame has a `MINESWEEPER` tab (catalog order) showing the saved score.
- [ ] `/games/minesweeper` TOP SCORES and Global best read from Supabase; empty state links to `/games/minesweeper/play`.
- [ ] Library card BEST SCORE for `minesweeper` equals DB max; GLOBAL totals count it.
- [ ] Other games unchanged.
- [ ] No hydration warnings on `/`, `/games`, `/hall-of-fame`, `/games/minesweeper`, `/games/minesweeper/play`.

## Decisions

- **Yes:** New catalog entry `minesweeper`, `PUZZLE`, `yellow` (no placeholder fits; yellow has only one game). Discarded: reusing a placeholder, `ARCADE` category.
- **Yes:** 640×480 with 32 px strip and 32 px cells; boards up to 20×14. Discarded: 800×600 with 40 px grid, 16×16 expert board (too small on mobile).
- **Yes:** Progressive boards as levels, endless, one mine = game over, `lives: null`. Discarded: 3 lives (trivializes guessing), fixed Beginner/Intermediate/Expert (leaderboard would mix difficulties; goes to a future spec).
- **Yes:** Score `10 × level` per cell + clear and time bonus; rewards progress and speed on a single comparable board. Discarded: time-only score (not integer-friendly for boards), flat points.
- **Yes:** First click always safe incl. neighbors. Discarded: classic risky first click, no-guess solver boards (too costly).
- **Yes:** Chord supported; no question marks. Discarded: `?` state (adds input noise).
- **Yes:** MINES/TIME drawn in canvas strip because the platform HUD has no such fields. Discarded: extending `GameCallbacks`, extending the React HUD (touches every game).
- **Yes:** Mouse + keyboard cursor + touch D-pad and long press; registry touch layout provided. Discarded: mouse only (breaks mobile parity), `KEYBOARD REQUIRED` note (game is mouse-playable).
- **Yes:** 1000 ms loss delay so the player sees the mines. Discarded: instant modal.
- **No:** Sound, hints, skins (specs 02, 03 and skin-designer).
- **Yes (inherited):** framework-free TS engine with `destroy()`; ready screen; platform HUD/modal replace in-game ones; PAUSE button + `P`/`Esc` + tab-hidden auto-pause; English strings; neon palette; `saveScore` Server Action; `games` row = has leaderboard; Hall tab, detail board, card best automatic; generic registry entry, no per-id branching in engine wiring; no fake data.
- **Yes:** Score clamp 0..10,000,000.

## Risks

| Risk                                                | Mitigation                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Strict Mode double effect → two loops / listeners   | `destroy()` cancels rAF, removes listeners and long-press timer.             |
| Canvas CSS scaling breaks hit testing               | Map pointer via `getBoundingClientRect()` ratio, never raw `offsetX`.        |
| Recursive flood fill overflows on big boards        | Iterative stack in `board.ts`.                                               |
| Long press also fires a click on release            | Flag a `longPressFired` boolean and swallow the following click.             |
| Browser context menu / text selection on touch      | `contextmenu` + `touch-action: none` on canvas, `preventDefault` on pointer. |
| Pause time counted in timer                         | Timer advances only in `update()`, frozen while paused.                      |
| Unwinnable-feeling boards (guess needed)            | Accepted; safe first click only. No-guess generator is a future spec.        |
| Arrow/Space scrolls page or blocks SAVE SCORE input | `preventDefault` only while mounted, ignore `INPUT` targets and `gameover`.  |

## What is **not** in this spec

- Sound, hints / assists, difficulty selector or fixed classic boards, skins, question-mark flags, per-board best time, no-guess boards.
- Auth, anti-cheat, realtime, other games' engines.

_Each one, if it lands, goes in its own spec._
