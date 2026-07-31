# WAKE Engine V6 Map

WAKE Engine V6 is the current advanced app. Think of it as a local desktop command engine:

source material goes in, structured work comes out, and WAKE keeps a local trail of what happened.

## Ability pages

Each major ability now has its own page:

- Console: the workbench. Paste the ask, task, source, notes, transcript, or code brief here first.
- Agents: the interpreter layer. Ask a selected WAKE agent to reason over the current source and local context.
- Cluster: the campaign creation network. Produces platform lanes, scripts, visual prompts, evidence packs, distribution plans, and export bundles.
- Vault: the intake/search layer. Scans configured local folders and loads useful source back into Console.
- Library: the memory. Shows saved sources, generated outputs, exports, and history.
- Monitor: the machine room. Shows runtime telemetry, internal tasks, and capability truth.
- Audit: the receipt drawer. Saves local snapshots after meaningful work.

Every ability page has three parts:

1. Next Step: what WAKE thinks the operator should do now.
2. Ability Contract: the page mission, input, output, live signals, and completion criteria.
3. Command Rail: the 2-3 highest-value actions for that ability.
4. Section Chat: a contextual agent conversation for polish, edit, and next-step passes.

Section chat routes to the most useful default agent for the active ability, while still allowing manual agent switching. The Speak button uses the desktop Chromium speech-recognition capability when available; typed chat remains the fallback.

## Boot and system voice

WAKE opens with an old-school terminal boot sequence. When the sequence completes, the app speaks a local "system online" line.

Voice settings live behind the header `Voice` control:

- Villain: lower, slower system-online voice.
- Sentinel: command voice.
- Calm: softer operator voice.
- Muted: no launch voice.

The app uses installed desktop voices through browser speech synthesis; the exact sound depends on the voices available on the machine.

## Next-step rule

Every page should steer toward the next best action:

1. If there is no source, go to Console.
2. If source exists but no output exists, generate a frame.
3. If a frame/output exists, run an agent or build a cluster.
4. If output/cluster work is useful, export it.
5. If the task is complete or important, save an audit snapshot.
6. If the system state is unclear, check Monitor.

The point is that WAKE should not leave the operator staring at a cockpit. It should keep the work moving.

## Quality bar

WAKE V6 should not feel like a demo. Each ability needs:

- A clear mission.
- A clear input and output.
- A visible completion condition.
- A small set of decisive actions.
- Local persistence or an honest boundary label.
- A path toward the next useful move.

## What lives where

- App UI: `src/`
- Desktop shell: `electron/`
- Local API and generation logic: `server/`
- Local data store, exports, snapshots: `server/data/`
- App icons and public assets: `public/` and `build/`
- Build/audit evidence: `audit/`
- Older WAKE Engine material: `versions/`

## Scope rule

This folder is for WAKE Engine only. V6 is the active app. Older WAKE command-console material can stay under `versions/` as reference, but it is not the current app.
