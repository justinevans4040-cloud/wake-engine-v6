# WAKE Engine V6 — Hackathon Submission Brief

## One-line pitch

WAKE Engine converts approved local notes, transcripts, briefs, and documents into evidence-linked content packages, blocks unsupported claims, preserves audit receipts, and recovers safely from interrupted writes.

## The problem

Creators, operators, and small teams often hold valuable source material in local folders but lack a dependable way to turn it into publishable campaigns without uploading private material, losing provenance, accepting fabricated claims, or risking work loss during interrupted processing.

## The solution

WAKE provides a Windows desktop workflow that:

1. accepts operator-approved local source material;
2. extracts evidence and citation records;
3. produces strategy, hooks, titles, captions, scripts, platform variants, and visual direction;
4. maps generated claims back to source evidence;
5. blocks unsupported wording at a QA gate;
6. places completed packets into a pending review queue or, as a separate Auto Export disposition, writes Markdown and JSON after QA passes;
7. records tool calls, agent handoffs, memory receipts, history, and recovery evidence.

## Why this is useful

WAKE is not evaluated by how many agents it claims to have. It is evaluated by whether a user can complete a real content-production job while retaining control of source data and inspecting how the output was produced.

The useful outcome is a reviewable content package with:

- source passages;
- citation mapping;
- claim status;
- multi-platform output;
- QA verdict;
- operator next action;
- readable Markdown export;
- complete machine-readable JSON export;
- audit and durability receipts.

## Implemented workflow

`Source intake → Archivist → Strategist → Scriptwriter → Creative Director → QA → Pending Review Queue / Auto Export`

The workflow is deterministic and auditable. Optional Ollama enhancement is separate and availability-dependent. WAKE does not claim that six independent language models are running.

## Main technical features

- React and Vite desktop interface
- Electron Windows runtime
- Express loopback API
- deterministic six-stage content workflow
- evidence and citation maps
- source-backed claim validation
- human review queue
- five-field cron scheduler with timezone support
- unchanged-source hashing and duplicate suppression
- Markdown and JSON export
- atomic state writes and write-ahead logging
- recovery, rollback, backup, and bounded history
- Electron `safeStorage` credential handling
- session, origin, and CSRF protections
- Windows NSIS installer with SHA-256 checksum
- Linux portable verification and Windows installer CI
- full-history secret scan and production dependency audit

## Reproducible evaluation

1. Download the Windows installer artifact from the latest successful CI run or a tagged release.
2. Verify the installer against `SHA256SUMS.txt`.
3. Install and launch WAKE Engine V6.
4. Load `examples/proof-of-usefulness-source.md` or paste its contents into Console.
5. Run the content workflow.
6. Inspect evidence, citations, claim mapping, output lanes, QA status, and receipts.
7. Send a scheduled packet to Review Required and inspect the pending review item and generated packet.
8. Use a separate Auto Export automation with a QA-passing packet to produce Markdown and JSON.
9. Run the same unchanged folder again and confirm duplicate suppression.
10. Inspect Monitor and Audit for runtime and durability evidence.

The exact presentation sequence is in [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

## Verification commands

Portable checks:

```powershell
npm ci
npm run verify:portable
```

Windows packaging:

```powershell
npm run package:installer
```

Extended local checks:

```powershell
npm run smoke
npm run benchmark
npm run audit:wal
npm run audit:phase9
npm run audit:ui
```

## Evidence

See [JUDGING_EVIDENCE.md](JUDGING_EVIDENCE.md) for the evidence matrix and direct repository locations.

## Honest capability boundaries

- No automatic social publishing is implemented.
- Scheduler input is currently limited to `.txt`, `.md`, and `.json`.
- Initial dependency installation requires npm access unless packages are cached.
- Ollama is optional and is not used by the deterministic scheduler path.
- Review Required creates a pending review queue item for inspection; persisted approve/reject/return/approve-and-export decisions are not implemented yet.
- Recovery tests cover documented interruption cases; they do not guarantee survival of every possible hardware failure.
- The source is available for evaluation under the repository's proprietary license, not an open-source license.

## Best-fit competition framing

### Proof of Usefulness

Lead with the completed user job: private local source becomes an evidence-linked packet that can be inspected in a pending review queue or automatically exported as Markdown and JSON, with measurable receipts.

### Decentralized AI

Lead with local ownership, loopback execution, optional local models, inspectable provenance, credential isolation, a human review queue with explicit operator authority, and reduced dependency on centralized cloud generation.

## Ownership

Created by Justin Evans under ForgeFront Systems.
