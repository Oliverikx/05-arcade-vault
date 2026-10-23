# SPEC 14 — Security hardening (RLS check, password policy, rate limit, headers)

> **Status:** Implemented
> **Depends on:** SPEC 06, SPEC 13
> **Date:** 2026-10-23
> **Objective:** Apply the basic security checklist — verify RLS on `games`/`scores`, enforce a strong password policy (Supabase + mirrored client checklist), cap sign-ups/sign-ins at 10 per 5 min per IP, and send three security headers on every route.

## Why this spec exists

`resources/security/security-checklist.md` lists five basic items. Supabase advisor flags leaked password protection. SPEC 13 left the Supabase default password minimum (6) and default rate limits.

## Scope

**In:**

- **RLS verification** (no migration): RLS enabled on `games` and `scores`; anon insert/update/delete rejected.
- **Password policy** (Supabase dashboard, manual): Auth → Providers → Email → minimum length **8**, requirements **lowercase, uppercase letters, digits and symbols**.
- **Client mirror**: shared rules in `lib/auth.ts`; live rule checklist under the password field on CREATE ACCOUNT (`app/auth/page.tsx`) and `/auth/reset` (`app/auth/reset/page.tsx`); submit disabled until all rules pass. Sign-in form unchanged (no rule check on existing passwords).
- Supabase `weak_password` error → "PASSWORD TOO WEAK" (fallback if client check bypassed).
- **Rate limit** (dashboard, manual): Auth → Rate Limits → sign-ups and sign-ins **10 per 5 minutes per IP**. Supabase `over_request_rate_limit` / 429 → "TOO MANY ATTEMPTS — TRY LATER".
- **Security headers** in `next.config.ts` `headers()` for `source: "/(.*)"`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Leaked password protection**: documented as blocked (Free plan); advisor warning accepted.
- `CLAUDE.md` Identity section: password rules + rate limit + headers note.

**Out of scope (future specs):**

- Content-Security-Policy, HSTS, Permissions-Policy.
- Leaked password protection (needs Pro plan).
- Captcha (Turnstile/hCaptcha), MFA.
- Forcing existing users with weak passwords to change them.
- Revoking table grants / extra RLS hardening migration.
- App-level rate limiting of Server Actions (`saveScore`, contact form).

## Data model

No new tables, no migration.

```ts
// lib/auth.ts (added)
export const PASSWORD_MIN = 8;
export const PASSWORD_RULES: {
  id: "len" | "lower" | "upper" | "digit" | "symbol";
  label: string;
  test: (p: string) => boolean;
}[];
// labels: "MIN 8 CHARS", "a–z", "A–Z", "0–9", "SYMBOL"
export function passwordOk(p: string): boolean; // every rule passes
```

Symbol rule = any char outside `[A-Za-z0-9]` (matches Supabase "symbols").

```ts
// next.config.ts (added)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];
// headers: async () => [{ source: "/(.*)", headers: securityHeaders }]
```

New files: none.
Changed files: `next.config.ts`, `lib/auth.ts`, `app/auth/page.tsx`, `app/auth/reset/page.tsx`, `app/globals.css` (rule checklist styles), `CLAUDE.md`.

Conventions:

- Read `node_modules/next/dist/docs/01-app` (`headers` config) before editing `next.config.ts`.
- UI via `/frontend-design`, keep current `auth-card` look.
- Generic user-facing errors; details only in `console.error`.

## Implementation plan

1. **Dashboard setup (manual, user).** Supabase → Authentication:
   - Providers → Email: min password length 8; requirements "Lowercase, uppercase letters, digits and symbols".
   - Rate Limits: sign-ups and sign-ins 10 / 5 min per IP. Save.
     Check: dashboard shows values.
2. **RLS verification** via Supabase MCP `execute_sql` (`pg_class.relrowsecurity`, `pg_policy`). Check: both `true`; no update/delete policies.
3. `securityHeaders` + `headers()` in `next.config.ts`. Check: build; `curl -I http://localhost:3000/` and `/games` show three headers.
4. `PASSWORD_MIN`, `PASSWORD_RULES`, `passwordOk` in `lib/auth.ts`. Check: build + lint.
5. Live rule checklist + submit gating on CREATE ACCOUNT (`app/auth/page.tsx`); map `weak_password` and rate-limit errors. Check: weak password blocks submit; strong one signs up.
6. Same checklist + gating on `/auth/reset`; same error mapping. Check: reset with weak password blocked.
7. Update `CLAUDE.md` Identity section. Check: build + lint pass.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass.
- [ ] `relrowsecurity = true` for `public.games` and `public.scores` (`execute_sql`).
- [ ] As `anon`: insert into `scores` rejected; update/delete on `scores` and insert/update/delete on `games` affect 0 rows.
- [ ] Response headers on `/`, `/games`, `/auth`, `/api/health/supabase` include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] Embedding the site in an `<iframe>` from another origin is blocked by the browser.
- [ ] CREATE ACCOUNT: `abc12345` shows unmet rules (A–Z, SYMBOL) and submit disabled; `Abc12345!` enables submit.
- [ ] `/auth/reset`: same rule behavior.
- [ ] Direct `supabase.auth.signUp` with `abcdefgh` (bypassing UI) rejected by Supabase (`weak_password`).
- [ ] Sign-in form shows no rule checklist; existing users sign in unchanged.
- [ ] 11th sign-in attempt within 5 min from one IP → "TOO MANY ATTEMPTS — TRY LATER".
- [ ] OAuth (Google/GitHub) login, email confirm, password recovery still work.
- [ ] `get_advisors` security shows no new warnings (only `auth_leaked_password_protection`, accepted).
- [ ] Existing routes render unchanged; games playable as guest.

## Decisions

- **Yes:** Only the three checklist headers. Discarded: CSP/HSTS/Permissions-Policy now (CSP risks breaking OAuth, fonts, Next inline scripts) → own spec.
- **Yes:** `X-Frame-Options: DENY`. No page needs framing.
- **Yes:** Password min 8 + lower/upper/digit/symbol in Supabase (server truth). Discarded: client-only check (bypassable).
- **Yes:** Client live checklist mirrors rules; shared constants in `lib/auth.ts`. Discarded: error only on submit (worse UX).
- **No:** Rule check on sign-in. Existing weak passwords keep working; Supabase only enforces on set.
- **No:** Leaked password protection. Pro plan only; project on Free. Advisor warning accepted until upgrade.
- **Yes:** Rate limit 10 / 5 min per IP. Discarded: default 30 (loose), 5 + captcha (bigger scope).
- **Yes:** RLS verify only. Already enabled with correct policies (SPEC 06/13). Discarded: grant-revoke migration.
- **Yes:** Dashboard steps manual. MCP can't set auth password policy / rate limits.

## Risks

| Risk                                                        | Mitigation                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| Client rules drift from dashboard rules                     | Single `PASSWORD_RULES` source; server error mapped as fallback. |
| Rate limit 10/5 min blocks testing (shared IP / many tests) | Space test runs; limit adjustable in dashboard.                  |
| `headers()` misconfigured → missing on some routes          | Acceptance checks page, route handler and API route.             |
| `X-Frame-Options: DENY` breaks a future embed               | None today; revisit in CSP spec (`frame-ancestors`).             |
| Leaked passwords still accepted                             | Documented; strong rules reduce risk; enable on Pro upgrade.     |

## What is **not** in this spec

- CSP, HSTS, Permissions-Policy.
- Leaked password protection, captcha, MFA.
- Forced password reset for existing users.
- RLS hardening migration, app-level rate limits on Server Actions.

Each one, if it lands, goes in its own spec.
