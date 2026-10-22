# SPEC SKIN-05 — FROGGY skin selector

> **Status:** Implemented
> **Depends on:** `specs/game-core/froggy/01-froggy-core-game.md`; `specs/game-core/froggy/02-froggy-hazards-bonus.md` (turtle, fly, snake colors; skip those rows if 02 is not implemented); `specs/game-core/froggy/03-froggy-sound-mute.md` (shares `components/froggy-toolbar.tsx`); SPEC 07 (tetris toolbar pattern)
> **Date:** 2026-10-22
> **Objective:** Add a canvas-only `SKIN` selector (`neon` / `retro` / `classic`) under the CRT at `/games/froggy/play`, persisted per browser, redrawing immediately.

## Why this spec exists

Froggy is specced but not built (no `lib/games/froggy/` yet). Spec 01 hardcodes the neon palette in `lib/games/froggy/draw.ts` and defines no skin concept; spec 03 adds `components/froggy-toolbar.tsx` with a mute toggle only. Tetris is the reference (`components/tetris-toolbar.tsx`, `setAppearance` on its engine). This spec makes the palette skin-driven from the start so it can land right after, or alongside, spec 01. The engine key handler (spec 01) already ignores `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON` targets, so a `<select>` is safe.

## Scope

**In:**

- `lib/games/froggy/draw.ts`: `FroggySkin` type, `PALETTES: Record<FroggySkin, Palette>`, `skin` passed to every draw call, palette lookup replacing color literals.
- `lib/games/froggy/engine.ts`: `FroggyEngine extends GameEngine` with `setAppearance(skin)`, immediate redraw (also while ready / paused / dying / gameover).
- Skins `neon` (spec 01 look, default), `retro`, `classic`. Canvas-only; HUD, modal, CRT and touch pad untouched.
- Toolbar `components/froggy-toolbar.tsx`: `SKIN` select, uppercase labels, blur after change, hook `useFroggySkin` (localStorage `av_froggy_skin`, read after mount, try/catch, SSR-stable).
- Wiring in `components/game-screen.tsx` and `components/game-player.tsx`; toolbar visible only for froggy.
- `shadowBlur` ≤ 8 in every skin.

**Out of scope (for future specs):** LIGHT/DARK theme, gameplay changes, new assets, per-skin sprites or shapes, sound, platform-wide theming, touch changes, other games' skins.

## Data model

```ts
// lib/games/froggy/draw.ts
export type FroggySkin = "neon" | "retro" | "classic";

// lib/games/froggy/engine.ts
export interface FroggyEngine extends GameEngine {
  setAppearance(skin: FroggySkin): void; // redraws now
  // spec 03 adds: setMuted(muted: boolean): void
}
export function createFroggyGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): FroggyEngine;

// components/froggy-toolbar.tsx
export const FROGGY_SKIN_KEY = "av_froggy_skin";
export function useFroggySkin(): readonly [
  FroggySkin,
  (next: FroggySkin) => void,
];
export function FroggyToolbar(props: {
  skin: FroggySkin;
  onSkinChange(next: FroggySkin): void;
  muted?: boolean; // present only once spec 03 lands
  onMutedChange?(m: boolean): void;
}): JSX.Element;
```

`lib/games/registry.ts` entry unchanged (`create` returning `FroggyEngine` is assignable to `GameEngine`).

**Constants:**

| Constant      | Value                                                                                 |
| ------------- | ------------------------------------------------------------------------------------- |
| Canvas        | 640×480, 16×12 cells of 40 px (unchanged)                                             |
| Glow          | `shadowBlur` neon 8 (frog, filled pad) / 4 (vehicles, fly, snake); retro 0; classic 0 |
| Storage key   | `av_froggy_skin`                                                                      |
| Default skin  | `neon`                                                                                |
| Options order | `NEON`, `RETRO`, `CLASSIC`                                                            |
| Geometry      | identical in all skins                                                                |

**Palette (exact values):**

