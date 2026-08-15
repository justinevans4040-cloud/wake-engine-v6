# WAKE Engine V6 — Interactive Surface & API Contract Forensic Audit Report

**Audit Target**: `src/` (Client UI), `server/` (Backend & Scheduler), `electron/` (Host Runtime)  
**Integrity Mode**: Adversarial Benchmark (Strict Empirical Verification)  
**Audit Track**: Track 3 — Interactive Surface & API Contract Forensic Audit  
**Auditor**: Surface & API Forensic Auditor (`auditor_surfaces_api_1`)  
**Date**: 2026-08-15  
**Project Root**: `C:\Users\justi\.gemini\antigravity\scratch\wake-engine-v6`  

---

## 1. Executive Summary & Hostile Audit Verdict

An exhaustive, line-by-line adversarial forensic audit was conducted across all 9 product surfaces, app shell components, modals, and all 87 Express/Node.js API endpoint handlers.

### Overall Track 3 Verdict: **NOT READY (FAIL)**

| Subsystem / Surface | Total Components / Endpoints | Live Verified Contracts | Broken / Dead Contracts | Theater / Mock Elements | Verdict |
|---|---|---|---|---|---|
| **App Shell & Header** | 7 components / controls | 16 | 0 | 0 | **PASS** |
| **Surface 1: Console** | 12 controls / forms | 18 | 0 | 0 | **PASS** |
| **Surface 2: Agents** | 8 controls / views | 11 | 1 (Hardcoded `projectId`) | 0 | **WARN** |
| **Surface 3: Cluster** | 14 controls / studios | 22 | 0 | 2 (Fake `.mp4` JSON, phantom audio) | **WARN** |
| **Surface 4: Vault** | 16 controls / panels | 15 | 1 (**Fatal `TypeError` crash**) | 0 | **FAIL** |
| **Surface 5: Library** | 4 list panels | 8 | 0 | 0 | **PASS** |
| **Surface 6: Monitor** | 12 telemetry views | 14 | 0 | 1 (Hardcoded task telemetry) | **WARN** |
| **Surface 7: Audit** | 2 receipt views | 2 | 0 | 0 | **PASS** |
| **Surface 8: Automations** | 12 automation actions | 15 | 0 | 0 | **PASS** |
| **Surface 9: Review Queue** | 6 queue actions | 2 | 1 (**Blank review modal**) | 2 (**Fake accounts & fake dispatch**) | **FAIL** |
| **Operations Guide** | 3 guide controls | 3 | 0 | 0 | **PASS** |
| **Client State Store** | `useWakeStore.js` (80 lines) | 0 | 1 (**100% Dead / Orphaned Code**) | 0 | **DEAD CODE** |
| **Error Boundaries** | Entire React tree | 0 | 1 (**Zero Error Boundaries**) | 0 | **FAIL** |
| **API Endpoints** | 87 route registrations | 83 | 2 (**Shadowed Duplicate Routes**) | 2 (Auth bypass disparity) | **WARN** |

### Summary of Critical Violations:
1. **Fatal Runtime Crash in Vault (`VaultTab.jsx:733`)**: Rendering candidate checkboxes in Intake Review invokes `intakeReviewSelection.has()` on a state variable initialized as an Array `[]` in `main.jsx:144`. Throws unhandled `TypeError: intakeReviewSelection.has is not a function` which crashes the component tree.
2. **Broken Empty Review Modal (`AutomationsTab.jsx:613`)**: Clicking "View Generated Packet" calls `setModal({ type: "review", data: r })`. The universal modal renderer in `main.jsx:1776-1845` only handles `modal.kind`, `modal.title`, `modal.body`, rendering an empty `<h2></h2><p></p>` modal with no packet content or approval actions.
3. **Direct Social Publishing Theater (`server/social-publisher.js` & `AutomationsTab.jsx:345-420`)**: UI displays green "Connected" status badges for hardcoded mock accounts (`@wakeengine`, `@wake.engine`, `@WakeEngineHQ`, `WAKE Engine Systems`) with zero OAuth credentials, and simulates platform delivery with random latency (`Math.random() * 80 + 45ms`) and synthetic URLs.
4. **Duplicate Shadowed API Routes (`server/index.js:4862 & 4907`)**: `POST /api/projects/:id/export-vault` and `POST /api/projects/import-vault` are registered twice; the second registrations are dead code.
5. **Static Media Auth Disparity (`server/index.js:4781 & 4823`)**: `/generated-images` enforces session auth, while `/generated-audio` and `/generated-videos` lack `sessionManager.require`.
6. **Completely Orphaned Zustand Store (`src/store/useWakeStore.js`)**: 80 lines of store code are never imported anywhere in `src/`.
7. **Total Absence of React Error Boundaries**: No `<ErrorBoundary>` or `componentDidCatch` exists in `src/`.

---

## 2. Exhaustive UI Surface & Component Test Matrix

### Surface 1: Console (`src/components/tabs/ConsoleTab.jsx`)
*Mission*: Transform raw tasks, briefs, transcripts, or notes into framed source packets and multi-platform campaign drafts.

| UI Element / Button | Line | Handler / Trigger | Target API / State | Behavior & Forensic Verification | Status |
|---|---|---|---|---|---|
| **Direction Textarea** | `78` | `onChange={(e) => setDirection(e.target.value)}` | Local state `direction` | Captures campaign direction text buffer | **PASS** |
| **Speak Direction** | `72` | `SpeechToTextButton.onTranscript` | `setDirection(prev + text)` | Web Speech API speech recognition dictation | **PASS** |
| **Create Campaign** | `84` | `onClick={createCampaign}` | `POST /api/autopilot` | Triggers multi-stage campaign generation (timeout 240s) | **PASS** |
| **Platform Switcher** | `125` | `onClick={() => setSelectedPlatform(item.id)}` | Local state `selectedPlatform` | Switches active preview between TikTok, Instagram, X, LinkedIn | **PASS** |
| **Copy Copywriting** | `168` | `onClick={() => navigator.clipboard.writeText(...)}` | Clipboard API | Copies hook, caption, and CTA to system clipboard | **PASS** |
| **Generate Image** | `179` | `onClick={onGenerateImage}` | `POST /api/images/generate` | Dispatches local image generation for selected platform | **PASS** |
| **Save Image to Source** | `187` | `onClick={() => onSaveImageToSource(platform)}` | `POST /api/images/save-source` | Attaches generated image asset to source document | **PASS** |
| **Enable / Connect Image Engine**| `193` | `onClick={onOpenImageSetup}` | `POST /api/image-generation/settings` | Updates consent or opens local storage security modal | **PASS** |
| **Export Campaign** | `112` | `onClick={onExport}` | `POST /api/export` | Generates MD and JSON exports in local runtime | **PASS** |
| **Source Textarea** | `224` | `onChange={(e) => setSource(e.target.value)}` | Local state `source` | Captures raw source buffer | **PASS** |
| **Dictate Source** | `231` | `SpeechToTextButton.onTranscript` | `setSource(prev + text)` | Web Speech API dictation into raw source buffer | **PASS** |
| **Save Source** | `235` | `onClick={onSaveSource}` | `POST /api/sources` | Saves raw source to persistent IP store | **PASS** |
| **Project Name Input** | `318` | `onChange={(e) => setProjectName(e.target.value)}` | Local state `projectName` | Project name input field | **PASS** |
| **Rename Project** | `324` | `onClick={saveProject}` | `POST /api/projects` | Renames active project in state store | **PASS** |
| **Create Project** | `331` | `onClick={createProject}` | `POST /api/projects` | Creates new isolated project and switches context | **PASS** |
| **Manual Backup** | `342` | `onClick={createManualBackup}` | `POST /api/backups` | Triggers `.wakebundle` backup creation | **PASS** |
| **Restore Backup** | `351` | `onClick={restoreLatestBackup}` | `POST /api/backups/restore` | Restores prior state snapshot with rollback guard | **PASS** |
| **Export All** | `360` | `onClick={exportAllData}` | `POST /api/export-all` | Dumps complete project vault to archive | **PASS** |
| **Clean Cache** | `369` | `onClick={cleanupCache}` | `POST /api/cache/cleanup` | Flushes temporary cache files | **PASS** |

