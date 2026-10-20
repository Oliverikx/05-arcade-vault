# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vanilla JS Tetris (HTML5 Canvas). No deps, no build, no tests, no linter, no package.json. README.md (Spanish) has user-facing docs; UI strings are Spanish.

## Run

Open `index.html` directly, or serve statically: `python -m http.server 8000` → http://localhost:8000.

## Architecture

All logic in `game.js` (single script, global state, loaded by `index.html` via plain `<script>`). DOM ids it depends on: `board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `energy-fill`, `ability-status`, `ability-menu`, `hold-section`, `hold-canvas`, `queue-section`, `queue-canvas`, `pause-menu`, `pause-controls`, `start-level`, `pause-resume`, `pause-restart`, `pause-controls-btn` — renaming in `index.html` breaks it.

- Board: `ROWS×COLS` matrix; 0 = empty, 1–7 = piece type index into both `COLORS` and `PIECES` (piece shape cells hold their own type index).
- Flow: `init()` → `spawn()` → rAF `loop()` drops piece per `dropInterval`; `lockPiece()` = `merge()` → `clearLines()` → `spawn()`. Spawn collision → `endGame()`.
- `clearLines()` owns level/speed updates (level = max(startLevel, lines/10+1); interval = max(100, 1000-(level-1)*90)).
- Pause (`P`/`Esc`) shows `#pause-menu` (resume/restart/controls/starting level; `nextStartLevel` saved in localStorage, applied in `init()`). While paused only P/Esc act; keys held at resume go in `blocked` until released. `#overlay` is game over only.
- Pause/game over work by `cancelAnimationFrame(animId)`; `togglePause` restarts `loop` manually.
- Abilities: `energy` (+25/line in `clearLines`, max 100) → `E` opens `#ability-menu` (cancels rAF like pause, `choosing` flag) → `useAbility(1-5)` via `ABILITIES` map; success zeroes energy. `queue` (≥6 pieces) replaces old `next`; `undoSnap` saved in `lockPiece`; slow time ticks in `loop` (`slowMs`).
- Rotation: `rotateCW` + kick offsets `[0,-1,1,-2,2]` in `tryRotate` (no SRS, no rotate-back-on-fail beyond skipping).
- Canvas pixel size is hardcoded in `index.html` (`300×600` = `COLS*BLOCK × ROWS*BLOCK`); change both if altering `COLS`/`ROWS`/`BLOCK`. Next-piece canvas is 120×120 (4×4 cells at 30px).
- Records: `localStorage['tetris-records']` = `{scores:[{name,score}] (top 5), bestCombo, maxLines}`. Start screen = `showStartScreen()` (sets `gameOver`, reuses `#overlay`; restart btn = "Jugar"). `endGame()` updates stats, sets `pendingRank` → inline name input in `#scores-list`. Combo = consecutive locks clearing ≥1 line (tracked in `clearLines`). Extra DOM ids: `records`, `scores-list`, `records-stats`, `save-btn`, `reset-btn`.
- Skins: `SKINS` map (retro/neon/pastel/pixel) in `game.js`; `applySkin()` swaps `COLORS` + `skin` (picks `BLOCK_DRAWERS[skin]` used by `drawBlock`), sets `data-skin` on `<html>` (CSS overrides `--canvas-bg`/`--grid`), persists to `localStorage('skin')`. DOM id `skin-select`.
