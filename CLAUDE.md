# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: online videogames platform to play and compete for the highest score. Working app, built spec-driven: each feature is a spec in `specs/` (`01..09`, all Implemented) authored with the repo's own `/spec` → `/spec-impl` skills; new games via `/add-game`.

Live features: playable games (see `resources/implemented-games.md` for the current list), Supabase leaderboards (per-game + global), a Resend contact form, and a lightweight browser-only name identity (not real auth).

## Stack / Architecture

- Next.js 16.4 App Router (`app/`), React 19.3, TypeScript strict, Tailwind v4 (`@tailwindcss/turbopack`, styles in `app/globals.css`).
- Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Resend (email), Prettier.
- Path alias `@/*` → repo root. Geist fonts via `next/font/google`. Root layout uses `LayoutProps<"/">` (globally generated typed-routes helper, no import).
- Scripts: `npm run dev | build | start | lint`. Deploy via GitHub Actions (`.github/`).
- **Next.js here has breaking changes vs. training data** (see `AGENTS.md`): read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next code, and heed deprecation notices.

## App structure

Routes (`app/`): `page.tsx` (home), `games/` (catalog), `games/[id]/` (detail), `games/[id]/play/`, `hall-of-fame/`, `about/`, `auth/` (name picker), `api/health/supabase/route.ts`.

Server Actions: `app/actions/scores.ts` (`saveScore`, `getMyBests`), `app/about/actions.ts` (contact form).

## Games architecture

- **Catalog**: `lib/games.ts` — 8 entries (`Game`, `Category`, `Accent`). Some are real/playable (see `resources/implemented-games.md` for the current list); the rest are placeholder/practice entries.
- **Engines**: framework-free TS in `lib/games/<id>/` (`engine.ts` + `draw.ts`/`levels.ts`/`pieces.ts`/`sprites.ts`). `createXGame(canvas, callbacks)` returns a `GameEngine`.
- **Contract** (`lib/games/engine-types.ts`): `GameEngine` = `setPaused`/`end`/`reset`/`destroy`; `GameCallbacks` = `onScore`/`onLives`/`onLevel`/`onGameOver`.
- **Registry** (`lib/games/registry.ts`): `id → { create, width, height, lives: number|null, touch: TouchLayout }`. One entry per real game.
- **Rendering**: `components/game-screen.tsx` (generic canvas wrapper), `components/game-player.tsx` (React HUD, GAME OVER modal, PAUSE via `P`/`Esc` + tab-hidden auto-pause; branches on registry lookup, not `game.id`). Per-game toolbars: `tetris-toolbar.tsx`, `arkanoid-toolbar.tsx`.
- **Presentation**: canvas CSS-scaled inside `.crt-screen` (4:3). Neon palette in `app/globals.css` (`.cover-<id>` classes too). Assets in `public/games/<id>/`.
- **Conventions**: callbacks fire only on change; engine created in `useEffect`, Strict-Mode safe; ignore game keys when target is an input; `shadowBlur` ≤ 8.

## Leaderboards & data

- Supabase tables/views: `scores`, `games`, `player_bests`. Clients in `lib/supabase/{client,server,env,database.types}.ts`.
- Reads in `lib/leaderboard.ts`: game board, global totals, today's top players, latest scores, player bests.
- `saveScore` validates: name `^[A-Z0-9_]{1,12}$`, integer score `0..10_000_000`, and that `game_id` exists in `games`.
- **A game goes "real" by inserting a `public.games` row** (migration `add_<id>_leaderboard`). Boards, library card best score, detail TOP SCORES, Hall of Fame tab, and GAME OVER SAVE SCORE then light up automatically. No fake data.

## Identity

Browser-only, not real auth. `lib/session.ts` (`USER_KEY = "av_user"`, `{ name }`) + `components/session-provider.tsx` (localStorage, read after mount to avoid hydration mismatch). The signed-in name only exists in the browser.

## Contact / email

Resend (`resend` package), `app/about/actions.ts`. Env: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, optional `CONTACT_FROM_EMAIL` (see `.env.example`).

## Skills

- Use always `/frontend-design` to design the user interface.
- **Spec workflow** (repo skills in `.claude/skills/`, mirrored in `.agents/skills/`):
  - `/spec` — design a spec section by section (questions first; never writes code). Saves `specs/NN-slug.md` as `Draft`.
  - `/spec-impl NN-slug` — implement an **Approved** spec. Creates/switches to branch `spec-NN-slug` (per `specs/.spec-config.yml` `AutoCreateBranch: true`), implements step by step, never auto-commits.
  - `/add-game <starter folder | idea>` — writes ONE spec integrating a new game engine + leaderboard. Reads `.claude/skills/add-game/integration-checklist.md` (platform touchpoints) and `template.md` first. Starter sources in `resources/started-games/`.

## Agents

- `game-planner` (`.claude/agents/game-planner.md`) — picks which game fits the platform next, then feed its pick to `/add-game`. Keeps all past suggestions in `.claude/agent-memory/game-planner/MEMORY.md`. Writes ranked to-do to `resources/game-suggestions-todo.md`.
- `game-jam` (`.claude/agents/game-jam.md`) — give it a game proposal; writes 3 Draft specs (same shape as 07–09) in `specs/game-jam/<game-id>/NN-<game-id>-<feature>.md`. Refuses if that game id already exists there.
- `skin-designer` (`.claude/agents/skin-designer.md`) — give it one or more game ids; checks each has a skin selector with neon/retro/classic (tetris = reference). Writes Draft specs `specs/skin-designer/NN-<game-id>-skin-selector.md` (no selector) or `NN-<game-id>-missing-skins.md` (some skins missing). Spec only.
- `mobile-porter` (`.claude/agents/mobile-porter.md`) — give it one or more game ids; checks each has working touch controls (shared `TouchPad` + registry `touch` layout, spec 10 = reference). Writes Draft specs `specs/mobile-porter/NN-<game-id>-gamepad.md` (no touch controls) or `NN-<game-id>-gamepad-fix.md` (present but broken). Spec only.

## Hooks

`.claude/settings.json` — PostToolUse hook runs `.claude/hooks/format-file.mjs` (Prettier) after every Write/Edit.

## MCPs

### Supabase

Remote MCP wired in `.mcp.json` (project `usxriuqyklrqvetggzdu`). Use for migrations (`apply_migration`), `execute_sql`, `list_tables`, `get_advisors` — e.g. confirming inserted rows during spec verification. Inspect existing tables before schema changes.

### Playwright

When playwright is executed, always follow these instructions:

-Save .log files in .playwright-mcp/logs
-Save .png files or other image files in .playwright-mcp/screenshots
-Save .yml files in .playwright-mcp/accessibility
-If app is running in port 3000 use it for testing. Otherwise follow default settings.
