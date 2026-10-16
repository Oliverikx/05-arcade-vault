# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arkanoid (Breakout) game in plain HTML, CSS and JavaScript. **Zero dependencies** — no bundler, no npm, no framework, no build/lint/test commands. Run by opening `index.html` directly in a browser (works from `file://`) or any static file server.

## Structure

- `index.html` — 640x480 `<canvas id="game">`; loads `assets/spritesheet.js` then `game.js` (plain scripts, global scope, no modules).
- `game.js` — all game code. `CONFIG` (dimensions, speeds, lives, points), `state` (phase `ready|playing|gameover|win`, score, lives, level, paddle, ball, blocks), `LEVELS` (ASCII grids, `X` = block, `.` = empty; color = `rowColors[row % len]`), fixed-step loop (`STEP_MS` = 1/60 s accumulator) with `update()` / `draw()`. All timing (e.g. explosions) advances in `update()`, not wall-clock.
- `style.css` — page/canvas centering.
- `specs/` — numbered specs (source of truth for behavior). `README.md` is stale/minimal.

Implemented specs: 01 MVP, 02 block break animation, 03 sound effects, 04 multiple levels (5 levels, ball speed +0.5/level). Read the relevant spec before changing related behavior.

## Assets (`assets/`)

- `spritesheet-breakout.png` — single spritesheet for paddle, ball, blocks, explosions.
- `spritesheet.js` — plain global-scope script (no modules). Include via `<script>` before game code. API:
  - `loadSpritesheet(cb)` — loads the PNG (path hardcoded relative to the HTML page: `assets/spritesheet-breakout.png`), copies it to an offscreen canvas, then calls `cb`. Safe to call multiple times. All draw calls are no-ops until loaded.
  - `drawSprite(ctx, name, x, y, w, h)` — `name` is `'paddle'`, `'ball'`, or `'block_<color>'` (`gray, red, yellow, cyan, magenta, hotpink, green`).
  - `drawFrame(ctx, frame, x, y, w, h)` — draw an arbitrary `{sx,sy,sw,sh}` rect.
  - `EXPLOSION_FRAMES[color]` — 4-frame break animation per block color; `EXPLOSION_DURATION = 150` (ms). Note `gray` reuses the red frames.
  - Blocks are 32x16 source px; paddle is 162x14; ball is 16x16.
- `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3` — SFX for bounce and block break.

## Spec-driven workflow

**All features go through specs — do not add features ad hoc.** Skills live in `.agents/skills/` (mirrored in `.claude/skills/`; locked in `skills-lock.json`, from `Klerith/fernando-skills`):

- `/spec <description>` — interviews the user, then writes `specs/NN-slug.md` (status `Draft`). Never writes code. Format follows `.agents/skills/spec/template.md`.
- `/spec-impl <NN-slug>` — only runs on specs whose status is **Approved** (human sets this). Creates git branch `spec-NN-slug` (config in `specs/.spec-config.yml`, `AutoCreateBranch: true`), then implements the plan one step at a time, pausing for diff review. Never commits automatically; out-of-scope requests go to a future spec.

Spec conventions:

- File `specs/NN-slug.md`; header blockquote: `Status`, `Depends on`, `Date`, `Objective` (one sentence).
- Status lifecycle: `Draft` → `In review` → `Approved` (human) → `Implemented` (set after impl; commits like "update ... specification status from approved to implemented") → `Obsolete`.
- Sections: Scope (In / Out of scope), Data model, Implementation plan, Acceptance criteria, Decisions, Risks.
- Each spec builds on earlier ones via `Depends on`; later specs extend `game.js` rather than rewriting it.
- Git: one branch per spec (`spec-NN-slug`), commits are lowercase imperative messages; main branch is `main`.
