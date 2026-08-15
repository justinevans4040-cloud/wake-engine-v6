# Phase 0 Client/UI Exhaustive Adversarial Audit Handoff

## 1. Observation
- **O1: Fatal `TypeError` in Intake Review Candidate Checkbox (`src/components/tabs/VaultTab.jsx:733`)**:
  - `src/main.jsx:144`: `const [intakeReviewSelection, setIntakeReviewSelection] = useState([]);`
  - `src/main.jsx:1118-1120`: `setIntakeReviewSelection((current) => current.includes(candidateId) ? current.filter(...) : [...current, candidateId]);`
  - `src/components/tabs/VaultTab.jsx:733`: `const selected = intakeReviewSelection.has(candidate.reviewId);`
  - Verbatim error at runtime: `TypeError: intakeReviewSelection.has is not a function`. Calling `Set.prototype.has` on an `Array` crashes React.

- **O2: Empty / Broken Review Modal in Automations Review Queue (`src/components/tabs/AutomationsTab.jsx:613`)**:
  - `src/components/tabs/AutomationsTab.jsx:613`: `onClick={() => setModal({ type: "review", data: r })}`
  - `src/main.jsx:1777-1845`: The universal modal only renders `modal.title`, `modal.body`, `modal.kind`, `modal.meta`, `modal.previewUrl`, `modal.rename`, `modal.sourceItem`, `modal.mediaItem`, `modal.action`. It does NOT handle `modal.type === "review"` or `modal.data`.
  - Clicking "View Generated Packet" displays an empty modal header and empty body with only a "Close" button.

- **O3: Hardcoded Mock Social Accounts with Fake "Connected" Badges (`server/social-publisher.js:27-32`, `src/components/tabs/AutomationsTab.jsx:345-356`)**:
  - `server/social-publisher.js:27-32`:
    ```javascript
    getDefaultAccounts() {
      return [
        { platform: "youtube", name: "Official YouTube Channel (Shorts)", status: "connected", accountId: "yt-wake-engine", handles: "@wakeengine" },
        { platform: "tiktok", name: "TikTok Creator Portal", status: "connected", accountId: "tt-wake-official", handles: "@wake.engine" },
        { platform: "linkedin", name: "LinkedIn Organization Page", status: "connected", accountId: "li-wake-hq", handles: "WAKE Engine Systems" },
        { platform: "x", name: "X / Twitter Broadcast Feed", status: "connected", accountId: "x-wake-hq", handles: "@WakeEngineHQ" }
      ];
    }
    ```
  - `src/components/tabs/AutomationsTab.jsx:349-353`:
    ```jsx
    <span style={{ fontSize: "0.7rem", color: "var(--live)", display: "flex", alignItems: "center", gap: "3px" }}>
      <CheckCircle2 size={12} /> Connected
    </span>
    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{acc.handles}</div>
    ```
  - No OAuth handshake, token exchange, or live platform API connections exist for these accounts.

