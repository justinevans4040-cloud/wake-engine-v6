<div align="center">
  <h1>WAKE Engine Omega</h1>
  <p><strong>The local command console. Specialized tools underneath — not a fake all-in-one autopilot.</strong></p>
</div>

[![WAKE Engine CI](https://github.com/justinevans4040-cloud/wake-engine-v6/actions/workflows/ci.yml/badge.svg)](https://github.com/justinevans4040-cloud/wake-engine-v6/actions/workflows/ci.yml)
[![Windows Installer](https://github.com/justinevans4040-cloud/wake-engine-v6/actions/workflows/release.yml/badge.svg)](https://github.com/justinevans4040-cloud/wake-engine-v6/actions/workflows/release.yml)

**Omega** is Justin’s WAKE command console: one local workbench that turns approved notes, transcripts, and docs into evidence-linked content packets with durable state and an inspectable audit trail.

Tools are parsed out under Omega — each with an honest boundary:

| Tool | What you sell | Honest limit |
|---|---|---|
| Tier Zero Agent Runtime | Source-bound multi-agent packet production | Deterministic orchestration + optional Ollama — not six cloud LLMs |
| Vault Intake | Folder + SEED review before import | Text/docs/media metadata — not universal binary OCR |
| Content Cluster | Pillars, lanes, hooks, export packs | Local packets — not guaranteed virality |
| Hook Angle Matrix | Five psychological hook angles | Heuristic creative comparison — not live retention data |
| Local Voiceover | Real on-device voice + subtitles | Windows SAPI (optional remote neural endpoint) |
| Vertical Reel Renderer | Real 9:16 MP4 via FFmpeg | Needs FFmpeg + real audio — no JSON-as-MP4 |
| Retention Simulator | Pre-export script scoring | Heuristic QA — not live platform analytics |
| Automation Scheduler | Local cron → review/export | Does not post to social networks |
| Manual Publish Stage | Stage packets for human posting | Direct social APIs are not implemented |
| Durable Local Store | Atomic writes + WAL + backups | Local disk resilience — still back up offsite |

Manifest: `GET /api/omega` and `GET /api/omega/tools`.

![WAKE Engine interface](docs/wake-engine/wake-ui-screenshot.png)

## Why it is useful

Creators and small teams often have valuable source material scattered across local folders. Generic generation tools can produce copy quickly, but they may lose provenance, invent claims, require cloud uploads, and provide no reliable recovery path when a process is interrupted.

WAKE Omega provides one local workflow:

1. Load or paste approved source material.
2. Extract evidence and citations.
3. Build strategy, scripts, hooks, captions, platform variants, and visual direction.
4. Map generated claims back to source evidence.
5. Block unsupported claims at the QA gate.
6. Place scheduled output into a pending review queue or, when configured for Auto Export and QA passes, write Markdown and JSON.
7. Preserve receipts, history, snapshots, and durable local state.
8. Hand media/export tools real files when the operator wants voice or reels — then publish manually.

## What is implemented

| Capability | Current behavior | Verification |
|---|---|---|
| Local source intake | Reads pasted source and approved local folders | Console, Vault, `/api/sources`, `/api/frame` |
| Deterministic agent workflow | Archivist → Strategist → Scriptwriter → Creative Director → QA → Export | `npm run audit:runtime` |
| Evidence-linked claims | Maps script claims to extracted source evidence and blocks unsupported wording | Tier Zero QA packet |
| Scheduled processing | Runs enabled or manually forced folder workflows and skips unchanged source hashes | `npm run audit:scheduler` |
| Review queue | Stores Review Required packets as a pending review item and exposes the generated packet for inspection; it does not yet persist approve/reject decisions | Automations page + hostile UI audit |
| Local export | Writes readable Markdown plus the complete JSON packet | Scheduler export audit |
| Durable state | Atomic writes, write-ahead logging, replay, rollback, and backup bundles | `npm run audit:phase9` |
| Local security | Loopback API, session and CSRF checks, Electron `safeStorage` credential vault | Phase 9 evidence |
| Windows desktop application | Electron application and NSIS installer configuration | `npm run package:installer` |

## Judge and submission package

- [Hackathon submission brief](SUBMISSION.md)
- [Two-minute demonstration script](DEMO_SCRIPT.md)
- [Judging evidence matrix](JUDGING_EVIDENCE.md)
- [Architecture and trust boundaries](ARCHITECTURE.md)
- [Instruction Manual (operator path)](docs/INSTRUCTION_MANUAL.md)
- [Document version stamps](docs/VERSION.md)
- [Known limitations](KNOWN_LIMITATIONS.md)
- [Security policy](SECURITY.md)

## Windows installer

Every successful `master` build creates a Windows NSIS installer and `SHA256SUMS.txt` as GitHub Actions artifacts. Tagged versions beginning with `v` also publish those files to GitHub Releases.

- [Latest CI runs and installer artifacts](https://github.com/justinevans4040-cloud/wake-engine-v6/actions/workflows/ci.yml)
- [Tagged releases](https://github.com/justinevans4040-cloud/wake-engine-v6/releases)

## Instruction Manual

**Day-to-day clicks:** [docs/INSTRUCTION_MANUAL.md](docs/INSTRUCTION_MANUAL.md)

**Sales / leave-behind (striking brief):** open [docs/WAKE_OMEGA_PROFESSIONAL.html](docs/WAKE_OMEGA_PROFESSIONAL.html) in a browser (Ctrl+P to print/PDF).

Older manuals under `docs/` are retired stubs that only redirect to the Instruction Manual.

## Quick start

### Requirements

- Windows 10 or Windows 11
- Node.js 20 or newer
- npm
- Optional: Ollama for interactive local-model enhancement

### Run from source

```powershell
git clone https://github.com/justinevans4040-cloud/wake-engine-v6.git
cd wake-engine-v6
npm install
npm run build
npm run desktop
```

WAKE must be run from a local, non-cloud-synchronized checkout. The workspace guard rejects OneDrive, Dropbox, Google Drive, and iCloud paths but no longer depends on a developer-specific folder.

### Build the Windows installer

```powershell
npm run package:installer
```

The installer output is written under `release/`.

## Product workflow

### Console

Paste a brief, transcript, note, or task. Save it and generate the structured source frame.

### Agents

Run the deterministic six-stage content workflow. The output includes evidence, citations, strategy, scripts, platform variants, visual prompts, tool receipts, memory receipts, agent handoffs, and QA results.

### Cluster

Review the complete campaign packet and its output lanes.

### Vault and Library

Load approved local material, recover prior work, and inspect exports and history.

### Instructions

Ask how to complete an operation using only features that currently exist in WAKE. When a configured local Ollama model is unavailable, WAKE returns a deterministic runbook rather than inventing a capability.

### Automations

Configure a source folder, schedule, timezone, operator instruction, approval mode, and export directory.

The scheduler:

- Checks once per minute.
- Supports standard five-field cron expressions, including lists, ranges, and steps.
- Processes `.txt`, `.md`, and `.json` source files.
- Hashes the combined source and skips unchanged scheduled runs.
- Reuses manual queued run records instead of creating duplicates.
- Sends `Review Required` output to the review queue.
- Writes both Markdown and JSON for automatic export.
- Records failures and completion receipts in history.

Scheduled execution currently uses the deterministic Tier Zero workflow. It does not claim that the optional Ollama enhancement runs inside the scheduler.

### Monitor and Audit

Inspect runtime truth labels, tasks, system state, snapshots, and durability receipts.

## Verification

Run the portable checks:

```powershell
npm run build
npm run audit:runtime
npm run audit:scheduler
```

Run the Windows/local durability checks:

```powershell
npm run smoke
npm run benchmark
npm run gate
npm run audit:wal
npm run audit:phase9
npm run audit:ui
```

GitHub Actions runs the portable build, runtime-contract audit, and scheduler audit on pushes and pull requests.

## Proof already in the repository

- `evidence/phase-audit/phase-09-durability-security/phase9-verdict.json`
- `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md`
- `docs/current/TIER_ZERO_BUILD_STATUS.md`
- `docs/current/WAKE_ENGINE_MAP.md`
- `docs/INSTRUCTION_MANUAL.md`
- `archive/iterations/`

The Phase 9 evidence includes atomic storage, crash recovery, backup and restore, package-data exclusion, credential handling, loopback binding, authentication, and CSRF checks. Historical evidence is retained separately from current product claims.

## Accurate capability boundaries

- The content-agent workflow is deterministic and auditable. It should not be described as six independent language models.
- Ollama enhancement is optional and availability-dependent.
- Automatic social publishing is not implemented.
- Supported scheduled source files are currently `.txt`, `.md`, and `.json`.
- WAKE is local-first, but installing dependencies initially requires access to npm unless dependencies are already cached.
- Recovery testing proves the documented interruption cases; it is not a claim that data loss is impossible under every hardware failure.
- Review Required creates a pending review item for inspection; the current queue does not yet persist approve/reject/return/approve-and-export decisions.

## Proof of Usefulness demonstration

A judge can evaluate WAKE with one ordinary source folder:

1. Add a short business or creator brief.
2. Run the workflow.
3. Inspect evidence and citation maps.
4. Review scripts and platform variants.
5. Confirm unsupported claims are blocked.
6. Send a scheduled packet to Review Required and open the pending review item.
7. Use a separate QA-passing Auto Export automation to produce and open Markdown and JSON.
8. Inspect the audit receipt.
9. Run the same unchanged source again and confirm it is skipped.

Useful measurements include source files processed, evidence passages extracted, claims reviewed, unsupported claims blocked, tool receipts recorded, export artifacts created, execution time, and recovery-test results.

## Architecture

- React 18 and Vite 6 interface
- Electron 43 Windows desktop runtime
- Express loopback server
- Deterministic Tier Zero content workflow
- Optional local Ollama enhancement
- Atomic JSON state with write-ahead logging
- Electron `safeStorage` provider credential vault
- Markdown and JSON exports

## License

WAKE Engine Omega is source-available for evaluation under the repository's [proprietary license](LICENSE). Copyright © 2026 ForgeFront Systems and Justin Evans. All rights reserved.
