#!/usr/bin/env node
import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ROOT = path.join(__dirname, "..");
const RUN_ID = `${process.pid}-${Date.now()}`;
const DATA_DIR = path.join(ROOT, `.ui-audit-run-${RUN_ID}`);
const PROFILE_DIR = path.join(ROOT, `.ui-audit-profile-${RUN_ID}`);
const AUDIT_DIR = path.join(ROOT, "audit", "ui-button-audit");
const PORT = String(8910 + Math.floor(Math.random() * 200));

const clicked = [];
const errors = [];
let lastAction = "startup";

function log(label) {
  lastAction = label;
  clicked.push(label);
  console.log(`  OK ${label}`);
}

async function click(locator, label, options = {}) {
  try {
    await locator.click({ timeout: 15000, ...options });
  } catch (error) {
    if (!/Timeout|intercept|stable|receives pointer/i.test(error.message || "")) throw error;
    await locator.evaluate((element) => element.click());
  }
  log(label);
}

async function closeModal(page) {
  const close = page.getByRole("button", { name: /^Close$/ });
  if (await close.isVisible({ timeout: 1000 }).catch(() => false)) {
    await click(close, "modal close");
  }
}

async function removeRunDir(dir) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 5 || !["EPERM", "EBUSY", "ENOTEMPTY"].includes(error.code)) {
        console.warn(`  WARN could not remove audit temp directory ${dir}: ${error.code || error.message}`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
}

async function enterApplication(page) {
  await page.waitForLoadState("domcontentloaded");
  const appShell = page.locator(".app-shell");
  if (await appShell.isVisible({ timeout: 3000 }).catch(() => false)) return;

  const operatorInputs = page.locator(".operator-field input");
  if (await operatorInputs.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await operatorInputs.nth(0).fill("JUSTIN");
    await operatorInputs.nth(1).fill("WAKE");
    await click(page.getByRole("button", { name: /Enter Wake Engine/i }), "operator login gate");
  } else {
    log("operator login gate bypassed");
  }

  if (await page.locator(".boot").isVisible({ timeout: 5000 }).catch(() => false)) {
    await click(page.getByRole("button", { name: /Skip Boot/i }), "skip non-blocking boot");
  } else {
    log("boot already complete");
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

async function assertNoTextOverflow(page) {
  const offenders = await page.evaluate(() => {
    const elements = [...document.querySelectorAll("button, .pill, .panel-title-main, .status-rail span, .tab-grid span, .secondary-nav span")];
    return elements
      .filter((element) => element.scrollWidth > element.clientWidth + 2)
      .map((element) => ({
        text: element.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
        className: element.className,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      }));
  });
  if (offenders.length) throw new Error(`Text overflow detected: ${JSON.stringify(offenders.slice(0, 5))}`);
}

async function main() {
  await removeRunDir(DATA_DIR);
  await removeRunDir(PROFILE_DIR);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(AUDIT_DIR, { recursive: true });

  const intakeSeed = path.join(DATA_DIR, "intake-seed");
  fs.mkdirSync(intakeSeed, { recursive: true });
  fs.writeFileSync(
    path.join(intakeSeed, "organizer-service-note.md"),
    "# Kitchen Reset Service\n\nA local home organizer offers labeled zones, donation pickup coordination, proof photos, and a simple maintenance plan. Create a source-backed campaign packet with citations, claims, hooks, captions, and export-ready handoff.",
    "utf8"
  );
  fs.writeFileSync(path.join(intakeSeed, "organizer-reference.png"), "fixture-image-metadata", "utf8");

  const electronPath = require("electron");
  if (!fs.existsSync(electronPath)) throw new Error(`Electron executable is missing at ${electronPath}. Run npm install and retry.`);

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

  try {
    const page = await app.firstWindow();
    page.on("dialog", (dialog) => dialog.accept());
    page.on("pageerror", (error) => errors.push(`pageerror after ${lastAction}: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("400 (Bad Request)")) {
        errors.push(`console after ${lastAction}: ${message.text()}`);
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${response.url()} after ${lastAction}`);
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await enterApplication(page);

    const primaryLabels = (await page.locator('nav[aria-label="WAKE V6 production workflow"] > button span').allInnerTexts()).map((label) => label.trim().toLowerCase());
    const secondaryLabels = (await page.locator('nav[aria-label="WAKE V6 secondary workspaces"] > button span').allInnerTexts()).map((label) => label.trim().toLowerCase());
    if (primaryLabels.join("|") !== "project|sources|create|review|export") throw new Error(`Unexpected primary nav: ${primaryLabels.join(" | ")}`);
    if (secondaryLabels.join("|") !== "library|system") throw new Error(`Unexpected secondary nav: ${secondaryLabels.join(" | ")}`);
    log("WAK-8 primary and secondary navigation");

    await click(page.locator('nav[aria-label="WAKE V6 production workflow"]').getByRole("button", { name: "Project", exact: true }), "project route");
    await page.locator(".project-workspace").waitFor({ state: "visible" });
    await page.getByLabel("Project name").fill("WAK8 UI Audit Project");
    await click(page.locator(".project-actions").getByRole("button", { name: /^Create$/ }), "project create");
    await page.getByLabel("Project name").fill("WAK8 UI Audit Project Renamed");
    await click(page.locator(".project-actions").getByRole("button", { name: /^Rename$/ }), "project rename");

    await click(page.locator('nav[aria-label="WAKE V6 production workflow"]').getByRole("button", { name: "Sources", exact: true }), "sources route");
    await page.locator(".intake-panel").waitFor({ state: "visible" });
    await page.locator(".seed-drop-zone").waitFor({ state: "visible" });
    await click(page.getByText("Drive / folder intake", { exact: true }), "open source intake settings");
    await page.getByLabel("Intake review mission").fill("Home organizer service notes, proof, source copy, platform assets, and campaign visuals. Random screenshots are not wanted.");
    await page.setInputFiles('input[aria-label="Choose SEED folder"]', intakeSeed);
    log("choose SEED folder upload review");
    await page.locator(".intake-review-panel").waitFor({ state: "visible", timeout: 30000 });
    await click(page.getByRole("button", { name: /Select Recommended/i }), "select recommended source candidates");
    await click(page.getByRole("button", { name: /Import Selected/i }), "import reviewed source candidates");
    await page.locator(".source-vault-list button").first().waitFor({ state: "visible", timeout: 30000 });
    await click(page.locator(".source-vault-list button").first(), "open source document");
    await page.locator(".document-content").filter({ hasText: /Kitchen Reset Service|home organizer/i }).waitFor();
    await click(page.getByRole("button", { name: /Use In Create/i }), "load source into create");

    await page.locator(".campaign-autopilot").waitFor({ state: "visible" });
    await page.locator(".agent-source-panel").waitFor({ state: "visible" });
    await page.locator(".agent-source-current").filter({ hasText: /Kitchen Reset Service|organizer/i }).waitFor();
    log("create owns loaded source and contextual agents");
    await click(page.getByRole("button", { name: /Create Campaign/i }), "create campaign packet");
    await page.locator(".campaign-review").waitFor({ state: "visible", timeout: 30000 });
    for (const [platform, previewLabel] of [["TikTok", "TikTok campaign preview"], ["Instagram", "Instagram campaign preview"], ["X", "X campaign preview"], ["LinkedIn", "LinkedIn campaign preview"]]) {
      await click(page.getByRole("tab", { name: platform, exact: true }), `${platform} native preview`);
      await page.getByLabel(previewLabel).waitFor();
    }

    await click(page.locator('nav[aria-label="WAKE V6 production workflow"]').getByRole("button", { name: "Review", exact: true }), "review route");
    await page.locator(".review-workspace").waitFor({ state: "visible" });
    await page.locator(".review-inspection").waitFor({ state: "visible" });
    await page.getByText("Inspect Generated Packet", { exact: true }).waitFor();
    log("review shows generated packet inspection");

    await click(page.locator('nav[aria-label="WAKE V6 production workflow"]').getByRole("button", { name: "Export", exact: true }), "export route");
    await page.locator(".export-workspace").waitFor({ state: "visible" });
    await click(page.getByRole("button", { name: /Export Markdown \+ JSON/i }), "export markdown and json");
    await page.locator(".export-preview").filter({ hasText: /Markdown|JSON|Export/i }).first().waitFor({ state: "visible", timeout: 30000 });
    const stateAfterExport = await getState(page);
    if (!stateAfterExport.recentExports?.length) throw new Error("Export did not persist a saved export.");
    log("export persisted markdown and json");

    await click(page.locator('nav[aria-label="WAKE V6 secondary workspaces"]').getByRole("button", { name: "Library", exact: true }), "library route");
    await page.locator(".library-grid").waitFor({ state: "visible" });
    await page.locator(".library-grid .panel:nth-child(3) .library-list button").first().waitFor({ state: "visible", timeout: 10000 });
    log("library exposes saved export");

    await click(page.locator('nav[aria-label="WAKE V6 secondary workspaces"]').getByRole("button", { name: "System", exact: true }), "system route");
    await page.locator(".automations-panel").waitFor({ state: "visible" });
    await page.locator(".monitor-panel").waitFor({ state: "visible" });
    await page.locator(".snapshot-box").waitFor({ state: "visible" });
    await page.locator(".instructions-container").waitFor({ state: "visible" });
    log("system owns automations monitor audit instructions");

    await page.reload({ waitUntil: "domcontentloaded" });
    await enterApplication(page);
    const reloadedState = await getState(page);
    if (!reloadedState.recentSources?.length || !reloadedState.recentGenerations?.length || !reloadedState.recentExports?.length) {
      throw new Error("Reload did not preserve source, generated output, and export state.");
    }
    log("reload preserves operator flow artifacts");

    await assertNoTextOverflow(page);
    const shot = path.join(AUDIT_DIR, "wake-v6-wak8-operator-flow.png");
    await page.screenshot({ path: shot, fullPage: true });
    if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);
    console.log(`\n${clicked.length} WAK-8 controls/actions verified`);
    console.log(`Screenshot: ${shot}`);
  } finally {
    await app.close().catch(() => {});
    await removeRunDir(DATA_DIR);
    await removeRunDir(PROFILE_DIR);
  }
}

main().catch((error) => {
  console.error(`\nUI AUDIT FAILED: ${error.stack || error.message}`);
  process.exitCode = 1;
});
