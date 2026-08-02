# WAKE Engine V6
## Local-First Content Operations Manual

WAKE Engine turns approved notes, transcripts, briefs, and local source files into structured, evidence-linked content packages. Its core workflow is deterministic and auditable; optional Ollama enhancement is used only when a configured local model is available.

![WAKE Engine User Interface](./wake-ui-screenshot.png)

## Getting started

1. Open WAKE Engine V6.
2. Enter the requested operator identifier.
3. Use the **Voice** control only when local desktop speech synthesis is desired.
4. Start in **Console** with pasted source material, or in **Vault** with an approved local folder.

## The next-step rule

1. No source yet: use **Console** or **Vault**.
2. Source loaded: generate a frame or run the content workflow.
3. Packet generated: inspect **Cluster** and the QA evidence.
4. Reusable workflow: configure **Automations**.
5. Finished work: review, export, and save an **Audit** snapshot.

## The nine product surfaces

### 1. Console

- Paste a task, note, transcript, brief, or source passage.
- Save the source.
- Generate a structured frame.
- Continue to Agents or Cluster.

A Console task is complete when the source is saved, the frame is generated, and the next action is visible.

### 2. Agents

- Run the six-stage workflow: Archivist → Strategist → Scriptwriter → Creative Director → QA → Export.
- Inspect evidence, citations, scripts, platform variants, visual direction, tool receipts, memory receipts, and handoffs.
- Use agent chat for questions about the current source.
- Promote an approved result into the saved project workflow.

The agent workflow is deterministic and auditable. It should not be described as six independent language models.

### 3. Cluster

- Review the completed content packet.
- Inspect hooks, scripts, captions, platform lanes, visual prompts, claim maps, evidence, and QA results.
- Export only after the packet passes review.

### 4. Vault

- Select an approved local folder or removable drive.
- Run intake.
- Search and load source material without losing provenance.

Only local, operator-selected sources should be used. Do not point Vault at folders containing unrelated private material.

### 5. Library

- Browse saved sources, generations, exports, and history.
- Resume prior work.
- Locate exported Markdown and JSON packages.

### 6. Instructions

- Describe the operation you need to perform.
- WAKE returns a step-by-step workflow using current product features.
- When a local Ollama model is available, it may improve the explanation.
- Without Ollama, WAKE returns a deterministic runbook instead of inventing features.

### 7. Automations

Configure:

- Automation name
- Source folder
- Five-field cron schedule
- Timezone
- Operator instruction
- Approval mode
- Export folder

The scheduler checks once per minute and supports `.txt`, `.md`, and `.json` source files. It hashes the combined source and skips unchanged scheduled runs.

#### Review Required

The completed packet is placed into the review queue. This is the recommended mode for content intended for external publication.

#### Automatic Export

WAKE writes two files to the selected export directory:

- A readable Markdown package
- A complete JSON packet with evidence, claims, receipts, QA, and metadata

Manual **Run now** requests reuse the queued run record rather than creating a duplicate. Missing folders, unsupported source files, pipeline failures, and export failures are recorded as failed runs with error details.

Scheduled execution currently uses the deterministic Tier Zero workflow. It does not claim to run the optional Ollama enhancement inside the scheduler.

### 8. Monitor

- Inspect runtime health.
- Review task and capability states.
- Confirm which capabilities are live, partial, blocked, external, or unavailable.
- Use the truth labels rather than assuming every planned feature is active.

### 9. Audit

- Save a snapshot after meaningful work.
- Inspect durable-state receipts and history.
- Use backup and restore controls where available.

WAKE uses atomic writes and write-ahead logging for tested recovery scenarios. This improves durability but is not a claim that data loss is impossible under every hardware failure.

## Standard workflow

1. Load approved source material in Console or Vault.
2. Generate the source frame.
3. Run the agent workflow.
4. Inspect evidence and claim mappings.
5. Resolve any QA blockers.
6. Review the final packet in Cluster.
7. Export Markdown and JSON.
8. Save an Audit snapshot.
9. For recurring work, configure an Automation using Review Required.

## Verification commands

Portable checks:

```powershell
npm run build
npm run audit:runtime
npm run audit:scheduler
```

Windows and local durability checks:

```powershell
npm run smoke
npm run benchmark
npm run gate
npm run audit:wal
npm run audit:phase9
npm run audit:ui
```

## Current boundaries

- Automatic social publishing is not implemented.
- Ollama is optional and availability-dependent.
- Scheduled source intake currently supports `.txt`, `.md`, and `.json`.
- Dependency installation may require network access to npm.
- Human review is recommended before public distribution.
- WAKE must run from a local, non-cloud-synchronized checkout.
