# SPEC FROGGY-03 — FROGGY sound and mute

> **Status:** Draft
> **Depends on:** 01 of this game (`01-froggy-core-game.md`); event names for fly/turtle/snake sounds exist only if `02-froggy-hazards-bonus.md` is implemented
> **Date:** 2026-10-22
> **Objective:** Add synthesized Web Audio sound effects to Froggy and a mute toggle in a Froggy toolbar.

## Why this spec exists

Froggy ships silent. The platform already passes a `muted` prop through `components/game-screen.tsx` (used by arkanoid via `setMuted`) and has toolbar components (`components/arkanoid-toolbar.tsx`). This spec adds a framework-free sound module and a mute toggle, with no audio files.

## Scope

**In:**

- `lib/games/froggy/sound.ts`: Web Audio synthesis (oscillator + gain envelopes), no assets. Lazily creates `AudioContext` on first user input (start key/click) to satisfy autoplay policy.
- Sound events (all short, ≤ 400 ms except level clear 700 ms, master gain `0.15`):
  - `hop` — square 440 → 660 Hz, 60 ms.
  - `splash` — noise burst + 200 → 80 Hz sine, 300 ms (drown).
  - `squash` — sawtooth 150 → 40 Hz, 250 ms (vehicle).
  - `timeout` — 3 descending beeps 440/330/220 Hz, 100 ms each.
  - `pad` — triangle arpeggio 523/659/784 Hz, 70 ms each.
  - `levelClear` — 5-note rising arpeggio 523 → 1047 Hz, 700 ms.
  - `gameOver` — descending square 392 → 98 Hz, 400 ms.
  - If spec 02 is implemented: `fly` (square 1200 Hz blip, 80 ms), `dive` warning tick (sine 300 Hz, 40 ms).
- Engine: add `setMuted(muted: boolean)` to the returned object (extra method like arkanoid; `GameEngine` contract unchanged) and export `FroggyEngine` type. Muted = no oscillators created, no `AudioContext` resume.
- Sound pauses with the game: no new sounds while paused; `AudioContext.suspend()` on pause, `resume()` on unpause.
- Toolbar `components/froggy-toolbar.tsx`: SOUND ON/OFF toggle using the existing `.tetris-toolbar` classes. Mute persists in `localStorage` key `av_froggy_muted`, read after mount (no hydration mismatch). Default: sound on.
- `components/game-player.tsx`: render `FroggyToolbar` when the game is froggy and pass `muted` to `GameScreen` (follow the existing arkanoid wiring; the generic engine wiring still branches on registry, only the toolbar is per-game).
- `components/game-screen.tsx`: apply `muted` to froggy through `setMuted?.` (type `Partial<FroggyEngine>` like arkanoid).

**Out of scope (for future specs):** music/background loop, volume slider, audio files, per-effect toggles, skins, touch changes, leaderboard changes.

## Data model

```ts
// lib/games/froggy/sound.ts
export type FroggySfx =
  | "hop"
  | "splash"
  | "squash"
  | "timeout"
  | "pad"
  | "levelClear"
  | "gameOver"
  | "fly" // only emitted if spec 02 is implemented
  | "dive"; // only emitted if spec 02 is implemented
export interface FroggySound {
  unlock(): void; // create/resume AudioContext on user gesture
  play(sfx: FroggySfx): void;
  setMuted(muted: boolean): void;
  suspend(): void;
  resume(): void;
  destroy(): void; // close AudioContext
}
export function createFroggySound(): FroggySound;

// lib/games/froggy/engine.ts — additions
export interface FroggyEngine extends GameEngine {
  setMuted(muted: boolean): void;
}
export function createFroggyGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): FroggyEngine;

// components/froggy-toolbar.tsx
export const FROGGY_MUTE_KEY = "av_froggy_muted";
export function useFroggyMuted(): [boolean, (m: boolean) => void];
export function FroggyToolbar(props: {
  muted: boolean;
  onChange: (m: boolean) => void;
}): JSX.Element;
```

