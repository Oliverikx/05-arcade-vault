# SPEC SKIN-01 — ASTEROIDS skin selector

> **Status:** Approved
> **Depends on:** SPEC 05 (asteroids integration), SPEC 07 (tetris toolbar pattern)
> **Date:** 2026-10-21
> **Objective:** Add a canvas-only `SKIN` selector (`neon` / `retro` / `classic`) under the CRT at `/games/asteroids/play`, persisted per browser, redrawing immediately.

## Why this spec exists

Tetris has a skin toolbar (`components/tetris-toolbar.tsx`, `setAppearance` on its engine). Asteroids (`lib/games/asteroids/engine.ts`) has no skin concept: colors are hardcoded module constants (`INK`, `CYAN`, `MAGENTA`, `YELLOW`, `GREEN`, background `#000`) and entity classes (`Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`) read them directly. There is no `components/asteroids-toolbar.tsx`. The engine also listens on `window` and ignores only `INPUT`/`TEXTAREA`, so a `<select>` would receive game keys (Space shoots while the select is focused).

## Scope

**In:**

- Engine `lib/games/asteroids/engine.ts`: `AsteroidsSkin` type, `AsteroidsEngine extends GameEngine` with `setAppearance(skin)`, per-skin palette lookup replacing the color constants, immediate redraw (also while paused / ready / gameover).
- Skins `neon` (current look, default), `retro`, `classic`. Canvas-only; HUD/modal/CRT untouched.
- Toolbar `components/asteroids-toolbar.tsx`: `SKIN` select, uppercase labels, blur after change, hook `useAsteroidsSkin` (localStorage `av_asteroids_skin`, read after mount, try/catch, SSR-stable).
- Wiring in `components/game-screen.tsx` and `components/game-player.tsx`; toolbar visible only for asteroids.
- Engine key handler ignores `SELECT` targets too.
- `shadowBlur` ≤ 8 in every skin.

**Out of scope (for future specs):** LIGHT/DARK theme, new gameplay, sprites/image assets, sound, per-skin ship silhouettes, platform-wide theming, touch controls, other games' skins.

## Data model

```ts
// lib/games/asteroids/engine.ts
export type AsteroidsSkin = "neon" | "retro" | "classic";
export interface AsteroidsEngine extends GameEngine {
  setAppearance(skin: AsteroidsSkin): void; // redraws now
}
export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): AsteroidsEngine;

// components/asteroids-toolbar.tsx
export function useAsteroidsSkin(): readonly [
  AsteroidsSkin,
  (next: AsteroidsSkin) => void,
];
export function AsteroidsToolbar(props: {
  skin: AsteroidsSkin;
  onChange(next: AsteroidsSkin): void;
}): JSX.Element;
```

`AsteroidsCallbacks` / `AsteroidsGame` aliases stay; `AsteroidsGame` becomes an alias of `AsteroidsEngine` or is removed if unused (`grep` first). `lib/games/registry.ts` entry unchanged (`create` return type widens; `EngineEntry.create` still returns `GameEngine`).

**Constants:**

| Constant         | Value                                                         |
| ---------------- | ------------------------------------------------------------- |
| Canvas           | 800×600 (unchanged)                                           |
| `GLOW`           | `8` neon, `0` retro, `0` classic (all ≤ 8)                    |
| Line width       | `1.5` neon / retro, `1.5` classic (unchanged; shield stays 2) |
| Storage key      | `av_asteroids_skin`                                           |
| Default skin     | `neon`                                                        |
| Options order    | `NEON`, `RETRO`, `CLASSIC`                                    |
| Particle alpha   | existing `ttl / life`, color RGB per skin                     |
| Ready/timer font | unchanged (`--pixel` resolved from canvas)                    |

**Palette (exact hex):**

