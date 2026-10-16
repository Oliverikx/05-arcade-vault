# SPEC 04 — Supabase integration foundation

> **Status:** Approved
> **Depends on:** SPEC 03
> **Date:** 2026-10-16
> **Objective:** Connect the app to the existing Supabase project with `@supabase/ssr` browser and server clients, documented env vars, and a health route proving connectivity.

## Why this spec exists

Upcoming specs (real auth, persisted scores, real leaderboards) all need Supabase. This spec lays only the plumbing so those specs start from a working, verified connection. Today auth is fake (`av_user` in localStorage), scores live in localStorage (`av_scores`), and leaderboards use `seededScores()` — none of that changes here.

The Supabase project already exists (`project_ref=usxriuqyklrqvetggzdu`, see `.mcp.json`).

## Scope

**In:**

- Install `@supabase/supabase-js` and `@supabase/ssr`.
- Browser client factory `lib/supabase/client.ts`.
- Server client factory `lib/supabase/server.ts` (cookie-based, for Server Components, Server Actions, Route Handlers).
- Shared env reader `lib/supabase/env.ts` that throws a clear error when vars are missing.
- Env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` documented in `.env.example`.
- Health route `GET /api/health/supabase` returning connectivity status.

**Out of scope (for future specs):**

- Supabase Auth (sign in / sign up / OAuth) and replacing the fake `SessionProvider`.
- `proxy.ts` session-refresh (lands with the auth spec).
- Any table, migration, RLS policy.
- Persisting scores, real leaderboards, removing `seededScores()`.
- Generated DB types (`database.types.ts`).
- Supabase CLI / local stack / `supabase/` folder.
- Secret / service-role key.

## Data model

No database schema. No persisted data.

Env vars (both public by design — the publishable key is safe in the browser; RLS protects data):

| Var                                    | Required | Example                                    |
| -------------------------------------- | -------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | yes      | `https://usxriuqyklrqvetggzdu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes      | `sb_publishable_...`                       |

```ts
// lib/supabase/env.ts
export function getSupabaseEnv(): { url: string; key: string };
// throws Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")

// lib/supabase/client.ts
export function createClient(): SupabaseClient; // createBrowserClient

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>; // createServerClient + await cookies()

// app/api/health/supabase/route.ts — response body
type HealthBody = { ok: true } | { ok: false; error: string };
```

Health route behavior:

- Builds the server client (proves factory + cookies wiring).
- Fetches `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` with header `apikey: <publishable key>`.
- 2xx → `200 { ok: true }`.
- Non-2xx or network failure → `503 { ok: false, error: "SUPABASE UNREACHABLE" }`.
- Missing env → `503 { ok: false, error: "SUPABASE NOT CONFIGURED" }`.
- Details only in `console.error`.
- Not cached (dynamic route).

New files:

- `lib/supabase/env.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `app/api/health/supabase/route.ts`

Changed files: `package.json` (+`@supabase/supabase-js`, `@supabase/ssr`), `.env.example`.

Conventions:

- Next.js 16 has breaking changes: read `node_modules/next/dist/docs/01-app` (Route Handlers, `cookies()`, caching/dynamic) before writing code.
- `cookies()` is async → server factory is `async` and awaits it.
- Server factory `setAll` wrapped in `try/catch` (Server Components cannot set cookies; harmless until auth exists).
- Factories read env at call time, never at module top level → `next build` passes without vars.
- Client files never import `lib/supabase/server.ts` (it uses `next/headers`).
- Both factories named `createClient`; import path disambiguates (Supabase convention).

## Implementation plan

1. `npm install @supabase/supabase-js @supabase/ssr`. Check: `npm run build` passes.
2. Add Supabase vars to `.env.example` with comments (where to find them: Project Settings → API Keys). Check: file committed, `.env.local` untouched by git.
3. Create `lib/supabase/env.ts`. Check: `npm run build` + `npm run lint` pass.
4. Create `lib/supabase/client.ts` and `lib/supabase/server.ts`. Check: build + lint pass.
5. Create `app/api/health/supabase/route.ts`. Check: with real vars in `.env.local`, `curl localhost:3000/api/health/supabase` → `200 {"ok":true}`.

## Acceptance criteria

- [ ] `package.json` lists `@supabase/supabase-js` and `@supabase/ssr` in `dependencies`.
- [ ] `npm run build` and `npm run lint` pass with no Supabase env vars set.
- [ ] `.env.example` contains `NEXT_PUBLIC_SUPABASE_URL=` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`.
- [ ] With valid vars, `GET /api/health/supabase` returns 200 `{"ok":true}`.
- [ ] With vars removed, `GET /api/health/supabase` returns 503 `{"ok":false,"error":"SUPABASE NOT CONFIGURED"}` and the server log has the error.
- [ ] With a wrong URL (e.g. `https://invalid.supabase.co`), the route returns 503 `{"ok":false,"error":"SUPABASE UNREACHABLE"}`.
- [ ] Two consecutive requests both hit Supabase (route not statically cached).
- [ ] `lib/supabase/client.ts` does not import `next/headers`.
- [ ] Existing routes (`/`, `/games`, `/games/[id]`, `/hall-of-fame`, `/auth`, `/about`) render unchanged.
- [ ] No secret / service-role key appears anywhere in the repo or `.env.example`.

## Decisions

- **Yes:** Foundation only. Auth, scores, leaderboards each get their own spec. Discarded: one big "implement Supabase" spec (touches 4+ areas).
- **Yes:** `@supabase/ssr` browser + server clients. Official path for App Router with cookie sessions; ready for the auth spec. Discarded: plain `supabase-js` singleton (no cookie session support).
- **Yes:** Publishable key naming (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Current Supabase key model. Discarded: legacy `ANON_KEY`.
- **No:** Secret / service-role key. No admin ops yet; add when a spec needs it.
- **No:** `proxy.ts` session refresh. Useless without auth; ships with the auth spec.
- **No:** Generated DB types. Schema is empty; first table spec generates them.
- **No:** Supabase CLI / local stack. Remote project + MCP is enough for now.
- **Yes:** Health route `GET /api/health/supabase` hitting `/auth/v1/health`. Verifies URL + key without needing any table. Discarded: build-only check (proves nothing at runtime); dummy `ping` table (schema just for testing).
- **Yes:** Throw on missing env at call time. Fails loudly, build still passes. Discarded: returning `null` (silent degradation spreads null checks).
- **Yes:** Health route returns generic error strings; provider details only in server log.

## Risks

| Risk                                                           | Mitigation                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `@supabase/ssr` cookie API vs Next 16 async `cookies()`        | Read Next 16 docs first; use `getAll`/`setAll` pattern with `await cookies()`.             |
| Route Handler cached statically → stale health result          | Make route dynamic per Next 16 docs; acceptance criterion checks two requests.             |
| Publishable key mistaken for a secret, or secret key pasted in | `.env.example` comment says which key; criterion checks no secret key in repo.             |
| Health route publicly reachable in production                  | Returns only `ok` + generic string; no project details. Remove or protect in a later spec. |

## What is **not** in this spec

- Supabase Auth, `proxy.ts`, replacing fake sign-in.
- Tables, migrations, RLS, generated types.
- Score persistence, real leaderboards, removing `seededScores()`.
- Supabase CLI / local stack, secret key.

Each one, if it lands, goes in its own spec.
