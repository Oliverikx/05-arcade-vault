# SPEC SKIN-06 — MINESWEEPER skin selector

> **Status:** Implemented
> **Depends on:** `specs/game-core/minesweeper/01-minesweeper-core-game.md`; `specs/game-core/minesweeper/02-minesweeper-sound-fx.md` (shares `components/minesweeper-toolbar.tsx`); `specs/game-core/minesweeper/03-minesweeper-hint-assist.md` (shares the toolbar, hint pulse color); SPEC 07 (tetris toolbar pattern); `specs/skin-designer/05-froggy-skin-selector.md` (wiring precedent)
> **Date:** 2026-10-22
> **Objective:** Add a canvas-only `SKIN` selector (`neon` / `retro` / `classic`) under the CRT at `/games/minesweeper/play`, persisted per browser, redrawing immediately.

## Why this spec exists

Minesweeper is specced but not built (no `lib/games/minesweeper/` yet). Spec 01 hardcodes the neon palette in `lib/games/minesweeper/draw.ts` and lists skins as out of scope. Specs 02 and 03 each create or extend `components/minesweeper-toolbar.tsx` (SOUND toggle, HINT button) but add no skin. Tetris is the reference (`components/tetris-toolbar.tsx`, `setAppearance` on its engine). This spec makes the palette skin-driven so it can land right after, or alongside, spec 01. The engine key handler (spec 01) already ignores `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON` targets, so a `<select>` is safe.

## Scope

**In:**

- `lib/games/minesweeper/draw.ts`: `MinesweeperSkin` type, `PALETTES: Record<MinesweeperSkin, Palette>`, palette passed to every draw call, replacing color literals.
- `lib/games/minesweeper/engine.ts`: `MinesweeperEngine extends GameEngine` with `setAppearance(skin)`, immediate redraw (also while ready / paused / clear / gameover).
- Skins `neon` (spec 01 look, default), `retro`, `classic`. Canvas-only; HUD, modal, CRT and touch pad untouched.
- Toolbar `components/minesweeper-toolbar.tsx`: `SKIN` select, uppercase labels, blur after change, hook `useMinesweeperSkin` (localStorage `av_minesweeper_skin`, read after mount, try/catch, SSR-stable).
- Wiring in `components/game-screen.tsx` and `components/game-player.tsx`; toolbar visible only for minesweeper.
- `shadowBlur` ≤ 8 in every skin.

**Out of scope (for future specs):** LIGHT/DARK theme, gameplay changes, new assets, per-skin shapes or sprites, sound, hints, platform-wide theming, touch changes, other games' skins.

## Data model

```ts
// lib/games/minesweeper/draw.ts
export type MinesweeperSkin = "neon" | "retro" | "classic";

// lib/games/minesweeper/engine.ts
export interface MinesweeperEngine extends GameEngine {
  setAppearance(skin: MinesweeperSkin): void; // redraws now
  // spec 02 adds: setMuted(muted: boolean): void
  // spec 03 adds: hint(): void
}
export function createMinesweeperGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): MinesweeperEngine;

// components/minesweeper-toolbar.tsx
export const MINESWEEPER_SKIN_KEY = "av_minesweeper_skin";
export function useMinesweeperSkin(): readonly [
  MinesweeperSkin,
  (next: MinesweeperSkin) => void,
];
export function MinesweeperToolbar(props: {
  skin: MinesweeperSkin;
  onSkinChange(next: MinesweeperSkin): void;
  muted?: boolean; // present only once spec 02 lands
  onMutedChange?(m: boolean): void;
  hintsLeft?: number; // present only once spec 03 lands
  canHint?: boolean;
  onHint?(): void;
}): JSX.Element;
```

`lib/games/registry.ts` entry unchanged (`create` returning `MinesweeperEngine` is assignable to `GameEngine`).

**Constants:**

| Constant      | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Canvas        | 640×480, 32 px strip, 32 px cells (unchanged)                                                  |
| Glow          | `shadowBlur` neon 6 (cursor/hover, hint pulse) / 8 (mine); retro 0; classic 0                  |
| Storage key   | `av_minesweeper_skin`                                                                          |
| Default skin  | `neon`                                                                                         |
| Options order | `NEON`, `RETRO`, `CLASSIC`                                                                     |
| Geometry      | identical in all skins (cell size, board position, flag/mine shapes); classic only adds bevels |

**Palette (exact values):**

