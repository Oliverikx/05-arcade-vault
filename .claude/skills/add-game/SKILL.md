---
name: add-game
description: Writes ONE spec that integrates a new real game (engine + leaderboard) into Arcade Vault. The game can come from resources/started-games or be new. Spec only, no code.
disable-model-invocation: true
argument-hint: "<started-games folder, e.g. 03-claude-tetris | new game idea>"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /add-game — Spec writer for a new real game + leaderboard

## Session context

Today's date (use for the spec header, never guess):
!`date +%F`

Existing specs:
!`ls specs/ 2>/dev/null || echo "specs/ does not exist"`

Starter games available:
!`ls resources/started-games/ 2>/dev/null || echo "none"`

Game engines already in the platform:
!`ls lib/games/ 2>/dev/null || echo "none"`

---

Produces **exactly one spec** (`specs/NN-<id>-game.md`) covering engine port, platform integration and leaderboard for one game. Recipe comes from SPEC 05 (engine) and SPEC 06 (leaderboards). **You never write code here.** Implementation is done later by `/spec-impl`.

Read `template.md` (spec shape) and `integration-checklist.md` (platform touchpoints with paths) in this skill's directory before writing.

Reply in the language of the initial prompt. Spec language must match existing specs (English).

## Phase 1 — Context

1. Read `CLAUDE.md`, `specs/05-asteroids-game-integration.md`, `specs/06-game-leaderboards.md`, the latest spec, `lib/games.ts`, `components/game-player.tsx`.
2. Check whether `lib/games/registry.ts` exists:
   - **Missing** → the spec's step 1 is the registry refactor (inside this same spec, never a separate one).
   - **Present** → spec only adds a registry entry; read the registry and engine contract and reuse them.
3. If `$ARGUMENTS` is empty, ask for a one-sentence game description or a starter-game folder.

## Phase 2 — Analyze the source

**Started game** (`$ARGUMENTS` matches a folder in `resources/started-games/`, by full name, number or slug): read `game.js`, `README.md`, `CLAUDE.md`, `index.html`, `style.css`, its `specs/`, and list `assets/`. Inventory:

- canvas size, constants, scoring table, levels/difficulty, lives (or none)
- states and restart/win/game-over screens, in-canvas HUD
- input keys (mouse/touch too), globals, total lines
- UI language (Spanish → must become English), sprites, sounds

**New game:** ask mechanics, scoring, win/lose, controls, difficulty curve, then propose constants.

## Phase 3 — Questions

Use `AskUserQuestion`, blocks of 3–5, recommendation first. Game-specific only:

1. Catalog slot: reuse a placeholder entry in `lib/games.ts` (e.g. `drop` ↔ tetris, `brick-buster` ↔ arkanoid) with rename, or a new entry (id, title, category, accent, cover class).
2. HUD mapping: what Lives / Level mean for this game (no lives → `—`).
3. Canvas size vs 4:3 `.crt-screen` (rescale, letterbox).
4. Assets and sound: copy to `public/games/<id>/` or drop; sound in or out.
5. Touch controls / extra mechanics: in or out of scope.
6. Max realistic score vs DB cap 10,000,000.

**Do NOT re-ask, write as fixed decisions:** framework-free TS engine with `destroy()`; `ready` screen; platform React HUD + GAME OVER modal replace in-game ones; PAUSE button + `P`/`Esc` + tab-hidden auto-pause; English strings; neon palette from `app/globals.css`; scores via `saveScore` Server Action; leaderboard = row in `public.games`; Hall tab, detail board, card best score appear automatically from that row; no fake data.

Anything that opens a new area (multiplayer, auth, touch, realtime) → propose its own spec and put it in Out of scope.

Stop asking when you can answer: which files change, first/last step, how to verify.

## Phase 4 — Write and save

1. Number = highest in `specs/` + 1, zero-padded. Slug `NN-<game-id>-game`.
2. Fill `template.md`. `Status: Draft`, `Depends on: SPEC 05, SPEC 06` (verify they exist), date from session context.
3. Write directly to `specs/NN-slug.md`; don't ask permission. Ask only if the file exists.
4. Confirm: path, state is `Draft` (user sets `Approved` after reading), next step `/spec-impl NN-slug`. **Stop.**

## Hard rules

- One spec file per run. Engine and leaderboard stay together.
- Never write code or touch files other than the spec.
- Never mark `Approved`. Never propose implementing after saving.
- Acceptance criteria are boolean and verifiable; use exact numbers from the source game.
- Use real file names/paths from `integration-checklist.md`; no TODOs.
- Spec must tell implementer to read `node_modules/next/dist/docs/01-app` first (Next 16 breaking changes) and to use `/frontend-design` for UI.
