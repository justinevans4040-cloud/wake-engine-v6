# WAKE Engine V6 — Server & Storage Exhaustive Technical Survey

**Audit Phase**: Phase 0 — Exhaustive Technical Survey  
**Scope**: `server/` codebase, runtime infrastructure, storage systems, security, background jobs, endpoints, and mock/theater inventory  
**Auditor**: Explorer Server Subagent (`explorer_server_1`)  
**Date**: 2026-08-15  
**Project Root**: `C:\Users\justi\.gemini\antigravity\scratch\wake-engine-v6`  

---

## 1. Executive Summary

WAKE Engine V6's server layer is an Express-based Node.js backend (`server/index.js`, 5077 lines) designed for local-first execution on Windows desktop environments. It interfaces with an Electron host application via IPC / HTTP port 8786.

### Key Architectural Strengths:
1. **Durable Storage Engine (`server/durable-storage.js`)**: An advanced implementation of atomic file writes (`fsyncSync`, `renameSync`, SHA-256 verification), write-ahead logging (WAL version 3 with hash-chained records and torn-tail repair), crash recovery (automatic replay/rollback), process locking (`.lock` directory with PID/processInstanceId heartbeat), and backup rotation.
2. **Local Security & Windows Hello Session Management (`server/local-session.js` & `electron/secure-vault.js`)**: Strong cryptographic primitives (Scrypt key derivation with 24-byte salt, WebAuthn/FIDO2 Windows Hello biometric verification with replay counter checks, CSRF header enforcement `x-wake-csrf`, loopback binding restrictions, and Electron `safeStorage` encryption for API keys).
3. **Deterministic Cron Scheduler (`server/scheduler.js`)**: Real 5-field cron parsing with step/range/list support, IANA timezone resolution, SHA-256 source hashing to avoid redundant runs, and pipeline execution.

### Critical Vulnerabilities, Theater & Mock Data Findings:
1. **Direct Social Publishing Theater (`server/social-publisher.js` & `server/data/publishing-queue.json`)**:
   - Hardcoded accounts claiming `"status": "connected"` for `@wakeengine` (YouTube), `@wake.engine` (TikTok), `WAKE Engine Systems` (LinkedIn), and `@WakeEngineHQ` (X).
   - `dispatchPost()` explicitly simulates network calls with random latency (`Math.random() * 80 + 45`), fake SHA-256 signatures, and fake destination URLs (`https://www.tiktok.com/@wake.engine/video/...`), falsely returning `"status": "delivered"`.
   - This directly contradicts `/api/instructions/generate` which explicitly states: *"WAKE V6 does not currently publish directly to social networks."*
2. **Hardcoded Background Task State (`server/index.js:1078-1087`)**:
   - `tasks` array contains 8 static objects (`WAKE-001` through `WAKE-008`) with hardcoded statuses (`"running"`, `"done"`) and hardcoded timestamps (`"2m ago"`, `"4m ago"`, `"now"`, `"live"`), returned in every `GET /api/state` response. `runtime.queue` is hardcoded to count 4 running tasks.
3. **Mock Video Rendering Failure Mode (`server/video-engine.js:69-84`)**:
   - When FFmpeg is missing on the host machine, `renderVerticalReel()` writes a JSON manifest string to a file ending in `.mp4` (`fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), "utf8")`).
4. **Phantom Audio Synthesis (`server/voiceover-engine.js:98-121`)**:
   - `synthesizeSpeech()` returns metadata with an audio URL (`/generated-audio/...`), but if no remote neural endpoint is configured, it never creates or writes any audio file to disk.
5. **Route Shadowing / Duplicate Registrations (`server/index.js`)**:
   - `POST /api/projects/:id/export-vault` registered at Line 4122 and Line 4862.
   - `POST /api/projects/import-vault` registered at Line 4178 and Line 4907.
6. **Authentication Bypass Disparity on Static Media Middleware**:
   - `/generated-images` enforces `sessionManager.require`.
   - `/generated-audio` (Line 4781) and `/generated-videos` (Line 4823) lack `sessionManager.require`.

---

## 2. Codebase Inventory & File Map (`server/` and `electron/`)

