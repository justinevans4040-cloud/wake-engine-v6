# WAKE Engine V6 — Specification & Documentation Claims Audit Matrix

**Auditor:** Specification Miner (`teamwork_preview_spec_miner`)  
**Phase:** Phase 0 — Exhaustive Documentation Mining & Claim Extraction  
**Date:** 2026-08-15  
**Target Repository:** `C:\Users\justi\.gemini\antigravity\scratch\wake-engine-v6`  

---

## Executive Summary & Source Hierarchy

An exhaustive audit of all documentation across the WAKE Engine V6 codebase reveals **two competing tiers of documentation**:

1. **The Conservative "Gated & Verified" Submission Baseline**:
   - `README.md`, `ARCHITECTURE.md`, `KNOWN_LIMITATIONS.md`, `JUDGING_EVIDENCE.md`, `SECURITY.md`, `SUBMISSION.md`, `DEMO_SCRIPT.md`, `docs/wake-engine/wake_engine_manual.md`, `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md`, `docs/current/TIER_ZERO_BUILD_STATUS.md`, and `docs/current/WAKE_ENGINE_MAP.md`.
   - *Core Narrative:* WAKE is a local-first, crash-resilient workbench. Content generation is a deterministic 6-stage pipeline (Archivist → Strategist → Scriptwriter → Creative Director → QA → Export) rather than autonomous LLMs. Review Required places items into an inspection-only pending review queue without persisting approve/reject decisions. Auto Export writes Markdown + JSON only if QA passes. Automatic social publishing and arbitrary video/audio intake are explicitly not implemented.

2. **The "High-Claim / Extended Studio" Manuals & Specialized Modules**:
   - `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md` (v6.4.0 Enterprise Desktop Edition), `docs/wake_engine_manual.md`, and specialized server modules (`server/transmutation-studio.js`, `server/voiceover-engine.js`, `server/waveform-engine.js`, `server/video-engine.js`, `server/git-ingest.js`, `server/trend-analyzer.js`, `server/social-publisher.js`, `server/folder-watcher.js`, `server/semantic-memory.js`).
   - *Core Narrative:* Claims 1-Click GitHub repository cloning with PAT, competitor viral trend reverse-engineering, 1-click transmutation to 5 distribution formats, neural TTS voiceover synthesis with Windows voices, 6 animated audio spectrum waveforms, subtitle generation (.srt/.vtt), local FFmpeg 1080x1920 video rendering, dropzone watchers, outbound webhooks to n8n/Make.com, semantic vector search, and a direct social publishing queue.

---

## 1. Architectural & Subsystem Claims

