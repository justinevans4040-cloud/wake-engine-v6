#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "wake-automation-api-audit-"));
const SOURCE_DIR = path.join(DATA_DIR, "source");
const EXPORT_DIR = path.join(DATA_DIR, "exports");
const PORT = 9520 + Math.floor(Math.random() * 200);
const BASE = `http://127.0.0.1:${PORT}`;

fs.mkdirSync(SOURCE_DIR, { recursive: true });
fs.mkdirSync(EXPORT_DIR, { recursive: true });
fs.writeFileSync(path.join(SOURCE_DIR, "brief.txt"), "WAKE automation API hostile audit source.", "utf8");

process.env.WAKE_DATA_DIR = DATA_DIR;
process.env.WAKE_TEST_AUTH_BYPASS = "1";
process.env.WAKE_REQUIRE_LOGIN = "0";
process.env.WAKE_AUDIT_NO_OPEN = "1";

const { startWakeServer } = await import(`../server/index.js?automation-api-audit=${Date.now()}`);
let server;

async function request(method, route, body) {
  const response = await fetch(`${BASE}${route}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function normalizeMarkdown(value) {
  return String(value || "").replace(/\*\*/g, "").toLowerCase();
}

const valid = {
  name: "API Hostile Proof",
  projectId: "wake-v6-main",
  sourceDir: SOURCE_DIR,
  campaignType: "Custom Prompt",
  operatorAsk: "Build a source-backed local proof packet.",
  scheduleCron: "*/15 8-18 * * 1-5",
  timeZone: "America/Los_Angeles",
  approvalMode: "Review Required",
  exportDir: EXPORT_DIR
};

try {
  server = await startWakeServer({ port: PORT });

  let result = await request("POST", "/api/instructions/generate", { message: "Show me how to inspect the local runtime." });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.ok, true);
  assert.match(result.data.instructions, /Monitor/);
  assert.match(result.data.instructions, /Audit/);
  assert.doesNotMatch(result.data.instructions, /\bInbox\b/);

  result = await request("POST", "/api/instructions/generate", { message: "Publish directly to Instagram for me." });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.ok, true);
  assert.equal(normalizeMarkdown(result.data.instructions).includes("does not currently publish directly"), true);

  result = await request("POST", "/api/automations", {});
  assert.equal(result.response.status, 400);
  assert.equal(result.data.code, "WAKE_AUTOMATION_INVALID");

  result = await request("POST", "/api/automations", { ...valid, scheduleCron: "61 * * * *" });
  assert.equal(result.response.status, 400);
  assert.match(result.data.error, /valid five-field cron/i);

  result = await request("POST", "/api/automations", { ...valid, timeZone: "Mars/Olympus" });
  assert.equal(result.response.status, 400);
  assert.match(result.data.error, /valid IANA timezone/i);

  result = await request("POST", "/api/automations", { ...valid, projectId: "missing-project" });
  assert.equal(result.response.status, 400);
  assert.match(result.data.error, /existing WAKE project/i);

  result = await request("POST", "/api/automations", { ...valid, sourceDir: "C:\\Users\\Operator\\OneDrive\\source" });
  assert.equal(result.response.status, 400);
  assert.match(result.data.error, /local and non-cloud-synchronized/i);

  result = await request("POST", "/api/automations", valid);
  assert.equal(result.response.status, 200);
  assert.equal(result.data.ok, true);
  const automationId = result.data.automation.id;
  assert.ok(automationId);

  let state = (await request("GET", "/api/state")).data;
  assert.equal(state.automations.some((item) => item.id === automationId && item.name === valid.name), true);

  result = await request("PUT", `/api/automations/${automationId}`, { ...valid, name: "API Hostile Proof Edited" });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.automation.name, "API Hostile Proof Edited");

  result = await request("POST", `/api/automations/${automationId}/toggle`, { enabled: "true" });
  assert.equal(result.response.status, 400);
  assert.match(result.data.error, /boolean/i);

  result = await request("POST", `/api/automations/${automationId}/toggle`, { enabled: true });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.enabled, true);

  state = (await request("GET", "/api/state")).data;
  assert.equal(state.automations.find((item) => item.id === automationId)?.enabled, true);

  result = await request("POST", `/api/automations/${automationId}/run`);
  assert.equal(result.response.status, 200);
  assert.equal(result.data.run.status, "queued");

  result = await request("POST", `/api/automations/${automationId}/run`);
  assert.equal(result.response.status, 409);
  assert.match(result.data.error, /already queued/i);

  result = await request("DELETE", "/api/automations/does-not-exist");
  assert.equal(result.response.status, 404);

  result = await request("DELETE", `/api/automations/${automationId}`);
  assert.equal(result.response.status, 200);
  assert.equal(result.data.ok, true);

  state = (await request("GET", "/api/state")).data;
  assert.equal(state.automations.some((item) => item.id === automationId), false);

  console.log(JSON.stringify({
    status: "pass",
    checks: [
      "instructions-runtime-guidance",
      "instructions-unsupported-capability-refusal",
      "required-fields",
      "cron-validation",
      "timezone-validation",
      "project-validation",
      "cloud-path-rejection",
      "create-persistence",
      "update-persistence",
      "typed-toggle-validation",
      "run-queue-deduplication",
      "not-found-delete",
      "delete-persistence"
    ]
  }, null, 2));
} finally {
  await new Promise((resolve) => server?.close?.(resolve) || resolve());
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
}
