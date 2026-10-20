# SPEC 08 — ARKANOID game integration

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-10-20
> **Objective:** Port the vanilla-JS Arkanoid from `resources/started-games/04-arkanoid` into a typed engine playable at `/games/arkanoid/play` with a real Supabase leaderboard.

## Why this spec exists

`resources/started-games/04-arkanoid/game.js` (345 lines, global `CONFIG`/`state`, 640×480 canvas, English UI) is a finished Breakout: paddle + ball, 5 ASCII-grid levels, ball speed +0.5 per level, 3 lives, 10 points per block, 150 ms block-break animation, bounce/break SFX, keyboard + mouse control. It depends on `assets/spritesheet.js` (globals `loadSpritesheet`, `drawSprite`, `EXPLOSION_FRAMES`) and `assets/spritesheet-breakout.png`. The catalog has a placeholder `brick-buster` / `BRICK BUSTER` (fake score ticker). The platform already provides the generic registry (`lib/games/registry.ts`, `components/game-screen.tsx`), React HUD, PAUSE/END/EXIT, GAME OVER modal, `saveScore` Server Action and DB-driven boards. Missing: a typed engine, a registry entry and a `games` row for `arkanoid`.

`lib/games/registry.ts` already exists (SPEC 07) → this spec only adds a registry entry.

## Scope

**In:**

- Rename catalog entry `brick-buster` / `BRICK BUSTER` → `arkanoid` / `ARKANOID` in `lib/games.ts`; cover class `cover-bricks` → `cover-arkanoid` (`lib/games.ts`, `app/globals.css`). Keep `cat: "ARCADE"`, `color: "cyan"`, `plays`.
- Engine `lib/games/arkanoid/engine.ts` (split levels/drawing into `lib/games/arkanoid/levels.ts` and `lib/games/arkanoid/draw.ts` if > ~400 lines), same mechanics as source:
  - Fixed-step loop `STEP_MS = 1000/60` with accumulator, frame delta capped at 100 ms; all timing in `update()`.
  - 5 levels from source `LEVELS` (20/30/40/50/60 blocks); block width `min(64, 640 / cols)`, height `width / 2`, centered, top `60`; row color `rowColors[row % 7]`.
  - Ball launch 15° right of vertical; wall reflections (left/right/top); paddle bounce angle `hit ∈ [-1, 1] × 60°`; block hit reflects on axis of smaller overlap, one block per step.
  - Ball below canvas → −1 life; lives > 0 → ball sticks to paddle (serve); 0 → game over.
  - Last block broken: ball frozen until break animation ends, then next level (`LEVEL N` banner, serve).
  - Clearing level 5 = win: canvas shows `YOU WIN` for 90 steps (1.5 s), then `onGameOver(score + 100 × lives)`.
- No globals: engine owns canvas, state, rAF loop, listeners, audio; `destroy()` removes all.
- States `ready` → `playing` → `gameover`, plus `paused` flag; `playing` has a `serve` sub-state (ball stuck to paddle, paddle movable) at level start and after a lost life, and a `win` sub-state (1.5 s banner). Ready text `PRESS SPACE OR CLICK TO LAUNCH`; serve hint `SPACE / CLICK TO LAUNCH` under the `LEVEL N` banner.
- Controls: `←`/`A`, `→`/`D` move paddle (7 px/step); mouse move over canvas centers paddle on cursor (scaled by `canvas.width / rect.width`); `Space` or left click on canvas launches. Click/Space ignored while paused and in `gameover`.
- Vector neon rendering (no spritesheet): rounded-rect paddle, square ball, bricks with 1 px inner border; break animation = brick flash + 4-step shrink/fade over 150 ms (`EXPLOSION_DURATION`).
- Sound in: copy `resources/started-games/04-arkanoid/assets/sounds/ball-bounce.mp3` and `break-sound.mp3` to `public/games/arkanoid/sounds/`. Break plays on block hit; bounce on wall/paddle hit when no break that step. Engine exposes `setMuted`; small React toolbar under the CRT (`SOUND ON` / `SOUND OFF` toggle), visible only for arkanoid, persisted in `localStorage` key `av_arkanoid_muted` (try/catch, default sound on). Audio only plays after a user gesture (launch), errors swallowed.
- React HUD from callbacks: Player, Score, Lives (starts 3), Level (1–5). In-canvas score/level/life icons, game-over/win overlay and "Press Space or click to restart" removed.
- Neon recolor to platform palette (table below), `shadowBlur` ≤ 8.
- Pause: button, `P`, `Esc`, tab hidden. END → modal. PLAY AGAIN → ready (level 1, 3 lives, score 0).
- English strings only (source already English; keep `LEVEL N`, `YOU WIN`).
- Registry `keyboardRequired: false` (mouse playable) → no `KEYBOARD REQUIRED` note.
- Leaderboard: migration `add_arkanoid_leaderboard` inserting the `games` row; SAVE SCORE enabled; Hall tab, detail board, card best and home feeds appear automatically.