---

### Surface 2: Agents (`src/components/tabs/AgentsTab.jsx`)
*Mission*: Interrogate and synthesize source material using 6-stage Tier Zero content agents (Archivist, Strategist, Scriptwriter, Creative Director, QA Gate, Export Manifest).

| UI Element / Button | Line | Handler / Trigger | Target API / State | Behavior & Forensic Verification | Status |
|---|---|---|---|---|---|
| **Source Selection Card** | `AgentSourcePanel` | `onClick={() => onSelectSource(item)}` | `GET /api/sources/:id/content` | Loads full source document text into agent context | **PASS** |
| **Run Tier Zero Agents** | `AgentSourcePanel` | `onClick={onRunAgent}` | `POST /api/run-agent` | Executes complete 6-stage DAG pipeline | **PASS** |
| **Open Console** | `AgentSourcePanel` | `onClick={onOpenConsole}` | `navigateSection("console")` | Navigates to console | **PASS** |
| **DAG Stage Cards** | `125-131` | `onClick` | `setSelectedStage(id)` | Filters inspection or opens Diffusion Studio | **PASS** |
| **Diffusion Studio Toggle** | `AgentsTab.jsx` | `onClick={() => setShowVisionStudio(!bool)}`| Local state `showVisionStudio` | Toggles inline AI Vision & Diffusion canvas | **PASS** |
| **Persona Specs Toggle** | `AgentsTab.jsx` | `onClick={() => setShowPersonaInspector(!bool)}`| Local state `showPersonaInspector`| Toggles agent temperature and prompt specifications | **PASS** |
| **Generate Original Visual** | `138` | `onClick={handleGenerateImage}` | `POST /api/images/studio-generate` | **BUG**: Hardcodes `projectId: "wake-v6-main"` instead of dynamic `projectId` prop | **WARN / BUG** |
| **Visual Gallery Thumbnails** | `AgentsTab.jsx` | `onClick={() => setActiveImage(img)}` | Local state `activeImage` | Switches active diffusion preview canvas | **PASS** |
| **Copy Created Content** | `OutputStudio` | `onClick` | Clipboard API | Copies generated output JSON/text to clipboard | **PASS** |
| **Export Output** | `AbilityActionRail` | `onClick={onExportOutput}` | `POST /api/export` | Exports generation packet to local storage | **PASS** |

---

### Surface 3: Cluster (`src/components/tabs/ClusterTab.jsx`)
*Mission*: Group sources into multi-pillar content clusters, 30-day cross-platform campaign matrices, and 1-click omnichannel transmuted formats.

| UI Element / Button | Line | Handler / Trigger | Target API / State | Behavior & Forensic Verification | Status |
|---|---|---|---|---|---|
| **View Switcher (Cluster/Matrix/Omnichannel)** | `380-404` | `onClick={() => setViewMode(mode)}` | Local state `viewMode` | Toggles between cluster studio, 30-day matrix, and omnichannel generator | **PASS** |
| **Build Content Cluster** | `422, 468` | `onClick={buildCluster}` | `POST /api/content-cluster` | Groups source into pillars, output matrix, and proof notes | **PASS** |
| **Export Cluster** | `414` | `onClick={exportCluster}` | `POST /api/export` | Exports cluster packet | **PASS** |
| **Re-Synthesize 30 Days** | `432, 470` | `onClick={handleSynthesizeMatrix}` | `POST /api/synthesis/30-day-matrix` | Synthesizes 30 days of structured daily content | **PASS** |
| **Calendar Day Cards** | `530` | `onClick={() => setSelectedDay(day)}` | Local state `selectedDay` | Loads day script, retention simulation, and studios | **PASS** |
| **Copy Day Packet** | `577` | `onClick={() => handleCopyDay(selectedDay)}` | Clipboard API | Copies formatted daily script and prompts | **PASS** |
| **5-Angle Experimenter Toggle**| `594` | `onClick={() => setShowHookMatrix(!bool)}` | Local state `showHookMatrix` | Toggles A/B psychological hook angle drawer (`POST /api/hooks/generate-variants`) | **PASS** |
| **Apply as Active Hook** | `ClusterTab.jsx` | `onClick={() => handleApplyHookVariant(v)}` | Local state `selectedDay` | Replaces opening hook and updates day script | **PASS** |
| **Generate Voiceover Audio** | `235` | `onClick={handleSynthesizeNeuralAudio}` | `POST /api/voice/synthesize` | Calls local voice synthesis engine | **PASS** (Note: phantom audio if no remote TTS) |
| **System Speech Preview** | `220` | `onClick={() => handleSpeakDayScript(...)}` | `window.speechSynthesis.speak` | Speaks text via browser speech synthesis | **PASS** |
| **Spectrum Style Select** | `ClusterTab.jsx` | `onChange={(e) => setWaveformStyle(e.target.value)}` | Local state `waveformStyle` | Re-renders animated HTML5 canvas waveform (`POST /api/waveform/generate`) | **PASS** |
| **Render Vertical Reel (MP4)**| `255` | `onClick={handleRenderVideoReel}` | `POST /api/video/render-reel` | Triggers video rendering (writes JSON fallback if FFmpeg missing) | **PASS** |
| **Download .SRT / .VTT** | `277` | `onClick={() => handleDownloadSubtitles(day, format)}` | `URL.createObjectURL(blob)` | Generates and downloads subtitle track files | **PASS** |
| **Stage for Publishing** | `306` | `onClick={() => handleStageForPublishing(day)}` | `POST /api/publishing/stage` | Pushes post to local publishing staging queue | **PASS** |
| **Re-Transmute Omnichannel** | `323` | `onClick={handleTransmute}` | `POST /api/transmute` | Generates 5 native asset formats simultaneously | **PASS** |
| **Export 5-Asset Folder** | `340` | `onClick={handleExportBundle}` | `POST /api/transmute/export` | Dumps 5-format asset bundle to local disk | **PASS** |
| **Asset Sub-Tabs (Reel, Thread, Article, Carousel, Newsletter)** | `ClusterTab.jsx` | `onClick={() => setActiveAssetTab(id)}` | Local state `activeAssetTab` | Switches between the 5 omnichannel formats | **PASS** |
| **Copy Asset Buttons** | `355` | `onClick={() => handleCopyAsset(text, key)}` | Clipboard API | Copies asset text or JSON to clipboard | **PASS** |

---

### Surface 4: Vault (`src/components/tabs/VaultTab.jsx`)
*Mission*: Ingestion, storage, vector search, GitHub repo cloning, and competitor reverse-engineering.