| File Path | Lines | Size (Bytes) | Role & Architectural Purpose |
|---|---|---|---|
| `server/index.js` | 5077 | 218,033 | Main Express server, route registrations, in-memory state aggregation, Ollama client, and telemetry |
| `server/durable-storage.js` | 796 | 34,511 | Write-ahead logging (WAL), atomic file operations, crash recovery, directory locking, backup rotation |
| `server/scheduler.js` | 447 | 16,493 | Background automation scheduler, cron expression parser, source bundle hasher, review queue dispatcher |
| `server/local-session.js` | 264 | 14,657 | Local session manager, scrypt phrase authentication, WebAuthn / Windows Hello biometric verification, CSRF |
| `server/tier-zero-runtime.js` | 1091 | 49,924 | Deterministic 6-agent pipeline (Archivist, Strategist, Scriptwriter, Creative Director, QA, Export), A2A layer, rubric |
| `server/tier-zero-spec-status.js` | 6 | 353 | Status and disclaimer declaring Tier Zero parameters are local user-promoted parameters |
| `server/backup-manager.js` | 150 | 7,163 | Gzip-compressed `.wakebundle` creation, SHA-256 verification, pre-restore snapshots, cache cleanup |
| `server/folder-watcher.js` | 121 | 3,533 | `fs.watch` local non-cloud directory monitoring with 5000ms debounce and automated intake triggers |
| `server/git-ingest.js` | 269 | 10,868 | Git CLI wrapper for shallow cloning repos, file classification, and flagship brand keyword mapping |
| `server/semantic-memory.js` | 288 | 8,532 | 256-dim dense-sparse semantic hashing, cosine similarity, text chunking, and vector index persistence |
| `server/image-generation.js` | 196 | 9,376 | Image generation dispatch (Pollinations, Hugging Face, OpenAI-compatible), atomic local storage |
| `server/social-publisher.js` | 142 | 5,002 | Social media staging queue and simulated dispatch engine (**MOCK THEATER**) |
| `server/analytics-simulator.js` | 145 | 6,387 | Heuristic audience retention modeling, Flesch reading ease, viral velocity formulas |
| `server/transmutation-studio.js` | 266 | 13,673 | 1-click omnichannel template generator (Vertical Reel, X Thread, LinkedIn, Carousel, Newsletter) |
| `server/batch-synthesizer.js` | 151 | 5,692 | 30-day content calendar matrix generator and `.srt`/`.vtt` subtitle cue generator |
| `server/voiceover-engine.js` | 148 | 4,681 | Voice profile catalogue, remote TTS bridge, and subtitle synchronization |
| `server/video-engine.js` | 105 | 3,396 | FFmpeg vertical reel compositing engine and fallback manifest writer |
| `server/waveform-engine.js` | 125 | 4,377 | Audio amplitude spectrum math and SVG waveform graphic generator (bars, smooth wave, neon pulse) |
| `server/hook-matrix.js` | 102 | 3,335 | 5 psychological angle hook variant generator with static retention scores |
| `server/trend-analyzer.js` | 113 | 4,577 | Competitor transcript analyzer, power vocabulary density calculator, counter-positioning generator |
| `server/no-theater.js` | 127 | 6,575 | Truth verification audit rules checking runtime identities, claims, contracts, and proof endpoints |
| `server/chat-profiles.js` | 38 | 1,909 | Chat profile configuration matrix for fast/balanced/deep/elite/instant execution modes |
| `electron/secure-vault.js` | 65 | 2,092 | Electron `safeStorage` credential broker (Windows DPAPI encryption for provider API keys) |
| `electron/runtime-paths.js` | 81 | 4,568 | Electron `userData` runtime directory setup and legacy migration manager |
| `electron/main.js` | 129 | 3,919 | Electron main process, single instance lock, window creation, server child process lifecycle |

---

## 3. Comprehensive API Endpoint Inventory

The server registers **87 HTTP routes / middleware handlers** across `server/index.js`. All `/api/*` endpoints (except session authentication and `/api/health`) pass through `sessionManager.require` and `serializeMutatingRequest`.

### 3.1 Session & Security Endpoints
1. `GET /api/session/status`
   - **Auth**: Public (reads `wake_session` cookie)
   - **Response**: `{ ok: true, authenticated: bool, authenticationRequired: bool, enrolled: bool, biometricEnrolled: bool, biometricCredentialCount: int, operator: string|null, csrfToken: string|null, expiresAt: int|null }`
   - **Handler**: `sessionManager.status(req)` (`server/local-session.js:134`)

2. `POST /api/session/login`
   - **Auth**: Public
   - **Payload**: `{ operator: string, phrase: string }`
   - **Response**: `{ ok: true, authenticated: true, enrolled: bool, operator: string, csrfToken: string, expiresAt: int }` + `Set-Cookie: wake_session=...; HttpOnly; SameSite=Strict`
   - **Handler**: `sessionManager.login()` using Scrypt hashing (`server/local-session.js:140`)

3. `POST /api/session/logout`
   - **Auth**: Public
   - **Response**: `{ ok: true, authenticated: false }` + `Set-Cookie: wake_session=; Max-Age=0`
   - **Handler**: `sessionManager.logout(req)` (`server/local-session.js:160`)

4. `POST /api/session/biometric/register/options`
   - **Auth**: `sessionManager.require` + CSRF
   - **Response**: `{ ok: true, publicKey: WebAuthnCreationOptions }`
   - **Handler**: `sessionManager.beginBiometricRegistration(req)` (`server/local-session.js:165`)

5. `POST /api/session/biometric/register/verify`
   - **Auth**: `sessionManager.require` + CSRF
   - **Payload**: `{ clientDataJSON, authenticatorData, credentialId, publicKey, algorithm, transports }`
   - **Response**: `{ ok: true, biometric: { enrolled: true, credentialId, operator, transports } }`
   - **Handler**: `sessionManager.finishBiometricRegistration()` (`server/local-session.js:180`)

6. `POST /api/session/biometric/login/options`
   - **Auth**: Public
   - **Response**: `{ ok: true, publicKey: WebAuthnRequestOptions }`
   - **Handler**: `sessionManager.beginBiometricLogin(req)` (`server/local-session.js:207`)

7. `POST /api/session/biometric/login/verify`
   - **Auth**: Public
   - **Payload**: `{ clientDataJSON, authenticatorData, credentialId, signature }`
   - **Response**: `{ ok: true, authenticated: true, biometric: true, operator, csrfToken, expiresAt }` + cookie
   - **Handler**: `sessionManager.finishBiometricLogin()` (`server/local-session.js:215`)

8. `GET /api/health`
   - **Auth**: Public
   - **Response**: `{ ok: true, product: "Wake Engine", console: "WAKE Command Console V6", version: "V6", build: "wake-command-console-v6-local", status: "active", port: 8786, noTheater: bool, noTheaterSummary: object, externalOperators: [] }`
   - **Handler**: `server/index.js:3284`