| # | Subsystem / Component | Verbatim / Near-Verbatim Claim | Exact Citation | Verification / Implementation Status |
|---|---|---|---|---|
| A1 | **Electron Desktop Shell** | "starts the local application; provides Windows desktop integration; exposes operating-system credential protection through Electron `safeStorage`; packages through `electron-builder` and NSIS." | `ARCHITECTURE.md:32-37`, `README.md:192` | Verified via NSIS config in `package.json:52-80`, `electron/main.js` |
| A2 | **React + Vite Interface** | "React 18 and Vite 6 interface... exposes nine product surfaces: Console, Agents, Cluster, Vault, Library, Instructions, Automations, Monitor, Audit" | `ARCHITECTURE.md:39-52`, `README.md:191` | Verified via `src/main.jsx`, `src/app-config.jsx:17-27` |
| A3 | **Express Loopback API** | "The application server binds to loopback rather than a public interface; state-changing browser requests require authenticated session and CSRF protections; provider credentials use Electron safeStorage... binds locally rather than exposing a public network service (127.0.0.1)" | `ARCHITECTURE.md:53-58`, `SECURITY.md:24-26`, `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:48-53` | Enforced in `server/index.js`, verified in `scripts/phase9-durability-security.mjs:183-185` |
| A4 | **Deterministic Tier Zero Pipeline** | "Deterministic agent workflow: Archivist → Strategist → Scriptwriter → Creative Director → QA → Export... Each stage has explicit contracts, tool receipts, memory records, and agent-to-agent handoffs. This is a deterministic orchestration pipeline, not a claim that six independent language models are operating." | `ARCHITECTURE.md:59-66`, `README.md:32, 165`, `TIER_ZERO_BUILD_STATUS.md:3-7` | Enforced in `server/tier-zero-runtime.js`, audited via `scripts/runtime-contract-audit.mjs` |
| A5 | **5-Field Cron Scheduler** | "evaluates standard five-field cron schedules once per minute; supports timezones, ranges, lists, and steps; reads `.txt`, `.md`, and `.json` files from an approved source folder; hashes source content to suppress unchanged duplicate runs; routes passing packets to Review Required or automatic export; writes readable Markdown and complete JSON" | `ARCHITECTURE.md:67-76`, `README.md:112-122` | Implemented in `server/scheduler.js`, verified via `scripts/scheduler-audit.mjs` |
| A6 | **Durable Storage & WAL** | "Atomic JSON state with write-ahead logging; atomic file replacement; write-ahead logging; replay and recovery; rollback and backup bundles; bounded scheduler, review, and history collections." | `ARCHITECTURE.md:77-84`, `README.md:196`, `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:8-19` | Implemented in `server/durable-storage.js`, tested across 61 crash boundaries in `scripts/wal-crash-audit.mjs` |
| A7 | **Trust Boundary 1 (Source Input)** | "WAKE processes source selected or pasted by the operator. Source text is untrusted data and must not be treated as executable instructions outside the defined content workflow." | `ARCHITECTURE.md:87-90` | Documented design constraint |
| A8 | **Trust Boundary 2 (Loopback API)** | "The API is intended for the local desktop application. Binding, session, origin, and CSRF controls reduce exposure to unrelated browser pages and remote clients." | `ARCHITECTURE.md:91-94`, `SECURITY.md:24-25` | Implemented in `server/local-session.js`, `server/index.js` |
| A9 | **Trust Boundary 3 (Credentials)** | "Credentials are stored through the operating-system-backed Electron provider where available. Credentials are not meant to be committed, exported with campaigns, or written to logs." | `ARCHITECTURE.md:95-98`, `SECURITY.md:26`, `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:68-72` | Implemented in `electron/secure-vault.js` |
| A10 | **Trust Boundary 4 (QA & Publication)** | "Generated material is not automatically equivalent to approved content. QA controls automatic-export eligibility. Review Required creates a Pending Review Queue item for human inspection; current V6 does not persist approve/reject/return/approve-and-export decisions in that queue." | `ARCHITECTURE.md:99-102`, `KNOWN_LIMITATIONS.md:32-33`, `README.md:35, 171` | Enforced in `server/scheduler.js`, `scripts/claim-truth-audit.mjs:22-56` |
| A11 | **Trust Boundary 5 (Model Provider)** | "Ollama enhancement is optional. Provider availability does not determine whether the deterministic scheduler and audit pipeline work. The scheduler does not claim to run Ollama." | `ARCHITECTURE.md:103-106`, `README.md:123, 166` | Implemented in `server/chat-profiles.js`, `src/api.js` |
| A12 | **Trust Boundary 6 (Hardware & Interruption)** | "Atomic writes and WAL improve resilience against documented interruption cases. They do not protect against every storage-device failure, malware infection, hostile administrator, or physical compromise." | `ARCHITECTURE.md:107-110`, `KNOWN_LIMITATIONS.md:41-45` | Documented truth boundary |
| A13 | **Transmutation Studio Subsystem** | "From any single source document, the Transmutation Studio instantly generates 5 distribution-ready formats: 9:16 Reel, X Thread, LinkedIn, IG Carousel, Email Brief. Export Location: server/data/exports/omnichannel_<timestamp>/" | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:245-265` | Code present in `server/transmutation-studio.js` |
| A14 | **Neural Voiceover & Video Subsystem** | "Synthesizes clean audio narration locally using Windows System TTS voices (David, Mark, Zira, Neural)... Generates 6 animated visualizer styles... Generates synchronized .srt and .vtt... Local FFmpeg 1080x1920 Reel Renderer combines voice audio, animated waveforms, background visuals, and burned-in subtitles into an MP4 video file." | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:268-275` | Present in `server/voiceover-engine.js`, `server/waveform-engine.js`, `server/video-engine.js` (Note: conflicts with `KNOWN_LIMITATIONS.md:66`) |
| A15 | **Folder Watcher & Webhooks Subsystem** | "Dropzone Watchers: Monitors local folders (e.g. C:\Users\justi\wake-dropzone). Dropping any file automatically triggers intake. Outbound Webhooks: Automatically dispatches completed content packets to n8n, Make.com, or custom webhooks." | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:279-282` | Present in `server/folder-watcher.js` |
| A16 | **Semantic Memory Subsystem** | "IP vault inventory with semantic vector search... Supports hybrid dense-sparse embeddings, cosine similarity search, semantic chunking, and durable vector indexing." | `WAKE_ENGINE_MAP.md:6`, `server/semantic-memory.js:5-7` | Present in `server/semantic-memory.js` (Note: conflicts with `KNOWN_LIMITATIONS.md:64`) |

---

## 2. Functional & Ability Surface Claims (All 9 Surfaces)

### Surface 1: Console (Workbench / Autopilot)
- **Primary Mission**: "Turn a messy ask, task, brief, transcript, note, or code request into a structured source frame." (`src/app-config.jsx:34`, `docs/wake-engine/wake_engine_manual.md:25-33`).
- **Autopilot Creation**: "Campaign Autopilot: Analyzes project memory + direction to build 4 platforms (TikTok, Instagram, X/Twitter, LinkedIn)." (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:65-86`, `archive/iterations/CODEX_HANDOFF_2026-07-16_AUTONOMY_PHASE7.md:9-14`).
- **Voice Dictation**: `🎙️ Speak Direction` button for state goal via speech-to-text; `Dictate Source` for spoken notes (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:77, 235-236`).
- **Original Image Generation**: "Generate Original Visual to render custom aspect-ratio imagery locally via Flux / Diffusion... or explicit-provider support (Hugging Face / OpenAI) with one-time in-app consent." (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:104`, `archive/iterations/CODEX_HANDOFF_2026-07-16_AUTONOMY_PHASE7.md:13-14`).
- **Output Lanes & Actions**: Copy platform output, save source, export bundle (`MD + JSON` with SHA-256 integrity hash) to `server/data/exports/` (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:96, 105`).
- **Done When Criteria**: `["source is saved", "frame is generated", "next ability is obvious"]` (`src/app-config.jsx:40`).

### Surface 2: Agents (Tier Zero 6-Stage Autonomous Pipeline)
- **Primary Mission**: "Interrogate the current source with specialized content agents and retrieve relevant local context." (`src/app-config.jsx:46`, `docs/wake-engine/wake_engine_manual.md:34-42`).
- **Stage Breakdown**:
  - `Stage 01 (Archivist)`: Temperature 0.1, parses source line by line, zero hallucination tolerance, verbatim quotes with line number tracking (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:115, 130`).
  - `Stage 02 (Strategist)`: Temperature 0.3, core promise, transformation tension, 4 target angles, 8 hooks (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:116, 131`).
  - `Stage 03 (Scriptwriter)`: Temperature 0.4, 4-part timed scene beats: `0:00-0:03` Hook, `0:03-0:15` Proof, `0:15-0:45` Actionable Value, `0:45-1:00` CTA (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:117, 132-136`).
  - `Stage 04 (Creative Director)`: Cinematic diffusion prompts, focal subject, lighting composition, aspect ratio recommendations (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:125, 137`).
  - `Stage 05 (QA Gate Verifier)`: Scans 100% of generated script lines against Archivist's verbatim quotes; blocks unverified claims (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:124, 138`).
  - `Stage 06 (Export Manifest)`: Packages verified outputs into durable Markdown, structured JSON, and image manifests with cryptographic hashes (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:123, 139`).
- **Streaming Chat & Promotion**: NDJSON streaming endpoint (`/api/agent-chat/stream`), instant local draft, optional Ollama upgrade, `Promote Output` button to convert agent response into official project export (`archive/iterations/CODEX_HANDOFF_2026-07-14.md:271-280`, `docs/wake-engine/wake_engine_manual.md:39`).
- **Done When Criteria**: `["answer is source-backed", "context is cited", "output can be exported or clustered"]` (`src/app-config.jsx:52`).

### Surface 3: Cluster (Omnichannel Content Studio & Scene Beats)
- **Primary Mission**: "Organize the current source into content pillars, output lanes, proof notes, and handoff drafts." (`src/app-config.jsx:58`, `docs/wake-engine/wake_engine_manual.md:43-48`).
- **Platform Matrix**: 4 platform lanes (TikTok, Instagram, X/Twitter, LinkedIn), 6 timed script scene beats, 6 confirmed source citations in verbatim trace (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:148-164`, `WAKE_ENGINE_MAP.md:5`).
- **Transmutation Studio**: Generates 5 distribution formats (9:16 Reel, X 7-tweet pack, LinkedIn deep dive, IG 5-slide carousel deck, Email Brief newsletter) (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:245-265`).
- **Waveform & Neural Audio**: Local TTS speech synthesis with selectable voices, 6 animated spectrum waveforms, .srt/.vtt subtitles, and MP4 rendering (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:268-275`).
- **Done When Criteria**: `["pillars exist", "handoff lanes are clear", "packet is ready to export"]` (`src/app-config.jsx:64`).

