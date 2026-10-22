# SPEC CONNECT-FOUR-02 — CONNECT FOUR hint and streak bonus

> **Status:** Draft
> **Depends on:** 01 of this game (`01-connect-four-core-game.md`)
> **Date:** 2026-10-22
> **Objective:** Add a once-per-round column hint (`H`, costs points) and a consecutive-win streak bonus to the Connect Four engine.

## Why this spec exists

SPEC 01 ships a plain run: win points depend only on move count, and a level-6 CPU is unforgiving with no help. A costly hint gives a risk/reward choice, and a streak bonus rewards beating the CPU repeatedly without losing a life. Both are engine deltas on `lib/games/connect-four/engine.ts` and reuse `bestColumn` from `lib/games/connect-four/ai.ts`; no new platform wiring beyond one touch button.

## Scope

**In:**

- Hint: key `H` during `aiming` (once per round). Highlights the column returned by `bestColumn(board, HINT_DEPTH)` computed for the player's side (pass the board with colors swapped so the player is the side to move; add optional `side` parameter to `bestColumn`). The cursor jumps to that column and a pulsing yellow arrow marks it until the disc is dropped.
- Hint cost: if the round is won after using the hint, `roundScore = max(0, 1000 − 20 × playerMoves − HINT_COST)`. Lost or drawn rounds are not penalised (a life is already lost).
- Streak: consecutive round wins in the run. From the 2nd consecutive win, `streakBonus = min(STREAK_CAP, STREAK_STEP × (streak − 1))` is added with the round score. A loss or draw resets the streak to 0. Streak is kept across level cap.
- In-canvas status line shows `H HINT -150` (or `HINT USED`) and `STREAK xN` when `streak ≥ 2`. HUD callbacks unchanged (score already carries both).
- Round banner on win shows the breakdown: `+800` or `+800 +100 STREAK` and `HINT -150` when used.
- Registry `touch` layout: add `{ label: "HINT", code: "KeyH" }` to `buttons` in `lib/games/registry.ts`.

**Out of scope (for future specs):** a HUD widget for hints (`onHints` callback), multiple hints per round, hint depth tied to level, mouse and sound (SPEC CONNECT-FOUR-03), skins, persistence of streaks across runs, auth, anti-cheat, realtime.

## Data model

```ts
// lib/games/connect-four/ai.ts — changed signature (default keeps SPEC 01 behavior)
export function bestColumn(
  board: Board,
  depth: number,
  side?: Cell, // 1 or 2, default 2 (CPU)
): number;

// lib/games/connect-four/engine.ts — internal state added (no public API change)
// hintUsed: boolean (per round), hintCol: number | null, streak: number

// lib/games/registry.ts — "connect-four".touch.buttons
// [{ label: "DROP", code: "Space" }, { label: "HINT", code: "KeyH" }]
```

**Constants:**

| Constant      | Value                                            |
| ------------- | ------------------------------------------------ |
| `HINT_DEPTH`  | 4 (fixed, independent of level)                  |
| `HINT_COST`   | 150 points, subtracted from that round's win     |
| Hints/round   | 1                                                |
| `STREAK_STEP` | 100                                              |
| `STREAK_CAP`  | 300 (reached at the 4th consecutive win)         |
| Round score   | `max(0, 1000 − 20 × moves − hint) + streakBonus` |
| Max round     | 980 + 300 = 1,280                                |

**Palette:**

| Element            | Color                                                     |
| ------------------ | --------------------------------------------------------- |
| Hint arrow         | `#f5ff00` (yellow), pulse alpha 40%..100% at 2 Hz, glow 8 |
| `H HINT -150` text | `#e6e9ff` at 70% alpha                                    |
| `HINT USED` text   | `#8a8fb5`                                                 |
| `STREAK xN` text   | `#00ff88`                                                 |

Callbacks fire only on change. `H` is ignored in any state but `aiming`, when paused, in `gameover`, and when typing in an input.

Conventions: as SPEC 01 (framework-free engine, `shadowBlur` ≤ 8, English strings).

## Implementation plan

