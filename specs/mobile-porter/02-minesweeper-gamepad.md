# SPEC PAD-02 — MINESWEEPER gamepad

> **Status:** Draft
> **Depends on:** `specs/game-core/minesweeper/01-minesweeper-core-game.md`, SPEC 10, SPEC 11
> **Date:** 2026-10-22
> **Objective:** Make Minesweeper fully playable on touch devices with the shared MK-II `TouchPad`: a 4-way D-pad that moves the cursor plus `REVEAL` and `FLAG` buttons, registered through the `touch` field of its registry entry.

## Why this spec exists

Spec-only audit: Minesweeper is specced (`specs/game-core/minesweeper/01-minesweeper-core-game.md`) but not built. There is no `lib/games/minesweeper/`, no catalog entry in `lib/games.ts` and no registry entry, so there is no `touch` layout (classification: Missing). MINESWEEPER-01 gives the layout only as a comment in its Data model and one acceptance line ("D-pad moves cursor, `REVEAL`/`FLAG` buttons work"). This spec makes the layout, the engine-compatibility rules and the touch checks explicit so MINESWEEPER-01 ships touch-ready.

Engine facts taken from MINESWEEPER-01 (Scope "Input", Data model "Input handling"):

- Keys: arrows / `WASD` move a cursor (clamped, no wrap); `Space` reveals, or chords on a revealed number; `F` flags. Cursor is drawn only after first keyboard use.
- Start from `ready`: first reveal (click or `Space`) or any arrow/`WASD` (moves the cursor, does not reveal).
- Listeners: keys on `document`; pointer events and `contextmenu` on the canvas. Ignored targets: `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON`. A synthetic event dispatched on `document` has target `document`, so it passes. Keys are ignored while paused and in `gameover`/`clear`.
- Canvas gestures already cover touch: tap reveals, long press (450 ms) flags. Pad is the precise alternative.
- No modal states, no in-canvas menu, no key set that changes meaning. Pause is the HUD `PAUSE` button (SPEC 10).
- Cursor moves are discrete steps. Whether `event.repeat` is ignored is not stated in MINESWEEPER-01; this spec requires that arrows are NOT filtered by `event.repeat` (see Implementation plan step 2).

## Scope

**In:**

- Registry `touch` layout for `minesweeper` in `lib/games/registry.ts` (added by MINESWEEPER-01 step 5): `dpad` = all four arrows, `buttons` = `REVEAL` (`Space`), `FLAG` (`KeyF`), `repeat` = all four arrows, no `abilityButtons`.
- Auto-repeat on the D-pad so the cursor can cross a 20-column board without 19 taps (existing `repeat` mechanism, 170 ms delay, 50 ms interval).
- Start from ready via `REVEAL` (`Space`, first reveal) or any D-pad direction (engine behavior, cursor only).
- Engine compatibility check: arrow `keydown` with `repeat: true` must move the cursor; `Space` and `KeyF` must act once per physical press (they are not in `repeat`, so the pad never sends repeats for them).
- Touch acceptance checks for Minesweeper.
- Reuse of the shared `TouchPad` and shared MK-II `.touch-pad`/`.tp-*` styles unchanged.

**Out of scope (for future specs):**

- Changing the shared MK-II style, pulsing gem hub, dot-grid texture, inner border, dashed press ring, keyboard light-up, per-game pad skins, `A`/`B` letters, extra fonts.
- Swipe / drag / tap-zone gestures beyond what the canvas already does (tap reveal, long-press flag).
- Mode toggle button (REVEAL/FLAG tap mode).
- `HINT` button (belongs to `specs/game-core/minesweeper/03-minesweeper-hint-assist.md`, which adds the third button).
- A `START` or `PAUSE` pad button.
- Changing in-canvas prompt `CLICK OR PRESS SPACE TO START` to touch wording.
- Haptics, sound on press, fullscreen, orientation lock.

## Data model

```ts
// lib/games/registry.ts — minesweeper entry, `touch` field only (TouchLayout unchanged)
touch: {
  dpad: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"],
  buttons: [
    { label: "REVEAL", code: "Space" },
    { label: "FLAG", code: "KeyF" },
  ],
  repeat: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"],
},
```

No `GameCallbacks` change. No engine change beyond the compatibility rule above. No new types.

Layout table:

