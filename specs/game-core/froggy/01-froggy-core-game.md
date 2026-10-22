# SPEC FROGGY-01 — FROGGY core game

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-10-22
> **Objective:** Build a new typed Froggy engine (hop across traffic and river to fill 5 lily pads before the timer runs out), playable at `/games/froggy/play` with a real Supabase leaderboard.

## Why this spec exists

There is no source game and no assets (`resources/source-assets/` and `resources/started-games/` hold nothing for Froggy), and the catalog has no Froggy placeholder (`lib/games.ts` has only `arkanoid`, `tetris`, `snake`, `asteroids`). The platform already provides the generic registry (`lib/games/registry.ts`, `lib/games/engine-types.ts`, `components/game-screen.tsx`), React HUD, PAUSE/END/EXIT, GAME OVER modal, `saveScore` Server Action and DB-driven boards (specs 05–09). Missing: a catalog entry and cover, the engine, a registry entry and a `games` row for `froggy`.

`lib/games/registry.ts` already exists → this spec only adds a registry entry (including the required `touch` layout). New catalog entry → no rename step. All art is vector neon drawn on canvas; no assets to copy.

## Scope

**In:**

- Catalog: new entry `froggy` / `FROGGY` in `lib/games.ts` (after `asteroids`), `cat: "ARCADE"`, `color: "green"`, `cover: "cover-froggy"`; new `.cover-froggy` class in `app/globals.css`.
- Engine `lib/games/froggy/engine.ts` (split lane data into `lib/games/froggy/lanes.ts` and drawing into `lib/games/froggy/draw.ts` if > ~400 lines). Mechanics:
  - Grid 16 cols × 12 rows of 40 px on a 640×480 canvas. Rows top to bottom: row 0 goal (hedge with 5 lily pads), rows 1–4 river, row 5 median (safe), rows 6–10 road, row 11 start (safe).
  - Fixed-step loop `STEP_MS = 1000/60` with accumulator, frame delta capped at 100 ms; all timing in `update()`.
  - Frog starts at row 11, col 8 (x = 320 center). One hop = 40 px up/down/left/right. A hop animates for `HOP_MS = 90` (visual only; logical position changes instantly); input during a hop is ignored; key auto-repeat (`event.repeat`) ignored.
  - Steering by `←↑→↓` / `WASD`. Horizontal hops are not grid-snapped when riding a log (frog x is continuous); x is clamped to `[20, 620]` for hops made on land.
  - Road rows 6–10: vehicles move at constant speed and wrap. Overlap between the frog hitbox (28×28 centered) and a vehicle hitbox (`w × 40 − 4` wide, 28 high) kills the frog.
  - River rows 1–4: the frog dies unless its center x lies inside a log span on its row at the moment of landing and on every update after. While on a log it moves with the log (`dx = dir × speed × dt`). Frog center outside `[0, 640]` → death.
  - Goal row 0: pads at cols 1, 4, 7, 10, 13. Landing with center within a pad cell (40 px) fills it; landing anywhere else in row 0 (hedge) or on a filled pad → death. Pad filled → frog returns to start, timer resets.
  - Timer: `TIME_LIMIT = 30` s per frog; reaching 0 → death. Drawn in canvas as a bar at the bottom (see Palette).
  - Death: `dying` sub-state of `DEATH_MS = 800` (frog flashes magenta, no input); then −1 life; lives > 0 → frog respawns at start, timer reset; lives 0 → game over.
  - All 5 pads filled → level cleared: `+1000`, level +1, pads emptied, speeds ×(see Constants), frog respawn.
  - Scoring: `+10` the first time per attempt the frog reaches a row higher than ever before in that attempt (attempt = since last respawn/pad); `+50` per pad filled; `+10 × floor(secondsLeft)` time bonus on pad fill; `+1000` on level clear.