### 3.2 Core State & System Telemetry
9. `GET /api/state`
   - **Auth**: Protected
   - **Response**: Full application state object (`store.projects`, `store.sources`, `store.mediaAssets`, `store.campaigns`, `store.automations`, `tasks`, `capabilities`, etc.)
   - **Handler**: `state()` (`server/index.js:3118`)

10. `GET /api/no-theater/status`
    - **Auth**: Protected
    - **Response**: `{ ok: bool, checkedAt: string, summary: object, violations: array, warnings: array }`
    - **Handler**: `auditNoTheater()` (`server/no-theater.js:5`)

11. `GET /api/system`
    - **Auth**: Protected
    - **Response**: `{ ok: true, sampledAt: string, cpu: object, memory: object, gpu: object, runtime: object, logs: array }`
    - **Handler**: `systemMetrics()` (`server/index.js:507`)

12. `POST /api/open-folder`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ target: "data" | "exports" | "snapshots" }`
    - **Response**: `{ ok: true, target: string, folder: string }`
    - **Handler**: Spawns Windows Explorer via `explorer.exe` (`server/index.js:4750`)

13. `POST /api/snapshot`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ source: string, output: object }`
    - **Response**: `{ ok: true, fileName: string, relativePath: string }`
    - **Handler**: Writes snapshot to `server/data/snapshots/` (`server/index.js:4766`)

14. `GET /api/history`
    - **Auth**: Protected
    - **Response**: `{ ok: true, history: array, agentChats: array, runRecords: array, a2aMessages: array, replayableHandoffs: array, toolReceipts: array, memoryReceipts: array, traceSummary: object }`
    - **Handler**: `server/index.js:4229`

15. `POST /api/active-task`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ title, objective, status, nextAction, blockers, completed }`
    - **Response**: `{ ok: true, task: object }`
    - **Handler**: `updateActiveTask()` (`server/index.js:378`)

### 3.3 Provider Credentials & Vault
16. `GET /api/provider-credentials/status`
    - **Auth**: Protected
    - **Response**: `{ ok: true, credentialVault: { available: bool, configured: bool, provider: string|null, model: string|null, apiUrlConfigured: bool, updatedAt: string|null } }`
    - **Handler**: `server/index.js:3325`

17. `POST /api/provider-credentials`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ provider: string, apiUrl: string, apiKey: string, model: string }`
    - **Response**: `{ ok: true, credentialVault: object, imageGeneration: object }`
    - **Handler**: `providerCredentialBroker.write()` (`electron/secure-vault.js:22`)

18. `POST /api/provider-credentials/clear`
    - **Auth**: Protected + Mutating Lock
    - **Response**: `{ ok: true, credentialVault: object, imageGeneration: object }`
    - **Handler**: `providerCredentialBroker.clear()` (`electron/secure-vault.js:46`)

19. `GET /api/data-protection/status`
    - **Auth**: Protected
    - **Response**: `{ ok: true, storage: object, bundles: array, dataDir: string, backupDir: string, cacheDir: string }`
    - **Handler**: `server/index.js:3354`

20. `POST /api/backups`
    - **Auth**: Protected + Mutating Lock
    - **Response**: `{ ok: true, backup: object, bundles: array }`
    - **Handler**: `createDataBundle()` (`server/backup-manager.js:49`)

21. `POST /api/backups/restore`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ fileName: string }`
    - **Response**: `{ ok: true, restored: object, state: object }`
    - **Handler**: `restoreDataBundle()` (`server/backup-manager.js:82`)

22. `POST /api/export-all`
    - **Auth**: Protected + Mutating Lock
    - **Response**: `{ ok: true, export: object }`
    - **Handler**: `createDataBundle(..., { kind: "export-all" })` (`server/index.js:3385`)

23. `POST /api/cache/cleanup`
    - **Auth**: Protected + Mutating Lock
    - **Response**: `{ ok: true, cleanup: { removed: int, reclaimedBytes: int, cacheDir: string, cleanedAt: string } }`
    - **Handler**: `cleanupLocalCache()` (`server/backup-manager.js:129`)

### 3.4 Tier Zero Agents & Content Pipeline
24. `GET /api/tier-zero/agents`
    - **Auth**: Protected
    - **Response**: `{ ok: true, agents: array, audit: object }`
    - **Handler**: `server/index.js:3405`

25. `GET /api/tier-zero/audit`
    - **Auth**: Protected
    - **Response**: `{ ok: bool, summary: object, violations: array }`
    - **Handler**: `auditTierZeroRuntime()` (`server/tier-zero-runtime.js:731`)

26. `POST /api/tier-zero/run`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ source: string, projectId?: string, sourceId?: string, agentId?: string }`
    - **Response**: `{ ...pack, generation: object }`
    - **Handler**: `runTierZeroNetwork()` (`server/tier-zero-runtime.js:755`)

27. `POST /api/run-agent`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ source: string, projectId?: string, sourceId?: string, agentId?: string }`
    - **Response**: `{ ...pack, generation: object }`
    - **Handler**: `server/index.js:4345` (invokes `runTierZeroNetwork`)

28. `POST /api/content-cluster`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ source: string, projectId?: string, sourceId?: string }`
    - **Response**: `{ ...cluster, generation: object }`
    - **Handler**: `makeContentCluster()` (`server/index.js:4386`)

29. `POST /api/frame`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ source: string, projectId?: string, sourceId?: string }`
    - **Response**: `{ ok: true, frame: object, generation: object }`
    - **Handler**: `makeFrame()` (`server/index.js:4329`)

30. `POST /api/autopilot`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ projectId?: string, direction?: string, sourceId?: string, unsavedSource?: string }`
    - **Response**: `{ ok: true, campaign: object }`
    - **Handler**: `createAutonomousCampaign()` (`server/index.js:4422`)

