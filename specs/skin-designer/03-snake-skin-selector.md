# SPEC SKIN-03 — SNAKE skin selector

> **Status:** Implemented
> **Depends on:** SPEC 09 (snake game), SPEC 07 (tetris toolbar pattern)
> **Date:** 2026-10-21
> **Objective:** Add a canvas-only `SKIN` selector (`neon` / `retro` / `classic`) under the CRT at `/games/snake/play`, persisted per browser, redrawing immediately.

## Why this spec exists

Tetris has a skin toolbar (`components/tetris-toolbar.tsx`, `setAppearance` on its engine). Snake (`lib/games/snake/engine.ts`, `lib/games/snake/draw.ts`) has no skin concept: colors are hardcoded in `draw.ts` (`GREEN`, `MAGENTA`, body `rgba(0, 255, 136, 0.7)`, grid `rgba(230, 233, 255, 0.06)`, background `#000`, hint `rgba(230, 233, 255, 0.7)`). `drawFrame` receives a `FrameView` with no appearance field. There is no `components/snake-toolbar.tsx`. The engine key handler already ignores `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON` targets (`IGNORED_TARGETS`), so a `<select>` is safe. Fruits are drawn from the sprite sheet in `lib/games/snake/sprites.ts`; only the sprite-missing fallback square is a flat color.

## Scope

**In:**

- `lib/games/snake/draw.ts`: `SnakeSkin` type, `PALETTES: Record<SnakeSkin, Palette>`, `FrameView.skin`, palette lookup replacing the color constants and literals.
- `lib/games/snake/engine.ts`: `SnakeEngine extends GameEngine` with `setAppearance(skin)`, immediate redraw (also while paused / ready / gameover / serve).
- Skins `neon` (current look, default), `retro`, `classic`. Canvas-only; HUD, modal and CRT untouched.
- Toolbar `components/snake-toolbar.tsx`: `SKIN` select, uppercase labels, blur after change, hook `useSnakeSkin` (localStorage `av_snake_skin`, read after mount, try/catch, SSR-stable).
- Wiring in `components/game-screen.tsx` and `components/game-player.tsx`; toolbar visible only for snake.
- `shadowBlur` ≤ 8 in every skin.

**Out of scope (for future specs):** LIGHT/DARK theme, new gameplay, per-skin fruit sprites / new image assets, rounded or segmented snake art, sound, platform-wide theming, touch controls, other games' skins.

## Data model

```ts
// lib/games/snake/draw.ts
export type SnakeSkin = "neon" | "retro" | "classic";

// lib/games/snake/engine.ts
export interface SnakeEngine extends GameEngine {
  setAppearance(skin: SnakeSkin): void; // redraws now
}
export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): SnakeEngine;

// components/snake-toolbar.tsx
export function useSnakeSkin(): readonly [SnakeSkin, (next: SnakeSkin) => void];
export function SnakeToolbar(props: {
  skin: SnakeSkin;
  onChange(next: SnakeSkin): void;
}): JSX.Element;
```

`FrameView` gains `skin: SnakeSkin`. `lib/games/registry.ts` entry unchanged (`EngineEntry.create` still returns `GameEngine`; the narrower return type is assignable).

**Constants:**

| Constant      | Value                                               |
| ------------- | --------------------------------------------------- |
| Canvas        | 640×480, `COLS 20 × ROWS 15`, `CELL 32` (unchanged) |
| Head glow     | `shadowBlur` 8 neon, 0 retro, 0 classic (all ≤ 8)   |
| Segment inset | 1 px per side (unchanged)                           |
| Fruit sprites | unchanged in all skins                              |
| Storage key   | `av_snake_skin`                                     |
| Default skin  | `neon`                                              |
| Options order | `NEON`, `RETRO`, `CLASSIC`                          |
| Hint font     | unchanged (`--pixel` resolved from canvas, 12px)    |

**Palette (exact values):**

