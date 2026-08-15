# Orchestration Plan — WAKE Engine V6 Hostile Audit

## Objective
Execute an exhaustive, adversarial, and hostile audit of WAKE Engine V6 codebase and desktop application across all 4 requirements in ORIGINAL_REQUEST.md, producing Truth & Theater Report, Interactive Surface Audit, and Hostile Audit Verdict.

## Milestones & Workflow Phases

### Phase 0: Survey & Scope Mapping
- **Action**: Dispatch 3 parallel Explorers/Spec Miners:
  1. `explorer_survey_docs`: Analyze all documentation files (`README.md`, `ARCHITECTURE.md`, `KNOWN_LIMITATIONS.md`, `JUDGING_EVIDENCE.md`, docs/) and catalog every claim, feature assertion, and architecture statement.
  2. `explorer_survey_server`: Analyze `server/` codebase (`server/index.js`, `server/scheduler.js`, `server/durable-storage.js`, vault/storage, background jobs, all API routes and abilities).
  3. `explorer_survey_ui`: Analyze `src/` codebase (all 9 product surfaces: Console, Agents, Cluster, Vault, Library, Monitor, Audit, Automations/Scheduler, Review Queue; all buttons, tabs, forms, event handlers, mock feeds, hardcoded handles).
- **Deliverable**: Synthesize into `PROJECT.md` with Feature/Claim Inventory, 9 Surface Matrix, Mock Data Inventory, and Durability/Security Inventory.

### Phase 1: Deep Adversarial Audit & Verification
- **Track 1 (R1 - Doc vs Code Truth)**: Map every single documentation claim to file/line implementation or prove false/mocked/stubbed.
- **Track 2 (R2 - Theater & Mock Data Purge)**: Identify every hardcoded account (`@wakeengine`, `@wake.engine`, `@WakeEngineHQ`, etc.), fake connection indicator ("Connected"/"Active" without real backing infrastructure/config), simulated process/feed.
- **Track 3 (R3 - Button, Route & Ability Contract Verification)**: Exhaustively test/audit every button, tab, modal, action across all 9 surfaces and all API routes in `server/index.js` and `server/scheduler.js`.
- **Track 4 (R4 - Durability, Security & Local Vault)**: Audit `durable-storage.js`, atomic writes, write-ahead logging, `safeStorage`, OS protection boundaries, token management.

### Phase 2: Challenger & Forensic Auditor Verification
- Dispatch `teamwork_preview_challenger` and `teamwork_preview_auditor` to empirically stress-test and perform forensic verification of claims, checking for edge cases, silent failures, unhandled rejections, and security flaws.

### Phase 3: Synthesis & Final Verdict
- Synthesize all findings into:
  1. Truth & Theater Report
  2. Interactive Surface Audit Matrix
  3. Durability & Security Audit
  4. Hostile Audit Verdict summary block per subsystem with failure count and `VERDICT: READY | NOT READY`.
- Transmit final completion handoff to parent.