31. `POST /api/export`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ output: object, projectId?: string, sourceId?: string }`
    - **Response**: `{ ok: true, export: object, packetContract: object, packetSummary: object, traceSummary: object }`
    - **Handler**: `saveExport()` with QA gate enforcement (`server/index.js:4518`)

### 3.5 Agent Chat & LLM Bridge
32. `GET /api/agent-chat/status`
    - **Auth**: Protected
    - **Response**: `{ ok: true, live: bool, url: string, models: array, model: string, bridge: "ollama", fallback: "Instant Local Draft" }`
    - **Handler**: `ollamaStatus()` (`server/index.js:3316`)

33. `POST /api/agent-chat`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ message: string, agentId?: string, ability?: string, mode?: string, projectId?: string, sourceId?: string }`
    - **Response**: `{ ok: true, chat: object }`
    - **Handler**: `askOllama()` with deterministic local draft fallback (`server/index.js:3455`)

34. `POST /api/agent-chat/stream`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ message: string, agentId?: string, ability?: string, mode?: string, projectId?: string, sourceId?: string }`
    - **Response**: NDJSON event stream (`meta`, `draft`, `provider-status`, `upgrade-start`, `token`, `final`, `error`)
    - **Handler**: `streamOllama()` (`server/index.js:3516`)

35. `POST /api/instructions/generate`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ message: string }`
    - **Response**: `{ ok: true, instructions: string, generated: bool }`
    - **Handler**: Static pattern runbooks or LLM generation (`server/index.js:3608`)

### 3.6 Automations & Scheduler
36. `POST /api/automations`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ name, projectId, sourceDir, campaignType, operatorAsk, scheduleCron, timeZone, approvalMode, exportDir }`
    - **Response**: `{ ok: true, automation: object }`
    - **Handler**: `server/index.js:3785`

37. `PUT /api/automations/:id`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ name, projectId, sourceDir, campaignType, operatorAsk, scheduleCron, timeZone, approvalMode, exportDir }`
    - **Response**: `{ ok: true, automation: object }`
    - **Handler**: `server/index.js:3805`

38. `DELETE /api/automations/:id`
    - **Auth**: Protected + Mutating Lock
    - **Response**: `{ ok: true }`
    - **Handler**: `server/index.js:3820`

39. `POST /api/automations/:id/toggle`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ enabled: bool }`
    - **Response**: `{ ok: true, enabled: bool }`
    - **Handler**: `server/index.js:3830`

40. `POST /api/automations/:id/run`
    - **Auth**: Protected + Mutating Lock
    - **Response**: `{ ok: true, run: object }`
    - **Handler**: Queues manual execution (`server/index.js:3842`)

### 3.7 Vault, Intake & Media Management
41. `GET /api/intake/roots`
    - **Auth**: Protected
    - **Response**: `{ ok: true, roots: array, contentRoots: array, drives: array, removableDrives: array, fixedDrives: array, maxFiles: int, maxDirectories: int }`
    - **Handler**: `detectLocalDrives()` (`server/index.js:3874`)

42. `POST /api/intake/run`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ roots?: array, projectId?: string }`
    - **Response**: `{ ok: true, run: object, state: object }`
    - **Handler**: `runLocalIntake()` (`server/index.js:3889`)

43. `POST /api/intake/review`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ roots?: array, projectId?: string, query?: string }`
    - **Response**: `{ ok: true, review: object, state: object }`
    - **Handler**: `buildIntakeReview()` (`server/index.js:3900`)

44. `POST /api/intake/reviews/:id/apply`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ candidateIds: array }`
    - **Response**: `{ ok: true, run: object, review: object, result: object, state: object }`
    - **Handler**: `importReviewedCandidates()` (`server/index.js:3914`)

45. `POST /api/git/clone`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ repoUrl: string, branch?: string, token?: string, projectId?: string }`
    - **Response**: `{ ok: true, repoName, slug, url, branch, commit, localPath, sourceAdded, mediaAdded, stats, state }`
    - **Handler**: `gitEngine.cloneRepo()` (`server/git-ingest.js:118`)

46. `GET /api/git/repos`
    - **Auth**: Protected
    - **Response**: `{ ok: true, repos: array }`
    - **Handler**: `gitEngine.listRepos()` (`server/git-ingest.js:248`)

47. `GET /api/media/:id/preview`
    - **Auth**: Protected
    - **Response**: Binary image stream (`res.sendFile`)
    - **Handler**: `server/index.js:4057`

48. `POST /api/media/:id/open`
    - **Auth**: Protected + Mutating Lock
    - **Response**: `{ ok: true, id: string, path: string }`
    - **Handler**: Spawns `explorer.exe /select,<path>` (`server/index.js:4067`)

49. `POST /api/media/:id/rename`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ title: string }`
    - **Response**: `{ ok: true, media: object, state: object }`
    - **Handler**: `server/index.js:4084`

50. `POST /api/sources/:id/rename`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ title: string }`
    - **Response**: `{ ok: true, source: object, state: object }`
    - **Handler**: `server/index.js:4098`

51. `GET /api/projects`
    - **Auth**: Protected
    - **Response**: `{ ok: true, projects: array }`
    - **Handler**: `server/index.js:4111`

52. `POST /api/projects`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ id?: string, name: string, status?: string }`
    - **Response**: `{ ok: true, project: object }`
    - **Handler**: `upsertProject()` (`server/index.js:4115`)

