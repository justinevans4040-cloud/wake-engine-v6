# Phase 9 - Local Durability, Security, And Install Integrity

Status: complete and gate-enforced.

This phase implements the original Phase 9 scope only. It does not add a replacement phase or expand product scope.

## 1. Durable Local Writes

- `server/durable-storage.js` replaces direct store overwrites with versioned atomic writes and a replayable write-ahead log.
- Every transaction first persists a hash-addressed staged payload and backup, then flushes a pending WAL record before the primary state can change.
- Recovery parses the WAL, identifies transactions without a terminal record, and idempotently replays the staged payload. If the staged payload is unavailable or invalid, recovery restores the verified previous version and records a terminal rollback.
- Primary state, integrity hash, version metadata, WAL terminal record, and transaction cleanup are ordered so a second crash during recovery can be recovered again.
- Mutating API requests are serialized so concurrent read-modify-write operations cannot overwrite one another.
- Non-WAL corruption recovery still checks the primary payload, previous file, interrupted temporary files, then rotating automatic backups.
- Disk-capacity checks stop a write with HTTP 507 before existing data is replaced.

Why this is stronger: the WAL contains enough durable information to finish or reverse an interrupted transaction instead of merely recording that one occurred. Temp-file replacement prevents partial JSON, fsync establishes explicit durability boundaries, SHA-256 catches corruption, and replay/rollback remains idempotent after repeated crashes.

Crash validation forcibly terminates separate Node processes after every write, fsync, rename, replay, and rollback boundary. All 61 interruption points recovered to a terminal, integrity-verified state.

## 2. Backup, Restore, Export, Retention, And Cleanup

- `server/backup-manager.js` creates integrity-checked compressed `.wakebundle` files.
- Automatic store backups retain 24 versions.
- Manual backups retain 20 bundles; export and pre-restore groups retain 12.
- Restore validates the bundle hash, validates every entry hash and path, and creates a pre-restore rollback bundle first.
- Full-data export, cache cleanup, and disk-full behavior are available through API and Project settings.

## 3. Electron User Data Ownership

Production runtime paths now live under Electron `userData`:

- live data: `%APPDATA%\Wake Engine V6\data`
- logs: `%APPDATA%\Wake Engine V6\logs`
- provider credential vault: `%APPDATA%\Wake Engine V6\secure`
- cache: `%APPDATA%\Wake Engine V6\cache`
- generated images and backups: under the local data directory

`electron/runtime-paths.js` performs one-time legacy migration, records file hashes, keeps a rollback copy, and supports migration rollback.

## 4. Package Exclusions

Electron Builder uses explicit shipped-code allowlists: `dist/**/*`, `electron/*.js`, `server/*.js`, the icon, and package metadata.

Live data, archives, logs, credential files, generated images, fixtures, smoke runs, UI profiles, and audit residue are not packaged. The built `app.asar` was inspected after packaging.

## 5. Loopback API Boundary

- The API always binds to `127.0.0.1`; caller input cannot switch it to `0.0.0.0`.
- Non-loopback socket addresses, invalid Host values, and non-local Origins are rejected.
- Protected API routes and generated images require an authenticated local Wake session.
- Mutating requests also require the session CSRF token.

## 6. Local Session

The approved old-school login appearance is unchanged. The runtime now uses:

- a salted `scrypt` access-phrase verifier
- timing-safe phrase comparison
- cryptographically random in-memory session tokens
- 12-hour expiration
- `HttpOnly`, `SameSite=Strict` cookies
- CSRF verification for every protected mutation

The renderer never receives or stores the session token.

## 7. Provider Credential Vault

Provider secrets are encrypted and decrypted only through Electron `safeStorage` in `electron/secure-vault.js`.

The API returns provider status without returning the key. Provider API keys are not loaded from environment variables and are not placed in renderer state, normal JSON state, logs, backups, or exports.

## 8. Install And Recovery Validation

Validated on the current Windows machine:

- clean package launch
- legacy data migration
- migration rollback
- packaged `userData` paths
- local login and session enforcement
- in-place package installation
- uninstall while preserving user data
- reinstall while preserving the store and verifier hashes
- post-reinstall login
- desktop shortcut recreation and current installed executable target
- packaged launch without Node, Vite, the repository, or another development runtime

## Gates And Evidence

- `npm run audit:phase9`: 16/16 plus WAL crash audit 61/61
- `npm run audit:wal`: 61/61 write, replay, and rollback crash boundaries
- `npm run smoke`: 26/26
- `npm run audit:ui`: 128 actions
- `npm run gate`: required before Phase 9 is considered complete
- Phase 9 verdict: `phase-audit/phase-09-durability-security/phase9-verdict.json`
- WAL crash verdict: `phase-audit/phase-09-durability-security/wal-crash-verdict.json`
- Packaged launch: `phase-audit/phase-09-durability-security/packaged-launch.json`
- Install UI: `phase-audit/phase-09-durability-security/installed-ui.json`
- Uninstall/reinstall: `phase-audit/phase-09-durability-security/uninstall-reinstall.json`
- Package inventory: `phase-audit/phase-09-durability-security/packaged-asar-files.txt`
