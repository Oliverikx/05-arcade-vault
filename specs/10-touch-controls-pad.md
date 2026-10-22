# SPEC 10 — Touch controls pad for every game

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-10-22
> **Objective:** Add one shared on-screen gamepad (D-pad + per-game action buttons) under the CRT on touch devices so every real game is fully playable without a keyboard.

## Why this spec exists

The four real games (`asteroids`, `tetris`, `arkanoid`, `snake`) read keyboard events only (Arkanoid also mouse). On a phone they cannot be played; the player only shows a `KEYBOARD REQUIRED` note (`components/game-player.tsx`, `.keyboard-note` in `app/globals.css`). Every engine already reacts to a small set of key codes, so a pad that dispatches those same codes makes them playable with almost no engine changes. Only Tetris needs one: its ability menu (keys `1–5`) is drawn in the canvas and the pad must know when it is open.

## Scope

**In:**

- New component `components/touch-pad.tsx`: classic gamepad layout below `.crt` (above per-game toolbar). D-pad cross on the left, action buttons on the right. Same look for every game; only the button count changes.
- Per-game layout lives in the registry (`lib/games/registry.ts`, new `touch` field). Mapping:
  - `snake` — D-pad `←↑→↓` steer (also starts from ready/serve, existing engine behavior). No action buttons.
  - `arkanoid` — D-pad `←` `→` move; `↑` `↓` rendered dimmed/disabled. Button `LAUNCH` = `Space`.
  - `asteroids` — D-pad `←` `→` rotate, `↑` thrust; `↓` dimmed. Button `FIRE` = `Space`.
  - `tetris` — D-pad `←` `→` move, `↓` soft drop, `↑` rotate. Buttons `DROP` = `Space`, `ABILITY` = `KeyE`. While the ability menu is open the buttons become `1`…`5` (`Digit1`…`Digit5`) + `BACK` (`Escape`).
