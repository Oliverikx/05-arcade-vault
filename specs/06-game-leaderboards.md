# SPEC 06 — Game and global leaderboards

> **Status:** Implemented
> **Depends on:** SPEC 04, SPEC 05
> **Date:** 2026-10-20
> **Objective:** Persist scores in new Supabase `games` and `scores` tables and make them the only score source for the Hall of Fame, game detail pages, library cards and home activity.

## Why this spec exists

Scores live in localStorage (`av_scores`) and every board is fake: `seededScores()` in the Hall of Fame and detail pages, `Game.best` on cards and detail pages, and hardcoded `ACTIVITY` / `TOP_PLAYERS` on the home page. SPEC 04 left the Supabase plumbing ready (`lib/supabase/server.ts`), with an empty `public` schema. SPEC 05 made Asteroids the only real game. This spec makes its scores real and shared, and removes all fake score data. Auth is still fake (`av_user`), so scores are anonymous rows keyed by player name.

## Scope

**In:**

- Migration: `games` table seeded with `asteroids` only, `scores` table, `player_bests` view, RLS policies.
- Generated types `lib/supabase/database.types.ts`.
- Server Action `saveScore` in `app/actions/scores.ts`: validates, inserts, revalidates `/`, `/games`, `/games/asteroids` and `/hall-of-fame`.
- Server-only reads in `lib/leaderboard.ts`: game board, player best + rank, global board, best score per game, latest scores, today's top players.
- Per-game board: best run per player, top 12.
- Global board: sum of each player's best per game, top 12, real data only.
- Hall of Fame tabs: `GLOBAL` (default) + one tab per row in `games`, ordered like `lib/games.ts`. Catalog games without a `games` row get no tab (today: `GLOBAL`, `ASTEROIDS`).
- `YOUR BEST` row on every tab: real rank + best for `user.name`; hidden when that name has no score.
- Game detail `/games/[id]` for every catalog game: TOP SCORES (top 10, best run per player) and `Global best` read from Supabase. A game with no rows shows `NO SCORES YET — BE THE FIRST` and `Global best` `—`.
- Library cards (`components/game-card.tsx`): `BEST SCORE` read from Supabase via prop; `—` when none or offline. `app/games/page.tsx` fetches `getBestScores()` and passes it through `LibraryBrowser`.
- Home `LATEST SCORES`: latest 7 rows from `scores` (player, game title from the catalog, score, relative time such as `2 min ago`, accent = `game.color`).
- Home `TOP PLAYERS · TODAY`: top 5 by sum of per-game bests over runs created today (UTC).
- Home cards show `NO SCORES YET` when empty and `LEADERBOARD OFFLINE` when Supabase fails.
- Remove `Game.best` (type and 8 values) from `lib/games.ts`.
- Delete `lib/scores.ts`; no `seededScores` reference remains.
- Remove `ACTIVITY` / `TOP_PLAYERS` constants from `app/page.tsx`.
- GAME OVER modal (asteroids): SAVE SCORE calls the Server Action. Pending state `SAVING...`. Failure shows `SAVE FAILED — TRY AGAIN` and keeps the button.
- Fake-player games: SAVE SCORE replaced by note `PRACTICE RUN — SCORE NOT RECORDED`.
- Stop writing `av_scores`; remove `saveScore` from `SessionProvider`.
- Supabase failure on read: every board shows `LEADERBOARD OFFLINE` (no fallback data).

**Out of scope (for future specs):**

- Real Supabase Auth, linking scores to user ids, name ownership.
- Anti-cheat beyond input validation (signed runs, server-side replay).
- Realtime board updates.
- Moving the catalog (`lib/games.ts`) into the DB; seeding the other 7 games.
- Migrating old `av_scores` localStorage rows.
- Time-window boards other than home `TOP PLAYERS · TODAY`; pagination beyond top 12.
- The catalog `plays` counter (catalog copy, not a score) and `resources/templates/*`.

## Data model

```sql
-- supabase migration: create_leaderboards
create table public.games (
  id text primary key,                 -- matches lib/games.ts Game.id
  title text not null,
  created_at timestamptz not null default now()
);
insert into public.games (id, title) values ('asteroids', 'ASTEROIDS');

create table public.scores (
  id bigint generated always as identity primary key,
  game_id text not null references public.games(id),
  player_name text not null check (player_name ~ '^[A-Z0-9_]{1,12}$'),
  score integer not null check (score between 0 and 10000000),
  created_at timestamptz not null default now()
);
create index scores_game_score_idx on public.scores (game_id, score desc);
create index scores_created_at_idx on public.scores (created_at desc);

-- best run per player per game (earliest run wins ties)
create view public.player_bests with (security_invoker = true) as
select distinct on (game_id, player_name)
  game_id, player_name, score as best, created_at as achieved_at
from public.scores
order by game_id, player_name, score desc, created_at asc;
```

