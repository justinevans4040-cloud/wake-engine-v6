# Wake Engine Handoff - Phase 9 Complete

## Authority

Read `CODEX_READ_ME_FIRST.md` before any action. The only authorized repo is:

`C:\Users\justi\Documents\repos\wake-engine`

Do not use the OneDrive duplicate. Do not add or mix unrelated agents, apps, projects, or source material.

## Current State

Phase 9 is implemented as the exact eight-part durability, local security, credential, packaging, migration, and install scope recorded in `PHASE_9_LOCAL_DURABILITY_SECURITY.md`.

The production Windows app is installed at:

`%LOCALAPPDATA%\Programs\WAKE Engine V6\WAKE Engine V6.exe`

The desktop shortcut points to that installed executable with no development arguments. Live data was migrated to `%APPDATA%\Wake Engine V6` and survived validated uninstall/reinstall without hash changes.

## Main Phase 9 Files

- `server/durable-storage.js`
- `server/backup-manager.js`
- `server/local-session.js`
- `server/index.js`
- `server/image-generation.js`
- `electron/runtime-paths.js`
- `electron/secure-vault.js`
- `electron/main.js`
- `src/api.js`
- `src/main.jsx`
- `scripts/phase9-durability-security.mjs`
- `scripts/wal-crash-worker.mjs`
- `scripts/wal-crash-audit.mjs`
- `scripts/ui-button-audit.mjs`
- `scripts/install-wake-v6-local.ps1`
- `scripts/wake-gatekeeper.mjs`
- `package.json`

## Verified Results

- build: pass
- smoke: 26/26
- Phase 8 baseline: 11/11
- Phase 9 durability/security: 16/16
- recoverable WAL crash audit: 61/61 write, replay, and rollback boundaries
- benchmark: 13/13 budgets
- UI audit: 128 actions
- full gate: pass
- unpacked package: pass
- NSIS installer: pass
- packaged launch: pass on `127.0.0.1`
- package data exclusion inspection: pass
- install/uninstall/reinstall/shortcut: pass

## Important Runtime Rules

- Server binding is fixed to `127.0.0.1`.
- The visible login design is locked; authentication is now server-backed.
- Mutations require the local session and CSRF token.
- Provider secrets belong only in Electron `safeStorage`.
- Live state writes go through `DurableJsonStore`.
- Pending WAL transactions must remain replayable or rollback-capable across repeated process termination.
- New durable file writes use `writeFileAtomic`.
- Package files remain an explicit allowlist; never broaden back to `server/**/*`.
- Manual backup, restore, export-all, and cache cleanup are tested through the UI and API.

## Evidence

Use `phase-audit/phase-09-durability-security` for Phase 9 machine-readable evidence and `phase-audit/phase-00-gatekeeper/phase-verdict.json` for the complete gate verdict.