**Constants:**

| Constant    | Value                                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| Master gain | 0.15                                                                                    |
| SFX length  | hop 60, splash 300, squash 250, timeout 300, pad 210, levelClear 700, gameOver 400 (ms) |
| Storage key | `av_froggy_muted` (`"1"` muted, absent/`"0"` on)                                        |

**Palette (toolbar):** reuse `.tetris-toolbar` styles; active state `#00ff88`, inactive `--ink-dim`.

Callbacks and input unchanged. Unlock happens on the keydown/click that leaves `ready`.

Conventions: Next.js 16 breaking changes — read `node_modules/next/dist/docs/01-app` (client components, `useEffect`, localStorage after mount) first. Use `/frontend-design` for the toolbar. Sound module is framework-free.

## Implementation plan

1. `lib/games/froggy/sound.ts`: synth helpers, master gain, `unlock/play/suspend/resume/destroy`. Check: build + lint.
2. Engine: create sound, `unlock()` on start, emit events at hop/death/pad/clear/timeout/game over, `setMuted`, suspend/resume in `setPaused`, `destroy()` closes context. Check: sounds audible in browser; no sound at `ready`.
3. `components/froggy-toolbar.tsx` + `useFroggyMuted` (localStorage after mount). Check: toggle persists across reload, no hydration warning.
4. Wire `components/game-player.tsx` and `components/game-screen.tsx` (`Partial<FroggyEngine>`). Check: toggling mutes immediately mid-run; other games unchanged.
5. Playwright check of toolbar states (screenshots in `.playwright-mcp/screenshots`). Check: SOUND ON/OFF label and persisted state after reload.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] No sound before the first start input; no autoplay warning in the console.
- [ ] Hop, splash, squash, timeout, pad, level clear and game over each play their sound once per event.
- [ ] Master gain is 0.15; no clipping when two sounds overlap.
- [ ] SOUND toggle mutes/unmutes instantly during a run; muted creates no oscillators.
- [ ] Mute state persists after reload via `av_froggy_muted`; no hydration warning.
- [ ] Pausing silences audio and resuming continues; no sounds fire while paused.
- [ ] PLAY AGAIN and leaving the page do not leak an `AudioContext` (closed in `destroy()`).
- [ ] Typing in the SAVE SCORE input produces no sound.
- [ ] Arkanoid mute behavior and other games' toolbars unchanged.
- [ ] If spec 02 is implemented, fly and dive-warning sounds play; otherwise those events are not emitted.

## Decisions

- **Yes:** Synthesized Web Audio, no files. Discarded: bundled audio samples.
- **Yes:** `setMuted` as an extra engine method + `muted` prop, same as arkanoid. Discarded: changing the shared `GameEngine` contract.
- **Yes:** Sound on by default, mute persisted in localStorage. Discarded: off by default, no persistence.
- **Yes:** Master gain 0.15, short effects. Discarded: volume slider.
- **No:** Background music (own spec).
- **Yes:** Spec 03 tolerates spec 02 being absent; `fly`/`dive` events are guarded. Discarded: hard dependency on 02.
- **Yes (inherited):** framework-free engine with `destroy()`; platform HUD/modal; PAUSE rules; English strings; neon palette; `saveScore` untouched; no migration here.

## Risks

| Risk                                     | Mitigation                                                           |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Autoplay policy blocks `AudioContext`    | Create/resume only inside the start key/click handler.               |
| Strict Mode double engine → two contexts | `destroy()` closes the context; engine creates sound in the factory. |
| Hydration mismatch from localStorage     | Read mute state after mount in `useFroggyMuted`.                     |
| Sound fires during `dying`/paused        | Emit only from state transitions inside `update()` while unpaused.   |

## What is **not** in this spec

- Music/background loop, volume slider, audio files, per-effect toggles, skins, touch changes.
- Auth, anti-cheat, realtime, other games' engines.

_Each one, if it lands, goes in its own spec._
