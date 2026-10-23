# SPEC 13 — Supabase auth (email/password, Google, GitHub, recovery)

> **Status:** Approved
> **Depends on:** SPEC 04, SPEC 06
> **Date:** 2026-10-23
> **Objective:** Replace the fake browser-only name identity with Supabase Auth on the existing `/auth` page — email + password sign up (double opt-in, `username` in `user_metadata`), sign in, Google and GitHub OAuth, sign out, email password recovery — and tie every saved score to the signed-in user's id.

## Why this spec exists

Today identity is fake: `SessionProvider` stores `{ name }` in localStorage (`av_user`), the `/auth` form accepts anything, GOOGLE/GITHUB buttons do nothing, and anyone can save scores under any name. SPEC 04 laid the Supabase clients and deferred auth + `proxy.ts` to this spec.

## Scope

**In:**

- `/auth` page wired to Supabase (browser client):
  - **SIGN IN** tab: email + password → `signInWithPassword`.
  - **CREATE ACCOUNT** tab: username + email + password → `signUp` with `options.data.username` and `emailRedirectTo`. Success → "CHECK YOUR EMAIL" panel (no session until confirmed).
  - "Email not confirmed" error on sign in → message + **RESEND EMAIL** (`auth.resend({ type: "signup" })`).
  - **FORGOT PASSWORD?** link on sign-in tab → email-only mode → `resetPasswordForEmail` → "CHECK YOUR EMAIL" panel (same message whether or not the email exists).
  - GOOGLE / GITHUB buttons → `signInWithOAuth` with `redirectTo` `/auth/callback?next=…`.
  - **Pick username** step (`/auth?step=username`): shown when signed in but `user_metadata.username` missing (first OAuth login) → `updateUser({ data: { username } })`.
  - **Signed-in view** (visiting `/auth` while signed in with username): name, email, SIGN OUT button.
  - Error banner from `?error=link` → "LINK EXPIRED OR INVALID".
  - PLAY AS GUEST stays (just navigates to `next` / `/`, no sign-out side effect unless signed in → no-op).
- `GET /auth/confirm` route handler: `verifyOtp({ token_hash, type })` for `type=email|recovery` → redirect `next` (safe) or `/auth?error=link`.
- `GET /auth/callback` route handler: `exchangeCodeForSession(code)` (OAuth) → if no username → `/auth?step=username&next=…`, else `next`; failure → `/auth?error=link`.
- `/auth/reset` page: new password + repeat → `updateUser({ password })` → redirect `/`. No session → "LINK EXPIRED" + link back to forgot mode.
- `proxy.ts` (repo root): refresh Supabase session cookies on every request (official `@supabase/ssr` pattern, adapted to Next 16 proxy docs). No route protection.
- `SessionProvider` rewritten on Supabase: initial `getUser()` after mount + `onAuthStateChange`; exposes `user`, `ready`, `signOut()`. Removes stale `av_user` key once.
- Nav: name button opens small dropdown (ACCOUNT → `/auth`, SIGN OUT); closes on outside click / `Esc` / route change. Mobile panel: add SIGN OUT item when signed in.
- GAME OVER modal (`components/game-player.tsx`):
  - Signed in with username → name shown read-only + SAVE SCORE (name = username).
  - Guest → "SIGN IN TO SAVE" link to `/auth?next=<current path>`; no name input.
  - Signed in without username → "PICK A USERNAME TO SAVE" link to `/auth?step=username&next=…`.
- **Scores tied to users** (migration `add_scores_user_id`):
  - Delete the existing (legacy, anonymous) `scores` rows.
  - Add `scores.user_id uuid NOT NULL references auth.users(id) on delete cascade` + index `(user_id)`.
  - RLS: drop `scores insert all`; new `scores insert own` → `to authenticated with check (user_id = (select auth.uid()))`. `scores select all` unchanged.
  - `saveScore({ gameId, score })`: reads user via server client `auth.getUser()`; no user or no valid username → `{ ok: false, error: "UNAUTHENTICATED" }`; inserts `user_id = user.id`, `player_name = username` (client name no longer accepted).
  - Regenerate `lib/supabase/database.types.ts`.
