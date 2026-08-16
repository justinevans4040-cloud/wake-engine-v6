# WAKE Dark Matter Core — Design

## Purpose
Create a first-class WAKE visualization surface where the central dark-matter brain represents WAKE itself, while runtime telemetry, agents, capabilities, jobs, and system state are represented around it.

## Visual Model
- WAKE is the central dark-matter core: black center, violet energy fractures, drifting particles, gravitational rings, and intensity that scales with real local telemetry.
- Aethere Mesh is represented as faint filaments and orbital paths extending away from the core.
- Agents/capabilities are satellites around WAKE. Their visual status is derived from WAKE runtime capability state.
- Jobs/tasks are pulses that move outward from the core. The first implementation uses task/capability activity already available in application state.
- Machine health is represented by CPU, RAM, GPU, runtime uptime/port, and recent logs from the same `system` object used by Monitor.

## Truth Rule
No visual state may imply a live connection, agent, node, job, or capability unless the current WAKE runtime exposes evidence for it. Unknown data must render as unknown/sampling rather than fabricated values.

## Interaction
The surface is a new top-level `Core` ability. Operators can inspect:
- current WAKE activity state;
- CPU, RAM, GPU, runtime status;
- active capabilities and tasks;
- recent runtime events;
- direct navigation to Agents, Monitor, Vault, Library, and Console.

The central core is interactive and opens a concise WAKE status explanation using the existing modal system.

## Implementation Shape
- `src/components/tabs/CoreTab.jsx`: isolated React visualization and telemetry composition.
- `src/app-config.jsx`: adds the Core tab and ability metadata.
- `src/main.jsx`: imports and renders CoreTab using existing state/system sources.
- `src/styles.css`: Dark Matter Core visual system, motion, reduced-motion behavior, responsive layout.

## Constraints
- No new frontend dependency for the first implementation.
- Use SVG/CSS/React so the feature works inside the existing Vite/Electron build.
- Preserve all existing WAKE routes and behavior.
- Do not modify The Britt or unrelated subsystems.
- Do not invent live Aethere nodes or external connections.
- Respect `prefers-reduced-motion`.

## Success Criteria
1. Core is accessible as a first-class top navigation surface.
2. The core visibly reacts to real CPU/RAM/GPU telemetry when present.
3. Capability/task satellites are generated only from existing WAKE state.
4. No fake network/node claims are introduced.
5. Existing Monitor remains intact.
6. Build remains dependency-compatible with the current package manifest.
