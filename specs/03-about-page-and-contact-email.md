# SPEC 03 — About page and contact email (Resend)

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-10-15
> **Objective:** Add an `/about` page ported from `resources/templates/home-about/about.jsx` with a contact form that emails the team through Resend, and add an "About" nav link.

## Why this spec exists

SPEC 02 explicitly deferred the About page and nav link. The template's contact form only fakes success client-side; this spec makes it send a real email.

About-specific styles exist only in `resources/templates/home-about/styles.css` (lines ~1072–1146: `.about`, `.about-hero`, `.highlight*`, `.about-divider`, `.div-pixels`, `.about-contact`, `.contact-*`, `.terminal-success`, `.term-*`, `@keyframes shake`). Only `.field` / `.field input` are already in `app/globals.css`.

## Scope

**In:**

- New page `/about` with the template's two sections: about hero (kicker, title, mission, 3 highlights with pixel icons), animated pixel divider, contact (intro + tips + form).
- Port about/contact styles from the template `styles.css` into `app/globals.css`, only classes not already present (incl. `@keyframes shake`, `pxblink` if missing).
- Scroll reveal: reuse `components/home/reveal.tsx` (`Reveal`).
- Contact form sends one email to the team via Resend from a Server Action.
- Form states: idle, pending, success (template terminal), error (terminal-style `[ERR]` line), client shake on empty fields.
- Server-side validation + honeypot.
- Nav: "About" last, desktop + mobile drawer (drawer: Home, Library, Hall of Fame, About, Sign In). Active on `/about`.
- English copy for all text (SPEC 01 language decision).
- Env vars documented in a committed `.env.example`.

**Out of scope (for future specs):**

- Confirmation/auto-reply email to the sender.
- Rate limiting, CAPTCHA.
- Verified sending domain setup.
- Persisting messages (DB, admin inbox).
- React Email templates.
- i18n. Test runner.

## Data model

No persisted data.

```ts
// app/about/actions.ts
export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string }
  | { status: "error"; message: string; fields?: { name: string; email: string; msg: string } };
```

Form fields (`FormData` names): `name`, `email`, `msg`, honeypot `company` (hidden, `tabIndex=-1`, `autoComplete="off"`, `aria-hidden`).

Validation (server, after `trim()`):

| Field     | Rule                                                            |
| --------- | --------------------------------------------------------------- |
| `name`    | required, ≤ 80 chars                                            |
| `email`   | required, ≤ 254 chars, simple regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| `msg`     | required, ≤ 2000 chars                                          |
| `company` | non-empty → return `success` without sending                    |

Env vars (server-only, never `NEXT_PUBLIC_`):

| Var                  | Required | Default                                |
| -------------------- | -------- | -------------------------------------- |
| `RESEND_API_KEY`     | yes      | —                                      |
| `CONTACT_TO_EMAIL`   | yes      | —                                      |
| `CONTACT_FROM_EMAIL` | no       | `Arcade Vault <onboarding@resend.dev>` |

Email sent:

- `from`: `CONTACT_FROM_EMAIL` ?? default; `to`: `CONTACT_TO_EMAIL`; `replyTo`: user email.
- `subject`: `[Arcade Vault] Contact from <name>`.
- `text`: name, email, message. `html`: same content, every user value HTML-escaped, newlines → `<br>`.

Routes after this spec:

| Route    | File                 | Component type                                |
| -------- | -------------------- | --------------------------------------------- |
| `/about` | `app/about/page.tsx` | server page + client `ContactForm` + `Reveal` |

New files:

- `app/about/page.tsx` — server, metadata title "About".
- `app/about/actions.ts` — `"use server"`, `sendContact(prev, formData): Promise<ContactState>`.
- `components/about/contact-form.tsx` — client, `useActionState(sendContact, { status: "idle" })`.
- `components/about/highlight-icon.tsx` — HEART / BROWSER / PLANT pixel SVGs.
- `.env.example`.

Changed files: `components/nav.tsx`, `app/globals.css`, `package.json` (+`resend`), `.gitignore` (`!.env.example`).

Conventions:

- Next.js 16 has breaking changes: read `node_modules/next/dist/docs/01-app` (Server Actions / forms, `useActionState`, metadata) before writing code.
- `resend` client created inside the action (not at module top level) so `next build` works without the key.
- Missing env var or Resend error → `console.error` server-side, return `{ status: "error", message: "TRANSMISSION FAILED. TRY AGAIN LATER." }`; never leak provider error text to the client.
- Validation failure → return specific error message (e.g. "INVALID EMAIL ADDRESS") plus submitted `fields` so the form keeps values.
- Client keeps template behavior: empty-field check triggers `.shake` and blocks submit before calling the action.
- Pending: submit button disabled, label `▶  TRANSMITTING…`.
- Success: template terminal, `GRACIAS, {NAME}` → `THANKS, {NAME}`; "SEND ANOTHER MESSAGE" resets to idle with empty fields.
- Error: terminal-style line inside the form above the button (`[ERR] <message>` in red/magenta), values kept, retry allowed.
- Template copy translated: kicker "▸ ABOUT", title "ABOUT ARCADE VAULT", highlights "MADE WITH ❤️ FOR PLAYERS" / "HTML GAMES — RUN IN ANY BROWSER" / "A PROJECT IN CONSTANT GROWTH", contact kicker "▸ CONTACT", title "CONTACT US", tips "REPLY IN 24-48H" / "SUGGESTIONS WELCOME" / "NO SPAM, EVER", labels NAME / EMAIL / MESSAGE.
- UI follows `/frontend-design` per `CLAUDE.md`; template styles are the reference, no restyling.

