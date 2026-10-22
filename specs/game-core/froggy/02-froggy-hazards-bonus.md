# SPEC FROGGY-02 — FROGGY hazards and bonus

> **Status:** Implemented
> **Depends on:** 01 of this game (`01-froggy-core-game.md`)
> **Date:** 2026-10-22
> **Objective:** Add diving turtles, a bonus fly on the lily pads and a median snake that raise difficulty and score variety from level 2 onward.

## Why this spec exists

The core game (`lib/games/froggy/engine.ts`, `lanes.ts`, `draw.ts`) has only logs and vehicles, so every level is the same puzzle at higher speed. This spec adds three hazards/bonuses that change per level, using the existing lane model without touching the leaderboard, registry or catalog.

## Scope

**In:**

- New lane kind `turtle` in `lib/games/froggy/lanes.ts`: groups of 3 turtles (`w` 3 cells) that carry the frog like a log. Row 4 becomes turtles from level 1 (replaces the log lane `row 4`: `dir −1`, speed 55, `w` 3, `gap` 3). Each group runs a dive cycle: surface `3000` ms → sinking warning `1000` ms (turtles drawn smaller, blinking) → submerged `2000` ms → surface. Frog on a group at the moment it becomes submerged dies (drowns). Landing on a submerged group = water. Cycle phase offset per group: `groupIndex × 1500` ms.
- Bonus fly in the goal row: from level 2, every `FLY_EVERY_MS = 10000` of playing time a fly appears on a random empty pad for `FLY_VISIBLE_MS = 5000`. Filling that pad while the fly is visible adds `+200` extra (on top of the 50 + time bonus). At most one fly at a time; never on a filled pad; disappears when the pad fills.
- Median snake: from level 3, one snake travels row 5 at `SNAKE_SPEED = 80` px/s (+ level speed mult), `w` 2 cells, direction alternates each pass, wraps off-screen with a `1500` ms delay. Hitbox overlap with the frog kills it.
- Drawing in `draw.ts`: turtle group (3 green-cyan shells), dive blink, fly (small `#f5ff00` dot with 2 wing strokes), snake (`#ff006e` segmented body). No assets.
- All new timers advance only in `update()`; frozen while paused; reset on `reset()` and on level clear (fly timer restarts, snake keeps looping).

**Out of scope (for future specs):** sound (spec 03), crocodile on pads, otters, multiple maps, skins, new leaderboard data, touch changes.

## Data model

```ts
// lib/games/froggy/lanes.ts — changes
export type LaneKind = "car" | "truck" | "bus" | "log" | "turtle";
export interface Lane {
  // fields from spec 01 unchanged
  dive?: {
    surfaceMs: number;
    warnMs: number;
    underMs: number;
    phaseMs: number;
  };
}
export const DIVE = {
  surfaceMs: 3000,
  warnMs: 1000,
  underMs: 2000,
  phaseStepMs: 1500,
};

// lib/games/froggy/engine.ts — internal additions (no public API change)
// createFroggyGame signature and GameEngine contract unchanged.
```

**Constants:**

| Constant           | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| Turtle lane        | row 4, dir −1, speed 55, w 3, gap 3                       |
| Dive cycle         | 3000 surface / 1000 warn / 2000 under (ms), 6000 total    |
| Group phase offset | `groupIndex × 1500` ms                                    |
| Fly                | from level 2, every 10000 ms, visible 5000 ms, +200       |
| Median snake       | from level 3, 80 px/s × level mult, 2 cells, hitbox 72×24 |
| Snake re-entry     | 1500 ms after leaving the screen                          |

**Palette:**

| Element       | Color                                       |
| ------------- | ------------------------------------------- |
| Turtle shell  | `#00ff88` at 80% alpha, `#00f5ff` 1 px edge |
| Warning blink | shell alpha 100% ↔ 30%, 150 ms toggle       |
| Submerged     | only a `#00f5ff` ripple ring at 25% alpha   |
| Fly           | `#f5ff00`, glow 4                           |
| Median snake  | `#ff006e`, glow 4                           |

Callbacks and input unchanged. Score from the fly goes through the same `onScore`.

Conventions: as spec 01. Engine stays framework-free; no new React.

## Implementation plan

1. Lane model: add `turtle` kind, `dive` data and a pure `isSubmerged(group, tMs)` helper in `lanes.ts`; switch row 4 to turtles. Check: build + lint; row 4 draws as turtles.
2. Engine: ride and drown logic for turtle groups (re-checked every update). Check: frog dies when its group submerges; survives while surfaced; warning blink visible.
3. Fly: spawn timer, pad selection from empty pads, bonus on fill, cleared on fill/level clear/reset. Check: pad fill with fly gives +200 extra; none at level 1.
4. Median snake: movement, wrap with delay, kill on overlap, level 3 gating. Check: snake absent at L1–2, present at L3.
5. Pause/reset/END behavior for all new timers. Check: Playwright screenshots (turtle warning, fly on pad, snake on median, paused) in `.playwright-mcp/screenshots`.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] Row 4 is turtles at level 1; groups of 3 move left at 55 px/s.
- [ ] A turtle group is surfaced 3000 ms, blinks for 1000 ms, then is submerged 2000 ms; adjacent groups are offset by 1500 ms.
- [ ] Frog riding a group when it submerges loses a life; landing on a submerged group loses a life.
- [ ] No fly at level 1; from level 2 a fly appears every 10 s on an empty pad and disappears after 5 s.
- [ ] Filling the fly pad while visible adds 200 more points; filling it after it disappears adds none.
- [ ] No snake at levels 1–2; from level 3 the median snake kills on overlap and returns 1500 ms after leaving the screen.
- [ ] Pausing freezes dive cycle, fly timers and snake; resuming continues from the same phase.
- [ ] PLAY AGAIN restores level-1 state (no fly, no snake, turtles at phase 0).
- [ ] `shadowBlur` ≤ 8; no leaderboard, catalog or registry change.
- [ ] No console errors; listeners and rAF cleaned on leaving the page.

## Decisions

- **Yes:** Turtles replace log row 4 permanently. Discarded: mixing turtles into several rows (too hard at level 1), turtles only from level 2.
- **Yes:** Fly from level 2, snake from level 3 to ramp difficulty. Discarded: all from level 1.
- **Yes:** Fly bonus is flat +200. Discarded: scaling by level.
- **Yes:** Deterministic dive cycle with warning blink. Discarded: random dives.
- **Yes:** Pad choice for the fly is random among empty pads. Discarded: fixed pad.
- **No:** Crocodile/otters (own spec); sound (spec 03).
- **Yes (inherited):** framework-free engine with `destroy()`; platform HUD/modal; PAUSE rules; English strings; neon palette; `saveScore` untouched; generic registry entry; no migration here.

## Risks

| Risk                                          | Mitigation                                                      |
| --------------------------------------------- | --------------------------------------------------------------- |
| Unfair drown at the instant of submerge       | 1000 ms blink warning; check uses the same phase as the draw.   |
| Row 4 impossible with all groups submerged    | Phase offset 1500 ms guarantees at least one group is surfaced. |
| Fly timer runs while dying/paused             | Timers advance only in `update()` while state is `playing`.     |
| Snake spawns on top of the frog after respawn | Snake re-entry skips if frog is on row 5 within 80 px of x.     |

## What is **not** in this spec

- Sound, crocodile/otters, extra maps, skins.
- Auth, anti-cheat, realtime, other games' engines.

_Each one, if it lands, goes in its own spec._
