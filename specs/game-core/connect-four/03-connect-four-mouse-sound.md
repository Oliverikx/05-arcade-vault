# SPEC CONNECT-FOUR-03 — CONNECT FOUR mouse control and sound

> **Status:** Draft
> **Depends on:** 01 of this game (`01-connect-four-core-game.md`)
> **Date:** 2026-10-22
> **Objective:** Add mouse column hover/click-to-drop and synthesized sound effects with a mute toggle to Connect Four.

## Why this spec exists

SPEC 01 is keyboard-driven (click only starts a round). A board game is natural with a pointer, and a game this quiet benefits from feedback sounds. This spec adds pointer control to `lib/games/connect-four/engine.ts` and a small WebAudio module (no audio files) plus a SOUND toolbar, following the per-game toolbar pattern (`components/snake-toolbar.tsx`, `components/arkanoid-toolbar.tsx`) wired in `components/game-player.tsx`. Independent of SPEC 02 (does not touch hint or streak code).

## Scope

**In:**

- Mouse: `mousemove` over the canvas sets the cursor column to the one under the pointer (canvas coordinates, accounting for CSS scaling via `getBoundingClientRect`); only inside the board x range 96..544. Click inside the board drops in that column during `aiming`. Click in `ready` / `roundover` keeps SPEC 01 behavior (start / continue). Pointer ignored while paused, in `gameover`, while a disc falls and during the CPU turn.
- Keyboard and mouse share the same cursor; the last input wins.
- Sound: new `lib/games/connect-four/sound.ts`, WebAudio oscillator synthesis, no assets:
  - `drop` (disc lands): 160 Hz → 80 Hz triangle thud, 90 ms.
  - `cpu` (CPU disc lands): 220 Hz → 110 Hz triangle, 90 ms.
  - `win`: ascending square arpeggio 440, 554, 659, 880 Hz, 90 ms each.
  - `lose`: descending sawtooth 330 → 110 Hz, 400 ms.
  - `draw`: 2 sine beeps 330 Hz, 120 ms each.
  - `move` (cursor change): 600 Hz square blip, 20 ms, volume lower.
- `AudioContext` created lazily on the first user gesture (key or click), `resume()` if suspended; closed in `destroy()`.
- Engine API extension: `ConnectFourEngine.setMuted(muted: boolean)`; default unmuted. Muting stops no running sound abruptly (sounds are ≤ 400 ms).
- Toolbar `components/connect-four-toolbar.tsx` below the CRT, shown only for `connect-four`: `SOUND ON` / `SOUND OFF` toggle, persisted in `localStorage` key `av_connect_four_sound` (try/catch), default ON. Follows the style of the existing toolbars.
- `components/game-player.tsx`: render the toolbar and forward the muted flag to the engine. Wiring only; no new branching in engine creation (flag applied after create via `setMuted`).
- English strings only.

**Out of scope (for future specs):** music, volume slider, per-effect toggles, skins, hint/streak (SPEC CONNECT-FOUR-02), touch gestures beyond the registry pad, haptics, auth, anti-cheat, realtime.

## Data model

```ts
// lib/games/connect-four/engine.ts — return type extended
export interface ConnectFourEngine extends GameEngine {
  setMuted(muted: boolean): void;
}
export function createConnectFourGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): ConnectFourEngine;

// lib/games/connect-four/sound.ts
export type Sfx = "move" | "drop" | "cpu" | "win" | "lose" | "draw";
export interface Sound {
  play(sfx: Sfx): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}
export function createSound(): Sound;

// components/connect-four-toolbar.tsx
export const SOUND_KEY = "av_connect_four_sound";
export function useConnectFourSound(): [boolean, (on: boolean) => void];
export function ConnectFourToolbar(props: {
  sound: boolean;
  onChange: (on: boolean) => void;
}): React.JSX.Element;
```

**Constants:**

| Constant        | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| Board x range   | 96..544 (7 columns × 64 px); column = `floor((x − 96) / 64)`            |
| Master gain     | 0.15 (move blip 0.05)                                                   |
| Sound durations | move 20 ms, drop 90 ms, cpu 90 ms, win 360 ms, lose 400 ms, draw 360 ms |
| Storage key     | `av_connect_four_sound` (`"1"` / `"0"`), default `"1"`                  |

**Palette:** toolbar uses existing toolbar classes and `--cyan` for the active state; no new canvas colors.

Callbacks fire only on change, unchanged from SPEC 01. Pointer listeners are on the canvas (`mousemove`, `click`) and removed in `destroy()`. `useConnectFourSound` reads `localStorage` after mount (avoid hydration mismatch) like the other toolbar hooks.