| UI Element / Button | Line | Handler / Trigger | Target API / State | Behavior & Forensic Verification | Status |
|---|---|---|---|---|---|
| **Drive / Folder Intake Info** | `625` | `onClick` | `setModal` | Displays drive intake policy modal | **PASS** |
| **Refresh Drives** | `639` | `onClick={onRefreshIntakeTargets}` | `GET /api/intake/roots` | Scans host filesystem for local drive roots | **PASS** |
| **Scan My Content Folders** | `647` | `onClick={onRunIntake}` | `POST /api/intake/run` | Recursively ingests files from listed roots | **PASS** |
| **Review Flash Drive** | `655` | `onClick={onReviewIntake}` | `POST /api/intake/review` | Stages intake candidates for review | **PASS** |
| **Import Listed Folders** | `663` | `onClick={onRunIntake}` | `POST /api/intake/run` | Ingests from textarea roots | **PASS** |
| **Candidate Checkbox** | `733` | `onChange={() => onToggleReviewCandidate(...)}` | `intakeReviewSelection` | **FATAL CRASH**: Calls `intakeReviewSelection.has()` on an Array `[]`. Throws `TypeError: intakeReviewSelection.has is not a function`. | **FATAL FAIL** |
| **Select All Candidates** | `710` | `onClick={() => onSelectReviewCandidates("all")}` | `setIntakeReviewSelection(ids)` | Selects eligible review items | **PASS** |
| **Clear Candidates** | `717` | `onClick={() => onSelectReviewCandidates("none")}` | `setIntakeReviewSelection([])` | Clears review selection | **PASS** |
| **Import Selected** | `725` | `onClick={onApplyReview}` | `POST /api/intake/reviews/:id/apply` | Imports reviewed candidate files | **PASS** |
| **Media Card Thumbnails** | `771` | `onClick={() => onOpenMediaAsset(asset)}` | `setModal(media)` | Opens media inspector modal with preview | **PASS** |
| **Clone GitHub Repo** | `228` | `onSubmit={handleClone}` | `POST /api/git/clone` | Clones repository and indexes pictures, videos, builds, docs | **PASS** |
| **Sync Latest Repo** | `379` | `onClick` | `setRepoUrl(...)` | Populates repository input for sync | **PASS** |
| **Reverse-Engineer Pattern** | `29` | `onSubmit={handleAnalyze}` | `POST /api/trends/analyze` | Evaluates competitor hook archetype and vocabulary | **PASS** |
| **Use as Creator Source** | `190` | `onClick={() => handleApplyCounterAngle(cp)}` | `onUseSource(...)` | Injects counter-positioning hook into creator | **PASS** |
| **Exact vs Vector Toggle** | `468, 484`| `onClick={() => setSearchMode(mode)}` | Local state `searchMode` | Toggles text substring search vs `/api/semantic/search` | **PASS** |
| **Lane Filter Chips** | `520, 529`| `onClick={() => setLaneFilter(lane)}` | Local state `laneFilter` | Filters source inventory by lane | **PASS** |
| **Tag Cloud Chips** | `541` | `onClick={() => setSourceQuery(tag.label)}` | Local state `sourceQuery` | Filters source inventory by tag | **PASS** |
| **Source Card Open** | `578` | `onClick={() => openSourceDocument(source)}` | `GET /api/sources/:id/content` | Opens document modal reader | **PASS** |

---

### Surface 5: Library (`src/components/tabs/LibraryTab.jsx`)
*Mission*: Review saved sources, generations, export files, and execution audit history.

| UI Element / Button | Line | Handler / Trigger | Target API / State | Behavior & Forensic Verification | Status |
|---|---|---|---|---|---|
| **Saved Source Rows** | `20` | `onClick={() => openSourceDocument(item)}` | `GET /api/sources/:id/content` | Opens source document reader modal | **PASS** |
| **Generated Output Rows** | `33` | `onClick={() => loadGeneration(item)}` | `setOutput`, `navigateSection` | Restores generation output and jumps to matching tab | **PASS** |
| **Export Rows** | `49` | `onClick` | `setModal` | Displays markdown & JSON relative paths and verification status | **PASS** |
| **History Rows** | `78` | `onClick` | `setModal` | Displays historical action receipts | **PASS** |

---

### Surface 6: Monitor (`src/components/tabs/MonitorTab.jsx`)
*Mission*: Live local telemetry, process health, task queue status, and capability evidence truth map.

| UI Element / Button | Line | Handler / Trigger | Target API / State | Behavior & Forensic Verification | Status |
|---|---|---|---|---|---|
| **System Monitor Info** | `47` | `onClick` | `openMonitorCard` | Opens telemetry info modal | **PASS** |
| **CPU / RAM / GPU / Port Tiles** | `64, 76, 91, 105` | `onClick` | `openMonitorCard` | Opens detailed telemetry modal | **PASS** |
| **CPU / RAM / GPU Sparklines** | `119, 130, 141` | `onClick` | `openMonitorCard` | Opens telemetry history trace modal | **PASS** |
| **Recent Log Rows** | `154` | `onClick` | `setModal` | Displays log message timestamp and severity | **PASS** |
| **Open Exports Folder** | `168` | `onClick={() => openFolder("exports")}` | `POST /api/open-folder` | Opens OS native file explorer at `exports/` | **PASS** |
| **Open Snapshots Folder** | `171` | `onClick={() => openFolder("snapshots")}` | `POST /api/open-folder` | Opens OS native file explorer at `snapshots/` | **PASS** |
| **Open Data Folder** | `174` | `onClick={() => openFolder("data")}` | `POST /api/open-folder` | Opens OS native file explorer at `data/` | **PASS** |
| **Task Search Input** | `204` | `onChange={(e) => setTaskSearch(e.target.value)}` | Local state `taskSearch` | Filters task rows by keyword | **PASS** |
| **Task Filter (All/Running/Done)** | `213` | `onClick={() => setTaskFilter(filter)}` | Local state `taskFilter` | Filters active tasks | **PASS** |
| **Task Rows** | `222` | `onClick={() => openTaskCard(task)}` | `openTaskCard` | Opens task detail modal with "Open Related Surface" button | **PASS** |
| **Capability Rows** | `255` | `onClick={() => openCapabilityCard(capability)}` | `openCapabilityCard` | Opens truth map modal with evidence paths and jump button | **PASS** |

---

### Surface 7: Audit (`src/components/tabs/AuditTab.jsx`)
*Mission*: Durable local snapshot receipts and state ledger preservation.

| UI Element / Button | Line | Handler / Trigger | Target API / State | Behavior & Forensic Verification | Status |
|---|---|---|---|---|---|
| **Save Snapshot** | `18` | `onClick={saveSnapshot}` | `POST /api/snapshot` | Writes atomic state snapshot JSON to runtime ledger | **PASS** |

---

### Surface 8: Automations / Scheduler (`src/components/tabs/AutomationsTab.jsx`)
*Mission*: Background workflow scheduling, folder watcher monitoring, webhook dispatch pipeline, and run history.

| UI Element / Button | Line | Handler / Trigger | Target API / State | Behavior & Forensic Verification | Status |
|---|---|---|---|---|---|
| **Sub-Tab Buttons (Active/Publishing/Webhooks/Watchers/Review/History)** | `232-267` | `onClick={() => setTab(tabId)}` | Local state `tab` | Switches automation sub-surfaces | **PASS** |
| **New Automation** | `277` | `onClick` | `setEditor(defaults)` | Opens modal form for new cron automation | **PASS** |
| **Pause / Resume** | `311` | `onClick={() => handleToggle(a.id, !a.enabled)}` | `POST /api/automations/:id/toggle` | Toggles cron job execution state | **PASS** |
| **Run Now** | `314` | `onClick={() => handleRun(a.id)}` | `POST /api/automations/:id/run` | Triggers immediate cron job execution | **PASS** |
| **Edit Automation** | `317` | `onClick={() => setEditor(a)}` | `setEditor(a)` | Opens automation editor modal | **PASS** |
| **Delete Automation** | `320` | `onClick={() => handleDelete(a.id)}` | `DELETE /api/automations/:id` | Deletes automation schedule | **PASS** |
| **Save Automation Form** | `124` | `onSubmit={handleSaveEditor}` | `POST/PUT /api/automations` | Saves automation configuration | **PASS** |
| **Dispatch Test Webhook** | `142` | `onSubmit={handleTestWebhook}` | `POST /api/connectors/dispatch` | Sends signed HMAC payload to target webhook URL | **PASS** |
| **Attach Directory Watcher** | `170` | `onSubmit={handleAddWatcher}` | `POST /api/watchers` | Attaches filesystem watcher to directory | **PASS** |
| **Detach Directory Watcher** | `192` | `onClick={() => handleRemoveWatcher(w.id)}` | `DELETE /api/watchers/:id` | Detaches directory watcher | **PASS** |

---

### Surface 9: Review Queue & Social Publishing (`src/components/tabs/AutomationsTab.jsx`)
*Mission*: Operator gate for approving autonomous campaign drafts and dispatching social posts.

