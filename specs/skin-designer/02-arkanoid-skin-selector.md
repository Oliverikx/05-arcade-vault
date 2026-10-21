# SPEC SKIN-02 — ARKANOID skin selector

> **Status:** Approved
> **Depends on:** SPEC 08 (arkanoid integration), SPEC 07 (tetris toolbar pattern)
> **Date:** 2026-10-21
> **Objective:** Add a canvas-only `SKIN` selector (`neon` / `retro` / `classic`) to the existing toolbar under the CRT at `/games/arkanoid/play`, persisted per browser, redrawing immediately.

## Why this spec exists

Tetris has a skin toolbar (`components/tetris-toolbar.tsx`, `setAppearance` on its engine). Arkanoid has a toolbar (`components/arkanoid-toolbar.tsx`) but it only holds the `SOUND ON` / `SOUND OFF` toggle (`useArkanoidMuted`, key `av_arkanoid_muted`). `lib/games/arkanoid/draw.ts` has no skin concept: colors are hardcoded module constants (`BG`, `BANNER_COLOR`, `HINT_COLOR`, `PADDLE_COLOR`, `BALL_COLOR`, `ROW_HEX`) plus literals (`#fff` break flash, `rgba(0, 0, 0, 0.45)` brick border, glow blur 8 / 6). `ArkanoidEngine` only exposes `setMuted`. The engine key handler already ignores `INPUT` / `SELECT` / `TEXTAREA` / `BUTTON` targets, so a `<select>` is safe.

## Scope

**In:**

- `lib/games/arkanoid/draw.ts`: `ArkanoidSkin` type, `PALETTES` table replacing the color constants, `FrameView.skin`, glow skipped when palette glow is 0.
- `lib/games/arkanoid/engine.ts`: `ArkanoidEngine` gains `setAppearance(skin)`, immediate redraw (also while paused / ready / gameover). Re-exports `ArkanoidSkin`.
- Skins `neon` (current look, default), `retro`, `classic`. Canvas-only; HUD, modal, CRT untouched.
- `components/arkanoid-toolbar.tsx` (extended, not rewritten): `SKIN` select with uppercase labels, blur after change, hook `useArkanoidSkin` (localStorage `av_arkanoid_skin`, read after mount, try/catch, SSR-stable). Sound toggle kept as is.
- Wiring in `components/game-screen.tsx` and `components/game-player.tsx`; toolbar already visible only for arkanoid.
- `shadowBlur` ≤ 8 in every skin.

**Out of scope (for future specs):** LIGHT/DARK theme, new gameplay or levels, sprites/image assets, per-skin sounds, per-skin brick shapes or paddle silhouettes, platform-wide theming, other games' skins.

## Data model

```ts
// lib/games/arkanoid/draw.ts
export type ArkanoidSkin = "neon" | "retro" | "classic";
// FrameView gains: skin: ArkanoidSkin

// lib/games/arkanoid/engine.ts
export type { ArkanoidSkin } from "./draw";
export interface ArkanoidEngine extends GameEngine {
  setMuted(muted: boolean): void;
  setAppearance(skin: ArkanoidSkin): void; // redraws now
}

// components/arkanoid-toolbar.tsx
export function useArkanoidSkin(): readonly [
  ArkanoidSkin,
  (next: ArkanoidSkin) => void,
];
export function ArkanoidToolbar(props: {
  muted: boolean;
  onChange(next: boolean): void; // sound (unchanged)
  skin: ArkanoidSkin;
  onSkinChange(next: ArkanoidSkin): void;
}): JSX.Element;
```

`lib/games/registry.ts` entry unchanged (`create` return type widens; `EngineEntry.create` still returns `GameEngine`).

**Constants:**

| Constant                   | Value                                                   |
| -------------------------- | ------------------------------------------------------- |
| Canvas                     | 640×480 (unchanged)                                     |
| Paddle glow (`shadowBlur`) | `8` neon, `0` retro, `0` classic                        |
| Ball glow (`shadowBlur`)   | `6` neon, `0` retro, `0` classic                        |
| Brick border               | `rgba(0, 0, 0, 0.45)`, 1px, all skins (unchanged)       |
| Storage key                | `av_arkanoid_skin`                                      |
| Default skin               | `neon`                                                  |
| Options order              | `NEON`, `RETRO`, `CLASSIC`                              |
| Hint text                  | the palette hint color is the stated RGB at alpha `0.7` |
| Font                       | unchanged (`--pixel` resolved from canvas)              |

**Palette (exact hex):**

