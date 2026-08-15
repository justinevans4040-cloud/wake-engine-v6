# Handoff Report — Track 3: Interactive Surface & API Contract Forensic Audit

**Auditor**: Surface & API Forensic Auditor (`auditor_surfaces_api_1`)  
**Target**: WAKE Engine V6 Client UI, App Shell, 9 Product Surfaces, Server API, and Background Schedulers  
**Integrity Mode**: Adversarial Benchmark  
**Date**: 2026-08-15  
**Working Directory**: `C:\Users\justi\.gemini\antigravity\scratch\wake-engine-v6\.agents\auditor_surfaces_api_1`  
**Artifact Generated**: `.agents/auditor_surfaces_api_1/interactive_surface_audit.md`  

---

## 1. Observation

Direct, empirical observations across `src/`, `server/`, and `electron/`:

1. **Fatal `TypeError` in Vault Intake Review Selection (`src/components/tabs/VaultTab.jsx:733`)**:
   - `src/main.jsx:144`: `const [intakeReviewSelection, setIntakeReviewSelection] = useState([]);`
   - `src/main.jsx:1118-1120`: `function toggleReviewCandidate(candidateId) { setIntakeReviewSelection((current) => current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId]); }`
   - `src/components/tabs/VaultTab.jsx:733`: `const selected = intakeReviewSelection.has(candidate.reviewId);`
   - Calling `.has()` on an Array `[]` throws `TypeError: intakeReviewSelection.has is not a function`, crashing the entire React component tree when intake review candidates are rendered.

2. **Broken Empty Review Modal in Automations Review Queue (`src/components/tabs/AutomationsTab.jsx:613` vs `src/main.jsx:1776-1845`)**:
   - `src/components/tabs/AutomationsTab.jsx:613`: `<button className="primary-action" onClick={() => setModal({ type: "review", data: r })}>View Generated Packet</button>`
   - `src/main.jsx:1776-1845`: Modal renderer only renders `modal.title`, `modal.body`, `modal.kind`, `modal.action`, etc. `modal.type === "review"` is unhandled, rendering an empty `<h2></h2><p></p>` modal with a solitary "Close" button. Operator cannot view packet contents or approve/reject.

3. **Hardcoded Project ID in Diffusion Studio (`src/components/tabs/AgentsTab.jsx:141`)**:
   - `src/components/tabs/AgentsTab.jsx:138-142`: Calls `api("/api/images/studio-generate", "POST", { prompt: imagePrompt, platform: platformRatio, projectId: "wake-v6-main" })` with hardcoded `"wake-v6-main"`.

4. **100% Orphaned Zustand Store (`src/store/useWakeStore.js:1-80`)**:
   - `src/store/useWakeStore.js` defines an 80-line Zustand store.
   - Codebase search reveals zero imports or references across `src/`. `src/main.jsx` duplicates state using monolithic `useState` hooks.

5. **Zero React Error Boundaries in Application**:
   - Zero instances of `<ErrorBoundary>` or `componentDidCatch` across `src/main.jsx` and `src/`.

6. **Direct Social Publishing Theater (`server/social-publisher.js:26-33, 104-128` & `AutomationsTab.jsx:345-420`)**:
   - `server/social-publisher.js:26-33`: Returns hardcoded accounts for YouTube, TikTok, LinkedIn, and X with `"status": "connected"`.
   - `server/social-publisher.js:104-128`: `dispatchPost()` generates fake SHA-256 signatures, fake URLs (`https://www.tiktok.com/@wake.engine/video/...`), and simulated random latency (`Math.random() * 80 + 45ms`), returning `"status": "delivered"`.
   - `AutomationsTab.jsx:345-356`: Renders green "Connected" badges without OAuth or real platform credentials.

7. **Duplicate Shadowed API Routes (`server/index.js:4122 & 4862`, `4178 & 4907`)**:
   - `POST /api/projects/:id/export-vault` registered at Line 4122 and Line 4862.
   - `POST /api/projects/import-vault` registered at Line 4178 and Line 4907.
   - Second registrations are completely shadowed and unreachable.

8. **Static Media Auth Disparity (`server/index.js:4781 & 4823`)**:
   - `/generated-images` enforces `sessionManager.require` (Line 3290).
   - `/generated-audio` (Line 4781) and `/generated-videos` (Line 4823) lack `sessionManager.require`.

