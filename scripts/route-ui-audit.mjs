#!/usr/bin/env node
import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, ".route-ui-audit-run");
const PROFILE_DIR = path.join(ROOT, ".route-ui-audit-profile");
const AUTOMATION_SOURCE_DIR = path.join(DATA_DIR, "automation-source");
const AUTOMATION_EXPORT_DIR = path.join(DATA_DIR, "automation-exports");
const MISSING_SOURCE_DIR = path.join(DATA_DIR, "missing-source");
const PORT = String(9110 + Math.floor(Math.random() * 200));

const config = fs.readFileSync(path.join(ROOT, "src", "app-config.jsx"), "utf8");
const routeMatches = [...config.matchAll(/id:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"/g)];
const routes = routeMatches.map((match) => ({ id: match[1], label: match[2] }));

if (!routes.length) throw new Error("No routes found in src/app-config.jsx.");
if (new Set(routes.map((route) => route.id)).size !== routes.length) throw new Error("Duplicate route IDs found in tabs.");

const expectedSurface = {
  console: ".campaign-autopilot",
  agent: ".agent-source-panel",
  cluster: ".cluster-panel",
  vault: ".intake-panel",
  library: ".library-grid",
  instructions: ".instructions-container",
  automations: ".automations-panel",
  tasks: ".monitor-panel",
  snapshot: ".snapshot-box"
};

for (const route of routes) {
  if (!expectedSurface[route.id]) throw new Error(`Route UI audit has no expected surface for ${route.id}.`);
}

const standaloneRouteIds = new Set(["instructions", "automations"]);
const forbiddenStandaloneText = [
  "Source Command Console",
  "Generate Frame",
  "Save Source",
  "Build Cluster",
  "Start with source"
];

async function assertStandaloneIsolation(page, routeId) {
  for (const selector of [
    ".active-task-spine",
    ".next-step-panel",
    ".ability-command",
    ".ability-action-rail",
    ".agent-chat-panel"
  ]) {
    const count = await page.locator(selector).count();
    if (count !== 0) throw new Error(`${routeId} leaked shared scaffold ${selector}; count=${count}.`);
  }

  const contentText = await page.locator(".content-flow").innerText();
  for (const forbidden of forbiddenStandaloneText) {
    if (contentText.includes(forbidden)) {
      throw new Error(`${routeId} leaked Console UX text: ${forbidden}`);
    }
  }
}

async function enterApplication(page) {
  const appShell = page.locator(".app-shell");
  if (await appShell.isVisible({ timeout: 3000 }).catch(() => false)) return;

  const gate = page.locator(".operator-gate");
  if (await gate.isVisible({ timeout: 3000 }).catch(() => false)) {
    const operatorInputs = page.locator(".operator-field input");
    try {
      await operatorInputs.nth(0).fill("JUSTIN", { timeout: 2000 });
      await operatorInputs.nth(1).fill("WAKE", { timeout: 2000 });
      await page.getByRole("button", { name: /Enter Wake Engine/i }).click({ timeout: 2000 });
    } catch (error) {
      if (!(await appShell.isVisible({ timeout: 2000 }).catch(() => false))) throw error;
    }
  }

  const boot = page.locator(".boot");
  if (await boot.isVisible({ timeout: 3000 }).catch(() => false)) {
    try {
      await page.getByRole("button", { name: /Skip Boot/i }).click({ timeout: 3000 });
    } catch (error) {
      const bootStillVisible = await boot.isVisible({ timeout: 500 }).catch(() => false);
      if (bootStillVisible) throw error;
    }
  }
  await appShell.waitFor({ state: "visible", timeout: 20000 });
}

async function getState(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/state", { credentials: "same-origin" });
    if (!response.ok) throw new Error(`GET /api/state failed with ${response.status}`);
    return response.json();
  });
}

function automationRow(page, name) {
  return page.locator(".automations-panel .library-list > div").filter({ hasText: name }).first();
}

