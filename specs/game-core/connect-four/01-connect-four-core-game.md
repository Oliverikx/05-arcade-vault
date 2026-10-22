# SPEC CONNECT-FOUR-01 — CONNECT FOUR core game

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-10-22
> **Objective:** Build a new typed Connect Four engine (7×6 board vs a minimax CPU, no source game) playable at `/games/connect-four/play` with a real Supabase leaderboard.

## Why this spec exists

There is no source game and no assets: the board, discs and CPU are built from scratch in vector neon. The catalog has no Connect Four entry and no free placeholder (all six entries are real or taken: `arkanoid`, `tetris`, `snake`, `asteroids`, `froggy`, `minesweeper`). The platform already provides the generic registry (`lib/games/registry.ts`, `lib/games/engine-types.ts`, `components/game-screen.tsx`), React HUD, PAUSE/END/EXIT, GAME OVER modal, `saveScore` Server Action and DB-driven boards. Missing: the engine, a catalog entry with cover, a registry entry (with a `touch` layout, required by `EngineEntry`) and a `games` row for `connect-four`.

`lib/games/registry.ts` already exists → this spec only adds a registry entry. A run is a series of rounds against the CPU: each win scores points and raises the CPU search depth; each loss or draw costs a life.

## Scope

**In:**

- Catalog: new entry `connect-four` / `CONNECT FOUR` in `lib/games.ts` (`cat: "PUZZLE"`, `color: "cyan"`), plus `.cover-connect-four` in `app/globals.css` (see Data model).
- Engine `lib/games/connect-four/engine.ts`, split into `board.ts` (pure board logic), `ai.ts` (minimax) and `draw.ts` (rendering):
  - Board 7 columns × 6 rows, gravity; cell 64 px on a 640×480 canvas.
  - A run is a series of **rounds**. The player (cyan discs) always moves first, the CPU (magenta discs) second.
  - Controls: `←` / `→` (and `A` / `D`) move the column cursor (no wrap); `↓` / `Space` (and `S`) drop the disc. Dropping into a full column is ignored.
  - Drop animation: constant gravity `6000 px/s²`, no bounce; input locked while a disc falls and during the CPU turn.
  - CPU: negamax with alpha-beta pruning, search depth = current level (1..6), columns ordered center-out, random pick among equally best columns. CPU "thinks" for `CPU_DELAY_MS = 450` of simulated time before dropping.
  - Round end: 4 in a row (horizontal, vertical, both diagonals) or full board. The 4 winning discs pulse. Result banner `YOU WIN` / `YOU LOSE` / `DRAW` plus `PRESS SPACE FOR NEXT ROUND`.
  - Win: `roundScore = max(0, 1000 − 20 × playerMoves)` added to the score, `playerMoves` = discs the player dropped in that round including the winning one (range 580..980). Level +1 (cap 6).
  - Loss or draw: −1 life, score and level kept; the same level is replayed.
  - 0 lives → banner stays `CPU_END_MS = 1500` then `onGameOver(score)`.
  - Level = CPU depth, starts at 1, `min(6, 1 + wins)`; at level 6 further wins keep depth 6 (endless until lives run out).
- Fixed-step loop `STEP_MS = 1000/60` with accumulator, frame delta capped at 100 ms; all timing (drop, CPU delay, end delay, pulse) in `update()`, frozen while paused.
- No globals: engine owns canvas, state, rAF loop, listeners; `destroy()` removes all.
- States `ready` → `playing` → `gameover`, plus `paused` flag; `playing` has sub-states `aiming`, `falling`, `cpu`, `roundover`. Ready text `PRESS SPACE TO START`.
- Controls to start: `Space`, `↓` or click on the canvas starts from `ready`. In `roundover` only `Space` / `↓` / click continues. Click is ignored while paused and in `gameover`.
- In-canvas status line (not a HUD duplicate): `YOUR TURN` / `CPU THINKING` / `ROUND N` text only; Score, Lives, Level live in the React HUD.
- React HUD from callbacks: Player, Score, Lives (starts 3), Level.
- Neon palette (table below), `shadowBlur` ≤ 8.
- Pause: button, `P`, `Esc`, tab hidden. END → modal. PLAY AGAIN → ready (score 0, 3 lives, level 1).
- Registry `touch` layout (shared `TouchPad`, no new component).
- English strings only.
- Leaderboard: migration `add_connect-four_leaderboard`'s equivalent `add_connect_four_leaderboard` inserting the `games` row; SAVE SCORE enabled; Hall tab, detail board, card best and home feeds appear automatically.