---

## 2. Logic Chain

1. **Premise**: In React, invoking a Set method (`.has()`) on an Array primitive (`[]`) throws a fatal runtime `TypeError`.
   - **Step**: `main.jsx:144` declares `intakeReviewSelection` as `[]`. `VaultTab.jsx:733` calls `intakeReviewSelection.has()`.
   - **Deduction**: Reviewing intake candidates on Surface 4 (Vault) deterministically crashes the application.

2. **Premise**: When a UI component dispatches modal state whose shape does not match the universal modal renderer's contract, the modal will render blank.
   - **Step**: `AutomationsTab.jsx:613` dispatches `{ type: "review", data: r }`. `main.jsx:1776-1845` only reads `title`, `body`, `kind`, `action`.
   - **Deduction**: The Review Queue modal on Surface 9 is broken, preventing operators from inspecting or approving draft packets.

3. **Premise**: Hardcoding a default `projectId` breaks tenant and project isolation.
   - **Step**: `AgentsTab.jsx:141` hardcodes `"wake-v6-main"` in `handleGenerateImage`.
   - **Deduction**: Image generation in Diffusion Studio attaches media assets to the default project regardless of which project the operator is currently working in.

4. **Premise**: Displaying "Connected" badges and returning "Delivered" receipts with fake URLs and random sleep timers when no external network connection or credentials exist constitutes mock theater.
   - **Step**: `server/social-publisher.js` and `AutomationsTab.jsx` implement hardcoded accounts and simulated latency.
   - **Deduction**: The social publishing subsystem violates Benchmark Mode integrity and must be flagged as theater.

5. **Premise**: Duplicate route registrations in Express shadow subsequent handlers.
   - **Step**: `export-vault` and `import-vault` are registered at lines 4122/4178 and lines 4862/4907.
   - **Deduction**: The second set of route handlers is dead code.

---

## 3. Caveats

- Operating system audio synthesis (`window.speechSynthesis`) and voice recognition (`webkitSpeechRecognition` / Web Speech API) depend on host browser/Electron capabilities and audio hardware availability.
- Video reel rendering (`server/video-engine.js`) depends on local `ffmpeg` availability on the host PATH; when FFmpeg is not installed, it writes a JSON fallback manifest.

---

## 4. Conclusion

**Verdict: NOT READY (FAIL)**.
The WAKE Engine V6 interactive surface and API layer possesses exceptional architectural strengths in WAL durability, local FIDO2/biometrics, and deterministic cron scheduling. However, it fails hostile audit due to:
1. Fatal runtime crash on Surface 4 (`VaultTab.jsx:733`).
2. Broken review modal on Surface 9 (`AutomationsTab.jsx:613`).
3. Direct social publishing theater with fake "Connected" accounts and simulated dispatch receipts.
4. Shadowed duplicate API routes and missing auth middleware on static media.
5. Complete absence of React error boundaries and orphaned Zustand store code.

---

## 5. Verification Method

To independently reproduce and verify all findings:

1. **Verify Fatal TypeError in VaultTab**:
   - Inspect `src/components/tabs/VaultTab.jsx:733` vs `src/main.jsx:144`.
   - Check that `intakeReviewSelection` is declared as an Array in `main.jsx:144` and called with `.has()` in `VaultTab.jsx:733`.

2. **Verify Broken Review Modal in AutomationsTab**:
   - Inspect `src/components/tabs/AutomationsTab.jsx:613` vs `src/main.jsx:1776-1845`.
   - Check that `setModal({ type: "review", data: r })` is passed, while `main.jsx` renders `modal.title` and `modal.body`.

3. **Verify Orphaned Zustand Store**:
   - Run `Get-ChildItem -Path src -Recurse -Include *.jsx,*.js | Select-String "useWakeStore"`.
   - Observe only the declaration in `src/store/useWakeStore.js:3`.

4. **Verify Shadowed Duplicate Routes**:
   - Inspect `server/index.js` at line 4122 vs line 4862 (`POST /api/projects/:id/export-vault`) and line 4178 vs line 4907 (`POST /api/projects/import-vault`).

5. **Verify Social Publisher Theater**:
   - Inspect `server/social-publisher.js:26-33` and `server/social-publisher.js:104-128`.