| Element                      | `neon` (platform)     | `retro` (muted CRT) | `classic` (flat original) |
| ---------------------------- | --------------------- | ------------------- | ------------------------- |
| Background                   | `#000000`             | `#06100d`           | `#000000`                 |
| Ship stroke                  | `#00f5ff`             | `#6fb7b0`           | `#ffffff`                 |
| Thruster flame               | `#f5ff00`             | `#d4a64a`           | `#ffffff`                 |
| Asteroid stroke              | `#ff006e`             | `#b8607a`           | `#ffffff`                 |
| Bullet fill                  | `#e6e9ff`             | `#d9d2b8`           | `#ffffff`                 |
| Particle RGB                 | `230,233,255`         | `217,210,184`       | `255,255,255`             |
| Power-up ring/icon, shield   | `#00ff88`             | `#7dae7a`           | `#ffffff`                 |
| Timer text (TRIPLE / SHIELD) | `#00ff88`             | `#7dae7a`           | `#ffffff`                 |
| Ready prompt text            | `#e6e9ff`             | `#d9d2b8`           | `#ffffff`                 |
| Glow (`shadowColor`)         | element color, blur 8 | none (blur 0)       | none (blur 0)             |

`neon` values equal the current module constants, so the default look is pixel-identical to today.

**Input notes:** engine keeps `window` listeners; `onKeyDown` early-returns when `target.tagName` is `SELECT`, `INPUT` or `TEXTAREA`. `onKeyUp` still clears keys. `GamePlayer` P/Esc handler is unchanged (it does not skip `SELECT`; toolbar blur after change keeps focus off the select).

**Conventions:** Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`, hydration) before writing code. Engine stays framework-free; only `components/game-screen.tsx` and the toolbar touch React. UI per `/frontend-design`; reuse `.tetris-toolbar` / `.tt-field` styles from `app/globals.css` (no new CSS unless the select needs a width tweak). Skin applied by assigning a `palette` object that entity `draw` methods read at call time (pass `palette` argument or module-level `let`), not by recreating the engine.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. Engine palette refactor: add `AsteroidsSkin`, a `PALETTES: Record<AsteroidsSkin, Palette>` table (values above), module-level `palette` defaulting to neon; replace `INK`/`CYAN`/`MAGENTA`/`YELLOW`/`GREEN`/`GLOW` uses and the `#000` fill and particle `rgba(230,233,255,…)` with palette fields; skip `shadowColor`/`shadowBlur` when palette glow is 0. Check: build + lint; asteroids looks identical to before (neon).
2. Add `setAppearance(skin)` to the returned object (sets palette, calls `draw()` immediately); type `AsteroidsEngine`; make `onKeyDown` ignore `SELECT`. Check: build + lint; calling `setAppearance("retro")` while paused repaints without a frame tick.
3. Create `components/asteroids-toolbar.tsx` (`useAsteroidsSkin`, `AsteroidsToolbar`, `SKINS` array `["neon","retro","classic"]`, key `av_asteroids_skin`). Check: build + lint; no hydration warning.
4. Wire `components/game-screen.tsx`: new optional prop `asteroidsSkin?: AsteroidsSkin`, effect mirroring the `muted` one: `(gameRef.current as Partial<AsteroidsEngine> | null)?.setAppearance?.(skin)` guarded by `asteroidsSkin !== undefined`, deps `[asteroidsSkin, entry]`. Wire `components/game-player.tsx`: `isAsteroids = game.id === "asteroids"`, `useAsteroidsSkin()`, pass prop, render `<AsteroidsToolbar>` under `.crt` next to the tetris/arkanoid toolbars. Check: toolbar shows only on `/games/asteroids/play`; absent on tetris, arkanoid, snake.
5. Verify with Playwright (screenshots to `.playwright-mcp/screenshots`): neon, retro, classic in ready state; classic while paused; reload persistence. Check: screenshots match the palette table; keyboard still plays after changing skin.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `lib/games/asteroids/engine.ts` exports `AsteroidsSkin = "neon" | "retro" | "classic"` and `AsteroidsEngine` with `setAppearance(skin)`.
- [ ] `components/asteroids-toolbar.tsx` exists; select labelled `SKIN` with options `NEON`, `RETRO`, `CLASSIC` in that order.
- [ ] Default (no localStorage) is `neon` and renders identically to the pre-spec build.
- [ ] Choice persists in `localStorage["av_asteroids_skin"]` and survives reload; invalid or blocked storage falls back to `neon`.
- [ ] Changing skin redraws the canvas immediately in `ready`, while paused, and after GAME OVER (modal closed via PLAY AGAIN is not required).
- [ ] Changing skin does not reset score, lives, level, asteroids or ship position.
- [ ] Select loses focus after change; Space/arrows afterwards control the ship, not the select.
- [ ] With the select focused, Space/arrow keys do not shoot or move the ship.
- [ ] `neon` colors match the palette table exactly (ship `#00f5ff`, asteroids `#ff006e`, power-ups `#00ff88`).
- [ ] `retro` and `classic` have `shadowBlur` 0; `neon` uses `shadowBlur` 8; no skin exceeds 8.
- [ ] `classic` draws every vector element in `#ffffff` on `#000000`.
- [ ] Toolbar is present only at `/games/asteroids/play` (absent for tetris, arkanoid, snake, practice games).
- [ ] No hydration warnings on `/games/asteroids/play`; no console errors on leaving the page.
- [ ] Toolbar fits at 390px width with no horizontal scroll.

