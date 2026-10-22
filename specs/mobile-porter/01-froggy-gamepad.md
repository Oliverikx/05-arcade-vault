# SPEC PAD-01 — FROGGY gamepad

> **Status:** Draft
> **Depends on:** `specs/game-core/froggy/01-froggy-core-game.md`, SPEC 10, SPEC 11
> **Date:** 2026-10-22
> **Objective:** Make Froggy fully playable on touch devices with the shared MK-II `TouchPad`: a 4-way D-pad and no action buttons, registered through the `touch` field of its registry entry.

## Why this spec exists

Spec-only audit: Froggy is specced (`specs/game-core/froggy/01-froggy-core-game.md`) but not built. There is no `lib/games/froggy/` and no registry entry yet, so there is no `touch` layout (classification: Missing). The game spec only mentions the layout in passing (Scope "Registry `keyboardRequired` is not used"; Data model comment on the registry entry) and has no touch acceptance beyond "Touch D-pad shows 4 directions and no action buttons". This spec makes the layout, the engine-compatibility rules and the touch checks explicit so FROGGY-01 ships touch-ready.

Engine facts taken from FROGGY-01 (Scope "Controls", Data model "Input handling"):

- Hops: `←↑→↓` / `WASD`, one hop per discrete `keydown`; `event.repeat` is ignored; input is locked during the 90 ms hop.
- Start from `ready`: any arrow/`WASD` key, `Space` or canvas click. The starting arrow only starts; the first hop needs a second press.
- Listeners: keys on `document`, click on the canvas. Ignored targets: `INPUT`/`SELECT`/`TEXTAREA`/`BUTTON`. A synthetic event dispatched on `document` has target `document`, so it passes.
- No modal states, no in-canvas menu, no Space action during play. Pause is the HUD `PAUSE` button (SPEC 10).

## Scope

**In:**

- Registry `touch` layout for `froggy` in `lib/games/registry.ts` (added by FROGGY-01 step 5): `dpad` = all four arrows, `buttons: []`, no `repeat`, no `abilityButtons`.
- Start from ready via any D-pad direction (engine behavior, no extra button).
- Touch acceptance checks for Froggy.
- Reuse of the shared `TouchPad` and shared MK-II `.touch-pad`/`.tp-*` styles unchanged.

**Out of scope (for future specs):**

- Changing the shared MK-II style, pulsing gem hub, dot-grid texture, inner border, dashed press ring, keyboard light-up, per-game pad skins, `A`/`B` letters, extra fonts.
- Swipe / tap-zone / drag gestures to hop.
- Auto-repeat (held direction hopping continuously). Needs an engine change (it ignores `event.repeat`).
- A `START` or `PAUSE` pad button.
- Changing in-canvas prompt `PRESS ARROW KEY OR SPACE TO START` to touch wording.
- Haptics, sound on press, fullscreen, orientation lock.

## Data model

```ts
// lib/games/registry.ts — froggy entry, `touch` field only (TouchLayout unchanged)
touch: {
  dpad: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"],
  buttons: [],
},
```

No `GameCallbacks` change. No engine change. No new types.

Layout table:

| Game   | `dpad`    | `buttons` | `repeat` | `abilityButtons` |
| ------ | --------- | --------- | -------- | ---------------- |
| froggy | `← ↑ → ↓` | —         | —        | —                |

MK-II visual table:

| Element       | Rendering                                                                               |
| ------------- | --------------------------------------------------------------------------------------- |
| D-pad         | Full cross: 4 keys 50×50, hub centered, no empty slots                                  |
| Action button | None (cluster empty; same as Snake)                                                     |
| Colors        | N/A (no buttons; indexes 0/1/2+ = magenta/cyan/yellow apply if a future spec adds some) |

**Constants:** min key size 48×48 px (D-pad key 50×50); no repeat delay (not used).

**Event shape:** `new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true })` on `document`; `pointerdown` → `keydown`, `pointerup`/`pointercancel`/`lostpointercapture` → `keyup`. `repeat` is always `false`: each press is one hop.