**Out of scope (for future specs):** touch controls, spritesheet art, power-ups / multi-ball / multi-hit bricks, extra levels or endless mode, level select, auth, anti-cheat, realtime, other games' engines.

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

// lib/games/arkanoid/engine.ts
export interface ArkanoidEngine extends GameEngine {
  setMuted(muted: boolean): void;
}
export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): ArkanoidEngine;

// lib/games/registry.ts — new entry
// arkanoid: { create: createArkanoidGame, width: 640, height: 480, lives: 3, keyboardRequired: false }
```

`components/game-screen.tsx` gets an optional `muted?: boolean` prop applied via `setMuted` when the engine supports it (same pattern as `appearance` → `setAppearance` for tetris).

**Constants (from source):**

| Constant         | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| Canvas           | 640×480                                                             |
| Paddle           | 81×14 at `y 450`, speed 7 px/step, clamped to canvas                |
| Ball             | 16×16, speed `5 + 0.5 × (level − 1)` px/step                        |
| Launch angle     | 15° from vertical, to the right                                     |
| Max bounce angle | 60°                                                                 |
| Blocks           | width `min(64, 640 / cols)`, height `width / 2`, top `60`, centered |
| Levels           | 5: L1 20 (5 cols), L2 30 (10), L3 40 (16), L4 50 (20), L5 60 (20)   |
| Row colors       | `gray, red, yellow, cyan, magenta, hotpink, green` (row % 7)        |
| Points           | 10 per block                                                        |
| Win bonus        | 100 × remaining lives when level 5 is cleared (new)                 |
| Lives            | 3                                                                   |
| Break animation  | 150 ms, 4 frames                                                    |
| Max score        | 200 blocks × 10 + 300 = 2,300; clamp 0..10,000,000 anyway           |

**Palette:**

| Element               | Color                     |
| --------------------- | ------------------------- |
| Background            | `#000`                    |
| Paddle                | `#00f5ff` (cyan), glow 8  |
| Ball                  | `#e6e9ff` (ink), glow 6   |
| Row `gray`            | `#e6e9ff` (ink)           |
| Row `red`             | `#ff006e` (magenta)       |
| Row `yellow`          | `#f5ff00` (yellow)        |
| Row `cyan`            | `#00f5ff` (cyan)          |
| Row `magenta`         | `#aa00ff`                 |
| Row `hotpink`         | `#ff7700`                 |
| Row `green`           | `#00ff88` (green)         |
| `LEVEL N` / `YOU WIN` | `#f5ff00`, `--pixel` font |
| Ready / serve hint    | `#e6e9ff` at 70% alpha    |

**Catalog entry:**

```ts
{ id: "arkanoid", title: "ARKANOID", cover: "cover-arkanoid", cat: "ARCADE", color: "cyan", plays: "12.4K",
  short: "Bounce the ball and smash neon walls.",
  long: "Slide your paddle and bounce a glowing ball through five walls of neon bricks. Each wall is a new pattern and the ball gets faster every level. Clear all five to bank a bonus for every life left." }
```

**Migration** `add_arkanoid_leaderboard`:

