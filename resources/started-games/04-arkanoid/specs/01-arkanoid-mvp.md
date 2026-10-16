# SPEC 01 — Arkanoid MVP

> **Status:** Implemented
> **Depends on:** None
> **Date:** 2026-10-13
> **Objective:** A playable single-level Arkanoid in plain HTML/CSS/JS with paddle, ball, blocks, score, lives, game over and win screens.

## Scope

**In:**

- Single fixed level: 7 rows x 20 columns of 32x16 blocks (one row per color: gray, red, yellow, cyan, magenta, hotpink, green), 1 hit each.
- Canvas 640x480, centered on the page.
- Paddle controls: keyboard (Left/Right arrows, A/D) and mouse (paddle follows cursor X).
- Ball launch: Space or mouse click.
- Ball bounce off walls, paddle and blocks. Paddle bounce angle depends on hit position, constant ball speed.
- Score: 10 points per block, shown on screen.
- 3 lives, shown on screen. Losing the ball (falls below the paddle) costs a life and resets ball onto the paddle.
- Game over screen (0 lives) and win screen (all blocks cleared), both showing final score; Space/click restarts.
- Blocks disappear instantly when hit (no animation).
- Sprites drawn via existing `assets/spritesheet.js`.

**Out of scope (for future specs):**

- Explosion/break animation (`EXPLOSION_FRAMES`).
- Sound effects (`assets/sounds/*.mp3`).
- Multiple levels, level progression.
- Multi-hit blocks (gray is 1 hit like the rest).
- Power-ups, multi-ball, enemies.
- Pause.
- High score / localStorage persistence.
- Touch/mobile controls.

## Data model

Game state in `game.js` (global scope, no modules):

```js
const CONFIG = {
  width: 640, height: 480,
  blockW: 32, blockH: 16, cols: 20,
  rowColors: ['gray', 'red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'],
  blocksTop: 60,          // y of first row
  paddleW: 162, paddleH: 14, paddleY: 450, paddleSpeed: 7,
  ballSize: 16, ballSpeed: 5,
  maxBounceAngle: 60,     // degrees from vertical
  startLives: 3, pointsPerBlock: 10,
};

const state = {
  phase: 'ready',         // 'ready' | 'playing' | 'gameover' | 'win'
  score: 0,
  lives: 3,
  paddle: { x, y, w, h },
  ball: { x, y, vx, vy, size },
  blocks: [/* { x, y, w, h, color, alive } */],
};
```

Conventions:

- Coordinates: origin top-left, pixels.
- Velocities in pixels/frame (fixed-step update inside `requestAnimationFrame`).
- `ready` = ball stuck to paddle, waiting for launch.
- Values in `CONFIG` are starting values; tune during implementation.

## Implementation plan

1. Create `index.html`, `style.css`, `game.js`: canvas 640x480 centered, loads `assets/spritesheet.js` then `game.js`, calls `loadSpritesheet` then starts loop. Manual test: open `index.html`, see black canvas, no console errors.
2. Draw paddle sprite at bottom with keyboard (arrows/A-D) and mouse movement, clamped to canvas. Test: paddle moves and stays inside.
3. Draw ball stuck to paddle (`ready` phase); Space/click launches it upward at `ballSpeed`. Ball bounces off left, right and top walls. Test: ball bounces around.
4. Paddle collision with angle based on hit position, constant speed. Test: edge hits send ball at steep angles, center hits go straight.
5. Build and draw the 7x20 block grid. Ball-block collision: block removed, ball reflects on the correct axis, score +10. Test: blocks vanish, score increments.
6. HUD: score and lives text. Ball falling below canvas costs a life and returns to `ready`. Test: lives decrease from 3.
7. Game over screen (lives 0) and win screen (no alive blocks) with final score; Space/click resets state to a fresh game. Test: both screens reachable and restart works.

## Acceptance criteria

- [ ] Opening `index.html` directly (file://) shows the game with no console errors.
- [ ] Canvas is 640x480 and centered.
- [ ] 140 blocks (7 rows x 20 cols) are shown at start, one color per row in order gray, red, yellow, cyan, magenta, hotpink, green.
- [ ] Paddle moves with Left/Right arrows, A/D, and mouse, and never leaves the canvas.
- [ ] Ball starts on the paddle and launches on Space or click.
- [ ] Ball bounces off left, right and top walls.
- [ ] Hitting the paddle near its left edge sends the ball left, near the right edge sends it right, at center sends it near-vertical.
- [ ] Ball speed magnitude is the same before and after every bounce.
- [ ] Hitting a block removes it immediately and adds exactly 10 points.
- [ ] Score and lives are visible during play; lives start at 3.
- [ ] Letting the ball fall below the paddle reduces lives by 1 and puts the ball back on the paddle.
- [ ] At 0 lives the game over screen shows final score; Space/click starts a fresh game (140 blocks, score 0, lives 3).
- [ ] Clearing all blocks shows the win screen with final score; Space/click restarts.
- [ ] No sound plays and no explosion animation is drawn.

## Decisions

- **Yes:** `index.html` + `style.css` + `game.js` as plain global scripts. Works from file://, matches zero-dependency rule.
- **Yes:** keyboard + mouse controls. Both cheap, user choice.
- **Yes:** paddle angle depends on hit position. Classic Arkanoid feel.
- **Yes:** 640x480 canvas fits 20 columns of 32px blocks exactly.
- **Yes:** win screen + restart when blocks are cleared. Gives the game an end state.
- **No:** explosion animation. User asked to leave it out; deferred.
- **No:** sound. User chose silent MVP; mp3s stay unused for now.
- **No:** multiple levels. Single fixed level keeps MVP small.
- **No:** multi-hit gray blocks. All blocks 1 hit.
- **No:** pause, high score. Not selected; each can be its own spec.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Ball tunnels through blocks/paddle at high speed | Keep `ballSpeed` (5 px/frame) below block height (16); resolve collisions per frame |
| Spritesheet not loaded when loop starts | Start game loop only inside `loadSpritesheet` callback |
| Frame-rate dependent speed on high-refresh monitors | Fixed-step update or delta-time scaling |
| Ball reflects on wrong axis at block corners | Choose axis by smaller overlap |

## What is **not** in this spec

- Explosion animations.
- Sound effects.
- Multiple levels or multi-hit blocks.
- Power-ups.
- Pause.
- High score persistence.
- Touch/mobile support.

Each one, if it lands, goes in its own spec.