53. `POST /api/projects/:id/export-vault` *(Primary Active Handler)*
    - **Auth**: Protected + Mutating Lock
    - **Response**: `{ ok: true, filename: string, filePath: string, relativePath: string, sha256: string, bundle: object }`
    - **Handler**: Line 4122 (Shadows duplicate at Line 4862)

54. `POST /api/projects/import-vault` *(Primary Active Handler)*
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ bundle?: object, filePath?: string }`
    - **Response**: `{ ok: true, project: object, addedSources: int, state: object }`
    - **Handler**: Line 4178 (Shadows duplicate at Line 4907)

55. `POST /api/sources`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ source: string, projectId?: string }`
    - **Response**: `{ ok: true, source: object }`
    - **Handler**: `saveSource()` (`server/index.js:4260`)

56. `POST /api/semantic/search`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ query: string, projectId?: string, lane?: string, limit?: int, minScore?: float, type?: string }`
    - **Response**: `{ ok: true, query: string, count: int, results: array }`
    - **Handler**: `semanticIndex.search()` (`server/semantic-memory.js:264`)

57. `GET /api/sources/:id/content`
    - **Auth**: Protected
    - **Response**: `{ ok: true, document: { id, projectId, title, content, sourceType, contentSource, characterCount } }`
    - **Handler**: `server/index.js:4297`

58. `GET /api/watchers`
    - **Auth**: Protected
    - **Response**: `{ ok: true, watchers: array }`
    - **Handler**: `folderWatcher.listWatchers()` (`server/folder-watcher.js:104`)

59. `POST /api/watchers`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ path: string, projectId?: string }`
    - **Response**: `{ ok: true, watcher: { id, path, projectId } }`
    - **Handler**: `folderWatcher.addWatchDirectory()` (`server/folder-watcher.js:20`)

60. `DELETE /api/watchers/:id`
    - **Auth**: Protected + Mutating Lock
    - **Response**: `{ ok: bool }`
    - **Handler**: `folderWatcher.removeWatchDirectory()` (`server/folder-watcher.js:89`)

### 3.8 Media Generation, Audio & Video
61. `GET /api/image-generation/status`
    - **Auth**: Protected
    - **Response**: `{ ok: true, configured: bool, available: bool, provider: string|null, model: string|null, ... }`
    - **Handler**: `server/index.js:3321`

62. `POST /api/image-generation/settings`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ externalImagesEnabled: bool }`
    - **Response**: `{ ok: true, settings: object, imageGeneration: object }`
    - **Handler**: `writeImageSettings()` (`server/index.js:3349`)

63. `POST /api/images/generate`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ campaignId: string, platform: string, prompt?: string }`
    - **Response**: `{ ok: true, image: object, campaign: object }`
    - **Handler**: `generateOriginalImage()` (`server/image-generation.js:146`)

64. `POST /api/images/save-source`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ imageId: string, campaignId?: string, platform?: string, projectId?: string }`
    - **Response**: `{ ok: true, source: object, media: object, state: object }`
    - **Handler**: `saveGeneratedImageAsSourceMaterial()` (`server/index.js:597`)

65. `POST /api/images/studio-generate`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ prompt: string, platform?: string, projectId?: string }`
    - **Response**: `{ ok: true, image: object }`
    - **Handler**: `generateOriginalImage()` (`server/image-generation.js:146`)

66. `GET /api/voice/profiles`
    - **Auth**: Protected
    - **Response**: `{ ok: true, profiles: array }`
    - **Handler**: `voiceEngine.listProfiles()` (`server/voiceover-engine.js:58`)

67. `POST /api/voice/synthesize`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ text: string, profileId?: string, speed?: float, pitch?: float, format?: string, remoteEndpoint?: string }`
    - **Response**: `{ ok: true, id, filename, filePath, relativePath, url, profile, text, wordCount, estimatedDurationSec, speed, pitch, synthesizedVia, format, subtitles }`
    - **Handler**: `voiceEngine.synthesizeSpeech()` (`server/voiceover-engine.js:62`)

68. `POST /api/voice/export-bundle`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ targetDir: string, filename: string, subtitles: { srt: string, vtt: string } }`
    - **Response**: `{ ok: true, targetDir: string, files: array }`
    - **Handler**: `server/index.js:4797`

69. `GET /api/video/status`
    - **Auth**: Protected
    - **Response**: `{ ok: true, ffmpeg: { available: bool, version: string|null, note?: string } }`
    - **Handler**: `videoEngine.checkFfmpeg()` (`server/video-engine.js:22`)

70. `POST /api/video/render-reel`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ imagePath?: string, audioPath?: string, srtContent?: string, title?: string, duration?: int, platform?: string }`
    - **Response**: `{ ok: true, id, filename, filePath, relativePath, url, title, platform, width, height, aspectRatio, durationSec, renderedVia, ffmpegAvailable, createdAt }`
    - **Handler**: `videoEngine.renderVerticalReel()` (`server/video-engine.js:31`)

71. `GET /api/waveform/styles`
    - **Auth**: Protected
    - **Response**: `{ ok: true, styles: array }`
    - **Handler**: `server/index.js:4978`

72. `POST /api/waveform/generate`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ durationSec?: int, style?: string, color?: string, width?: int, height?: int, sampleCount?: int }`
    - **Response**: `{ ok: true, style, color, width, height, durationSec, sampleCount, svgDataUrl, rawSvg }`
    - **Handler**: `generateWaveformSvg()` (`server/waveform-engine.js:45`)