**Out of scope (for future specs):** hint key and win-streak bonus (SPEC CONNECT-FOUR-02), mouse column hover/click-to-drop and sound (SPEC CONNECT-FOUR-03), skins, extra touch tuning, alternating first mover, board sizes other than 7×6, two-player mode, difficulty select, undo, auth, anti-cheat, realtime, other games' engines.

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

// lib/games/connect-four/board.ts
export type Cell = 0 | 1 | 2; // 0 empty, 1 player, 2 CPU
export const COLS = 7;
export const ROWS = 6;
export type Board = Cell[][]; // [col][row], row 0 = bottom
export function dropRow(board: Board, col: number): number; // -1 if full
export function findWin(board: Board): [number, number][] | null; // 4 cells or null
export function isFull(board: Board): boolean;

// lib/games/connect-four/ai.ts
export function bestColumn(board: Board, depth: number): number;

// lib/games/connect-four/engine.ts
export function createConnectFourGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameEngine;

// lib/games/registry.ts — new entry (key quoted because of the hyphen)
// "connect-four": {
//   create: createConnectFourGame, width: 640, height: 480, lives: 3,
//   touch: {
//     dpad: ["ArrowLeft", "ArrowRight", "ArrowDown"],
//     buttons: [{ label: "DROP", code: "Space" }],
//     repeat: ["ArrowLeft", "ArrowRight"],
//   },
// }
```

**Constants:**

| Constant        | Value                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas          | 640×480                                                                                                                                                   |
| Board           | 7 cols × 6 rows, cell 64 px, 448×384 at origin (96, 64); cursor row y 0..64                                                                               |
| Disc radius     | 26 px (6 px inner margin)                                                                                                                                 |
| Lives           | 3                                                                                                                                                         |
| Win score       | `max(0, 1000 − 20 × playerMoves)` (580..980)                                                                                                              |
| Level / depth   | starts 1, +1 per win, cap 6; CPU depth = level                                                                                                            |
| Gravity         | 6000 px/s², no bounce (full column fall ≈ 0.36 s)                                                                                                         |
| CPU delay       | 450 ms before the CPU drops                                                                                                                               |
| Game-over delay | 1500 ms after the last life is lost                                                                                                                       |
| AI evaluation   | terminal win ±100000 (minus ply for faster wins); each 4-window: own 4 → win, 3+1 empty +5, 2+2 empty +2, opp 3+1 empty −4; center column +3 per own disc |
| Max moves/round | 21 player discs (42 cells)                                                                                                                                |
| Max score       | clamp 0..10,000,000 anyway (real runs are far below)                                                                                                      |

**Palette:**

| Element              | Color                                                                |
| -------------------- | -------------------------------------------------------------------- |
| Background           | `#000`                                                               |
| Board frame          | `#00f5ff` at 35% alpha border, fill `#0f0f18`                        |
| Empty slot           | `#15151f`, 1 px `#4a4f70` ring                                       |
| Player disc          | `#00f5ff` (cyan), glow 8                                             |
| CPU disc             | `#ff006e` (magenta), glow 8                                          |
| Cursor ghost disc    | `#00f5ff` at 50% alpha                                               |
| Winning discs pulse  | `#e6e9ff`, ring alpha 40%..100% at 2 Hz, glow 8                      |
| Status / banner text | `#e6e9ff`, `--pixel` font; `YOU LOSE` `#ff006e`, `YOU WIN` `#00ff88` |

**Catalog entry:**

```ts
{ id: "connect-four", title: "CONNECT FOUR", cover: "cover-connect-four", cat: "PUZZLE", color: "cyan", plays: "3.4K",
  short: "Line up four before the machine does.",
  long: "Drop glowing discs into a seven-column grid and line up four before the CPU does. Every win makes the machine think deeper, from a single move ahead to six. Faster wins score more. Lose or draw a round and you lose a life; three lives and the run is over." }
```

**Cover** `.cover-connect-four`: dark `--bg-2` base with a 7×6 dot grid built from `radial-gradient` (cyan and magenta discs, a few empty), cyan frame glow ≤ 8 px, same structure as `.cover-froggy` / `.cover-minesweeper`. Design with `/frontend-design`.

**Migration** `add_connect_four_leaderboard`:

```sql
insert into public.games (id, title) values ('connect-four', 'CONNECT FOUR');
```

Callbacks fire only on change (score on win, lives on loss/draw, level on level change). `onGameOver` fires once per run (lives out or `end()`).

**Input handling:** engine listens to keys on `document`, click on the canvas. Ignore keys when target is `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON`, when paused and in `gameover`; `preventDefault` on arrows/Space only while mounted. `blur` clears held-key state. Cursor starts each round at column 3. Cursor moves are accepted only in `aiming`.

Conventions: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`) before writing code. Engine framework-free; only `components/game-screen.tsx` touches React. Engine created in `useEffect`, safe under Strict Mode. Use `/frontend-design` for cover CSS. Reuse `.crt`, `.player-hud`, `.modal`, `.btn`.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. Catalog entry `connect-four` in `lib/games.ts` + `.cover-connect-four` in `app/globals.css`. Check: `/games` shows the card, `/games/connect-four` renders (fake player: practice note).
2. Pure logic `lib/games/connect-four/board.ts` (`dropRow`, `findWin`, `isFull`). Check: build + lint; manual node check of 4 directions and full board.
3. `lib/games/connect-four/ai.ts`: negamax + alpha-beta, center-out ordering, random tie-break, evaluation per table. Check: build + lint; depth 6 from an empty board returns in < 100 ms; depth ≥ 2 blocks an immediate player win and takes an immediate own win.
4. `lib/games/connect-four/draw.ts` + `engine.ts`: fixed-step loop, cursor, drop animation, CPU turn, round end, win pulse, scoring, lives, levels, `ready`, `setPaused`, `end`, `reset`, `destroy`, callbacks, score clamp. Check: build + lint.
5. Register `connect-four` in `lib/games/registry.ts` with the `touch` layout. Check: playable at `/games/connect-four/play`; HUD Score/Lives/Level update; touch pad shows ← → ↓ + DROP.
6. Pause/END/PLAY AGAIN flows + palette check. Check: Playwright screenshots (ready, aiming, falling, win banner, lose banner, draw banner, paused, game over) saved to `.playwright-mcp/screenshots`.
7. Apply migration `add_connect_four_leaderboard` via Supabase MCP `apply_migration`. Check: `execute_sql` shows the row; saving a run inserts a score; Hall CONNECT FOUR tab appears.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `/games/connect-four/play` shows a 640×480 canvas in `.crt-screen` with `PRESS SPACE TO START`; no disc can be dropped before start.
- [ ] Board is 7 columns × 6 rows; discs stack from the bottom; a full column ignores the drop.
- [ ] Controls: `←` `→` / `A` `D` move the cursor (clamped at columns 0 and 6); `↓` / `Space` / `S` drop; arrows/Space do not scroll the page.
- [ ] Player always moves first; input is ignored while a disc falls and during the CPU turn.
- [ ] CPU waits 450 ms of simulated time before dropping; no CPU move happens while paused.
- [ ] Horizontal, vertical, ascending-diagonal and descending-diagonal fours are all detected; the 4 discs pulse.
- [ ] Win in 10 player moves adds exactly 800 to the HUD score; win in 4 moves adds 920; win in 21 moves adds 580.
- [ ] After a win Level HUD goes `01` → `02` and the CPU searches depth 2; Level never exceeds `06`.
- [ ] At level 1 the CPU searches depth 1; at level 6 depth 6; depth 6 move computes in < 100 ms.
- [ ] Loss or draw: Lives HUD 3 → 2, score and level unchanged, same level replayed.
- [ ] With 0 lives the banner shows 1500 ms, then GAME OVER with the engine's final score.
- [ ] `PRESS SPACE FOR NEXT ROUND` starts a fresh empty board with cursor at column 3.
- [ ] PAUSE button, `P`, `Esc` freeze and show PAUSED; same key resumes; tab switch pauses; keys/click while paused do nothing to the game.
- [ ] END opens GAME OVER with the engine's final score.
- [ ] PLAY AGAIN returns to ready with score 0, 3 lives, level 1.
- [ ] Leaving the page stops rAF and removes listeners; no console errors.
- [ ] Colors match the palette table; `shadowBlur` ≤ 8; no Spanish strings.
- [ ] Typing in the SAVE SCORE input does not move the cursor or drop discs.
- [ ] Touch layout shows `←` `→` `↓` and a `DROP` button.
- [ ] `public.games` contains row `connect-four` / `CONNECT FOUR`.
- [ ] SAVE SCORE inserts one `scores` row (`game_id = 'connect-four'`, uppercase name, modal score), verified with `execute_sql`.
- [ ] Hall of Fame tabs are `GLOBAL` + real games in catalog order, including `CONNECT FOUR`; its tab shows the saved score.
- [ ] `/games/connect-four` TOP SCORES and Global best read from Supabase; empty state before any score, linking to `/games/connect-four/play`.
- [ ] Library card BEST SCORE for `connect-four` equals DB max.
- [ ] GLOBAL totals count `connect-four` in `games`.
- [ ] Other games unchanged.
- [ ] No hydration warnings on `/`, `/games`, `/hall-of-fame`, `/games/connect-four`, `/games/connect-four/play`.
- [ ] At 390px width the canvas scales with no horizontal scroll.

## Decisions

- **Yes:** New catalog entry `connect-four`; no placeholder fits (none free). Category `PUZZLE` (turn-based strategy), accent `cyan`. Discarded: `ARCADE`, reusing an existing slot.
- **Yes:** 640×480, 64 px cells, board 448×384 plus cursor row. Discarded: 800×600 (board would just get bigger, no gain).
- **Yes:** Run = series of rounds; win = points + deeper CPU, loss/draw = −1 life. Lives HUD starts at 3. Discarded: single game per run, `lives: null`.
- **Yes:** Level = CPU depth 1..6, +1 per win only, stays at 6 afterwards. Discarded: level up on loss/draw too, loop back to 1.
- **Yes:** Score `1000 − 20 × playerMoves` (floor 0), per request; moves count the winning disc. Discarded: bonus per remaining life, flat 1000.
- **Yes:** Player always starts. Discarded: alternating first mover (changes the score balance and needs an extra rule).
- **Yes:** Negamax + alpha-beta with center-out ordering and random tie-break; synchronous (depth 6 on 7 columns is well under 100 ms). Discarded: Web Worker, iterative deepening, transposition table.
- **Yes:** Keyboard only plus click-to-start; touch via the registry `touch` layout (required by `EngineEntry`). Discarded: mouse column pick (SPEC 03).
- **Yes:** The registry has no `keyboardRequired` field any more; the touch pad covers mobile, so no KEYBOARD REQUIRED note.
- **Yes:** Vector-only art, no assets, no `public/games/connect-four/`. Discarded: sprite discs.
- **No:** Sound in this spec (SPEC 03).
- **Yes (inherited):** framework-free TS engine with `destroy()`; ready screen; platform HUD/modal replace in-game ones; PAUSE button + `P`/`Esc` + tab-hidden auto-pause; English strings; neon palette; `saveScore` Server Action; `games` row = has leaderboard; Hall tab, detail board, card best automatic; generic registry entry, no per-id branching in engine wiring; no fake data.
- **Yes:** Score clamp 0..10,000,000.

## Risks

| Risk                                                      | Mitigation                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Strict Mode double effect → two loops                     | `destroy()` cancels rAF and removes listeners.                              |
| Hyphenated id as object key / CSS class                   | Quote the registry key; class `.cover-connect-four` matches `cover-${id}`.  |
| Depth 1 CPU looks broken (ignores threats)                | Intended; level 1 is the easy tier. Depth ≥ 2 blocks immediate wins.        |
| CPU search blocks the main thread                         | Depth ≤ 6 on 7 columns with pruning; acceptance check < 100 ms.             |
| Pause during CPU delay or end delay                       | All timers advance only in `update()`, frozen while paused.                 |
| Space held from the previous round drops a disc instantly | Round restart consumes the key; drop needs a fresh key press in `aiming`.   |
| Arrow/Space scrolls page or blocks SAVE SCORE input       | `preventDefault` only while mounted, ignore `INPUT` targets and `gameover`. |
| Hyphenated game id in `scores`/`games`                    | `games.id` is text; `saveScore` validates only existence. Verify via SQL.   |
| Score outside DB range                                    | Clamp 0..10,000,000.                                                        |

## What is **not** in this spec

- Hint key and win-streak bonus, mouse column hover/click-to-drop, sound, skins.
- Alternating first mover, other board sizes, two-player mode, difficulty select, undo.
- Auth, anti-cheat, realtime, other games' engines.

_Each one, if it lands, goes in its own spec._
