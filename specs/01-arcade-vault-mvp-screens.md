# SPEC 01 — Arcade Vault MVP: all screens (visual only)

> **Status:** Approved
> **Depends on:** None
> **Date:** 2026-10-14
> **Objective:** Port the five screens of `resources/templates/` (library, game detail, player, auth, hall of fame) to Next.js App Router in English, with mock data and no real games.

## Why this spec exists

The templates are a hash-routed React-in-browser prototype (`resources/templates/*.jsx`, Spanish copy). The app is a Next 16 App Router project. Porting changes routing, language, typing and the server/client split, so the decisions are recorded here.

`styles.css` and the three Google fonts are already ported (`app/globals.css`, `app/layout.tsx`, commit `01-styles`). This spec reuses them and does not redo them.

The prompt said "Arcade Bot". The repo, README and templates all say "Arcade Vault". The spec uses **Arcade Vault**.

## Scope

**In:**

- Five screens: library, game detail, game player (placeholder), auth, hall of fame.
- Shared chrome: nav (desktop + mobile drawer), footer, credits counter.
- App Router routes (see Data model).
- UI copy translated to English; game catalog (titles, descriptions) translated to English with English ids.
- Mock auth: any credentials log in, guest mode, user kept in `localStorage`.
- Mock scores: seeded leaderboards; player saves scores to `localStorage`.
- Player placeholder: animated arena, fake score ticker, pause, end, game-over modal with save score.
- TypeScript types for all data. Missing/unknown game id → `notFound()`.
- Reuse existing classes in `app/globals.css`. Add missing ones only if a screen needs them.

**Out of scope (for future specs):**

- Real games (canvas/engine for any of the 8 titles).
- Backend, database, real authentication, OAuth (Google/GitHub buttons are inert).
- Real persisted leaderboards. Saved scores in `av_scores` are not shown in leaderboards yet.
- i18n / language switcher.
- Test runner setup.
- Real credits/coins economy (counter is static `CREDITS · 03`).

## Data model

```ts
// lib/games.ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type Accent = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;          // URL slug, e.g. "brick-buster"
  title: string;       // English, uppercase
  short: string;
  long: string;
  cat: Category;
  cover: string;       // CSS class from globals.css, e.g. "cover-bricks"
  color: Accent;
  best: number;        // mock global best
  plays: string;       // mock, e.g. "12.4K"
}

export const GAMES: Game[];              // the same 8 games as templates/data.jsx
export const CATS: ("ALL" | Category)[]; // ["ALL","ARCADE","PUZZLE","SHOOTER","VERSUS"]

// lib/scores.ts
export interface ScoreRow { rank: number; name: string; score: number; date: string }
export function seededScores(seed: number, count?: number): ScoreRow[]; // same algorithm as templates

// lib/session.ts (client)
export interface User { name: string }          // uppercase, max 10 chars
// localStorage keys: "av_user" (User | null), "av_scores" (SavedScore[])
export interface SavedScore { game: string; score: number; name: string; at: number }
```

Routes:

| Route                | File                               | Component type |
| -------------------- | ---------------------------------- | -------------- |
| `/`                  | `app/page.tsx`                     | server + client search/filter child |
| `/games/[id]`        | `app/games/[id]/page.tsx`          | server         |
| `/games/[id]/play`   | `app/games/[id]/play/page.tsx`     | server shell + client player |
| `/auth`              | `app/auth/page.tsx`                | client form    |
| `/hall-of-fame`      | `app/hall-of-fame/page.tsx`        | server shell + client tabs |

Other new files: `components/nav.tsx`, `components/footer.tsx`, `components/game-card.tsx`, `components/session-provider.tsx` (React context over `av_user`), `lib/games.ts`, `lib/scores.ts`.

Conventions:

- Number format: `toLocaleString("en-US")`. Dates: `DD/MM/2026` as in the seeded data.
- Active nav link: Library is active on `/`, `/games/*`; Hall of Fame on `/hall-of-fame`.
- Read `localStorage` only in effects or client handlers (no hydration mismatch).
- Next.js 16 has breaking changes: read the relevant guide in `node_modules/next/dist/docs/01-app` (dynamic `params` is async, `LayoutProps`/`PageProps` helpers) before writing routes.

## Implementation plan