- Start from ready: the `Space`-mapped button (or a canvas tap, already handled by engines' click/mousedown) starts each game; Snake starts from the D-pad.
- Pause stays on the HUD `PAUSE` button; no pad pause button.
- Input bridge: `pointerdown` → `document.dispatchEvent(new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true }))`; `pointerup` / `pointercancel` / `lostpointercapture` → `keyup`. Pointer capture per button. Multi-touch: each button independent (e.g. Asteroids thrust + fire at once).
- Auto-repeat (Tetris `←` `→` `↓` only): after 170 ms held, extra `keydown` with `repeat: true` every 50 ms until release.
- Release safety: all held pad keys get `keyup` when the game pauses, on GAME OVER, on ability-mode swap and on unmount.
- Action button labels never break across lines; buttons size to their text and the cluster wraps to a new line when they do not fit.
- Navbar hidden on touch devices while a real game is open: `GamePlayer` toggles a `touch-play` class on `body` (effect cleanup, since Next keeps the previous page cached); CSS hides `.av-nav` under `any-pointer: coarse`.
- Touch hygiene on the pad: `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `contextmenu` prevented; buttons ≥ 48×48 px; visible pressed state.
- Visibility by CSS only: `.touch-pad { display: none }`, shown under `@media (any-pointer: coarse)`. No JS detection → no hydration mismatch.
- Tetris engine: emits optional `onAbilityMenu(open)` whenever its `choosing` flag changes (open, pick, cancel, reset/`init`, game over). Fires only on change.
- `GameCallbacks` gains optional `onAbilityMenu?(open: boolean): void`; `components/game-screen.tsx` forwards it; `components/game-player.tsx` keeps `abilityMenu` state and passes it to the pad.
- Remove `keyboardRequired` from `EngineEntry` and all entries; remove the `KEYBOARD REQUIRED` JSX and `.keyboard-note` CSS.
- Docs: `CLAUDE.md` registry line, `.claude/skills/add-game/integration-checklist.md` and `template.md` (+ `.agents/skills/` mirror) — replace `keyboardRequired` with `touch` layout so new games ship touch-ready.
- Pad UI designed with `/frontend-design`, platform neon palette, glow ≤ 8 px.
- English labels only.

**Out of scope (for future specs):**

- Swipe / drag / tap-zone gestures (incl. Arkanoid paddle drag).
- Manual show/hide toggle or persisted touch setting.
- Changing in-canvas prompts (e.g. `PRESS ARROW KEY OR SPACE TO START`) to touch wording.
- Haptics (`navigator.vibrate`), sound on press.
- Fullscreen mode, orientation lock, landscape-specific layout.
- Compacting the HUD on small screens.
- Controls for practice (unregistered) games — they have no engine; no pad shown.
- Gamepad API (physical controllers).

## Data model

```ts
// lib/games/engine-types.ts — one optional addition
export interface GameCallbacks {
  onScore(score: number): void;
  onLives(lives: number): void;
  onLevel(level: number): void;
  onGameOver(finalScore: number): void;
  /** Tetris only: ability menu opened/closed. Fires only on change. */
  onAbilityMenu?(open: boolean): void;
}

// lib/games/registry.ts
export type PadDir = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export interface PadButton {
  label: string; // shown on the button, e.g. "FIRE"
  code: string; // KeyboardEvent.code dispatched, e.g. "Space"
}

export interface TouchLayout {
  dpad: PadDir[]; // enabled directions; others render dimmed
  buttons: PadButton[]; // right cluster, 0..3
  repeat?: PadDir[]; // auto-repeat while held
  abilityButtons?: PadButton[]; // replace `buttons` while onAbilityMenu(true)
}

export interface EngineEntry {
  create(canvas: HTMLCanvasElement, callbacks: GameCallbacks): GameEngine;
  width: number;
  height: number;
  lives: number | null;
  touch: TouchLayout; // replaces keyboardRequired
}

// components/touch-pad.tsx
export function TouchPad(props: {
  layout: TouchLayout;
  abilityMenu: boolean;
  disabled: boolean; // paused || over → release all, ignore presses
}): JSX.Element;
```

**Layouts:**

| Game      | `dpad`    | `buttons`                        | `repeat` | `abilityButtons`                           |
| --------- | --------- | -------------------------------- | -------- | ------------------------------------------ |
| snake     | `← ↑ → ↓` | —                                | —        | —                                          |
| arkanoid  | `← →`     | `LAUNCH`=`Space`                 | —        | —                                          |
| asteroids | `← → ↑`   | `FIRE`=`Space`                   | —        | —                                          |
| tetris    | `← → ↓ ↑` | `DROP`=`Space`, `ABILITY`=`KeyE` | `← → ↓`  | `1`…`5`=`Digit1`…`Digit5`, `BACK`=`Escape` |

**Constants:** repeat delay 170 ms, repeat interval 50 ms, min button size 48×48 px.

**Event shape:** `new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true, repeat })`, dispatched on `document` (reaches `window` listeners: Asteroids engine, GamePlayer `P`/`Esc`). Target is `document` → engines' `INPUT`/`TEXTAREA` ignore check passes. `BACK` (`Escape`) is `preventDefault`ed by Tetris while the menu is open, so GamePlayer does not pause.

No persistence. No DB changes.

Conventions: Next.js 16 has breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`) before writing code. Engines stay framework-free. Reuse `.btn`, neon tokens in `app/globals.css`.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. `lib/games/engine-types.ts`: add optional `onAbilityMenu`. `components/game-screen.tsx`: accept + forward `onAbilityMenu` via `callbacksRef`. Check: build + lint; all games unchanged.
2. `lib/games/tetris/engine.ts`: emit `onAbilityMenu` on every `choosing` change (open, close, pick, `init`, game over), only on change. Check: keyboard `E` with full energy → callback `true`; pick/`Esc` → `false`.
3. `lib/games/registry.ts`: add `PadDir`, `PadButton`, `TouchLayout`, `touch` per entry (table above). Keep `keyboardRequired` for now. Check: build + lint.
4. `components/touch-pad.tsx` + `.touch-pad` CSS (hidden by default, shown on `any-pointer: coarse`) via `/frontend-design`: D-pad, buttons, dimmed dirs, pointer → synthetic key bridge, pointer capture, repeat, release-all on `disabled`/layout swap/unmount. Check: build + lint.
5. `components/game-player.tsx`: `abilityMenu` state (reset on restart), render `<TouchPad>` under `.crt` for registered games, `disabled = paused || over`. Check: Playwright touch emulation, each game playable from the pad.
6. Remove `keyboardRequired` (registry type + entries), `KEYBOARD REQUIRED` JSX, `.keyboard-note` CSS. Check: build + lint; `grep keyboardRequired` empty in `app/`, `components/`, `lib/`.
7. Docs: `CLAUDE.md`, `.claude/skills/add-game/integration-checklist.md`, `.claude/skills/add-game/template.md` and `.agents/skills/` mirrors → `touch: TouchLayout` instead of `keyboardRequired`. Check: no remaining `keyboardRequired` outside past specs.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] Desktop (fine pointer): no pad visible on any `/games/<id>/play`; keyboard/mouse play unchanged.
- [ ] Touch emulation (Playwright context `hasTouch: true, isMobile: true`, 390×844): pad visible under the CRT on all 4 real games, D-pad left, buttons right, no horizontal scroll.
- [ ] Practice (unregistered) games show no pad.
- [ ] Snake: D-pad starts the run and steers; no action buttons rendered.
- [ ] Arkanoid: `◀ ▶` hold moves paddle; `▲ ▼` dimmed and do nothing; `LAUNCH` starts/launches ball.
- [ ] Asteroids: `◀ ▶` rotate while held, `▲` thrusts while held, `FIRE` shoots; holding `▲` + tapping `FIRE` at once both work; `▼` dimmed.
- [ ] Tetris: `DROP` starts from ready and hard-drops; `◀ ▶ ▼` move/soft-drop and auto-repeat when held > 170 ms; `▲` rotates.
- [ ] Tetris: `ABILITY` with full energy opens the menu and the buttons become `1 2 3 4 5 BACK`; a number applies the ability and buttons revert; `BACK` closes the menu without pausing the game.
- [ ] Tetris: `ABILITY` with energy not full → menu does not open, buttons stay `DROP ABILITY`.
- [ ] Releasing a finger always stops the action (no stuck thrust/move), incl. finger sliding off the button.
- [ ] Pausing (HUD `PAUSE`) or GAME OVER releases held keys; pad presses do nothing to the game while paused/over.
- [ ] Long-press on pad does not select text, open a context menu, zoom or scroll the page.
- [ ] GAME OVER `SAVE SCORE` input can be typed in on touch; pad does not interfere.
- [ ] Navbar hidden while a real game is open on touch, and visible again after EXIT.
- [ ] Action button labels stay on one line (e.g. `ABILITY`); buttons wrap to a new row when space runs out.
- [ ] `KEYBOARD REQUIRED` note gone on all devices; `keyboardRequired` absent from `app/`, `components/`, `lib/`, `CLAUDE.md`, add-game skill files.
- [ ] Pad glow ≤ 8 px; labels English; no console errors or hydration warnings on `/games/<id>/play`.
- [ ] Manual check on a real phone via LAN (`http://<LAN-IP>:3000`): all 4 games playable start → GAME OVER.
- [ ] Screenshots (touch emulation, one per game + Tetris ability mode) in `.playwright-mcp/screenshots`.

