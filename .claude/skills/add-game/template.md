# Template — game integration spec (engine + leaderboard)

Shape of the single spec `/add-game` writes. Not copied verbatim: fill `<...>` with real values from the source game and the user's answers. Standard markdown only, no TODOs, no long code.

---

## Header

```markdown
# SPEC NN — <TITLE> game integration

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06
> **Date:** YYYY-MM-DD
> **Objective:** One sentence: port <source> into a typed engine playable at `/games/<id>/play` with a real leaderboard.
```

## Why this spec exists

Source (`resources/started-games/<dir>` or new idea), current catalog state, what the platform already gives (HUD, modal, Server Action, boards), what is missing.

## Scope

**In** (fixed items always present, add game-specific ones):

- Catalog entry `<id>` / `<TITLE>` in `lib/games.ts` (+ `.cover-<id>` in `app/globals.css`).
- Engine `lib/games/<id>/engine.ts`: same physics, scoring, levels as source; list the key mechanics.
- No globals; engine owns canvas, state, rAF loop, listeners; `destroy()` removes all.
- States `ready` → `playing` → `gameover`, plus `paused` flag. Ready text `<text>`.
- React HUD from callbacks (Player, Score, Lives, Level); in-canvas HUD and restart overlay removed.
- Neon recolor to platform palette.
- Pause: button, `P`, `Esc`, tab hidden. END → modal. PLAY AGAIN → ready.
- English strings only.
- Leaderboard: migration `add_<id>_leaderboard` inserting the `games` row; SAVE SCORE enabled; Hall tab, detail board, card best and home feeds appear automatically.
- _(only if no registry)_ Generic engine registry refactor (see step 1).

**Out of scope (for future specs):** touch controls, sound (if dropped), auth, anti-cheat, realtime, other games' engines, game-specific extras the user deferred.

## Data model

Always include, with real names:

```ts
// lib/games/engine-types.ts (new only if the registry does not exist yet)
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

// lib/games/<id>/engine.ts
export function create<Name>Game(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameEngine;

// lib/games/registry.ts
// id -> { create, width, height, lives: number | null, keyboardRequired: boolean }
```

Then:

- **Constants table** from the source (canvas size, speeds, scoring per event, lives, level rules).
- **Palette table** element → hex (platform palette).
- **Catalog entry** snippet (no `best`).
- **Migration** `add_<id>_leaderboard`: `insert into public.games (id, title) values ('<id>', '<TITLE>');`
- Callbacks fire only on change. Lives `null` → HUD shows `—`.

Conventions: Next.js 16 breaking changes, read `node_modules/next/dist/docs/01-app` before code; engine framework-free; UI per `/frontend-design`; `preventDefault` on game keys only while mounted and not typing in an input.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. _(only if no registry)_ Registry refactor: `lib/games/engine-types.ts`, `lib/games/registry.ts`, generic `components/game-screen.tsx` replacing `components/asteroids-screen.tsx`; `components/game-player.tsx` uses registry lookup instead of `game.id === "asteroids"`; fix hardcoded `/games/asteroids/play` links in `components/hall-of-fame.tsx` and `app/games/[id]/page.tsx`. Check: asteroids unchanged, build + lint pass.
2. Catalog entry/rename + cover CSS. Check: `/games/<id>` renders (fake player still).
3. Port engine to `lib/games/<id>/engine.ts` with source constants, English strings. Check: build + lint.
4. Add `ready` state, `setPaused`, `end`, `reset`, `destroy`, callbacks; remove in-canvas HUD/restart overlay. Check: build + lint.
5. Register in registry; HUD wired in `GamePlayer`. Check: playable at `/games/<id>/play`.
6. Pause/END/PLAY AGAIN flows + neon recolor (+ assets/sound if in scope). Check: Playwright screenshot.
7. Apply migration `add_<id>_leaderboard` via Supabase MCP. Check: `execute_sql` shows the row; saving a run inserts a score; Hall tab appears.

## Acceptance criteria

Prefill, replace values, add game-specific ones. All boolean.

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `/games/<id>/play` shows a canvas in `.crt-screen` with `<ready text>`; nothing kills the player before start.
- [ ] Controls: `<keys>` work; arrows/Space do not scroll the page.
- [ ] Scoring: `<event>` adds exactly `<n>` to the HUD score (one line per event).
- [ ] Lives HUD `<starts at N / shows —>`; Level HUD `<rule>`.
- [ ] PAUSE button, `P`, `Esc` freeze and show PAUSED; same key resumes; tab switch pauses.
- [ ] Losing or END opens GAME OVER with the engine's final score.
- [ ] PLAY AGAIN returns to ready with score 0 and initial lives/level.
- [ ] Leaving the page stops rAF and removes listeners; no console errors.
- [ ] Colors follow the palette table; no Spanish strings.
- [ ] `public.games` contains row `<id>` / `<TITLE>`.
- [ ] SAVE SCORE inserts one `scores` row (`game_id = '<id>'`, uppercase name, modal score), verified with `execute_sql`.
- [ ] Hall of Fame tabs are `GLOBAL` + real games in catalog order, including `<TITLE>`; `<TITLE>` tab shows the saved score.
- [ ] `/games/<id>` TOP SCORES and Global best read from Supabase; empty state before any score.
- [ ] Library card BEST SCORE for `<id>` equals DB max.
- [ ] GLOBAL totals count `<id>` in `games`.
- [ ] Other games unchanged: asteroids still real; fake games show `PRACTICE RUN — SCORE NOT RECORDED`.
- [ ] No hydration warnings on `/`, `/games`, `/hall-of-fame`, `/games/<id>`, `/games/<id>/play`.
- [ ] At 390px width the canvas scales with no horizontal scroll.

## Decisions

Yes/No list with reasons. Always include the inherited ones (typed framework-free engine, ready screen, platform HUD/modal, neon recolor, Server Action save, `games` row = has leaderboard, generic registry over per-id branching) plus the user's answers (catalog slot, HUD mapping, canvas, assets/sound, touch). Discarded alternatives named.

## Risks

Only non-obvious ones, e.g.: Strict Mode double effect (mitigation `destroy()`), key listener blocking SAVE SCORE input, `shadowBlur` FPS, callback re-render storm, source-specific risks (audio autoplay, spritesheet loading, canvas size mismatch), score outside 0..10,000,000.

## What is **not** in this spec

Repeat the Out list. End with: _Each one, if it lands, goes in its own spec._