- Supabase dashboard config (manual step, documented below).
- `CLAUDE.md` Identity section updated.

**Out of scope (future specs):**

- Username uniqueness / `profiles` table.
- Changing `player_bests` view / leaderboards to group by `user_id` (still group by `player_name`).
- Sign in with username (email only).
- Custom SMTP (Resend) — Supabase default SMTP used (low rate limit).
- Changing username / email / deleting account; account settings page.
- Route protection / protected pages.
- Preserving an unsaved score across the sign-in redirect.
- Migrating old localStorage names or old scores to accounts.
- Magic link, other OAuth providers, MFA, captcha.

## Data model

Users live in `auth.users`; username in `raw_user_meta_data.username`. No new tables.

Migration `add_scores_user_id`:

```sql
delete from public.scores; -- legacy anonymous rows (13 at spec time)
alter table public.scores
  add column user_id uuid not null references auth.users(id) on delete cascade;
create index scores_user_id_idx on public.scores (user_id);
drop policy "scores insert all" on public.scores;
create policy "scores insert own" on public.scores
  for insert to authenticated
  with check (user_id = (select auth.uid()));
```

```ts
// app/actions/scores.ts
export type SaveScoreResult =
  | { ok: true }
  | { ok: false; error: "INVALID" | "UNAUTHENTICATED" | "SAVE FAILED" };
export async function saveScore(input: {
  gameId: string;
  score: number;
}): Promise<SaveScoreResult>;
// insert { game_id, score, user_id: user.id, player_name: usernameOf(user) }
```

```ts
// lib/session.ts
export interface User {
  id: string;
  email: string | null;
  name: string | null; // user_metadata.username; null until picked (OAuth first login)
}

// lib/auth.ts (new, shared client/server, no next/headers)
export const USERNAME_RE = /^[A-Z0-9_]{1,12}$/; // same rule as saveScore NAME_RE
export function normalizeUsername(raw: string): string; // trim + toUpperCase
export function usernameOf(user: SupabaseUser | null): string | null; // valid metadata username or null
export function safeNext(next: string | null | undefined): string; // relative "/…" only, rejects "//" and "/\" → else "/"

// components/session-provider.tsx
interface SessionContextValue {
  user: User | null;
  ready: boolean;
  signOut: () => Promise<void>; // supabase.auth.signOut() + router.refresh()
}
```

Username input: uppercased as typed, max 12, validated with `USERNAME_RE` before submit (client) — inline error "A–Z, 0–9, _ · MAX 12".

Password: Supabase project minimum (default 6); Supabase error message shown uppercased.

Redirect URLs built from `window.location.origin`:

| Flow              | Client option                                              | Email template link (dashboard)                               |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| Sign up confirm   | `emailRedirectTo: ${origin}/auth/confirm?next=<safe next>` | `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`    |
| Password recovery | `redirectTo: ${origin}/auth/confirm?next=/auth/reset`      | `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery` |
| OAuth             | `redirectTo: ${origin}/auth/callback?next=<safe next>`     | —                                                             |

`/auth` query params: `next` (post-auth destination, via `safeNext`), `step=username`, `mode=forgot`, `error=link`.

New files:

- `proxy.ts`
- `lib/auth.ts`
- `app/auth/confirm/route.ts`
- `app/auth/callback/route.ts`
- `app/auth/reset/page.tsx`

Changed files: `app/auth/page.tsx`, `lib/session.ts`, `components/session-provider.tsx`, `components/nav.tsx`, `components/game-player.tsx`, `app/globals.css` (dropdown, auth messages/banners), `CLAUDE.md`.

Also changed: `app/actions/scores.ts` (`saveScore`), `lib/supabase/database.types.ts` (regenerated).

Unchanged consumers: `components/hall-of-fame.tsx` (`user?.name` still works; null name → no YOUR BEST), `getMyBests`, `lib/leaderboard.ts`, `player_bests` view.

Conventions:

- Read `node_modules/next/dist/docs/01-app` (proxy, Route Handlers, `cookies()`, `useSearchParams` + Suspense) before code.
- UI via `/frontend-design`, keeping current `auth-card` look.
- Browser code never imports `lib/supabase/server.ts`.
- Generic user-facing errors; details only in `console.error`.