async function openAutomations(page) {
  await page.getByRole("button", { name: "Automations", exact: true }).click();
  await page.locator(".automations-panel").waitFor({ state: "visible", timeout: 10000 });
  await assertStandaloneIsolation(page, "automations");
}

async function createAutomation(page, details) {
  await page.getByRole("button", { name: /New Automation/i }).click();
  await page.locator(".automation-form").waitFor({ state: "visible", timeout: 10000 });
  await assertStandaloneIsolation(page, "automations-edit");

  await page.getByLabel("Name", { exact: true }).fill(details.name);
  await page.getByLabel("Project ID", { exact: true }).fill("wake-v6-main");
  await page.getByLabel("Source Directory", { exact: true }).fill(details.sourceDir);
  await page.getByLabel("Campaign Type", { exact: true }).fill("Custom Prompt");
  await page.getByLabel("Operator Ask (Strategist context)", { exact: true }).fill(details.operatorAsk);
  await page.getByLabel("Schedule Cron", { exact: true }).fill("0 0 1 1 *");
  await page.getByLabel("Time Zone", { exact: true }).fill("UTC");
  await page.getByLabel("Approval Mode", { exact: true }).selectOption({ label: details.approvalMode });
  await page.getByLabel("Export Directory", { exact: true }).fill(details.exportDir);
  await page.getByRole("button", { name: "Save Automation", exact: true }).click();
  await page.locator(".automations-panel").waitFor({ state: "visible", timeout: 10000 });
  const stateAfterSave = await getState(page);
  const persistedRecord = (stateAfterSave.automations || []).find((item) => item.name === details.name);
  if (!persistedRecord) {
    const visibleState = await page.locator(".content-flow").innerText();
    throw new Error(`Automation save returned to the list but did not persist "${details.name}". Persisted names: ${(stateAfterSave.automations || []).map((item) => item.name).join(" | ")}. Visible state: ${visibleState}`);
  }
  const savedRow = automationRow(page, details.name);
  if (!(await savedRow.isVisible({ timeout: 5000 }).catch(() => false))) {
    const panelText = await page.locator(".automations-panel").innerText();
    throw new Error(`Automation "${details.name}" persisted as ${persistedRecord.id} but the refreshed Automation list did not render it. Panel: ${panelText}`);
  }
}

async function waitForAutomationOutcomes(page, ids, timeoutMs = 85000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await getState(page);
    const byAutomation = new Map((state.automationRuns || []).map((run) => [run.automationId, run]));
    const reviewRun = byAutomation.get(ids.review);
    const exportRun = byAutomation.get(ids.export);
    const failureRun = byAutomation.get(ids.failure);
    if (reviewRun?.status === "awaiting-review" && exportRun?.status === "completed" && failureRun?.status === "failed") {
      return { state, reviewRun, exportRun, failureRun };
    }
    await page.waitForTimeout(1500);
  }
  const state = await getState(page);
  throw new Error(`Automation outcomes did not settle in ${timeoutMs}ms. Runs: ${JSON.stringify(state.automationRuns || [])}`);
}

