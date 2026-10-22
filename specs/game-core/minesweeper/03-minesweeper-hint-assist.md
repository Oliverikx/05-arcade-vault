# SPEC MINESWEEPER-03 — MINESWEEPER hint assist

> **Status:** Implemented
> **Depends on:** MINESWEEPER-01 (`specs/game-core/minesweeper/01-minesweeper-core-game.md`); toolbar file from 02 is not required (this spec creates it if absent)
> **Date:** 2026-10-22
> **Objective:** Add a limited, score-priced HINT that safely reveals one cell, with a toolbar button and touch button.

## Why this spec exists

Spec 01 is pure deduction plus unavoidable guesses on bigger boards. A limited hint softens forced guesses and adds a risk/reward decision (score vs. safety) without removing the leaderboard's meaning. Reference pattern for engine-driven toolbar buttons: Tetris abilities (`components/tetris-toolbar.tsx`, optional `onAbilityMenu` in `lib/games/engine-types.ts`).

## Scope

**In:**

- Hint rules: key `H`, toolbar button `HINT (n)` and touch button `HINT` (`KeyH`). 2 hints per board (refilled at each new board, not carried over). Cost: 100 points deducted when used; unavailable (button dimmed, key ignored) if score < 100, hints left = 0, board not in `playing`, or paused.
- Hint effect: picks a random hidden, unflagged, non-mine cell, preferring the frontier (cells adjacent to a revealed number); falls back to any safe hidden cell. It is revealed via the normal flood-fill but awards **no cell points** (flood cells opened by it also award none). If the target was wrongly flagged it is unflagged first. Cell is highlighted with a 600 ms yellow pulse. If no safe hidden cell exists the key is ignored and no cost is charged.
- A hint used does not affect timer or clear bonus.
- Engine: `MinesweeperEngine` (exported from `lib/games/minesweeper/engine.ts`; if spec 02 is not implemented, this spec introduces the interface with only `hint()`) gains `hint(): void`. Optional callback `onHints?(left: number): void` added to `GameCallbacks` in `lib/games/engine-types.ts` (same style as `onAbilityMenu`); fires only on change (board start, hint used).
- Toolbar `components/minesweeper-toolbar.tsx` (create, or extend if spec 02 landed): `HINT (2)` button (`.tetris-toolbar` style) enabled per the rules above, calls `engine.hint()` through the same prop mechanism as other per-game toolbars in `components/game-player.tsx` / `components/game-screen.tsx`.
- Registry: add `{ label: "HINT", code: "KeyH" }` to the `minesweeper` `touch.buttons` in `lib/games/registry.ts` (third button, max 3).
- Score cost never makes score negative (guard enforces ≥ 100); `onScore` fires with the new value.

**Out of scope (for future specs):** hint that flags mines, auto-solver, hint purchase with real currency or persistent inventory, hints on other games, leaderboard separation for assisted runs.

## Data model

```ts
// lib/games/engine-types.ts (extended, optional member)
export interface GameCallbacks {
  /* ...existing... */
  /** Minesweeper only: hints left on the current board. Fires only on change. */
  onHints?(left: number): void;
}

// lib/games/minesweeper/board.ts (added)
export function pickHintCell(
  cells: Cell[],
  spec: BoardSpec,
  rng: () => number,
): number | null; // frontier-first safe hidden unflagged cell, null if none

// lib/games/minesweeper/engine.ts
export interface MinesweeperEngine extends GameEngine {
  hint(): void;
  /* setMuted(muted: boolean): void; — present only if spec 02 landed */
}

// components/minesweeper-toolbar.tsx
export function MinesweeperToolbar(props: {
  hintsLeft: number;
  canHint: boolean; // playing, not paused, score >= 100, hintsLeft > 0
  onHint: () => void;
  /* muted/onChange from spec 02 if present */
}): JSX.Element;

// lib/games/registry.ts — touch.buttons for minesweeper
// [{ label: "REVEAL", code: "Space" }, { label: "FLAG", code: "KeyF" }, { label: "HINT", code: "KeyH" }]
```

**Constants:**

| Constant         | Value                                          |
| ---------------- | ---------------------------------------------- |
| Hints per board  | 2 (reset each board)                           |
| Hint cost        | 100 points                                     |
| Hint cell points | 0 (including flood cells opened by the hint)   |
| Hint pulse       | 600 ms yellow `#f5ff00` border pulse, glow ≤ 8 |
| Min score to use | 100                                            |
| Touch buttons    | REVEAL, FLAG, HINT (3, the platform max)       |