```sql
insert into public.games (id, title) values ('arkanoid', 'ARKANOID');
```

Callbacks fire only on change (score per block, lives on loss, level on load). `onGameOver` fires once per run (lives out, win, or `end()`).

**Input handling:** engine listens to keys on `document`, mouse on the canvas. Ignore keys when target is `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON`, when paused and in `gameover`; `preventDefault` on arrows/Space only while mounted. `blur` clears pressed keys. Mouse move while paused does not move the paddle.

Conventions: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`, refs, static files in `public/`) before writing code. Engine framework-free; only `components/game-screen.tsx` and the toolbar touch React. Engine created in `useEffect`, safe under Strict Mode. UI (sound toolbar, cover CSS) per `/frontend-design`; reuse `.crt`, `.player-hud`, `.modal`, `.btn` and the tetris toolbar styles.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. Catalog rename `brick-buster` → `arkanoid` + `cover-arkanoid` CSS (rename `.cover-bricks` rules). Check: `/games/arkanoid` renders (fake player), `/games/brick-buster` 404, no `cover-bricks` / `"brick-buster"` left in `app/`, `components/`, `lib/`.
2. Port engine to `lib/games/arkanoid/engine.ts` (+ split files) with source constants, levels, physics, vector neon drawing. Check: build + lint.
3. Add `ready`/`serve`/`win` states, `setPaused`, `end`, `reset`, `destroy`, callbacks, win bonus, score clamp; no in-canvas HUD/overlays. Check: build + lint.
4. Register `arkanoid` in `lib/games/registry.ts` (640×480, lives 3, `keyboardRequired: false`). Check: playable at `/games/arkanoid/play` with keyboard and mouse; HUD Score/Lives/Level update.
5. Sound: copy mp3s to `public/games/arkanoid/sounds/`, `setMuted`, `muted` prop on `GameScreen`, `components/arkanoid-toolbar.tsx` (SOUND ON/OFF, localStorage) wired in `components/game-player.tsx` for arkanoid only. Check: sounds play on bounce/break; toggle silences and survives reload.
6. Pause/END/PLAY AGAIN flows + palette check. Check: Playwright screenshots (ready, L1 serve, L3 playing, paused, win banner) saved to `.playwright-mcp/screenshots`.
7. Apply migration `add_arkanoid_leaderboard` via Supabase MCP `apply_migration`. Check: `execute_sql` shows the row; saving a run inserts a score; Hall ARKANOID tab appears.

## Acceptance criteria

- [x] `npm run build` and `npm run lint` pass.
- [x] `lib/games.ts` has no `brick-buster` id; `/games/brick-buster` 404; no `cover-bricks` string in `app/`, `components/`, `lib/`.
- [x] `/games/arkanoid/play` shows a 640×480 canvas in `.crt-screen` with `PRESS SPACE OR CLICK TO LAUNCH`; ball does not move before launch.
- [x] Controls: `←`/`A`, `→`/`D` move paddle; mouse over canvas moves paddle; `Space` and click launch; arrows/Space do not scroll the page.
- [x] Ball launches at 15° to the right; L1 speed 5, L2 5.5, L5 7 px/step.
- [x] Scoring: each broken block adds exactly 10 to the HUD score.
- [x] Clearing level 5 shows `YOU WIN` then opens GAME OVER with score + exactly 100 per remaining life.
- [x] Level layouts have 20/30/40/50/60 blocks; Level HUD goes `01` → `05` as each wall is cleared, with `LEVEL N` banner and ball on paddle.
- [ ] Lives HUD starts at 3; ball lost → 2 and ball back on paddle; 0 lives → GAME OVER.
- [x] Broken blocks play a 150 ms flash/fade animation; next level loads only after it ends.
- [ ] Break sound on block hit, bounce sound on wall/paddle hit; SOUND OFF silences both; choice survives reload; toolbar absent on other games.
- [x] PAUSE button, `P`, `Esc` freeze and show PAUSED; same key resumes; tab switch pauses; click/mouse while paused does nothing.
- [ ] Losing all lives or END opens GAME OVER with the engine's final score.
- [x] PLAY AGAIN returns to ready with score 0, 3 lives, level 1.
- [ ] Leaving the page stops rAF, removes listeners and stops audio; no console errors.
- [x] Colors match the palette table; no spritesheet loaded; `shadowBlur` ≤ 8.
- [x] Typing in the SAVE SCORE input does not move the paddle or launch.
- [x] No `KEYBOARD REQUIRED` note on arkanoid.
- [x] `public.games` contains row `arkanoid` / `ARKANOID`.
- [x] SAVE SCORE inserts one `scores` row (`game_id = 'arkanoid'`, uppercase name, modal score), verified with `execute_sql`.
- [x] Hall of Fame tabs are `GLOBAL` + real games in catalog order (`ARKANOID`, `TETRIS`, `ASTEROIDS`); `ARKANOID` tab shows the saved score.
- [ ] `/games/arkanoid` TOP SCORES and Global best read from Supabase; empty state before any score, linking to `/games/arkanoid/play`.
- [x] Library card BEST SCORE for `arkanoid` equals DB max.
- [x] GLOBAL totals count `arkanoid` in `games`.
- [x] Other games unchanged: asteroids and tetris still real; fake games show `PRACTICE RUN — SCORE NOT RECORDED`.
- [x] No hydration warnings on `/`, `/games`, `/hall-of-fame`, `/games/arkanoid`, `/games/arkanoid/play`.
- [x] At 390px width the canvas scales with no horizontal scroll; mouse/paddle mapping stays correct when scaled.

## Decisions

- **Yes:** Rename `brick-buster` → `arkanoid` / `ARKANOID`, cover `cover-arkanoid`. Same pattern as drop → tetris. Discarded: keep BRICK BUSTER; second ARCADE entry.
- **Yes:** Vector neon drawing, spritesheet dropped. Matches platform palette, no image loading. Discarded: copy spritesheet PNG.
- **Yes:** Sound kept with SOUND ON/OFF toolbar + localStorage. Discarded: drop audio.
- **Yes:** 640×480 kept, CSS-scaled in the 4:3 CRT. Exact source physics. Discarded: upscale to 800×600.
- **Yes:** Mouse control kept, `keyboardRequired: false`. Discarded: keyboard only.
- **Yes:** Clearing L5 ends the run with +100 per life. Discarded: endless loop; plain end.
- **Yes (inherited):** framework-free TS engine with `destroy()`; ready screen; platform HUD/modal replace in-game ones; PAUSE button + `P`/`Esc` + tab-hidden auto-pause; English strings; neon palette; `saveScore` Server Action; `games` row = has leaderboard; Hall tab, detail board, card best automatic; generic registry entry, no per-id branching in the engine wiring; no fake data.
- **Yes:** Score clamp at 10,000,000. Real max 2,300.

## Risks

| Risk                                                   | Mitigation                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| Strict Mode double effect → two loops / two audio sets | `destroy()` cancels rAF, removes listeners, pauses and releases audio.   |
| Audio autoplay blocked                                 | Play only after launch gesture; `play().catch(() => {})`.                |
| Mouse mapping wrong when canvas CSS-scaled             | Scale by `canvas.width / rect.width` on every move.                      |
| Click on canvas to resume pause also launches          | Ignore mousedown while paused; resume only via platform controls/keys.   |
| Fast ball tunnels through thin L4/L5 blocks (16 px)    | Keep source step size (≤ 7 px < 16 px); one block per step as in source. |
| Engine keys fire while typing name in modal            | Ignore `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON` targets and `gameover`.      |
| Win banner time counted while paused                   | Banner advances in `update()` only (fixed step).                         |
| `localStorage` blocked                                 | try/catch, default sound on.                                             |
| Score outside DB range                                 | Clamp 0..10,000,000.                                                     |

## What is **not** in this spec

- Touch controls, spritesheet art, power-ups / multi-ball / multi-hit bricks, extra levels / endless mode, level select.
- Auth, anti-cheat, realtime, other games' engines.

_Each one, if it lands, goes in its own spec._
