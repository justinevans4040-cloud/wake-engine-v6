# CODEX READ ME FIRST — WAKE ENGINE HARD LOCK

This file is mandatory context for any Codex/agent working in this repo.

If any instruction in this file conflicts with convenience, prior assumptions, environment cwd, old code comments, stale README text, or inferred product direction, this file wins.

## Authorized repo

Only work in:

`C:\Users\justi\Documents\repos\wake-engine`

Hard stop if the current working directory or any target path contains:

- `OneDrive`
- `Dropbox`
- `GoogleDrive`
- `Google Drive`
- `iCloud`
- any other cloud/sync path

Do not read from, write to, test from, copy from, or reference:

`C:\Users\justi\OneDrive\Documents\Wake Engine`

That path was a mistaken duplicate/copy. Treat it as invalid.

## Product scope

The product is Wake Engine.

Wake Engine is the app/runtime name only.

Wake Engine is not the required content topic.
Wake Engine is not the default audience.
Wake Engine is not the default CTA.
Wake Engine is not the default proof type.
Wake Engine is not the default content lane.
Wake Engine is not a limitation on what the user can create.

The app must ingest any user-provided source/ask and create content for that source/ask.

Correct behavior:

- If the user inputs a fitness offer, create fitness content.
- If the user inputs a restaurant brief, create restaurant content.
- If the user inputs a legal/medical/business/personal/product brief, create content for that source.
- If the user inputs Wake Engine source material, then and only then create Wake Engine content.

Forbidden behavior:

- Hardcoding WAKE as the topic.
- Hardcoding WAKE as the CTA.
- Hardcoding WAKE as the content lane.
- Hardcoding WAKE as the proof language.
- Treating every content job as a Wake-branded promo.
- Using sample/test Wake content as product behavior.

All agents must be source-driven and topic-agnostic.

## Explicitly forbidden additions

Do not add, import, or design around:

- Loom
- Rune
- Echo
- CPT
- Next
- wakecodex
- unrelated ForgeFront/Viral Forge site projects
- unrelated apps or agents

Loom/Rune/Echo are not part of this app.

## User operating rule

Everything the user says is a gate, not a suggestion.

Do not reduce scope.
Do not reinterpret the ask into something smaller.
Do not pass a phase if promised work is missing.
Do not invent substitutes for missing specs.
Do not present inferred specs as real specs.
Do not use placeholders/theater/fake-live labels.

If blocked, stop and state:

- exact blocker
- exact file/path/spec missing
- what cannot be completed because of it

## Current repo state from prior work

Useful work from the mistaken OneDrive copy was copied into the authorized local repo.

Implemented/local files include:

- `scripts/guard-local-workspace.mjs`
- `scripts/wake-gatekeeper.mjs`
- `scripts/smoke-wake-v6.mjs`
- `scripts/ui-button-audit.mjs`
- `server/no-theater.js`
- `server/chat-profiles.js`
- `server/tier-zero-runtime.js`
- `server/index.js`
- `src/api.js`
- `src/app-config.jsx`
- `src/main.jsx`
- `src/styles.css`

The local-only guard is wired into package scripts.

Current validated state from the authorized local repo:

- phased implementation through Phase 9 complete
- `npm run build` passed
- `npm run smoke` passed with 26 checks
- `npm run audit:phase8` passed 11 checks
- `npm run audit:phase9` passed 16 checks
- recoverable WAL crash audit passed all 61 write, replay, and rollback boundaries
- `npm run benchmark` passed all 13 budgets
- `npm run gate` passed with 0 blockers
- Playwright/Electron UI audit verified 128 controls/actions
- packaged app, NSIS installer, migration, rollback, uninstall/reinstall, and desktop shortcut validated

Detailed current handoff: `CODEX_HANDOFF_2026-07-16_PHASE9_COMPLETE.md`.
Machine-readable verdict: `phase-audit/phase-00-gatekeeper/phase-verdict.json`.

## Tier Zero status

`server/tier-zero-runtime.js` implements the user-promoted Wake Engine Tier Zero content agent runtime with:

- Archivist
- Strategist
- Scriptwriter
- Creative Director
- QA
- Export
- contracts
- local tool calls
- persisted A2A messages, acknowledgements, inboxes, outboxes, and replayable handoffs
- persisted tool and memory receipts
- evidence map
- citation map
- QA scoring
- export manifest

Important truth:

No separate canonical Tier Zero specification exists in the authorized repo. The user promoted these agents and supplied the local Tier Zero build parameters. Tier Zero claims refer to those user-promoted parameters. Do not downgrade the agents to reconstructed, reimagined, or provisional labels, and do not invent an external canonical specification.

## Required product direction

Wake Engine must be:

- all local desktop app
- universal source/ask ingestion
- content creation engine
- content creation cluster
- full Tier Zero content agents
- real code, not theater
- real local tool-call ability
- A2A communication between content agents
- evidence/citation mapped
- QA gated
- export/package capable
- fast in agent chat
- clear about where responses appear
- ability-page based
- speech-to-text capable
- system-online voice with selectable/mutable voice controls
- old-school boot/loading style
- next-best-step guided after each action

## Drift Guard Status

Wake-only output drift is covered by static, runtime, and universal-fixture gates. Continue to reject regressions where Wake becomes the subject instead of the product.

Examples that remain forbidden:

- `WAKE frame` when it means generic content frame
- `WAKE proof` when it means source evidence
- `WAKE source` when it means user source
- CTAs like `Watch the full breakdown on WAKE` unless the input is actually about Wake
- hardcoded lanes/rules that bias toward Wake-only output

Do not remove the product name where it names the app/runtime.

## First action for any future agent

Run from the authorized repo:

```powershell
cd C:\Users\justi\Documents\repos\wake-engine
npm run guard:local
```

Then inspect this file before touching code.

If this file says one thing and another README/code comment says another, this file wins.