| Element                   | `neon` (platform)           | `retro` (muted CRT)         | `classic` (flat original) |
| ------------------------- | --------------------------- | --------------------------- | ------------------------- |
| Background                | `#000000`                   | `#06100d`                   | `#000000`                 |
| Grid lines                | `rgba(230, 233, 255, 0.06)` | `rgba(217, 210, 184, 0.06)` | none (not drawn)          |
| Snake head                | `#00ff88`                   | `#7dae7a`                   | `#00ff00`                 |
| Snake body                | `rgba(0, 255, 136, 0.7)`    | `rgba(125, 174, 122, 0.7)`  | `#00c800`                 |
| Fruit fallback square     | `#ff006e`                   | `#b8607a`                   | `#ff0000`                 |
| Hint text                 | `rgba(230, 233, 255, 0.7)`  | `rgba(217, 210, 184, 0.7)`  | `#ffffff`                 |
| Head glow (`shadowColor`) | `#00ff88`, blur 8           | none (blur 0)               | none (blur 0)             |

`neon` values equal the current constants, so the default look is pixel-identical to today.

**Input notes:** no engine key change needed; `IGNORED_TARGETS` already includes `SELECT`. `GamePlayer` P/Esc handler is unchanged (toolbar blur after change keeps focus off the select). Canvas click-to-start is unaffected.

**Conventions:** Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`, hydration) before writing code. Engine stays framework-free; only `components/game-screen.tsx` and the toolbar touch React. UI per `/frontend-design`; reuse `.tetris-toolbar` / `.tt-field` styles from `app/globals.css` (no new CSS). Skin stored in an engine-local `let skin: SnakeSkin = "neon"` passed to `drawFrame` every render; not recreating the engine.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. Palette refactor in `lib/games/snake/draw.ts`: add `SnakeSkin`, `Palette`, `PALETTES` (values above), `skin` in `FrameView`; replace `GREEN`/`MAGENTA`, body/grid/hint/background literals with palette fields; set `shadowColor`/`shadowBlur` only when glow > 0; skip `drawGrid` when palette grid is `null`. `engine.ts` passes `skin: "neon"` for now. Check: build + lint; snake looks identical to before.
2. Engine: add `let skin`, `setAppearance(next)` (assign, call `render()` immediately), type `SnakeEngine`, pass `skin` into `drawFrame`. Check: build + lint; calling `setAppearance("retro")` while paused repaints without a frame tick and does not touch score, lives, level or snake position.
3. Create `components/snake-toolbar.tsx` (`useSnakeSkin`, `SnakeToolbar`, `SKINS = ["neon","retro","classic"]`, key `av_snake_skin`, mirrors tetris hook structure). Check: build + lint; no hydration warning.
4. Wire `components/game-screen.tsx`: optional prop `snakeSkin?: SnakeSkin`, effect `(gameRef.current as Partial<SnakeEngine> | null)?.setAppearance?.(snakeSkin)` guarded by `snakeSkin !== undefined`, deps `[snakeSkin, entry]`. Wire `components/game-player.tsx`: `isSnake = game.id === "snake"`, `useSnakeSkin()`, pass `snakeSkin={isSnake ? skin : undefined}`, render `<SnakeToolbar>` under `.crt` beside the other toolbars. Check: toolbar shows only on `/games/snake/play`; absent on tetris, arkanoid, asteroids.
5. Verify with Playwright (screenshots to `.playwright-mcp/screenshots`): neon, retro, classic in ready state; classic while paused; after GAME OVER; reload persistence. Check: screenshots match the palette table; arrows still steer after changing skin.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `lib/games/snake/draw.ts` exports `SnakeSkin = "neon" | "retro" | "classic"`; `lib/games/snake/engine.ts` exports `SnakeEngine` with `setAppearance(skin)`.
- [ ] `components/snake-toolbar.tsx` exists; select labelled `SKIN` with options `NEON`, `RETRO`, `CLASSIC` in that order.
- [ ] Default (no localStorage) is `neon` and renders identically to the pre-spec build.
- [ ] Choice persists in `localStorage["av_snake_skin"]` and survives reload; invalid or blocked storage falls back to `neon`.
- [ ] Changing skin redraws the canvas immediately in ready, while paused, in serve (after a lost life) and after GAME OVER.
- [ ] Changing skin does not reset score, lives, level, snake or fruit.
- [ ] Select loses focus after change; arrows/WASD afterwards steer the snake.
- [ ] With the select focused, arrows/WASD/Space do not steer or start the game.
- [ ] `neon` colors match the palette table exactly (head `#00ff88`, fallback fruit `#ff006e`).
- [ ] `classic` uses head `#00ff00`, body `#00c800` on `#000000` with no grid and no glow.
- [ ] `retro` and `classic` have `shadowBlur` 0; `neon` uses 8; no skin exceeds 8.
- [ ] Fruit sprites render identically in all three skins.
- [ ] Toolbar is present only at `/games/snake/play` (absent for tetris, arkanoid, asteroids, practice games).
- [ ] No hydration warnings on `/games/snake/play`; no console errors on leaving the page.
- [ ] Toolbar fits at 390px width with no horizontal scroll.

