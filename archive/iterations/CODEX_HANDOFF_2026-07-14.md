# WAKE ENGINE DETAILED HANDOFF - 2026-07-14

This is the current repo-local handoff after completion of the Wake Engine phased build through Phase 7.

Read order for any future Codex instance:

1. `CODEX_READ_ME_FIRST.md`
2. This file
3. `TIER_ZERO_BUILD_STATUS.md`
4. `phase-audit/phase-00-gatekeeper/phase-verdict.json`

## Hard Boundary

Authorized repo only:

`C:\Users\justi\Documents\repos\wake-engine`

Never read, write, test, copy, or reference the invalid OneDrive duplicate. The local workspace guard is mandatory and wired into every important npm command.

The app is Wake Engine. Loom, Rune, Echo, CPT, Next, wakecodex, and unrelated projects are not Wake Engine runtime agents, routes, modules, abilities, or product capabilities. Those words are allowed in guardrail documentation and user-provided source content. User content must never be rejected merely for mentioning them.

Wake Engine is the product/runtime name, not a forced content subject. Content generation is source-driven and topic-agnostic.

## Current Verdict

Phase 7 is complete and unblocked.

Final gate verdict:

- status: `pass`
- blocking failures: `0`
- warnings: `0`
- gate checks: `18`
- next phase allowed: `true`
- completed: `2026-07-14T18:20:22.682Z`

Authoritative machine-readable verdict:

`phase-audit/phase-00-gatekeeper/phase-verdict.json`

Do not call this state unfinished. Do not redo the completed phased work unless a new request changes it or a real regression is found.

## Final Acceptance Results

All required acceptance commands passed from the authorized repo:

- `npm run build` - passed
- `npm run smoke` - `22 passed, 0 failed`
- `npm run benchmark` - all 11 latency budgets passed
- `npm run gate` - passed with all 18 gate checks
- `npm run audit:ui` - `118 controls/actions verified`

UI audit screenshot:

`audit/ui-button-audit/wake-v6-electron-button-audit.png`

Phase artifacts:

`phase-audit/phase-00-gatekeeper/`

## User Non-Negotiables

- Do not reduce the requested scope.
- Do not replace working features with explanations.
- Do not add organizer-only theater where content creation is required.
- Do not restrict the content agents.
- Do not hardcode Wake as the topic, audience, CTA, proof, or content lane.
- Do not mix Aurora Storytime or any unrelated project into Wake Engine.
- Do not redesign or replace the operator login without an explicit request.
- Source documents must open as readable documents, not expose a filesystem path as the experience.
- The UI must stay action-oriented, usable, and uncluttered.
- Do not claim a capability is live unless the runtime and gates prove it.
- Do not use Git assumptions. This workspace is not being managed as a Git task, and the user did not ask for commits.

## Phase 0 - Truth And Drift Repair

Implemented:

- Local-only guard in `scripts/guard-local-workspace.mjs`.
- Forbidden runtime drift checks inspect runtime agent IDs, route names, module names, capability labels, and product documentation.
- Forbidden words in arbitrary user source content are not treated as poisoned content.
- Cloud/sync contamination is determined by provenance/path, not source wording.
- Cloud-origin records are quarantined from default retrieval.
- Valid local records remain available.
- Missing `claimMap` and packet-contract failures are gate failures.
- Honest Tier Zero status is documented in `TIER_ZERO_BUILD_STATUS.md`.

There is no separate canonical Tier Zero specification in the authorized repo. The user promoted these Wake Engine agents to Tier Zero and defined the local Tier Zero build parameters. Tier Zero claims in this app refer to those user-promoted parameters, not an invented external specification.

## Phase 1 - Universal Content Contract

Canonical contract:

- id: `wake-content-packet`
- version: `1.0.0`
- implementation: `CANONICAL_PACKET_CONTRACT` in `server/tier-zero-runtime.js`

Required packet sections include:

- source
- source profile
- evidence map
- citation map
- claim map
- hooks
- titles
- captions
- scripts
- platform variants
- creative direction
- visual prompts
- QA verdict
- next action
- A2A trace
- agent inbox
- agent outbox
- replayable handoffs
- tool trace
- export manifest

The same packet contract or trace-compatible summary is returned by the public APIs and consumed by current output, history, cluster, and export preview UI.

Universal smoke fixtures cover:

- restaurant
- fitness coach
- SaaS
- construction
- children's book
- local service
- Wake Engine input

Non-Wake inputs are checked for Wake-branded topic/audience/CTA/proof/lane drift. Weak source produces an explicit repair path instead of invented confidence.

## Phase 2 - Tier Zero Content Agent Runtime

Promoted Tier Zero agents:

- Archivist
- Strategist
- Scriptwriter
- Creative Director
- QA
- Export

Runtime implementation:

`server/tier-zero-runtime.js`

Enforced runtime behavior:

- per-agent contracts
- declared required tools
- actual local tool execution
- input/output tool receipts
- local memory reads and writes
- per-agent done gates
- blocker state on required failures
- recovery-attempt traces
- persisted run records
- packet completeness checks

Final audit result:

- agents: `6`
- tools: `27`
- A2A routes: `14`
- runtime violations: `0`

## Phase 3 - Persisted A2A Message Layer

A2A is persisted, not limited to in-call display receipts.

Message records carry:

- id
- run id
- producer
- consumer
- intent
- payload summary
- required acknowledgement
- status
- created timestamp
- consumed timestamp
- blocker

The runtime exposes agent inboxes, outboxes, replayable handoffs, acknowledgement state, and full traces. Missing acknowledgement, failed handoff, or unpersisted required message blocks completion.

A2A data is included in packet preview, history-compatible summaries, export bundles, and persisted run records.

## Phase 4 - Content Cluster And Export Bundle

The Content Cluster is a creation network, not organizer cards.

Cluster output includes:

- campaign packet
- platform lanes
- hooks
- titles
- captions
- scripts
- Shorts/Reels/TikTok lane
- YouTube lane
- LinkedIn lane
- carousel lane
- thumbnail prompts
- visual prompts
- quote/evidence pack
- distribution plan
- QA verdict
- next action
- A2A trace
- tool trace

Export bundles include:

- manifest
- source and source profile
- evidence and citations
- evidence map and citation map
- claim map
- scripts and platform variants
- creative direction
- visual prompts and production notes
- QA verdict
- next action
- A2A, agent, memory, and tool traces
- replayable handoffs
- clear absolute and repo-relative file paths
- JSON and Markdown output

Exports are inspected after writing. Missing required fields or invalid written files block smoke/gate. The UI provides export preview before/after export.

Important current boundary: the app creates production-ready thumbnail and visual prompts. It does not currently contain a real image-generation model or image-generation API route. Do not claim rendered image generation exists unless it is actually implemented and gated later.

## Phase 5 - Accuracy And Quality Gates

The QA rubric covers:

- source fidelity
- claim support
- specificity
- audience fit
- platform fit
- hook strength
- CTA fit
- non-generic wording
- repetition/title echo
- package completeness
- hallucination risk

Unsupported claims are blocked or explicitly marked unknown/not-enough-source. QA emits repair suggestions and the next best action. Generic packets fail. Weak source follows a repair path and cannot be exported as confident finished work.

## Phase 6 - UX, Chat, Speech, Voice, Boot, Next Steps

Ability pages are covered by UI contracts for:

- purpose
- input
- primary action
- visible output destination
- contextual section chat
- latest answer
- export/continue route
- next-step panel
- empty state
- error state

Chat behavior:

- immediate visible `Instant Local Draft`
- NDJSON streaming endpoint at `/api/agent-chat/stream`
- optional upgrade through local Ollama when available
- actual streamed token events
- latest answer promotion
- export and history persistence
- no silent send failure
- provider label uses the actual model only on the model path

Current local model bridge:

- Ollama endpoint discovery is local
- installed model during final acceptance: `llama3.2:3b`
- benchmark warms the installed model before measuring warm streamed-first-token latency

Speech and voice truth:

- STT uses `window.SpeechRecognition` or `window.webkitSpeechRecognition` when provided by the desktop/browser runtime.
- TTS uses installed system voices through `window.speechSynthesis` and `SpeechSynthesisUtterance`.
- voice selection and mute preference persist.
- no custom voice model is implemented.

Boot/login behavior:

- old-school operator login remains in place
- boot can be skipped and replayed
- boot does not block the application indefinitely
- voice/mute settings persist
- login currently requires a non-empty callsign and non-empty phrase; it does not validate one secret phrase
- acceptance tests use `WAKE` as the phrase

## Phase 7 - Performance And Final Gatekeeper

Benchmark script:

`scripts/benchmark-wake-v6.mjs`

Wired into:

`npm run gate`

Budgets and final measured values:

| Metric | Budget | Final measured |
| --- | ---: | ---: |
| server boot | 2500 ms | 7 ms |
| desktop boot | 6500 ms | 1516 ms |
| state load | 900 ms | 694 ms |
| source save | 900 ms | 634 ms |
| frame generation | 1300 ms | 613 ms |
| agent run | 1800 ms | 679 ms |
| cluster generation | 1600 ms | 728 ms |
| chat first visible response | 1600 ms | 658 ms |
| streamed first token | 7000 ms | 766 ms |
| export | 1300 ms | 729 ms |
| core UI interaction | 750 ms | 356 ms |

No-theater coverage includes:

- placeholder/fake-live product claims
- forbidden runtime agents/projects
- Wake-only output drift
- stale labels
- missing visible chat target
- missing benchmark wiring
- missing export inspection
- missing Tier Zero status disclaimer
- missing canonical packet contract
- missing persisted traces
- missing universal fixtures

