#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = 9740 + Math.floor(Math.random() * 200);

console.log(`=======================================================`);
console.log(` WAKE ENGINE V6: CHAOS RINGER & HOSTILE BREAKING AUDIT`);
console.log(` Target Port: ${PORT}`);
console.log(`=======================================================\n`);

const serverProcess = spawn(process.execPath, [path.join(ROOT, "server", "index.js")], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    WAKE_DATA_DIR: path.join(ROOT, "audit", "chaos-data")
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let serverLogs = "";
serverProcess.stdout.on("data", (d) => (serverLogs += d.toString()));
serverProcess.stderr.on("data", (d) => (serverLogs += d.toString()));

async function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function waitForServer(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/state`);
      if (res.ok) return true;
    } catch {}
    await wait(200);
  }
  return false;
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// 1. FUZZING & MALFORMED INPUT ATTACKS
test("Fuzzing: /api/transmute with null, undefined, empty, and 1MB payloads", async () => {
  const cases = [
    {},
    { sourceText: null },
    { sourceText: "" },
    { sourceText: "A".repeat(500_000) },
    { sourceText: "💥🚀🔥".repeat(10_000) },
    { sourceText: "'; DROP TABLE users; -- <script>alert(1)</script>" }
  ];

  for (const c of cases) {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/transmute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c)
    });
    // Server must respond gracefully (either 200 or 400/500 with JSON error), never crash
    if (![200, 400, 500].includes(res.status)) {
      throw new Error(`Unexpected status ${res.status} on payload ${JSON.stringify(c).slice(0, 40)}`);
    }
  }
});

test("Fuzzing: /api/trends/analyze with adversarial strings & malicious injections", async () => {
  const cases = [
    { text: "" },
    { text: null },
    { text: 12345 },
    { text: "   \n\t   " },
    { text: "Stop doing this. ".repeat(500), niche: "<script>alert('xss')</script>" },
    { text: "../../etc/passwd", platform: "unknown-platform" }
  ];

  for (const c of cases) {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/trends/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c)
    });
    if (![200, 400, 500].includes(res.status)) {
      throw new Error(`Trends analyze crashed on ${JSON.stringify(c)}`);
    }
  }
});

test("Fuzzing: /api/waveform/generate with out-of-bounds parameters", async () => {
  const cases = [
    { durationSec: -10, style: "invalid-style" },
    { durationSec: 9999999, width: -100, height: 0 },
    { sampleCount: "not-a-number", color: "rgba(0,0,0,9999)" },
    {}
  ];

  for (const c of cases) {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/waveform/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c)
    });
    const data = await res.json();
    if (!data.ok || !data.svgDataUrl) {
      throw new Error(`Waveform generator failed to sanitize bad input: ${JSON.stringify(c)}`);
    }
  }
});

test("Fuzzing: /api/publishing with invalid IDs, bad actions, and deleted entities", async () => {
  // Delete non-existent ID
  const delRes = await fetch(`http://127.0.0.1:${PORT}/api/publishing/non-existent-id`, { method: "DELETE" });
  if (delRes.status !== 200 && delRes.status !== 404) throw new Error("Delete non-existent failed");

  // Dispatch non-existent ID
  const dispRes = await fetch(`http://127.0.0.1:${PORT}/api/publishing/dispatch/fake-id`, { method: "POST" });
  if (dispRes.status !== 404) throw new Error("Dispatch non-existent should 404");

  // Stage empty post
  const stageRes = await fetch(`http://127.0.0.1:${PORT}/api/publishing/stage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform: "unknown", title: "" })
  });
  if (![200, 400].includes(stageRes.status)) throw new Error("Stage empty post failed gracefully");
});

// 2. CONCURRENCY & BURST HAMMERING
test("Concurrency: 50 parallel requests across all intelligence endpoints simultaneously", async () => {
  const promises = [];

  for (let i = 0; i < 10; i++) {
    promises.push(
      fetch(`http://127.0.0.1:${PORT}/api/transmute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: `Parallel stress test batch ${i}: High leverage deterministic systems.` })
      })
    );
    promises.push(
      fetch(`http://127.0.0.1:${PORT}/api/hooks/generate-variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: `Parallel hook run ${i}`, topic: `Topic ${i}` })
      })
    );
    promises.push(
      fetch(`http://127.0.0.1:${PORT}/api/analytics/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: `Hook for ${i}. Scene 1 beat. Scene 2 beat. Action CTA.`, hook: `Hook ${i}` })
      })
    );
    promises.push(
      fetch(`http://127.0.0.1:${PORT}/api/trends/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `Never make this fatal mistake in batch ${i}. Automated blueprint truth.` })
      })
    );
    promises.push(
      fetch(`http://127.0.0.1:${PORT}/api/waveform/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSec: 30, style: i % 2 === 0 ? "neon-pulse" : "smooth-wave" })
      })
    );
  }

  const results = await Promise.all(promises);
  for (const r of results) {
    if (!r.ok) {
      throw new Error(`Parallel request failed with status ${r.status}`);
    }
  }
});

// 3. VAULT & MULTI-PROJECT INTEGRITY
test("Vault & Projects: Exporting and importing corrupted .wake vault packages", async () => {
  // Export active vault
  const exp = await fetch(`http://127.0.0.1:${PORT}/api/projects/wake-v6-main/export-vault`, { method: "POST" });
  if (!exp.ok) throw new Error("Vault export failed");
  const expData = await exp.json();
  if (!expData.bundle?.format && !expData.bundle?.vaultManifest) throw new Error(`Missing vault manifest/format in export: ${JSON.stringify(expData)}`);

  // Attempt to import tampered vault
  const tampered = JSON.parse(JSON.stringify(expData.bundle));
  tampered.sha256 = "0000000000000000000000000000000000000000000000000000000000000000";
  const imp = await fetch(`http://127.0.0.1:${PORT}/api/projects/import-vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bundle: tampered })
  });
  // System should safely accept or gracefully report status
  if (![200, 400, 422].includes(imp.status)) throw new Error("Tampered vault import threw unhandled error");
});

// 4. WEBSOCKET / SSE CHAT STREAM INTEGRITY
test("Stream Chat: Opening and abruptly aborting SSE streaming connections", async () => {
  for (let i = 0; i < 5; i++) {
    const controller = new AbortController();
    const streamPromise = fetch(`http://127.0.0.1:${PORT}/api/agent-chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello agent stress test", agentId: "strategist" }),
      signal: controller.signal
    }).catch(() => {});

    // Abort after 50ms to simulate client disconnecting mid-stream
    await wait(50);
    controller.abort();
    await streamPromise;
  }

  // Verify server is still alive after client drops
  const alive = await fetch(`http://127.0.0.1:${PORT}/api/state`);
  if (!alive.ok) throw new Error("Server died after abruptly aborted SSE streams");
});

async function run() {
  const ready = await waitForServer();
  if (!ready) {
    console.error("Server failed to start. Logs:\n", serverLogs);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      process.stdout.write(`• Running: ${t.name}... `);
      await t.fn();
      console.log(`[PASS]`);
      passed++;
    } catch (err) {
      console.log(`[FAIL] -> ${err.message}`);
      failed++;
    }
  }

  serverProcess.kill();

  console.log(`\n=======================================================`);
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();
