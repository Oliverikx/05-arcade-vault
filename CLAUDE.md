# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: online videogames platform to play and compete for the highest score. Working app, built spec-driven: each feature is a spec in `specs/` (`01..12`, plus `specs/game-core/<id>/`, `specs/skin-designer/`, `specs/mobile-porter/`) authored with the repo's own `/spec` → `/spec-impl` skills; new games via `/add-game`. Status lives in each spec header.

Live features: 6 playable games (arkanoid, asteroids, froggy, minesweeper, snake, tetris), per-game skin selector (neon/retro/classic), touch gamepad (MK-II style), Supabase leaderboards (per-game + global), a Resend contact form, and and Supabase Auth (email/password + Google/GitHub, username in `user_metadata`).

## Stack / Architecture

- Next.js 16.4 App Router (`app/`), React 19.3, TypeScript strict, Tailwind v4 (`@tailwindcss/turbopack`, styles in `app/globals.css`).
- Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Resend (email), Prettier.
- Path alias `@/*` → repo root. Geist fonts via `next/font/google`. Root layout uses `LayoutProps<"/">` (globally generated typed-routes helper, no import).
- Scripts: `npm run dev | build | start | lint`. Deploy via GitHub Actions (`.github/`).
- **Next.js here has breaking changes vs. training data** (see `AGENTS.md`): read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next code, and heed deprecation notices.

## App structure

Routes (`app/`): `page.tsx` (home), `games/` (catalog), `games/[id]/` (detail), `games/[id]/play/`, `hall-of-fame/`, `about/`, `auth/` (sign in/up, recovery, pick username), `auth/reset/`, `auth/confirm` + `auth/callback` (route handlers), `api/health/supabase/route.ts`.

Server Actions: `app/actions/scores.ts` (`saveScore`, `getMyBests`), `app/about/actions.ts` (contact form).

## Games architecture

- **Catalog**: `lib/games.ts` — 6 entries (`Game`, `Category`, `Accent`), all real/playable and matching the registry.
- **Engines**: framework-free TS in `lib/games/<id>/` (`engine.ts` + helpers like `draw.ts`/`levels.ts`/`pieces.ts`/`sprites.ts`/`lanes.ts`/`board.ts`/`sound.ts`). `createXGame(canvas, callbacks)` returns a `GameEngine`.
- **Contract** (`lib/games/engine-types.ts`): `GameEngine` = `setPaused`/`end`/`reset`/`destroy`; `GameCallbacks` = `onScore`/`onLives`/`onLevel`/`onGameOver`, plus optional `onAbilityMenu` (tetris) and `onHints` (minesweeper).
- **Registry** (`lib/games/registry.ts`): `id → { create, width, height, lives: number|null, touch: TouchLayout }`; `TouchLayout` = `dpad`, `buttons`, `repeat?`, `abilityButtons?`. One entry per real game.
- **Rendering**: `components/game-screen.tsx` (generic canvas wrapper), `components/game-player.tsx` (React HUD, GAME OVER modal, PAUSE via `P`/`Esc` + tab-hidden auto-pause; branches on registry lookup, not `game.id`), `components/touch-pad.tsx` (shared touch gamepad). Per-game toolbars: `components/<id>-toolbar.tsx` (skin selector etc.) for all 6 games.
- **Presentation**: canvas CSS-scaled inside `.crt-screen` (4:3). Neon palette in `app/globals.css` (`.cover-<id>` classes too). Assets in `public/games/<id>/`.
- **Conventions**: callbacks fire only on change; engine created in `useEffect`, Strict-Mode safe; ignore game keys when target is an input; `shadowBlur` ≤ 8.

## Leaderboards & data

- Supabase tables/views: `scores`, `games`, `player_bests`. Clients in `lib/supabase/{client,server,env,database.types}.ts`.
- Reads in `lib/leaderboard.ts`: game board, global totals, today's top players, latest scores, player bests.
- `saveScore({ gameId, score })` requires a signed-in user with a valid username (else `UNAUTHENTICATED`); validates integer score `0..10_000_000` and that `game_id` exists in `games`. Inserts `user_id` + `player_name = username` server-side. `scores.user_id` is NOT NULL (FK `auth.users`); RLS insert only for `authenticated` with `user_id = auth.uid()`. Boards still group by `player_name`.
- **A game goes "real" by inserting a `public.games` row** (migration `add_<id>_leaderboard`). Boards, library card best score, detail TOP SCORES, Hall of Fame tab, and GAME OVER SAVE SCORE then light up automatically. No fake data.

