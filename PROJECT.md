# WAKE Engine V6 — Master Audit Project Specification

## Architecture & Subsystems
WAKE Engine V6 is a local-first desktop intelligence system consisting of:
1. **Desktop Client Shell (`electron/`, `src/`)**: React 18 + Vite desktop UI supporting 9 primary product surfaces: Console, Agents, Cluster, Vault, Library, Monitor, Audit, Automations/Scheduler, and Review Queue.
2. **Local Loopback API Engine (`server/index.js`, `server/scheduler.js`)**: Express backend binding to `127.0.0.1`, hosting 87 API endpoints, deterministic cron automation scheduler, 6-stage content pipeline, prompt synthesis, and media management.
3. **Durable Storage & Write-Ahead Logging (`server/durable-storage.js`)**: Two-phase atomic writes, SHA-256 integrity validation, hash-chained WAL v3, torn-tail auto-repair, crash recovery rollback, and directory mutex locking with dead-PID reclamation.
4. **Local Vault & Biometric Authentication (`server/local-session.js`, `electron/secure-vault.js`)**: Scrypt key derivation, WebAuthn FIDO2 Windows Hello biometric authentication with monotonic counter checks, CSRF header enforcement, and Electron `safeStorage` (Windows DPAPI) credential encryption in isolated `userData/secure/` storage.

---

## Feature & Claims Inventory
| # | Feature / Claim Area | Documented Source | Actual Code Status | Audit Status |
|---|----------------------|-------------------|-------------------|--------------|
| 1 | 6-Stage Deterministic Generation Pipeline | `README.md:12`, `ARCHITECTURE.md:45` | `server/pipeline-engine.js:14-120` | **PASS (VERIFIED)** |
| 2 | 5-Field Cron Scheduling with Hash Checks | `README.md:38`, `ARCHITECTURE.md:112` | `server/scheduler.js:42-180` | **PASS (VERIFIED)** |
| 3 | Inspection-Only Review Queue | `README.md:52`, `KNOWN_LIMITATIONS.md:18` | `server/index.js:1120-1160` | **PASS (VERIFIED)** |
| 4 | QA-Gated Autonomous Content Export | `README.md:65`, `ARCHITECTURE.md:140` | `server/export-engine.js:20-95` | **PASS (VERIFIED)** |
| 5 | Two-Phase Atomic Writes & SHA-256 Check | `ARCHITECTURE.md:88`, `JUDGING_EVIDENCE.md:30` | `server/durable-storage.js:110-185` | **PASS (VERIFIED)** |
| 6 | WAL v3 Hash-Chained Crash Recovery | `ARCHITECTURE.md:95`, `JUDGING_EVIDENCE.md:45` | `server/durable-storage.js:210-340` | **PASS (VERIFIED)** |
| 7 | Windows DPAPI / safeStorage Key Vault | `SECURITY.md:14`, `ARCHITECTURE.md:165` | `electron/secure-vault.js:15-88` | **PASS (VERIFIED)** |
| 8 | FIDO2 / Windows Hello Biometrics | `SECURITY.md:28`, `ARCHITECTURE.md:180` | `server/local-session.js:140-230` | **PASS (VERIFIED)** |
| 9 | Direct Social Publishing to TikTok/YT/X | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:210` | `server/social-publisher.js:26-128` | **FAIL (THEATER / MOCK)** |
| 10 | Local 1080x1920 MP4 Video Rendering | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:265` | `server/video-engine.js:69-84` | **FAIL (THEATER: writes JSON to .mp4)** |
| 11 | Neural TTS Voiceover Audio Generation | `docs/WAKE_ENGINE_V6_OPERATOR_MANUAL.md:285` | `server/voiceover-engine.js:98-121` | **FAIL (THEATER: returns fake audio URLs)** |
| 12 | Vault Intake Candidate Review Checkbox | UI Spec / `VaultTab.jsx:733` | `src/components/tabs/VaultTab.jsx:733` | **FAIL (FATAL TYPEERROR: .has() on Array)** |
| 13 | Review Queue "View Generated Packet" Modal | UI Spec / `AutomationsTab.jsx:613` | `src/components/tabs/AutomationsTab.jsx:613` | **FAIL (BROKEN MODAL CONTRACT)** |
| 14 | Dynamic Workspace Context in Vision Studio | UI Spec / `AgentsTab.jsx:141` | `src/components/tabs/AgentsTab.jsx:141` | **FAIL (HARDCODED PROJECT ID)** |
| 15 | Global Client Error Boundary | Architecture Spec / `main.jsx` | `src/main.jsx` | **FAIL (ZERO ERROR BOUNDARIES)** |
| 16 | Static Media Route Authentication | Security Spec / `server/index.js` | `server/index.js:4781, 4823` | **FAIL (UNAUTHENTICATED MEDIA ROUTES)** |
| 17 | Project Vault Export/Import Route Uniqueness | Server Spec / `server/index.js` | `server/index.js:4862, 4907` | **FAIL (SHADOWED DUPLICATE ROUTES)** |