- **O4: Simulated Social Publishing & Synthetic Delivery Receipts (`server/social-publisher.js:104-124`)**:
  - `server/social-publisher.js:104-124`:
    ```javascript
    // Simulate direct platform API dispatch with signature receipt
    const digest = crypto.createHash("sha256").update(`${item.id}-${Date.now()}`).digest("hex");
    const externalId = `${platform.slice(0, 2)}-${digest.slice(0, 12)}`;
    const latencyMs = Math.floor(Math.random() * 80) + 45;

    let postUrl = "";
    if (platform.includes("tiktok")) postUrl = `https://www.tiktok.com/@wake.engine/video/${externalId}`;
    else if (platform.includes("youtube")) postUrl = `https://youtube.com/shorts/${externalId}`;
    else if (platform.includes("linkedin")) postUrl = `https://www.linkedin.com/feed/update/urn:li:share:${externalId}`;
    else postUrl = `https://x.com/WakeEngineHQ/status/${externalId}`;
    ```

- **O5: Hardcoded `projectId: "wake-v6-main"` in Diffusion Studio (`src/components/tabs/AgentsTab.jsx:141`)**:
  - `src/components/tabs/AgentsTab.jsx:138-142`:
    ```javascript
    const res = await api("/api/images/studio-generate", "POST", {
      prompt: imagePrompt,
      platform: platformRatio,
      projectId: "wake-v6-main"
    });
    ```
  - Disregards active `projectId` prop in multi-project workspaces.

- **O6: Orphaned Zustand Store (`src/store/useWakeStore.js:1-80`)**:
  - `src/store/useWakeStore.js` defines an 80-line Zustand store.
  - File search across `src/` confirms 0 imports or references. All state is duplicated/managed in `src/main.jsx` via React `useState` hooks.

- **O7: Zero React Error Boundaries**:
  - Search across `src/` confirms no `ErrorBoundary` component or `componentDidCatch` lifecycle exists. Any uncaught rendering exception causes total application crash to a blank screen.

---

## 2. Logic Chain
1. From **O1**, `intakeReviewSelection` is passed as an Array from `main.jsx` to `VaultTab.jsx` and `IntakePanel`. In `VaultTab.jsx:733`, invoking `intakeReviewSelection.has()` on an Array produces an immediate `TypeError` when `intakeReview` candidates are rendered.
2. From **O7**, because no Error Boundary exists, this `TypeError` bubbles to the root and unmounts the entire React application tree, resulting in a blank screen for the user when reviewing intake items.
3. From **O2**, when an operator clicks "View Generated Packet" in the Review Queue, `setModal({ type: "review", data: r })` is called. The modal renderer in `main.jsx` only looks for `modal.title` and `modal.body`, leaving the review packet invisible and unreviewable.
4. From **O3** and **O4**, the UI displays "Connected" green badges for `@wakeengine`, `@wake.engine`, `@WakeEngineHQ`, and clicking "Publish Now" generates synthetic delivery receipts with fake post URLs and randomized latency. This is pure simulation/theater.
5. From **O5**, images generated via Vision Studio always write to `"wake-v6-main"` regardless of active project.
6. From **O6**, `useWakeStore.js` is dead code.

---

## 3. Caveats
- Evaluated client UI behavior and contracts against backend API endpoints. Backend database durability and server-side scheduler internals are investigated in separate backend/durability tracks.
- Web Speech API behavior (`SpeechToTextButton`) is dependent on browser runtime environment; in standard Electron builds without Google API keys, speech recognition fails gracefully and falls back to typed input.

---

## 4. Conclusion
The client/UI codebase contains functional UI implementations for Console, Agents, Content Cluster, 30-Day Matrix, Omnichannel Transmutation, Library, System Monitor, and Audit snapshots. However, Phase 0 hostile audit reveals critical defects:
1. **FATAL CRASH**: `TypeError` on Vault intake candidate checkbox (`.has()` instead of `.includes()`).
2. **BROKEN UI**: Review Queue modal fails to render generated packets.
3. **THEATER**: Hardcoded social accounts displaying fake "Connected" status and simulated dispatch receipts.
4. **RESILIENCE**: Total lack of React Error Boundaries.

---

## 5. Verification Method
1. **Verify TypeError in VaultTab**:
   - Inspect `src/components/tabs/VaultTab.jsx` line 733 vs `src/main.jsx` line 144.
   - Run: `pwsh -Command "Get-Content src/components/tabs/VaultTab.jsx | Select-String 'intakeReviewSelection\.has'"`
2. **Verify Broken Modal in Review Queue**:
   - Inspect `src/components/tabs/AutomationsTab.jsx` line 613 vs `src/main.jsx` lines 1777-1845.
3. **Verify Mock Social Accounts**:
   - Inspect `server/social-publisher.js` lines 27-32 and 104-124.
4. **Verify Orphaned Store**:
   - Run: `pwsh -Command "Get-ChildItem -Path src -Recurse -File | Select-String 'useWakeStore'"`
