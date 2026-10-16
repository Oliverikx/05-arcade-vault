# Arkanoid

Arkanoid (Breakout) game in plain HTML, CSS and JavaScript. **Zero dependencies**: no bundler, no npm, no framework.

## Run

Open `index.html` in a browser (works from `file://`), or serve the folder with any static file server.

## Controls

- **Move paddle:** `←` / `→` or `A` / `D`, or mouse
- **Launch ball / restart:** `Space` or click

## Features

- Paddle, ball, lives and score
- 5 levels with different block layouts; ball speed +0.5 per level
- Block break (explosion) animation
- Sound effects: ball bounce, block break
- Win and game over screens

## Project structure

- `index.html` — 640x480 canvas, loads scripts
- `game.js` — all game code (config, state, levels, loop, drawing)
- `style.css` — page/canvas centering
- `assets/` — spritesheet (`spritesheet-breakout.png`, `spritesheet.js`) and `sounds/`
- `specs/` — numbered specs, source of truth for behavior

## Development

Features are spec-driven: each change gets a spec in `specs/NN-slug.md` (Draft → In review → Approved → Implemented), implemented on its own branch `spec-NN-slug`.

| Spec | Feature |
| --- | --- |
| 01 | Arkanoid MVP |
| 02 | Block break animation |
| 03 | Sound effects |
| 04 | Multiple levels |
