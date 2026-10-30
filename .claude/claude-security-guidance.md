# Arcade Vault security rules

Stack: Next.js App Router + Supabase Auth/RLS + Resend. Specs: `specs/13-supabase-auth.md`, `specs/14-security-hardening.md`.

## Auth / identity

- Server code gets the user via `supabase.auth.getUser()`. Never trust `getSession()` alone, nor a client-supplied user id or username.
- `scores.user_id` and `scores.player_name` come from the server session (`user.id`, `usernameOf(user)`), never from action input. See `saveScore` in `app/actions/scores.ts`.
- Usernames are validated with `USERNAME_RE` / `normalizeUsername` (`lib/auth.ts`).
- Every `?next=` / redirect target goes through `safeNext` (open-redirect guard): `app/auth/page.tsx`, `app/auth/confirm`, `app/auth/callback`.
- `PASSWORD_RULES` / `passwordOk` only mirror the Supabase dashboard policy (source of truth). Don't weaken them.
- `proxy.ts` only refreshes session cookies. There is no route protection, so auth checks belong in server actions and route handlers.

## Server actions

- Every `"use server"` export is a public endpoint. Validate type and range of all input (pattern: `saveScore`, integer `0..10_000_000`, `game_id` must exist in `games`).
- Return fixed error codes (`INVALID` / `UNAUTHENTICATED` / `SAVE FAILED`). Never raw DB/Supabase error text to the client.

## Supabase / DB

- Only the publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) in app code. No `service_role` / secret key anywhere.
- Browser code (`"use client"`, components) never imports `lib/supabase/server.ts`.
- RLS stays enabled on all public tables. Migrations must not disable RLS or grant `anon` insert/update/delete on `scores`. Insert policy stays `authenticated` with `user_id = auth.uid()`.
- No SQL built by string concatenation; use the query builder or parameterized RPC.

## Secrets / env

- `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` are server-only, never `NEXT_PUBLIC_`.
- `.env*` is gitignored except `.env.example` (placeholders only). No tokens in `.mcp.json`.

## Contact form (`app/about/actions.ts`)

- All user input is HTML-escaped (`escapeHtml`) before going into the email body.
- Recipient (`to`) comes from env only, never from input. Input may only populate `replyTo` / body, with no header injection (strip CR/LF).

## Headers / XSS

- Keep the `next.config.ts` `headers()` entries (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`).
- No `dangerouslySetInnerHTML` or raw HTML with user data. Usernames and player names render on leaderboards.

## Accepted / not findings

- Leaked password protection is off (Free plan): accepted advisor warning.
- No CSP/HSTS yet: known. Only flag if a change removes existing headers.
- Usernames are not unique by design; boards group by `player_name`.
- `lib/games/**` is client-only canvas code. Scores are client-reported by design and only range-validated server-side.