RLS:

| Table    | anon / authenticated                                                      |
| -------- | ------------------------------------------------------------------------- |
| `games`  | `select` all                                                              |
| `scores` | `select` all; `insert` all (CHECKs enforce shape); no `update` / `delete` |

```ts
// app/actions/scores.ts  ("use server")
export type SaveScoreResult =
  { ok: true } | { ok: false; error: "INVALID" | "SAVE FAILED" };
export async function saveScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<SaveScoreResult>;
// name: trim + uppercase; must match ^[A-Z0-9_]{1,12}$ ; score: integer 0..10_000_000

// lib/leaderboard.ts  (import "server-only")
export interface BoardRow {
  rank: number;
  name: string;
  score: number;
  date: string;
} // date DD/MM/YYYY
export interface GlobalRow {
  rank: number;
  name: string;
  total: number;
  games: number;
}
export interface LatestScore {
  name: string;
  gameId: string;
  score: number;
  at: string; // ISO timestamp; UI renders relative time
}
export interface TodayPlayer {
  rank: number;
  name: string;
  total: number;
}
export type Board<T> = { ok: true; rows: T[] } | { ok: false };
export async function getRealGameIds(): Promise<Set<string>>; // from games table
export async function getGameBoard(
  gameId: string,
  limit = 12,
): Promise<Board<BoardRow>>;
export async function getPlayerBest(
  gameId: string,
  name: string,
): Promise<{ rank: number; score: number; date: string } | null>;
export async function getGlobalBoard(limit = 12): Promise<Board<GlobalRow>>;
export async function getPlayerGlobal(name: string): Promise<GlobalRow | null>;
export async function getBestScores(): Promise<Record<string, number> | null>; // max per game; null = offline
export async function getLatestScores(limit = 7): Promise<Board<LatestScore>>;
export async function getTodayTopPlayers(
  limit = 5,
): Promise<Board<TodayPlayer>>;
```

Ranking rules:

- Global: source is `player_bests` only. `total` = sum of a player's bests; `games` = number of games contributing. Order: `total` desc, then name asc. Ranks 1..n, no ties shared.
- Today's top players: same rule as global, computed over `scores` rows with `created_at >= start of current UTC day`.
- Latest scores: every run (not deduplicated), `created_at` desc.

Detail page rules (`app/games/[id]/page.tsx`):

- Single path for any catalog id: TOP SCORES = `getGameBoard(id, 10)`; `Global best` = top row score, or `—` when empty / offline.
- A game id with no `games` row simply has no rows (empty state).

Files:

- New: `supabase` migration (applied via MCP `apply_migration`, name `create_leaderboards`), `lib/supabase/database.types.ts`, `lib/leaderboard.ts`, `app/actions/scores.ts`.
- Changed: `app/page.tsx` (async, DB activity), `app/games/page.tsx` + `components/library-browser.tsx` + `components/game-card.tsx` (best score prop), `app/hall-of-fame/page.tsx` (async Server Component, fetches boards, passes props), `components/hall-of-fame.tsx` (GLOBAL tab, props-driven, offline state), `app/games/[id]/page.tsx` (DB board, dynamic), `components/game-player.tsx` (Server Action save, pending/error, practice note), `components/session-provider.tsx` + `lib/session.ts` (drop `saveScore`, `SavedScore`, `SCORES_KEY`), `lib/games.ts` (drop `best`), `lib/supabase/server.ts` / `client.ts` (typed with `Database`), `app/globals.css` (GLOBAL table columns, offline / empty / error styles).
- Deleted: `lib/scores.ts`.

Conventions:

- Next.js 16 has breaking changes: read `node_modules/next/dist/docs/01-app` (Server Actions, `revalidatePath`, dynamic rendering, `generateStaticParams` + dynamic data) before writing code.
- Reads only server-side via `lib/supabase/server.ts`; `lib/leaderboard.ts` imports `server-only`.
- `/`, `/games`, `/games/[id]` and `/hall-of-fame` render on request (no stale static boards).
- Supabase errors: `console.error` details, return `{ ok: false }` / `null`; UI never shows provider messages.
- Hall data for all tabs fetched once on the server; tab switching stays client-side, no refetch.
- UI follows `/frontend-design` per `CLAUDE.md`; reuse `.podium`, `.hall-table`, `.leaderboard`, `.modal`, `.ticker`, `.top-list` styles.
- Podium with fewer than 3 rows: empty slots show `---`. Empty board: `NO SCORES YET — BE THE FIRST` linking to `/games/asteroids/play`.