| Element                     | `neon` (platform, = spec 01)       | `retro` (muted CRT)                     | `classic` (flat original)                                                      |
| --------------------------- | ---------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| Background                  | `#000000`                          | `#06100d`                               | `#c0c0c0`                                                                      |
| Strip background            | `#000000`                          | `#0c1612`                               | `#c0c0c0`                                                                      |
| Strip text (MINES / TIME)   | `#e6e9ff`                          | `#d9d2b8`                               | `#ff0000` on `#000000` box                                                     |
| Hidden cell fill / border   | `#15151f` / `#4a4f70`              | `#14201b` / `#3d5247`                   | `#c0c0c0` / bevel light `#ffffff` top-left, dark `#808080` bottom-right (3 px) |
| Hover / cursor border       | `#f5ff00`, glow 6                  | `#c2b36a`, no glow                      | `#000000` 2 px, no glow                                                        |
| Revealed cell fill / border | `#05050a` / `#e6e9ff` at 6% alpha  | `#050a08` / `rgba(217, 210, 184, 0.08)` | `#c0c0c0` / `#808080` 1 px                                                     |
| Number 1                    | `#00f5ff`                          | `#6fa3a8`                               | `#0000ff`                                                                      |
| Number 2                    | `#00ff88`                          | `#7dae7a`                               | `#008000`                                                                      |
| Number 3                    | `#ff006e`                          | `#b8607a`                               | `#ff0000`                                                                      |
| Number 4                    | `#f5ff00`                          | `#c2b36a`                               | `#000080`                                                                      |
| Number 5                    | `#d97a3a`                          | `#8a5a34`                               | `#800000`                                                                      |
| Number 6                    | `#ffcf3a`                          | `#b89a52`                               | `#008080`                                                                      |
| Number 7                    | `#c7d0e0`                          | `#a8b0a8`                               | `#000000`                                                                      |
| Number 8                    | `#e6e9ff`                          | `#d9d2b8`                               | `#808080`                                                                      |
| Flag pennant                | `#f5ff00`                          | `#c2b36a`                               | `#ff0000` (pole and base `#000000`)                                            |
| Mine                        | `#ff006e` disc with spikes, glow 8 | `#b8607a` disc with spikes, no glow     | `#000000` disc with spikes, white highlight `#ffffff`                          |
| Hit mine highlight          | ring `#e6e9ff`                     | ring `#d9d2b8`                          | cell fill `#ff0000`                                                            |
| Wrong flag cross            | `#ff006e`                          | `#b8607a`                               | `#ff0000`                                                                      |
| Hint pulse (spec 03)        | border `#f5ff00`, glow ≤ 8         | border `#c2b36a`, no glow               | border `#ffff00`, no glow                                                      |
| Banners / ready text        | `#e6e9ff`, hint at 70% alpha       | `#d9d2b8`, hint at 70% alpha            | `#000000` on `#c0c0c0` panel, hint at 70% alpha                                |

`neon` values equal spec 01 (and spec 03 pulse), so the default look is unchanged.

**Input notes:** no engine key change; `SELECT` already ignored. Toolbar blur after change keeps focus off the select so `P`/`Esc`, arrows and `Space` work. Canvas pointer input (click, right click, long press) unaffected.

**Conventions:** Next.js 16 has breaking changes. Read `node_modules/next/dist/docs/01-app` (client components, `useEffect`, hydration) before writing code. Engine stays framework-free; only `components/game-screen.tsx` and the toolbar touch React. UI per `/frontend-design`; reuse `.tetris-toolbar` / `.tt-field` from `app/globals.css` (no new CSS). Skin kept in engine-local `let skin: MinesweeperSkin = "neon"` and passed to draw functions every render; engine not recreated.

## Implementation plan

Each step leaves the app runnable and is commitable alone. Requires spec 01 implemented.