### 3.9 Omnichannel Transmutation, Synthesis & Trends
73. `POST /api/synthesis/30-day-matrix`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ sourceText?: string, projectId?: string, theme?: string }`
    - **Response**: `{ ok: true, matrix: { totalDays: 30, weeksCount: 5, days: array, summary: object } }`
    - **Handler**: `generate30DayMatrix()` (`server/batch-synthesizer.js:88`)

74. `POST /api/synthesis/subtitles`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ scriptText: string, format?: "srt"|"vtt", wordsPerMinute?: int }`
    - **Response**: `{ ok: true, format, totalDurationSec, segmentCount, timedItems, trackContent }`
    - **Handler**: `generateSubtitleTrack()` (`server/batch-synthesizer.js:8`)

75. `POST /api/analytics/simulate`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ script: string, hook?: string, platform?: string }`
    - **Response**: `{ ok: true, simulation: { platform, viralityIndex, grade, scores, readingStats, retentionCurve, optimizationTips, simulatedAt } }`
    - **Handler**: `simulateAudienceRetention()` (`server/analytics-simulator.js:49`)

76. `POST /api/hooks/generate-variants`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ sourceText: string, topic?: string, platform?: string }`
    - **Response**: `{ ok: true, topic, platform, recommendedId, variants: array, generatedAt }`
    - **Handler**: `generateHookVariants()` (`server/hook-matrix.js:41`)

77. `POST /api/trends/analyze`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ text: string, niche?: string, platform?: string }`
    - **Response**: `{ ok: true, niche, platform, metrics, hookAnalysis, powerWords, counterPositioning, analyzedAt }`
    - **Handler**: `analyzeCompetitorContent()` (`server/trend-analyzer.js:22`)

78. `POST /api/transmute`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ sourceText?: string, title?: string, niche?: string, tone?: string, projectId?: string }`
    - **Response**: `{ ok: true, bundle: { id, title, niche, tone, assets: { reel, xThread, linkedIn, carousel, newsletter } } }`
    - **Handler**: `transmuteSourceToOmnichannel()` (`server/transmutation-studio.js:15`)

79. `POST /api/transmute/export`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ bundle: object, targetDir?: string }`
    - **Response**: `{ ok: true, bundleDir: string, filesCount: int, files: array }`
    - **Handler**: `exportOmnichannelToFolder()` (`server/transmutation-studio.js:207`)

### 3.10 Connectors & Webhooks
80. `POST /api/connectors/dispatch`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ webhookUrl: string, payload: any, format?: "json"|"text" }`
    - **Response**: `{ ok: bool, status: "delivered"|"error"|"network-error", statusCode: int, timestamp: string }`
    - **Handler**: `server/index.js:4552`

81. `POST /api/connectors/staging-sync`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ targetDir: string, files: array }`
    - **Response**: `{ ok: true, targetDir: string, writtenCount: int, files: array }`
    - **Handler**: `server/index.js:4602`

82. `POST /api/connectors/test-webhook`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ webhookUrl: string, secret?: string, payload?: object }`
    - **Response**: `{ ok: bool, statusCode: int, latencyMs: int, responseSummary: string, testedAt: string }`
    - **Handler**: `server/index.js:4626`

### 3.11 Publishing Queue & Simulated Dispatch (THEATER)
83. `GET /api/publishing/accounts`
    - **Auth**: Protected
    - **Response**: `{ ok: true, accounts: [{ platform: "youtube", name: "Official YouTube Channel (Shorts)", status: "connected", handles: "@wakeengine" }, ... ] }`
    - **Handler**: `socialPublisher.getAccounts()` (`server/social-publisher.js:49`)

84. `GET /api/publishing/queue`
    - **Auth**: Protected
    - **Response**: `{ ok: true, queue: array }`
    - **Handler**: `socialPublisher.listQueue()` (`server/social-publisher.js:54`)

85. `POST /api/publishing/stage`
    - **Auth**: Protected + Mutating Lock
    - **Payload**: `{ projectId?: string, platform?: string, title?: string, content?: string, mediaPath?: string, scheduledAt?: string, hashtags?: array }`
    - **Response**: `{ ok: true, item: object }`
    - **Handler**: `socialPublisher.stagePost()` (`server/social-publisher.js:62`)

86. `POST /api/publishing/dispatch/:id`
    - **Auth**: Protected + Mutating Lock
    - **Response**: `{ ok: true, item: object, receipt: { publishedAt: string, externalId: string, postUrl: string, platform: string, latencyMs: int, mediaDelivered: bool, status: "delivered", signature: string } }`
    - **Handler**: `socialPublisher.dispatchPost()` (**Simulated fake API dispatch**) (`server/social-publisher.js:93`)

87. `DELETE /api/publishing/:id`
    - **Auth**: Protected + Mutating Lock
    - **Response**: `{ ok: true, deleted: bool }`
    - **Handler**: `socialPublisher.deletePost()` (`server/social-publisher.js:134`)

---

## 4. Background Jobs, Schedulers & Asynchronous Processes

