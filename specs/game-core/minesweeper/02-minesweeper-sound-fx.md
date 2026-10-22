# SPEC MINESWEEPER-02 — MINESWEEPER sound fx

> **Status:** Implemented
> **Depends on:** MINESWEEPER-01 (`specs/game-core/minesweeper/01-minesweeper-core-game.md`)
> **Date:** 2026-10-22
> **Objective:** Add synthesized sound effects (Web Audio, no asset files) and a SOUND ON/OFF toolbar to Minesweeper.

## Why this spec exists

Spec 01 ships a silent game. Minesweeper benefits from tactile feedback (reveal ticks, flag clicks, explosion, clear jingle). The game has no audio files, so sounds are synthesized with oscillators and noise, keeping the repo asset-free. A toolbar (pattern of `components/snake-toolbar.tsx` / `components/tetris-toolbar.tsx`, class `.tetris-toolbar`) lets the player mute; the choice persists in `localStorage`.

## Scope

**In:**

- `lib/games/minesweeper/sound.ts`: framework-free `createSound()` wrapping a lazily created `AudioContext` (created on first user gesture, never at import), master gain 0.25, methods `play(name)`, `setMuted(m)`, `destroy()`.
- Sound names and synthesis (all ≤ 600 ms except `lose`):
  - `reveal`: 60 ms square blip, 520 Hz.
  - `flood`: 120 ms rising triangle sweep 400→800 Hz (played once per reveal that opens > 1 cell, instead of `reveal`).
  - `flag`: 50 ms square blip, 880 Hz; `unflag`: 50 ms, 440 Hz.
  - `chord`: 90 ms square blip, 660 Hz.
  - `lose`: 700 ms white-noise burst with lowpass sweep 1200→120 Hz plus 200 Hz sine drop.
  - `clear`: 4-note arpeggio 523/659/784/1047 Hz, 90 ms each, triangle.
  - `tick`: 30 ms 1200 Hz sine each time the last 10 seconds of the 300 s time-bonus window start (second 290…299 elapsed): once per whole second.
- Engine: `createMinesweeperGame` return type becomes `MinesweeperEngine extends GameEngine { setMuted(muted: boolean): void }` (exported from `engine.ts`); engine creates the sound object internally and calls `play` at the events above; `destroy()` closes the context.
- Toolbar `components/minesweeper-toolbar.tsx`: `SOUND: ON | OFF` toggle button (reuses `.tetris-toolbar` styles), persisted under `localStorage` key `av_minesweeper_sound` (`"on"`/`"off"`, default `"on"`), read after mount to avoid hydration mismatch (hook `useMinesweeperSound()` like `useSnakeSkin` in `components/snake-toolbar.tsx`).
- Wiring: `components/game-player.tsx` renders `MinesweeperToolbar` for `minesweeper` (same place as the other per-game toolbars) and forwards `muted` to `components/game-screen.tsx`, which calls `engine.setMuted` when the prop changes (same mechanism the existing skin props use).
- Muted state suppresses all audio; toggling takes effect immediately and does not restart the run.

**Out of scope (for future specs):** music, volume slider, audio files, per-sound toggles, sound for other games, haptics.

## Data model

```ts
// lib/games/minesweeper/sound.ts
export type SoundName =
  "reveal" | "flood" | "flag" | "unflag" | "chord" | "lose" | "clear" | "tick";
export interface Sound {
  play(name: SoundName): void; // no-op while muted or before the context is allowed
  setMuted(muted: boolean): void;
  destroy(): void; // closes the AudioContext
}
export function createSound(): Sound;

// lib/games/minesweeper/engine.ts (changed return type, still assignable to GameEngine)
export interface MinesweeperEngine extends GameEngine {
  setMuted(muted: boolean): void;
}
export function createMinesweeperGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): MinesweeperEngine;

// components/minesweeper-toolbar.tsx
export function useMinesweeperSound(): [
  muted: boolean,
  setMuted: (m: boolean) => void,
];
export function MinesweeperToolbar(props: {
  muted: boolean;
  onChange: (m: boolean) => void;
}): JSX.Element;
```

