# WAKE Engine Omega - Instruction Manual

**Read this first.** This is the only operator manual. Older manual filenames under `docs/` are retired stubs. This file matches what the app actually does today.

| You want | Go here |
|---|---|
| Open the app | §1 Open WAKE |
| Make content from a note | §2 First run (happy path) |
| What each tab means | §3 Tab map |
| Schedule folder work | §4 Automations |
| Voice + MP4 | §5 Media tools |
| Stuck / wrong expectation | §6 Truth boundaries |
| Sales leave-behind (professional brief) | [WAKE_OMEGA_PROFESSIONAL.html](./WAKE_OMEGA_PROFESSIONAL.html) |

Full honesty list: [`KNOWN_LIMITATIONS.md`](../KNOWN_LIMITATIONS.md). Tool catalog: [`server/omega-tools.js`](../server/omega-tools.js).

Older files named `WAKE_ENGINE_V6_OPERATOR_MANUAL.md` / `wake_engine_manual.md` are **retired stubs** — they no longer contain instructions.

---

## 1. Open WAKE

**Desktop (preferred)**

1. Double-click **WAKE Engine Omega** on the Desktop, or run `START_WAKE_ENGINE_V6.cmd` in the repo.
2. Wait until the window loads and the status shows the local engine is up (loopback API).
3. You should see top tabs: Console · Agents · Cluster · Vault · Library · Instructions · Automations · Monitor · Audit.

**From source (dev)**

```powershell
cd C:\Users\justi\WORKSPACE\Active_Projects\wake-engine-v6
npm install
npm run build
npm run desktop
```

Do not run from OneDrive / Dropbox / Google Drive / iCloud sync folders.

---

## 2. First run (happy path)

Do this once end-to-end before touching Automations.

### Step A — Put source in Console

1. Open **Console**.
2. Paste a short brief, transcript, or note (plain text is fine).
3. Click **Save Source**.
4. Click **Generate Frame** (primary action for Console).

**Done when:** you have a structured frame / saved source, not just a blank textarea.

### Step B — Run agents

1. Open **Agents**.
2. Click **Run Tier Zero Agents**.
3. Wait for the six stages: Archivist → Strategist → Scriptwriter → Creative Director → Engineer → QA / export path.

**Done when:** you see a production packet with evidence, scripts, and QA — not a spinner that never finishes.

### Step C — Read the packet in Cluster

1. Open **Cluster**.
2. Click **Build Cluster** if the cluster is empty.
3. Skim pillars, lanes, hooks, captions. Copy what you will actually post.

**Done when:** you can point at the text you will paste into a platform.

### Step D — Export (local files)

1. From Console or Cluster, use **Export** / export actions so Markdown + JSON land on disk.
2. Open **Library** → exports / history if you need the path again.

**Done when:** you can open the `.md` or `.json` in Explorer.

### Step E — Publish yourself

WAKE **does not** post to TikTok, YouTube, X, or LinkedIn.

1. Open **Automations** → **Manual Publish Stage**.
2. Stage the packet if you want a staging list.
3. Copy the final copy/media and post on the platform yourself.

**Done when:** the post exists on the platform because *you* published it.

---

## 3. Tab map (what each screen is for)

| Tab | Job | Primary button | Next |
|---|---|---|---|
| **Console** | Save messy input → structured frame | Generate Frame | Agents or Cluster |
| **Agents** | Run Tier Zero pipeline on current source | Run Tier Zero Agents | Cluster / Export |
| **Cluster** | Campaign packet: pillars, lanes, hooks | Build Cluster | Export / Library |
| **Vault** | Pull local folders / SEED review into the vault | Run Intake | Console |
| **Library** | Find saved sources, outputs, exports, history | Open Exports | Console or Audit |
| **Instructions** | Ask “how do I …?” for *live* capabilities only | Get Instructions | The tab it names |
| **Automations** | Cron on a folder; review queue; manual publish stage | New Automation | Review Queue |
| **Monitor** | Runtime health / task truth | Refresh / inspect | Fix whatever is red |
| **Audit** | Snapshots and durability receipts | Capture / inspect | Library if recovering |

In-app help: **Instructions** tab → type your goal → **Get Instructions**. Prefer that over guessing from old docs.

---

## 4. Automations (scheduled folder work)

1. Open **Automations**.
2. **New Automation**.
3. Set:
   - Source folder (files: `.txt`, `.md`, `.json` only for scheduler)
   - Cron + timezone
   - Operator instruction (what you want from each run)
   - Approval mode: **Review Required** (inspect in Review Queue) or Auto Export when QA passes
   - Export directory
4. Save / enable.
5. Wait for the minute tick, or force a run from the UI if available.
6. Open **Review Queue** → **Inspect** the packet (inspection only — approve/reject is not persisted yet).

**Does not:** post to social networks, parse PDF/image/audio/video in the scheduler, or run Ollama inside the scheduler.

---

## 5. Media tools (voice + reel)

### Voiceover

1. Have a script / packet ready.
2. Use Local Voiceover (`/api/voice/synthesize` or the UI control that triggers it).
3. Expect a **real audio file** from Windows SAPI (or a configured remote TTS endpoint).

If synthesis fails, WAKE should **not** pretend success with a fake URL.

### Vertical reel (MP4)

1. Install **FFmpeg** and put it on PATH.
2. Provide **real audio** (from voiceover above).
3. Render via Vertical Reel Renderer (`/api/video/render-reel`).

No FFmpeg or no audio → no real MP4. WAKE must not hand you JSON renamed to `.mp4`.

---

## 6. Truth boundaries (so you stop fighting the product)

| Claim you might hear | Reality |
|---|---|
| “It auto-posts to social” | **False.** Manual Publish Stage only. |
| “Six independent AI agents in the cloud” | **False.** Deterministic local orchestration (+ optional Ollama). |
| “Viral score / live retention” | **False.** Heuristic creative tools only. |
| “Review = approve and ship” | **Partial.** Queue is **inspection-only** today. |
| “Drop any PDF/video into Automations” | **False.** Scheduler: `.txt` / `.md` / `.json`. |
| “Voice works with no Windows speech” | Needs SAPI (or configured remote TTS). |
| “MP4 always works” | Needs FFmpeg + real audio. |

When docs disagree, trust this order:

1. This Instruction Manual  
2. `KNOWN_LIMITATIONS.md`  
3. Live **Monitor** / API health  
4. Anything promotional in older manuals  

---

## 7. If something feels broken

1. **Monitor** — is the engine up? Any failed tasks?
2. **Audit** — recent snapshot / WAL health.
3. **Instructions** — ask the exact goal; use only the steps it returns.
4. From the repo: `npm run smoke` (dev machine).
5. Reinstall desktop build only if the shortcut points at a stale EXE: `npm run install:local`.

---

## 8. One-screen cheat sheet

```text
OPEN → Console: paste → Save Source → Generate Frame
     → Agents: Run Tier Zero Agents
     → Cluster: Build Cluster → copy what you will post
     → Export files locally
     → Automations → Manual Publish Stage → YOU post on the platform

SCHEDULE (optional): Automations → New Automation → Review Queue → Inspect
VOICE/REEL (optional): real SAPI audio → FFmpeg MP4 → still YOU post
```

That’s the whole product loop. Everything else is recovery, evidence, or scheduling around that loop.
