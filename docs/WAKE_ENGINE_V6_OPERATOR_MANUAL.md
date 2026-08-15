# WAKE ENGINE V6 — MASTER OPERATOR MANUAL
### Complete Visual Guide, System Architecture & Operational Workflows
**Version:** 6.4.0 (Enterprise Desktop Edition)  
**Author:** ForgeFront Systems  
**Hardware & OS:** Lenovo PC / Windows 10 & 11 (100% Local Machine Execution)

---

## TABLE OF CONTENTS
1. [Visual System Map & Operational Flow](#1-visual-system-map--operational-flow)
2. [Console Surface (Autopilot & Campaign Command)](#2-console-surface-autopilot--campaign-command)
3. [Agents Surface (Tier-Zero 6-Stage Autonomous Pipeline)](#3-agents-surface-tier-zero-6-stage-autonomous-pipeline)
4. [Cluster Surface (Omnichannel Content Studio & Scene Beats)](#4-cluster-surface-omnichannel-content-studio--scene-beats)
5. [Vault Surface (1-Click GitHub Ingest, Trend Intelligence & Local Ingestion)](#5-vault-surface-1-click-github-ingest-trend-intelligence--local-ingestion)
6. [Universal Speak-to-Text & Voice Dictation Workflows](#6-universal-speak-to-text--voice-dictation-workflows)
7. [Transmutation Studio (1-Click Omnichannel Multi-Format Export)](#7-transmutation-studio-1-click-omnichannel-multi-format-export)
8. [Audio Waveforms, Neural Voiceover & Subtitle Studio](#8-audio-waveforms-neural-voiceover--subtitle-studio)
9. [Automations & Headless Background Scheduler](#9-automations--headless-background-scheduler)
10. [Library, Monitoring, WAL Durability & Security Gate](#10-library-monitoring-wal-durability--security-gate)

---

## 1. VISUAL SYSTEM MAP & OPERATIONAL FLOW

```mermaid
graph TD
    A[Raw Source Material / 1-Click GitHub Clone / Obsidian Notes] -->|Local Ingestion| B(IP Vault & Evidence Ingestion)
    B -->|Verified Citations & Quotes| C{Archivist Agent}
    C -->|Core Tension & 4 Angles| D{Strategist Agent}
    D -->|Timed Scene Beats & Scripts| E{Scriptwriter Agent}
    E -->|Visual Style & Diffusion Prompts| F{Creative Director Agent}
    F -->|Deterministic Claim Verifier| G{QA Gate Verifier}
    G -->|Pass / Fail Gate| H[Verified Content Cluster & Omnichannel Packet]
    
    H --> I[1-Click Transmutation Studio]
    H --> J[Neural TTS & Waveform Studio]
    H --> K[Local 1080x1920 Video Rendering]
    H --> L[Direct Social Publishing Queue]
```

### High-Level UI Navigation Architecture
```text
+---------------------------------------------------------------------------------------------------------+
| [FORGEFRONT EMBLEM]  WAKE ENGINE V6  ::  Operator: JUSTIN  ::  Status: [100% LOCAL PASS]  [TTS: ACTIVE] |
+---------------------------------------------------------------------------------------------------------+
| [CONSOLE]  |  [AGENTS]  |  [CLUSTER]  |  [VAULT]  |  [LIBRARY]  |  [AUTOMATIONS]  |  [MONITOR]  | [AUDIT] |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  ACTIVE SURFACE WORKSPACE                                                                               |
|  +--------------------------------------------------------------------+  +----------------------------+ |
|  | PRIMARY TASK & EDITOR PANELS                                       |  | CONTEXT AGENT CHAT         | |
|  | - Autopilot Direction (Speak-to-Text Enabled)                      |  | - Real-time Voice / Mic    | |
|  | - 1-Click GitHub Repository Cloner                                 |  | - LLM Bridge (Llama 3.2)   | |
|  | - Omnichannel Transmutation Matrix                                 |  | - Verbatim Evidence Polish | |
|  | - Audio Waveform Spectrum & Subtitle Studio                        |  | - 1-Click Promote Answer   | |
|  +--------------------------------------------------------------------+  +----------------------------+ |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
| SYSTEM TELEMETRY: 27 Tools Loaded | 6 Agents Verified | 0 Cloud Leaks | WAL Journal Active              |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. CONSOLE SURFACE (AUTOPILOT & CAMPAIGN COMMAND)

The **Console Tab** is the central launchpad for turning raw ideas, client notes, or project memory into fully synchronized cross-platform marketing campaigns.

### Visual UI Annotated Breakdown:

```text
+---------------------------------------------------------------------------------------------------------+
| CAMPAIGN AUTOPILOT                                                    [ 14 Sources Loaded ] [ Engine Ready ] |
| Current Project: ForgeFront Master                                                                      |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
| Campaign Direction & Goal Prompt:                             [ 🎙️ Speak Direction ] <--- VOICE BUTTON  |
| +-----------------------------------------------------------------------------------------------------+ |
| | "Launch offer for local home organizer: highlight clutter anxiety, offer 48hr turnaround..."       | |
| +-----------------------------------------------------------------------------------------------------+ |
|                                                                                                         |
| [ ✨ CREATE AUTONOMOUS CAMPAIGN ] <--- (Analyzes project memory + direction to build 4 platforms)        |
|                                                                                                         |
| Progress Sequence: [ ✔️ Research ] ===> [ ✔️ Write ] ===> [ ✔️ Design ] ===> [ ✔️ QA Gate Verified ]    |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
| PLATFORM PREVIEWS:  [ TikTok (9:16) ]  [ Instagram (4:5) ]  [ X / Twitter (16:9) ]  [ LinkedIn ]        |
| +---------------------------------------------------+  +----------------------------------------------+ |
| | HOOK & SCRIPT (0-60s Scene Beats)                 |  | AI VISION PROMPT & ASSET PREVIEW             | |
| | 0-3s: "Stop scrolling if your kitchen is chaos."  |  | Prompt: "Cinematic overhead kitchen counter, | |
| | 3-15s: Proof: "Over 450 pantries organized."      |  | natural soft morning light, 8k resolution."  | |
| | 15-45s: 3-step labeled zone system breakdown.     |  | Aspect: 9:16 (Vertical Reel)                 | |
| | 45-60s: CTA: "Claim your free kitchen reset."     |  | [ 🖼️ Generate Image ] [ 💾 Save To Vault ]   | |
| +---------------------------------------------------+  +----------------------------------------------+ |
|                                                                                                         |
| [ 📋 Copy Platform Output ]  [ 💾 Save Source ]  [ ⬇️ Export Package (MD + JSON) ]                       |
+---------------------------------------------------------------------------------------------------------+
```

### Step-by-Step Operator Workflow:
1. **Speak or Type Direction**: Click `🎙️ Speak Direction` and state your campaign goal (or type in the box).
2. **Execute Autopilot**: Click `✨ Create Campaign`.
3. **Inspect Platform Variations**: Switch between **TikTok**, **Instagram**, **X (Twitter)**, and **LinkedIn** tabs to verify platform-native tone and character constraints.
4. **Generate Campaign Visual**: Click `Generate Original Visual` to render custom aspect-ratio imagery locally via Flux / Diffusion.
5. **Export Complete Bundle**: Click `Export Package` to write durable Markdown and JSON files with SHA-256 integrity hashes to `server/data/exports/`.

---

## 3. AGENTS SURFACE (TIER-ZERO 6-STAGE AUTONOMOUS PIPELINE)

The **Agents Tab** coordinates the 6 deterministic operator personas. Every claim is strictly validated against local source citations before passing the deterministic QA Gate.

### Pipeline DAG Flow:
```text
+----------------+      +-----------------+      +-------------------+
|  01. ARCHIVIST | ===> | 02. STRATEGIST  | ===> | 03. SCRIPTWRITER  |
|  Temp: 0.1     |      | Temp: 0.3       |      | Temp: 0.4         |
|  Verbatim Cite |      | 4 Target Angles |      | Timed Scene Beats |
+----------------+      +-----------------+      +-------------------+
        ||                                                 ||
        \/                                                 \/
+----------------+      +-----------------+      +-------------------+
| 06. EXPORT     | <=== |   05. QA GATE   | <=== | 04. CREATIVE DIR  |
| Structured MD  |      | Deterministic   |      | Visual Lighting & |
| & JSON Packet  |      | Citation Match  |      | Diffusion Prompts |
+----------------+      +-----------------+      +-------------------+
```

### Stage Responsibilities:
- **Stage 01 (Archivist)**: Parses source text line by line. Zero hallucination tolerance. Extracts verbatim quotes with line number tracking.
- **Stage 02 (Strategist)**: Derives core promise, transformation tension, 4 platform angles, and 8 high-conversion hooks.
- **Stage 03 (Scriptwriter)**: Generates 4-part timed scene beats:
  - `00:00 - 00:03`: Psychological Hook
  - `00:03 - 00:15`: Empirical Proof / Case Study
  - `00:15 - 00:45`: Actionable Value / Framework
  - `00:45 - 00:60`: High-Conversion Call to Action (CTA)
- **Stage 04 (Creative Director)**: Formulates cinematic diffusion prompts, focal subject guidelines, lighting composition, and aspect ratio recommendations.
- **Stage 05 (QA Gate Verifier)**: Scans 100% of generated script lines against the Archivist's verbatim source quotes. Blocks unverified claims from export.
- **Stage 06 (Export Manifest)**: Packages verified outputs into durable markdown, structured JSON, and image manifests with cryptographic hashes.

---

## 4. CLUSTER SURFACE (OMNICHANNEL CONTENT STUDIO & SCENE BEATS)

The **Cluster Tab** provides a holistic view of the full cross-platform campaign matrix.

```text
+---------------------------------------------------------------------------------------------------------+
| CAMPAIGN CLUSTER STUDIO                                                               [ QA STATUS: PASSED ] |
+---------------------------------------------------------------------------------------------------------+
| Platform Lanes:  [ Lane 1: TikTok ]  [ Lane 2: Instagram ]  [ Lane 3: X / Twitter ]  [ Lane 4: LinkedIn ]|
|                                                                                                         |
| SCRIPT SCENE BEATS (6 Timed Scenes):                                                                    |
| [Scene 1] Hook (0-3s)     :: "Why 90% of local service ads fail in the first 2 seconds."               |
| [Scene 2] Tension (3-8s)  :: "Most creators build features before confirming verified audience proof."  |
| [Scene 3] Proof (8-18s)   :: "Here is what happened across 50 live automated campaigns."                |
| [Scene 4] Step 1 (18-30s) :: "First: Lock your verbatim source evidence in the local IP Vault."        |
| [Scene 5] Step 2 (30-45s) :: "Second: Synthesize 5 psychological hook variations."                      |
| [Scene 6] Action (45-60s) :: "Deploy the WAKE Engine workflow today. 100% local, zero cloud fees."     |
|                                                                                                         |
| VERBATIM EVIDENCE TRACE (6 Confirmed Source Citations):                                                 |
| 1. "Line 14: Local execution ensures zero cloud data leakage."                                          |
| 2. "Line 42: Verified 4-part scene structure yields 84% retention."                                     |
|                                                                                                         |
| [ ⬇️ Export Cluster Bundle ]  [ 🎙️ Speak Polish Instructions ]  [ 🔄 Regenerate Cluster ]                |
+---------------------------------------------------------------------------------------------------------+
```

---

## 5. VAULT SURFACE (1-CLICK GITHUB INGEST, TREND INTELLIGENCE & LOCAL INGESTION)

The **Vault Tab** manages all intellectual property, source files, and repository connections.

### Feature 1: 1-Click GitHub Repository Ingestion

```text
+---------------------------------------------------------------------------------------------------------+
| 1-CLICK GITHUB REPOSITORY INGESTION & FLAGSHIP SCANNER                                      [ GIT SYNC ]|
+---------------------------------------------------------------------------------------------------------+
| GitHub Repository URL:                                  Branch:                                         |
| [ https://github.com/justin/my-content-repo            ] [ main       ]                                 |
|                                                                                                         |
| Personal Access Token (Optional — only for private repos):                                              |
| [ ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx            ] (Never saved to disk)                           |
|                                                                                                         |
| [ ⚡ CLONE & INDEX GITHUB REPO ] <--- (Clones, indexes, and categorizes all assets automatically)         |
|                                                                                                         |
| Ingestion Results:                                                                                      |
| +-------------------+ +-------------------+ +-------------------+ +-------------------+ +---------------+ |
| | Pictures / Stills | | Demo Videos       | | Apps & Builds     | | Evidence Docs     | | Flagship      | |
| |      48 Files     | |     12 Files      | |     6 Builds      | |     34 Docs       | |   10 Flagship | |
| +-------------------+ +-------------------+ +-------------------+ +-------------------+ +---------------+ |
+---------------------------------------------------------------------------------------------------------+
```

### Feature 2: Competitor & Niche Trend Reverse-Engineering Studio

```text
+---------------------------------------------------------------------------------------------------------+
| COMPETITOR HOOK & TREND REVERSE-ENGINEERING                                       [ TREND INTELLIGENCE ]|
+---------------------------------------------------------------------------------------------------------+
| Industry / Niche: [ B2B SaaS & AI Automation        ]  Platform: [ TikTok / Reels (Fast Paced)        ] |
|                                                                                                         |
| Competitor Script or Viral Video Transcript:                 [ 🎙️ Dictate Transcript ]                  |
| +-----------------------------------------------------------------------------------------------------+ |
| | "I spent $50,000 testing AI marketing tools so you don't have to. Here are the 3 that actually work." | |
| +-----------------------------------------------------------------------------------------------------+ |
|                                                                                                         |
| [ ⚡ Reverse-Engineer Viral Pattern ]                                                                   |
|                                                                                                         |
| Analysis Results:                                                                                       |
| - Viral Efficiency Score: [ 92/100 ]                                                                    |
| - Psychological Hook Pattern: "Financial Sacrifice / Secret Insider Disclosure"                        |
| - Trigger Vocabulary: [ $50,000 ] [ testing ] [ actually work ] [ don't have to ]                      |
|                                                                                                         |
| Strategic Counter-Positioning Angles (To Dismantle Competitor Position):                                |
| 1. "The Expensive Fallacy": Why spending $50k on cloud tools is obsolete when local engines exist.     |
| 2. "The Privacy Gap": What those 3 tools do with your private customer data behind closed doors.        |
| 3. "The Sovereign Alternative": How to run the entire stack on your Lenovo PC for $0/month.             |
|                                                                                                         |
| [ 🎯 Use Counter-Angle in Creator ]                                                                     |
+---------------------------------------------------------------------------------------------------------+
```

---

## 6. UNIVERSAL SPEAK-TO-TEXT & VOICE DICTATION WORKFLOWS

Every primary input in WAKE Engine V6 includes speech recognition:

| Surface | Voice Button Label | What It Dictates |
| :--- | :--- | :--- |
| **Instructions Tab** | `Speak Goal` / `Voice Input` | Plain-language operational goal for step-by-step guidance |
| **Console Tab** | `Speak Direction` | Campaign focus, product launch details, and offers |
| **Console Tab** | `Dictate Source` | Spoken notes and raw source material |
| **Agents Tab** | `Dictate Prompt` | Visual lighting, composition, and diffusion camera direction |
| **Vault Tab** | `Dictate Transcript` | Competitor video transcripts and viral scripts |
| **Vault Tab** | `Speak Mission` | Target audience and brand intake criteria |
| **Automations Tab** | `Speak Ask` | Background Strategist instructions for cron automation runs |
| **Section Chat** | `Speak` (Mic Button) | Interactive conversation with active Content Agent |

---

## 7. TRANSMUTATION STUDIO (1-CLICK OMNICHANNEL MULTI-FORMAT EXPORT)

From any single source document, the **Transmutation Studio** instantly generates 5 distribution-ready formats:

```text
                               +-------------------------------------+
                               |         MASTER SOURCE INPUT         |
                               +-------------------------------------+
                                                 ||
          +-------------------+------------------+-------------------+-------------------+
          ||                  ||                 ||                  ||                  ||
          \/                  \/                 \/                  \/                  \/
  +---------------+   +---------------+  +---------------+   +---------------+   +---------------+
  |  9:16 REEL    |   |   X THREAD    |  |  LINKEDIN     |   |  IG CAROUSEL  |   |  EMAIL BRIEF  |
  |  Timed Script |   |  7-Tweet Pack |  |  Deep-Dive    |   |  5-Slide Deck |   |  Executive    |
  |  Scene Visuals|   |  Hook + CTA   |  |  Case Study   |   |  Visual Prompts|  |  Newsletter   |
  +---------------+   +---------------+  +---------------+   +---------------+   +---------------+
```

**Export Location**: `server/data/exports/omnichannel_<timestamp>/` containing individual Markdown, JSON, and asset files.

---

## 8. AUDIO WAVEFORMS, NEURAL VOICEOVER & SUBTITLE STUDIO

- **Neural Voiceover Studio**: Synthesizes clean audio narration locally using Windows System TTS voices (David, Mark, Zira, Neural) without internet access.
- **Audio Spectrum Waveforms**: Generates 6 animated visualizer styles (*Cyber Spectrum, Neon Bars, Audio Wave, Radial Pulse, Minimalist Pulse, Grid Wave*).
- **Subtitle Studio**: Generates synchronized `.srt` and `.vtt` subtitle files for video editors and social platforms.
- **Local FFmpeg 1080x1920 Reel Renderer**: Combines voice audio, animated waveforms, background visuals, and burned-in subtitles into an MP4 video file.

---

## 9. AUTOMATIONS & HEADLESS BACKGROUND SCHEDULER

WAKE Engine runs a background daemon for unattended operations:
- **Dropzone Watchers**: Monitors local folders (e.g. `C:\Users\justi\wake-dropzone`). Dropping any file automatically triggers intake.
- **Cron Automation Scheduler**: Executes multi-agent workflows on schedule (e.g., `0 20 * * 0` for Sunday 8:00 PM).
- **Outbound Webhooks**: Automatically dispatches completed content packets to n8n, Make.com, or custom webhooks.
- **Headless CLI Command**:
  ```bash
  node scripts/wake-cli.mjs schedule-daemon
  ```

---

## 10. LIBRARY, MONITORING, WAL DURABILITY & SECURITY GATE

- **WAL Storage (Write-Ahead Logging)**: All changes are recorded to `server/data/wake-v6-store.json.wal` before writing to disk, ensuring recovery from crashes.
- **Zero-Cloud Gate**: Blocks unapproved external API transmissions.
- **Operator Gate**: Local session authorization keeps all work confidential on your machine.