| Element                | `neon` (platform, = spec 01/02)        | `retro` (muted CRT)                        | `classic` (flat original) |
| ---------------------- | -------------------------------------- | ------------------------------------------ | ------------------------- |
| Background             | `#000000`                              | `#06100d`                                  | `#000000`                 |
| Goal hedge (row 0)     | `#003a2a`                              | `#1c3a2c`                                  | `#008000`                 |
| Pad outline            | `#00ff88`                              | `#7dae7a`                                  | `#ffff00`                 |
| Filled pad icon        | `#00ff88`                              | `#7dae7a`                                  | `#00ff00`                 |
| River                  | `#00f5ff` at 12% alpha over bg         | `rgba(111, 163, 168, 0.14)` over bg        | `#0000a8` solid           |
| Logs fill / edge       | `#d97a3a` / `#ffcf3a`                  | `#8a5a34` / `#b89a52`                      | `#8b4513` / `#8b4513`     |
| Median / start rows    | `#0f0f18`                              | `#0c1612`                                  | `#800080`                 |
| Median top line        | `#00ff88` at 30% alpha                 | `rgba(125, 174, 122, 0.3)`                 | none                      |
| Road                   | `#15151f`                              | `#101613`                                  | `#000000`                 |
| Lane dashes            | `#e6e9ff` at 12% alpha                 | `rgba(217, 210, 184, 0.12)`                | `#808080`                 |
| Car                    | `#ff006e`                              | `#b8607a`                                  | `#ff0000`                 |
| Truck                  | `#f5ff00`                              | `#c2b36a`                                  | `#ffff00`                 |
| Bus                    | `#00f5ff`                              | `#6fa3a8`                                  | `#ffffff`                 |
| Frog                   | `#00ff88`                              | `#7dae7a`                                  | `#00ff00`                 |
| Frog dying             | `#ff006e`                              | `#b8607a`                                  | `#ff0000`                 |
| Timer bar > 50%        | `#00ff88`                              | `#7dae7a`                                  | `#00ff00`                 |
| Timer bar 25–50%       | `#f5ff00`                              | `#c2b36a`                                  | `#ffff00`                 |
| Timer bar < 25%        | `#ff006e`                              | `#b8607a`                                  | `#ff0000`                 |
| Ready text             | `#e6e9ff` at 70% alpha                 | `rgba(217, 210, 184, 0.7)`                 | `#ffffff`                 |
| Turtle shell (spec 02) | `#00ff88` at 80% alpha, edge `#00f5ff` | `rgba(125, 174, 122, 0.8)`, edge `#6fa3a8` | `#00c800`, edge `#00c800` |
| Submerged ripple       | `#00f5ff` at 25% alpha                 | `rgba(111, 163, 168, 0.25)`                | `#ffffff` at 25% alpha    |
| Fly (spec 02)          | `#f5ff00`                              | `#c2b36a`                                  | `#ffffff`                 |
| Median snake (spec 02) | `#ff006e`                              | `#b8607a`                                  | `#ff00ff`                 |

`neon` values equal spec 01/02, so the default look is unchanged. Warning blink (alpha 100% ↔ 30%) is skin-independent.

**Input notes:** no engine key change; `SELECT` already ignored. Toolbar blur after change keeps focus off the select so `P`/`Esc` and arrows work. Canvas click-to-start unaffected.

**Conventions:** Next.js 16 has breaking changes. Read `node_modules/next/dist/docs/01-app` (client components, `useEffect`, hydration) before writing code. Engine stays framework-free; only `components/game-screen.tsx` and the toolbar touch React. UI per `/frontend-design`; reuse `.tetris-toolbar` / `.tt-field` from `app/globals.css` (no new CSS). Skin kept in engine-local `let skin: FroggySkin = "neon"` and passed to draw functions every render; engine not recreated.

## Implementation plan

Each step leaves the app runnable and is commitable alone. Requires spec 01 implemented.