### Surface 4: Vault (IP Vault, GitHub Ingestion, Trend Reverse-Engineering)
- **Primary Mission**: "Search, filter, and load the local source library without losing provenance." (`src/app-config.jsx:70`, `docs/wake-engine/wake_engine_manual.md:49-56`).
- **Local Folder & Removable Drive Intake**: Point engine at C: Drive or USB drive, scan documents and images directly into vault (`docs/wake_engine_manual.md:53-56`, `docs/wake-engine/wake_engine_manual.md:51-53`).
- **1-Click GitHub Repository Cloner**: Ingests public or private GitHub repositories with branch selection and optional Personal Access Token (PAT); categorizes assets into Pictures/Stills, Demo Videos, Apps & Builds, Evidence Docs, and Flagship (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:175-195`).
- **Competitor Trend Reverse-Engineering**: Reverse-engineers viral patterns from transcripts, calculates Viral Efficiency Score (0-100), identifies psychological hook patterns and trigger vocabulary, and outputs 3 counter-positioning angles (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:197-224`).
- **Semantic Vector Search**: Vector search over local IP inventory with cosine similarity (`WAKE_ENGINE_MAP.md:6`, `server/semantic-memory.js`).
- **Done When Criteria**: `["right source is found", "source is loaded", "operator knows the lane"]` (`src/app-config.jsx:76`).

### Surface 5: Library (Memory & Export Ledger)
- **Primary Mission**: "Recover saved sources, generations, exports, and history so no useful work disappears." (`src/app-config.jsx:82`, `docs/wake-engine/wake_engine_manual.md:57-62`).
- **Ledger Sections**: 4 searchable panels: Saved Sources, Generated Outputs, Exports, and History (`src/components/tabs/LibraryTab.jsx`, `scripts/ui-button-audit.mjs:256-267`).
- **Provenance & Inspection**: Opens exported Markdown and complete JSON files with verified SHA-256 hashes and receipt counts (`docs/wake-engine/wake_engine_manual.md:61-62`).
- **Done When Criteria**: `["saved work is findable", "export paths are visible", "history is inspectable"]` (`src/app-config.jsx:88`).

### Surface 6: Instructions (Operations Guide)
- **Primary Mission**: "Explain how to complete an operation using only capabilities that exist in the current WAKE runtime." (`src/app-config.jsx:94`, `docs/wake-engine/wake_engine_manual.md:63-69`).
- **Honest Guidance & Refusal**: Step-by-step WAKE workflow; when asked for unsupported capabilities (such as direct Instagram publishing), explicitly refuses and explains current product boundaries (`scripts/automation-api-audit.mjs:61-66`, `scripts/route-ui-audit.mjs:259-278`).
- **Ollama Integration**: Uses Ollama when available, falls back to deterministic runbook without inventing features (`README.md:106-107`, `docs/wake-engine/wake_engine_manual.md:68`).
- **Done When Criteria**: `["goal is understood", "steps match live capabilities", "next surface is clear"]` (`src/app-config.jsx:100`).

### Surface 7: Automations (Scheduler & Review Queue)
- **Primary Mission**: "Configure, run, pause, review, and inspect local scheduled workflows without changing the current source workspace." (`src/app-config.jsx:106`, `docs/wake-engine/wake_engine_manual.md:70-98`).
- **5-Field Cron Scheduling**: Evaluates once per minute, supports standard cron expressions, lists, ranges, steps, and IANA timezones (`README.md:112-115`, `ARCHITECTURE.md:69-70`).
- **Intake & Hashing**: Reads `.txt`, `.md`, `.json` from configured local folder; hashes combined source and suppresses unchanged duplicate runs (`README.md:116-117`, `ARCHITECTURE.md:71-72`).
- **Dual Approval Dispositions**:
  - `Review Required`: Holds generated packets as pending review items for inspection without persisting approval decisions (`README.md:119, 171`, `ARCHITECTURE.md:22, 101`, `docs/wake-engine/wake_engine_manual.md:84-87`).
  - `Auto Export`: Writes readable Markdown and complete JSON directly to export directory if QA verdict passes (`README.md:120`, `ARCHITECTURE.md:23, 74`, `docs/wake-engine/wake_engine_manual.md:88-94`).