| Component | File / Source | Frequency / Trigger | Execution Mechanism | State Persistence & Side Effects |
|---|---|---|---|---|
| **Deterministic Automation Scheduler** | `server/scheduler.js:417` (`startScheduler`) | `setInterval` (default: 60,000ms, unreferenced) | Evaluates cron expressions per automation against IANA timezones; computes SHA-256 hash of `sourceDir`; invokes `runTierZeroNetwork` | Mutates `store.automations`, `store.automationRuns`, `store.reviewQueue`, `store.history`. If `approvalMode === "Auto Export"`, writes `.md` and `.json` to `exportDir`. |
| **Local Folder Watcher** | `server/folder-watcher.js:11` (`LocalFolderWatcher`) | Continuous file system events via `fs.watch` | 5000ms debounce map on detected file paths; checks non-zero file size; invokes `onFileDetected` | Calls `saveSource()` on detected text files, writes durable store, records monitor logs |
| **System Telemetry Polling** | `server/index.js:507` (`systemMetrics`) | On demand (`GET /api/system`) | Runs PowerShell CIM/performance counter queries via `execFileAsync("powershell.exe", ...)` for GPU; samples `os.cpus()` / `os.totalmem()` | Appends to in-memory `monitorLog` (bounded to 24 items) and `server/data/logs/wake-engine.ndjson` |
| **Durable Store Compaction** | `server/durable-storage.js:447` (`compactJournal`) | Triggered on write when journal > 4MB | Reads all records, filters out non-terminal active pending transactions, writes checkpoint record, rewrites journal atomically | Replaces `.ndjson` journal with compacted checkpoint |
| **Automatic Backup Rotation** | `server/durable-storage.js:472` (`rotateBackups`) | Triggered on every state store write | Lists files in `server/data/backups/automatic/`, sorts by mtime descending, deletes files exceeding retention (default: 24) | Prunes historical snapshot `.json` files |

---

## 5. Storage System & Durability Deep Dive (`server/durable-storage.js`)

### 5.1 Atomic Write Protocol (`writeFileAtomic`)
The atomic write implementation follows an enterprise 7-phase commit sequence:
1. **Disk Pre-check**: Checks `statfsSync` for `MIN_FREE_BYTES` (64 MB) or 4x payload size.
2. **Exclusive Stage Write**: Writes payload to `${filePath}.tmp-${transactionId}` with exclusive creation flag (`wx`).
3. **Data Flush**: Calls `fs.fsyncSync(descriptor)` to flush disk controller buffers.
4. **Integrity Validation**: Computes SHA-256 of written file and asserts equality against source payload.
5. **Previous State Safeguard**: If target file exists, renames it to `${filePath}.previous`.
6. **Atomic Rename & Directory Sync**: Renames temp file to target path via `fs.renameSync()`, then calls `fsyncFile(filePath)` and `fsyncDirectory(path.dirname(filePath))`.
7. **Clean / Rollback**: Removes `${filePath}.previous` on success. On failure, restores `${filePath}.previous` back to `${filePath}`.

### 5.2 Write-Ahead Log (WAL) & Hash Chain Architecture
- **Schema Version**: WAL Version 3 with cryptographic chaining.
- **Chain Digest**: Every journal record includes monotonic `sequence`, `previousRecordHash`, and `recordHash` computed via `fileHash(JSON.stringify(cleanRecord))`.
- **Integrity Enforcement**: During journal replay, `readJournalRecords()` asserts that `record.previousRecordHash === previous.recordHash` and `record.sequence === previous.sequence + 1`. Detects chain tampering, truncation, and legacy downgrades.
- **Torn Tail Auto-Repair**: If a crash occurs during a journal write resulting in a truncated JSON line at EOF (with no trailing newline), `readJournalRecords()` identifies the torn tail, strips the broken fragment, rewrites the repaired journal atomically via `writeFileAtomic()`, and increments `tornTailRecoveries`.

### 5.3 Crash Recovery & Transaction Replay/Rollback
- **WAL Recovery (`_recoverWal()`)**: Identifies all uncommitted transactions (pending without terminal `committed`, `recovered-commit`, or `rolled-back` marker).
- **Forward Replay**: If the transaction's stage file (or target file matching `newHash`) is intact, replays payload to primary file, writes `.sha256` and `.meta.json`, and records `recovered-commit`.
- **Backward Rollback**: If replay data is unavailable, checks `.previous`, automatic backups, or previous primary hash matching `previousHash`, restores old state, and records `rolled-back`.
- **Unrecoverable State Guard**: If neither replay nor rollback candidates verify against expected hashes, throws `WAKE_WAL_UNRECOVERABLE`.

### 5.4 Process Locking & Concurrency Control
- **Lock Primitive**: Mutex lock implemented as a directory `${filePath}.lock` containing `owner.json` (stores `pid`, `processInstanceId`, `nonce`, and `acquiredAt`).
- **Abandoned Lock Reclamation**: Checks if the locking PID is alive via `processIsAlive(pid)` (`process.kill(pid, 0)`). Reclaims stale locks if owner PID is dead or PID was recycled with a different `processInstanceId`.
- **Re-entrant Depth**: Tracks `this.lockDepth` to allow nested with-lock calls in the same process.
- **Request Serialization Middleware**: `serializeMutatingRequest` queues all non-GET/HEAD/OPTIONS HTTP requests through a serial promise chain and holds `durableStore.beginExclusiveMutation()` until the HTTP response closes.

---

## 6. Security, Authentication & Credential Vault Analysis

### 6.1 Session & Access Phrase Protection (`server/local-session.js`)
- **Key Derivation**: Uses Node `crypto.scryptSync(phrase, salt, 64)`.
- **Salt Generation**: 24 cryptographically random bytes (`crypto.randomBytes(24)`).
- **Constant-Time Verification**: Uses `crypto.timingSafeEqual` to prevent timing attacks.
- **Session Tokens**: 32-byte Base64URL tokens stored in an in-memory `Map` (12-hour TTL).
- **Cookie Security**: `HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`.
- **CSRF Token**: 24-byte random CSRF token checked via `x-wake-csrf` header for all mutating HTTP verbs (`POST`, `PUT`, `DELETE`, `PATCH`).

