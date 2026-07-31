#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { _electron as electron } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, ".benchmark-run");
const UI_DATA_DIR = path.join(DATA_DIR, "desktop");
const PORT = 9240 + Math.floor(Math.random() * 300);
const UI_PORT = PORT + 1;
const require = createRequire(import.meta.url);
const budgets = {
  serverBoot: 2500,
  desktopBoot: 6500,
  stateLoad: 900,
  saveSource: 900,
  frameGeneration: 1300,
  agentRun: 1800,
  clusterGeneration: 1600,
  autonomousCampaign: 2500,
  chatFirstVisibleResponse: 1600,
  modelWarmup: 90000,
  streamedFirstToken: 7000,
  export: 1300,
  coreUiInteraction: 750
};

function fail(message, result = {}) {
  console.error(`BENCHMARK FAILED: ${message}`);
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

async function timed(name, fn) {
  const started = performance.now();
  const value = await fn();
  const durationMs = Math.round(performance.now() - started);
  return { name, durationMs, budgetMs: budgets[name], passed: durationMs <= budgets[name], value };
}

async function fetchJson(pathname, init = {}) {
  const response = await fetch(`http://127.0.0.1:${PORT}${pathname}`, {
    ...init,
    signal: AbortSignal.timeout(init.timeoutMs || 10000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || response.statusText);
  return body;
}

async function measureStreamMilestones(body) {
  const started = performance.now();
  const response = await fetch(`http://127.0.0.1:${PORT}/api/agent-chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok || !response.body) throw new Error("chat stream did not open");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let firstVisibleMs = null;
  let firstTokenMs = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === "draft" && event.answer && firstVisibleMs === null) firstVisibleMs = Math.round(performance.now() - started);
      if (event.type === "token" && event.token && firstTokenMs === null) firstTokenMs = Math.round(performance.now() - started);
    }
  }
  return { firstVisibleMs, firstTokenMs };
}

async function warmLocalModel() {
  const status = await fetchJson("/api/agent-chat/status", { timeoutMs: 5000 });
  if (!status.live || !status.url || !status.model) throw new Error("local Ollama model is not available for streamed-token benchmarking");
  const response = await fetch(`${status.url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: status.model,
      prompt: "Reply with one word: ready",
      stream: false,
      keep_alive: "10m",
      options: { num_predict: 1, temperature: 0 }
    }),
    signal: AbortSignal.timeout(90000)
  });
  if (!response.ok) throw new Error(`local Ollama warmup failed with HTTP ${response.status}`);
  const payload = await response.json().catch(() => ({}));
  if (!String(payload.response || "").trim()) throw new Error("local Ollama warmup returned no model output");
}

fs.rmSync(DATA_DIR, { recursive: true, force: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
const previousDataDir = process.env.WAKE_DATA_DIR;
process.env.WAKE_DATA_DIR = DATA_DIR;
process.env.WAKE_TEST_DETERMINISTIC_AUTOPILOT = "1";
process.env.WAKE_TEST_AUTH_BYPASS = "1";
const { startWakeServer } = await import("../server/index.js");

const results = [];
let server;
let desktopApp;
try {
  results.push(await timed("serverBoot", async () => {
    server = await startWakeServer({ port: PORT, host: "127.0.0.1" });
    return true;
  }));
  const source = "A local home organizer offers a two-week kitchen reset with labeled zones, donation pickup coordination, and a simple maintenance plan for busy families.";
  results.push(await timed("stateLoad", () => fetchJson("/api/state")));
  const saved = await timed("saveSource", () => fetchJson("/api/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source })
  }));
  results.push(saved);
  results.push(await timed("frameGeneration", () => fetchJson("/api/frame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId: saved.value.source.id, source })
  })));
  const agent = await timed("agentRun", () => fetchJson("/api/run-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId: saved.value.source.id, source })
  }));
  results.push(agent);
  results.push(await timed("clusterGeneration", () => fetchJson("/api/content-cluster", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId: saved.value.source.id, source })
  })));
  results.push(await timed("autonomousCampaign", () => fetchJson("/api/autopilot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: saved.value.source.projectId }),
    timeoutMs: 15000
  })));
  const instantMilestones = await measureStreamMilestones({ agentId: "strategist", ability: "agent", mode: "instant", message: "Create the next source-backed action for the organization service." });
  results.push({ name: "chatFirstVisibleResponse", durationMs: instantMilestones.firstVisibleMs ?? Infinity, budgetMs: budgets.chatFirstVisibleResponse, passed: instantMilestones.firstVisibleMs !== null && instantMilestones.firstVisibleMs <= budgets.chatFirstVisibleResponse });
  results.push(await timed("modelWarmup", warmLocalModel));
  const modelMilestones = await measureStreamMilestones({ agentId: "scriptwriter", ability: "agent", mode: "auto", message: "Write one source-backed home organization hook." });
  results.push({ name: "streamedFirstToken", durationMs: modelMilestones.firstTokenMs ?? Infinity, budgetMs: budgets.streamedFirstToken, passed: modelMilestones.firstTokenMs !== null && modelMilestones.firstTokenMs <= budgets.streamedFirstToken });
  results.push(await timed("export", () => fetchJson("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: agent.value.frame.title, output: agent.value })
  })));

  const electronPath = require("electron");
  results.push(await timed("desktopBoot", async () => {
    desktopApp = await electron.launch({
      executablePath: electronPath,
      args: [ROOT],
      cwd: ROOT,
      env: { ...process.env, PORT: String(UI_PORT), WAKE_DATA_DIR: UI_DATA_DIR, WAKE_V6_ROOT: ROOT, WAKE_AUDIT_USER_DATA: path.join(UI_DATA_DIR, "profile"), WAKE_AUDIT_NO_OPEN: "1", WAKE_TEST_AUTH_BYPASS: "1" }
    });
    const page = await desktopApp.firstWindow();
    await page.waitForSelector(".operator-gate, .boot, .app-shell", { timeout: budgets.desktopBoot });
    const operatorGateVisible = await page.locator(".operator-gate").isVisible().catch(() => false);
    if (operatorGateVisible) {
      await page.getByLabel("Operator callsign").fill("BENCH");
      await page.getByLabel("Access phrase").fill("WAKE");
      await page.getByRole("button", { name: /Enter Wake Engine/i }).click();
    }
    const bootVisible = await page.locator(".boot").isVisible({ timeout: 2500 }).catch(() => false);
    if (bootVisible) {
      await page.getByRole("button", { name: /Skip Boot/i }).click();
    }
    await page.waitForSelector(".app-shell", { timeout: 2500 });
    return page;
  }));
  const page = results.find((item) => item.name === "desktopBoot")?.value;
  results.push(await timed("coreUiInteraction", async () => {
    await page.getByRole("button", { name: "Agents", exact: true }).click();
    await page.locator(".ability-command h2").filter({ hasText: "Agent Interface" }).waitFor();
    return true;
  }));

  const compact = results.map(({ name, durationMs, budgetMs, passed }) => ({ name, durationMs, budgetMs, passed }));
  if (compact.some((item) => !item.passed)) fail("one or more budgets missed", compact);
  console.log(JSON.stringify({ ok: true, results: compact }, null, 2));
} catch (error) {
  fail(error.message, results.map(({ name, durationMs, budgetMs, passed }) => ({ name, durationMs, budgetMs, passed })));
} finally {
  if (desktopApp) await desktopApp.close().catch(() => {});
  if (server) await new Promise((resolve) => server.close(resolve));
  if (previousDataDir === undefined) delete process.env.WAKE_DATA_DIR;
  else process.env.WAKE_DATA_DIR = previousDataDir;
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}
