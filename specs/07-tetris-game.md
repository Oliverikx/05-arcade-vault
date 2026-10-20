# SPEC 07 — TETRIS game integration

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-10-20
> **Objective:** Port the vanilla-JS Tetris from `resources/started-games/03-tetris` into a typed engine playable at `/games/tetris/play` with a real Supabase leaderboard, introducing the generic engine registry.

## Why this spec exists

`resources/started-games/03-tetris/game.js` (786 lines, global state, Spanish UI, 300×600 board canvas + DOM side panel) is a finished Tetris with an energy/ability system, hold, 5-piece preview, 8th "Screw" piece, 4 skins, light/dark theme, start-level select and localStorage records. The catalog has a placeholder `drop` / `DROP` entry (fake score ticker). The platform already provides the React HUD, PAUSE/END/EXIT, GAME OVER modal, `saveScore` Server Action and DB-driven boards (SPEC 06). Missing: a typed engine, a registry so `GamePlayer` stops branching on `game.id === "asteroids"`, and a `games` row for `tetris`.

`lib/games/registry.ts` does not exist → step 1 is the registry refactor.

## Scope

**In:**

- Generic engine registry refactor (step 1): `lib/games/engine-types.ts`, `lib/games/registry.ts`, `components/game-screen.tsx` replacing `components/asteroids-screen.tsx`; asteroids behaviour unchanged.
- Rename catalog entry `drop` / `DROP` → `tetris` / `TETRIS` in `lib/games.ts`; cover class `cover-tetro` → `cover-tetris` (`lib/games.ts`, `app/globals.css`). Keep `cat: "PUZZLE"`, `color: "magenta"`, `plays`.
- Engine `lib/games/tetris/engine.ts` (split pieces/drawing into `lib/games/tetris/pieces.ts` and `lib/games/tetris/draw.ts` if > ~400 lines): same mechanics as source:
  - 10×20 board, 8 piece types (I, O, T, S, Z, J, L, Screw), uniform random bag-less spawn, queue ≥ 6.
  - Rotation `rotateCW` + kicks `[0, -1, 1, -2, 2]`; ghost piece (alpha 0.2); soft drop, hard drop.
  - Line scoring × level, level every 10 lines, drop interval formula.
  - Spawn collision → game over (partial piece kept as in source).
  - Energy (+25/line, max 100); `E` opens ability menu; `1`–`5`: preview 5 pieces for 10 spawns, swap piece, slow ×2 for 10s, undo last lock, hold piece (`C` to use). Success empties energy. Undo disabled without snapshot; hold disabled when one is held.
  - Combo tracking dropped (only fed localStorage records).
- No globals: engine owns canvas, state, rAF loop, listeners; `destroy()` removes all.
- States `ready` → `playing` → `gameover`, plus `paused` flag; ability menu is a `choosing` sub-state of `playing` (loop frozen). Ready text `PRESS SPACE TO START` (Space or click starts; the starting Space press is blocked until released so it does not hard-drop).
- Single 800×600 canvas: board 300×600 centered (x 250..550); left panel HOLD (when held) + ENERGY bar + ability status (`SLOW 7s` / `PRESS E`); right panel NEXT, LINES, 5-piece PREVIEW (when active). Ability menu drawn as an in-canvas overlay.
- React HUD from callbacks: Player, Score, Lives `—`, Level. In-canvas SCORE/LEVEL, start overlay, game-over overlay, records list, pause menu, start-level select removed.
- Skins `retro`, `neon`, `pastel`, `pixel` and LIGHT/DARK theme kept, canvas-only: small React toolbar under the CRT (`SKIN` select + `LIGHT`/`DARK` toggle), visible only for tetris. Default `neon` + dark. Persisted per browser in `localStorage` keys `av_tetris_skin`, `av_tetris_theme` (try/catch). Changing either redraws immediately, also while paused/ready/gameover.
- `neon` skin remapped to platform palette (table below); other skins keep source colors.
- Pause: button, `P`, `Esc`, tab hidden. END → modal. PLAY AGAIN → ready. Every run starts at level 1.
- English strings only (`HOLD`, `NEXT`, `LINES`, `ENERGY`, `PREVIEW`, `ABILITY`, `1 PREVIEW 5`, `2 SWAP PIECE`, `3 SLOW 10s`, `4 UNDO`, `5 HOLD PIECE`, `ESC CANCEL`).
- `KEYBOARD REQUIRED` note under the CRT (from registry `keyboardRequired`).
- Leaderboard: migration `add_tetris_leaderboard` inserting the `games` row; SAVE SCORE enabled; Hall tab, detail board, card best and home feeds appear automatically.

