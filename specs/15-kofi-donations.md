# SPEC 15 — Ko-fi donations link

> **Status:** Draft
> **Depends on:** SPEC 03
> **Date:** 2026-10-28
> **Objective:** Add a "SUPPORT THE VAULT" external link to Ko-fi in the footer, the About page and the GAME OVER modal, driven by one env var and hidden when unset.

## Why this spec exists

First step of the monetization track (donations now, cosmetic skins shop in a later spec). A plain link needs no payment code, no DB, no third-party JS, and leaves the SPEC 14 security headers untouched.

## Scope

**In:**

- Env var `NEXT_PUBLIC_KOFI_URL` documented in `.env.example`.
- `lib/support.ts`: `kofiUrl()` returns the validated URL or `null`.
- `components/support-link.tsx`: styled external link, variants `inline` and `card`.
- Placements:
  - `components/footer.tsx`: `inline` link after the version text.
  - `app/about/page.tsx`: `card` in a new "SUPPORT" section after the contact section.
  - `components/game-player.tsx`: `inline` link inside the GAME OVER modal, below `.actions`.
- UI designed with `/frontend-design`, reusing existing tokens in `app/globals.css`.
- `CLAUDE.md`: one line under "Contact / email" (or a new "Support" heading) documenting the env var.

**Out of scope (for future specs):**

- Cosmetic skins shop, entitlements, any payment provider (Stripe, Lemon Squeezy, Paddle).
- Ko-fi webhook, SUPPORTER badge, bonus skin for donors.
- Ko-fi embedded widget or any third-party script.
- Analytics on link clicks.

## Data model

This feature introduces no new data structures. No DB, no server actions, no auth changes.

```ts
// lib/support.ts
export function kofiUrl(): string | null;
```

Rules for `kofiUrl()`:

- Reads `process.env.NEXT_PUBLIC_KOFI_URL`.
- Returns `null` if unset, empty, not parseable by `new URL()`, protocol is not `https:`, or hostname is not `ko-fi.com` / `www.ko-fi.com`.
- Otherwise returns the trimmed URL string.

## Implementation plan

1. Add `NEXT_PUBLIC_KOFI_URL=` (with a comment) to `.env.example`. Add `lib/support.ts` with `kofiUrl()`.
2. Add `components/support-link.tsx` (`variant: "inline" | "card"`, returns `null` when `kofiUrl()` is `null`). Anchor uses `target="_blank"` and `rel="noopener noreferrer"`. Styles in `app/globals.css`. Manual test: temporarily render it in the footer.
3. Wire `inline` variant in `components/footer.tsx`.
4. Add the `card` section to `app/about/page.tsx` (short text: hosting and new games), using `Reveal` like the other sections.
5. Add the `inline` link to the GAME OVER modal in `components/game-player.tsx`, visually quieter than SAVE SCORE / PLAY AGAIN.
6. Update `CLAUDE.md` with the env var.

## Acceptance criteria

- [ ] With `NEXT_PUBLIC_KOFI_URL=https://ko-fi.com/<page>`, the footer, the About page and the GAME OVER modal each show a "SUPPORT THE VAULT" link with that exact `href`.
- [ ] Each link has `target="_blank"` and `rel="noopener noreferrer"`.
- [ ] With the env var unset, none of the three placements render any support markup.
- [ ] With a non-Ko-fi value (e.g. `https://example.com` or `javascript:alert(1)`), none render.
- [ ] The GAME OVER modal still shows SAVE SCORE and PLAY AGAIN without layout overflow at 375 px width.
- [ ] Clicking the link in the modal does not trigger restart or save.
- [ ] `npm run lint` and `npm run build` pass.
- [ ] No new network requests to third-party domains on page load (verified with Playwright).

## Decisions

- **Yes:** plain link. No widget script, no CSP work, no privacy impact.
- **No:** Ko-fi widget/overlay. Adds third-party JS and would force a CSP discussion.
- **Yes:** env var, hidden when unset. No dead links in dev or forks.
- **Yes:** hostname allowlist in `kofiUrl()`. Guards against a mis-set env var rendering an arbitrary or `javascript:` link.
- **Yes:** GAME OVER placement, subtle. Highest-intent moment, low pressure.
- **No:** Buy Me a Coffee. Ko-fi chosen; swapping later is a one-file change in `lib/support.ts`.
- **No:** payment provider now. Skins shop gets its own spec after the provider decision.

## Risks

| Risk                                          | Mitigation                                                         |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Link in GAME OVER modal feels pushy           | Small, text-style, below the actions; revisit after seeing it.     |
| `NEXT_PUBLIC_` value is inlined at build time | Document that changing it requires a rebuild/redeploy.             |
| Env var not set in the deploy environment     | Feature silently hidden; add it to GitHub Actions / host settings. |

## What is **not** in this spec

- Skins shop or any paid product.
- Donor perks, webhooks, badges.
- Third-party scripts or analytics.
