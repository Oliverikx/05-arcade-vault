# SPEC 12 — Froggy performance pass

> **Status:** Approved
> **Depends on:** game-core/froggy/01-froggy-core-game, skin-designer/05-froggy-skin-selector
> **Date:** 2026-10-22
> **Objective:** Make Froggy run at a steady ~60 fps on desktop by cutting per-frame page compositing cost on the play page and per-frame canvas glow cost in the Froggy renderer, without visible change to the look, and by stopping per-score React re-renders of the game player.

## Why this spec exists

Desktop players see stutter / low FPS in Froggy (suspected in other games too). Review found two cost sources:

- **Page (shared, every game):** while playing, the browser repaints/re-composites decorative layers every frame: animated background grid (`.av-bg::before`, `background-position` animation + `mask-image` + 3D transform), full-screen `mix-blend-mode: overlay` scanlines (`.av-bg::after`), `mix-blend-mode: multiply` scanlines right over the canvas (`.crt-screen::after`), and `backdrop-filter: blur(8px)` on the sticky navbar.
- **React (shared):** `GamePlayer` holds score / lives / level in `useState`; each engine callback re-renders the whole player tree (HUD, toolbar, TouchPad, GameScreen). The practice ticker does it every 220 ms.
- **Froggy renderer:** neon skin applies canvas `shadowBlur` (4–8 px) per car/truck/bus, fly, snake, frog and filled pad, every frame. `render()` also runs every rAF while ready / paused / game over, when nothing moves.

## Scope

**In:**

- `components/game-player.tsx`: add body class `game-play` in the existing `touch-play` effect (same add/remove lifecycle, only for registered engines).
- `components/game-player.tsx` (state diet). Principle: minimum `useState`; values that change during play live in `useRef` and update the DOM directly.
  - `scoreRef`, `livesRef`, `levelRef` hold the values; HUD `.v` nodes get refs (`scoreElRef`, `livesElRef`, `levelElRef`); a `paintHud()` helper writes `textContent` with today's formatting (`toLocaleString("en-US")`, `♥` repeat / `—`, `padStart(2, "0")`).
  - `onScore` / `onLives` / `onLevel` update the ref + `paintHud()`; no state set.
  - Remove `score`, `lives`, `engineLevel` states. Add `finalScore` state set once in `onGameOver` (modal + `saveScore` use it).
  - Minesweeper `canHint`: `scoreOver100` boolean state, set only when crossing 100 (at most one change per run).
  - Practice ticker writes `scoreRef` + `paintHud()` (level derived from score inside `paintHud`).
  - `restart()` resets refs and repaints the HUD; first render prints the initial values (SSR-safe, no hydration mismatch).
  - Other states (paused, over, signals, hints, save status, skins) stay: they change rarely.
- `app/globals.css`, rules scoped under `body.game-play` (other pages untouched):
  - `.av-bg::before`: `animation: none` (grid stays, static).
  - `.av-bg::after`: `mix-blend-mode: normal` with opacity tuned so scanlines look the same.
  - `.crt-screen::after`: `mix-blend-mode: normal`, plain `rgba(0,0,0,…)` stripes tuned to match the multiply look.
  - `.av-nav`: `backdrop-filter: none`, background made opaque enough to look the same.
  - Benefits every real game; only Froggy is measured.
- `lib/games/froggy/sprites.ts` (new): offscreen-canvas sprite cache per skin for glowing entities: car, truck, bus (both directions, windshield baked), fly, snake (both directions), frog (normal + dying color), filled-pad frog icon. Sprites drawn once with the same `shadowBlur` as today (≤ 8) and a glow margin; rebuilt only on skin change.
- `lib/games/froggy/draw.ts`: vehicles, fly, snake, frog, filled pads blit sprites via `drawImage`; no `shadowBlur` set in the per-frame path. Frog dim blink keeps using `globalAlpha`. Logs, turtles, background, timer, hint unchanged.
- `lib/games/froggy/engine.ts`: skip `render()` in the loop while `ready`, `paused` or `gameOver`, except one frame after a state change (dirty flag). `setAppearance` and `reset` still redraw immediately.
- FPS probe (Playwright, not shipped): rAF frame-time sampler via `browser_evaluate`, CPU 4× throttle via CDP (`browser_run_code_unsafe`), 10 s of active Froggy play.