## Decisions

- **Yes:** One shared pad layout (D-pad + right buttons) for every game, below the CRT. Matches the user's reference screenshot. Discarded: canvas overlay (hides playfield), gestures only (undiscoverable), per-game hybrid (more code).
- **Yes:** Only necessary buttons per game; unused D-pad directions dimmed. Discarded: fixed 4 buttons; START button on every game.
- **Yes:** Synthetic `KeyboardEvent`s on `document`. Engines and their pause/ignore logic reused untouched. Discarded: new `press/release` engine API (4 engines + contract changes).
- **Yes:** Layout data in the registry `touch` field. Player branches on registry, not `game.id` (project convention).
- **Yes:** Visibility via `@media (any-pointer: coarse)` CSS only. Discarded: manual toggle + localStorage, always visible.
- **Yes:** Tetris reports ability menu via optional `onAbilityMenu`; pad swaps to `1–5` + `BACK`. Always in sync. Discarded: pad-only toggle (desyncs when energy not full), abilities keyboard-only.
- **Yes:** Auto-repeat only for Tetris `← → ↓` (170 / 50 ms). Others read held state from keydown/keyup.
- **Yes:** Remove `KEYBOARD REQUIRED` note and `keyboardRequired` field everywhere. Every game is now touch-playable.
- **No:** `HOLD` button (the `C` swap only works after the ability-menu hold, so a pad button did nothing). Pad pause button. HUD `PAUSE` already works on touch.
- **No:** Touch-specific in-canvas prompt text. Canvas tap already starts games; wording change deferred.

## Risks

| Risk                                                                    | Mitigation                                                                                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Stuck key when finger leaves button or touch is cancelled               | Pointer capture + `keyup` on `pointerup`/`pointercancel`/`lostpointercapture`; release-all on pause/over/unmount.                      |
| `BACK` (`Escape`) also pauses via GamePlayer                            | Tetris already `preventDefault`s Esc while menu is open and GamePlayer skips `defaultPrevented`; events dispatched `cancelable: true`. |
| Asteroids listens on `window`, others on `document`                     | Dispatch on `document` with `bubbles: true` → reaches both.                                                                            |
| Synthetic repeat triggers GamePlayer toggles                            | GamePlayer ignores `e.repeat`; only directions repeat.                                                                                 |
| Hybrid devices (touch laptop) show pad                                  | Acceptable; pad is harmless alongside keyboard.                                                                                        |
| Tap on Arkanoid canvas emits emulated mousemove → paddle jumps to tap x | Acceptable (same as mouse); pad is the primary control.                                                                                |
| Double-tap zoom / page scroll on pad                                    | `touch-action: none` on `.touch-pad`.                                                                                                  |
| Engine menu state lost on reset/game over                               | Tetris fires `onAbilityMenu(false)` in `init`/game over; player resets `abilityMenu` on restart.                                       |

## What is **not** in this spec

- Swipe/drag/tap-zone gestures, Arkanoid paddle drag.
- Manual pad toggle or persisted setting.
- Touch wording for in-canvas prompts.
- Haptics, sound, fullscreen, orientation lock, landscape layout, HUD compaction.
- Pad for practice games; physical Gamepad API.

_Each one, if it lands, goes in its own spec._
