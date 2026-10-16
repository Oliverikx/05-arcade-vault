# SPEC 03 — Sound effects

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-13
> **Objective:** Play `assets/sounds/ball-bounce.mp3` when the ball hits the paddle or a wall, and `assets/sounds/break-sound.mp3` when the ball hits a block.

## Scope

**In:**

- `ball-bounce.mp3` plays on ball collision with the paddle, left wall, right wall or top wall.
- `break-sound.mp3` plays on ball collision with a block (at the moment of the hit, same step as the score).
- If a block hit and a paddle/wall bounce happen in the same `update()` step, only `break-sound` plays.
- Rapid retrigger of the same sound restarts it from 0 (`currentTime = 0; play()`), one `Audio` element per sound.
- Playback errors (`play()` promise rejection, e.g. autoplay policy or missing file) are swallowed; game keeps running.
- Works from `file://`, no dependencies.

**Out of scope (for future specs):**

- Sounds for launch, losing a life, game over, win.
- Mute toggle, volume controls / per-sound volume constants.
- Overlapping/stacked playback of the same sound (`cloneNode`), audio pooling.
- Background music.
- Changes to collision, scoring, physics or animation.

## Data model

Extends `game.js` (global scope, no modules):

```js
const SOUNDS = {
  bounce: new Audio('assets/sounds/ball-bounce.mp3'),
  brk:    new Audio('assets/sounds/break-sound.mp3'),
};

function playSound(audio) {
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
```

Rules:

- Paths are relative to `index.html`.
- No new fields in `state` or `CONFIG`.
- Per-step flag (local to `update()`): `bounced` (bool), set on paddle/wall hit, `broke` (bool), set on block hit. After collision handling: `if (broke) playSound(SOUNDS.brk); else if (bounced) playSound(SOUNDS.bounce);`.

## Implementation plan

1. Add `SOUNDS` and `playSound` to `game.js` (top-level, before `update()`); set `preload = 'auto'` on both. No call sites yet. Test: open `index.html`, no console errors, game plays as before.
2. In `update()`, add `bounced`/`broke` locals in the `playing` branch; set `bounced = true` on left/right/top wall reflection and on paddle hit; set `broke = true` on block hit. After the block loop, play the sound per the rule above. Test: ball bounce on walls/paddle gives bounce sound; block hit gives break sound only.
3. Verify edge cases: rapid consecutive hits restart the sound without errors; bottom exit (life lost) plays nothing; ball frozen during win delay plays nothing; restart works with sounds still functional.

## Acceptance criteria

- [ ] Ball hitting left, right or top wall plays `ball-bounce`.
- [ ] Ball hitting the paddle plays `ball-bounce`.
- [ ] Ball hitting a block plays `break-sound` and not `ball-bounce`.
- [ ] Block hit and wall/paddle bounce in the same step plays only `break-sound`.
- [ ] Ball falling below the paddle, launch, game over and win play no sound.
- [ ] Consecutive hits in quick succession restart the sound from the beginning (no overlap, no errors).
- [ ] Works opening `index.html` via `file://` with no console errors.
- [ ] If an audio file fails to load/play, game keeps running without uncaught errors.
- [ ] Score, collision, block animation and win/lose behavior unchanged from SPEC 01/02.

## Decisions

- **Yes:** one `Audio` element per sound, restart on retrigger. Simple, no overlap; user chose it.
- **Yes:** break-sound wins over bounce in the same step. Avoids noisy double sound; user chose it.
- **Yes:** sound triggered from `update()` at collision time. Matches fixed-step logic and spec 02 scoring moment.
- **Yes:** swallow `play()` rejections. Autoplay policy can block before first user gesture; launch (Space/click) is a gesture, so normally fine.
- **No:** mute toggle / volume config. User chose none.
- **No:** sounds for life lost, game over, win, launch. User chose none; separate spec if wanted.
- **No:** `cloneNode` stacking. User chose restart-from-0.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Browser blocks audio before user gesture | Ball only moves after launch (Space/click), which counts as a gesture; errors swallowed anyway |
| Restart-from-0 on very fast hits cuts the sound tail | Accepted by user decision; revisit in a future spec |
| MP3 fails to load on `file://` in some browsers | `play()` catch keeps game running; verify in target browser in step 3 |