## Implementation plan

1. Apply migration `create_leaderboards` (tables, seed, indexes, view, RLS) via Supabase MCP. Check: `list_tables` shows `games`, `scores`; `get_advisors` security has no new errors; anon `insert` with bad name fails.
2. Generate `lib/supabase/database.types.ts`; type both `createClient` factories with `Database`. Check: `npm run build` + `npm run lint` pass.
3. Create `lib/leaderboard.ts` with `getRealGameIds`, `getGameBoard`, `getPlayerBest`, `getBestScores`. Check: build + lint pass.
4. Add `getGlobalBoard`, `getPlayerGlobal`, `getLatestScores`, `getTodayTopPlayers` (real data only). Check: build + lint pass.
5. Create `app/actions/scores.ts`; wire GAME OVER modal for asteroids (pending, error, saved toast); practice note for fake games; remove `saveScore` / `av_scores` from session. Check: saving a run inserts a row (verify via `execute_sql`).
6. Detail page `/games/[id]`: DB TOP SCORES + `Global best` for all games, empty and offline states. Check: `/games/asteroids` shows the run saved in step 5; `/games/snake` shows the empty state.
7. Library: drop `Game.best`; `GameCard` reads best from `getBestScores()`. Check: asteroids card shows DB best, other cards `—`.
8. Home: replace `ACTIVITY` / `TOP_PLAYERS` with `getLatestScores` / `getTodayTopPlayers`, with empty and offline states. Check: a saved run appears in LATEST SCORES.
9. Hall of Fame: server page fetches boards; `HallOfFameBoard` gets GLOBAL tab (default) with `RANK / PLAYER / TOTAL / GAMES`, tabs from `games`, real `YOUR BEST`, offline state. Delete `lib/scores.ts`. Check: Playwright screenshot of GLOBAL and ASTEROIDS tabs.

## Acceptance criteria

- [x] `npm run build` and `npm run lint` pass.
- [x] `public.games` contains exactly one row: `asteroids` / `ASTEROIDS`.
- [x] Anon insert into `scores` with `player_name = 'bad name!'` or `score = -1` is rejected by the DB.
- [x] Anon `update` / `delete` on `scores` affects 0 rows.
- [x] Supabase security advisors report no RLS-disabled table in `public`.
- [x] `lib/scores.ts` does not exist; `grep -r seededScores app components lib` returns nothing.
- [x] `Game` type has no `best` field; no hardcoded score numbers remain in `app/page.tsx` or `lib/games.ts`.
- [x] SAVE SCORE on asteroids GAME OVER inserts one `scores` row with uppercase name and the modal's score.
- [ ] With Supabase unreachable, SAVE SCORE shows `SAVE FAILED — TRY AGAIN` and the button can be pressed again.
- [x] Fake-game GAME OVER shows `PRACTICE RUN — SCORE NOT RECORDED` and no SAVE SCORE button.
- [x] `localStorage.av_scores` is not written after any save; no code references `SCORES_KEY`.
- [x] `/games/asteroids` TOP SCORES lists the top 10 best-per-player scores stored in Supabase, ordered desc, with rank, name, score and date.
- [ ] Saving a score on asteroids, then opening `/games/asteroids`, shows that score in TOP SCORES without a manual cache clear.
- [x] `/games/asteroids` `Global best` equals the highest `scores.score` for `asteroids` in Supabase, or `—` when none.
- [x] `/games/snake` (a game with 0 rows) shows `NO SCORES YET — BE THE FIRST` in TOP SCORES and `—` as `Global best`.
- [x] Library card `BEST SCORE` for asteroids equals the DB max; other cards show `—`.
- [x] Home `LATEST SCORES` lists the latest DB runs newest first; with an empty DB it shows `NO SCORES YET`.
- [x] Home `TOP PLAYERS · TODAY` counts only runs created today (UTC); runs from earlier days are excluded.
- [x] `/hall-of-fame` tabs are exactly `GLOBAL` (default) and `ASTEROIDS`.
- [x] ASTEROIDS tab shows at most one row per player, ordered by best score desc, max 12 rows.
- [x] Saving a new personal best then reloading `/hall-of-fame` shows the new score (no stale cache).
- [x] GLOBAL tab rows show total = sum of that name's bests across games and the number of games counted.
- [x] Signed-in user with a real asteroids score sees `YOUR BEST` with correct rank and score on ASTEROIDS and GLOBAL tabs; user with no score sees no `YOUR BEST` row.
- [x] With 0 scores in the DB, Hall tabs, detail pages and home cards show the empty state, no crash.
- [ ] With Supabase unreachable, Hall, detail, home cards show `LEADERBOARD OFFLINE` and library cards show `—`; no page crashes.
- [ ] No console errors or hydration warnings on `/`, `/games`, `/hall-of-fame`, `/games/asteroids`, `/games/asteroids/play`.
- [ ] At 390px width the Hall tabs, GLOBAL table, detail TOP SCORES and home activity cards fit with no horizontal page scroll.

