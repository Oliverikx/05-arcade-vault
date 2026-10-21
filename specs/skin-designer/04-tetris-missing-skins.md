# SPEC SKIN-04 — TETRIS missing skins

> **Status:** Approved
> **Depends on:** SPEC 07
> **Date:** 2026-10-21
> **Objective:** Add the missing `classic` skin (original flat Tetris colors) to the existing tetris skin selector, leaving `neon`, `retro`, `pastel`, `pixel` untouched.

## Why this spec exists

Tetris is the reference selector (`components/tetris-toolbar.tsx`, `TetrisSkin = "retro" | "neon" | "pastel" | "pixel"` in `lib/games/tetris/pieces.ts`). Audit against the neon / retro / classic set: `neon` and `retro` exist; `classic` is missing. Tetris has no skin that uses the original flat guideline colors (no glow, no bevel, no texture). Only `classic` is added; the extra `pastel` / `pixel` skins stay.

## Scope

**In:**

- Add `"classic"` to `TetrisSkin` (`lib/games/tetris/pieces.ts`; re-exported by `lib/games/tetris/engine.ts`).
- `SKIN_COLORS.classic` array (palette below).
- `classic` entry in `surfaceFor` and `BLOCK_DRAWERS` (`lib/games/tetris/draw.ts`): flat cell, no shine, no `shadowBlur`.
- Add `"classic"` to the `SKINS` array in `components/tetris-toolbar.tsx` (option label `CLASSIC`, via existing `toUpperCase()`).
- `classic` ignores LIGHT/DARK (like `neon`, `pastel`, `pixel`); toggle stays visible.

**Out of scope (for future specs):** changes to `neon`/`retro`/`pastel`/`pixel`, new toolbar layout, sound, touch/mouse, platform-wide theme, other games' skins.

## Data model

```ts
// lib/games/tetris/pieces.ts
export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel" | "classic";
// TetrisEngine.setAppearance(skin, theme) unchanged; redraws now.
// components/tetris-toolbar.tsx
const SKINS: TetrisSkin[] = ["retro", "neon", "pastel", "pixel", "classic"];
```

**Constants:**

| Constant               | Value                                                |
| ---------------------- | ---------------------------------------------------- |
| localStorage key       | `av_tetris_skin` (unchanged; `av_tetris_theme` same) |
| Default skin           | `neon` (unchanged)                                   |
| `shadowBlur` (classic) | 0 (cap 8)                                            |
| Cell inset             | 1 px each side (same as `drawBlock`)                 |

**Palette — `classic` skin (flat guideline colors):**

| Element      | Color                                                   |
| ------------ | ------------------------------------------------------- |
| Background   | `#000000`                                               |
| Grid         | `#202020`                                               |
| Well tint    | `#000000`                                               |
| Well wall    | `#9a9a9a`                                               |
| Panel values | `#ffffff`; labels `#ffffff` at 60% alpha                |
| I            | `#00f0f0`                                               |
| O            | `#f0f000`                                               |
| T            | `#a000f0`                                               |
| S            | `#00f000`                                               |
| Z            | `#f00000`                                               |
| J            | `#0000f0`                                               |
| L            | `#f0a000`                                               |
| Screw        | `#808080`                                               |
| Block style  | flat `fillRect`, no highlight, no glow                  |
| Energy bar   | unchanged (`SKIN_COLORS.neon` cyan → magenta when full) |

Callbacks/input: no change. Engine already ignores keys on `INPUT`/`SELECT`/`TEXTAREA` targets; toolbar select already blurs after change.

Conventions: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components) before touching the toolbar. Engine stays framework-free. UI per `/frontend-design`; no toolbar rewrite.

## Implementation plan

Each step is commitable alone.

1. Extend the type and palette: add `"classic"` to `TetrisSkin`, add `SKIN_COLORS.classic` in `lib/games/tetris/pieces.ts`. Check: `npm run build` fails only where `Record<TetrisSkin, ...>` is incomplete (`surfaceFor`, `BLOCK_DRAWERS`).
2. Add `classic` case to `surfaceFor` and `BLOCK_DRAWERS` in `lib/games/tetris/draw.ts`. Check: `npm run build` and `npm run lint` pass; no `shadowBlur` set for classic.
3. Add `"classic"` to `SKINS` in `components/tetris-toolbar.tsx`. Check: Playwright screenshot of `/games/tetris/play` with CLASSIC selected (ready, playing, paused) saved to `.playwright-mcp/screenshots`.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `TetrisSkin` includes `"classic"`; existing four skins unchanged.
- [ ] SKIN select lists `RETRO, NEON, PASTEL, PIXEL, CLASSIC` with uppercase labels.
- [ ] Selecting CLASSIC redraws the canvas immediately, also while ready, paused and gameover.
- [ ] Classic piece colors equal the palette table (I `#00f0f0` ... Screw `#808080`); background `#000000`, grid `#202020`.
- [ ] Classic cells are flat (no highlight, glow or texture); `shadowBlur` is 0 for classic and ≤ 8 elsewhere.
- [ ] `localStorage` `av_tetris_skin = "classic"` survives reload; invalid value falls back to `neon`.
- [ ] LIGHT/DARK toggle does not change the classic look.
- [ ] Select does not move pieces; toolbar absent on asteroids/arkanoid.
- [ ] No hydration warnings on `/games/tetris/play`.

## Decisions

- **Yes:** Add only `classic`; keep `pastel` and `pixel`. Removing shipped skins is a regression. Discarded: replace `pixel` with `classic`.
- **Yes:** Classic = Tetris guideline flat colors, flat blocks. Matches "original flat colors". Discarded: reuse `retro` array.
- **Yes:** Classic ignores theme. Same as `neon`/`pastel`/`pixel`; avoids a second palette. Discarded: light classic variant.
- **Yes:** Energy bar keeps neon colors in classic. Not a piece color; avoids a new element. Discarded: classic-specific bar colors.
- **Yes:** Reuse existing key `av_tetris_skin` and default `neon`. Discarded: new key.
- **No:** Generalize `appearance` prop or hook. Tetris-specific wiring already works.

## Risks

| Risk                                             | Mitigation                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Pure `#0000f0` J block low contrast on `#000000` | Wall `#9a9a9a` and grid `#202020` keep the well readable; check in screenshot. |
| Stored skin from older build unknown             | Toolbar `SKINS.find` already falls back to `neon`.                             |

## What is **not** in this spec

- Changes to existing skins, toolbar layout, sound, touch/mouse, platform-wide theme, other games' skins.

_Each one, if it lands, goes in its own spec._
