# WAKE Dark Matter Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a truth-backed Dark Matter Core surface to WAKE Engine Omega where the central visualization represents WAKE and reacts to existing runtime state.

**Architecture:** Add a self-contained React tab that consumes the already-loaded `state`, `system`, and `systemHistory` objects from `src/main.jsx`. Render the neural/dark-matter visualization with SVG and CSS only, then wire it into the existing tab configuration and modal/navigation system.

**Tech Stack:** React 18, Vite 6, Electron, lucide-react, CSS/SVG.

## Global Constraints
- WAKE is the central brain.
- Do not fabricate external nodes, connections, agent activity, telemetry, or capability state.
- No new frontend dependency in this slice.
- Preserve existing routes and Monitor behavior.
- Respect reduced-motion preferences.
- Do not modify The Britt.

---

### Task 1: Dark Matter Core component

**Files:**
- Create: `src/components/tabs/CoreTab.jsx`

**Interfaces:**
- Consumes: `system`, `systemHistory`, `state`, `navigateSection`, `openMonitorCard`.
- Produces: `CoreTab` React component.

- [ ] Build the visualization from a deterministic SVG core, rings, filaments, and state-derived satellites.
- [ ] Compute activity intensity only from finite CPU/RAM/GPU telemetry values.
- [ ] Generate capability satellites from `state.capabilities` and task pulses from `state.tasks`; empty state renders quiet rather than invented activity.
- [ ] Add operator navigation buttons to Agents, Monitor, Console, Vault, and Library.
- [ ] Make the core itself open a truth-backed runtime summary.

### Task 2: Register the Core ability

**Files:**
- Modify: `src/app-config.jsx`

**Interfaces:**
- Adds tab id `core`.
- Adds `abilityBlueprints.core`, `abilityAgentDefaults.core`, and `polishPrompts.core`.

- [ ] Import an existing lucide icon already known to be available in the package.
- [ ] Place Core first in top-level navigation.
- [ ] Add accurate ability metadata without claiming unimplemented Aethere functionality.

### Task 3: Wire Core into application state

**Files:**
- Modify: `src/main.jsx`

**Interfaces:**
- Imports `CoreTab`.
- Renders it when `active === "core"`.
- Passes the existing `state`, `system`, `systemHistory`, `navigateSection`, and `openMonitorCard` references.

- [ ] Add import.
- [ ] Add render branch before Console.
- [ ] Exclude Core from generic Ability scaffold/chat injection so the neural visualization remains the primary surface.
- [ ] Preserve all current route behavior.

### Task 4: Dark Matter visual system

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Defines only `.wake-core-*` scoped styles.

- [ ] Add full-height dark core stage, gravitational glow, energy fractures, orbit rings, satellites, telemetry HUD, and action rail.
- [ ] Use CSS custom properties driven by component inline values for intensity.
- [ ] Add responsive layout for narrow screens.
- [ ] Add `prefers-reduced-motion` rules that disable orbital/pulse motion without hiding information.

### Task 5: Verification

**Files:**
- Verify: `package.json`, `src/components/tabs/CoreTab.jsx`, `src/app-config.jsx`, `src/main.jsx`, `src/styles.css`.

- [ ] Confirm no new dependency was introduced.
- [ ] Run `npm run build`.
- [ ] Run `npm run audit:routes`.
- [ ] Run `npm run audit:ui`.
- [ ] Review rendered Core at desktop and narrow widths.
- [ ] Confirm unknown telemetry is displayed as sampling/unknown, never fabricated.

## Verification limitation for this execution environment
The connected GitHub workspace supports branch and file mutation, but the local execution container cannot resolve `github.com`, so it cannot clone this repository to run npm commands. Code changes must therefore remain on the isolated feature branch until a GitHub/CI or connected runtime build verifies them.