| UI Element / Button | Line | Handler / Trigger | Target API / State | Behavior & Forensic Verification | Status |
|---|---|---|---|---|---|
| **View Generated Packet** | `613` | `onClick={() => setModal({ type: "review", data: r })}` | `setModal` | **BUG**: `main.jsx` modal renderer ignores `modal.type` and `modal.data`. Opens empty, blank modal. | **BROKEN / BUG** |
| **Connected Accounts Badges** | `345-356` | Static UI Display | `GET /api/publishing/accounts` | **THEATER**: Displays green "Connected" badge for hardcoded `@wakeengine`, `@wake.engine`, `@WakeEngineHQ` without any real OAuth credentials. | **THEATER FAIL** |
| **Publish Now** | `408` | `onClick={() => handleDispatchSocialPost(item.id)}` | `POST /api/publishing/dispatch/:id` | **THEATER**: Simulates direct social API dispatch with random latency (`Math.random() * 80 + 45ms`) and generates fake URLs. | **THEATER FAIL** |
| **Delete from Queue** | `417` | `onClick={() => handleDeleteSocialPost(item.id)}` | `DELETE /api/publishing/:id` | Deletes staged post from queue | **PASS** |

---

### Operational Surface: Instructions / Operations Guide (`src/components/tabs/InstructionsTab.jsx`)
*Mission*: Generate grounded, step-by-step WAKE Engine workflows matching live runtime capabilities.

| UI Element / Button | Line | Handler / Trigger | Target API / State | Behavior & Forensic Verification | Status |
|---|---|---|---|---|---|
| **Goal Textarea** | `27` | `onChange={(e) => setInstructionsQuery(e.target.value)}` | Local state `instructionsQuery` | Captures operational goal buffer | **PASS** |
| **Speak Goal** | `25, 46` | `SpeechToTextButton.onTranscript` | `setInstructionsQuery` | Voice dictation for operational goal | **PASS** |
| **Get Instructions** | `41` | `onClick={fetchInstructions}` | `POST /api/instructions/generate` | Calls deterministic/LLM workflow generator | **PASS** |

---

### App Shell, Header, Chat & Universal Modals (`src/components/Header.jsx`, `src/components/chat/SectionChat.jsx`, `src/main.jsx`)

| UI Element / Button | Component & Line | Handler / Trigger | Target API / State | Behavior & Forensic Verification | Status |
|---|---|---|---|---|---|
| **Inspect Runtime** | `Header.jsx:108` | `onClick` | `setModal` | Displays runtime modal | **PASS** |
| **Voice Settings Toggle** | `Header.jsx:121` | `onClick` | `setShowVoicePanel` | Toggles voice configuration drawer | **PASS** |
| **Replay Boot Sequence** | `Header.jsx:126` | `onClick={replayBoot}` | `setBooted(false)` | Replays BIOS cold start audio/animation | **PASS** |
| **No Theater Info** | `Header.jsx:136` | `onClick` | `setModal` | Displays truth rule modal | **PASS** |
| **Section Navigation Tabs** | `Header.jsx:153` | `onClick={() => navigateSection(id)}` | `setActive(id)` | Switches active product surface | **PASS** |
| **Project Switcher Dropdown** | `Header.jsx:166` | `onChange={(e) => switchProject(e.target.value)}` | `setProjectId` | Switches active project | **PASS** |
| **Export .wake Vault** | `Header.jsx:181` | `onClick={handleExportVault}` | `POST /api/projects/:id/export-vault` | Exports standalone `.wake` bundle | **PASS** |
| **Import .wake Vault** | `Header.jsx:192` | `onClick={handleImportVaultClick}` | `POST /api/projects/import-vault` | Imports `.wake` bundle | **PASS** |
| **Voice Presets / Selection** | `Header.jsx:220, 228` | `onClick`, `onChange` | `setVoicePreset`, `setVoiceName` | Selects system TTS voice preset | **PASS** |
| **Test Voice / Mute** | `Header.jsx:242, 251` | `onClick` | `setVoiceMuted`, `speakSystemVoice` | Speaks sample voice audio | **PASS** |
| **Polish Prompts** | `SectionChat.jsx:79`| `onClick={() => onPrompt(prompt)}` | `onPrompt` | Injects selected prompt into chat | **PASS** |
| **Chat Mode (Fast/Deep/Elite)**| `SectionChat.jsx:96`| `onClick={() => setChatMode(value)}` | `setChatMode` | Switches LLM execution depth mode | **PASS** |
| **Agent Selector** | `SectionChat.jsx:108`| `onClick={() => setSelectedAgent(agent.id)}`| `setSelectedAgent` | Switches working agent persona | **PASS** |
| **Chat Send Form** | `SectionChat.jsx:247`| `onSubmit={onSend}` | `POST /api/agent-chat` & `/stream` | Submits message to LLM or local draft engine | **PASS** |
| **Voice Dictation in Chat** | `SectionChat.jsx:264`| `onClick={onListen}` | Web Speech API | Transcribes spoken audio into chat message | **PASS** |
| **Apply Answer to Source** | `SectionChat.jsx:170`| `onClick={onApplyAnswerToSource}` | `setSource` | Replaces active source with agent output | **PASS** |
| **Promote Output** | `SectionChat.jsx:173`| `onClick={onPromoteAnswer}` | `setOutput` | Promotes chat answer to structured output | **PASS** |
| **Read Aloud** | `SectionChat.jsx:179`| `onClick={onSpeakAnswer}` | `window.speechSynthesis` | Reads agent answer aloud | **PASS** |
| **Lock Task** | `AbilityScaffold.jsx:248`| `onClick={onSave}` | `POST /api/active-task` | Locks active task spine in state | **PASS** |
| **Next Step Action** | `AbilityScaffold.jsx:422`| `onClick={step.action}` | Contextual | Triggers next step for current surface | **PASS** |

---

## 3. Deep Technical Defect & Failure Mode Analysis

### Defect D1: Fatal `TypeError` in Vault Intake Review Selection
- **Files**: `src/components/tabs/VaultTab.jsx:733` vs `src/main.jsx:144, 1118-1135`
- **Error**: `TypeError: intakeReviewSelection.has is not a function`
- **Evidence**:
  ```javascript
  // src/main.jsx:144
  const [intakeReviewSelection, setIntakeReviewSelection] = useState([]);
  
  // src/main.jsx:1118-1120
  function toggleReviewCandidate(candidateId) {
    setIntakeReviewSelection((current) =>
      current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId]
    );
  }
  
  // src/components/tabs/VaultTab.jsx:732-733
  {(intakeReview.candidates || []).map((candidate) => {
    const selected = intakeReviewSelection.has(candidate.reviewId); // <-- FATAL CRASH: Array does not have .has()
  ```
- **Blast Radius**: Whenever an operator clicks "Review Flash Drive" or triggers an intake review with candidates, rendering the candidate list immediately throws an unhandled TypeError, crashing the component tree.
- **Root Cause**: Developer assumed `intakeReviewSelection` was a `Set`, but `main.jsx` implements and passes it as a standard JavaScript `Array` (`[]`). Should be `intakeReviewSelection.includes(candidate.reviewId)`.

---

### Defect D2: Broken Empty Review Modal in Review Queue
- **Files**: `src/components/tabs/AutomationsTab.jsx:613` vs `src/main.jsx:1776-1845`
- **Behavior**: Clicking "View Generated Packet" in the Review Queue sub-tab renders a blank, empty modal containing only `<h2></h2><p></p>` and a "Close" button.
- **Evidence**:
  ```javascript
  // src/components/tabs/AutomationsTab.jsx:613
  <button
    className="primary-action"
    onClick={() => setModal({ type: "review", data: r })}
  >
    View Generated Packet
  </button>
  ```
  ```jsx
  // src/main.jsx:1776-1845 (Universal Modal Renderer)
  {modal && (
    <div className="modal-backdrop" onClick={() => setModal(null)}>
      <div className={`modal ${modal.kind === "document" ? "document-modal" : ""} ...`}>
        <h2>{modal.title}</h2>  {/* Undefined -> empty */}
        {modal.meta ? <small className="document-meta">{modal.meta}</small> : null}
        {modal.kind === "document" ? (
          <pre className={...}>{modal.body}</pre>
        ) : (
          <p>{modal.body}</p>  {/* Undefined -> empty */}
        )}
        {/* modal.data is completely ignored! */}
        <div className="modal-actions">
          <button type="button" onClick={() => setModal(null)}>Close</button>
        </div>
      </div>
    </div>
  )}
  ```