### 6.2 Biometric / Windows Hello FIDO2 Verification (`server/local-session.js`)
- **Challenge Life Cycle**: 32-byte Base64URL challenge with 2-minute TTL.
- **Relying Party Binding**: Asserts `clientData.origin` matches loopback host (`127.0.0.1`, `localhost`, `[::1]`) and RP ID hash matches `authenticatorData.subarray(0, 32)`.
- **User Presence & Verification**: Verifies `authenticatorData[32]` flags (requires User Present `0x01` and User Verified `0x04`).
- **Cryptographic Signature**: Uses `crypto.verify("sha256", signedData, publicKey, signature)` with SPKI DER public keys.
- **Replay Protection**: Verifies monotonic counter advancement (`signCount > credential.signCount`).

### 6.3 Credential Vault & OS Keychain Protection (`electron/secure-vault.js`)
- **Encryption**: Leverages Electron's `safeStorage.encryptString()` / `safeStorage.decryptString()`, backed by Windows Data Protection API (DPAPI) under current user credentials.
- **Storage File**: `provider-credentials.bin` in Electron secure directory.
- **Zero Plaintext Token Leakage**:
  - `status()` returns `{ available, configured, provider, model, apiUrlConfigured, updatedAt }` — API keys are NEVER exposed in status responses or logs.
  - Standalone server startup (without Electron) defaults `providerCredentialBroker` to `null` and rejects credential modifications with HTTP 503 (`SECURE_STORAGE_UNAVAILABLE`).

---

## 7. Theater, Mock Data & Simulated Operations Inventory

| ID | File & Line | Component | Detected Mock / Theater Pattern | Reality / Functional Discrepancy |
|---|---|---|---|---|
| **TH-01** | `server/social-publisher.js:26-33` | Social Publisher Accounts | Hardcoded mock accounts: `@wakeengine` (YouTube), `@wake.engine` (TikTok), `WAKE Engine Systems` (LinkedIn), `@WakeEngineHQ` (X) with `"status": "connected"` | No OAuth, API keys, or platform credentials exist. Accounts are static boilerplate objects. |
| **TH-02** | `server/data/publishing-queue.json:1-33` | Stored Publishing Accounts | JSON seed file containing hardcoded social accounts with `"status": "connected"` | Persisted seed data presenting unauthenticated social channels as active and connected. |
| **TH-03** | `server/social-publisher.js:104-128` | Social Dispatch Engine | `dispatchPost()` creates fake URLs (`https://www.tiktok.com/@wake.engine/video/...`), fake SHA-256 signatures, and random simulated latency (`Math.random() * 80 + 45`), returning `"status": "delivered"` | No social network API calls are made. It is 100% simulated dispatch theater. |
| **TH-04** | `server/index.js:1078-1087` | Command Console Task Monitor | Static array of 8 tasks (`WAKE-001` to `WAKE-008`) with hardcoded statuses (`"running"`, `"done"`) and relative timestamps (`"2m ago"`, `"now"`) | Returned in every `GET /api/state` response; `runtime.queue` is hardcoded to 4. Tasks do not correspond to actual background threads. |
| **TH-05** | `server/video-engine.js:69-84` | Video Rendering Compositor | When FFmpeg is missing, writes a JSON string to a file with extension `.mp4` | File claims to be an `.mp4` video but is actually raw JSON text. |
| **TH-06** | `server/voiceover-engine.js:98-121` | Neural Voiceover Engine | If `remoteEndpoint` is null, returns metadata pointing to `/generated-audio/...` without writing any audio file | Client receives a 200 OK with an audio URL, but the file does not exist on disk. |
| **TH-07** | `server/hook-matrix.js:46-87` | Hook Variant Experimentation | Hardcoded scores (`tensionScore: 88, 94, 85, 92, 90`) and static string templates | Purports to perform live virality analysis but uses hardcoded static scores. |
| **TH-08** | `server/batch-synthesizer.js:88-150` | 30-Day Matrix Generator | Generates 30 calendar days using modular arithmetic on 4 hardcoded pillars and boilerplate sentences | Repetitive static templates claiming full 30-day cross-platform synthesis. |
| **TH-09** | `server/transmutation-studio.js:15-205` | 1-Click Omnichannel Transmutation | Slices first 2 sentences and embeds them into static markdown templates for Reels, Threads, LinkedIn, etc. | Template fill-in without semantic comprehension or LLM generation. |
| **TH-10** | `server/index.js:4122 & 4862` | Duplicate Route Registrations | `POST /api/projects/:id/export-vault` and `POST /api/projects/import-vault` registered twice | Second registrations at 4862 and 4907 are completely dead/shadowed code. |
| **TH-11** | `server/index.js:4781 & 4823` | Route Security Disparity | `/generated-audio` and `/generated-videos` static endpoints lack `sessionManager.require` | Inconsistent auth boundaries compared to `/generated-images`. |

---

## 8. Final Technical Assessment & Readiness Verdict

- **Storage & WAL Engine**: **ELITE / VERIFIED**. `server/durable-storage.js` demonstrates exceptional engineering rigor with atomic commits, hash-chained journals, crash recovery, and directory locking.
- **Security & Session Vault**: **VERIFIED**. DPAPI integration in Electron and Scrypt + WebAuthn in `local-session.js` adhere to local-first security standards.
- **Social Publishing Subsystem**: **UNACCEPTABLE THEATER**. Direct social posting is simulated with fake accounts and fake dispatch receipts. Must be either backed by real connectors or truthfully labeled as manual export staging.
- **Video & Audio Fallback Manifests**: **REQUIRES REFACTORING**. Writing JSON manifests with `.mp4` extensions or returning audio URLs for non-existent files violates contract truthfulness.
