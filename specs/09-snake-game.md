# SPEC 09 — SNAKE game integration

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-10-20
> **Objective:** Build a new typed Snake engine (no source game) using the fruit sprites in `resources/source-assets/snake-assets`, playable at `/games/snake/play` with a real Supabase leaderboard.

## Why this spec exists

There is no source game: `resources/source-assets/snake-assets` holds only `fruits.png` (3790×442 spritesheet, 3 rows of 22 fruits) and `sprites.js` (global `window.SPRITE_ATLAS`, Spanish comments, coordinates for the pixel-art row `y=136–295`). The catalog already has a placeholder `snake` / `SNAKE` entry (`lib/games.ts`, cover `cover-snake` in `app/globals.css`, fake score ticker in the player). The platform already provides the generic registry (`lib/games/registry.ts`, `lib/games/engine-types.ts`, `components/game-screen.tsx`), React HUD, PAUSE/END/EXIT, GAME OVER modal, `saveScore` Server Action and DB-driven boards (specs 05–08). Missing: the engine, the sprite atlas as typed code, a registry entry and a `games` row for `snake`.

`lib/games/registry.ts` already exists (SPEC 07, 08) → this spec only adds a registry entry. Catalog slot reused → no rename step.

## Scope

**In:**

- Catalog: keep entry `snake` / `SNAKE`, `cover-snake`, `cat: "ARCADE"`, `color: "green"`, `plays`; update only `short` and `long` copy (fruits instead of magenta cores; see Data model).
- Engine `lib/games/snake/engine.ts` (split atlas into `lib/games/snake/sprites.ts` and drawing into `lib/games/snake/draw.ts` if > ~400 lines). New game mechanics:
  - Grid 20×15 cells of 32 px on a 640×480 canvas.
  - Fixed-step loop `STEP_MS = 1000/60` with accumulator, frame delta capped at 100 ms; all timing in `update()`. The snake advances one cell each time `tickMs` of simulated time has accumulated.
  - Start: length 3, centered, heading right.
  - Steering by `←↑→↓` / `WASD`; reversing 180° is ignored; input queue of max 2 pending turns, consumed one per tick.
  - Exactly one fruit on the board, spawned on a random free cell (never on the snake); each spawn picks a random fruit from the atlas, different from the previous one.
  - Eating a fruit: +10 score, snake grows by 1 (tail kept on next tick), new fruit spawns.
  - Level = `1 + floor(fruitsEaten / 5)`; `tickMs = max(60, 150 − 10 × (level − 1))`.
  - Hitting a wall or the snake's own body: −1 life. Lives > 0 → snake resets to length 3, centered, heading right, and waits in a `serve` sub-state (shows hint) until the first steering key / `Space` / click; score, fruits eaten and level are kept, the fruit stays where it is (re-spawned if the reset snake covers it). Lives 0 → game over.
  - Board full (snake length 300) = win → `onGameOver(score)`.
- Fruit art: copy `resources/source-assets/snake-assets/fruits.png` to `public/games/snake/fruits.png`; port `sprites.js` to a typed const in `lib/games/snake/sprites.ts` (22 fruits from the `y=136`, `h=160` row, same `x`/`w` values, no `window` global, English comments). Each fruit is drawn scaled to fit a 28×28 box preserving aspect ratio, centered in its 32 px cell, `imageSmoothingEnabled = false`. Until the image loads (or if it fails) the fruit is drawn as a `#ff006e` rounded square so the game never blocks on assets.
- Snake body in vector neon (no snake sprites exist); subtle grid lines.
- No globals: engine owns canvas, state, image, rAF loop, listeners; `destroy()` removes all.
- States `ready` → `playing` → `gameover`, plus `paused` flag; `playing` has a `serve` sub-state (after a lost life). Ready text `PRESS ARROW KEY OR SPACE TO START`; serve hint `PRESS ARROW KEY TO CONTINUE`.
- Controls: arrows/`WASD` steer; any steering key (except the reverse one), `Space` or left click on canvas starts from `ready`/`serve`. Click/Space ignored while paused and in `gameover`.
- React HUD from callbacks: Player, Score, Lives (starts 3), Level. No in-canvas HUD.
- Neon recolor to platform palette (table below), `shadowBlur` ≤ 8.
- Pause: button, `P`, `Esc`, tab hidden. END → modal. PLAY AGAIN → ready (score 0, 3 lives, level 1).
- English strings only.
- Registry `keyboardRequired: true` → platform shows `KEYBOARD REQUIRED` note.
- Leaderboard: migration `add_snake_leaderboard` inserting the `games` row; SAVE SCORE enabled; Hall tab, detail board, card best and home feeds appear automatically.

**Out of scope (for future specs):** sound/music, touch/swipe controls, golden/timed fruits and other power-ups, obstacles, wrap-around mode, multiple maps, auth, anti-cheat, realtime, other games' engines.

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