## Identity

Supabase Auth (SPEC 13). Email + password (confirm email ON), Google, GitHub, password recovery. Username lives in `user_metadata.username` (`^[A-Z0-9_]{1,12}$`, not unique; OAuth users pick it once at `/auth?step=username`). Guests can play but not save scores.

- `lib/auth.ts`: `USERNAME_RE`, `normalizeUsername`, `usernameOf`, `safeNext` (open-redirect guard for `?next=`).
- `lib/session.ts`: `User { id, email, name }`; `components/session-provider.tsx`: `getUser()` after mount + `onAuthStateChange`, exposes `user`, `ready`, `signOut()`. Render signed-out shell until `ready`.
- `proxy.ts`: refreshes session cookies on every request; no route protection.
- `app/auth/confirm` (`verifyOtp`, email links), `app/auth/callback` (OAuth code exchange), `app/auth/reset` (new password). Email templates use `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email|recovery` (set in the Supabase dashboard).
- Browser code never imports `lib/supabase/server.ts`.
- **Hardening (SPEC 14)**: password min 8 + lower/upper/digit/symbol (Supabase dashboard = truth; mirrored by `PASSWORD_RULES`/`passwordOk` in `lib/auth.ts`, live checklist on CREATE ACCOUNT + `/auth/reset`, none on sign-in). `authErrorMessage` maps `weak_password` / 429. Auth rate limit 10 per 5 min per IP (dashboard). `next.config.ts` `headers()` sends `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`. Leaked password protection off (Free plan, accepted advisor warning). No CSP/HSTS yet.

## Contact / email

Resend (`resend` package), `app/about/actions.ts`. Env: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, optional `CONTACT_FROM_EMAIL` (see `.env.example`).

## Skills

- Use always `/frontend-design` to design the user interface.
- **Spec workflow** (repo skills in `.claude/skills/`; `spec`/`spec-impl` also mirrored in `.agents/skills/`, which additionally holds `frontend-design`):
  - `/spec` — design a spec section by section (questions first; never writes code). Saves `specs/NN-slug.md` as `Draft`.
  - `/spec-impl NN-slug` — implement an **Approved** spec. Creates/switches to branch `spec-NN-slug` (per `specs/.spec-config.yml` `AutoCreateBranch: true`), implements step by step, never auto-commits.
  - `/add-game <starter folder | idea>` — writes ONE spec integrating a new game engine + leaderboard. Reads `.claude/skills/add-game/integration-checklist.md` (platform touchpoints) and `template.md` first. Starter sources in `resources/started-games/`.
  - `/game-implementator <game-id>` (`.claude/skills/game-implementator/`) — game id with Draft/Approved specs; creates `feat/<game-id>-implementation`, implements specs in order (game-core → skin-designer → mobile-porter) via the `/spec-impl` flow (branch per spec, auto-approves, marks `Implemented`, commits, merges back), then pushes.
  - `/game-spec-creator <proposal>` (`.claude/skills/game-spec-creator/`) — runs `game-core` → `skin-designer` → `mobile-porter` sequentially (spec-only mode for unbuilt games). Draft specs only, no code.

## Agents

Definitions in `.claude/agents/<name>.md` (see there for details).

- `game-planner` — picks which game to add next (feeds `/add-game`); keeps ranked to-do in `resources/game-suggestions-todo.md`.
- `game-core` — game proposal → 3 Draft specs in `specs/game-core/<game-id>/`.
- `skin-designer` — game ids → Draft specs for missing skin selector / neon-retro-classic skins. Spec only.
- `mobile-porter` — game ids → Draft specs for missing/broken touch controls (specs 10–11 = reference). Spec only.
- `game-performance` — game id(s) → perf fixes like spec 12, FPS measured via Playwright. One game per run, no commits; ask user before next.

## Hooks

`.claude/settings.json` — PostToolUse hook runs `.claude/hooks/format-file.mjs` (Prettier) after every Write/Edit/MultiEdit.

## MCPs

### Supabase

Remote MCP wired in `.mcp.json` (project `usxriuqyklrqvetggzdu`). Use for migrations (`apply_migration`), `execute_sql`, `list_tables`, `get_advisors` — e.g. confirming inserted rows during spec verification. Inspect existing tables before schema changes.

### Playwright

When playwright is executed, always follow these instructions:

- Save .log files in .playwright-mcp/logs
- Save .png files or other image files in .playwright-mcp/screenshots
- Save .yml files in .playwright-mcp/accessibility
- If app is running in port 3000 use it for testing. Otherwise follow default settings.