## Implementation plan

1. **Dashboard setup (manual, user).** Supabase → Authentication:
   - Providers → Email: enabled, **Confirm email ON**.
   - Providers → Google and GitHub: enabled with client ID/secret from OAuth apps whose callback is `https://usxriuqyklrqvetggzdu.supabase.co/auth/v1/callback`. Secrets only in Supabase, never in repo.
   - URL Configuration: Site URL = production URL; Redirect URLs add `http://localhost:3000/**` and `<production URL>/**`.
   - Email Templates: "Confirm signup" and "Reset password" links replaced per the table above.
     Check: dashboard shows all three providers enabled; templates saved.
2. `lib/auth.ts` + new `User` in `lib/session.ts`. Check: build + lint.
3. `proxy.ts` session refresh. Check: app loads, all existing routes render, cookies untouched when signed out.
4. Rewrite `SessionProvider` on Supabase; adapt `nav.tsx` (dropdown + mobile SIGN OUT) and `game-player.tsx` GAME OVER modal. `/auth` page temporarily keeps old form minus fake `signIn`. Check: build + lint; signed-out nav shows Sign In; GAME OVER shows SIGN IN TO SAVE.
5. `/auth` email flows: sign up (+ check-email panel), sign in, unconfirmed + resend, forgot mode, signed-in view, `?error=link` banner. Plus `app/auth/confirm/route.ts`. Check: full email sign-up → confirm link → signed in.
6. `/auth/reset` page. Check: recovery email → reset → sign in with new password.
7. OAuth buttons + `app/auth/callback/route.ts` + pick-username step. Check: Google and GitHub logins land signed in after picking username.
8. Apply migration `add_scores_user_id` (Supabase MCP `apply_migration`), regenerate `database.types.ts`, update `saveScore` + GAME OVER save call. Check: signed-in save inserts row with `user_id`; `get_advisors` shows no new security warnings.
9. Update `CLAUDE.md` Identity + Leaderboards sections. Check: build + lint pass.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] Sign up with username `px_kai` → "CHECK YOUR EMAIL" panel; user **not** signed in; `auth.users` row has `email_confirmed_at IS NULL` and `raw_user_meta_data->>'username' = 'PX_KAI'` (via Supabase MCP `execute_sql`).
- [ ] Sign in before confirming → "confirm your email" message + RESEND EMAIL works.
- [ ] Clicking confirmation link → `/auth/confirm` → signed in, redirected to `next` (or `/`); nav shows `PX_KAI ▾`; `email_confirmed_at` set.
- [ ] Invalid / reused confirmation link → `/auth?error=link` banner shown.
- [ ] Sign in with wrong password → error message, still signed out.
- [ ] Username `bad name!` or 13 chars rejected client-side; no request sent.
- [ ] Nav dropdown: ACCOUNT → `/auth` signed-in view; SIGN OUT → signed out, nav shows Sign In, session cookies cleared. Mobile panel SIGN OUT works.
- [ ] Session survives full page reload and a new tab.
- [ ] Forgot password → email → `/auth/reset` → new password saved → old password fails, new one works.
- [ ] `/auth/reset` opened without session → "LINK EXPIRED" state.
- [ ] Google login (new account) → pick username step → username saved in metadata → nav shows it. Same for GitHub.
- [ ] Returning OAuth user with username skips pick step.
- [ ] `?next=//evil.com` or `?next=https://evil.com` redirects to `/`.
- [ ] GAME OVER: guest sees SIGN IN TO SAVE (link carries `next`); signed-in user saves score under username; Hall of Fame YOUR BEST shows for signed-in user.
- [ ] `scores` has column `user_id uuid NOT NULL` with FK to `auth.users`; legacy rows deleted.
- [ ] Signed-in save → new row's `user_id` = `auth.users.id` of that user and `player_name` = username (`execute_sql`).
- [ ] `saveScore` called while signed out → `{ ok: false, error: "UNAUTHENTICATED" }`, no row inserted.
- [ ] Direct anon insert into `scores` (publishable key, no session) rejected by RLS; authenticated insert with another user's `user_id` rejected.
- [ ] `av_user` localStorage key no longer written; stale key removed.
- [ ] Existing routes (`/`, `/games`, `/games/[id]`, `/games/[id]/play`, `/hall-of-fame`, `/about`) render unchanged; games playable as guest.
- [ ] No OAuth client secret or service-role key in repo / `.env.example`.

