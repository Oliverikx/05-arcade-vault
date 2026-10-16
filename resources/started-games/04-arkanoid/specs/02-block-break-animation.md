# SPEC 02 — Block break animation

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-10-13
> **Objective:** When the ball hits a block, play the 4-frame explosion animation (`EXPLOSION_FRAMES`) at that block's position instead of removing it instantly.

## Scope

**In:**

- On hit, block stops being collidable and score is added immediately (same as SPEC 01); an explosion animation plays at its position.
- Animation uses the existing assets in `assets/` (`assets/spritesheet-breakout.png`, via `EXPLOSION_FRAMES[color]` in `assets/spritesheet.js`); no new art is created. 4 frames over `EXPLOSION_DURATION` (150 ms), then the block disappears.
- Animation timing advances in `update()` via the fixed step (`STEP_MS`), not wall-clock.
- Multiple blocks can animate at once.
- Win screen appears only after the last animation finishes.
- Restart (`resetGame`) clears any in-progress animations.

**Out of scope (for future specs):**

- Sound effects (`assets/sounds/break-sound.mp3`).
- Particle effects, screen shake, score popups.
- Gray-specific animation (reuses red frames, as provided by `spritesheet.js`).
- Changes to collision, scoring or ball physics.
- Multi-hit blocks, power-ups, levels.

## Data model

Extends the block object in `game.js` (`buildBlocks`):

```js
// block: { x, y, w, h, color, alive, breakElapsed }
// alive:        true until hit (unchanged meaning: collidable + counted for win)
// breakElapsed: null while intact; ms elapsed since hit while animating
```

Rules:

- Hit: `alive = false`, `breakElapsed = 0`.
- Each `update()` step: for blocks with `breakElapsed !== null`, `breakElapsed += STEP_MS`; when `>= EXPLOSION_DURATION`, set `breakElapsed = null` (block gone).
- Frame index = `min(3, floor(breakElapsed / (EXPLOSION_DURATION / 4)))`.
- Block is **visible** if `alive` or `breakElapsed !== null`; **collidable** only if `alive`.

New constant (optional, may just use `EXPLOSION_DURATION` directly): none required.

## Implementation plan

1. Add `breakElapsed: null` to blocks in `buildBlocks`. On hit in `update()`, set `breakElapsed = 0` alongside `alive = false`. No visual change yet. Test: game plays as before, no errors.
2. In `update()`, advance `breakElapsed` each step and clear it to `null` at `EXPLOSION_DURATION`. Test: log/inspect `state.blocks` in console after a hit; value goes 0 → null in ~150 ms.
3. In `draw()`, for blocks with `breakElapsed !== null` draw the current frame via `drawFrame(ctx, EXPLOSION_FRAMES[color][i], x, y, w, h)`. Verify frame source size vs 32x16 block and adjust draw size if frames are larger (center on block). Test: hit a block, see 4-frame animation, then it vanishes.
4. Win condition: change to "no block is `alive` and none has `breakElapsed !== null`". While no blocks are alive but animations are running, freeze ball movement so it cannot be lost during the delay. Test: clear last block, see final explosion, then win screen.
5. `resetGame` rebuilds blocks (already does) so animations are cleared. Test: die/win mid-animation, restart, no leftover explosions.

## Acceptance criteria

- [ ] Hitting a block shows a 4-frame explosion at the block's position lasting ~150 ms, then nothing remains.
- [ ] The block's own sprite is not drawn once it is hit (only the explosion).
- [ ] Ball passes through a block that is mid-animation (no collision, no second score).
- [ ] Each hit adds exactly 10 points, at the moment of the hit.
- [ ] Several blocks hit in quick succession animate simultaneously and independently.
- [ ] Animation for each color uses that color's frames (gray uses red frames).
- [ ] Win screen appears only after the last block's animation finishes; final explosion is visible.
- [ ] Game over / win restart leaves no explosions on screen and 140 intact blocks.
- [ ] No sound plays; no console errors.

## Decisions

- **Yes:** collision off at hit. Prevents double scoring and keeps SPEC 01 physics untouched.
- **Yes:** win after last animation ends. Player sees the final explosion; ~150 ms delay is negligible.
- **Yes:** fixed-step timing in `update()`. Consistent with existing loop, deterministic.
- **Yes:** keep `alive` boolean, add `breakElapsed`. Minimal change to existing code and collision loop.
- **No:** sound. Own future spec, same as SPEC 01.
- **No:** extra effects (particles, shake). Not requested.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Explosion frames differ in size from 32x16 blocks and look misplaced | Check frame `sw/sh` in step 3; center/scale to block rect |
| Ball lost to the bottom during the win-delay window | Freeze ball update when no blocks are `alive` (step 4) |
| Win check left at old `every(!alive)` triggers early | Replace condition in step 4 and test with last block |