| Element                     | `neon` (platform) | `retro` (muted CRT) | `classic` (flat original) |
| --------------------------- | ----------------- | ------------------- | ------------------------- |
| Background                  | `#000000`         | `#06100d`           | `#000000`                 |
| Brick `gray` (row 0)        | `#e6e9ff`         | `#c9c6b4`           | `#bcbcbc`                 |
| Brick `red`                 | `#ff006e`         | `#b8506a`           | `#fc0000`                 |
| Brick `yellow`              | `#f5ff00`         | `#d4a64a`           | `#fcfc00`                 |
| Brick `cyan`                | `#00f5ff`         | `#6fb7b0`           | `#00fcfc`                 |
| Brick `magenta`             | `#aa00ff`         | `#8a64a8`           | `#fc00fc`                 |
| Brick `hotpink`             | `#ff7700`         | `#c8803c`           | `#fc7400`                 |
| Brick `green`               | `#00ff88`         | `#7dae7a`           | `#00fc00`                 |
| Brick break flash (frame 0) | `#ffffff`         | `#efe8cc`           | `#ffffff`                 |
| Paddle                      | `#00f5ff`         | `#6fb7b0`           | `#bcbcbc`                 |
| Ball                        | `#e6e9ff`         | `#d9d2b8`           | `#fcfcfc`                 |
| Banner (LEVEL N / YOU WIN)  | `#f5ff00`         | `#d4a64a`           | `#fcfc00`                 |
| Hint text RGB (alpha 0.7)   | `230, 233, 255`   | `217, 210, 184`     | `252, 252, 252`           |
| Glow (`shadowColor`)        | element color     | none                | none                      |

`neon` values equal the current module constants, so the default look is pixel-identical to today. `classic` follows the 1986 arcade brick palette (silver, red, yellow, cyan, magenta, orange, green) with a silver paddle and flat fills.

**Input notes:** engine keeps its `document` listeners; `IGNORED_TARGETS` already contains `SELECT`, so no change. `GamePlayer` P/Esc handler skips only `INPUT` / `TEXTAREA`; blur after change keeps focus off the select (same as tetris).

**Conventions:** Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`, hydration) before writing code. Engine stays framework-free; only `components/game-screen.tsx` and the toolbar touch React. UI per `/frontend-design`; reuse `.tetris-toolbar` / `.tt-field` styles from `app/globals.css` (no new CSS unless the select needs a width tweak). Skin is applied by storing `skin` in the engine closure and passing it in `FrameView` each frame; no state migration, no engine recreation.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. Palette refactor in `lib/games/arkanoid/draw.ts`: add `ArkanoidSkin`, `PALETTES: Record<ArkanoidSkin, Palette>` (values above, incl. `glowPaddle`, `glowBall`, `flash`, `hint`), `FrameView.skin`; replace `BG`, `BANNER_COLOR`, `HINT_COLOR`, `PADDLE_COLOR`, `BALL_COLOR`, `ROW_HEX`, the `#fff` flash; skip `shadowColor` / `shadowBlur` when glow is 0. Engine passes `skin: "neon"` for now. Check: build + lint; arkanoid looks identical to before.
2. Engine: `skin` variable (default `neon`), pass it in `render()`; add `setAppearance(skin)` (assign, then `render()`); extend `ArkanoidEngine`; re-export `ArkanoidSkin`. Check: build + lint; `setAppearance("retro")` while paused repaints without a frame tick; score / lives / blocks / ball untouched.
3. Extend `components/arkanoid-toolbar.tsx`: `SKINS = ["neon","retro","classic"]`, key `av_arkanoid_skin`, `useArkanoidSkin`, `SKIN` select (same markup as tetris `tt-field`, uppercase labels, `e.currentTarget.blur()`), new props `skin` / `onSkinChange`; sound toggle unchanged. Check: build + lint; no hydration warning.
4. Wire `components/game-screen.tsx`: optional prop `arkanoidSkin?: ArkanoidSkin`, effect mirroring the `muted` one (`(gameRef.current as Partial<ArkanoidEngine> | null)?.setAppearance?.(skin)`, guarded by `undefined`, deps `[arkanoidSkin, entry]`). Wire `components/game-player.tsx`: `useArkanoidSkin()`, pass `arkanoidSkin={isArkanoid ? skin : undefined}`, pass `skin` / `onSkinChange` to `<ArkanoidToolbar>`. Check: select visible only on `/games/arkanoid/play`; absent on tetris and other games.
5. Verify with Playwright (screenshots to `.playwright-mcp/screenshots`): neon, retro, classic at ready; classic while paused with bricks mid-run; reload persistence. Check: screenshots match the palette table; mouse and keyboard still control the paddle after changing skin.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `lib/games/arkanoid/engine.ts` exports `ArkanoidSkin = "neon" | "retro" | "classic"` and `ArkanoidEngine` with `setAppearance(skin)` and `setMuted`.
- [ ] `components/arkanoid-toolbar.tsx` has a select labelled `SKIN` with options `NEON`, `RETRO`, `CLASSIC` in that order, plus the existing `SOUND ON` / `SOUND OFF` toggle.
- [ ] Default (no localStorage) is `neon` and renders identically to the pre-spec build.
- [ ] Choice persists in `localStorage["av_arkanoid_skin"]` and survives reload; invalid or blocked storage falls back to `neon`.
- [ ] `av_arkanoid_muted` behavior is unchanged.
- [ ] Changing skin redraws the canvas immediately in `ready`, while paused, and in `gameover`.
- [ ] Changing skin does not reset score, lives, level, bricks, ball or paddle position.
- [ ] Select loses focus after change; arrows / Space afterwards control the paddle / launch, not the select.
- [ ] With the select focused, Space / arrow keys do not move the paddle or launch the ball.
- [ ] `neon` colors match the palette table exactly (paddle `#00f5ff`, ball `#e6e9ff`, red brick `#ff006e`).
- [ ] `retro` and `classic` have `shadowBlur` 0; `neon` uses 8 (paddle) and 6 (ball); no skin exceeds 8.
- [ ] `classic` bricks use `#bcbcbc`, `#fc0000`, `#fcfc00`, `#00fcfc`, `#fc00fc`, `#fc7400`, `#00fc00` by row order on `#000000`.
- [ ] Break animation uses the skin's flash and row color.
- [ ] Skin select is present only at `/games/arkanoid/play` (absent for tetris, asteroids, practice games).
- [ ] No hydration warnings on `/games/arkanoid/play`; no console errors on leaving the page.
- [ ] Toolbar fits at 390px width with no horizontal scroll.