- **Blast Radius**: Surface 9 (Review Queue) is non-functional as an operator approval gate. The operator cannot inspect the draft packet generated by background automations, cannot see generated scripts, hooks, or blockers, and cannot approve/reject from the modal.

---

### Defect D3: Hardcoded Project ID in Diffusion Studio
- **File**: `src/components/tabs/AgentsTab.jsx:141`
- **Behavior**: `handleGenerateImage` passes `{ projectId: "wake-v6-main" }` as a literal string constant rather than using the active `projectId` prop passed into `AgentsTab`.
- **Evidence**:
  ```javascript
  // src/components/tabs/AgentsTab.jsx:138-142
  const res = await api("/api/images/studio-generate", "POST", {
    prompt: imagePrompt,
    platform: platformRatio,
    projectId: "wake-v6-main" // <-- HARDCODED
  });
  ```
- **Impact**: In multi-project setups, generating visuals inside AgentsTab Diffusion Studio always associates the generated media with `wake-v6-main` instead of the currently active project.

---

### Defect D4: Completely Orphaned / Dead Zustand Store
- **File**: `src/store/useWakeStore.js:1-80`
- **Evidence**:
  ```powershell
  # Empirically verified via codebase search
  Get-ChildItem -Path src -Recurse -Include *.jsx,*.js | Select-String "useWakeStore"
  # Result: Only defined in src/store/useWakeStore.js:3. ZERO imports across src/.
  ```
- **Impact**: 80 lines of boilerplate Zustand store code defining actions, state, and slices are completely disconnected and unused. `src/main.jsx` duplicates and manages all state via monolithic local `useState` hooks.

---

### Defect D5: Complete Absence of React Error Boundaries
- **Files**: `src/main.jsx`, `src/index.html`
- **Evidence**: Codebase contains zero instances of `componentDidCatch` or `<ErrorBoundary>`.
- **Impact**: Any unhandled render error (such as Defect D1 in VaultTab) results in an unrecoverable white screen crash with no fallback UI or error recovery prompt for the operator.

---

## 4. Mock Data, Simulated Operations & Theater Audit

| ID | Location | Surface | Detected Pattern | Real Implementation / Discrepancy | Severity |
|---|---|---|---|---|---|
| **TH-01** | `server/social-publisher.js:26-33`, `AutomationsTab.jsx:345-356` | Surface 9 (Publishing Queue) | **Hardcoded Social Accounts**: Hardcoded accounts claiming `"status": "connected"` for `@wakeengine` (YouTube), `@wake.engine` (TikTok), `WAKE Engine Systems` (LinkedIn), `@WakeEngineHQ` (X). | Zero OAuth tokens, API keys, or platform connectors exist. Displays fake green "Connected" badge. | **THEATER FAIL** |
| **TH-02** | `server/social-publisher.js:104-128`, `AutomationsTab.jsx:408` | Surface 9 (Publishing Queue) | **Simulated Direct Dispatch**: `dispatchPost()` generates fake SHA-256 signatures, fake URLs (`https://www.tiktok.com/@wake.engine/video/...`), and simulated network latency (`Math.random() * 80 + 45ms`), returning `"status": "delivered"`. | 100% simulated dispatch theater. Directly contradicts `/api/instructions/generate` runbook stating WAKE does not publish directly. | **THEATER FAIL** |
| **TH-03** | `server/index.js:1078-1087` | Surface 6 (Monitor) | **Hardcoded Task Monitor State**: Static array of 8 tasks (`WAKE-001` to `WAKE-008`) with hardcoded statuses (`"running"`, `"done"`) and relative timestamps (`"2m ago"`, `"now"`). | Returned in every `GET /api/state` response; `runtime.queue` is hardcoded to 4. Tasks do not correspond to actual background workers. | **THEATER FAIL** |
| **TH-04** | `server/video-engine.js:69-84` | Surface 3 (Cluster) | **Mock Video File Fallback**: When FFmpeg is missing on the host machine, writes a JSON string to a file ending in `.mp4`. | Client receives a file with `.mp4` extension that is actually raw JSON text. | **THEATER FAIL** |
| **TH-05** | `server/voiceover-engine.js:98-121` | Surface 3 (Cluster) | **Phantom Audio Synthesis**: When no remote neural TTS endpoint is configured, returns HTTP 200 with an audio URL (`/generated-audio/...`), but creates no audio file on disk. | Client receives an audio URL for a non-existent file. | **THEATER FAIL** |
| **TH-06** | `server/hook-matrix.js:46-87` | Surface 3 (Cluster) | **Static Hook Tension Scores**: Returns hardcoded tension scores (`88, 94, 85, 92, 90`) and boilerplate string templates. | Claims dynamic tension analytics but uses hardcoded static numbers. | **WARN** |

---

## 5. Comprehensive Server API Endpoint & Contract Verification

All **87 API endpoints** registered in `server/index.js` and `server/scheduler.js` were audited against their HTTP method, URL parameters, request body, authentication middleware, error handling, and behavioral truthfulness.

```
Middleware Chain:
1. Public Endpoints: Session login/logout/status, biometric login, health check.
2. Protected Endpoints: Pass through app.use("/api", sessionManager.require, serializeMutatingRequest).
3. Mutating verbs (POST, PUT, DELETE, PATCH) enforce X-Wake-CSRF header and hold exclusive WAL lock.
```

### Complete API Endpoint Master Table