**Out of scope (for future specs):** touch / mouse controls (incl. clickable ability menu), sound (source has none), start-level select, localStorage records / combo stats, auth, anti-cheat, realtime, engines for other games, platform-wide light theme.

## Data model

```ts
// lib/games/engine-types.ts (new)
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

// lib/games/tetris/engine.ts
export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel";
export type TetrisTheme = "dark" | "light";
export interface TetrisEngine extends GameEngine {
  setAppearance(skin: TetrisSkin, theme: TetrisTheme): void; // redraws now
}
export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): TetrisEngine;

// lib/games/registry.ts
// id -> { create, width, height, lives: number | null, keyboardRequired: boolean }
// asteroids: { createAsteroidsGame, 800, 600, lives: 3, true }
// tetris:    { createTetrisGame,    800, 600, lives: null, true }
```

`createAsteroidsGame` is retyped to `GameCallbacks` / `GameEngine` (aliases kept or removed; no behaviour change).

**Constants (from source):**

| Constant      | Value                                                    |
| ------------- | -------------------------------------------------------- |
| Canvas        | 800×600; board `COLS 10 × ROWS 20`, `BLOCK 30` (300×600) |
| `LINE_SCORES` | `[0, 100, 300, 500, 800]` × current level                |
| Soft drop     | +1 per row moved (`↓`); locks when blocked               |
| Hard drop     | +2 per row dropped (`Space`)                             |
| Level         | `max(1, floor(lines / 10) + 1)`                          |
| Drop interval | `max(100, 1000 − (level − 1) × 90)` ms                   |
| Energy        | `ENERGY_MAX 100`, `ENERGY_PER_LINE 25`                   |
| Preview       | `PREVIEW_COUNT 5`, lasts `PREVIEW_PIECES 10` spawns      |
| Slow          | `SLOW_MS 10000`, `SLOW_FACTOR 2`                         |
| Kicks         | `[0, -1, 1, -2, 2]` (rotate and swap)                    |
| Lives         | none → HUD `—`                                           |
| Score cap     | clamp to 10,000,000 (DB CHECK)                           |

Controls: `←`/`→` move, `↑`/`X` rotate CW, `↓` soft drop, `Space` hard drop, `E` ability menu (energy full), `1`–`5` pick, `Esc` cancel menu, `C` use held piece, `P`/`Esc` pause (platform).

**Palette — `neon` skin (default):**

| Element                | Color                                                           |
| ---------------------- | --------------------------------------------------------------- |
| Background             | `#000`                                                          |
| Grid                   | `#14141f`                                                       |
| I                      | `#00f5ff` (cyan)                                                |
| O                      | `#f5ff00` (yellow)                                              |
| T                      | `#aa00ff`                                                       |
| S                      | `#00ff88` (green)                                               |
| Z                      | `#ff006e` (magenta)                                             |
| J                      | `#1f51ff`                                                       |
| L                      | `#ff7700`                                                       |
| Screw                  | `#e6e9ff` (ink)                                                 |
| Panel labels / text    | values `#e6e9ff`, labels `#e6e9ff` at 60% alpha; `--pixel` font |
| Energy bar fill / full | cyan → green when full                                          |
| Neon glow              | `shadowBlur` 8 (source 12)                                      |

Other skins: source color arrays and block drawers unchanged. Theme sets panel text and `retro` board bg/grid (`dark #1a1a25 / #22222e`, `light #ffffff / #e3e6ee`); `neon` (`#000 / #14141f`), `pastel` (`#fdf6fb / #f0e4ee`), `pixel` (`#101820 / #1c2733`) override bg/grid as in source. Area outside board: board bg color.

**Catalog entry:**

```ts
{ id: "tetris", title: "TETRIS", cover: "cover-tetris", cat: "PUZZLE", color: "magenta", plays: "31.8K",
  short: "Fit the pieces before the ceiling crushes you.",
  long: "Eight shapes fall from the dark, including the hollow Screw. Rotate, drop and clear lines to charge energy, then spend it on abilities: hold, swap, undo, preview or slow time. Speed climbs every 10 lines." }
```

**Migration** `add_tetris_leaderboard`:

```sql
insert into public.games (id, title) values ('tetris', 'TETRIS');
```

Callbacks fire only on change (score/level; `onLives` never fires for tetris). Undo fires `onScore`/`onLevel` with restored values.