- No globals: engine owns canvas, state, rAF loop, listeners; `destroy()` removes all.
- States `ready` → `playing` → `gameover`, plus `paused` flag; `playing` has a `dying` sub-state. Ready text `PRESS ARROW KEY OR SPACE TO START`.
- Controls: arrows/`WASD` hop; any arrow/`WASD` key, `Space` or left click on canvas starts from `ready` (the starting arrow key also performs its hop only if it is not consumed by starting: it only starts; the hop needs a second press). Click/Space ignored while paused and in `gameover`.
- React HUD from callbacks: Player, Score, Lives (starts 3), Level. No in-canvas HUD except the timer bar and pad indicators.
- Registry `keyboardRequired` is not used (registry has `touch` layout instead): `touch: { dpad: all four, buttons: [] }`.
- Neon palette from `app/globals.css`, `shadowBlur` ≤ 8.
- Pause: button, `P`, `Esc`, tab hidden. END → modal. PLAY AGAIN → ready (score 0, 3 lives, level 1).
- English strings only.
- Leaderboard: migration `add_froggy_leaderboard` inserting the `games` row; SAVE SCORE enabled; Hall tab, detail board, card best and home feeds appear automatically. Update hardcoded empty-state links only if they still point at a fixed game (verify `components/hall-of-fame.tsx`, `app/games/[id]/page.tsx`; per-game link expected).

**Out of scope (for future specs):** diving turtles, fly bonus and other hazards (spec 02), sound (spec 03), skins, touch layout tweaks beyond the default D-pad, multiple maps, auth, anti-cheat, realtime, other games' engines.

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

// lib/games/froggy/lanes.ts
export type LaneKind = "car" | "truck" | "bus" | "log";
export interface Lane {
  row: number; // 1..4 river, 6..10 road
  kind: LaneKind;
  dir: 1 | -1; // 1 = moves right
  speed: number; // px/s at level 1
  w: number; // entity width in cells
  gap: number; // empty cells between entities
}
export const LANES: Lane[]; // 9 entries, see table

// lib/games/froggy/engine.ts
export function createFroggyGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameEngine;

// lib/games/registry.ts — new entry
// froggy: { create: createFroggyGame, width: 640, height: 480, lives: 3,
//   touch: { dpad: ["ArrowLeft","ArrowUp","ArrowRight","ArrowDown"], buttons: [] } }
```

**Constants:**

| Constant       | Value                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas         | 640×480                                                                                                                                        |
| Grid           | 16 cols × 12 rows, cell 40 px                                                                                                                  |
| Frog start     | row 11, x 320, y center of row                                                                                                                 |
| Frog hitbox    | 28×28 centered                                                                                                                                 |
| Hop            | 40 px, `HOP_MS` 90, input locked during hop                                                                                                    |
| Lives          | 3                                                                                                                                              |
| Time limit     | 30 s per frog (`TIME_LIMIT`)                                                                                                                   |
| Death          | `DEATH_MS` 800                                                                                                                                 |
| Pads           | 5, cols 1, 4, 7, 10, 13 (cell 40 px wide)                                                                                                      |
| Points         | +10 new max row per attempt; +50 pad; +10 × whole seconds left on pad; +1000 level clear                                                       |
| Level          | `1 + padsRoundsCleared`; speed mult `min(2.0, 1 + 0.1 × (level − 1))` on all lanes                                                             |
| Entity pattern | period `P = (w + gap) × 40`; `n = ceil((640 + w × 40) / P) + 1`; wrap modulus `n × P`; entities spaced `P` apart, offset per row `row × 53` px |
| Max score      | not bounded by design; clamp 0..10,000,000                                                                                                     |

Lane table (level 1):

| Row | Kind  | Dir | Speed px/s | w   | gap |
| --- | ----- | --- | ---------- | --- | --- |
| 1   | log   | 1   | 40         | 3   | 3   |
| 2   | log   | −1  | 70         | 2   | 3   |
| 3   | log   | 1   | 30         | 4   | 3   |
| 4   | log   | −1  | 55         | 3   | 3   |
| 6   | car   | −1  | 60         | 1   | 4   |
| 7   | car   | 1   | 90         | 1   | 5   |
| 8   | truck | −1  | 50         | 2   | 5   |
| 9   | car   | 1   | 120        | 1   | 6   |
| 10  | bus   | −1  | 75         | 3   | 5   |

**Palette:**

| Element             | Color                                               |
| ------------------- | --------------------------------------------------- |
| Background          | `#000`                                              |
| Goal hedge (row 0)  | `#003a2a`, pads outlined `#00ff88`                  |
| Filled pad          | small frog icon `#00ff88`, glow 8                   |
| River               | `#00f5ff` at 12% alpha over `#000`                  |
| Logs                | `#d97a3a` fill, `#ffcf3a` 1 px edge                 |
| Median / start rows | `#0f0f18`, top line `#00ff88` at 30% alpha          |
| Road                | `#15151f`, dashed lane lines `#e6e9ff` at 12% alpha |
| Cars / trucks / bus | `#ff006e` / `#f5ff00` / `#00f5ff`, glow 4           |
| Frog                | `#00ff88`, glow 8; dying `#ff006e`                  |
| Timer bar           | `#00ff88` > 50%, `#f5ff00` 25–50%, `#ff006e` < 25%  |
| Ready text          | `#e6e9ff` at 70% alpha, `--pixel` font              |

