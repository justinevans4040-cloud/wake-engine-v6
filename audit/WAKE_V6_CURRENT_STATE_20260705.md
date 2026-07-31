# WAKE V6 Current State - 2026-07-05

## Request

Build WAKE Command Console V6 from the rendered concept as a real local app, not just a visual mockup.

## Product Boundary

- Product: Wake Engine.
- Repo: `wake-engine`.
- Canonical path: `C:\Users\justi\Documents\repos\wake-engine`.
- Separate from Viral Forge.

## Real In This Pass

- Local React app.
- Local Express API.
- Frame generation.
- Deterministic local content-agent output.
- Snapshot saving.
- Task monitor and capability truth map from server state.

## Not Real Yet

- RUNE / LOOM / ECHO direct runtime integration.
- ViralForge Brothers bridge.
- Cloud LLM generation.
- Memory/vector database.
- Publishing/export bridge.
- Clip cutting, thumbnail rendering, or motion/video pipeline.

## Required Verification

- `npm run build`
- `npm run smoke`
- Browser/mobile visual QA against `references/WAKE_Command_Console_V6_concept_20260705.png`
