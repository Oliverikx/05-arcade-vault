# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Asteroids clone in plain HTML5 Canvas + vanilla JS (ES6+). No dependencies, no bundler, no build step, no tests, no linter. README and in-game text are in Spanish; keep UI strings and comments in Spanish for consistency.

## Running

Open `index.html` directly in a browser, or serve it with `npx serve .` (http://localhost:3000). Verify changes by playing in the browser.

## Architecture

All logic lives in `game.js` (loaded by `index.html` onto a fixed 800x600 `<canvas id="canvas">`). It is a single global-scope script in strict mode, organized in labeled sections:

- **Input**: `keys` (held state by `e.code`) and `justPressed` (edge-triggered). `pressed(code)` consumes the edge, so call it once per frame per key (used for Space to shoot / restart).
- **Entity classes** (`Bullet`, `Asteroid`, `Ship`, `Particle`): each has `update(dt)`, `draw()` and a `dead` flag. Entities are removed by filtering arrays on `dead`, not by splicing.
- **Game state**: module-level `let` variables (`ship`, `bullets`, `asteroids`, `particles`, `score`, `lives`, `level`) plus a `state` machine: `'playing' | 'dead' | 'gameover'`. `'dead'` is a 2s respawn pause (`deadTimer`) where only particles/asteroids update; `'gameover'` waits for Space to call `initGame()`.
- **`update(dt)`**: handles state branches first, then shooting, entity updates, bullet-vs-asteroid collisions (circle distance via `radius`; asteroids split into `size - 1` children), ship-vs-asteroid collisions (skipped while `ship.invincible > 0`; asteroid hit radius is scaled by 0.82), and level advance when no asteroids remain.
- **Loop**: `requestAnimationFrame` with `dt` in seconds, clamped to 0.05 to avoid big jumps after tab switches.

Key conventions:
- The world is toroidal: all moving entities use `wrap(v, max)` with the constants `W`/`H`. Particles are the exception (they do not wrap).
- Asteroid sizes are 1–3 and index the parallel tables `RADII`, `SPEEDS`, `POINTS`; tune difficulty/scoring there.
- Physics constants (rotation, thrust, drag, cooldown, bullet speed) are local consts inside the relevant methods, not centralized.
- Drawing is vector-style line art (stroked paths, white on black), no sprites or assets.

Power-ups: `PowerUp` (types `'triple'` and `'shield'`) drops once each per level from chosen asteroid kills (`powerUpKillTargets`). Effects tracked by `tripleShotTimer` / `shieldTimer`; the shield absorbs one ship-asteroid hit (asteroid unaffected, 1s grace). Note: the README's "shooting star" asteroid type is not implemented in `game.js`.
