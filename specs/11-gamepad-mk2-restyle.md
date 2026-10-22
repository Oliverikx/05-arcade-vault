# SPEC 11 — Gamepad MK-II restyle

> **Status:** Implemented
> **Depends on:** SPEC 10
> **Date:** 2026-10-22
> **Objective:** Restyle the shared touch pad of every game to match the MK-II gamepad reference in `resources/gamepad-assets/`, without changing its input behavior.

## Why this spec exists

SPEC 10 shipped a functional but flat pad (outlined keys, outlined pill buttons). `resources/gamepad-assets/` (`gamepad.html`, `gamepad-neon.png`) holds the target look: a beveled console shell, 3D D-pad keys with a hub, round glossy action buttons. The request started as Arkanoid-only; it was widened to all games because the pad is one shared component.

## Scope

**In:**

- Restyle `.touch-pad` and `.tp-*` rules in `app/globals.css` after the reference, for every registered game:
  - **Shell:** `linear-gradient(180deg, #1c1c28, #0c0c14)`, 1px `var(--line)` border, 22px radius, reference inset highlights (top light line, bottom dark line).
  - **D-pad keys:** 50×50 px, 10px radius, dark gradient `#1a1a25 → #0a0a12`, faint white border, 4px bottom "bevel" shadow, arrow `var(--ink-dim)`. Cross geometry like reference (156×156 box).
  - **D-pad pressed:** `translateY(3px)`, cyan arrow + cyan border, dark-cyan gradient, inner + outer cyan glow capped at 8px.
  - **Hub:** 50×50 px, 6px radius, radial dark gradient, cyan-tinted border. Plain (no gem).
  - **Action buttons:** glossy radial gradient (highlight top-left + mid/deep color), 2px border `currentColor`, 6px bottom bevel shadow, label `var(--pixel)` white with colored text-shadow ≤ 8px. Pressed: `translateY(4px) scale(0.97)`, bevel collapses.
  - **Shape:** circle min 64×64 px; labels that do not fit (`LAUNCH`, `ABILITY`, `BACK`) grow it into a pill of the same height. No line break in labels; cluster still wraps.
  - **Colors by index:** button 0 magenta, 1 cyan, 2+ yellow. Via CSS vars `--ab-mid`, `--ab-deep`, `--ab-glow` per class.
- `components/touch-pad.tsx`: unused D-pad directions are **not rendered** (previously dimmed). Grid slots stay, so the cross keeps size and the hub stays centered. Applies to all games (Arkanoid ▲ ▼, Asteroids ▼).
- `components/touch-pad.tsx`: action class becomes index-based to 3 colors (`a0` magenta, `a1` cyan, `a2` yellow for index ≥ 2) instead of `i % 3`.
- Mobile tweak (≤ 620 px): buttons 64 px, per reference `@media (max-width: 620px)`. D-pad keys stay ≥ 48 px (reference 46 px is under the SPEC 10 touch-target minimum).
- Pad UI via `/frontend-design`. Glow ≤ 8 px everywhere.

**Out of scope (for future specs):**

- Any change to input behavior: key mapping, synthetic `KeyboardEvent` bridge, auto-repeat, release safety, ability-menu swap (all from SPEC 10).
- Pad visibility rule (`any-pointer: coarse`), navbar hiding.
- Reference extras: pulsing gem hub, dot-grid shell texture, inner `::before` border, dashed ring on press.
- Lighting pad keys from physical keyboard presses (reference script feature).
- Per-game skins/themes for the pad, skin selector.
- Reference fonts loading (`JetBrains Mono`); `Press Start 2P` already in the platform as `var(--pixel)`.
- Letters `A` / `B` on buttons; buttons keep their action labels.

## Data model

This feature introduces no new data structures. It reuses `TouchLayout` / `PadButton` / `PadDir` from SPEC 10 (`lib/games/registry.ts`) unchanged.

Visual constants:

| Element       | Size         | Radius | Pressed                              |
| ------------- | ------------ | ------ | ------------------------------------ |
| Shell         | full width   | 22 px  | —                                    |
| D-pad key     | 50×50 (≥ 48) | 10 px  | `translateY(3px)`, cyan, glow ≤ 8 px |
| Hub           | 50×50        | 6 px   | —                                    |
| Action button | min 64×64    | 999 px | `translateY(4px) scale(0.97)`        |

| Button index | `color`     | `--ab-mid`            | `--ab-deep`           |
| ------------ | ----------- | --------------------- | --------------------- |
| 0            | `--magenta` | `rgba(255,0,110,0.7)` | `rgba(110,0,40,0.95)` |
| 1            | `--cyan`    | `rgba(0,200,230,0.7)` | `rgba(0,50,70,0.95)`  |
| ≥ 2          | `--yellow`  | yellow 0.7 equivalent | dark yellow 0.95      |