## Implementation plan

1. Nav: add "About" link last in desktop `links` and in drawer before Sign In; `aboutActive = pathname === "/about"`. Create minimal `app/about/page.tsx`. Check: `/about` 200, About active only there.
2. Port about/contact CSS from template `styles.css` into `app/globals.css` (skip existing classes; verify `shake`, `pxblink`, `blink` keyframes). Check: `npm run build` passes.
3. Create `components/about/highlight-icon.tsx`; build static about hero + divider + contact intro in `app/about/page.tsx` with `<Reveal />`. Check: sections render, divider/contact get `.in` on scroll.
4. `npm install resend`; add `.env.example` + `!.env.example` in `.gitignore`. Check: build passes without `.env.local`.
5. Create `app/about/actions.ts` (validation, honeypot, env check, Resend send). Check: build + lint pass.
6. Create `components/about/contact-form.tsx` (shake, pending, success terminal, error line, reset) wired to the action; mount in page. Check: full flow manually with real key.

## Acceptance criteria

- [ ] `npm run build` and `npm run lint` pass, with no `RESEND_API_KEY` set.
- [ ] `/about` renders: hero with 3 highlights, pixel divider (24 squares), contact intro with 3 tips, form with NAME / EMAIL / MESSAGE.
- [ ] Desktop nav order: Home, Library, Hall of Fame, About. Drawer: Home, Library, Hall of Fame, About, Sign In.
- [ ] About link has `active` only on `/about`; other links not active there.
- [ ] `app/globals.css` contains `.about-hero`, `.highlight-row`, `.about-divider`, `.contact-form`, `.terminal-success`, `@keyframes shake`.
- [ ] Submitting with any empty field shakes the form and sends no request (no Server Action POST in network log).
- [ ] With valid env vars, valid submit shows pending label, then success terminal with `THANKS, <NAME>.`; email arrives at `CONTACT_TO_EMAIL` with subject `[Arcade Vault] Contact from <name>` and reply-to = entered email.
- [ ] HTML characters in the message (e.g. `<b>x</b>`) arrive escaped in the email HTML.
- [ ] "SEND ANOTHER MESSAGE" returns to an empty form.
- [ ] Invalid email (bypassing `type=email`, e.g. via devtools) returns an `[ERR]` line; fields keep their values.
- [ ] Message > 2000 chars returns an `[ERR]` line.
- [ ] Without `RESEND_API_KEY`, submit shows `[ERR] TRANSMISSION FAILED. TRY AGAIN LATER.`; page does not crash; server log has the error.
- [ ] Filled honeypot `company` returns success and sends no email.
- [ ] `RESEND_API_KEY` string does not appear in any client JS chunk (`.next/static`).
- [ ] Reloading `/about` produces no hydration warning.
- [ ] At 390px width: no horizontal scroll, highlights and contact grid stack to one column.
- [ ] No Spanish strings on `/about`.

## Decisions

- **Yes:** Server Action (`app/about/actions.ts`) + `useActionState`. No public endpoint; key stays server-side. Discarded: Route Handler `/api/contact`.
- **Yes:** Recipient/sender from env vars; default sender `onboarding@resend.dev`; reply-to = user. Works without domain verification (delivers only to the Resend account email until a domain is verified).
- **Yes:** One email to the team only. Discarded: auto-reply (needs verified domain).
- **Yes:** Plain text + escaped inline HTML. Discarded: React Email (extra deps).
- **Yes:** Loading + terminal-style error state. Template had none; real network call needs them.
- **Yes:** Server validation, max lengths, honeypot. Discarded: rate limiting (unreliable in-memory on serverless; own spec).
- **Yes:** Missing env → generic error state, build still passes. Discarded: dev console fallback (hides misconfiguration).
- **Yes:** English copy; About last in nav (template order).
- **Yes:** Reuse `components/home/reveal.tsx`. No new reveal logic.
- **Yes:** Copy template CSS into `globals.css` as-is (SPEC 01/02 approach).
- **No:** Template `navigate()` router. Replaced by `next/link`.

## Risks

| Risk                                                               | Mitigation                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `onboarding@resend.dev` only delivers to the Resend account email  | Set `CONTACT_TO_EMAIL` to that address; verified domain via `CONTACT_FROM_EMAIL` later. |
| Spam / abuse of the form                                           | Honeypot + length limits now; rate limit/CAPTCHA in a future spec.                      |
| HTML injection in email body                                       | Escape all user values in `html`; acceptance criterion checks it.                       |
| API key leaking to client                                          | Server-only env names, client created inside `"use server"` file; grep `.next/static`.  |
| `.env*` gitignore swallows `.env.example`                          | Add `!.env.example` negation.                                                           |
| Template CSS clashes with existing classes                         | Add only missing classes; recheck `/`, `/games`, `/auth` (`.field` shared with auth).   |
| Next 16 Server Action / `useActionState` API differs from training | Read `node_modules/next/dist/docs/01-app` first, per `AGENTS.md`.                       |

## What is **not** in this spec

- Auto-reply email, rate limiting, CAPTCHA, verified domain setup.
- Message storage or admin inbox.
- i18n, test setup, restyling beyond the template.

Each one, if it lands, goes in its own spec.