| # | HTTP Method | Path | Source Line | Auth & CSRF | Request Params / Body | Response Payload & Schema | Error Codes | Integrity Status & Verdict |
|---|---|---|---|---|---|---|---|---|
| **1** | `GET` | `/api/session/status` | `server/index.js:3244` | Public | None (reads `wake_session` cookie) | `{ ok, authenticated, authenticationRequired, enrolled, biometricEnrolled, biometricCredentialCount, operator, csrfToken, expiresAt }` | None | **VERIFIED LIVE** |
| **2** | `POST` | `/api/session/login` | `server/index.js:3248` | Public | `{ operator: string, phrase: string }` | `{ ok: true, authenticated: true, enrolled, operator, csrfToken, expiresAt }` + `Set-Cookie` | `400 INVALID_PHRASE`, `401 AUTH_FAILED` | **VERIFIED LIVE** |
| **3** | `POST` | `/api/session/logout` | `server/index.js:3258` | Public | None | `{ ok: true, authenticated: false }` + clear cookie | None | **VERIFIED LIVE** |
| **4** | `POST` | `/api/session/biometric/register/options` | `server/index.js:3263` | `sessionManager.require` + CSRF | None | `{ ok: true, publicKey: WebAuthnCreationOptions }` | `500` | **VERIFIED LIVE** |
| **5** | `POST` | `/api/session/biometric/register/verify` | `server/index.js:3267` | `sessionManager.require` + CSRF | `{ clientDataJSON, authenticatorData, credentialId, publicKey, algorithm, transports }` | `{ ok: true, biometric: { enrolled: true, credentialId, operator, transports } }` | `400`, `500` | **VERIFIED LIVE** |
| **6** | `POST` | `/api/session/biometric/login/options` | `server/index.js:3271` | Public | None | `{ ok: true, publicKey: WebAuthnRequestOptions }` | `500` | **VERIFIED LIVE** |
| **7** | `POST` | `/api/session/biometric/login/verify` | `server/index.js:3275` | Public | `{ clientDataJSON, authenticatorData, credentialId, signature }` | `{ ok: true, authenticated: true, biometric: true, operator, csrfToken, expiresAt }` + cookie | `400`, `401` | **VERIFIED LIVE** |
| **8** | `GET` | `/api/health` | `server/index.js:3284` | Public | None | `{ ok: true, product, console, version, build, status, port: 8786, noTheater, noTheaterSummary, externalOperators }` | None | **VERIFIED LIVE** |
| **9** | `USE` | `/api` | `server/index.js:3288` | Protected Gateway | Middleware | Enforces `sessionManager.require` + `serializeMutatingRequest` | `401 AUTH_REQUIRED`, `403 CSRF_FAILED` | **VERIFIED LIVE** |
| **10** | `USE` | `/generated-images` | `server/index.js:3290` | `sessionManager.require` | URL Path to image | Binary image stream | `401`, `404` | **VERIFIED LIVE** |
| **11** | `GET` | `/api/state` | `server/index.js:3302` | Protected | None | Full application state object (`store.projects`, `sources`, `mediaAssets`, `campaigns`, `automations`, `tasks`, etc.) | `500` | **VERIFIED LIVE** (Note: tasks array is static) |
| **12** | `GET` | `/api/no-theater/status` | `server/index.js:3306` | Protected | None | `{ ok, checkedAt, summary, violations, warnings }` | `500` | **VERIFIED LIVE** |
| **13** | `GET` | `/api/system` | `server/index.js:3311` | Protected | None | `{ ok: true, sampledAt, cpu, memory, gpu, runtime, logs }` | `500` | **VERIFIED LIVE** |
| **14** | `GET` | `/api/agent-chat/status` | `server/index.js:3316` | Protected | None | `{ ok: true, live, url, models, model, bridge: "ollama", fallback: "Instant Local Draft" }` | None | **VERIFIED LIVE** |
| **15** | `GET` | `/api/image-generation/status` | `server/index.js:3321` | Protected | None | `{ ok: true, configured, available, provider, model, ... }` | None | **VERIFIED LIVE** |
| **16** | `GET` | `/api/provider-credentials/status` | `server/index.js:3325` | Protected | None | `{ ok: true, credentialVault: { available, configured, provider, model, apiUrlConfigured, updatedAt } }` | None | **VERIFIED LIVE** |
| **17** | `POST` | `/api/provider-credentials` | `server/index.js:3330` | Protected + CSRF | `{ provider, apiUrl, apiKey, model }` | `{ ok: true, credentialVault, imageGeneration }` | `503 SECURE_STORAGE_UNAVAILABLE` | **VERIFIED LIVE** |
| **18** | `POST` | `/api/provider-credentials/clear` | `server/index.js:3340` | Protected + CSRF | None | `{ ok: true, credentialVault, imageGeneration }` | `503 SECURE_STORAGE_UNAVAILABLE` | **VERIFIED LIVE** |
| **19** | `POST` | `/api/image-generation/settings` | `server/index.js:3349` | Protected + CSRF | `{ externalImagesEnabled: bool }` | `{ ok: true, settings, imageGeneration }` | `500` | **VERIFIED LIVE** |
| **20** | `GET` | `/api/data-protection/status` | `server/index.js:3354` | Protected | None | `{ ok: true, storage, bundles, dataDir, backupDir, cacheDir }` | `500` | **VERIFIED LIVE** |
| **21** | `POST` | `/api/backups` | `server/index.js:3365` | Protected + CSRF | None | `{ ok: true, backup, bundles }` | `500` | **VERIFIED LIVE** |
| **22** | `POST` | `/api/backups/restore` | `server/index.js:3375` | Protected + CSRF | `{ fileName: string }` | `{ ok: true, restored, state }` | `400`, `500` | **VERIFIED LIVE** |
| **23** | `POST` | `/api/export-all` | `server/index.js:3385` | Protected + CSRF | None | `{ ok: true, export }` | `500` | **VERIFIED LIVE** |
| **24** | `POST` | `/api/cache/cleanup` | `server/index.js:3395` | Protected + CSRF | None | `{ ok: true, cleanup: { removed, reclaimedBytes, cacheDir, cleanedAt } }` | `500` | **VERIFIED LIVE** |
| **25** | `GET` | `/api/tier-zero/agents` | `server/index.js:3405` | Protected | None | `{ ok: true, agents, audit }` | `500` | **VERIFIED LIVE** |
| **26** | `GET` | `/api/tier-zero/audit` | `server/index.js:3410` | Protected | None | `{ ok, summary, violations }` | `500` | **VERIFIED LIVE** |
| **27** | `POST` | `/api/tier-zero/run` | `server/index.js:3417` | Protected + CSRF | `{ source: string, projectId?, sourceId?, agentId? }` | `{ ...pack, generation }` | `400`, `500` | **VERIFIED LIVE** |
| **28** | `POST` | `/api/agent-chat` | `server/index.js:3426` | Protected + CSRF | `{ message: string, agentId?, ability?, mode?, projectId?, sourceId? }` | `{ ok: true, chat }` | `400`, `500` | **VERIFIED LIVE** |
| **29** | `POST` | `/api/agent-chat/stream` | `server/index.js:3505` | Protected + CSRF | `{ message: string, agentId?, ability?, mode?, projectId?, sourceId? }` | NDJSON Event Stream (`meta`, `draft`, `token`, `final`) | `400`, `500` | **VERIFIED LIVE** |
| **30** | `POST` | `/api/instructions/generate` | `server/index.js:3608` | Protected + CSRF | `{ message: string }` | `{ ok: true, instructions: string, generated: bool }` | `400`, `500` | **VERIFIED LIVE** |
| **31** | `POST` | `/api/automations` | `server/index.js:3785` | Protected + CSRF | `{ name, projectId, sourceDir, campaignType, operatorAsk, scheduleCron, timeZone, approvalMode, exportDir }` | `{ ok: true, automation }` | `400`, `500` | **VERIFIED LIVE** |
| **32** | `PUT` | `/api/automations/:id` | `server/index.js:3805` | Protected + CSRF | URL `:id` + `{ name, projectId, sourceDir, campaignType, ... }` | `{ ok: true, automation }` | `404`, `500` | **VERIFIED LIVE** |
| **33** | `DELETE` | `/api/automations/:id` | `server/index.js:3820` | Protected + CSRF | URL `:id` | `{ ok: true }` | `404`, `500` | **VERIFIED LIVE** |
| **34** | `POST` | `/api/automations/:id/toggle` | `server/index.js:3830` | Protected + CSRF | URL `:id` + `{ enabled: bool }` | `{ ok: true, enabled }` | `404`, `500` | **VERIFIED LIVE** |
| **35** | `POST` | `/api/automations/:id/run` | `server/index.js:3842` | Protected + CSRF | URL `:id` | `{ ok: true, run }` | `404`, `500` | **VERIFIED LIVE** |
| **36** | `POST` | `/api/active-task` | `server/index.js:3862` | Protected + CSRF | `{ title, objective, status, nextAction, blockers, completed }` | `{ ok: true, task }` | `500` | **VERIFIED LIVE** |
| **37** | `GET` | `/api/intake/roots` | `server/index.js:3874` | Protected | None | `{ ok: true, roots, contentRoots, drives, removableDrives, fixedDrives, maxFiles, maxDirectories }` | `500` | **VERIFIED LIVE** |
| **38** | `POST` | `/api/intake/run` | `server/index.js:3889` | Protected + CSRF | `{ roots?: array, projectId?: string }` | `{ ok: true, run, state }` | `500` | **VERIFIED LIVE** |
| **39** | `POST` | `/api/intake/review` | `server/index.js:3900` | Protected + CSRF | `{ roots?: array, projectId?: string, query?: string }` | `{ ok: true, review, state }` | `500` | **VERIFIED LIVE** |
| **40** | `POST` | `/api/intake/reviews/:id/apply` | `server/index.js:3914` | Protected + CSRF | URL `:id` + `{ candidateIds: array }` | `{ ok: true, run, review, result, state }` | `404`, `500` | **VERIFIED LIVE** |
| **41** | `POST` | `/api/git/clone` | `server/index.js:4031` | Protected + CSRF | `{ repoUrl: string, branch?, token?, projectId? }` | `{ ok: true, repoName, slug, url, branch, commit, localPath, sourceAdded, mediaAdded, stats, state }` | `400`, `500` | **VERIFIED LIVE** |
| **42** | `GET` | `/api/git/repos` | `server/index.js:4048` | Protected | None | `{ ok: true, repos }` | `500` | **VERIFIED LIVE** |
| **43** | `GET` | `/api/media/:id/preview` | `server/index.js:4057` | Protected | URL `:id` | Binary image stream (`res.sendFile`) | `404` | **VERIFIED LIVE** |
| **44** | `POST` | `/api/media/:id/open` | `server/index.js:4067` | Protected + CSRF | URL `:id` | `{ ok: true, id, path }` | `404`, `500` | **VERIFIED LIVE** |
| **45** | `POST` | `/api/media/:id/rename` | `server/index.js:4084` | Protected + CSRF | URL `:id` + `{ title: string }` | `{ ok: true, media, state }` | `404`, `500` | **VERIFIED LIVE** |
| **46** | `POST` | `/api/sources/:id/rename` | `server/index.js:4098` | Protected + CSRF | URL `:id` + `{ title: string }` | `{ ok: true, source, state }` | `404`, `500` | **VERIFIED LIVE** |
| **47** | `GET` | `/api/projects` | `server/index.js:4111` | Protected | None | `{ ok: true, projects }` | `500` | **VERIFIED LIVE** |
| **48** | `POST` | `/api/projects` | `server/index.js:4115` | Protected + CSRF | `{ id?, name: string, status? }` | `{ ok: true, project }` | `400`, `500` | **VERIFIED LIVE** |
| **49** | `POST` | `/api/projects/:id/export-vault` | `server/index.js:4122` | Protected + CSRF | URL `:id` | `{ ok: true, filename, filePath, relativePath, sha256, bundle }` | `404`, `500` | **PRIMARY (ACTIVE)** |
| **50** | `POST` | `/api/projects/import-vault` | `server/index.js:4178` | Protected + CSRF | `{ bundle?: object, filePath?: string }` | `{ ok: true, project, addedSources, state }` | `400`, `500` | **PRIMARY (ACTIVE)** |
| **51** | `GET` | `/api/history` | `server/index.js:4229` | Protected | None | `{ ok: true, history, agentChats, runRecords, a2aMessages, replayableHandoffs, toolReceipts, memoryReceipts, traceSummary }` | `500` | **VERIFIED LIVE** |
| **52** | `POST` | `/api/sources` | `server/index.js:4260` | Protected + CSRF | `{ source: string, projectId?: string }` | `{ ok: true, source }` | `400`, `500` | **VERIFIED LIVE** |
| **53** | `POST` | `/api/semantic/search` | `server/index.js:4278` | Protected + CSRF | `{ query: string, projectId?, lane?, limit?, minScore?, type? }` | `{ ok: true, query, count, results }` | `400`, `500` | **VERIFIED LIVE** |
| **54** | `GET` | `/api/sources/:id/content` | `server/index.js:4297` | Protected | URL `:id` | `{ ok: true, document: { id, projectId, title, content, sourceType, contentSource, characterCount } }` | `404` | **VERIFIED LIVE** |
| **55** | `POST` | `/api/frame` | `server/index.js:4329` | Protected + CSRF | `{ source: string, projectId?, sourceId? }` | `{ ok: true, frame, generation }` | `400`, `500` | **VERIFIED LIVE** |
| **56** | `POST` | `/api/run-agent` | `server/index.js:4345` | Protected + CSRF | `{ source: string, projectId?, sourceId?, agentId? }` | `{ ...pack, generation }` | `400`, `500` | **VERIFIED LIVE** |
| **57** | `POST` | `/api/content-cluster` | `server/index.js:4386` | Protected + CSRF | `{ source: string, projectId?, sourceId? }` | `{ ...cluster, generation }` | `400`, `500` | **VERIFIED LIVE** |
| **58** | `POST` | `/api/autopilot` | `server/index.js:4422` | Protected + CSRF | `{ projectId?, direction?, sourceId?, unsavedSource? }` | `{ ok: true, campaign }` | `400`, `500` | **VERIFIED LIVE** |
| **59** | `POST` | `/api/images/generate` | `server/index.js:4478` | Protected + CSRF | `{ campaignId: string, platform: string, prompt? }` | `{ ok: true, image, campaign }` | `400`, `500` | **VERIFIED LIVE** |
| **60** | `POST` | `/api/images/save-source` | `server/index.js:4492` | Protected + CSRF | `{ imageId: string, campaignId?, platform?, projectId? }` | `{ ok: true, source, media, state }` | `400`, `500` | **VERIFIED LIVE** |
| **61** | `POST` | `/api/images/studio-generate` | `server/index.js:4505` | Protected + CSRF | `{ prompt: string, platform?, projectId? }` | `{ ok: true, image }` | `400`, `500` | **VERIFIED LIVE** |
| **62** | `POST` | `/api/export` | `server/index.js:4518` | Protected + CSRF | `{ output: object, projectId?, sourceId? }` | `{ ok: true, export, packetContract, packetSummary, traceSummary }` | `400`, `500` | **VERIFIED LIVE** |
| **63** | `POST` | `/api/connectors/dispatch` | `server/index.js:4552` | Protected + CSRF | `{ webhookUrl: string, payload: any, format?, secret? }` | `{ ok: bool, status, statusCode, timestamp }` | `400`, `500` | **VERIFIED LIVE** |
| **64** | `POST` | `/api/connectors/staging-sync` | `server/index.js:4602` | Protected + CSRF | `{ targetDir: string, files: array }` | `{ ok: true, targetDir, writtenCount, files }` | `400`, `500` | **VERIFIED LIVE** |
| **65** | `POST` | `/api/connectors/test-webhook` | `server/index.js:4626` | Protected + CSRF | `{ webhookUrl: string, secret?, payload? }` | `{ ok: bool, statusCode, latencyMs, responseSummary, testedAt }` | `400`, `500` | **VERIFIED LIVE** |
| **66** | `GET` | `/api/watchers` | `server/index.js:4642` | Protected | None | `{ ok: true, watchers }` | `500` | **VERIFIED LIVE** |
| **67** | `POST` | `/api/watchers` | `server/index.js:4646` | Protected + CSRF | `{ path: string, projectId? }` | `{ ok: true, watcher: { id, path, projectId } }` | `400`, `500` | **VERIFIED LIVE** |
| **68** | `DELETE` | `/api/watchers/:id` | `server/index.js:4660` | Protected + CSRF | URL `:id` | `{ ok: bool }` | `404`, `500` | **VERIFIED LIVE** |
| **69** | `POST` | `/api/synthesis/30-day-matrix` | `server/index.js:4672` | Protected + CSRF | `{ sourceText?, projectId?, theme? }` | `{ ok: true, matrix: { totalDays: 30, weeksCount: 5, days, summary } }` | `500` | **VERIFIED LIVE** |
| **70** | `POST` | `/api/synthesis/subtitles` | `server/index.js:4687` | Protected + CSRF | `{ scriptText: string, format?, wordsPerMinute? }` | `{ ok: true, format, totalDurationSec, segmentCount, timedItems, trackContent }` | `400`, `500` | **VERIFIED LIVE** |
| **71** | `POST` | `/api/open-folder` | `server/index.js:4750` | Protected + CSRF | `{ target: "data" \| "exports" \| "snapshots" }` | `{ ok: true, target, folder }` | `400`, `500` | **VERIFIED LIVE** |
| **72** | `POST` | `/api/snapshot` | `server/index.js:4766` | Protected + CSRF | `{ source: string, output: object }` | `{ ok: true, fileName, relativePath }` | `500` | **VERIFIED LIVE** |
| **73** | `USE` | `/generated-audio` | `server/index.js:4781` | **PUBLIC (UNPROTECTED)** | URL Path to audio file | Audio stream | None | **AUTH DISPARITY** |
| **74** | `GET` | `/api/voice/profiles` | `server/index.js:4783` | Protected | None | `{ ok: true, profiles }` | `500` | **VERIFIED LIVE** |
| **75** | `POST` | `/api/voice/synthesize` | `server/index.js:4787` | Protected + CSRF | `{ text: string, profileId?, speed?, pitch?, format?, remoteEndpoint? }` | `{ ok: true, id, filename, filePath, relativePath, url, profile, text, wordCount, estimatedDurationSec, speed, pitch, synthesizedVia, format, subtitles }` | `400`, `500` | **VERIFIED LIVE** (Phantom audio if no remote TTS) |
| **76** | `POST` | `/api/voice/export-bundle` | `server/index.js:4797` | Protected + CSRF | `{ targetDir: string, filename: string, subtitles: { srt, vtt } }` | `{ ok: true, targetDir, files }` | `400`, `500` | **VERIFIED LIVE** |
| **77** | `USE` | `/generated-videos` | `server/index.js:4823` | **PUBLIC (UNPROTECTED)** | URL Path to video file | Video stream | None | **AUTH DISPARITY** |
| **78** | `GET` | `/api/video/status` | `server/index.js:4825` | Protected | None | `{ ok: true, ffmpeg: { available, version, note } }` | `500` | **VERIFIED LIVE** |
| **79** | `POST` | `/api/video/render-reel` | `server/index.js:4829` | Protected + CSRF | `{ imagePath?, audioPath?, srtContent?, title?, duration?, platform? }` | `{ ok: true, id, filename, filePath, relativePath, url, title, platform, width, height, aspectRatio, durationSec, renderedVia, ffmpegAvailable, createdAt }` | `400`, `500` | **VERIFIED LIVE** (Mock JSON if no FFmpeg) |
| **80** | `POST` | `/api/analytics/simulate` | `server/index.js:4843` | Protected + CSRF | `{ script: string, hook?, platform? }` | `{ ok: true, simulation: { platform, viralityIndex, grade, scores, readingStats, retentionCurve, optimizationTips, simulatedAt } }` | `400`, `500` | **VERIFIED LIVE** |
| **81** | `GET` | `/api/publishing/accounts` | `server/index.js:4850` | Protected | None | `{ ok: true, accounts: [{ platform, name, status: "connected", handles }] }` | `500` | **THEATER FAIL** |
| **82** | `GET` | `/api/publishing/queue` | `server/index.js:4854` | Protected | Query: `projectId?`, `status?` | `{ ok: true, queue }` | `500` | **VERIFIED LIVE** |
| **83** | `POST` | `/api/projects/:id/export-vault` | `server/index.js:4862` | Protected + CSRF | URL `:id` | `{ ok: true, filename, sha256, bundle }` | `500` | **SHADOWED DEAD ROUTE** |
| **84** | `POST` | `/api/projects/import-vault` | `server/index.js:4907` | Protected + CSRF | `{ bundle: object }` | `{ ok: true, project, addedSources, state }` | `400`, `500` | **SHADOWED DEAD ROUTE** |
| **85** | `POST` | `/api/publishing/stage` | `server/index.js:4946` | Protected + CSRF | `{ projectId?, platform?, title?, content?, mediaPath?, scheduledAt?, hashtags? }` | `{ ok: true, item }` | `400`, `500` | **VERIFIED LIVE** |
| **86** | `POST` | `/api/publishing/dispatch/:id` | `server/index.js:4956` | Protected + CSRF | URL `:id` | `{ ok: true, item, receipt: { publishedAt, externalId, postUrl, platform, latencyMs, mediaDelivered, status: "delivered", signature } }` | `404`, `500` | **THEATER FAIL** (Simulated dispatch) |
| **87** | `DELETE` | `/api/publishing/:id` | `server/index.js:4968` | Protected + CSRF | URL `:id` | `{ ok: true, deleted: true }` | `404`, `500` | **VERIFIED LIVE** |
| **88** | `POST` | `/api/hooks/generate-variants` | `server/index.js:4974` | Protected + CSRF | `{ sourceText: string, topic?, platform? }` | `{ ok: true, topic, platform, recommendedId, variants, generatedAt }` | `400`, `500` | **VERIFIED LIVE** |
| **89** | `GET` | `/api/waveform/styles` | `server/index.js:4978` | Protected | None | `{ ok: true, styles: ["bars", "smooth-wave", "neon-pulse"] }` | None | **VERIFIED LIVE** |
| **90** | `POST` | `/api/waveform/generate` | `server/index.js:4982` | Protected + CSRF | `{ durationSec?, style?, color?, width?, height?, sampleCount? }` | `{ ok: true, style, color, width, height, durationSec, sampleCount, svgDataUrl, rawSvg }` | `400`, `500` | **VERIFIED LIVE** |
| **91** | `POST` | `/api/trends/analyze` | `server/index.js:4992` | Protected + CSRF | `{ text: string, niche?, platform? }` | `{ ok: true, niche, platform, metrics, hookAnalysis, powerWords, counterPositioning, analyzedAt }` | `400`, `500` | **VERIFIED LIVE** |
| **92** | `POST` | `/api/transmute` | `server/index.js:5002` | Protected + CSRF | `{ sourceText?, title?, niche?, tone?, projectId? }` | `{ ok: true, bundle: { id, title, niche, tone, assets: { reel, xThread, linkedIn, carousel, newsletter } } }` | `400`, `500` | **VERIFIED LIVE** |
| **93** | `POST` | `/api/transmute/export` | `server/index.js:5013` | Protected + CSRF | `{ bundle: object, targetDir? }` | `{ ok: true, bundleDir, filesCount, files }` | `400`, `500` | **VERIFIED LIVE** |