**Palette:** hint pulse `#f5ff00`; toolbar button dimmed state `#4a4f70`; no new colors.

Conventions: read `node_modules/next/dist/docs/01-app` first. Use `/frontend-design` for the toolbar button and its disabled state.

## Implementation plan

1. `pickHintCell` in `lib/games/minesweeper/board.ts` (frontier-first, safe, hidden, unflagged). Check: build + lint; temporary assertions confirm never returns a mine.
2. `lib/games/engine-types.ts`: optional `onHints`. Engine: `hint()`, per-board counter, cost, zero-point reveal path, pulse drawing in `draw.ts`, `H` key, callbacks. Check: build + lint; `H` works in dev.
3. Toolbar `HINT (n)` button + enabled logic, wiring in `components/game-player.tsx` / `components/game-screen.tsx` (state from `onHints` and `onScore`). Check: button count and dimming update live.
4. Registry touch button `HINT`. Check: 390px viewport shows 3 buttons, `HINT` works.
5. Verification pass. Check: Playwright screenshots (button enabled, dimmed at 0 hints, pulse on revealed cell) saved to `.playwright-mcp/screenshots`.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] Toolbar shows `HINT (2)` at the start of every board and after PLAY AGAIN.
- [ ] Before the first reveal of a board (`ready`) the button is dimmed and `H` does nothing.
- [ ] Using a hint reveals exactly one hidden cell that is never a mine, with a 600 ms yellow pulse; the count drops to `HINT (1)`.
- [ ] Each hint subtracts exactly 100 from the HUD score and adds no cell points (flood-opened cells included).
- [ ] With score < 100 the button is dimmed and `H` does nothing; score never goes negative.
- [ ] With 0 hints left the button shows `HINT (0)`, dimmed.
- [ ] Hints refill to 2 on each new board; unused hints are not carried over.
- [ ] A wrongly flagged cell chosen by the hint is unflagged and revealed.
- [ ] Timer and clear bonus are unaffected by hint use.
- [ ] Hint is ignored while paused, during `clear` and `gameover`; typing in the SAVE SCORE input does not trigger it.
- [ ] Touch: third button `HINT` visible at 390px, triggers the same behavior.
- [ ] `onHints` fires only on change; other games unaffected (field is optional).
- [ ] Leaderboard unchanged: scores still saved with `game_id = 'minesweeper'`.

## Decisions

- **Yes:** 2 hints per board at 100 points each. Discarded: unlimited hints (trivial), free hints (no tradeoff), hint cost in time (timer bonus already small).
- **Yes:** Hint reveals a safe cell, not a mine flag. Discarded: flagging a mine (gives away less information, harder to explain).
- **Yes:** Frontier-first selection. Discarded: fully random safe cell (often useless in the middle of a hidden region).
- **Yes:** Hint reveals award no points. Discarded: normal points (would pay for the hint back).
- **Yes:** Optional `onHints` in `GameCallbacks`, like `onAbilityMenu`. Discarded: polling the engine, new shared HUD field.
- **Yes:** Same leaderboard for assisted runs (price in score already penalizes). Discarded: separate leaderboard id.
- **Yes (inherited):** framework-free engine with `destroy()`, English strings, neon palette, platform HUD/modal, PAUSE flows, `saveScore` Server Action, generic registry entry.
- **No:** Migration (reuses `minesweeper` row from 01).

## Risks

| Risk                                                | Mitigation                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| Toolbar enabled state drifts from engine state      | Derive `canHint` from `onHints` + `onScore` + pause/state props, one source.    |
| Hint reveals the last safe cells → clear bonus path | Reuses normal clear check after the hint reveal.                                |
| Pulse rendering keeps animating while paused        | Pulse timer advances in `update()` only.                                        |
| Touch layout limited to 3 buttons                   | Exactly 3 used; no further buttons can be added without a new spec.             |
| Spec 02 not landed when this one is implemented     | Toolbar and `MinesweeperEngine` created here with only `hint`; 02 extends them. |

## What is **not** in this spec

- Hint that flags mines, auto-solver, persistent hint inventory, hints on other games, separate leaderboard for assisted runs.

_Each one, if it lands, goes in its own spec._