**Out of scope (for future specs):**

- Engine fixes for asteroids, arkanoid, snake, tetris, minesweeper (only the shared CSS benefits them). Each gets its own spec if still slow.
- Mobile-specific tuning.
- Caching Froggy static background to an offscreen canvas.
- Removing per-frame allocations (`entityXs` arrays, `LANES.find`, rgba template strings).
- State audit of toolbars, TouchPad and other components; collapsing the remaining `GamePlayer` states.
- In-app FPS overlay / debug UI.
- Removing or restyling CRT effects; changing other pages' background.
- Any gameplay, scoring, skin palette or sound change.

## Data model

No new persisted data. New in-memory structure only:

| Name                                       | Where                         | Shape                                                                                                                            |
| ------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `FroggySprites`                            | `lib/games/froggy/sprites.ts` | `{ vehicle: Record<"car"\|"truck"\|"bus", Record<1\|-1, Sprite>>, fly, snake: Record<1\|-1, Sprite>, frog, frogDying, padIcon }` |
| `Sprite`                                   | same                          | `{ canvas: HTMLCanvasElement \| OffscreenCanvas; ox: number; oy: number }` (draw offset incl. glow margin)                       |
| `buildSprites(skin)`                       | same                          | returns `FroggySprites`; cached per skin in a `Map<FroggySkin, FroggySprites>`                                                   |
| `scoreRef` / `livesRef` / `levelRef`       | `components/game-player.tsx`  | `useRef<number>`; live HUD values, no re-render                                                                                  |
| `scoreElRef` / `livesElRef` / `levelElRef` | same                          | `useRef<HTMLDivElement>`; HUD `.v` nodes written by `paintHud()`                                                                 |
| `finalScore`                               | same                          | `useState<number>`; set once on game over                                                                                        |
| `scoreOver100`                             | same                          | `useState<boolean>`; minesweeper hint gate                                                                                       |
| `game-play` (body class)                   | `components/game-player.tsx`  | present while a registered game's player is mounted                                                                              |

`FrameView` (`draw.ts`) unchanged; sprites looked up inside `drawFrame` from the skin.

## Implementation plan

Each step leaves the app runnable.