---

## 9 Product Surfaces Audit Matrix
| Surface | Surface Name | Component File | Button / Interactive Count | Dead / Broken Contracts | Status |
|---------|--------------|----------------|----------------------------|-------------------------|--------|
| S1 | Console | `src/components/tabs/ConsoleTab.jsx` | 14 actions / buttons | 0 dead buttons | **PASS** |
| S2 | Agents | `src/components/tabs/AgentsTab.jsx` | 22 actions / inputs | Hardcoded `projectId` at line 141 | **FAIL (WARNING)** |
| S3 | Cluster | `src/components/tabs/ClusterTab.jsx` | 16 actions / telemetry | 0 dead buttons | **PASS** |
| S4 | Vault | `src/components/tabs/VaultTab.jsx` | 18 actions / candidates | Fatal `TypeError` in checkbox line 733 | **FAIL (CRITICAL)** |
| S5 | Library | `src/components/tabs/LibraryTab.jsx` | 24 actions / media | 0 dead buttons | **PASS** |
| S6 | Monitor | `src/components/tabs/MonitorTab.jsx` | 12 actions / gauges | 0 dead buttons | **PASS** |
| S7 | Audit | `src/components/tabs/AuditTab.jsx` | 15 actions / snapshots | 0 dead buttons | **PASS** |
| S8 | Automations | `src/components/tabs/AutomationsTab.jsx` | 28 actions / crons / accounts | Fake "Connected" badges line 349 | **FAIL (THEATER)** |
| S9 | Review Queue | `src/components/tabs/AutomationsTab.jsx` | 10 actions / reviews | Broken empty modal line 613 | **FAIL (BROKEN MODAL)** |

---

## Hostile Audit Subsystem Summary
| Subsystem | Audited Items | Pass Count | Fail Count | Critical Defects | Verdict |
|-----------|---------------|------------|------------|------------------|---------|
| 1. Doc vs. Code Truth | 35 claims | 27 | 8 | 2 (Unbacked Social & Video Manual Claims) | **NOT READY** |
| 2. Theater & Mock Purge | 18 checks | 5 | 13 | 4 (Fake Accounts, Synthetic Dispatch, MP4 JSON, Fake Audio) | **NOT READY** |
| 3. Interactive UI Surfaces | 168 controls | 164 | 4 | 2 (Fatal Vault TypeError, Broken Review Modal) | **NOT READY** |
| 4. Server API & Scheduler | 87 endpoints | 83 | 4 | 2 (Duplicate Routes, Media Auth Disparity) | **NOT READY** |
| 5. Durability & WAL Engine | 28 contracts | 28 | 0 | 0 (118/118 Fault Injection Stress Tests Passed) | **READY** |
| 6. Security & Local Vault | 21 controls | 20 | 1 | 1 (Media Endpoint Session Bypass) | **READY** |

**OVERALL AUDIT VERDICT**: **NOT READY (FAIL — 30 Violations / Critical Defects Detected)**
