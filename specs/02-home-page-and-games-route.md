# SPEC 02 — Home landing page and `/games` route

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-10-15
> **Objective:** Add a landing page at `/` ported from `resources/templates/home-about/home.jsx`, add a "Home" nav link, and move the game library from `/` to `/games`.

## Why this spec exists

SPEC 01 made the library the root page. The `home-about` template defines a landing page that should be the entry point instead. This changes the meaning of `/`, so every link that pointed to the library must be re-pointed.

Home-specific styles exist only in `resources/templates/home-about/styles.css` (31 matches for `home-hero`, `mini-card`, `feature-card`, `.reveal`, `pricing-grid`, `home-final`, etc.). None are in `app/globals.css` yet.

## Scope

**In:**

- New landing page at `/` with the 7 template sections: hero (floating pixel silhouettes), why (4 feature cards), games preview, stats, live activity, pricing/FAQ, final CTA.
- Port the home styles from `resources/templates/home-about/styles.css` into `app/globals.css`, only classes not already present.
- Scroll-reveal behavior (`.reveal` → `.in` via `IntersectionObserver`) as a client component.
- Move the current library (hero + `LibraryBrowser`) from `app/page.tsx` to `app/games/page.tsx`, route `/games`.
- Nav: add "Home" first (desktop + mobile drawer). Order: Home, Library, Hall of Fame. Library points to `/games`.
- Re-point existing links to the library: `/` → `/games`.
- English copy for all home text (SPEC 01 language decision). Stats copy adapted to the real catalog.
- Hardcoded mock data for activity/top players (same style as SPEC 01 mocks).

**Out of scope (for future specs):**

- "About" page and nav link (in the template nav, not requested).
- Real data for stats, latest scores, top players (saved `av_scores` are not used).
- Real pricing, payments, accounts.
- i18n.
- Test runner.

## Data model

This feature introduces no new persisted data. It reuses `GAMES` from `lib/games.ts`.

Static mock constants live in the home components (not exported from `lib/`):

```ts
// components/home/*.tsx (local constants)
type Activity = { p: string; g: string; s: number; t: string; c: Accent };
type TopPlayer = { r: number; p: string; s: number };
```

Activity game names use the English catalog titles: DROP, CHOMPER, INVADERS, ROCKS, BRICK BUSTER, SNAKE, FROGGY.

Routes after this spec:

| Route                | File                           | Component type                      |
| -------------------- | ------------------------------ | ----------------------------------- |
| `/`                  | `app/page.tsx`                 | server page + client reveal child   |
| `/games`             | `app/games/page.tsx`           | server (moved from `app/page.tsx`)  |
| `/games/[id]`        | unchanged                      | server                              |
| `/games/[id]/play`   | unchanged                      | server shell + client player        |

New files (names to confirm at implementation, kept under `components/home/`): `reveal.tsx` (client, `IntersectionObserver` wrapper/hook), `floating-silhouettes.tsx`, `mini-card.tsx`, `feature-icon.tsx`.

Conventions:

- Number format: `toLocaleString("en-US")` (not `es-ES`).
- Mini-cards link with `next/link` to `/games/[id]`; first 6 of `GAMES`.
- CTA mapping: EXPLORE GAMES / VIEW ALL GAMES / INSERT COIN → `/games`; CREATE ACCOUNT / START FREE → `/auth`; VIEW HALL → `/hall-of-fame`.
- Active nav: Home on `/` only; Library on `/games` and `/games/*`; Hall of Fame on `/hall-of-fame`.
- Reveal uses effects only; initial server HTML must render without the `.in` class and without hydration mismatch.
- Next.js 16 has breaking changes: read the relevant guide in `node_modules/next/dist/docs/01-app` before touching routes or metadata.
- UI design follows `/frontend-design` per `CLAUDE.md`; here the template styles are the reference, so no restyling.

## Implementation plan