## Decisions

- **Yes:** Replace fake identity fully; `useSession()` API kept (`user.name`) so consumers barely change. Discarded: dual Supabase + localStorage fallback (two identity paths).
- **Yes:** Guests play but can't save. Discarded: guest typed names (collide with real usernames).
- **Yes:** `scores.user_id` NOT NULL, FK `auth.users` `on delete cascade`; legacy anonymous rows deleted. Discarded: nullable column keeping legacy rows (mixed data).
- **Yes:** `user_id` + `player_name` set server-side from `auth.getUser()`; RLS insert only for `authenticated` with `user_id = auth.uid()`. Discarded: trusting client name / keeping open anon insert.
- **No:** Leaderboards grouped by `user_id`. Still by `player_name`; later spec.
- **Yes:** Email + password sign in. Discarded: username login (needs username→email lookup table, enumeration risk).
- **No:** Username uniqueness. Only `user_metadata` as requested; `profiles` table later.
- **Yes:** Username rule `^[A-Z0-9_]{1,12}$` = `saveScore` rule, so every account name is saveable.
- **Yes:** OAuth users pick username once after first login. Discarded: auto-derived names.
- **Yes:** Recovery as mode inside `/auth` + `/auth/reset` page. Discarded: separate `/auth/forgot` route.
- **Yes:** `/auth/confirm` (token_hash + `verifyOtp`) for email links, `/auth/callback` (code exchange) for OAuth. Works when email opened in another browser. Discarded: PKCE code links for email.
- **Yes:** Templates use `{{ .RedirectTo }}` so `next` and localhost/prod both work with one template.
- **Yes:** Supabase default SMTP. Discarded for now: Resend SMTP (needs verified domain).
- **Yes:** Nav name opens small dropdown (ACCOUNT, SIGN OUT). Discarded: one-click sign out on name (too easy to hit).
- **Yes:** `?next=` honored through `safeNext`. Discarded: always home.
- **Yes:** `proxy.ts` refresh only, no protection.
- **Yes:** Auth calls from browser client in `"use client"` page (instant `onAuthStateChange` → nav). Discarded: Server Actions for each form (extra round trip to sync client state).
- **Yes:** Dashboard config as manual step 1. MCP can't configure providers/templates.
- **Yes:** Duplicate-email sign up shows same "CHECK YOUR EMAIL" (no account enumeration).

## Risks

| Risk                                                                 | Mitigation                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Default SMTP rate limit (~2 mails/h) blocks testing                  | Space test runs; resend button; Resend SMTP in a later spec.                        |
| Email templates not edited → links hit `/auth/confirm` without token | Step 1 is blocking; route redirects to `?error=link` instead of crashing.           |
| Redirect URL not allow-listed → Supabase falls back to Site URL      | Step 1 adds localhost + prod patterns; acceptance criteria test both flows locally. |
| Open redirect via `next`                                             | `safeNext` + acceptance criterion.                                                  |
| Next 16 `proxy.ts` API differs from Supabase docs' `middleware.ts`   | Read Next 16 proxy docs first; adapt export name/matcher.                           |
| Hydration mismatch in nav (session known only client-side)           | `ready` flag kept; render signed-out shell until `ready`.                           |
| Unsaved score lost when guest goes to sign in                        | Accepted; documented out of scope.                                                  |
| Deleting legacy scores is irreversible                               | Accepted by user; boards start empty. Delete runs only inside the migration.        |
| Username not unique → `player_bests` merges two accounts' scores     | Accepted; `user_id` now stored, so regrouping by user is possible later.            |
| Username changed later → old rows keep old `player_name`             | No username change in scope.                                                        |

## What is **not** in this spec

- Username uniqueness, leaderboards grouped by `user_id`.
- Custom SMTP, account settings, delete account, route protection.
- Preserving scores across sign-in redirect, migrating old names.

Each one, if it lands, goes in its own spec.
