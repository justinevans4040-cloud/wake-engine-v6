# WAKE Engine — Known Limitations

This document defines the current boundary of the product so judges and users can distinguish implemented behavior from roadmap ideas.

## Current limitations

### Platform

- The packaged desktop target is Windows 10 and Windows 11 on x64.
- Linux CI verifies portable build and deterministic audits, not the packaged desktop application.
- macOS packaging is not implemented.

### Installation

- Building from source requires Node.js and npm.
- A fully offline first-time dependency installation is not provided.
- The Windows installer is unsigned unless a separate trusted code-signing certificate is configured.
- Windows may display a SmartScreen warning for an unsigned installer.

### Source intake

- Scheduled folder intake supports `.txt`, `.md`, and `.json` files.
- Binary documents, PDFs, images, audio, and video are not automatically parsed by the scheduler.
- Operators are responsible for selecting material they are authorized to process.

### Content workflow

- The six-stage workflow is deterministic orchestration, not six independent language models.
- Optional Ollama enhancement depends on a separately installed and available local model.
- The scheduler currently uses the deterministic workflow and does not invoke Ollama.
- Automatic posting to social networks is not implemented.
- Human review is recommended before external publication. The current review queue is inspection-only: it exposes the generated packet but does not persist approve/reject/return/approve-and-export decisions.

### QA and evidence

- Evidence mapping reduces unsupported output but cannot establish the truth of inaccurate source material.
- A source-backed claim means the wording is supported by the supplied source, not that an independent fact-check verified the source.
- The deterministic workflow may produce less stylistic variation than a connected language model.

### Durability

- Atomic writes, WAL, replay, recovery, rollback, and backup controls cover documented test cases.
- They do not guarantee recovery from every disk failure, filesystem corruption, malware incident, power event, or operator deletion.
- Backup files stored on the same physical drive do not protect against complete drive loss.

### Security

- WAKE is not designed as a public internet service.
- Loopback binding does not protect against malware or a compromised local Windows account.
- Electron `safeStorage` security depends on the operating system and current user account.
- Repository scanning can detect known secret patterns but cannot mathematically prove that no sensitive information exists.

### Release and support

- The current release line is branded **WAKE Engine Omega** (no version number in the product UI). Doc stamps live in [`docs/VERSION.md`](docs/VERSION.md).
- Historical files under `archive/` are retained for provenance and are not supported production versions.
- The repository is source-available for evaluation under a proprietary license; it is not open source.

## Roadmap items that must not be described as current features

- automatic social publishing;
- mobile applications;
- macOS package;
- cloud collaboration service;
- multi-user permission administration;
- arbitrary PDF, image, audio, and video ingestion by the scheduler;
- guaranteed zero data loss;
- guaranteed zero hallucinations;
- six independent autonomous language-model agents;
- unattended external publication without human authority;
- persisted approve/reject/return/approve-and-export review decisions (planned Review workspace functionality).