1. Move the library: create `app/games/page.tsx` with the current `app/page.tsx` content (title "Library"); make `app/page.tsx` a temporary minimal page. Check: `/games` shows the library, `/games/brick-buster` still works.
2. Re-point library links `/` → `/games`: `components/nav.tsx` Library links and `libraryActive` (`pathname.startsWith("/games")` only), `app/hall-of-fame/page.tsx:20`, `components/game-player.tsx:146`, `app/games/[id]/page.tsx:76`. `app/auth/page.tsx` redirects stay `/`. Check: no `href="/"` remains except the logo and Home link.
3. Nav: add Home link (desktop + drawer) with `homeActive = pathname === "/"`. Check: Home active only on `/`; Library active on `/games`.
4. Port home CSS from `resources/templates/home-about/styles.css` into `app/globals.css`. Skip classes already present (`.btn`, `.pixel`, `.neon-*`, `.fade-in`, `.blink`, etc.). Check: `npm run build` passes.
5. Create `components/home/floating-silhouettes.tsx`, `feature-icon.tsx`, `mini-card.tsx` (static, English, `next/link`). Check: build passes.
6. Create `components/home/reveal.tsx` (client) that adds `.in` to `.reveal` elements on intersect and disconnects on unmount. Check: build passes.
7. Build `app/page.tsx`: hero, why, games preview sections wired to CTA mapping. Check: `/` renders, scroll-reveal works.
8. Add stats, live activity, pricing/FAQ, final CTA sections. Check: all 7 sections render on `/`.
9. Metadata: `app/page.tsx` title "Home" (or the root default); remove leftover scaffold references.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass with no errors.
- [ ] `/` renders the landing page with exactly 7 sections in order: hero, why, games preview, stats, live activity, pricing/FAQ, final CTA.
- [ ] `/` does not render `LibraryBrowser` (no search box, no category chips).
- [ ] `/games` renders the library: 8 game cards, search and chips work as in SPEC 01.
- [ ] `/games/brick-buster`, `/games/brick-buster/play`, `/auth`, `/hall-of-fame` still return 200; unknown game ids still 404.
- [ ] Desktop nav shows Home, Library, Hall of Fame in that order; the mobile drawer lists Home, Library, Hall of Fame, Sign In.
- [ ] Home link has `active` only on `/`; Library link has `active` on `/games` and `/games/brick-buster`, not on `/`.
- [ ] Clicking the logo opens `/`.
- [ ] Hero CTA "EXPLORE GAMES" opens `/games`; "CREATE ACCOUNT" opens `/auth`.
- [ ] Games preview shows 6 mini-cards; clicking one opens `/games/[id]`; "VIEW ALL GAMES" opens `/games`.
- [ ] "VIEW HALL" opens `/hall-of-fame`; final "INSERT COIN" opens `/games`; "START FREE" opens `/auth`.
- [ ] "BACK TO VAULT" on the detail page, the hall-of-fame page and the game-over modal opens `/games`.
- [ ] Auth login and guest still redirect to `/` (landing page).
- [ ] Sections with `.reveal` get class `in` when scrolled into view.
- [ ] Reloading `/` produces no hydration warning in the console.
- [ ] At 390px width there is no horizontal scroll on `/` and the hamburger drawer works.
- [ ] No Spanish strings remain on `/`; activity rows use English game titles; numbers formatted with `en-US`.
- [ ] `app/globals.css` contains the home classes (`home-hero`, `feature-card`, `mini-card`, `price-card`, `home-final`).

## Decisions

- **Yes:** Home at `/`, library at `/games`. Matches the existing `/games/[id]` hierarchy, and `/` is the natural landing.
- **Yes:** Port all 7 sections. User chose the full template structure.
- **Yes:** English copy. Consistent with SPEC 01 (single language, no i18n).
- **Yes:** Hardcoded mock activity/top players, with game names mapped to the English catalog. No backend exists.
- **Yes:** Stats copy adapted (e.g. "8 GAMES" instead of the template's "12+"). The catalog has 8 titles; do not claim more.
- **Yes:** Nav is Home, Library, Hall of Fame. "Library" label kept from SPEC 01; user did not ask to rename.
- **Yes:** Library-pointing links go to `/games`. `/` no longer means library.
- **Yes:** Auth redirects stay `/`. Landing after login is acceptable; revisit if the user prefers `/games`.
- **Yes:** Home page is a server component; only the reveal logic is client. Keeps most of the page static.
- **Yes:** Copy template CSS into `globals.css` as-is (same approach as SPEC 01). Discarded: rewriting in Tailwind utilities.
- **No:** "About" nav link/page. Not requested; template `about.jsx` is a separate spec.
- **No:** Unconfirmed UI redesign. Structure and styles copied from the template.
- **No:** Navigate via client-side `navigate({name})` router from the template. Replaced by `next/link`.

## Risks

| Risk                                                                  | Mitigation                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Template CSS clashes with existing `globals.css` class names          | Diff template `styles.css` against `globals.css`; add only missing classes; inspect `/games` after. |
| `.reveal` hides content if JS fails or observer never fires           | Reveal child adds `.in`; verify at 390px and with reload mid-scroll that sections still appear.     |
| Missed link to `/` that should go to the library                      | Grep for `href="/"` and `push("/")` after step 2; acceptance criteria list each one.                |
| Stale SPEC 01 criteria (e.g. library at `/`, Library active on `/`)   | SPEC 01 stays as history; SPEC 02 supersedes the route for the library.                             |
| Next 16 API differences from training data                            | Read `node_modules/next/dist/docs/01-app` before writing routes, per `AGENTS.md`.                   |

## What is **not** in this spec

- About page or nav link.
- Real stats, real activity feed, real top players.
- Real pricing, payments or accounts.
- i18n or language switching.
- Test setup.
- Restyling beyond the template.

Each one, if it lands, goes in its own spec.