## Decisions

- **Yes:** Three skins only (`neon`, `retro`, `classic`), no theme toggle. Brick-breaker look is color-driven. Discarded: copying tetris LIGHT/DARK.
- **Yes:** Default `neon`, identical to current look. No change for existing players. Discarded: default `classic`.
- **Yes:** Extend the existing `ArkanoidToolbar` instead of creating a second toolbar. One bar under the CRT, one element in `game-player.tsx`. Discarded: separate `ArkanoidSkinToolbar` (two stacked bars).
- **Yes:** `classic` = 1986 arcade brick colors, flat fills, silver paddle, black background. Discarded: blue playfield (readability, same bg as neon keeps ball contrast).
- **Yes:** `retro` = muted desaturated phosphor tones on a dark green-black background, no glow. Discarded: scanline / curvature effects (the CRT frame already exists).
- **Yes:** Add a separate `arkanoidSkin` prop on `GameScreen` instead of generalizing the tetris `appearance` prop. Tetris takes `(skin, theme)`, arkanoid `(skin)`; `muted` already sets the per-game-prop precedent and it leaves tetris untouched. Discarded: generic `appearance` refactor (larger blast radius, tetris regression risk).
- **Yes:** Keep the brick border `rgba(0,0,0,0.45)` and geometry in all skins. Hitboxes and layout shared. Discarded: per-skin brick shapes.
- **Yes:** `render()` after `setAppearance` rather than waiting for rAF. Required so a paused / gameover canvas updates at once. Discarded: relying on the loop (it keeps drawing, but not guaranteed on a cancelled loop).
- **No:** Engine key-handler change. `SELECT` and `BUTTON` are already ignored.

## Risks

| Risk                                                    | Mitigation                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Engine created before stored skin read (flash of neon)  | `GameScreen` skin effect runs after engine creation; one-frame neon accepted. |
| `render()` from `setAppearance` fires callbacks         | `syncCallbacks` is change-detected; no extra calls.                           |
| Retro / classic hint text hard to read on bright bricks | Hint drawn below bricks on the background; verify in screenshots.             |
| Classic yellow banner and yellow bricks look alike      | Banner sits at `H / 2 + 40`, below the brick area; verify in screenshots.     |
| Toolbar grows past 390px                                | `.tetris-toolbar` already wraps; verify at 390px.                             |
| Space on focused select launches the ball               | `SELECT` already ignored + blur after change.                                 |

## What is **not** in this spec

- LIGHT/DARK theme, new gameplay or levels, sprites/image assets, per-skin sounds, per-skin brick or paddle shapes.
- Platform-wide theming, other games' skins.

_Each one, if it lands, goes in its own spec._