---

## 6. Formal Hostile Audit Verdicts by Major Subsystem

### Subsystem: Client Navigation & Interactive Surfaces
```
================================================================================
HOSTILE AUDIT VERDICT: CLIENT UI SURFACES
Status: NOT READY (FAIL)
Verified Live Controls: 121
Fatal Defects: 1 (TypeError in VaultTab.jsx:733 crashing review rendering)
Broken UI Flows: 1 (Empty Review Modal in AutomationsTab.jsx:613)
Dead Code: 1 (useWakeStore.js Zustand store completely orphaned)
Error Boundaries: 0 (Missing across entire application)
VERDICT: NOT READY
================================================================================
```

### Subsystem: Server API & Communication Layer
```
================================================================================
HOSTILE AUDIT VERDICT: SERVER API & ROUTE CONTRACTS
Status: NOT READY (FAIL)
Total Registered Route Handlers: 87
Verified Live Contracts: 83
Shadowed Duplicate Routes: 2 (/api/projects/:id/export-vault & import-vault at lines 4862 & 4907)
Security Auth Disparities: 2 (/generated-audio & /generated-videos lack session auth)
Simulated Social Dispatch Theater: 2 (Fake accounts & simulated dispatch receipt)
VERDICT: NOT READY
================================================================================
```

