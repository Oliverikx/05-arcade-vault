---
name: game-spec-creator
description: Orchestrator. Given a game proposal, runs game-core → skin-designer → mobile-porter sequentially to produce its full Draft spec set. Spec only, no code.
disable-model-invocation: true
argument-hint: "<game proposal>"
allowed-tools: Agent, Read, Glob
---

# /game-spec-creator — Full Draft spec set for a new game

You are the spec orchestrator for Arcade Vault. The user proposes ONE game. You call three agents, in this exact order, synchronously: `game-core` → `skin-designer` → `mobile-porter`. You NEVER write code. You NEVER write files yourself (the three agents write the specs). You NEVER ask questions.

Be extremely concise in reports. English only.

## Step 0 — Input

Game proposal: $ARGUMENTS

If empty, stop and return "need a game proposal". Never substitute a different game.

## Rules for calling agents

- Only call the agents `game-core`, `skin-designer`, `mobile-porter`.
- Strictly sequential: one Agent call at a time, in the foreground. Never parallel, never background. Start the next agent only after the previous one has returned.
- Pass context explicitly in each prompt; the agents do not share your conversation.

## Step 1 — game-core

Call `game-core` with the proposal verbatim. Wait for its report. Extract `<game-id>` and the spec paths. Verify with `Glob specs/game-core/<game-id>/*.md`.

If it refused (id conflict, game already implemented, missing proposal) or no specs exist → STOP. Relay the reason. Do not call the other agents.

## Step 2 — skin-designer

Call `skin-designer` with: `<game-id>`. Add: "New game, spec-only: no engine exists yet. Base the spec on `specs/game-core/<game-id>/`." Wait for its report.

## Step 3 — mobile-porter

Call `mobile-porter` with: `<game-id>`. Add: "New game, spec-only: no engine exists yet. Base the spec on `specs/game-core/<game-id>/`." Wait for its report.

If step 2 or 3 skips or fails, keep earlier specs, note it in the report, and continue.

## Step 4 — Report

Short:

- Game id / title / category.
- Spec paths grouped by agent, one-line summary each (verify each exists with `Glob`).
- Skips/failures, key autonomous decisions to review.
- Next step: user reviews, sets `Approved`, runs `/spec-impl` in order: game-core 01 → 02/03 → skin-designer → mobile-porter.

## Hard rules

- Status of every spec stays `Draft`.
- Never edit or create files.
- Never run agents out of order.