Each step leaves the app runnable and is commitable alone.

1. Add optional `side` parameter to `bestColumn` in `lib/games/connect-four/ai.ts`. Check: build + lint; default call unchanged; with `side = 1` returns a blocking/winning column for the player.
2. Streak: track `streak` in `lib/games/connect-four/engine.ts`, add bonus to round score, reset on loss/draw and on `reset()`. Check: build + lint; 2 wins in a row add +100 on the 2nd.
3. Hint: `H` key, `hintUsed`, `hintCol`, cost on win, cursor jump, yellow arrow in `lib/games/connect-four/draw.ts`. Check: build + lint; hint available once per round.
4. Status line and win breakdown text. Check: Playwright screenshots (hint arrow, streak banner) saved to `.playwright-mcp/screenshots`.
5. Add the `HINT` button to the registry touch layout. Check: touch pad shows DROP + HINT; HINT triggers `KeyH`.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `H` in `aiming` moves the cursor to the hinted column and shows a yellow arrow; a second `H` in the same round does nothing.
- [ ] Hint on an immediate player win suggests the winning column; hint on an immediate CPU threat suggests the blocking column.
- [ ] Win in 10 moves with hint adds exactly 650 (800 − 150); without hint adds 800.
- [ ] A hinted round that is lost or drawn costs no extra points.
- [ ] Win streak: 1st win adds 0 bonus, 2nd consecutive adds +100, 3rd +200, 4th and later +300.
- [ ] Loss or draw resets the streak; PLAY AGAIN resets it to 0.
- [ ] Win banner shows the breakdown text; status line shows `STREAK x2` from the 2nd consecutive win.
- [ ] `H` is ignored while paused, in `roundover`, in `gameover`, while a disc falls, during the CPU turn, and when typing in SAVE SCORE.
- [ ] The touch pad shows a `HINT` button that dispatches `KeyH`.
- [ ] No new files outside `lib/games/connect-four/`; `lib/games/registry.ts` is the only other file changed.
- [ ] Colors match the palette table; `shadowBlur` ≤ 8; no console errors.
- [ ] SPEC 01 behavior unchanged without using `H` and without streaks (single win scores as in SPEC 01).

## Decisions

- **Yes:** Hint costs points (150) instead of a life or being free. Discarded: free hint (trivializes the game), life cost (too harsh), cost on every use (limited to once anyway).
- **Yes:** Cost applied only on a win. Discarded: charging immediately (negative scores, score can't drop on a run that is then lost).
- **Yes:** Fixed hint depth 4, once per round. Discarded: hint at current level depth (weak at 1), unlimited hints.
- **Yes:** Streak bonus step 100, cap 300. Discarded: multiplier on round score, uncapped (score balance).
- **Yes:** Hint and streak shown in-canvas, no new HUD callback. Discarded: reusing `onHints` (wired for minesweeper only, platform change out of scope).
- **Yes:** Streak counts wins only; level cap does not stop it. Discarded: reset at level 6.
- **Yes (inherited):** framework-free engine with `destroy()`, platform HUD/modal, PAUSE flows, English strings, neon palette, `saveScore` Server Action, no new migration (the `games` row comes from SPEC 01).

## Risks

| Risk                                                    | Mitigation                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `side` swap breaks AI evaluation sign                   | Evaluation takes `side` explicitly; default 2 keeps SPEC 01 results. |
| Hint computed twice if `H` is spammed                   | `hintUsed` set before the search; later presses are ignored.         |
| Hint arrow persists into the next round                 | `hintCol` cleared on drop, round end and `reset()`.                  |
| Touch HINT button leaves the key pressed in `roundover` | `H` ignored outside `aiming`.                                        |
| Score exceeds expectations                              | Max 1,280 per round; clamp 0..10,000,000 still applies.              |

## What is **not** in this spec

- HUD widget/`onHints` callback for hints, multiple hints, hint depth tied to level.
- Mouse control and sound (SPEC CONNECT-FOUR-03), skins.
- Cross-run streak persistence, auth, anti-cheat, realtime.

_Each one, if it lands, goes in its own spec._