Conventions: Next.js 16 breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`) before writing code; engine and `sound.ts` framework-free; toolbar UI per `/frontend-design`.

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. Mouse in `lib/games/connect-four/engine.ts`: `mousemove` column mapping, click-to-drop in `aiming`, listeners removed in `destroy()`. Check: build + lint; hover moves the ghost disc, click drops.
2. `lib/games/connect-four/sound.ts`: lazy `AudioContext`, six effects, mute, `destroy()`. Check: build + lint.
3. Hook sounds into the engine (cursor move, disc land, CPU land, win, lose, draw) and add `setMuted` to the returned engine. Check: build + lint; effects audible at the right events, none while paused.
4. `components/connect-four-toolbar.tsx` + wiring in `components/game-player.tsx` (toolbar only for `connect-four`, `setMuted` on change and on mount). Check: toggle mutes immediately; reload keeps the choice.
5. Playwright pass: hover at 390px and desktop widths, toolbar screenshot saved to `.playwright-mcp/screenshots`. Check: column under pointer matches the ghost disc after CSS scaling.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] Hovering over column N (x in `[96 + 64N, 160 + 64N)` canvas px) puts the ghost disc in column N, at any CSS scale.
- [ ] Click inside the board drops in the clicked column during `aiming`; click outside the board does nothing in `aiming`.
- [ ] Click in `ready` still starts the run; click in `roundover` still continues; click while paused or in `gameover` does nothing.
- [ ] Pointer and keyboard share one cursor; moving the mouse after a key press overrides it.
- [ ] Pointer input is ignored while a disc falls and during the CPU turn.
- [ ] Sound plays for cursor move, player landing, CPU landing, win, lose and draw; nothing plays while paused or after `destroy()`.
- [ ] No audio plays before the first user gesture and no autoplay warning appears in the console.
- [ ] `SOUND ON` / `SOUND OFF` toggle appears only on `/games/connect-four/play` and mutes/unmutes immediately.
- [ ] The choice persists in `localStorage` `av_connect_four_sound`; default is ON; works when `localStorage` throws.
- [ ] Leaving the page closes the `AudioContext`, removes listeners; Strict Mode creates no second context.
- [ ] SPEC 01 keyboard play unchanged; typing in SAVE SCORE still moves nothing.
- [ ] No hydration warnings on `/games/connect-four/play`.
- [ ] At 390px width the toolbar fits with no horizontal scroll.

## Decisions

- **Yes:** Pointer follows the shared cursor; click drops. Discarded: click-only without hover (no preview), separate mouse mode.
- **Yes:** Synthesized WebAudio, no files, no `public/games/connect-four/`. Discarded: mp3 assets (none exist for this game), HTMLAudio pool.
- **Yes:** Lazy `AudioContext` on first gesture. Discarded: creating at engine start (autoplay policy warnings).
- **Yes:** Mute stored per browser, default ON, toolbar below the CRT. Discarded: no persistence, in-canvas toggle, platform-wide mute.
- **Yes:** `setMuted` on an extended engine type instead of a new callback. Discarded: passing mute through `GameCallbacks`.
- **Yes:** Mouse and sound share one spec. Discarded: two specs (both are small and the click event feeds the audio unlock).
- **No:** Music and volume slider.
- **Yes (inherited):** framework-free engine with `destroy()`, platform HUD/modal, PAUSE flows, English strings, neon palette, `saveScore` Server Action, no new migration.

## Risks

| Risk                                                     | Mitigation                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| CSS-scaled canvas gives wrong hover column               | Convert with `getBoundingClientRect` ratio, not offsets; test at 390px.                                      |
| Browser blocks audio before a gesture                    | Lazy context on first key/click; `resume()` when suspended.                                                  |
| Strict Mode leaks an `AudioContext`                      | `destroy()` calls `close()` and drops references.                                                            |
| Sound fires while paused (CPU delay completes)           | Sounds triggered only from `update()` events, which freeze on pause.                                         |
| Toolbar hook causes hydration mismatch                   | Read `localStorage` after mount, render default ON until then.                                               |
| Pointer on touch devices double-fires with the touch pad | Mouse handlers ignore `pointerType === "touch"`-synthesized clicks outside board; pad still dispatches keys. |

## What is **not** in this spec

- Music, volume slider, per-effect toggles.
- Skins, hint/streak (SPEC CONNECT-FOUR-02), haptics, extra touch gestures.
- Auth, anti-cheat, realtime.

_Each one, if it lands, goes in its own spec._
