# WAKE Engine V6 — Judging Evidence Matrix

This file maps every major submission claim to executable verification or inspectable repository evidence. A claim is not treated as proven merely because it appears in documentation.

| Claim | Verification | Evidence location |
|---|---|---|
| Renderer builds from a clean install | `npm ci` and `npm run build` | GitHub Actions: `portable-verification` |
| Deterministic six-stage runtime contract is intact | `npm run audit:runtime` | `scripts/runtime-contract-audit.mjs` and CI logs |
| Scheduler parses cron, reuses manual records, skips unchanged source, exports packets, and records failures | `npm run audit:scheduler` | `scripts/scheduler-audit.mjs` and CI logs |
| Review Required creates a pending review item and exposes the generated packet for inspection | `npm run audit:ui` | `scripts/route-ui-audit.mjs` and Windows CI logs |
| Auto Export writes two real files after a QA-passing scheduled run | `npm run audit:ui` and `npm run audit:scheduler` | Electron hostile workflow plus scheduler audit |
| Windows installer builds | `npm run package:installer` on `windows-latest` | CI artifact `wake-engine-v6-windows-installer` |
| Installer artifact is identifiable | SHA-256 generation in Windows CI | `SHA256SUMS.txt` inside the installer artifact |
| Production dependencies contain no known high-severity advisory at test time | `npm audit --omit=dev --audit-level=high` | GitHub Actions: `security` |
| Git history contains no detected committed secret according to configured scanner | `gitleaks/gitleaks-action@v2` with `fetch-depth: 0` | GitHub Actions: `security` |
| Atomic state, WAL, replay, rollback, backup, and restore controls exist | `npm run audit:phase9` and `npm run audit:wal` | `evidence/phase-audit/phase-09-durability-security/` |
| Loopback, authentication, origin, CSRF, and credential controls exist | Phase 9 security audit | `docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md` and Phase 9 verdict |
| Current product surfaces are documented | Manual and UI configuration | `docs/wake-engine/wake_engine_manual.md` and `src/app-config.jsx` |
| Unsupported claims are blocked from automatic export | Scheduler audit and Tier Zero QA | `scripts/scheduler-audit.mjs`, `server/tier-zero-runtime.js` |
| Scheduled exports contain readable and complete forms | Scheduler audit | Markdown and JSON assertions in `scripts/scheduler-audit.mjs` |
| Judge can reproduce a safe example | Included source file and demo procedure | `examples/proof-of-usefulness-source.md`, `DEMO_SCRIPT.md` |

## Portable verification

Run on Windows, Linux, or a compatible local checkout:

```powershell
npm ci
npm run verify:portable
```

This runs the renderer build, runtime-contract audit, and scheduler audit.

## Windows installer verification

GitHub Actions runs this on `windows-latest`:

```powershell
npm ci
npm run verify:portable
npm run package:installer
```

The job fails if no `.exe` is produced. It then writes a SHA-256 checksum and uploads both files as one artifact.

## Extended local verification

These checks exercise broader local behavior and should be run on the Windows submission machine before recording the final demonstration:

```powershell
npm run smoke
npm run benchmark
npm run audit:wal
npm run audit:phase9
npm run audit:ui
```

Historical evidence is useful background, but the final submission should cite the latest successful run for the exact release commit.

## Evidence interpretation rules

- A green check proves only the commands and commit shown by that check.
- Historical evidence does not automatically prove later code.
- A generated artifact is not trusted without its checksum.
- A feature shown in UI text is not treated as implemented unless executable behavior or code supports it.
- A pending review item is not evidence of a persisted approve/reject decision; those controls are not current V6 functionality.
- An optional provider or model is not treated as available unless the demonstration visibly connects and uses it.
- Zero detected secrets means the configured scanner found none; it is not a mathematical guarantee.

## Judge-facing measurements

The demonstration can report only values visible in the generated packet or audit output:

- source files processed;
- source characters or passages processed;
- evidence passages extracted;
- claims reviewed;
- unsupported claims blocked;
- platform variants produced;
- tool calls recorded;
- agent handoffs acknowledged;
- review items created;
- Markdown and JSON files exported;
- unchanged-source runs skipped;
- execution time;
- recovery test cases passed.

Do not publish invented benchmarks, user counts, time savings, accuracy percentages, or cost reductions.