Conventions: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`) before writing code. UI per `/frontend-design` (no new UI: shared pad only). Engine stays framework-free; `shadowBlur` ≤ 8.

## Implementation plan

Each step leaves the app runnable and is commitable alone. Requires FROGGY-01 steps 1–5 (engine and registry entry exist). If FROGGY-01 step 5 already wrote this exact `touch` value, steps 1 is a no-op and only the checks remain.

1. `lib/games/registry.ts`: ensure the `froggy` entry has `touch` exactly as in Data model (4 directions, `buttons: []`, no `repeat`). Check: `npm run build` + `npm run lint`.
2. Verify the engine against the synthetic bridge: keys on `document`, not canvas; no `isTrusted` check; target filter lets `document` pass; `event.repeat` ignored. Check: grep `lib/games/froggy/engine.ts` for `isTrusted`, listener targets.
3. Touch run in Playwright (`hasTouch: true, isMobile: true`, 390×844) at `/games/froggy/play`: pad visible, full cross, no buttons; start from ready with a D-pad tap; hop each direction; ride a log; die and respawn; pause/GAME OVER. Check: screenshots (ready, mid-run, pressed key, paused) saved to `.playwright-mcp/screenshots`.
4. Manual check on a real phone via LAN (`http://<LAN-IP>:3000`). Check: a run from ready to GAME OVER is playable.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `froggy` registry `touch` = 4 directions, `buttons: []`, no `repeat`, no `abilityButtons`.
- [ ] Desktop (fine pointer): no pad visible on `/games/froggy/play`; keyboard play unchanged.
- [ ] Playwright touch emulation (`hasTouch: true, isMobile: true`, 390×844): pad visible under the CRT, no horizontal scroll.
- [ ] MK-II look matches `resources/gamepad-assets/gamepad-neon.png`: beveled shell, 3D D-pad keys with plain hub (no gem), no action buttons rendered.
- [ ] Full cross rendered (all 4 directions); hub centered; no unused-direction slots.
- [ ] Button colors by index (0 magenta, 1 cyan, 2+ yellow): not applicable, no buttons.
- [ ] Pressed D-pad key shifts down (`translateY(3px)`) and turns cyan; released → idle look.
- [ ] D-pad keys ≥ 48×48 px at 390 px width.
- [ ] No `box-shadow` / `text-shadow` / `drop-shadow` blur > 8 px in pad rules.
- [ ] Tapping any D-pad direction in `ready` starts the game (no hop); the second tap hops exactly 40 px in that direction.
- [ ] `←` `→` `↑` `↓` each hop one cell; holding a direction does not hop repeatedly.
- [ ] Rapid taps during the 90 ms hop are ignored without stuck state.
- [ ] Release safety: finger sliding off a key sends `keyup`; no stuck key.
- [ ] Pausing (HUD `PAUSE`) and GAME OVER release held keys; pad presses do nothing while paused/over.
- [ ] PLAY AGAIN returns to ready; D-pad starts again.
- [ ] Long-press on pad does not select text, open a context menu, zoom or scroll.
- [ ] GAME OVER `SAVE SCORE` input can be typed on touch; pad does not hop.
- [ ] No console errors or hydration warnings on `/games/froggy/play`.
- [ ] Screenshots in `.playwright-mcp/screenshots`.
- [ ] Manual check on a real phone via LAN: run playable start → GAME OVER.

## Decisions

- **Yes:** D-pad only, `buttons: []`, as FROGGY-01 states. Froggy has no action key during play (Space only starts). Discarded: a `START`/`HOP` button (redundant: any arrow starts), a `PAUSE` button (HUD has it, SPEC 10).
- **Yes:** All four directions enabled and rendered, no unused slots. Discarded: hiding `↓` (the frog needs it to step back).
- **Yes:** No `repeat`. The engine ignores `event.repeat` and hops once per keydown, so synthetic repeats would do nothing. Discarded: auto-repeat plus engine change (out of scope; classic Frogger is one hop per press).
- **Yes:** Shared `TouchPad` and `TouchLayout` unchanged. Discarded: any `TouchLayout` extension, per-game pad component or CSS.
- **Yes:** Separate spec from FROGGY-01 even though FROGGY-01 adds the entry. This spec owns the touch verification. Discarded: only relying on a single acceptance line in FROGGY-01.
- **Yes:** Engine unchanged; no `GameCallbacks` addition (no modal state).
- **No:** Swipe gestures (undiscoverable, overlap with page scroll).
- **Note:** `froggy` is not yet in `lib/games.ts`; FROGGY-01 step 1 adds it. Audit used spec-only mode.

## Risks

| Risk                                                                                | Mitigation                                                                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Engine filters `BUTTON` targets and a future change checks `e.target` more strictly | Synthetic events target `document`; step 2 verifies the filter.                 |
| Starting tap feels like it "did nothing" (start consumes the arrow)                 | By FROGGY-01 design; canvas prompt shows start. Touch wording is a future spec. |
| Tapping fast across hops feels laggy (input ignored for 90 ms)                      | Intended by FROGGY-01; hop time is short.                                       |
| Pad registered before the engine ships breaks build (`getEngine` missing)           | Step 1 requires FROGGY-01 step 5 first.                                         |

## What is **not** in this spec

- Changing the shared MK-II style, pulsing gem hub, dot-grid texture, inner border, dashed press ring, keyboard light-up, per-game pad skins, `A`/`B` letters, extra fonts.
- Swipe/tap-zone gestures, auto-repeat hopping, `START`/`PAUSE` pad buttons.
- Touch wording for in-canvas prompts; haptics, sound on press, fullscreen, orientation lock.

_Each one, if it lands, goes in its own spec._
