# SPEC 05 — Asteroids game integration

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-16
> **Objective:** Port the vanilla-JS Asteroids from `resources/started-games/02-asteroids` into a typed engine that runs inside the platform player at `/games/asteroids/play`, replacing the fake ROCKS entry.

## Why this spec exists

The catalog has a placeholder `rocks` entry whose player (`components/game-player.tsx`) only fakes a score ticker. A finished Asteroids game exists in `resources/started-games/02-asteroids/game.js` (single global script, 800×600 canvas, Spanish UI). This spec makes it the first real playable game, renamed to ASTEROIDS. `.crt-screen` is already 4:3, matching 800×600.

## Scope

**In:**

- Rename catalog entry `rocks` / `ROCKS` → `asteroids` / `ASTEROIDS` in `lib/games.ts`; update `long` copy (drop UFO mention, mention power-ups).
- Rename cover class `cover-rocas` → `cover-asteroids` (`lib/games.ts`, `app/globals.css`).
- Update home activity feed entry `g: "ROCKS"` → `"ASTEROIDS"` in `app/page.tsx`.
- Port `game.js` to TypeScript engine `lib/games/asteroids/engine.ts`: same physics, scoring, levels, power-ups (triple shot, shield).
- No globals: engine instance owns canvas, state, rAF loop and its keyboard listeners; `destroy()` removes all.
- Engine states: `ready` → `playing` ⇄ `dead` → `gameover`, plus `paused` flag.
- Ready screen in canvas: `PRESS SPACE OR CLICK TO START`.
- Neon recolor of vector art to platform palette.
- Power-up timers (`TRIPLE 4s`, `SHIELD 3s`) drawn inside canvas, top-left.
- In-canvas HUD for score/lives/level removed; React HUD (`.player-hud`) shows Player, Score, Lives, Level from engine callbacks.
- Platform GAME OVER modal + SAVE SCORE (existing `saveScore` → localStorage `av_scores`) replaces engine's Space-to-restart overlay.
- PAUSE button, `P` and `Esc` toggle pause; auto-pause when tab hidden. END ends run → modal. PLAY AGAIN → engine reset to ready. EXIT unchanged.
- All game strings in English.
- Touch devices: note `KEYBOARD REQUIRED` under the CRT.
- Other games keep the fake player unchanged.

**Out of scope (for future specs):**

- Touch / on-screen controls.
- Persisting scores in Supabase, real leaderboards.
- Sound, UFOs, the README's "shooting star" asteroid.
- Real engines for other catalog games.
- Generic multi-game engine registry / plugin system.
- Migrating old `av_scores` rows with `game: "rocks"`.

## Data model

```ts
// lib/games/asteroids/engine.ts
export type AsteroidsState = "ready" | "playing" | "dead" | "gameover";

export interface AsteroidsCallbacks {
  onScore(score: number): void;
  onLives(lives: number): void;
  onLevel(level: number): void;
  onGameOver(finalScore: number): void;
}

export interface AsteroidsGame {
  setPaused(paused: boolean): void; // freezes update, keeps drawing last frame
  end(): void; // force gameover → onGameOver(score)
  reset(): void; // new run, back to "ready"
  destroy(): void; // cancel rAF, remove listeners
}

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsGame;
```

Constants kept from original: `W = 800`, `H = 600`, `RADII [0,16,30,50]`, `SPEEDS [0,85,55,32]`, `POINTS [0,100,50,20]`, 3 lives, `TRIPLE_SHOT_DURATION = 5`, `SHIELD_DURATION = 5`, dt clamp 0.05.

Callbacks fire only on change (not every frame).

Palette (canvas, hex from `app/globals.css` vars):

| Element                | Color                 |
| ---------------------- | --------------------- |
| Background             | `#000`                |
| Ship                   | `#00f5ff` (cyan) glow |
| Thruster flame         | `#f5ff00` (yellow)    |
| Asteroids              | `#ff006e` (magenta)   |
| Bullets                | `#e6e9ff` (ink)       |
| Power-ups, shield ring | `#00ff88` (green)     |
| Particles              | `#e6e9ff`, fading     |
| Canvas text            | `--pixel` font family |

Glow via `shadowBlur` kept small (≤ 8) for perf.

Catalog entry after rename:

```ts
{ id: "asteroids", title: "ASTEROIDS", cover: "cover-asteroids", cat: "SHOOTER", color: "yellow", best: 41200, plays: "15.6K", ... }
```

New files:

- `lib/games/asteroids/engine.ts` — engine (may split entities into `lib/games/asteroids/entities.ts` if > ~400 lines).
- `components/asteroids-screen.tsx` — client; renders `<canvas width={800} height={600}>` filling `.crt-screen`, creates engine in `useEffect`, destroys on cleanup; props: `paused`, `runId`, callbacks; exposes `end` via ref or `endSignal` prop.

Changed files: `lib/games.ts`, `app/globals.css`, `app/page.tsx`, `components/game-player.tsx`.

Conventions:

- Next.js 16 has breaking changes: read `node_modules/next/dist/docs/01-app` (client components, `useEffect` / refs) before writing code.
- Engine is framework-free TS; only `components/asteroids-screen.tsx` touches React.
- Engine created only client-side in `useEffect` → no SSR `window`/`document` access; safe under Strict Mode double mount.
- `preventDefault` on game keys (arrows, Space) only while engine mounted and state ≠ paused overlay.
- `GamePlayer` branches on `game.id === "asteroids"`: real screen + engine-driven HUD; otherwise current fake behavior.
- Canvas scaled by CSS (`width:100%; height:100%`), internal resolution stays 800×600.
- UI follows `/frontend-design` per `CLAUDE.md`; reuse existing `.crt`, `.player-hud`, `.modal` styles.