1. Create `lib/games.ts` and `lib/scores.ts` with typed English data and `seededScores`. Check: `npm run build` passes.
2. Create `components/session-provider.tsx`; wrap `children` in `app/layout.tsx`. Replace `<div id="root">` only if unused by CSS. Check: app still renders.
3. Create `components/nav.tsx` (desktop links, credits counter, sign in / user button, hamburger + mobile drawer) and `components/footer.tsx`; add both to `app/layout.tsx`. Check: nav links navigate with `next/link`; drawer opens/closes.
4. Library at `app/page.tsx`: hero, search, category chips, grid with `components/game-card.tsx` (tilt effect), empty state. Check: filtering by text and chip works; card click goes to `/games/[id]`.
5. Game detail at `app/games/[id]/page.tsx`: cover, tags, stats strip, top-10 leaderboard, PLAY NOW and BACK TO VAULT buttons. Unknown id → `notFound()`. Check: all 8 ids render.
6. Hall of fame at `app/hall-of-fame/page.tsx`: game tabs, podium, table, "your best" row when logged in. Check: switching tabs changes rows.
7. Auth at `app/auth/page.tsx`: sign-in/create-account tabs, mock login, guest button, inert social buttons. Check: login sets `av_user`, redirects to `/`, nav shows user name.
8. Player at `app/games/[id]/play/page.tsx`: HUD, CRT frame with placeholder arena, fake score ticker, pause overlay, END and EXIT. Check: score ticks, pause stops it.
9. Game-over modal in the player: final score, name input (uppercase, max 10), SAVE SCORE writes to `av_scores`, PLAY AGAIN resets, BACK TO VAULT links to `/`. Check: entry appears in `localStorage`.
10. Metadata: `generateMetadata` for detail/player pages, page titles for the others. Remove leftover scaffold content.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass with no errors.
- [ ] `/`, `/games/brick-buster`, `/games/brick-buster/play`, `/auth`, `/hall-of-fame` return 200 and render without console errors.
- [ ] `/games/does-not-exist` and `/games/does-not-exist/play` show the Next 404 page.
- [ ] Library shows 8 game cards; typing "snake" shows only the matching card; chip `PUZZLE` shows only puzzle games; no match shows "NO RESULTS".
- [ ] Clicking a card or its PLAY button opens `/games/[id]`.
- [ ] Detail page shows title, description, tags, 3 stats and 10 leaderboard rows; top 3 rows have distinct styling.
- [ ] PLAY NOW opens `/games/[id]/play`; BACK TO VAULT opens `/`.
- [ ] Player score increases while running and stops when paused; PAUSE label toggles to RESUME.
- [ ] END opens the game-over modal with the final score; name input is uppercase and max 10 chars.
- [ ] SAVE SCORE appends `{game, score, name, at}` to `localStorage["av_scores"]` and shows "SCORE SAVED".
- [ ] PLAY AGAIN resets score to 0, lives to 3, level to 01 and closes the modal.
- [ ] Auth submit with any values sets `localStorage["av_user"]` to the uppercase username (max 10), redirects to `/`, and the nav shows that name.
- [ ] "PLAY AS GUEST" redirects to `/` with `av_user` unset and nav showing SIGN IN.
- [ ] Create-account tab shows the email field; sign-in tab hides it.
- [ ] Hall of fame shows podium (ranks 1–3), 12 table rows per game, and the "YOUR BEST" row only when logged in.
- [ ] Reloading after login keeps the user in the nav without a hydration warning.
- [ ] At 390px width the nav shows the hamburger and the drawer lists Library, Hall of Fame and Sign In; no horizontal scroll on any screen.
- [ ] All visible UI text is English; no Spanish strings remain from the templates.
- [ ] The word "Arcade Bot" does not appear anywhere in the app.

## Decisions

- **Yes:** App Router routes. Real URLs, deep links, idiomatic Next 16. Discarded: single-page hash router from the template.
- **Yes:** English UI and English game catalog (ids included). Single language, no i18n layer. Discarded: keeping Spanish copy.
- **Yes:** Name is Arcade Vault. Repo, README and templates agree; "Arcade Bot" treated as typo.
- **Yes:** Reuse the already-ported `app/globals.css` with template class names. Pixel fidelity at lowest cost. Discarded: rewriting in Tailwind utilities.
- **Yes:** Mock auth in `localStorage` (`av_user`) via a context provider. Matches the template and needs no backend.
- **Yes:** Player placeholder simulates score so the full game-over/save flow is visible. Real games plug into this screen in later specs.
- **Yes:** Seeded mock leaderboards (deterministic seeds from game id). Stable between renders and server/client.
- **No:** Showing saved `av_scores` in leaderboards. Needs a merge/ranking design; separate spec.
- **No:** Server-side auth or cookies. Out of scope until a backend exists.
- **No:** Test runner. None configured; verification is manual via the acceptance criteria.

## Risks

| Risk                                                             | Mitigation                                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Hydration mismatch from reading `localStorage` during render     | Session provider reads it in `useEffect`; nav renders the guest state until loaded.          |
| Next 16 API differences from training data (async `params`, etc.) | Read `node_modules/next/dist/docs/01-app` before each route, per `AGENTS.md`.                |
| Template CSS relies on classes/ids (`#root`) not present         | Check each screen against `globals.css`; add only missing classes.                           |
| `Math.random` in player ticker causes SSR/CSR differences        | Ticker runs only in client effects after mount.                                              |

## What is **not** in this spec

- Real games for any of the 8 titles.
- Backend, database, real login or OAuth.
- Persisted/real leaderboards.
- i18n or language switching.
- Test setup.
- Credits economy.

Each one, if it lands, goes in its own spec.