## Decisions

- **Yes:** Three skins only (`neon`, `retro`, `classic`), no theme toggle. Discarded: copying tetris LIGHT/DARK.
- **Yes:** Default `neon`, identical to current look. No behavior change for existing players. Discarded: default `classic`.
- **Yes:** `classic` = flat green (`#00ff00` head, `#00c800` body) and red fallback fruit on black, no grid, no glow. Evokes the original monochrome-era snake with flat fills. Discarded: Nokia LCD green-on-olive (too far from the CRT frame); all-white (indistinguishable head/body).
- **Yes:** `retro` = muted phosphor tones on `#06100d`, no glow; same hues family as asteroids SKIN-01 for platform consistency. Discarded: scanline/curvature effects (CRT frame already exists).
- **Yes:** Fruit sprites unchanged across skins. Sprite sheet is shared art; recoloring needs new assets. Discarded: tinting sprites with canvas filters (cost, blurry pixel art).
- **Yes:** Separate `snakeSkin` prop on `GameScreen` instead of generalizing the tetris-specific `appearance` prop. Tetris takes `(skin, theme)`, snake takes `(skin)`; `muted` (arkanoid) and the asteroids skin spec set the per-game-prop precedent and tetris stays untouched. Discarded: generic `appearance` refactor (larger blast radius, tetris regression risk).
- **Yes:** Reuse `.tetris-toolbar` / `.tt-field` CSS classes. Zero new CSS. Discarded: rename to `.skin-toolbar` (touches other toolbars' markup).
- **Yes:** No engine key-handler change; `SELECT` already ignored. Discarded: duplicating the guard.
- **Yes:** Skin passed to `drawFrame` via `FrameView`, not module-level state. `draw.ts` stays pure and Strict-Mode safe. Discarded: module-level `palette` (shared across double-mounted engines).
- **No:** Per-skin snake geometry (rounded/segmented). Hitboxes and visuals share the cell grid.

## Risks

| Risk                                                    | Mitigation                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Skin change invisible while paused (loop still renders) | `setAppearance` calls `render()` directly.                                   |
| Engine created before stored skin is read (flash neon)  | `GameScreen` skin effect runs right after creation; one-frame neon accepted. |
| `render()` in `setAppearance` fires callbacks           | `syncCallbacks` is change-detected; values unchanged → no callbacks.         |
| Classic head/body contrast low                          | `#00ff00` vs `#00c800`; verify in screenshot.                                |
| `ctx.shadowBlur` leaks to later draws                   | Keep `save()`/`restore()` around the head glow; none for glow-less skins.    |

## What is **not** in this spec

- LIGHT/DARK theme, new gameplay, per-skin fruit sprites / image assets, rounded or segmented snake art.
- Sound, platform-wide theming, touch controls, other games' skins.

_Each one, if it lands, goes in its own spec._