- **Dropzone Watchers & CLI Daemon**: Claimed folder dropzone monitoring and headless CLI command `node scripts/wake-cli.mjs schedule-daemon` (`docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:279-287`).
- **Done When Criteria**: `["schedule is explicit", "approval mode is explicit", "run state is visible"]` (`src/app-config.jsx:112`).

### Surface 8: Monitor (Telemetry & Capability Truth Map)
- **Primary Mission**: "Expose machine health, task state, and capability truth so the operator can trust the surface." (`src/app-config.jsx:118`, `docs/wake-engine/wake_engine_manual.md:99-105`).
- **Live Telemetry Gauges**: CPU, RAM, GPU, Runtime port, sparklines (`WAKE_ENGINE_MAP.md:10`, `docs/wake_engine_manual.md:61-64`).
- **Capability Truth Map**: Classifies every capability as `live`, `done`, `next`, `blocked`, `external`, or `separate-app` with info modals (`evidence/audit/WAKE_V6_BUILD_AUDIT_20260705.md:21, 27`).
- **Task Monitor**: Searchable, filterable task list (`all`, `running`, `done`) with runtime inspection modals (`src/app-config.jsx:117-123`, `scripts/ui-button-audit.mjs:325-334`).
- **Done When Criteria**: `["runtime is healthy", "capabilities are truth-labeled", "next work can continue"]` (`src/app-config.jsx:124`).

### Surface 9: Audit (Receipts, Snapshots & WAL Ledger)
- **Primary Mission**: "Capture receipts after meaningful work so WAKE remains local, inspectable, and accountable." (`src/app-config.jsx:130`, `docs/wake-engine/wake_engine_manual.md:106-113`).
- **Cryptographic Snapshots**: `Save Snapshot` writes timestamped, hash-verified local JSON snapshots under `server/data/snapshots/` (`evidence/audit/WAKE_V6_BUILD_AUDIT_20260705.md:19, 24`, `docs/wake-engine/wake_engine_manual.md:108`).
- **Durability & Backup Receipts**: Inspects WAL journal logs, creates `.wakebundle` backups, and executes one-click restore (`docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:21-28`, `scripts/phase9-durability-security.mjs:65-74`).
- **Done When Criteria**: `["snapshot is saved", "exports are preserved", "state can be inspected later"]` (`src/app-config.jsx:136`).

---

## 3. Durability & WAL / Persistence Claims