| Game        | `dpad`    | `buttons`                       | `repeat`  | `abilityButtons` |
| ----------- | --------- | ------------------------------- | --------- | ---------------- |
| minesweeper | `← ↑ → ↓` | `REVEAL`=`Space`, `FLAG`=`KeyF` | `← ↑ → ↓` | —                |

MK-II visual table:

| Element           | Rendering                                                  |
| ----------------- | ---------------------------------------------------------- |
| D-pad             | Full cross: 4 keys 50×50, hub centered, no empty slots     |
| Button 0 `REVEAL` | Magenta (`a0`), pill (6 chars does not fit a 64 px circle) |
| Button 1 `FLAG`   | Cyan (`a1`), circle 64×64 (4 chars)                        |
| Button 2+         | None (a future `HINT` from spec 03 would be yellow `a2`)   |

**Constants:** min key size 48×48 px (D-pad key 50×50, buttons min 64×64); repeat delay 170 ms, repeat interval 50 ms (existing pad constants).

**Event shape:** `new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true, repeat })` on `document`; `pointerdown` → `keydown`, `pointerup`/`pointercancel`/`lostpointercapture` → `keyup`. Arrows add `repeat: true` events after 170 ms hold, every 50 ms. `Space` and `KeyF` never repeat.

Conventions: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`) before writing code. UI per `/frontend-design` (no new UI: shared pad only). Engine stays framework-free; `shadowBlur` ≤ 8.

## Implementation plan

Each step leaves the app runnable and is commitable alone. Requires MINESWEEPER-01 steps 1–5 (engine and registry entry exist). If MINESWEEPER-01 step 5 already wrote this exact `touch` value, step 1 is a no-op and only the checks remain.

1. `lib/games/registry.ts`: ensure the `minesweeper` entry has `touch` exactly as in Data model. Check: `npm run build` + `npm run lint`.
2. Verify the engine against the synthetic bridge: keys on `document`, not canvas; no `isTrusted` check; target filter lets `document` pass; arrow handling does not early-return on `event.repeat`; `Space`/`F` are not repeated by the pad. If the engine ignores `event.repeat` on arrows, remove that guard (smallest change; cursor moves are idempotent per step). Check: grep `lib/games/minesweeper/engine.ts` for `isTrusted`, `repeat`, listener targets.
3. Touch run in Playwright (`hasTouch: true, isMobile: true`, 390×844) at `/games/minesweeper/play`: pad visible, full cross, `REVEAL` and `FLAG`; start with `REVEAL`; move cursor with D-pad (tap and hold); reveal, flag, chord; hit a mine; clear a board; pause/GAME OVER. Check: screenshots (ready, mid-board with cursor, pressed key, GAME OVER) saved to `.playwright-mcp/screenshots`.
4. Manual check on a real phone via LAN (`http://<LAN-IP>:3000`). Check: a run from ready to GAME OVER is playable with the pad and with canvas taps.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `minesweeper` registry `touch` = 4 directions, buttons `REVEAL`=`Space` and `FLAG`=`KeyF`, `repeat` = 4 directions, no `abilityButtons`.
- [ ] Desktop (fine pointer): no pad visible on `/games/minesweeper/play`; keyboard and mouse play unchanged.
- [ ] Playwright touch emulation (`hasTouch: true, isMobile: true`, 390×844): pad visible under the CRT, no horizontal scroll.
- [ ] MK-II look matches `resources/gamepad-assets/gamepad-neon.png`: beveled shell, 3D D-pad keys with plain hub (no gem), glossy round/pill buttons.
- [ ] Full cross rendered (all 4 directions); hub centered; no unused-direction slots.
- [ ] Button colors by index: `REVEAL` magenta pill, `FLAG` cyan circle.
- [ ] Labels `REVEAL` and `FLAG` on one line, no wrap.
- [ ] Pressed D-pad key shifts down (`translateY(3px)`) and turns cyan; pressed button shifts down (`translateY(4px) scale(0.97)`); released → idle look.
- [ ] D-pad keys and buttons ≥ 48×48 px at 390 px width.
- [ ] No `box-shadow` / `text-shadow` / `drop-shadow` blur > 8 px in pad rules.
- [ ] From ready, `REVEAL` performs the first reveal (opens a zero area, timer starts); a D-pad tap only shows/moves the cursor and reveals nothing.
- [ ] Each D-pad direction moves the cursor exactly one cell per tap; clamped at board edges (no wrap).
- [ ] Holding a direction > 170 ms moves the cursor repeatedly (every 50 ms) until release; crossing a 20-column board takes < 2 s.
- [ ] `REVEAL` on a hidden cell reveals; on a satisfied revealed number chords; holding `REVEAL` does not repeat.
- [ ] `FLAG` toggles a flag at the cursor once per tap; holding does not repeat; MINES readout updates.
- [ ] Canvas tap reveals and long press (450 ms) flags still work with the pad visible; tapping the canvas moves the cursor to that cell.
- [ ] Release safety: finger sliding off a key or button sends `keyup`; no stuck key, no runaway cursor.
- [ ] Pausing (HUD `PAUSE`), BOARD CLEARED banner and GAME OVER release held keys; pad presses do nothing while paused/over/clearing.
- [ ] After BOARD CLEARED the next board returns to ready and `REVEAL` starts it.
- [ ] PLAY AGAIN returns to ready; pad works again.
- [ ] Long-press on pad does not select text, open a context menu, zoom or scroll.
- [ ] GAME OVER `SAVE SCORE` input can be typed on touch; pad does not move the cursor or reveal.
- [ ] No console errors or hydration warnings on `/games/minesweeper/play`.
- [ ] Screenshots in `.playwright-mcp/screenshots`.
- [ ] Manual check on a real phone via LAN: run playable start → GAME OVER.