1. **Baseline.** `npm run dev` (or use :3000 if running). Playwright: open `/games/froggy/play`, CPU 4× throttle, start game, sample rAF deltas 10 s while hopping. Save numbers (avg fps, p95 frame ms, frames > 33 ms) to `.playwright-mcp/logs/froggy-fps-baseline.log`.
2. **`game-play` body class** in `game-player.tsx` effect. Check: class present on `/games/froggy/play`, absent after navigating to `/games`.
3. **GamePlayer refs**: HUD via refs, remove `score` / `lives` / `engineLevel` states, add `finalScore` + `scoreOver100`. Check: React DevTools Profiler / render counter shows no `GamePlayer` render on score change; HUD updates; GAME OVER shows and saves the final score; restart resets the HUD; minesweeper HINT enables at 100; practice game HUD ticks.
4. **Cheaper page layers** under `body.game-play` in `globals.css` (4 rules above). Check: side-by-side screenshots before/after look the same; home/catalog unchanged.
5. **Froggy sprites**: add `sprites.ts`; switch `draw.ts` glowing entities to `drawImage`. Check: screenshots per skin (neon/retro/classic) match previous look; build + lint.
6. **Idle render skip** in `engine.ts` (dirty flag). Check: ready hint, PAUSED overlay, GAME OVER, skin switch while paused, reset all still show the right frame.
7. **Measure again** with the same probe; save to `.playwright-mcp/logs/froggy-fps-after.log`; compare with baseline.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] Baseline and after logs exist in `.playwright-mcp/logs/` with avg fps, p95 frame ms, frames > 33 ms.
- [ ] After (4× CPU throttle, 10 s active play): avg ≥ 55 fps and p95 frame ≤ 25 ms.
- [ ] After is better than baseline on avg fps and p95.
- [ ] `body.game-play` present on `/games/<id>/play` for registered games; absent on other routes after navigation.
- [ ] On the play page: no running CSS animation on `.av-bg::before`; no `mix-blend-mode` other than `normal` on `.av-bg::after` and `.crt-screen::after`; no `backdrop-filter` on `.av-nav`.
- [ ] Home, catalog, about, hall of fame keep current effects (grid animates, blends unchanged).
- [ ] `lib/games/froggy/draw.ts` per-frame path sets no `shadowBlur`; sprite build uses `shadowBlur` ≤ 8.
- [ ] Froggy screenshots (neon, retro, classic; playing + dying frog + fly + snake at level ≥ 3) look the same as before. Saved in `.playwright-mcp/screenshots`.
- [ ] While ready / paused / game over, `drawFrame` is not called every rAF (verified by counter in probe); skin change while paused redraws once.
- [ ] Froggy gameplay unchanged: hop, ride logs, turtles dive, squash, splash, timeout, pads, fly bonus, snake, level up, save score.
- [ ] `game-player.tsx` has no `score` / `lives` / `engineLevel` `useState`.
- [ ] During 10 s Froggy play, `GamePlayer` renders 0 times from score / lives / level changes (render counter in probe).
- [ ] HUD score / lives / level correct for every real game and a practice game; GAME OVER final score correct and saved to Supabase; restart resets the HUD.
- [ ] Minesweeper HINT button enables only at score ≥ 100 (unchanged behavior).
- [ ] No console errors / hydration warnings on `/games/froggy/play`.

## Decisions

- **Yes:** Shared CSS fix + Froggy engine only. Discarded: auditing all 6 engines now (own specs later).
- **Yes:** Keep CRT look, make it cheaper (stop grid animation, normal blending, no nav blur) only on play page via `body.game-play`. Discarded: removing effects; leaving CSS untouched.
- **Yes:** New `game-play` class. Discarded: reusing `touch-play` (name implies touch only).
- **Yes:** Pre-rendered glow sprites per skin. Same look, near-zero per-frame cost. Discarded: dropping glow on moving entities; just lowering blur.
- **Yes:** Skip render when idle. Discarded for now: static background cache, allocation cleanup (not selected).
- **Yes:** Playwright FPS probe with 4× CPU throttle, baseline first. Discarded: manual DevTools profiling; subjective "feels smooth".
- **Yes:** Refs + direct DOM writes for the HUD (rule: minimum `useState`, avoid re-renders). Discarded: `React.memo` on children only (player still re-renders); refactoring all states.
- **No:** In-app FPS overlay.
- **Yes:** Desktop is the target platform for measurement.

## Risks

| Risk                                                           | Mitigation                                                                             |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `normal` blend scanlines look different from multiply/overlay  | Tune alpha; compare screenshots in step 3.                                             |
| Sprite edges / sub-pixel blur differ from direct drawing       | Glow margin ≥ blur; draw at integer offsets of sprite; screenshot compare per skin.    |
| Idle skip leaves a stale frame (skin change, reset, game over) | Dirty flag set on every state change; `setAppearance`/`reset` keep direct `render()`.  |
| 4× throttle target unreachable on CI/slow machine              | Baseline-relative criterion too; record machine in logs.                               |
| Bottleneck is elsewhere (e.g. GPU/driver)                      | Baseline + after numbers show it; if no gain, findings go to a follow-up spec.         |
| HUD text out of sync after restart / hydration                 | `paintHud()` on mount and in `restart()`; initial JSX renders the same initial values. |
| Save uses a stale score                                        | `finalScore` state set from the engine's `onGameOver` value.                           |
| `game-play` class left on body after navigation                | Same effect cleanup as `touch-play` (runs on hide/unmount).                            |

## What is **not** in this spec

- Other engines' internals, mobile tuning, background cache, allocation cleanup, FPS overlay, visual restyle.

_Each one, if it lands, goes in its own spec._