**Catalog entry:**

```ts
{ id: "froggy", title: "FROGGY", cover: "cover-froggy", cat: "ARCADE", color: "green", plays: "7.3K",
  short: "Cross the road. Ride the logs. Reach home.",
  long: "Hop through five lanes of neon traffic, then leap across a river on drifting logs to fill every lily pad. The clock is always running and every level is faster. Get squashed or drown and you lose a life; three lives and the run is over." }
```

**Migration** `add_froggy_leaderboard`:

```sql
insert into public.games (id, title) values ('froggy', 'FROGGY');
```

Callbacks fire only on change (score on each award, lives on death, level on clear). `onGameOver` fires once per run (lives out or `end()`).

**Input handling:** engine listens to keys on `document`, click on the canvas. Ignore keys when target is `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON`, when paused and in `gameover`; `preventDefault` on arrows/Space only while mounted. `blur` clears pending input. Touch D-pad dispatches arrow `KeyboardEvent`s via the shared `TouchPad`, so no extra engine code.

Conventions: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`) before writing code. Engine framework-free; only `components/game-screen.tsx` touches React. Engine created in `useEffect`, safe under Strict Mode. Use `/frontend-design` for the cover art. Reuse `.crt`, `.player-hud`, `.modal`, `.btn`.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. Catalog entry `froggy` in `lib/games.ts` + `.cover-froggy` in `app/globals.css`. Check: `/games` shows the card, `/games/froggy` renders (practice player), build + lint.
2. `lib/games/froggy/lanes.ts`: `LANES` table and entity-position helper (`n`, `P`, modulus). Check: build + lint.
3. Engine `lib/games/froggy/engine.ts` (+ `draw.ts`): fixed-step loop, lane scrolling, frog hop, road collision, river riding/drowning, pads, timer, death, scoring, levels, neon drawing. Check: build + lint.
4. Add `ready` state, `setPaused`, `end`, `reset`, `destroy`, callbacks, score clamp. Check: build + lint.
5. Register `froggy` in `lib/games/registry.ts` (640×480, lives 3, 4-way D-pad touch). Check: playable at `/games/froggy/play`; HUD Score/Lives/Level update.
6. Pause/END/PLAY AGAIN flows + palette check; verify hardcoded links. Check: Playwright screenshots (ready, road, river on log, pad filled, dying, paused, game over) saved to `.playwright-mcp/screenshots`.
7. Apply migration `add_froggy_leaderboard` via Supabase MCP `apply_migration`. Check: `execute_sql` shows the row; saving a run inserts a score; Hall FROGGY tab appears.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `/games/froggy/play` shows a 640×480 canvas in `.crt-screen` with `PRESS ARROW KEY OR SPACE TO START`; nothing moves in the frog before start.
- [ ] `←↑→↓` and `WASD` hop exactly 40 px; arrows/Space do not scroll the page; held key does not repeat hops.
- [ ] Frog starts at row 11, center x 320, within a 28×28 hitbox.
- [ ] Hitting any vehicle costs a life; Lives HUD starts at 3 and goes to 2.
- [ ] Standing on a log moves the frog with the log at the lane speed; landing on water or riding off-screen (center outside 0..640) costs a life.
- [ ] Landing on the hedge between pads or on a filled pad costs a life; landing on an empty pad fills it, adds 50 + 10 × whole seconds left, and returns the frog to start with timer 30 s.
- [ ] Timer bar drains over 30 s and reaching 0 costs a life; bar color changes at 50% and 25%.
- [ ] First time reaching each higher row in an attempt adds exactly 10; hopping back and forth adds nothing.
- [ ] Filling the 5th pad adds 1000, Level HUD goes `01` → `02`, pads empty, lane speeds ×1.1.
- [ ] Speed multiplier never exceeds 2.0.
- [ ] After a death the dying animation lasts 800 ms with no input, then the frog respawns at start; 0 lives → GAME OVER.
- [ ] PAUSE button, `P`, `Esc` freeze everything including the timer and show PAUSED; same key resumes; tab switch pauses.
- [ ] END opens GAME OVER with the engine's final score; PLAY AGAIN returns to ready with score 0, 3 lives, level 1.
- [ ] Leaving the page stops rAF and removes listeners; no console errors.
- [ ] Colors match the palette table; `shadowBlur` ≤ 8; no Spanish strings.
- [ ] Typing in the SAVE SCORE input does not hop or start the game.
- [ ] Touch D-pad shows 4 directions and no action buttons on froggy.
- [ ] `public.games` contains row `froggy` / `FROGGY`.
- [ ] SAVE SCORE inserts one `scores` row (`game_id = 'froggy'`, uppercase name, modal score), verified with `execute_sql`.
- [ ] Hall of Fame tabs are `GLOBAL` + real games in catalog order (`ARKANOID`, `TETRIS`, `SNAKE`, `ASTEROIDS`, `FROGGY`); `FROGGY` tab shows the saved score.
- [ ] `/games/froggy` TOP SCORES and Global best read from Supabase; empty state links to `/games/froggy/play`.
- [ ] Library card BEST SCORE for `froggy` equals DB max; GLOBAL totals count it.
- [ ] Other games unchanged.
- [ ] No hydration warnings on `/`, `/games`, `/hall-of-fame`, `/games/froggy`, `/games/froggy/play`.
- [ ] At 390px width the canvas scales with no horizontal scroll.

## Decisions

- **Yes:** New catalog entry `froggy` (no placeholder exists), `cat: "ARCADE"`, accent `green` (frog; shared with snake). Discarded: reusing another placeholder, `cyan` accent.
- **Yes:** 640×480, 16×12 cells of 40 px, CSS-scaled in the 4:3 CRT. Discarded: 800×600, 13-col classic grid.
- **Yes:** 3 lives; any death resets the frog to start with a fresh timer, score/level kept. Discarded: `lives: null`.
- **Yes:** Timer is drawn in-canvas as a bottom bar because the platform HUD only has Score/Lives/Level. Discarded: extending the React HUD.
- **Yes:** Discrete 40 px hops with a 90 ms visual animation and instant logical move; input locked during a hop. Discarded: continuous movement, buffered input.
- **Yes:** Log riding keeps x continuous; clamp only on land. Discarded: snapping to grid on logs.
- **Yes:** Scoring 10/50/time×10/1000, speed +10% per level capped at 2.0. Discarded: points × level, unbounded speed.
- **Yes:** Arrows/`WASD`; touch via the shared D-pad with `buttons: []`. Discarded: swipe controls.
- **No:** Turtles, bonus fly and other hazards (spec 02), sound (spec 03), skins (own spec).
- **Yes (inherited):** framework-free TS engine with `destroy()`; ready screen; platform HUD/modal replace in-game ones; PAUSE button + `P`/`Esc` + tab-hidden auto-pause; English strings; neon palette; `saveScore` Server Action; `games` row = has leaderboard; Hall tab, detail board, card best automatic; generic registry entry, no per-id branching in engine wiring; no fake data.
- **Yes:** Score clamp 0..10,000,000.

## Risks

| Risk                                                    | Mitigation                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Strict Mode double effect → two loops                   | `destroy()` cancels rAF and removes listeners.                                  |
| Frog "tunnels" through a fast vehicle between frames    | Fixed 60 Hz step; max speed 240 px/s (4 px/step) vs 28 px hitbox.               |
| Float drift in wrapped entity positions                 | Position = `(offset + dir × speed × t) mod modulus`, derived from elapsed time. |
| Landing check passes on log edge then frog slides off   | Re-check log overlap every update, not only on landing.                         |
| Pause time counted in timer/lane time                   | Elapsed time advances only in `update()`, frozen while paused.                  |
| Arrow/Space scrolls page or blocks SAVE SCORE input     | `preventDefault` only while mounted, ignore `INPUT` targets and `gameover`.     |
| Hardcoded empty-state links still pointing at asteroids | Verify both files in step 6; link must be per game.                             |
| Endless loop farming (stay at pad-adjacent safe row)    | Timer forces death at 0; no points for non-new rows.                            |

## What is **not** in this spec

- Diving turtles, bonus fly, median snake and other hazards, sound/music, skins, extra maps.
- Auth, anti-cheat, realtime, other games' engines.

_Each one, if it lands, goes in its own spec._
