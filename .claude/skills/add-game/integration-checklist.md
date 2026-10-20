# Integration checklist — what a real game touches

Verify paths still exist before citing them in a spec.

| Area            | File                                                     | Change per new game                                                                                                                                         |
| --------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog         | `lib/games.ts`                                           | New entry or rename of placeholder (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `plays`). `id` must equal `public.games.id`. No `best` field.  |
| Cover art       | `app/globals.css`                                        | `.cover-<id>` class (+ `::before` / `::after`); rename if reusing a placeholder cover.                                                                      |
| Engine          | `lib/games/<id>/engine.ts`                               | Framework-free TS: `createXGame(canvas, callbacks)` returning `{ setPaused, end, reset, destroy }`. Split entities if > ~400 lines.                         |
| Contract        | `lib/games/engine-types.ts`                              | Shared `GameCallbacks` (`onScore`, `onLives`, `onLevel`, `onGameOver`) and `GameEngine`. Created by the first spec that needs the registry.                 |
| Registry        | `lib/games/registry.ts`                                  | `id → { create, width, height, lives: number \| null, keyboardRequired }`. One entry per real game.                                                         |
| Screen          | `components/game-screen.tsx`                             | Generic canvas wrapper (props `paused`, `runId`, `endSignal`, callbacks). Replaces `components/asteroids-screen.tsx`.                                       |
| Player          | `components/game-player.tsx`                             | Branches on registry lookup, not on `game.id === "asteroids"`: HUD lives, KEYBOARD REQUIRED note, practice note for non-registered games.                   |
| Hardcoded links | `components/hall-of-fame.tsx`, `app/games/[id]/page.tsx` | Empty-state link `/games/asteroids/play` must point at the current game.                                                                                    |
| Score save      | `app/actions/scores.ts`                                  | No change: `saveScore` validates the id against the `games` table.                                                                                          |
| Reads           | `lib/leaderboard.ts`                                     | No change: boards are driven by `games` rows.                                                                                                               |
| DB              | Supabase `public.games`                                  | Migration `add_<id>_leaderboard`: `insert into public.games (id, title) values ('<id>', '<TITLE>');` via MCP `apply_migration`. Title equals catalog title. |

## Automatic once the `games` row exists

- Hall of Fame tab for the game (catalog order) and GLOBAL totals include it.
- `/games/<id>` TOP SCORES + Global best.
- Library card BEST SCORE.
- Home LATEST SCORES / TOP PLAYERS · TODAY.
- GAME OVER modal SAVE SCORE (instead of practice note).

## Platform conventions

- Canvas internal resolution fixed; CSS scales it inside `.crt-screen` (4:3).
- Palette: ink `#e6e9ff`, cyan `#00f5ff`, magenta `#ff006e`, yellow `#f5ff00`, green `#00ff88`, bg `#000`; `shadowBlur` ≤ 8.
- Callbacks fire only on change. Engine created in `useEffect`, safe under Strict Mode.
- Ignore game keys when target is an input; `preventDefault` arrows/Space only while engine mounted.
- Score range 0..10,000,000 integer; player name `^[A-Z0-9_]{1,12}$`.

## Verification tooling (for acceptance criteria)

- Supabase MCP: `execute_sql` to confirm inserted rows, `list_tables`, `get_advisors`.
- Playwright MCP, saved per `CLAUDE.md`: logs → `.playwright-mcp/logs`, images → `.playwright-mcp/screenshots`, yml → `.playwright-mcp/accessibility`. Use port 3000 if the app is running.
- Starter-game reference sources: `resources/started-games/02-asteroids` (already ported), `03-claude-tetris`, `04-arkanoid`.