1. Palette refactor in `lib/games/froggy/draw.ts`: add `FroggySkin`, `Palette`, `PALETTES` (table above); every draw function takes the palette; set `shadowColor`/`shadowBlur` only when glow > 0 and wrap in `save()`/`restore()`; skip the median top line when `null`. Engine passes `"neon"` for now. Check: build + lint; froggy looks identical to spec 01.
2. Engine: add `let skin`, `setAppearance(next)` (assign, render immediately), type `FroggyEngine`. Check: build + lint; `setAppearance("retro")` while paused repaints without a tick and changes no score, lives, level, timer or positions.
3. `components/froggy-toolbar.tsx`: `useFroggySkin`, `FroggyToolbar` with `SKINS = ["neon","retro","classic"]`, key `av_froggy_skin`, mirrors tetris hook structure. If spec 03 already created the file, add the SKIN field next to SOUND and keep its exports. Check: build + lint; no hydration warning.
4. Wire `components/game-screen.tsx`: optional prop `froggySkin?: FroggySkin`, effect `(gameRef.current as Partial<FroggyEngine> | null)?.setAppearance?.(froggySkin)` guarded by `froggySkin !== undefined`, deps `[froggySkin, entry]`. Wire `components/game-player.tsx`: `isFroggy = game.id === "froggy"`, `useFroggySkin()`, pass `froggySkin={isFroggy ? skin : undefined}`, render `<FroggyToolbar>` under `.crt`. Check: toolbar only on `/games/froggy/play`.
5. Playwright (screenshots to `.playwright-mcp/screenshots`): neon, retro, classic in ready; classic while paused and while dying; after GAME OVER; reload persistence. Check: screenshots match the table; arrows hop after changing skin.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `lib/games/froggy/draw.ts` exports `FroggySkin = "neon" | "retro" | "classic"`; `lib/games/froggy/engine.ts` exports `FroggyEngine` with `setAppearance(skin)`.
- [ ] `components/froggy-toolbar.tsx` has a select labelled `SKIN` with options `NEON`, `RETRO`, `CLASSIC` in that order.
- [ ] Default (no localStorage) is `neon` and renders identically to the spec 01 palette.
- [ ] Choice persists in `localStorage["av_froggy_skin"]` across reload; invalid or blocked storage falls back to `neon`.
- [ ] Changing skin redraws immediately in ready, paused, dying and gameover.
- [ ] Changing skin does not reset score, lives, level, timer, pads or any lane position.
- [ ] Select loses focus after change; arrows/`WASD` hop afterwards.
- [ ] With the select focused, arrows/`WASD`/Space do not hop or start the game.
- [ ] `neon` matches the table (frog `#00ff88`, car `#ff006e`, river `#00f5ff` at 12%).
- [ ] `classic` uses river `#0000a8`, road `#000000`, median `#800080`, frog `#00ff00` with no glow.
- [ ] `retro` and `classic` use `shadowBlur` 0; no skin exceeds 8.
- [ ] Timer bar color thresholds (50% / 25%) apply in every skin.
- [ ] Geometry and hitboxes identical in all skins.
- [ ] Toolbar present only at `/games/froggy/play` (absent for other games and practice entries).
- [ ] No hydration warnings; no console errors on leaving the page.
- [ ] Toolbar fits at 390px width with no horizontal scroll.

## Decisions

- **Yes:** Three skins only, no theme toggle. Discarded: LIGHT/DARK like tetris.
- **Yes:** Default `neon`, no change for the base game. Discarded: default `classic`.
- **Yes:** `classic` = flat original-arcade colors (blue river, purple safe strips, green hedge, red/yellow/white vehicles). Discarded: monochrome green (frog invisible on lanes).
- **Yes:** `retro` = muted phosphor on `#06100d`, no glow, same hue family as SKIN-03 snake `retro`. Discarded: scanline effects (CRT frame already exists).
- **Yes:** Separate `froggySkin` prop on `GameScreen` instead of generalizing the tetris-specific `appearance` prop. Same precedent as snake (SKIN-03), asteroids and arkanoid `muted`; tetris untouched. Discarded: generic `appearance` refactor (regression risk).
- **Yes:** Toolbar file shared with spec 03: whichever lands second extends the first, props for mute optional. Discarded: separate `froggy-skin-toolbar.tsx` (two bars under the CRT).
- **Yes:** Spec 02 rows (turtle, fly, snake) included in the palette; ignored if 02 is not implemented. Discarded: waiting for a follow-up spec.
- **Yes:** Reuse `.tetris-toolbar` / `.tt-field`, zero new CSS. Discarded: new `.skin-toolbar` class.
- **Yes:** Skin passed into draw functions, not module state, so double-mounted engines under Strict Mode stay independent.
- **No:** Per-skin shapes or sprites; geometry shared with hitboxes.

## Risks

| Risk                                                       | Mitigation                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Skin change invisible while paused                         | `setAppearance` calls render directly.                                   |
| Flash of neon before stored skin is applied                | `GameScreen` effect runs right after creation; one-frame neon accepted.  |
| Specs 01/03 not yet built when this is implemented         | Requires spec 01; toolbar step handles both orders for spec 03.          |
| `classic` solid river hides frog/log contrast              | Frog `#00ff00` vs river `#0000a8`, logs `#8b4513`; verify in screenshot. |
| `shadowBlur` leaks to later draws                          | `save()`/`restore()` around glowing draws; none for retro/classic.       |
| Dying flash invisible in retro (frog and car colors close) | Dying uses `#b8607a` vs frog `#7dae7a`; verify in screenshot.            |

## What is **not** in this spec

- LIGHT/DARK theme, gameplay changes, new assets, per-skin sprites or shapes.
- Sound, platform-wide theming, touch changes, other games' skins.

_Each one, if it lands, goes in its own spec._