**Key handling:** engine listens on `document`; `GamePlayer` listens on `window`, so the engine sees keys first. While the ability menu is open the engine calls `preventDefault()` on `Esc`/`P`, and `GamePlayer` ignores keydown events with `defaultPrevented` → `Esc` cancels the menu instead of pausing. Engine ignores keys when target is `INPUT`/`SELECT`/`TEXTAREA`, when paused, and in `gameover`; `preventDefault` on arrows/Space only while mounted. Keys held at resume are blocked until released (source `blocked` set); `blur` clears pressed keys.

Conventions: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`, refs) before writing code. Engine framework-free; only `components/game-screen.tsx` and the toolbar touch React. Engine created in `useEffect`, safe under Strict Mode. UI (toolbar, any CSS) per `/frontend-design`; reuse `.crt`, `.player-hud`, `.modal`, `.keyboard-note`, `.btn` styles.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. Registry refactor: create `lib/games/engine-types.ts`, `lib/games/registry.ts` (asteroids only); generic `components/game-screen.tsx` (props `gameId`, `paused`, `runId`, `endSignal`, callbacks; canvas size from registry) replacing `components/asteroids-screen.tsx` (deleted); `components/game-player.tsx` uses `getEngine(game.id)` instead of `isAsteroids`; HUD lives from `entry.lives` (`null` → `—`), initial lives on restart from registry, KEYBOARD REQUIRED from `keyboardRequired`, practice note for unregistered games; P/Esc handler skips `defaultPrevented` events. Fix hardcoded `/games/asteroids/play` in `components/hall-of-fame.tsx` (link to active tab's game, GLOBAL → `/games`) and `app/games/[id]/page.tsx` (`/games/${id}/play`). Check: asteroids plays exactly as before; build + lint pass.
2. Catalog rename `drop` → `tetris` + `cover-tetris` CSS. Check: `/games/tetris` renders (fake player), `/games/drop` 404, no `cover-tetro` / `"drop"` left.
3. Port engine to `lib/games/tetris/engine.ts` (+ split files) with source constants, 800×600 layout, side panels, ability menu, English strings. Check: build + lint.
4. Add `ready` state, `setPaused`, `end`, `reset`, `destroy`, `setAppearance`, callbacks, score clamp; no in-canvas score/level, no overlays/records/start level. Check: build + lint.
5. Register `tetris` in registry. Check: playable at `/games/tetris/play`, HUD Score/Level update, Lives `—`.
6. Pause/END/PLAY AGAIN flows, Esc-in-menu rule, neon recolor, skin/theme toolbar under CRT with localStorage persistence. Check: Playwright screenshots (neon dark, pastel, retro light, ability menu, paused) saved to `.playwright-mcp/screenshots`.
7. Apply migration `add_tetris_leaderboard` via Supabase MCP `apply_migration`. Check: `execute_sql` shows the row; saving a run inserts a score; Hall TETRIS tab appears.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `lib/games/registry.ts` exists; `components/asteroids-screen.tsx` deleted; no `game.id === "asteroids"` / `isAsteroids` in `components/`.
- [ ] Asteroids unchanged: ready screen, 3 ♥, scoring, pause, save.
- [ ] `lib/games.ts` has no `drop` id; `/games/drop` 404; no `cover-tetro` string in `app/`, `components/`, `lib/`.
- [ ] `/games/tetris/play` shows a 800×600 canvas in `.crt-screen` with `PRESS SPACE TO START`; no piece falls before start; starting with Space does not hard-drop the first piece.
- [ ] Controls: `←`/`→` move, `↑` and `X` rotate, `↓` soft drop, `Space` hard drop work; arrows/Space do not scroll the page.
- [ ] Scoring: soft drop adds exactly 1 per row; hard drop adds exactly 2 per row dropped; clearing 1/2/3/4 lines at level L adds exactly 100·L / 300·L / 500·L / 800·L.
- [ ] Lives HUD shows `—`; Level HUD starts at `01` and becomes `02` at 10 lines; drop interval at level 2 is 910 ms.
- [ ] LINES panel in canvas shows total lines cleared.
- [ ] Each cleared line adds 25 energy (max 100); with full energy `E` opens the ability menu and the game freezes; `1`–`5` apply preview/swap/slow/undo/hold and empty energy; `Esc` closes the menu without pausing; undo/hold options shown disabled when unavailable.
- [ ] Preview shows 5 pieces for 10 spawns; slow halves fall speed for 10 s with countdown `SLOW Ns`; undo restores board, score, lines, level of the previous lock and HUD reflects it; `C` swaps in the held piece.
- [ ] Screw piece (3×3 ring) spawns.
- [ ] PAUSE button, `P`, `Esc` freeze and show PAUSED; same key resumes; tab switch pauses; keys held at resume do not act until released.
- [ ] Spawn collision or END opens GAME OVER with the engine's final score.
- [ ] PLAY AGAIN returns to ready with score 0, level 1, 0 lines, 0 energy, no hold.
- [ ] Leaving the page stops rAF and removes listeners; no console errors.
- [ ] Neon skin colors match the palette table; `shadowBlur` ≤ 8.
- [ ] Toolbar under CRT switches skin (retro/neon/pastel/pixel) and LIGHT/DARK; canvas redraws immediately even while paused; choice survives reload; toolbar absent on asteroids.
- [ ] Typing in the SAVE SCORE input or using the toolbar select does not move pieces.
- [ ] No Spanish strings in the game.
- [ ] `public.games` contains row `tetris` / `TETRIS`.
- [ ] SAVE SCORE inserts one `scores` row (`game_id = 'tetris'`, uppercase name, modal score), verified with `execute_sql`.
- [ ] Hall of Fame tabs are `GLOBAL` + real games in catalog order (`TETRIS`, `ASTEROIDS`); `TETRIS` tab shows the saved score; empty-state link points at the tab's game.
- [ ] `/games/tetris` TOP SCORES and Global best read from Supabase; empty state before any score, linking to `/games/tetris/play`.
- [ ] Library card BEST SCORE for `tetris` equals DB max.
- [ ] GLOBAL totals count `tetris` in `games`.
- [ ] Fake games still show `PRACTICE RUN — SCORE NOT RECORDED`.
- [ ] No hydration warnings on `/`, `/games`, `/hall-of-fame`, `/games/tetris`, `/games/tetris/play`.
- [ ] At 390px width the canvas scales with no horizontal scroll; `KEYBOARD REQUIRED` visible.

## Decisions

- **Yes:** Rename `drop` → `tetris` / `TETRIS`, cover `cover-tetris`. Same pattern as rocks → asteroids. Discarded: keep DROP name; second puzzle entry.
- **Yes:** Generic registry + `GameScreen` now. Second real game; avoids per-id branching. Discarded: `TetrisScreen` copy + another `if`.
- **Yes:** 800×600 canvas with in-canvas side panels. Fills the 4:3 CRT. Discarded: letterboxed board with React side panels.
- **Yes:** Keep energy/abilities, hold, preview, slow, undo, Screw piece. Faithful port. Discarded: classic-only.
- **Yes:** Keep skins + light/dark, canvas-only, default neon/dark, toolbar under CRT, localStorage. User choice. Discarded: platform-wide theme.
- **No:** Start-level select. Every run at level 1 → comparable boards.
- **No:** localStorage records/combo stats. Replaced by Supabase boards.
- **Yes:** Lives HUD `—` (registry `lives: null`); LINES in canvas. Discarded: lines in Lives slot.
- **Yes:** Keyboard only; ability menu not clickable. Touch is its own spec.
- **Yes (inherited):** framework-free TS engine with `destroy()`; ready screen; platform HUD/modal replace in-game ones; PAUSE button + `P`/`Esc` + tab-hidden auto-pause; English strings; neon palette; `saveScore` Server Action; `games` row = has leaderboard; Hall tab, detail board, card best automatic; no fake data.
- **Yes:** Score clamp at 10,000,000. Realistic runs stay far below (4-line clear at level 20 = 16,000).

## Risks

| Risk                                                          | Mitigation                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Strict Mode double effect → two loops                         | `destroy()` cancels rAF + removes listeners.                                   |
| `Esc` both closes ability menu and pauses                     | Engine `preventDefault` while choosing; `GamePlayer` skips `defaultPrevented`. |
| Engine keys fire while typing in modal input / toolbar select | Ignore `INPUT`/`SELECT`/`TEXTAREA` targets and `gameover`.                     |
| Starting Space also hard-drops                                | Block keys held at start/resume until keyup.                                   |
| Paused/menu loop cancelled → skin change not visible          | `setAppearance` redraws immediately.                                           |
| Undo after menu restores score → `onScore` not fired          | Fire callbacks after every state restore (change-detected).                    |
| `localStorage` blocked (private mode)                         | try/catch, fall back to neon/dark.                                             |
| Registry refactor regresses asteroids                         | Step 1 isolated; asteroids criteria rechecked.                                 |
| `shadowBlur` on 200 cells tanks FPS                           | Neon blur 8, reset after each block.                                           |
| Score outside DB range                                        | Clamp 0..10,000,000.                                                           |

## What is **not** in this spec

- Touch/mouse controls, sound, start-level select, local records/combo stats.
- Auth, anti-cheat, realtime, other games' engines, platform light theme.

_Each one, if it lands, goes in its own spec._
