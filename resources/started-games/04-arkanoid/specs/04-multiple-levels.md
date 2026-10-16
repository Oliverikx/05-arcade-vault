# SPEC 04 — Multiple levels

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02, SPEC 03
> **Date:** 2026-10-13
> **Objective:** Replace the single fixed 140-block level with 5 progressive levels (20/30/40/50/60 blocks, different shapes, ball speed +0.5 per level) that advance automatically when all blocks are cleared.

## Scope

**In:**

- 5 hand-designed levels defined as ASCII grids in `game.js`:
  - L1: 20 blocks, 4 rows x 5 cols, solid, centered.
  - L2: 30 blocks, checkerboard (diagonals).
  - L3: 40 blocks, V / chevron shape.
  - L4: 50 blocks, 2x2 empty squares.
  - L5: 60 blocks, diagonal stripes.
- Block color by row index: `rowColors[row % rowColors.length]` (same order as SPEC 01). Layout strings only mark present (`X`) or absent (`.`).
- Each layout is horizontally centered on the canvas based on its own width (`x = (640 - cols*32) / 2`). Top of first row stays at `blocksTop` (60).
- All blocks are 1 hit, same score (10), same explosion animation and sounds as before.
- Level clear: after the last block's explosion ends (existing freeze logic), load the next level, phase `ready`, ball back on paddle, paddle recentered.
- "LEVEL N" banner drawn on canvas while the level has just loaded and the ball has not been launched yet. Hidden on launch. Not shown again after losing a life.
- HUD shows `Level N` centered at the top, next to existing score (left) and lives (right).
- Score and lives carry over between levels.
- Ball speed per level: `ballSpeed + 0.5 * (level - 1)` (5, 5.5, 6, 6.5, 7). Applies to launch and paddle bounce.
- Clearing level 5 shows the existing win screen (final score).
- Game over (0 lives) shows the existing screen; Space/click restarts at level 1 with score 0, lives 3, base speed.

**Out of scope (for future specs):**

- Multi-hit blocks, indestructible blocks, power-ups.
- More than 5 levels, endless/procedural levels, level select.
- Separate "level complete" interstitial screen.
- Persisting progress or high score (localStorage).
- Per-level paddle size, lives bonus, or other difficulty knobs.
- New art, new sounds (including level-clear jingle).
- Changes to collision, scoring, controls or explosion animation.

## Data model

Extends `game.js` (global scope, no modules):

```js
const LEVELS = [
  [ // L1 — 20 blocks (5 cols)
    'XXXXX',
    'XXXXX',
    'XXXXX',
    'XXXXX',
  ],
  [ // L2 — 30 blocks, checkerboard (10 cols)
    'X.X.X.X.X.',
    '.X.X.X.X.X',
    'X.X.X.X.X.',
    '.X.X.X.X.X',
    'X.X.X.X.X.',
    '.X.X.X.X.X',
  ],
  [ // L3 — 40 blocks, V shape (16 cols)
    'XXXX........XXXX',
    '.XXXX......XXXX.',
    '..XXXX....XXXX..',
    '...XXXX..XXXX...',
    '....XXXXXXXX....',
  ],
  [ // L4 — 50 blocks, 2x2 empty squares (20 cols)
    'XX..XX..XX..XX..XX..',
    'XX..XX..XX..XX..XX..',
    '..XX..XX..XX..XX..XX',
    '..XX..XX..XX..XX..XX',
    'XX..XX..XX..XX..XX..',
  ],
  [ // L5 — 60 blocks, diagonal stripes (20 cols)
    'XX..XX..XX..XX..XX..',
    '.XX..XX..XX..XX..XX.',
    '..XX..XX..XX..XX..XX',
    'X..XX..XX..XX..XX..X',
    'XX..XX..XX..XX..XX..',
    '.XX..XX..XX..XX..XX.',
  ],
];
```

Changes to existing code:

- `state.level` (number, 1-based), added to `state`. `state.showBanner` (bool).
- `buildBlocks()` becomes `buildBlocks(levelIndex)`: iterates `LEVELS[levelIndex]`, creates a block for each `X` with the same block shape as today (`x, y, w, h, color, alive, breakElapsed`), `x = offsetX + col * blockW`, `y = blocksTop + row * blockH`.
- `CONFIG.cols` is no longer used for layout (remove or leave unused).
- `levelSpeed()` returns `CONFIG.ballSpeed + 0.5 * (state.level - 1)`; replaces `CONFIG.ballSpeed` in `launchBall()` and the paddle bounce in `update()`.
- `loadLevel(n)`: sets `state.level = n`, `state.blocks = buildBlocks(n - 1)`, recenters paddle, `phase = 'ready'`, `stickBallToPaddle()`, `showBanner = true`.
- `resetGame()` calls `loadLevel(1)` after resetting score and lives.