The static product-claim scan intentionally excludes guard/test pattern definitions themselves while continuing to scan actual runtime and product surfaces.

## Public API Contracts

Required routes are active:

- `POST /api/run-agent`
- `POST /api/tier-zero/run`
- `POST /api/content-cluster`
- `POST /api/export`
- `GET /api/history`
- `GET /api/state`

Related routes include:

- `POST /api/agent-chat/stream`
- `GET /api/agent-chat/status`
- `GET /api/tier-zero/agents`
- `GET /api/tier-zero/audit`
- source, frame, intake, snapshot, system, and document-view routes

Responses expose the canonical packet or trace-compatible summaries, including contract/version metadata, completeness, QA/next-action state, and trace counts where applicable.

## Local Persistence

Primary local store:

`server/data/wake-v6-store.json`

Persisted collections include:

- projects
- sources
- generations
- exports
- snapshots
- history
- run records
- A2A messages
- replayable handoffs
- tool receipts
- memory receipts
- export inspections
- quarantine metadata

Exports:

`server/data/exports/`

Snapshots:

`server/data/snapshots/`

Cloud-origin records are excluded from normal retrieval after migration/quarantine. Valid local records are preserved.

## Source Document And Project Scoping Work

Implemented user-facing cleanup from the preceding work:

- source document rows open a readable document viewer instead of presenting only a path
- projects are scoped so unrelated project material is not mixed into the current project
- Aurora Storytime naming is preserved without an extra appended name
- intake defaults to the repo-local intake location rather than sweeping the laptop
- the main creation UI is action/output oriented instead of exposing every local file

These behaviors were exercised by the Electron UI audit, including opening a source document, confirming visible content, and sending that document into the creator.

## Important Files

- `CODEX_READ_ME_FIRST.md` - controlling repo and product law
- `CODEX_CONTINUE_THE_WORK.md` - pointer to this current handoff
- `TIER_ZERO_BUILD_STATUS.md` - Tier Zero authority and truth statement
- `server/tier-zero-spec-status.js` - runtime Tier Zero status metadata
- `server/tier-zero-runtime.js` - agents, tools, packet contract, A2A, memory, QA
- `server/index.js` - API, persistence, migration, cluster, export, chat
- `server/no-theater.js` - runtime truth audit
- `src/main.jsx` - application UI and shared packet preview behavior
- `src/app-config.jsx` - ability configuration
- `src/api.js` - client API and stream handling
- `scripts/smoke-wake-v6.mjs` - 22-check smoke suite
- `scripts/benchmark-wake-v6.mjs` - Phase 7 benchmark
- `scripts/wake-gatekeeper.mjs` - final blocking gate
- `scripts/ui-button-audit.mjs` - Electron/Playwright acceptance audit
- `scripts/install-wake-v6-local.ps1` - desktop and Start Menu shortcuts

## Current Runtime And Shortcut

At handoff time the development runtime was restarted and verified:

- UI: `http://127.0.0.1:5177/`
- API: `http://127.0.0.1:8786/`
- `/api/health`: healthy

Runtime logs:

- `runtime/dev.stdout.log`
- `runtime/dev.stderr.log`

Desktop shortcut was refreshed and verified:

`C:\Users\justi\Desktop\WAKE Engine V6.lnk`

Start Menu shortcut:

`%APPDATA%\Microsoft\Windows\Start Menu\Programs\WAKE Engine\WAKE Engine V6.lnk`

The shortcut launches the current repo through the installed Electron runtime. A running dev process is not guaranteed to survive reboot; the desktop shortcut remains the normal launch path.

## What Is Not Implemented Or Must Not Be Overclaimed

- No separate canonical Tier Zero specification exists in this repo.
- No custom/local STT model exists; speech recognition depends on runtime support.
- No custom voice model exists; TTS uses installed system speech synthesis.
- No real image generator exists; the content packet contains visual and thumbnail prompts.
- Hugging Face was not used to add or evaluate a new model in this phase.
- The operator phrase is currently a non-empty session gate, not a cryptographic credential.

These are truth boundaries, not permission to reduce already implemented agent, cluster, content, A2A, export, or QA functionality.

## Next-Agent Operating Instructions

1. Work only in the authorized repo.
2. Run `npm run guard:local` before editing.
3. Read the final verdict and relevant source before changing behavior.
4. Preserve all current passing contracts.
5. Do not rerun long gate suites repeatedly without a code change that requires them.
6. For a narrow future edit, run focused checks first and the full gate once at final acceptance.
7. Do not call a phase blocked unless a real current failure exists.
8. Do not overwrite this handoff with speculative status.

## Final Saved State

The phased implementation through Phase 7 is complete, validated, running locally, and represented by a passing final gate. The next instance should continue from this state, not reconstruct it and not reopen completed work as a planning exercise.
