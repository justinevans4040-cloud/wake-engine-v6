<div align="center">
  <h1>WAKE Engine V6</h1>
  <p><b>The engine doesn't just build the reality. It makes sure the reality survives.</b></p>
</div>

**CURRENT (2026-07-30):** WAKE Engine V6 is the sovereign, local-first architectural layer for ForgeFront Systems. Designed for the HackerNoon Decentralized AI track, WAKE shifts power back to the local machine. It is a desktop command engine that runs **Tier Zero** operations with extreme durability, cryptographic local security, and atomic write-ahead logging (WAL).

This repository is the public, **traceable** record of the WAKE Engine architecture.

---

## ⚡ Core Capabilities (The Sovereign Workbench)

WAKE Engine operates via specific "Ability Pages" that drive an uninterrupted operational loop (the **Next-Step Rule**):

- **Console & Vault:** The intake layer. Paste or scan local folders for source material, briefs, and transcripts. 
- **Agents & Clusters:** The interpreter and campaign network. Sovereign agents reason over local source to produce platform lanes, scripts, visual prompts, and evidence packs. 
- **Monitor & Audit:** The machine room. Real-time runtime telemetry and local receipt snapshots for verifiable proof-of-work.
- **Section Chat & System Voice:** Context-aware agent routing with Chromium-based desktop speech synthesis (`Villain`, `Sentinel`, `Calm` boot sequences).

## 🛡️ Phase 9: Local Durability & Security

Decentralized AI means nothing if the local node is fragile. WAKE Engine V6 implements a hardened local storage protocol:

- **Idempotent Write-Ahead Logging (WAL):** Every transaction persists a hash-addressed staged payload and flushes a WAL record before primary state changes. If the agent or power crashes at any of the 61 interruption points, recovery idempotently replays or rolls back to an integrity-verified state.
- **Provider Credential Vault:** API keys are encrypted via Electron `safeStorage`. They are never loaded into env vars, renderer state, JSON logs, or exports.
- **Loopback API Boundary:** The API binds strictly to `127.0.0.1`. Mutating requests require a cryptographically random, timing-safe session token and CSRF verification.

---

## 🗺️ Documentation Map

### Current Direction
- **[WAKE_ENGINE_MAP.md](docs/current/WAKE_ENGINE_MAP.md)** - The core architectural map and next-step rules.
- **[PHASE_9_LOCAL_DURABILITY_SECURITY.md](docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md)** - Deep dive into WAL, atomic writes, and local persistence logic.
- **[TIER_ZERO_BUILD_STATUS.md](docs/current/TIER_ZERO_BUILD_STATUS.md)** - Current status of the Tier Zero environment.

### Iteration Archive & Proof of Work
- **[archive/iterations/](archive/iterations/)** — Dated snapshots and CODEX handoffs of every prior operational phase. Nothing is deleted.
- **[evidence/](evidence/)** — Raw smoke logs, phase audits, crash-recovery verdicts, and test intakes (verifiable proof of work).

---

## What changed (honest status)

| Era | What it was | Where to read it |
|---|---|---|
| Phases 1-8 | Initial autonomy, generation, and file mapping | [archive/iterations/](archive/iterations/) |
| Phase 9 (2026-07-16) | Local Durability & Security. WAL crash recovery | [docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md](docs/current/PHASE_9_LOCAL_DURABILITY_SECURITY.md) |
| Structuring (2026-07-30) | Professionalized repository standard (Athere-aligned) | This README + [docs/current/](docs/current/) |

---

## License

All rights reserved by ForgeFront Systems.