**Constants:**

| Constant    | Value                                                 |
| ----------- | ----------------------------------------------------- |
| Master gain | 0.25                                                  |
| Storage key | `av_minesweeper_sound` = `"on"` / `"off"`, default on |
| Tick window | seconds 290…299 of a board, once per second           |
| Max voices  | 6 simultaneous; extra `play` calls are dropped        |

**Palette (toolbar):** reuse existing toolbar colors; active state border `--yellow`, `shadowBlur` ≤ 8.

Conventions: read `node_modules/next/dist/docs/01-app` (client components) first; `localStorage` read only after mount. Use `/frontend-design` for the toolbar.

## Implementation plan

1. `lib/games/minesweeper/sound.ts` with all 8 sounds, lazy context, voice cap. Check: build + lint; calling `play` in a quick browser console harness makes sound only after a click.
2. Engine: change return type to `MinesweeperEngine`, add `setMuted`, call `play` at reveal/flood/flag/unflag/chord/lose/clear/tick events; `destroy()` calls `sound.destroy()`. Check: build + lint; game still plays silently if muted.
3. `components/minesweeper-toolbar.tsx` + `useMinesweeperSound`. Check: toggle persists across reload, no hydration warning.
4. Wire toolbar and `muted` prop through `components/game-player.tsx` and `components/game-screen.tsx`. Check: toggling mid-run mutes/unmutes instantly, run is not reset.
5. Verification pass. Check: Playwright screenshot of toolbar ON and OFF saved to `.playwright-mcp/screenshots`; console clean (no autoplay warnings).

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass; no new files under `public/` for audio.
- [ ] No `AudioContext` is created before the first user gesture; no autoplay warning in console.
- [ ] Reveal of one cell plays `reveal`; a reveal opening more than one cell plays `flood` only.
- [ ] Flag, unflag, chord, lose (mine hit) and clear each play their own sound.
- [ ] Seconds 290…299 of a board play one `tick` per second; none while paused.
- [ ] Toolbar shows `SOUND: ON` by default; click toggles to `SOUND: OFF` and silences everything immediately.
- [ ] Choice survives reload (`av_minesweeper_sound`); first paint has no hydration warning.
- [ ] Toggling does not reset the run, score or timer.
- [ ] Paused game makes no sound; `destroy()` closes the context (navigating away leaves no audio running).
- [ ] No more than 6 simultaneous voices under rapid clicking.
- [ ] Other games and their toolbars unchanged.

## Decisions

- **Yes:** Synthesized Web Audio, zero assets. Discarded: sample files in `public/games/minesweeper/` (licensing, size).
- **Yes:** Mute toggle only, persisted in `localStorage`. Discarded: volume slider (more UI, little value), server-stored preference (no auth).
- **Yes:** Default ON, context lazily created after a gesture. Discarded: default off (feature would go unnoticed), eager context (autoplay warnings).
- **Yes:** `MinesweeperEngine` extends `GameEngine` with `setMuted`; `engine-types.ts` untouched. Discarded: adding `setMuted` to the shared contract.
- **Yes:** Tick sound for last seconds of the time bonus window. Discarded: continuous ticking (annoying).
- **Yes (inherited):** framework-free engine with `destroy()`, English strings, neon palette, platform HUD/modal, PAUSE flows.
- **No:** Music, per-sound toggles.

## Risks

| Risk                                      | Mitigation                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Autoplay policy blocks audio              | Create/resume context inside the first pointer/key handler.                                  |
| Strict Mode creates two contexts          | Sound object created in engine, closed in `destroy()`.                                       |
| Rapid flood/click spam saturates audio    | Voice cap of 6, drop extra.                                                                  |
| Hydration mismatch from stored preference | Read `localStorage` in effect after mount, default `ON` for first paint.                     |
| Mute prop change recreates engine         | `muted` is not in the engine-creation effect dependencies; separate effect calls `setMuted`. |

## What is **not** in this spec

- Music, volume slider, audio files, per-sound toggles, sound for other games, haptics.

_Each one, if it lands, goes in its own spec._