## Implementation plan

1. Rename catalog: `lib/games.ts` (`asteroids`, `ASTEROIDS`, new `long`, `cover-asteroids`), `app/globals.css` cover class, `app/page.tsx` feed entry. Check: `/games/asteroids` and `/games/asteroids/play` 200 (fake player), `/games/rocks` 404, cover renders.
2. Create `lib/games/asteroids/engine.ts`: port entities + update/draw from `game.js`, wrapped in `createAsteroidsGame`, English strings, original white colors. Check: `npm run build` + `npm run lint` pass.
3. Add `ready` state, `setPaused`, `end`, `reset`, `destroy`, callbacks; remove in-canvas score/lives/level HUD and Space-restart overlay; keep power-up timers in canvas. Check: build + lint pass.
4. Create `components/asteroids-screen.tsx`; in `GamePlayer` render it for `asteroids` inside `.crt-screen`, wire HUD (score, lives ♥, level) from callbacks, disable fake ticker for this game. Check: game playable at `/games/asteroids/play`, HUD updates.
5. Wire controls: PAUSE button + `P`/`Esc`, `visibilitychange` auto-pause, END → `end()`, `onGameOver` → modal, PLAY AGAIN → `reset()`, SAVE SCORE → `saveScore({ game: "asteroids", ... })`. Check: full loop manual.
6. Neon recolor + `KEYBOARD REQUIRED` note on touch (`(pointer: coarse)`). Check: visual pass via Playwright screenshot.

## Acceptance criteria

- [x] `npm run build` and `npm run lint` pass.
- [x] `lib/games.ts` has no `rocks` id; catalog/home show `ASTEROIDS`; `/games/rocks` returns 404.
- [x] No `ROCKS` / `cover-rocas` string remains in `app/`, `components/`, `lib/`.
- [x] `/games/asteroids/play` shows a canvas inside `.crt-screen` with `PRESS SPACE OR CLICK TO START`; asteroids do not hit the ship before start.
- [x] Space or click starts the run; arrows rotate/thrust, Space fires.
- [x] Arrow keys and Space do not scroll the page while on the play page.
- [x] Destroying a large/medium/small asteroid adds exactly 20/50/100 to the React HUD score.
- [x] Lives HUD starts at 3 ♥ and drops by one on ship death; Level HUD increments when field is cleared.
- [x] Triple-shot and shield power-ups drop, work for 5s, and show their timers inside the canvas.
- [x] PAUSE button, `P` and `Esc` each freeze the game and show the PAUSED overlay; same key resumes.
- [x] Switching tabs pauses the game.
- [x] Losing all lives or pressing END opens GAME OVER modal with the engine's final score.
- [x] SAVE SCORE writes `{ game: "asteroids", score, name, at }` to `localStorage.av_scores`.
- [x] PLAY AGAIN returns to the ready screen with score 0, 3 lives, level 1.
- [x] Leaving the page (EXIT / BACK TO VAULT) stops the rAF loop and removes keyboard listeners (no console errors, no stray keydown handling on other pages).
- [x] Canvas colors: ship cyan, asteroids magenta, power-ups green.
- [x] No Spanish strings in the game.
- [x] Other games' play pages behave as before (fake ticker).
- [x] No hydration warning and no console errors on `/games/asteroids/play`.
- [x] At 390px width the canvas scales to fit with no horizontal scroll; `KEYBOARD REQUIRED` note visible on touch emulation.

## Decisions

- **Yes:** Reuse catalog slot, renamed `rocks` → `asteroids`. Keeps cover art, stats and seeded hall-of-fame. Discarded: second asteroid entry (duplicate).
- **Yes:** Typed engine module + React HUD via callbacks. Platform owns HUD, pause and game-over flow. Discarded: canvas-only HUD (duplicates platform UI); iframe of original files (no typed integration, postMessage glue).
- **Yes:** Engine framework-free with explicit `destroy()`. Survives Strict Mode remounts and route changes.
- **Yes:** Ready screen before first run. Gives focus and avoids instant death. Discarded: auto-start on mount.
- **Yes:** Neon recolor to platform palette. Matches CRT theme. Discarded: original white art.
- **Yes:** Power-up timers inside canvas. Avoids React re-render per tick. Discarded: React HUD boxes.
- **Yes:** Buttons + `P`/`Esc` + tab-hidden auto-pause.
- **Yes:** Scores via existing `saveScore` (localStorage). Discarded: Supabase now (own spec).
- **No:** Touch controls. Own spec.
- **No:** Migrating old `rocks` scores. Data is local fake data.
- **Yes:** Rename CSS class to `cover-asteroids` for consistency.

## Risks

| Risk                                                   | Mitigation                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Strict Mode double effect → two loops / duplicate keys | `destroy()` cancels rAF + removes listeners; criterion checks cleanup.  |
| Global key listener blocks typing in SAVE SCORE input  | Ignore keys when `gameover` or event target is an input.                |
| `shadowBlur` glow tanks FPS                            | Keep blur ≤ 8; drop glow on particles.                                  |
| Callbacks every frame cause React re-render storm      | Fire only on value change.                                              |
| Old `av_scores` rows with `game: "rocks"` orphaned     | Accepted; local fake data.                                              |
| Canvas text font not loaded when first drawn           | Use `--pixel` family with monospace fallback; redraw each frame anyway. |

## What is **not** in this spec

- Touch controls, sound, UFOs, shooting-star asteroid.
- Supabase scores, real leaderboards, score migration.
- Real engines for other games, generic engine registry.

Each one, if it lands, goes in its own spec.