Rules:

- Every `LEVELS` entry has rows of equal length, max 20 chars, max 12 rows (stay above paddle area).
- Block counts must be exactly 20, 30, 40, 50, 60.
- Ball speed stays below block height (16) to avoid tunneling (max 7).

## Implementation plan

1. Add `LEVELS`, `state.level`, `state.showBanner`; change `buildBlocks(levelIndex)` to build from layouts with centering and row-index colors; add `loadLevel(n)`; make initial state and `resetGame()` use `loadLevel(1)`. Test: open `index.html`, see 4x5 centered blocks (20), game plays as before.
2. Add `levelSpeed()` and use it in `launchBall()` and paddle bounce. Test: level 1 speed identical to before.
3. In the existing win-detection branch of `update()`: if `state.level < LEVELS.length`, `loadLevel(state.level + 1)`; else `phase = 'win'`. Test: clearing L1 loads L2 with 30 checkerboard blocks, score and lives kept, ball on paddle.
4. Draw HUD `Level N` (top center) and the "LEVEL N" banner while `showBanner`; clear `showBanner` in `launchBall()` when launching from `ready`. Test: banner appears on each level start, vanishes on launch, does not reappear after losing a life.
5. Verify all 5 levels: block counts 20/30/40/50/60, shapes match layouts, speeds 5 to 7, final clear shows win screen, game over then restart returns to level 1 with 20 blocks, score 0, lives 3, speed 5.

## Acceptance criteria

- [ ] Game starts on level 1 with exactly 20 blocks, 4 rows x 5 cols, horizontally centered (x from 240 to 400).
- [ ] Clearing all blocks of level N (N < 5) loads level N+1 after the last explosion finishes, ball on paddle, phase `ready`.
- [ ] Levels 1-5 have exactly 20, 30, 40, 50, 60 blocks.
- [ ] Level shapes match the layouts: L2 checkerboard, L3 V, L4 2x2 holes, L5 diagonal stripes.
- [ ] Each layout is horizontally centered on the canvas.
- [ ] Block colors follow row index order gray, red, yellow, cyan, magenta, hotpink, green.
- [ ] Score and lives are unchanged by level transitions.
- [ ] Ball speed magnitude is 5, 5.5, 6, 6.5, 7 on levels 1-5 and constant across bounces within a level.
- [ ] "LEVEL N" banner shows at level start until launch and is hidden after launch; not shown after losing a life.
- [ ] HUD shows `Level N` at top center during play.
- [ ] Clearing level 5 shows the win screen with final score; Space/click restarts at level 1.
- [ ] Game over then Space/click restarts at level 1 with 20 blocks, score 0, lives 3, speed 5.
- [ ] No console errors via `file://`; sounds, explosion animation, scoring (10/block), controls unchanged from SPEC 01-03.

## Decisions

- **Yes:** 5 levels then win screen. User chose it; keeps layout design bounded.
- **Yes:** ASCII grid strings per level. Readable, easy to edit, expresses diagonals and holes directly.
- **Yes:** color by row index. User chose it; layout strings stay simple.
- **Yes:** per-layout horizontal centering. 5-col level 1 cannot be centered on the 32px column grid of 20 cols (odd offset); centering by own width avoids it.
- **Yes:** counts 20/30/40/50/60. User chose fixed +10 per level; verifiable.
- **Yes:** "LEVEL N" banner with ball on paddle. User chose it; no extra screen or input needed.
- **Yes:** keep score and lives, speed +0.5 per level. User chose it; max speed 7 stays below block height.
- **Yes:** game over restarts at level 1. User chose it.
- **No:** interstitial "level complete" screen. User chose the banner.
- **No:** endless levels / more than 5. Needs a generator; separate spec.
- **No:** multi-hit or indestructible blocks. Not requested; separate spec.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Layout string with wrong length or miscounted blocks | Acceptance criteria check exact counts; verify in step 5 |
| Ball tunnels at higher speed | Max speed 7 < block height 16; checked in step 5 |
| Ball stuck in a repeating loop in sparse layouts (L4/L5) | Paddle angle depends on hit position; check by playing L4/L5 |
| Win freeze logic breaks when a level has no pending explosion | Reuse existing `breakElapsed` check; test last block hit on every level |