## Decisions

- **Yes:** Only DB scores anywhere in the app. Honest boards, one source of truth. Discarded: seeded fakes for non-real games (misleading; fake names could merge with real ones).
- **Yes:** Supabase `games` + `scores` tables. Shared boards across browsers; builds on SPEC 04. Discarded: localStorage boards (per-browser, no competition).
- **Yes:** `games` holds only real games (`asteroids`). Table means "has a leaderboard". Discarded: seeding all 8 (rows with no scores); DB as catalog source (bigger change, own spec).
- **Yes:** `lib/games.ts` stays the catalog; `games.id` must match `Game.id`.
- **Yes:** Hall tabs only for games in `games`. No empty tabs. Discarded: a tab per catalog game.
- **Yes:** Detail pages query the DB for every game. One code path; a game starts showing scores as soon as it gets a `games` row and runs. Discarded: hiding the panel for non-real games.
- **Yes:** Remove `Game.best`; library cards and detail read the best from the DB. Discarded: keeping catalog numbers as placeholders.
- **Yes:** Home activity from the DB. `TODAY` = current UTC day, ranked by sum of per-game bests (same rule as global). Discarded: leaving fake home data.
- **Yes:** Delete `lib/scores.ts`.
- **Yes:** Per-game board = best run per player, top 12 (top 10 on detail). Discarded: every run (one player can flood it). Latest scores on home is the exception: every run, it is an activity feed.
- **Yes:** Global = sum of each player's best per game. Fair once more games exist. Discarded: top raw runs (point scales differ); best single run per player.
- **Yes:** Server Action with validation + DB CHECKs. Validation in two layers. Discarded: browser direct insert (only DB checks, provider errors in client).
- **Yes:** Anonymous inserts keyed by name. Auth is still fake. Accepted: anyone can post under any name until the auth spec.
- **Yes:** Stop writing `av_scores`, ignore old rows. Discarded: dual write.
- **Yes:** Fake-player games can't save (practice note). No `games` row to reference.
- **Yes:** GLOBAL tab first, same podium/table UI. Discarded: separate global section.
- **Yes:** Dynamic reads + `revalidatePath`. Simple, fresh on next visit. Discarded: Realtime (own spec).
- **Yes:** Inline save error with retry; `LEADERBOARD OFFLINE` on read failure. Discarded: silent fail.
- **Yes:** `player_bests` view with `security_invoker`. Respects RLS; keeps dedupe logic in SQL.
- **Yes:** Generated `Database` types now (deferred by SPEC 04 to first table spec).

## Risks

| Risk                                                                | Mitigation                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Fresh DB: every board is empty and the site looks dead              | Clear `NO SCORES YET — BE THE FIRST` call to action linking to `/games/asteroids/play`. Accepted.                  |
| Score spam / fake high scores (anon insert)                         | DB CHECKs + server validation; real fix in auth / anti-cheat spec. Accepted.                                       |
| `player_bests` scans all rows for global and today boards           | Fine at current size; indexes on `(game_id, score desc)` and `created_at`; revisit with a materialized view later. |
| Home, library and detail become dynamic, adding queries per request | Small indexed queries; accepted. Revisit with caching if needed.                                                   |
| `generateStaticParams` makes `/games/[id]` static → stale board     | Make score data dynamic per Next 16 docs; criterion checks reload freshness.                                       |
| View created without `security_invoker` bypasses RLS                | Spec mandates `security_invoker = true`; advisors check.                                                           |
| Server Action called with forged `gameId`                           | Server checks id exists in `games`; FK rejects otherwise.                                                          |

## What is **not** in this spec

- Real auth, user-linked scores, anti-cheat.
- Realtime updates, daily/weekly boards beyond home `TODAY`, pagination.
- Catalog in DB, other games seeded in `games`, `av_scores` migration.

Each one, if it lands, goes in its own spec.