## Decisions

- **Yes:** Three skins only (`neon`, `retro`, `classic`), no theme toggle. Asteroids has no light/dark need; vector look is the point. Discarded: copying tetris LIGHT/DARK.
- **Yes:** Default `neon`, identical to current look. No behavior change for existing players. Discarded: default `classic`.
- **Yes:** `classic` = all-white vectors, no glow, pure black. Matches the 1979 cabinet look. Discarded: colored classic (not original).
- **Yes:** `retro` = muted desaturated phosphor tones with dark green-black background, no glow. Discarded: scanline/curvature effects (CRT frame already exists).
- **Yes:** Add a separate `asteroidsSkin` prop on `GameScreen` instead of generalizing the tetris `appearance` prop. Tetris takes `(skin, theme)`, asteroids `(skin)`; `muted` already sets the per-game-prop precedent and it avoids touching tetris. Discarded: generic `appearance` refactor (larger blast radius, tetris regression risk); duck-typed single call for both signatures.
- **Yes:** Reuse `.tetris-toolbar` / `.tt-field` CSS classes. Zero new CSS. Discarded: rename to `.skin-toolbar` (touches tetris and arkanoid markup).
- **Yes:** Engine ignores `SELECT` targets. Required so the focused select does not shoot. Discarded: relying only on blur.
- **Yes:** Module-level `palette` swapped by `setAppearance`. Entities draw every frame so no state migration. Discarded: per-entity color fields.
- **No:** Per-skin ship silhouette or asteroid shapes. Gameplay geometry is shared; keeps hitboxes unchanged.

## Risks

| Risk                                                      | Mitigation                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Module-level `palette` shared across Strict Mode engines  | Reset to stored/neon in `createAsteroidsGame`; `setAppearance` effect re-applies on mount. |
| Skin change invisible while paused (rAF still draws, but) | `setAppearance` calls `draw()` directly.                                                   |
| Engine created before stored skin read (flash of neon)    | `GameScreen` skin effect runs after engine creation; one-frame neon accepted.              |
| Space on focused select shoots                            | `SELECT` early-return in `onKeyDown` + blur after change.                                  |
| Classic white on white particles unreadable? (black bg)   | Keep particle alpha fade; verify in screenshot.                                            |
| Glow removal changes stroke weight perception             | Keep `lineWidth` 1.5 in all skins.                                                         |

## What is **not** in this spec

- LIGHT/DARK theme, new gameplay, sprites/image assets, sound, per-skin ship silhouettes.
- Platform-wide theming, touch controls, other games' skins.

_Each one, if it lands, goes in its own spec._