| # | Feature / Guarantee | Verbatim Claim in Docs | Citation | Technical Contract & Verification |
|---|---|---|---|---|
| D1 | **Write-Ahead Logging (WAL)** | "`server/durable-storage.js` replaces direct store overwrites with versioned atomic writes and a replayable write-ahead log. All changes are recorded to `wake-v6-store.json.wal` / journal before writing to disk." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:8-12`, `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:292` | Implemented in `DurableJsonStore`. Enforces pending journal record flush via `fsync` before primary state mutation. |
| D2 | **Two-Phase Commit Protocol** | "Every transaction first persists a hash-addressed staged payload and backup, then flushes a pending WAL record before primary state can change." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:10-12` | Tested across write boundaries: `stage:before-write`, `stage:after-write`, `stage:after-fsync`, `backup:after-fsync`, `journal-pending:after-fsync`, `primary:after-rename`. |
| D3 | **Crash Recovery & Idempotent Replay** | "Recovery parses the WAL, identifies transactions without a terminal record, and idempotently replays the staged payload. If unavailable/invalid, restores verified previous version and records rollback." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:11-14` | Replays pending commits across repeated crashes; verified in `scripts/wal-crash-audit.mjs:76-114`. |
| D4 | **61 Interruption Points Tested** | "Crash validation forcibly terminates separate Node processes after every write, fsync, rename, replay, and rollback boundary. All 61 interruption points recovered to a terminal, integrity-verified state." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:19`, `README.md:37, 146` | Tested in `scripts/wal-crash-audit.mjs` (write, recovery, rollback boundaries). |
| D5 | **Universal JSON WAL Scope** | "All production JSON artifacts are WAL-backed: `image-generation-settings.json`, `exports/campaign.json`, `snapshots/snapshot.json`, `auth-verifier.json`, `migration-v1.json`." | `scripts/phase9-durability-security.mjs:76-106`, `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:14` | Uses `writeJsonDurable` and `createDurableJsonFileStore`. |
| D6 | **Backup Bundles (`.wakebundle`)** | "`server/backup-manager.js` creates integrity-checked compressed `.wakebundle` files. Auto backups retain 24 versions; manual: 20 bundles; export/pre-restore: 12." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:23-25` | Validates bundle SHA-256 and individual entry hashes before restoration. |
| D7 | **Disk Capacity Guard (HTTP 507)** | "Disk-capacity checks stop a write with HTTP 507 (`WAKE_DISK_FULL`) before existing data is replaced." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:15` | Tested in `scripts/phase9-durability-security.mjs:178-188`. |
| D8 | **Serialized API Mutations** | "Mutating API requests are serialized so concurrent read-modify-write operations cannot overwrite one another." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:13` | Tested with 8 concurrent API requests in `scripts/phase9-durability-security.mjs:173-186` and 1000 process mutations in `scripts/wal-elite-audit.mjs:239-248`. |
| D9 | **Compaction & Tail Repair** | "Journal compaction maintains bounded transaction logs; torn tail lines from hard power-cuts are safely truncated during startup recovery." | `scripts/wal-elite-audit.mjs:7-14, 146-161, 205-210` | Verified via `compaction-crash` and `torn-tail-repaired` tests. |

---

## 4. Security & Credential Vault Claims

| # | Security Promise | Verbatim Claim in Docs | Citation | Implementation & Enforcement |
|---|---|---|---|---|
| S1 | **IPv4 Loopback Binding** | "The application server binds to loopback rather than a public interface; the API always binds to `127.0.0.1`; caller input cannot switch it to `0.0.0.0`." | `ARCHITECTURE.md:55`, `SECURITY.md:24`, `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:49` | Enforced in `server/index.js: app.listen(port, "127.0.0.1")`. |
| S2 | **Host & Origin Validation** | "Non-loopback socket addresses, invalid Host values, and non-local Origins are rejected." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:50`, `ARCHITECTURE.md:57` | Rejects origins outside `localhost`/`127.0.0.1` with HTTP 403. |
| S3 | **Salted `scrypt` Access Phrase** | "a salted `scrypt` access-phrase verifier; timing-safe phrase comparison; cryptographically random in-memory session tokens; 12-hour expiration; `HttpOnly`, `SameSite=Strict` cookies; CSRF verification for every protected mutation." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:56-64`, `SECURITY.md:25` | Implemented in `server/local-session.js`. Verified in `scripts/phase9-durability-security.mjs:167-185`. |
| S4 | **Renderer Token Isolation** | "The renderer never receives or stores the session token." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:65` | Session token held in `HttpOnly` cookie; renderer only holds CSRF token. |
| S5 | **Electron `safeStorage` Credential Vault** | "Provider secrets are encrypted and decrypted only through Electron `safeStorage` in `electron/secure-vault.js`. The API returns provider status without returning the key. Provider API keys are not loaded from environment variables and are not placed in renderer state, normal JSON state, logs, backups, or exports." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:68-72`, `ARCHITECTURE.md:95-98`, `SECURITY.md:26` | Uses Windows DPAPI via Electron `safeStorage`. Stored in `%APPDATA%\Wake Engine V6\secure`. |
| S6 | **Package Data Exclusion** | "Electron Builder uses explicit shipped-code allowlists: `dist/**/*`, `electron/*.js`, `server/*.js`, the icon, and package metadata. Live data, archives, logs, credential files, generated images, fixtures, smoke runs, UI profiles, and audit residue are not packaged." | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:41-46`, `package.json:58-65` | Verified by inspecting `app.asar` file list in Phase 9 audit. |
| S7 | **Cloud Sync & Path Guard** | "WAKE must be run from a local, non-cloud-synchronized checkout. The workspace guard rejects OneDrive, Dropbox, Google Drive, and iCloud paths." | `README.md:76`, `archive/iterations/CODEX_READ_ME_FIRST.md:13-26` | Enforced by `scripts/guard-local-workspace.mjs` on every script execution. |
| S8 | **Full Git Secret Scan** | "Git history contains no detected committed secret according to configured scanner: `gitleaks/gitleaks-action@v2` with `fetch-depth: 0`." | `JUDGING_EVIDENCE.md:15`, `SECURITY.md:43` | Automated in GitHub Actions CI security workflow. |

---

## 5. Claimed Limitations vs. Unclaimed Limitations & Contradictions

### A. Explicitly Claimed / Documented Limitations
1. **Platform**: Packaged desktop target is Windows 10 and 11 on x64. Linux runs portable/CI tests only. No macOS packaging (`KNOWN_LIMITATIONS.md:8-12`).
2. **Installation**: Initial `npm install` requires internet access unless npm cache is present. Installer is unsigned by default (may show Windows SmartScreen) (`KNOWN_LIMITATIONS.md:14-19`).
3. **Source File Types**: Scheduler supports `.txt`, `.md`, and `.json` only. PDFs, images, audio, and video are not automatically parsed by the scheduler (`KNOWN_LIMITATIONS.md:21-25`, `README.md:168`).
4. **Agent Model Nature**: Content agent workflow is deterministic orchestration, NOT six independent LLMs (`KNOWN_LIMITATIONS.md:28-29`, `README.md:165`).
5. **Ollama Separation**: Ollama is optional, local-only, and is NOT invoked during scheduled automation runs (`KNOWN_LIMITATIONS.md:29-30`, `README.md:123, 166`).
6. **Social Publishing**: "Automatic posting to social networks is not implemented." (`KNOWN_LIMITATIONS.md:31`, `README.md:167`, `SUBMISSION.md:111`).
7. **Inspection-Only Review Queue**: "The current review queue is inspection-only: it exposes the generated packet but does not persist approve/reject/return/approve-and-export decisions." (`KNOWN_LIMITATIONS.md:32-33, 71`, `README.md:35, 171`, `claim-truth-audit.mjs:22-56`).
8. **Hardware Limits**: WAL and atomic storage cover documented interruption points but cannot guarantee recovery from complete physical disk destruction or host compromise (`KNOWN_LIMITATIONS.md:41-52`).

### B. Unclaimed Limitations & Direct Documentation Contradictions

| Contradictory Feature | High-Claim Document (Claiming Feature) | Authoritative / Limitation Document (Denying Feature) | Conflict / Discrepancy Analysis |
|---|---|---|---|
| **Direct Social Publishing** | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:38` ("Direct Social Publishing Queue"), `server/social-publisher.js` | `KNOWN_LIMITATIONS.md:31, 61` ("automatic social publishing is not implemented"), `README.md:167` | The Operator Manual claims direct social publishing to YouTube Shorts, TikTok, LinkedIn, and X, while root documentation strictly forbids claiming social publishing. |
| **Local FFmpeg Video Reel Rendering** | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:37, 273` ("Local FFmpeg 1080x1920 Video Rendering... stitches visuals, synthesized voice, audio waveforms, burned-in subtitles into MP4") | `KNOWN_LIMITATIONS.md:23, 30, 66` ("arbitrary PDF, image, audio, and video ingestion by the scheduler... motion/video pipeline is not connected"), `evidence/audit/WAKE_V6_BUILD_AUDIT_20260705.md:45` | Operator manual claims full 1080x1920 MP4 rendering via FFmpeg, while core architecture and limitations state no motion/video pipeline is connected. |
| **Neural Voiceover Studio (Local TTS)** | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:36, 268-270` ("Synthesizes clean audio narration locally using Windows System TTS voices... Voice Profile Studio") | `docs/wake-engine/wake_engine_manual.md:12-13, 30-39` ("uses installed desktop voices through browser speech synthesis"), `archive/iterations/CODEX_HANDOFF_2026-07-14.md:456` ("No custom voice model exists") | The Operator Manual presents a dedicated "Neural Voiceover Studio", whereas the core product uses standard browser/Chromium `speechSynthesis` with system voices. |
| **1-Click GitHub Repository Cloner** | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:175-195` ("1-Click GitHub Repository Ingestion & Flagship Scanner with PAT, clones & categorizes files") | `README.md:31` ("Reads pasted source and approved local folders"), `KNOWN_LIMITATIONS.md:22` | Core intake docs define intake as local folders and pasted text only; GitHub cloning with PAT is documented in the Operator Manual and implemented in `server/git-ingest.js`. |
| **Competitor Trend Reverse-Engineering** | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:197-224` ("Viral Efficiency Score 92/100, trigger vocabulary, psychological patterns") | `JUDGING_EVIDENCE.md:88` ("Do not publish invented benchmarks, user counts, time savings, accuracy percentages") | The trend analyzer calculates hardcoded heuristics (e.g. 92/100 viral scores), which contradicts the anti-theater benchmark rules in `JUDGING_EVIDENCE.md`. |
| **Semantic Vector Search / Memory** | `WAKE_ENGINE_MAP.md:6` ("IP vault inventory with semantic vector search"), `server/semantic-memory.js` | `KNOWN_LIMITATIONS.md:64` ("cloud collaboration service..."), `evidence/audit/WAKE_V6_BUILD_AUDIT_20260705.md:44` ("No vector memory database is connected") | The architecture map lists semantic vector search, while build audits state no external vector DB is connected (custom JS sparse/dense embeddings in `server/semantic-memory.js`). |
| **Dropzone Watchers & Outbound Webhooks** | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:279-282` ("Dropzone Watchers: Monitors local folders... Outbound Webhooks: dispatches to n8n, Make.com") | `README.md:112-124`, `ARCHITECTURE.md:67-76` | Core scheduler docs describe a 1-minute cron folder poll, while Operator Manual describes continuous directory watchers (`server/folder-watcher.js`) and webhook dispatchers. |

---

## 6. Specific Integration, Social & Connection Claims

| Surface / Platform | Exact Claim in Documentation | Exact Citation | Implementation Details / Artifact Reference |
|---|---|---|---|
| **Twitter / X** | - Aspect ratio 16:9 native preview<br>- 7-Tweet Thread Pack format generation (`02-x-twitter-thread.md`)<br>- Staging queue with mock handles (`@wakeengine`, `@wake.engine`) | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:87, 258`, `server/transmutation-studio.js:231` | `src/components/common/AbilityScaffold.jsx:500-530`, `server/social-publisher.js` |
| **TikTok** | - Aspect ratio 9:16 Vertical Reel preview<br>- 4-part scene beats (0-3s Hook, 3-15s Proof, 15-45s Step, 45-60s Action)<br>- Timed video script generation (`01-vertical-video-reel.md`) | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:87-94, 257`, `src/app-config.jsx:23` | `src/components/common/AbilityScaffold.jsx:501-507`, `server/transmutation-studio.js:220` |
| **Instagram** | - Aspect ratio 4:5 Feed preview<br>- 5-slide or 7-slide Carousel Deck generation (`04-instagram-carousel-deck.md`)<br>- Refusal of direct publishing in Instructions | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:87, 259`, `scripts/route-ui-audit.mjs:275` | `src/components/common/AbilityScaffold.jsx:509-525`, `server/transmutation-studio.js:240` |
| **LinkedIn** | - Executive Feed native preview<br>- Long-Form Executive Article Deep-Dive (`03-linkedin-article.md`) | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:87, 259`, `src/components/tabs/ClusterTab.jsx:1003` | `src/components/common/AbilityScaffold.jsx:530-545`, `server/transmutation-studio.js:235` |
| **YouTube / Shorts** | - 16:9 Landscape & 9:16 Shorts script / thumbnail generation<br>- Voice profile recommendations for YouTube deep dives | `server/voiceover-engine.js:19, 28`, `src/components/tabs/VaultTab.jsx:92` | `server/voiceover-engine.js`, `src/components/tabs/VaultTab.jsx` |
| **GitHub** | - 1-Click repository cloning (`https://github.com/justin/my-content-repo`, `https://github.com/justinevans4040-cloud/wake-engine-v6`)<br>- Optional Personal Access Token (`ghp_xxxxxxxxxxxx`) never saved to disk<br>- Asset categorizer: Pictures, Demo Videos, Apps & Builds, Evidence Docs, Flagship | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:175-195`, `server/git-ingest.js` | Implemented in `server/git-ingest.js`, UI in `src/components/tabs/VaultTab.jsx:319` |
| **Email / Newsletter** | - Executive Newsletter / Brief generation (`05-email-newsletter-brief.md`) | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:261`, `server/transmutation-studio.js:250` | `server/transmutation-studio.js` |
| **Outbound Webhooks** | - Automatic webhook dispatching to n8n, Make.com, or custom HTTP webhooks | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:282` | `server/folder-watcher.js`, `server/social-publisher.js` |

---

## 7. Master Features Discovered Table

```
## Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Architecture | Electron Desktop Shell | Packaged desktop container with NSIS installer and Windows DPAPI safeStorage integration | App launch / OS env | Native desktop window, system tray, secure vault | Fails closed on invalid paths / non-Windows | ARCHITECTURE.md:32-38, package.json:52-80 |
| 2 | Architecture | Express Loopback Service | Dedicated local HTTP/JSON API bound strictly to 127.0.0.1 | HTTP requests on loopback port | JSON responses, streamed NDJSON, binary exports | Returns 401 Unauthorized, 403 Forbidden on invalid origin/CSRF, 507 on disk full | ARCHITECTURE.md:53-58, server/index.js |
| 3 | Core Pipeline | Deterministic 6-Stage DAG | Orchestrates Archivist, Strategist, Scriptwriter, Creative Director, QA, Export | Source text + task parameters | Complete campaign packet, citations, scripts, variants, receipts | Blocks export if QA fails; returns repair suggestions on weak source | ARCHITECTURE.md:59-66, server/tier-zero-runtime.js |
| 4 | Core Pipeline | Evidence & Citation Mapping | Maps 100% of generated claims to extracted verbatim source passages | Source text passages | Line-attributed quotes, evidenceMap, claimMap | Claims lacking source evidence are marked unsupported and blocked | README.md:33, docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:138 |
| 5 | Scheduler | 5-Field Cron Automation | Headless scheduler executing workflows on 1-minute intervals with IANA timezone support | Cron string, source folder, ask, export folder | Automation run records, review queue items, or exported files | Records failure if folder missing/unsupported; skips duplicate source | README.md:112-124, server/scheduler.js |
| 6 | Scheduler | Unchanged Source Hashing | Computes SHA-256 over combined folder contents to suppress duplicate runs | Source files in directory | Existing run reuse / AUTOMATION_SKIPPED history record | None (idempotent skip) | README.md:117, scripts/scheduler-audit.mjs:97-128 |
| 7 | Scheduler | Dual Approval Dispositions | Separates Review Required (pending queue) from Auto Export (writes MD + JSON on QA pass) | Automation approvalMode setting | Pending review item OR dual exported files | Blocks export and flags run as failed if QA fails in Auto Export mode | ARCHITECTURE.md:22-23, scripts/scheduler-audit.mjs:158-184 |
| 8 | Durability | Write-Ahead Logging (WAL) | 2-phase commit with stage files, backup versions, and fsync journal records | State mutation payload | State update + committed WAL entry | Recovers or rolls back uncommitted transactions across crashes | docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:8-19, server/durable-storage.js |
| 9 | Durability | .wakebundle Backup & Restore | Gzip-compressed tar bundles containing state and asset files with cryptographic checksums | User backup request / automatic schedule | .wakebundle archive file | Validates bundle hash and entry hashes before restoring; writes pre-restore rollback | docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:23-28, server/backup-manager.js |
| 10 | Security | Local Session & CSRF Gate | Scrypt salted password verification, 12-hour session cookies, CSRF tokens on mutations | Callsign + Access phrase | Authenticated session cookie + CSRF header | Returns 401 on missing/expired session; 403 on missing CSRF token | docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:54-66, server/local-session.js |
| 11 | Security | safeStorage Credential Vault | Encrypts external API credentials using Windows DPAPI via Electron | Provider name + API key | Encrypted vault file in %APPDATA%\secure | Keys never returned over API or written to normal logs/backups | docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md:68-72, electron/secure-vault.js |
| 12 | Console | Campaign Autopilot | 1-action autonomous campaign generation across TikTok, IG, X, and LinkedIn | Source text or project memory + optional direction | 4 native platform packages, scripts, visual prompts | Gated until source or project memory is loaded | docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:65-98, src/components/tabs/ConsoleTab.jsx |
| 13 | Console | Voice Dictation (STT) | Browser/Chromium Web Speech API speech-to-text dictation across input fields | Microphone audio stream | Transcribed text in input fields | Graceful fallback to manual typing when STT unsupported | docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:228-243, src/app-config.jsx |
| 14 | Agents | Streamed Agent Chat | NDJSON streaming contextual conversation with content agents | User chat query + active source context | Token-by-token streamed response + promotion button | Emits Instant Local Draft if Ollama model is offline | archive/iterations/CODEX_HANDOFF_2026-07-14.md:271-280, server/chat-profiles.js |
| 15 | Cluster | 1-Click Transmutation Studio | Converts single source into 5 native distribution formats | Source text / framed source | 5 Markdown files (Reel, X thread, LinkedIn, Carousel, Email) | Validates source before transmutation | docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:245-265, server/transmutation-studio.js |
| 16 | Cluster | Neural Voiceover Engine | Local TTS narration synthesis using Windows System voices (David, Mark, Zira) | Script text + voice preset selection | Audio output + synchronized timestamps | Fallback to default system voice if preset unavailable | docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:268-270, server/voiceover-engine.js |
| 17 | Cluster | Audio Waveform Visualizers | Generates dynamic audio spectrum waveforms in 6 visualizer styles | Audio data / spectrum parameters | SVG / visualizer overlay animation data | Falls back to default equalizer bars | docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:271, server/waveform-engine.js |
| 18 | Cluster | Subtitle Track Generator | Generates synchronized .srt and .vtt subtitle files from script beats | Timed script beats + WPM rate | .srt or .vtt formatted subtitle text | Formats timing boundaries cleanly | docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:272, server/batch-synthesizer.js |
| 19 | Cluster | Local FFmpeg Reel Renderer | Stitches visuals, voiceover audio, waveforms, and subtitles into 1080x1920 MP4 | Image assets, audio file, subtitle file | Rendered 1080x1920 MP4 video file | Fails if FFmpeg executable not found | docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:273, server/video-engine.js |
| 20 | Vault | 1-Click GitHub Cloner | Clones public/private repositories and categorizes assets into 5 buckets | GitHub repo URL + optional branch + optional PAT | Cloned folder + categorized file index | Rejects invalid URLs or failed authentication | docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:175-195, server/git-ingest.js |
| 21 | Vault | Trend Reverse-Engineering | Analyzes competitor transcripts for viral patterns, vocabulary, and counter-angles | Competitor script / transcript | Viral efficiency score (0-100), hook pattern, 3 counter-angles | Returns error on empty transcript | docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:197-224, server/trend-analyzer.js |
| 22 | Vault | Semantic Memory Vector Index | Dense/sparse hybrid embeddings and cosine similarity search over local vault | Search query + vault documents | Ranked document matches with similarity scores | Falls back to lexical search if embeddings missing | WAKE_ENGINE_MAP.md:6, server/semantic-memory.js |
| 23 | Instructions | Operations Guide Assistant | Explains step-by-step WAKE workflows using only implemented features | Operator goal query | Workflow instructions referencing exact WAKE surfaces | Explicitly refuses unsupported capabilities (e.g. direct social posting) | README.md:104-107, scripts/automation-api-audit.mjs:54-66 |
| 24 | Monitor | Machine Telemetry & Truth Map | Real-time CPU, RAM, GPU, port gauges, sparklines, and capability truth labels | System telemetry + server capability registry | Visual dashboard with status pills (live, done, blocked, external) | Displays explicit boundary modals on click | WAKE_ENGINE_MAP.md:10, evidence/audit/WAKE_V6_BUILD_AUDIT_20260705.md |
| 25 | Audit | Snapshot Ledger & Receipts | Saves immutable session snapshots with SHA-256 hashes under server/data/snapshots | Current runtime state | JSON snapshot file + audit history receipt | Rejects snapshot if state serialization fails | WAKE_ENGINE_MAP.md:11, src/components/tabs/AuditTab.jsx |
| 26 | Social | Staging Queue & Publisher | Stages content for multi-platform dispatch across YouTube, TikTok, LinkedIn, X | Staged post object + platform targets | Staging queue record + dispatch receipt | Rejects unconfigured platform credentials | docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:38, server/social-publisher.js |
| 27 | Automations | Dropzone Folder Watcher | Continuously monitors local folders and triggers automated intake on file drop | Local folder path | Intake triggers + queue entries | Rejects cloud-synchronized directories | docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:279-281, server/folder-watcher.js |
```

---

## 8. Master Edge Cases Table

```
## Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Cron Scheduler | Invalid cron expression ("61 * * * *", "bad cron") | Parser returns false / HTTP 400 with WAKE_AUTOMATION_INVALID error message |
| 2 | Cron Scheduler | Invalid IANA timezone ("Mars/Olympus") | API rejects with HTTP 400 and error "valid IANA timezone" |
| 3 | Cron Scheduler | Cloud-synchronized directory ("C:\Users\...\OneDrive\...") | API rejects with HTTP 400 and error "local and non-cloud-synchronized" |
| 4 | Cron Scheduler | Unchanged source files across runs | Pipeline execution skipped; records AUTOMATION_SKIPPED history entry without phantom runs |
| 5 | Auto Export | Generated packet fails QA verdict | Auto Export blocks file generation; records run status as failed with "blocked by QA verdict" |
| 6 | Review Required | Generated packet requires review | Places packet in pending review queue with awaiting-review status; does not write export files |
| 7 | Instructions Assistant | Unsupported request ("Publish directly to Instagram") | Refuses request; returns text explaining WAKE does not currently publish directly |
| 8 | Durable Storage | Process crash after writing stage file before pending WAL | Recovery restores previous verified version (revision 1) and removes incomplete stage |
| 9 | Durable Storage | Process crash after flushing pending WAL record | Startup recovery replays staged payload, advances to revision 2, and logs recovered-commit |
| 10 | Durable Storage | Process crash with corrupt/missing staged payload | Recovery restores previous backup version (revision 1) and writes rolled-back terminal record |
| 11 | Durable Storage | Torn / truncated WAL record at end of journal (power cut) | Startup recovery truncates partial tail record to last valid newline and restores consistency |
| 12 | Durable Storage | Middle-of-journal record tampering (broken hash chain) | Startup recovery fails with error and refuses to load corrupt journal |
| 13 | Durable Storage | Disk full condition during write mutation | Operation intercepted; returns HTTP 507 WAKE_DISK_FULL; existing state untouched |
| 14 | Durable Storage | Stale process lock file remaining after process SIGKILL | Recovery detects dead PID, unlocks state.json.lock, and restores state cleanly |
| 15 | Local Session | Request to protected API without session cookie | Returns HTTP 401 Unauthorized; data not disclosed |
| 16 | Local Session | State-changing mutation without X-Wake-CSRF header | Returns HTTP 403 Forbidden; state remains unmutated |
| 17 | Local Session | Request from foreign Origin ("https://attacker.invalid") | Returns HTTP 403 Forbidden; request rejected at boundary |
| 18 | Vault Intake | Empty directory or directory with binary-only files (.bin) | Filters out unsupported binaries; loads only .txt, .md, .json |
| 19 | Vault GitHub Cloner | Invalid repository URL or inaccessible private repo without PAT | Git process returns non-zero code; API emits clean error message without crashing |
| 20 | Console Autopilot | Empty direction with no saved project source | Create Campaign button remains disabled; prompts operator to add source |
| 21 | Image Generation | Triggering image generation without operator provider consent | Disabled / blocked; requires operator to enable image provider explicitly |
| 22 | Agent Chat | Sending chat query when local Ollama is offline | Emits Instant Local Draft response deterministically without silent failure |
```

---

## 9. Synthesis & Critical Findings for Hostile Audit

1. **Strict Core vs. Speculative Documentation**:
   - The root documentation (`README.md`, `ARCHITECTURE.md`, `KNOWN_LIMITATIONS.md`, `JUDGING_EVIDENCE.md`) was rigorously hardened during Phase 9 to reflect exact reality: deterministic pipelines, inspection-only review queues, separate auto-export, and no social publishing.
   - However, `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md` and several backend modules (`server/social-publisher.js`, `server/video-engine.js`, `server/git-ingest.js`, `server/trend-analyzer.js`, `server/transmutation-studio.js`, `server/voiceover-engine.js`, `server/waveform-engine.js`, `server/folder-watcher.js`, `server/semantic-memory.js`) contain extensive claims of automated video rendering, neural TTS studios, viral score reverse-engineering, dropzones, webhooks, and social publishing.

2. **Zero-Theater Compliance**:
   - In accordance with `server/no-theater.js` and `scripts/claim-truth-audit.mjs`, all mock data, hardcoded accounts, and simulated indicators must be cross-examined against actual runtime behavior during the audit phases.
