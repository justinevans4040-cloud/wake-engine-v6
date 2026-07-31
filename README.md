# WAKE Engine V6

Local Windows desktop command engine for WAKE Engine V6.

Start with [WAKE_ENGINE_MAP.md](WAKE_ENGINE_MAP.md) for the ability-page map.

## Canonical Path

`C:\Users\justi\Documents\repos\wake-engine`

## Scope

This folder is WAKE Engine only.

- Current advanced app: WAKE Engine V6 at the project root.
- Runtime and product code in this repository belong only to Wake Engine.

## What Is Real In V6

- Electron desktop app. The installed launcher opens a native WAKE Engine V6 window, not Chrome.
- React/Vite command-console UI inspired by the approved V6 concept.
- Express server on `http://127.0.0.1:8786/`.
- Real `/api/health`, `/api/state`, `/api/projects`, `/api/sources`, `/api/frame`, `/api/run-agent`, `/api/content-cluster`, `/api/export`, `/api/snapshot`, and `/api/history` endpoints.
- Real `/api/content-cluster` endpoint for local content clustering.
- Promoted Tier Zero content-agent network with local tools, memory, persisted A2A acknowledgements, replayable handoffs, receipts, and completion gates.
- Local Ollama streaming with an immediate source-driven local draft.
- Content Cluster creation packets with scripts, platform lanes, visual prompts, evidence, distribution plans, and QA verdicts.
- Canonical `wake-content-packet` contract shared by generation, previews, history, clusters, and exports.
- Persistent local JSON store for projects, packets, traces, exports, and history.
- Markdown and JSON exports saved to `server/data/exports`.
- Snapshot JSON files saved to `server/data/snapshots`.
- Explicit truth map for live, partial, next, blocked, external, and separate-app capabilities.

## Current App Shape

V6 is organized around ability pages:

- `Console`: source workspace and first frame generation.
- `Agents`: agent conversation over current source/context.
- `Cluster`: content pillars, output lanes, proof notes, and handoff drafts.
- `Vault`: local source/media intake and search.
- `Library`: saved sources, outputs, exports, and history.
- `Monitor`: runtime telemetry, task monitor, and capability truth.
- `Audit`: snapshot trail.

Each page includes a next-best-step card so the app steers toward finishing the current ask/task/code path.

Each ability page also carries its own mission, input/output contract, live signals, completion criteria, and command rail. The goal is not "good enough UI"; the goal is an operator surface that keeps moving the work toward completion.

Each ability page also includes contextual agent chat for polish and edit passes. The chat supports typed input and a speech-to-text Speak control when the desktop runtime exposes speech recognition.

## Boot + Voice

On launch, V6 shows an old-school terminal boot sequence before the operator surface opens. After boot, the app speaks a local "system online" line using the desktop speech synthesis runtime.

Use the `Voice` control in the header to choose a preset, pick an installed system voice, test the line, or mute it.

## Tier Zero Truth

The agents are Tier Zero under the user-promoted local build parameters. No separate canonical Tier Zero specification exists in this repository. See [TIER_ZERO_BUILD_STATUS.md](TIER_ZERO_BUILD_STATUS.md).

## Runtime Boundaries

- Installed system speech synthesis is used for TTS; no custom voice model is claimed.
- Browser/runtime speech recognition is used for STT.
- Exports are local Markdown and JSON bundles. Automatic social publishing is not claimed.

## Run

```powershell
npm install
npm run build
npm run install:local
npm run desktop
```

The desktop shortcut is:

`C:\Users\justi\Desktop\WAKE Engine V6.lnk`

The shortcut targets Electron directly and does not open a browser.

## Verify

```powershell
npm run build
npm run smoke
npm run benchmark
npm run gate
npm run audit:ui
npm run install:local
```

## Visual Reference

Accepted V6 concept:

`references\WAKE_Command_Console_V6_concept_20260705.png`
