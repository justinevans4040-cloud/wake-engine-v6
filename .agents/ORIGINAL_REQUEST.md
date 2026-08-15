# Original User Request

## Initial Request — 2026-08-15T18:56:00Z

Perform an exhaustive, adversarial, and hostile audit of the entire WAKE Engine V6 codebase and desktop application. Verify every single claim in documentation against actual code, test every UI button/contract, scan for all theater/mock data (such as fake social accounts or fake connection states), and audit every ability surface.

Working directory: C:\Users\justi\.gemini\antigravity\scratch\wake-engine-v6
Integrity mode: benchmark

## Requirements

### R1. Documentation vs. Code Truth Audit
- Cross-examine every single claim made across `README.md`, `ARCHITECTURE.md`, `KNOWN_LIMITATIONS.md`, `JUDGING_EVIDENCE.md`, and docs against the actual runtime implementations in `server/` and `src/`.
- Flag every discrepancy where documentation claims a feature that is stubbed, hardcoded, or non-functional.

### R2. Theater & Mock Data Purge Audit
- Audit all mock data, hardcoded accounts (e.g., `@wakeengine`, `@wake.engine`, `@WakeEngineHQ`), fake connection indicators, and simulated background processes.
- Identify all instances where UI displays "Connected" or "Active" without real backing infrastructure or user configuration.

### R3. Button, Route & Ability Contract Verification
- Audit every button, navigation route, tab, and command action across all 9 product surfaces (Console, Agents, Cluster, Vault, Library, Monitor, Audit, Automations/Scheduler, Review Queue).
- Identify dead buttons, broken event handlers, unhandled API rejections, or missing route contracts.

### R4. Durability, Security & Local Vault Verification
- Audit state persistence (`durable-storage.js`, atomic writes, write-ahead logging).
- Audit the credential vault to verify operating system protection boundaries (`safeStorage` / local vault) without committing secrets or plaintext tokens.

## Acceptance Criteria

### Truth & Theater Report
- [ ] Comprehensive breakdown mapping every documented claim to file/line implementation or proving it false/mocked.
- [ ] Complete inventory of all hardcoded mock accounts, simulated statuses, or placeholder feeds across `server/` and `src/`.

### Interactive Surface Audit
- [ ] Complete test matrix of all UI buttons, tabs, modals, and actions with pass/fail/dead status.
- [ ] Verification of all API endpoints in `server/index.js` and `server/scheduler.js`.

### Hostile Audit Verdict
- [ ] Formal emit of `HOSTILE AUDIT` summary block for every major subsystem with explicit failure count and `VERDICT: READY | NOT READY`.