async function main() {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(AUTOMATION_SOURCE_DIR, { recursive: true });
  fs.mkdirSync(AUTOMATION_EXPORT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(AUTOMATION_SOURCE_DIR, "brief.txt"),
    "ForgeFront Systems is testing WAKE V6 automation. The source-backed output must mention only this local test and must remain reviewable.",
    "utf8"
  );

  let electronPath;
  try {
    electronPath = require("electron");
  } catch (error) {
    throw new Error(`Electron executable could not be resolved. Run npm install and retry. ${error.message}`);
  }
  if (!fs.existsSync(electronPath)) {
    throw new Error(`Electron executable is missing at ${electronPath}. Run node node_modules/electron/install.js and retry.`);
  }

  const app = await electron.launch({
    executablePath: electronPath,
    args: [ROOT],
    cwd: ROOT,
    env: {
      ...process.env,
      PORT,
      WAKE_DATA_DIR: DATA_DIR,
      WAKE_V6_ROOT: ROOT,
      WAKE_AUDIT_USER_DATA: PROFILE_DIR,
      WAKE_AUDIT_NO_OPEN: "1",
      WAKE_TEST_DETERMINISTIC_AUTOPILOT: "1",
      WAKE_TEST_AUTH_BYPASS: "1"
    }
  });

  const errors = [];
  try {
    const page = await app.firstWindow();
    page.on("dialog", (dialog) => dialog.accept());
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("400 (Bad Request)")) {
        errors.push(`console: ${message.text()}`);
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${response.url()}`);
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForLoadState("domcontentloaded");
    await enterApplication(page);

    const navButtons = page.locator('nav[aria-label="WAKE V6 sections"] > button');
    const navCount = await navButtons.count();
    if (navCount !== routes.length) {
      throw new Error(`Rendered nav count ${navCount} does not match configured route count ${routes.length}.`);
    }

    for (const route of routes) {
      const errorCountBefore = errors.length;
      await page.getByRole("button", { name: route.label, exact: true }).click();
      await page.locator(expectedSurface[route.id]).waitFor({ state: "visible", timeout: 10000 }).catch((error) => {
        const newErrors = errors.slice(errorCountBefore);
        throw new Error(`Route ${route.id} did not render ${expectedSurface[route.id]}. Runtime errors: ${newErrors.join(" | ") || "none captured"}. ${error.message}`);
      });

      const selected = page.locator('nav[aria-label="WAKE V6 sections"] > button.selected');
      if (await selected.count() !== 1) throw new Error(`Route ${route.id} does not have exactly one selected navigation button.`);
      const selectedText = (await selected.innerText()).trim();
      if (selectedText.toLowerCase() !== route.label.toLowerCase()) throw new Error(`Route ${route.id} rendered but navigation selected ${selectedText} instead of ${route.label}.`);

      if (errors.length > errorCountBefore) {
        throw new Error(`Route ${route.id} emitted runtime errors:\n- ${errors.slice(errorCountBefore).join("\n- ")}`);
      }
      if (standaloneRouteIds.has(route.id)) {
        await assertStandaloneIsolation(page, route.id);
      }

      console.log(`  OK route ${route.id} -> ${route.label}`);
    }

    // Instructions must execute, return implemented-surface guidance, reject unsupported claims, and remain isolated.
    await page.getByRole("button", { name: "Instructions", exact: true }).click();
    await page.locator(".instructions-container").waitFor({ state: "visible" });
    const instructionInput = page.getByPlaceholder("What do you want to do simply?");
    await instructionInput.fill("Show me how to inspect the local runtime.");
    await page.getByRole("button", { name: "Get Instructions", exact: true }).click();
    await page.locator(".instructions-result").waitFor({ state: "visible", timeout: 35000 });
    const runtimeInstructions = await page.locator(".instructions-result").innerText();
    if (!runtimeInstructions.includes("Monitor")) throw new Error(`Runtime instructions did not route to Monitor: ${runtimeInstructions}`);
    if (!runtimeInstructions.includes("Audit")) throw new Error(`Runtime instructions did not mention Audit evidence: ${runtimeInstructions}`);
    if (/\bInbox\b/.test(runtimeInstructions)) throw new Error(`Instructions invented obsolete Inbox surface: ${runtimeInstructions}`);
    await assertStandaloneIsolation(page, "instructions");

    await instructionInput.fill("Publish directly to Instagram for me.");
    await page.getByRole("button", { name: "Get Instructions", exact: true }).click();
    const unsupportedStarted = Date.now();
    let unsupportedInstructions = "";
    while (Date.now() - unsupportedStarted < 35000) {
      if (await page.locator(".instructions-result").count()) {
        unsupportedInstructions = await page.locator(".instructions-result").innerText();
        if (unsupportedInstructions && unsupportedInstructions !== runtimeInstructions) break;
      }
      await page.waitForTimeout(250);
    }
    if (!unsupportedInstructions || unsupportedInstructions === runtimeInstructions) {
      const visibleState = await page.locator(".content-flow").innerText();
      throw new Error(`Instructions second request did not produce a new result. Visible state: ${visibleState}`);
    }
    const normalizedUnsupportedInstructions = unsupportedInstructions.replace(/\*\*/g, "").toLowerCase();
    if (!normalizedUnsupportedInstructions.includes("does not currently publish directly")) {
      throw new Error(`Instructions failed to refuse unsupported direct publishing: ${unsupportedInstructions}`);
    }
    await assertStandaloneIsolation(page, "instructions");
    console.log("  OK Instructions end-to-end implemented-capability and unsupported-capability contracts");

    // Automations must prove browser validation, create, persistence, edit, pause/resume, run-now,
    // review, auto-export, failure recording, history, delete, and persistence after reload.
    await openAutomations(page);
    const stateBefore = await getState(page);
    const baselineCount = stateBefore.automations?.length || 0;

    await page.getByRole("button", { name: /New Automation/i }).click();
    await page.locator(".automation-form").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Save Automation", exact: true }).click();
    if (await page.locator(".automation-form input:invalid, .automation-form textarea:invalid").count() === 0) {
      throw new Error("Automation form accepted an empty required-field submission instead of browser-validating it.");
    }
    const invalidSubmitState = await getState(page);
    if ((invalidSubmitState.automations?.length || 0) !== baselineCount) throw new Error("Invalid automation submission mutated persisted state.");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    const reviewName = "WAK7 Hostile Review Proof";
    const exportName = "WAK7 Hostile Export Proof";
    const failureName = "WAK7 Hostile Failure Proof";

    await createAutomation(page, {
      name: reviewName,
      sourceDir: AUTOMATION_SOURCE_DIR,
      operatorAsk: "Build a source-backed review packet from this local proof source.",
      approvalMode: "Review Required",
      exportDir: AUTOMATION_EXPORT_DIR
    });
    await createAutomation(page, {
      name: exportName,
      sourceDir: AUTOMATION_SOURCE_DIR,
      operatorAsk: "Build and automatically export a QA-passing local proof packet.",
      approvalMode: "Auto Export",
      exportDir: AUTOMATION_EXPORT_DIR
    });
    await createAutomation(page, {
      name: failureName,
      sourceDir: MISSING_SOURCE_DIR,
      operatorAsk: "This run must fail because the source directory does not exist.",
      approvalMode: "Review Required",
      exportDir: AUTOMATION_EXPORT_DIR
    });

    let persisted = await getState(page);
    const reviewAutomation = persisted.automations.find((item) => item.name === reviewName);
    const exportAutomation = persisted.automations.find((item) => item.name === exportName);
    const failureAutomation = persisted.automations.find((item) => item.name === failureName);
    if (!reviewAutomation || !exportAutomation || !failureAutomation) throw new Error("Automation create actions did not persist all three hostile proof records.");

    await page.reload({ waitUntil: "domcontentloaded" });
    await enterApplication(page);
    await openAutomations(page);
    await automationRow(page, reviewName).waitFor({ state: "visible" });
    await automationRow(page, exportName).waitFor({ state: "visible" });
    await automationRow(page, failureName).waitFor({ state: "visible" });

    let row = automationRow(page, reviewName);
    await row.getByRole("button", { name: /Resume/i }).click();
    await row.getByText("Active", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
    persisted = await getState(page);
    if (persisted.automations.find((item) => item.id === reviewAutomation.id)?.enabled !== true) throw new Error("Resume did not persist enabled=true.");

    row = automationRow(page, reviewName);
    await row.getByRole("button", { name: /Pause/i }).click();
    await row.getByText("Paused", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
    persisted = await getState(page);
    if (persisted.automations.find((item) => item.id === reviewAutomation.id)?.enabled !== false) throw new Error("Pause did not persist enabled=false.");

    row = automationRow(page, reviewName);
    await row.getByRole("button", { name: /Edit/i }).click();
    await page.locator(".automation-form").waitFor({ state: "visible" });
    const editedName = "WAK7 Hostile Review Proof Edited";
    await page.getByLabel("Name", { exact: true }).fill(editedName);
    await page.getByRole("button", { name: "Save Automation", exact: true }).click();
    await automationRow(page, editedName).waitFor({ state: "visible", timeout: 10000 });
    persisted = await getState(page);
    if (persisted.automations.find((item) => item.id === reviewAutomation.id)?.name !== editedName) throw new Error("Edit did not persist the new automation name.");

    await automationRow(page, editedName).getByRole("button", { name: /Run Now/i }).click();
    await automationRow(page, exportName).getByRole("button", { name: /Run Now/i }).click();
    await automationRow(page, failureName).getByRole("button", { name: /Run Now/i }).click();

    persisted = await getState(page);
    for (const automationId of [reviewAutomation.id, exportAutomation.id, failureAutomation.id]) {
      const queued = persisted.automationRuns.find((run) => run.automationId === automationId && run.status === "queued");
      if (!queued) throw new Error(`Run Now did not persist a queued run for ${automationId}.`);
    }

    const outcomes = await waitForAutomationOutcomes(page, {
      review: reviewAutomation.id,
      export: exportAutomation.id,
      failure: failureAutomation.id
    });
    if (!outcomes.state.reviewQueue.some((item) => item.automationId === reviewAutomation.id && item.status === "pending")) {
      throw new Error("Review Required automation did not produce a pending review item.");
    }
    if (!Array.isArray(outcomes.exportRun.exportFiles) || outcomes.exportRun.exportFiles.length !== 2) {
      throw new Error(`Auto Export did not produce exactly two artifacts: ${JSON.stringify(outcomes.exportRun)}`);
    }
    for (const artifact of outcomes.exportRun.exportFiles) {
      if (!fs.existsSync(artifact.path)) throw new Error(`Auto Export artifact is missing on disk: ${artifact.path}`);
    }
    if (!/Source folder is empty, missing, or unsupported/.test(outcomes.failureRun.error || "")) {
      throw new Error(`Missing-source failure was not recorded clearly: ${JSON.stringify(outcomes.failureRun)}`);
    }

    await page.getByRole("button", { name: /Review Queue \(/i }).click();
    await page.getByRole("button", { name: "View Generated Packet", exact: true }).waitFor({ state: "visible", timeout: 10000 });
    await assertStandaloneIsolation(page, "automations-review");
    await page.getByRole("button", { name: "Run History", exact: true }).click();
    const historyText = await page.locator(".automations-panel").innerText();
    if (!historyText.includes("Status: awaiting-review")) throw new Error(`Run History omitted awaiting-review status: ${historyText}`);
    if (!historyText.includes("Status: completed")) throw new Error(`Run History omitted completed status: ${historyText}`);
    if (!historyText.includes("Status: failed")) throw new Error(`Run History omitted failed status: ${historyText}`);

    await page.getByRole("button", { name: "Active Automations", exact: true }).click();
    for (const name of [editedName, exportName, failureName]) {
      const deleteRow = automationRow(page, name);
      await deleteRow.getByRole("button", { name: /Delete/i }).click();
      await deleteRow.waitFor({ state: "detached", timeout: 10000 });
    }

    persisted = await getState(page);
    for (const automationId of [reviewAutomation.id, exportAutomation.id, failureAutomation.id]) {
      if (persisted.automations.some((item) => item.id === automationId)) throw new Error(`Delete did not remove persisted automation ${automationId}.`);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await enterApplication(page);
    await openAutomations(page);
    for (const name of [editedName, exportName, failureName]) {
      if (await page.getByText(name, { exact: true }).count()) throw new Error(`Deleted automation reappeared after reload: ${name}`);
    }
    console.log("  OK Automations end-to-end CRUD, persistence, scheduler, review, export, failure, history, and delete contracts");

    if (errors.length) {
      throw new Error(`Route UI audit captured runtime errors:\n- ${errors.join("\n- ")}`);
    }

    console.log(`Route UI audit passed for all ${routes.length} configured routes with hostile Instructions/Automations behavior coverage.`);
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
