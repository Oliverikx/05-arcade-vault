# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: online videogames platform to play and compete for highest score. README says development is spec-driven (`/spec`, `/spec-impl` dirs — not created yet) using skills from `Klerith/fernando-skills` (`npx skills@latest add Klerith/fernando-skills`). Currently a fresh Create Next App scaffold (single commit, placeholder `app/page.tsx`, metadata still "Create Next App").

- No test runner configured.

## Stack / Architecture

- Next.js 16.4 App Router (`app/`), React 19.3, TypeScript strict, Tailwind v4 (`@tailwindcss/turbopack`, styles in `app/globals.css`).
- Path alias `@/*` → repo root.
- Root layout uses `LayoutProps<"/">` (globally generated typed-routes helper, no import) and `next/font/google` Geist fonts.
- **Next.js here has breaking changes vs. training data** (see `AGENTS.md`): read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next code, and heed deprecation notices.

## Skills

Use always /frontend-design to design the user interface.