Conventions: existing palette tokens in `app/globals.css`; reuse `.touch-pad`, `.tp-*` class names (no rename). Pressed state stays on `:active` (pointer capture keeps it while held).

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. `components/touch-pad.tsx`: render only enabled directions (drop `disabled`/`aria-disabled` dims); action class `a${Math.min(i, 2)}`. Remove `.tp-key:disabled` CSS. Check: build + lint; Arkanoid shows only ◀ ▶; Tetris 3rd+ buttons yellow.
2. `app/globals.css`: shell restyle (`.touch-pad` background, border, radius, inset shadows). Check: touch emulation screenshot.
3. `app/globals.css`: D-pad keys + hub restyle (sizes, gradients, bevel, pressed state, cross geometry). Check: screenshot pressed vs idle.
4. `app/globals.css`: action buttons restyle (gloss gradient, `--ab-*` vars per `a0/a1/a2`, bevel, label shadow, circle→pill). Check: Tetris `DROP ABILITY` and `1–5 BACK` rows.
5. `app/globals.css`: `@media (max-width: 620px)` sizes. Check: 390×844 no horizontal scroll.

## Acceptance criteria

- [x] `npm run build` and `npm run lint` pass.
- [x] Touch emulation (Playwright `hasTouch: true, isMobile: true`, 390×844), every real game: pad shell, D-pad and buttons match `gamepad-neon.png` look (dark beveled shell, 3D keys, glossy round buttons).
- [x] Arkanoid: only ◀ ▶ rendered; ▲ ▼ slots empty; hub centered; `LAUNCH` is a magenta glossy pill, single line.
- [x] Asteroids: ▼ not rendered; `FIRE` magenta circle.
- [x] Snake: full cross; no action buttons.
- [x] Tetris: `DROP` magenta, `ABILITY` cyan pill; ability menu `1` magenta, `2` cyan, `3 4 5 BACK` yellow; row wraps without horizontal scroll.
- [x] Pressed D-pad key shifts down and turns cyan; pressed button shifts down; released → idle look.
- [x] D-pad keys and buttons ≥ 48×48 px at 390 px width.
- [x] No `box-shadow` / `text-shadow` / `drop-shadow` blur > 8 px in pad rules.
- [ ] Input behavior unchanged: all SPEC 10 play checks still pass (start, move, hold, multi-touch, release on pause/over, ability menu).
- [x] Desktop (fine pointer): no pad visible.
- [ ] No console errors / hydration warnings on `/games/<id>/play`.
- [x] Screenshots (touch emulation, one per game + Tetris ability mode) in `.playwright-mcp/screenshots`.

## Decisions

- **Yes:** Restyle the shared pad for all games. One component; per-game skins would add a field for no gain. Discarded: Arkanoid-only via registry `skin` field; hardcode on `game.id`.
- **Yes:** Keep action labels inside round buttons (`LAUNCH`, `FIRE`, …). Discoverable. Discarded: `A` letter + caption; `A` + inert `B`.
- **Yes:** Circle grows to pill for long labels. Discarded: fixed circles with shrinking font (unreadable `ABILITY`); pills only for ability menu.
- **Yes:** Glow ≤ 8 px (project rule) over reference 16–36 px. Same shapes/gradients, softer glow.
- **Yes:** Hide unused D-pad directions, keep their grid slots (supersedes SPEC 10 "dimmed"). Discarded: collapsed one-row D-pad; hide on Arkanoid only.
- **Yes:** Colors magenta → cyan → yellow by index. Reference A/B first, then platform yellow. Discarded: magenta/cyan alternation only.
- **No:** Gem hub pulse, dot-grid texture, inner border, dashed press ring. Not selected.
- **No:** Keyboard → pad light-up. Pad is touch-only.
- **Yes:** D-pad keys stay ≥ 48 px on mobile (reference 46 px violates SPEC 10 touch-target min).

## Risks

| Risk                                              | Mitigation                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| Bevel `translateY` on press shifts hit area       | Pointer capture (SPEC 10) keeps the press until release.               |
| Tetris 6 ability buttons + 156 px D-pad overflow  | Cluster wraps; check 390 px; mobile sizes step 5.                      |
| Removing disabled dirs breaks SPEC 10 checks      | SPEC 10 "▲ ▼ dimmed" criterion superseded here; no input change.       |
| Gradients/inset shadows heavier on low-end phones | Static styles, no animation; transitions ≤ 140 ms on transform/shadow. |

## What is **not** in this spec

- Input/mapping/repeat/visibility changes.
- Gem pulse, shell texture, inner border, dashed ring.
- Keyboard light-up, per-game pad skins, `A`/`B` letters, extra fonts.

_Each one, if it lands, goes in its own spec._