## Decisions

- **Yes:** D-pad (4 dirs) + `REVEAL` + `FLAG`, as MINESWEEPER-01 states. Covers every action the keyboard has (move, reveal/chord, flag). Discarded: single mode-toggle button (extra state, desync risk), pad `PAUSE`/`START` buttons (HUD has pause; `REVEAL` starts).
- **Yes:** `REVEAL` first (magenta, primary action, starts the game from ready). `FLAG` second (cyan). Leaves index 2 free for spec 03's `HINT` (yellow) without recoloring.
- **Yes:** `repeat` on all four arrows. Cursor travel on 20×14 boards would need up to 19 taps otherwise. Discarded: no repeat (slow), repeat on `Space`/`F` (would spam reveals/flag toggles).
- **Yes:** Engine must not filter arrows by `event.repeat`. Unlike Froggy (hop per keydown), cursor movement is idempotent per step. Discarded: pad-side workaround (would need a `TouchLayout` change).
- **Yes:** Label `REVEAL` stays (6 chars, under the ~7 limit) as a pill. Discarded: `OPEN`/`DIG` (less clear).
- **Yes:** Shared `TouchPad` and `TouchLayout` unchanged. Discarded: any `TouchLayout` extension, per-game pad component or CSS.
- **Yes:** Separate spec from MINESWEEPER-01 even though it adds the entry. This spec owns touch verification and the `repeat` rule.
- **Yes:** Engine unchanged except the `event.repeat` rule; no `GameCallbacks` addition (no modal state).
- **Yes:** Canvas tap/long-press kept as secondary input. Discarded: disabling canvas pointer on touch (pad-only is less direct).
- **Note:** `minesweeper` is not yet in `lib/games.ts`; MINESWEEPER-01 step 1 adds it. Audit used spec-only mode. Spec 03 later appends `HINT` (`KeyH`) as the third button; that is compatible with this layout (3 buttons max).

## Risks

| Risk                                                                                | Mitigation                                                                       |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Engine ignores `event.repeat` on arrows, so hold-to-travel does nothing             | Step 2 greps and removes the guard; acceptance checks hold behavior.             |
| Engine filters `BUTTON` targets and a future change checks `e.target` more strictly | Synthetic events target `document`; step 2 verifies the filter.                  |
| Cursor not visible until first keyboard use, so first D-pad tap seems to do nothing | By MINESWEEPER-01 design the first arrow draws the cursor; acceptance covers it. |
| Long press on canvas conflicts with `REVEAL` taps                                   | Independent inputs; pad has its own pointer capture.                             |
| Pad registered before the engine ships breaks build (`getEngine` missing)           | Step 1 requires MINESWEEPER-01 step 5 first.                                     |

## What is **not** in this spec

- Changing the shared MK-II style, pulsing gem hub, dot-grid texture, inner border, dashed press ring, keyboard light-up, per-game pad skins, `A`/`B` letters, extra fonts.
- Swipe/tap-zone gestures beyond the canvas ones, mode toggle button, `HINT` button, `START`/`PAUSE` pad buttons.
- Touch wording for in-canvas prompts; haptics, sound on press, fullscreen, orientation lock.

_Each one, if it lands, goes in its own spec._