// lib/games/snake/sprites.ts
export interface Sprite {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const FRUIT_SHEET = "/games/snake/fruits.png";
export const FRUITS: Record<string, Sprite>; // 22 entries: banana … melon

// lib/games/snake/engine.ts
export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameEngine;

// lib/games/registry.ts — new entry
// snake: { create: createSnakeGame, width: 640, height: 480, lives: 3, keyboardRequired: true }
```

**Constants:**

| Constant       | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| Canvas         | 640×480                                                          |
| Grid           | 20 cols × 15 rows, cell 32 px (300 cells)                        |
| Start snake    | length 3, head at col 10 / row 7, heading right                  |
| Lives          | 3                                                                |
| Points         | 10 per fruit                                                     |
| Growth         | +1 segment per fruit                                             |
| Level          | `1 + floor(fruitsEaten / 5)`                                     |
| Tick           | `max(60, 150 − 10 × (level − 1))` ms (L1 150, L2 140, … L10+ 60) |
| Input queue    | max 2 pending turns, reversal ignored                            |
| Fruit draw box | 28×28 px centered in cell, aspect preserved                      |
| Max score      | 297 fruits × 10 = 2,970; clamp 0..10,000,000 anyway              |

**Palette:**

| Element            | Color                                  |
| ------------------ | -------------------------------------- |
| Background         | `#000`                                 |
| Grid lines         | `#e6e9ff` at 6% alpha                  |
| Snake head         | `#00ff88` (green), glow 8              |
| Snake body         | `#00ff88` at 70% alpha, 1 px gap       |
| Fruit fallback     | `#ff006e` (magenta)                    |
| Ready / serve hint | `#e6e9ff` at 70% alpha, `--pixel` font |

**Catalog entry** (only `short`/`long` change; `best` does not exist):

```ts
{ id: "snake", title: "SNAKE", cover: "cover-snake", cat: "ARCADE", color: "green", plays: "9.1K",
  short: "Eat the fruit. Don't bite your tail.",
  long: "A snake of light crawls a neon grid hunting fruit. Every bite makes it longer and the pace faster. Hit a wall or your own tail and you lose a life; three lives and the run is over." }
```

**Migration** `add_snake_leaderboard`:

```sql
insert into public.games (id, title) values ('snake', 'SNAKE');
```

Callbacks fire only on change (score per fruit, lives on loss, level on change). `onGameOver` fires once per run (lives out, board full, or `end()`).

**Input handling:** engine listens to keys on `document`, click on the canvas. Ignore keys when target is `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON`, when paused and in `gameover`; `preventDefault` on arrows/Space only while mounted. `blur` clears the input queue.

Conventions: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`, static files in `public/`) before writing code. Engine framework-free; only `components/game-screen.tsx` touches React. Engine created in `useEffect`, safe under Strict Mode. Use `/frontend-design` for any UI/CSS (cover art tweaks if needed). Reuse `.crt`, `.player-hud`, `.modal`, `.btn`.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. Catalog copy update for `snake` (`short`, `long`). Check: `/games/snake` renders (fake player still), `/games` card shows new copy.
2. Assets: copy `fruits.png` to `public/games/snake/fruits.png`; create `lib/games/snake/sprites.ts` (22 entries from `sprites.js`). Check: build + lint; file served at `/games/snake/fruits.png`.
3. Engine `lib/games/snake/engine.ts` (+ `draw.ts`): grid, fixed-step loop, steering queue, fruit spawn, growth, collision, lives/serve, levels/tick speed, win on full board, neon drawing with sprite + fallback. Check: build + lint.
4. Add `ready` state, `setPaused`, `end`, `reset`, `destroy`, callbacks, score clamp; no in-canvas HUD. Check: build + lint.
5. Register `snake` in `lib/games/registry.ts` (640×480, lives 3, `keyboardRequired: true`). Check: playable at `/games/snake/play`; HUD Score/Lives/Level update.
6. Pause/END/PLAY AGAIN flows + palette check. Check: Playwright screenshots (ready, playing with fruit, serve, paused, game over) saved to `.playwright-mcp/screenshots`.
7. Apply migration `add_snake_leaderboard` via Supabase MCP `apply_migration`. Check: `execute_sql` shows the row; saving a run inserts a score; Hall SNAKE tab appears.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `/games/snake/play` shows a 640×480 canvas in `.crt-screen` with `PRESS ARROW KEY OR SPACE TO START`; snake does not move before start.
- [ ] Controls: `←↑→↓` and `WASD` steer; `Space`/click start; arrows/Space do not scroll the page.
- [ ] Snake starts with length 3 heading right; pressing the opposite direction does not reverse it.
- [ ] Exactly one fruit is on the board at all times, never on the snake; fruit is drawn from `fruits.png` (not the fallback square) once loaded.
- [ ] Scoring: each fruit adds exactly 10 to the HUD score and grows the snake by 1.
- [ ] Level HUD: `01` at start, `02` after 5 fruits, `03` after 10; tick is 150 ms at L1, 140 ms at L2, never below 60 ms.
- [ ] Lives HUD starts at 3; wall or self hit → 2, snake resets to length 3 and waits for a key; score and level kept; 0 lives → GAME OVER.
- [ ] PAUSE button, `P`, `Esc` freeze and show PAUSED; same key resumes; tab switch pauses; click/keys while paused do nothing to the game.
- [ ] END opens GAME OVER with the engine's final score.
- [ ] PLAY AGAIN returns to ready with score 0, 3 lives, level 1.
- [ ] Leaving the page stops rAF and removes listeners; no console errors.
- [ ] Colors match the palette table; `shadowBlur` ≤ 8; no Spanish strings in code or comments.
- [ ] Typing in the SAVE SCORE input does not steer or start the game.
- [ ] `KEYBOARD REQUIRED` note shown on snake.
- [ ] `public.games` contains row `snake` / `SNAKE`.
- [ ] SAVE SCORE inserts one `scores` row (`game_id = 'snake'`, uppercase name, modal score), verified with `execute_sql`.
- [ ] Hall of Fame tabs are `GLOBAL` + real games in catalog order (`ARKANOID`, `TETRIS`, `SNAKE`, `ASTEROIDS`); `SNAKE` tab shows the saved score.
- [ ] `/games/snake` TOP SCORES and Global best read from Supabase; empty state before any score, linking to `/games/snake/play`.
- [ ] Library card BEST SCORE for `snake` equals DB max.
- [ ] GLOBAL totals count `snake` in `games`.
- [ ] Other games unchanged: arkanoid, tetris, asteroids still real; remaining fake games show `PRACTICE RUN — SCORE NOT RECORDED`.
- [ ] No hydration warnings on `/`, `/games`, `/hall-of-fame`, `/games/snake`, `/games/snake/play`.
- [ ] At 390px width the canvas scales with no horizontal scroll.

## Decisions

- **Yes:** Reuse catalog placeholder `snake` / `SNAKE`, keep `cover-snake`, update copy only. Discarded: new second entry.
- **Yes:** 640×480, 20×15 cells of 32 px, CSS-scaled in the 4:3 CRT. Discarded: 800×600 board, 32×24 grid of 20 px.
- **Yes:** 3 lives; wall and self hit both cost a life, snake resets, score/level kept. HUD Lives starts at 3. Discarded: instant death (Lives `—`), wrap-around walls.
- **Yes:** 10 points per fruit, level every 5 fruits, tick 150 ms −10 ms per level, floor 60 ms. Discarded: points × level, constant speed.
- **Yes:** `fruits.png` copied to `public/games/snake/`, `sprites.js` ported to a typed const, vector neon snake, magenta square fallback. Discarded: keeping the `window.SPRITE_ATLAS` global, using other sheet rows.
- **Yes:** One fruit on a random free cell; board full = win. Discarded: timed/golden fruit.
- **Yes:** Arrows/`WASD`, no touch, `keyboardRequired: true`. Discarded: swipe controls (own spec).
- **No:** Sound. No audio assets; separate spec if wanted.
- **Yes (inherited):** framework-free TS engine with `destroy()`; ready screen; platform HUD/modal replace in-game ones; PAUSE button + `P`/`Esc` + tab-hidden auto-pause; English strings; neon palette; `saveScore` Server Action; `games` row = has leaderboard; Hall tab, detail board, card best automatic; generic registry entry, no per-id branching in engine wiring; no fake data.
- **Yes:** Score clamp 0..10,000,000. Real max 2,970.

## Risks

| Risk                                                        | Mitigation                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| Strict Mode double effect → two loops / two image loads     | `destroy()` cancels rAF, removes listeners, drops image `onload`.           |
| Fast double key press (e.g. up then left) reverses in place | Input queue of 2 validated against the last queued direction, not current.  |
| Spritesheet slow/failed load                                | Magenta square fallback; game never waits for the image.                    |
| Sprite widths vary (110–170 px) → distorted fruit           | Scale to fit 28×28 box preserving aspect ratio.                             |
| Large 3790 px sheet scaled down looks blurry/aliased        | `imageSmoothingEnabled = false`; verify in screenshot, per-fruit crop only. |
| Arrow/Space scrolls page or blocks SAVE SCORE input         | `preventDefault` only while mounted, ignore `INPUT` targets and `gameover`. |
| Spawn loop on nearly full board                             | Pick from the list of free cells, not retry random; empty list = win.       |
| Pause time counted in tick accumulator                      | Accumulator advances only in `update()`, frozen while paused.               |
| Score outside DB range                                      | Clamp 0..10,000,000.                                                        |

## What is **not** in this spec

- Sound/music, touch/swipe controls, golden/timed fruits and power-ups, obstacles, wrap-around mode, multiple maps.
- Auth, anti-cheat, realtime, other games' engines.

_Each one, if it lands, goes in its own spec._