1. Palette refactor in `lib/games/minesweeper/draw.ts`: add `MinesweeperSkin`, `Palette`, `PALETTES` (table above); every draw function takes the palette; set `shadowColor`/`shadowBlur` only when glow > 0 and wrap in `save()`/`restore()`; classic hidden cells draw the 3 px bevel. Engine passes `"neon"` for now. Check: build + lint; minesweeper looks identical to spec 01.
2. Engine: add `let skin`, `setAppearance(next)` (assign, render immediately), type `MinesweeperEngine`. Check: build + lint; `setAppearance("retro")` while paused repaints without a tick and changes no score, level, timer, board, flags or cursor.
3. `components/minesweeper-toolbar.tsx`: `useMinesweeperSkin`, `MinesweeperToolbar` with `SKINS = ["neon","retro","classic"]`, key `av_minesweeper_skin`, mirrors tetris hook structure. If specs 02/03 already created the file, add the SKIN field next to SOUND / HINT and keep their exports. Check: build + lint; no hydration warning.
4. Wire `components/game-screen.tsx`: optional prop `minesweeperSkin?: MinesweeperSkin`, effect `(gameRef.current as Partial<MinesweeperEngine> | null)?.setAppearance?.(minesweeperSkin)` guarded by `minesweeperSkin !== undefined`, deps `[minesweeperSkin, entry]`. Wire `components/game-player.tsx`: `isMinesweeper = game.id === "minesweeper"`, `useMinesweeperSkin()`, pass `minesweeperSkin={isMinesweeper ? skin : undefined}`, render `<MinesweeperToolbar>` under `.crt`. Check: toolbar only on `/games/minesweeper/play`.
5. Playwright (screenshots to `.playwright-mcp/screenshots`): neon, retro, classic in ready and mid-board with numbers 1..8 and flags; classic while paused, on a lost board (mines, wrong flag, hit mine) and after GAME OVER; reload persistence. Check: screenshots match the table; click, arrows and `Space` work after changing skin.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `lib/games/minesweeper/draw.ts` exports `MinesweeperSkin = "neon" | "retro" | "classic"`; `lib/games/minesweeper/engine.ts` exports `MinesweeperEngine` with `setAppearance(skin)`.
- [ ] `components/minesweeper-toolbar.tsx` has a select labelled `SKIN` with options `NEON`, `RETRO`, `CLASSIC` in that order.
- [ ] Default (no localStorage) is `neon` and renders identically to the spec 01 palette.
- [ ] Choice persists in `localStorage["av_minesweeper_skin"]` across reload; invalid or blocked storage falls back to `neon`.
- [ ] Changing skin redraws immediately in ready, playing, paused, clear and gameover.
- [ ] Changing skin does not reset score, level, timer, mine layout, revealed cells, flags or cursor.
- [ ] Select loses focus after change; clicks, arrows/`WASD`, `Space` and `F` work afterwards.
- [ ] With the select focused, arrows/`WASD`/`Space`/`F` do not move the cursor, reveal or flag.
- [ ] `neon` matches the table (hidden cell `#15151f`, number 1 `#00f5ff`, mine `#ff006e`, flag `#f5ff00`).
- [ ] `classic` uses background `#c0c0c0`, hidden cells with `#ffffff` / `#808080` bevel, number 1 `#0000ff`, number 3 `#ff0000`, red flag `#ff0000`, black mine, hit mine cell `#ff0000`, with no glow.
- [ ] `retro` and `classic` use `shadowBlur` 0; no skin exceeds 8.
- [ ] Numbers 1..8 are legible against the revealed cell fill in every skin.
- [ ] Geometry and hit testing identical in all skins.
- [ ] Toolbar present only at `/games/minesweeper/play` (absent for other games and practice entries).
- [ ] No hydration warnings; no console errors on leaving the page.
- [ ] Toolbar fits at 390px width with no horizontal scroll.

## Decisions

- **Yes:** Three skins only, no theme toggle. Discarded: LIGHT/DARK like tetris.
- **Yes:** Default `neon`, no change for the base game. Discarded: default `classic`.
- **Yes:** `classic` = original Windows-style grey bevel board, blue/green/red number set, red flag, black mines, red hit cell. Discarded: flat grey with no bevel (hidden vs revealed cells hard to tell apart).
- **Yes:** `retro` = muted phosphor on `#06100d`, no glow, same hue family as SKIN-03 snake and SKIN-05 froggy `retro`. Discarded: scanline effects (CRT frame already exists).
- **Yes:** Separate `minesweeperSkin` prop on `GameScreen` instead of generalizing the tetris-specific `appearance` prop. Same precedent as snake, asteroids, froggy; tetris untouched. Discarded: generic `appearance` refactor (regression risk).
- **Yes:** Toolbar file shared with specs 02 and 03: whichever lands first creates it, the others extend it; sound and hint props optional. Discarded: separate `minesweeper-skin-toolbar.tsx` (two bars under the CRT).
- **Yes:** Hint pulse row included in the palette; ignored if spec 03 is not implemented. Discarded: waiting for a follow-up spec.
- **Yes:** Reuse `.tetris-toolbar` / `.tt-field`, zero new CSS. Discarded: new `.skin-toolbar` class.
- **Yes:** Skin passed into draw functions, not module state, so double-mounted engines under Strict Mode stay independent.
- **Yes:** `.cover-minesweeper` catalog art stays neon in every skin. Discarded: skin-driven covers (catalog is server-rendered, skin is per-run).
- **No:** Per-skin shapes or sprites beyond the classic bevel; geometry shared with hit testing.

## Risks

| Risk                                                       | Mitigation                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Skin change invisible while paused                         | `setAppearance` calls render directly.                                               |
| Flash of neon before stored skin is applied                | `GameScreen` effect runs right after creation; one-frame neon accepted.              |
| Specs 01/02/03 not yet built when this is implemented      | Requires spec 01; toolbar step handles any order for 02 and 03.                      |
| Classic bevel costs draw time on 280-cell boards           | Plain `fillRect` lines, no shadows; boards max 20×14.                                |
| Number 7 `#000000` / 8 `#808080` unreadable on a dark skin | Per-skin number colors; classic numbers only used on `#c0c0c0` cells.                |
| `shadowBlur` leaks to later draws                          | `save()`/`restore()` around glowing draws; none for retro/classic.                   |
| Retro numbers 3 and wrong-flag cross share `#b8607a`       | Cross drawn over the flag on a hidden cell, never on a number; verify in screenshot. |

## What is **not** in this spec

- LIGHT/DARK theme, gameplay changes, new assets, per-skin sprites or shapes.
- Sound, hints, platform-wide theming, touch changes, other games' skins.

_Each one, if it lands, goes in its own spec._