### Subsystem: Automation & Review Gate
```
================================================================================
HOSTILE AUDIT VERDICT: AUTOMATION SCHEDULER & REVIEW GATE
Status: NOT READY (FAIL)
Cron Scheduler: VERIFIED (Real 5-field cron parsing & IANA timezone resolution)
Source Hashing: VERIFIED (SHA-256 deduplication)
Review Queue Modal: BROKEN (Modal renderer fails to display packet or approval buttons)
Social Publishing: THEATER (Mock accounts & fake delivery URLs)
VERDICT: NOT READY
================================================================================
```

---

## 7. Recommended Remediation Plan

1. **Fix Fatal TypeError in `VaultTab.jsx:733`**:
   Replace `intakeReviewSelection.has(candidate.reviewId)` with `intakeReviewSelection.includes(candidate.reviewId)`.
2. **Fix Review Queue Modal in `main.jsx`**:
   Add a specific branch for `modal.type === "review"` or format `setModal` in `AutomationsTab.jsx:613` to provide `title`, `body` (formatted JSON or packet summary), and `action` buttons for Approval and Export.
3. **Fix Hardcoded `projectId` in `AgentsTab.jsx:141`**:
   Change `projectId: "wake-v6-main"` to dynamic `projectId: projectId || "wake-v6-main"`.
4. **Purge Simulated Social Dispatch Theater**:
   Update `server/social-publisher.js` to truthfully indicate that social accounts are unauthenticated local export staging targets, or remove simulated latency/URLs.
5. **Deduplicate Server Routes in `server/index.js`**:
   Remove dead duplicate route registrations at lines 4862 and 4907.
6. **Harmonize Static Media Auth Middleware**:
   Add `sessionManager.require` to `/generated-audio` (line 4781) and `/generated-videos` (line 4823).
7. **Introduce React Error Boundary**:
   Wrap the root React component tree in `<ErrorBoundary>` with user-facing recovery mechanisms.
