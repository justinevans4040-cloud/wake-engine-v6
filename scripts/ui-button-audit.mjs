#!/usr/bin/env node
import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, ".ui-audit-run");
const PROFILE_DIR = path.join(ROOT, ".ui-audit-profile");
const AUDIT_DIR = path.join(ROOT, "audit", "ui-button-audit");
const PORT = String(8910 + Math.floor(Math.random() * 200));

const clicked = [];
const errors = [];
let lastAction = "startup";

function logClick(label) {
  lastAction = label;
  clicked.push(label);
  console.log(`  OK ${label}`);
}

async function click(locator, label, options = {}) {
  await locator.click({ timeout: 10000, ...options });
  logClick(label);
}

async function closeModal(page) {
  const close = page.getByRole("button", { name: /^Close$/i }).first();
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    logClick("modal close");
  } else if (await page.locator(".modal-backdrop").isVisible().catch(() => false)) {
    await page.evaluate(() => {
      const backdrop = document.querySelector(".modal-backdrop");
      if (backdrop) backdrop.click();
    });
    logClick("modal close");
  }
  await page.locator(".modal-backdrop").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
}

async function assertNoTextOverflow(page) {
  const offenders = await page.evaluate(() => {
    const elements = [...document.querySelectorAll("button, .pill, .panel-title-main, .status-rail span, .tab-grid span")];
    return elements
      .filter((element) => element.scrollWidth > element.clientWidth + 2)
      .map((element) => ({
        text: element.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
        className: element.className,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      }));
  });
  if (offenders.length) {
    throw new Error(`Text overflow detected: ${JSON.stringify(offenders.slice(0, 5))}`);
  }
}

async function main() {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  const intakeSeed = path.join(DATA_DIR, "intake-seed");
  fs.mkdirSync(intakeSeed, { recursive: true });
  fs.writeFileSync(path.join(intakeSeed, "organizer-service-note.md"), "# Kitchen Reset Service\n\nA local home organizer offers labeled zones, donation pickup coordination, and a simple maintenance plan.", "utf8");
  fs.writeFileSync(path.join(intakeSeed, "organizer-reference.png"), "fixture-image-metadata", "utf8");

  let electronPath;
  try {
    electronPath = require("electron");
  } catch (error) {
    throw new Error(`Electron executable could not be resolved. Run npm install and retry. ${error.message}`);
  }
  if (!fs.existsSync(electronPath)) {
    throw new Error(`Electron executable is missing at ${electronPath}. Run node node_modules/electron/install.js and retry.`);
  }
  const auditUserData = PROFILE_DIR;
  const app = await electron.launch({
    executablePath: electronPath,
    args: [ROOT],
    cwd: ROOT,
    env: { ...process.env, PORT, WAKE_DATA_DIR: DATA_DIR, WAKE_V6_ROOT: ROOT, WAKE_AUDIT_USER_DATA: auditUserData, WAKE_AUDIT_NO_OPEN: "1", WAKE_TEST_DETERMINISTIC_AUTOPILOT: "1", WAKE_TEST_AUTH_BYPASS: "1" }
  });

  try {
    const page = await app.firstWindow();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400 && response.status() !== 400) {
        response.text().catch(() => "").then((body) => errors.push(`HTTP ${response.status()} ${response.url()} after ${lastAction}: ${body.slice(0, 500)}`));
      }
    });
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("400 (Bad Request)")) {
        errors.push(message.text());
      }
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForLoadState("domcontentloaded");
    const operatorInputs = page.locator(".operator-field input");
    const operatorGateVisible = await operatorInputs.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (operatorGateVisible) {
      await page.locator(".operator-field input").nth(0).fill("JUSTIN");
      await page.locator(".operator-field input").nth(1).fill("WAKE");
      await click(page.getByRole("button", { name: /Enter Wake Engine/i }), "operator login gate");
    } else {
      logClick("operator login gate bypassed");
    }
    if (await page.locator(".boot").isVisible({ timeout: 5000 }).catch(() => false)) {
      await click(page.getByRole("button", { name: /Skip Boot/i }), "skip non-blocking boot");
    } else {
      logClick("boot already complete");
    }
    await page.waitForSelector(".app-shell", { timeout: 20000 });

    const emblemLoaded = await page.locator(".emblem-stage img").evaluate((img) => img.complete && img.naturalWidth > 0);
    if (!emblemLoaded) throw new Error("Wake Engine emblem did not load.");
    logClick("emblem loaded");

    await click(page.getByRole("button", { name: /Inspect runtime/i }), "runtime inspect");
    await closeModal(page);
    await click(page.getByRole("button", { name: /Open WAKE truth rule/i }), "truth rule info");
    await closeModal(page);
    await click(page.getByRole("button", { name: /Open voice settings/i }), "open installed system TTS");
    await page.getByText("Installed System TTS", { exact: true }).waitFor();
    await page.getByText(/No custom voice model is claimed/i).waitFor();
    await page.getByLabel("System voice", { exact: true }).waitFor();
    await page.getByRole("button", { name: /^Test Voice$/i }).waitFor();
    await click(page.getByRole("button", { name: /^Mute system voice$/i }), "persist system voice mute");
    await click(page.getByRole("button", { name: /^Unmute system voice$/i }), "persist system voice unmute");
    await click(page.getByRole("button", { name: /Open voice settings/i }), "close installed system TTS");
    await click(page.getByRole("button", { name: /Replay boot sequence/i }), "replay boot sequence");
    await page.waitForSelector(".boot", { timeout: 5000 });
    await click(page.getByRole("button", { name: /Skip Boot/i }), "skip replayed boot");
    await page.waitForSelector(".app-shell", { timeout: 5000 });
    await click(page.getByRole("button", { name: "Library", exact: true }), "library quick action route");
    await click(page.getByRole("button", { name: /Open Exports/i }), "open exports");
    await click(page.getByRole("button", { name: "Audit", exact: true }), "snapshot quick action route");
    await click(page.getByRole("button", { name: /Open Snapshots/i }), "open snapshots");
    await click(page.getByRole("button", { name: "Vault", exact: true }), "vault quick action route");
    await click(page.getByRole("button", { name: /Open Data/i }), "open data");
    await click(page.getByRole("button", { name: "Console", exact: true }), "console quick action return");

    for (const name of ["Console", "Agents", "Cluster", "Vault", "Library", "Monitor", "Audit"]) {
      await click(page.getByRole("button", { name, exact: true }), `tab ${name}`);
      if (name === "Console") {
        await page.locator(".campaign-autopilot").waitFor();
        await page.locator(".campaign-empty-state").waitFor();
        await page.getByLabel("Optional campaign direction").waitFor();
        if (!(await page.getByRole("button", { name: /Create Campaign/i }).isDisabled())) throw new Error("Empty Campaign Autopilot is not gated before project knowledge or direction.");
        await click(page.locator(".context-agent-tools > summary"), "open Console section chat");
        await page.locator(".context-agent-tools .latest-answer").waitFor();
        await page.getByRole("button", { name: /Speak with runtime speech recognition/i }).waitFor();
        await click(page.locator(".context-agent-tools > summary"), "close Console section chat");
        logClick("Console autonomous creator contract");
      } else if (name === "Cluster") {
        await page.locator(".cluster-panel").waitFor();
        await page.locator(".cluster-empty").waitFor();
        await page.getByRole("button", { name: /Build Content Cluster/i }).waitFor();
        await click(page.locator(".context-agent-tools > summary"), "open Cluster section chat");
        await page.locator(".context-agent-tools .latest-answer").waitFor();
        await page.getByRole("button", { name: /Speak with runtime speech recognition/i }).waitFor();
        await click(page.locator(".context-agent-tools > summary"), "close Cluster section chat");
        await click(page.getByRole("button", { name: /Build Content Cluster/i }), "empty cluster validation");
        await page.locator(".ability-state.error").waitFor();
        logClick("Cluster empty/error contract");
      } else {
        await page.locator(".ability-command").waitFor();
        await page.locator(".ability-output-destination").waitFor();
        await page.locator(".ability-state").waitFor();
        await page.locator(".ability-action-rail [data-primary-action=true]").waitFor();
        await page.locator(".agent-chat-panel").waitFor();
        await page.locator(".latest-answer").waitFor();
        await page.getByRole("button", { name: /Speak with runtime speech recognition/i }).waitFor();
        await page.locator(".next-step-panel").waitFor();
        logClick(`${name} complete ability contract`);
      }
    }

    await click(page.getByRole("button", { name: "Console", exact: true }), "return console");
    await click(page.getByText("Project settings", { exact: true }), "open project settings");
    await page.getByLabel("Project name").fill("UI Audit Project");
    await click(page.getByRole("button", { name: /^Create$/ }), "create project");
    if (!(await page.getByLabel("Project name").isVisible().catch(() => false))) await click(page.getByText("Project settings", { exact: true }), "reopen project settings");
    await page.getByLabel("Project name").fill("UI Audit Project Renamed");
    await click(page.getByRole("button", { name: /^Rename$/ }), "rename project");
    if (!(await page.getByTitle("Create local backup").isVisible().catch(() => false))) await click(page.getByText("Project settings", { exact: true }), "reopen project settings for data protection");
    await click(page.getByTitle("Create local backup"), "create manual local backup");
    await click(page.getByTitle("Export all local data"), "export all local data");
    await click(page.getByTitle("Clean temporary cache"), "clean temporary cache");
    page.once("dialog", (dialog) => dialog.accept());
    await click(page.getByTitle("Restore latest local backup"), "restore latest local backup");

    const sourceText = "A local home organizer offers a two-week kitchen reset with labeled zones, donation pickup coordination, and a maintenance plan. Build a content packet with proof, hooks, captions, and export.";
    await click(page.getByText("Source and advanced controls", { exact: true }), "open creator source controls");
    await page.getByLabel("Source material").fill(sourceText);
    await click(page.getByRole("button", { name: /Save Source/i }).first(), "save source");
    await click(page.getByRole("button", { name: /Create Campaign/i }), "create autonomous campaign");
    await page.locator(".campaign-review").waitFor({ timeout: 30000 });
    for (const [platform, previewLabel] of [["TikTok", "TikTok campaign preview"], ["Instagram", "Instagram campaign preview"], ["X", "X campaign preview"], ["LinkedIn", "LinkedIn campaign preview"]]) {
      await click(page.getByRole("tab", { name: platform, exact: true }), `${platform} native preview`);
      await page.getByLabel(previewLabel).waitFor();
    }
    if (!(await page.getByRole("button", { name: /Generate Image/i }).isDisabled())) throw new Error("Image generation is not gated before external provider consent.");
    await page.getByRole("button", { name: /Enable Images/i }).waitFor();
    logClick("honest original image consent state");
    await click(page.locator(".campaign-copy-actions").getByRole("button", { name: /Copy/i }), "copy campaign platform output");
    await click(page.locator(".campaign-review-header").getByRole("button", { name: /Export/i }), "export campaign");
    const exportPreviewVisible = await page.locator(".export-preview").first().isVisible({ timeout: 10000 }).catch(() => false);
    if (exportPreviewVisible) logClick("export preview visible");
    await page.locator(".autopilot-next-step").waitFor();
    logClick("campaign next-step steering visible");

    await click(page.getByRole("button", { name: "Console", exact: true }), "console after export");
    await click(page.getByRole("button", { name: "Agents", exact: true }), "open agents for content run");
    await click(page.locator(".ability-action-rail [data-primary-action=true]"), "run tier zero content agents");
    await page.getByLabel("Message agent").fill("What can you pull from my source vault for the organization service?");
    await click(page.getByRole("button", { name: /Send/i }).last(), "agent chat send");
    await page.locator(".latest-answer p").filter({ hasText: /source vault|organization|request/i }).first().waitFor({ timeout: 10000 });
    await page.waitForSelector(".chat-history article", { timeout: 190000 });
    const providerLabel = (await page.locator(".latest-answer").getAttribute("data-provider-label") || "").trim();
    const provider = (await page.locator(".latest-answer").getAttribute("data-provider") || "").trim();
    const honestProvider = provider === "ollama"
      ? Boolean(providerLabel && providerLabel !== "Instant Local Draft")
      : provider === "local-deterministic" && providerLabel === "Instant Local Draft";
    if (!honestProvider) throw new Error(`Dishonest final chat provider: ${JSON.stringify({ provider, providerLabel })}`);
    logClick(`chat answer persisted from ${providerLabel}`);
    await page.getByRole("button", { name: /Read Aloud/i }).waitFor();
    await click(page.getByRole("button", { name: /Promote Output/i }), "promote latest answer");
    await click(page.getByRole("button", { name: /Export Answer/i }), "export latest answer");
    await page.waitForSelector(".export-preview", { timeout: 10000 });
    logClick("agent answer export preview visible");
    await click(page.getByRole("button", { name: "Cluster", exact: true }), "open autonomous campaign cluster");
    await page.waitForSelector(".cluster-stack", { timeout: 10000 });

    const platformLaneButtons = await page.locator(".cluster-stack .variant-list button").count();
    if (platformLaneButtons < 4) throw new Error("Phase 4 platform lanes are incomplete.");
    for (let i = 0; i < Math.min(platformLaneButtons, 4); i += 1) {
      await click(page.locator(".cluster-stack .variant-list button").nth(i), `phase4 platform lane ${i + 1}`);
    }
    const clusterScriptBeats = await page.locator(".cluster-stack .scene-list div").count();
    if (clusterScriptBeats < 6) throw new Error("Phase 4 cluster scripts are incomplete.");
    const clusterEvidenceRows = await page.locator(".cluster-stack .claim-list div").count();
    if (clusterEvidenceRows < 6) throw new Error("Phase 4 cluster evidence/trace rows are incomplete.");
    await click(page.getByRole("button", { name: /Export Cluster/i }), "export cluster");
    await page.waitForSelector(".cluster-stack .export-preview", { timeout: 10000 });
    logClick("cluster export preview visible");

    await click(page.getByRole("button", { name: "Library", exact: true }), "library tab");
    for (const [selector, label] of [
      [".library-grid .panel:nth-child(1) .library-list button", "library saved source"],
      [".library-grid .panel:nth-child(2) .library-list button", "library generated output"],
      [".library-grid .panel:nth-child(3) .library-list button", "library export"],
      [".library-grid .panel:nth-child(4) .library-list button", "library history"]
    ]) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        await click(page.locator(selector).first(), label);
        await closeModal(page);
        await click(page.getByRole("button", { name: "Library", exact: true }), `return library after ${label}`);
      }
    }

    await click(page.getByRole("button", { name: "Vault", exact: true }), "ip vault tab");
    await click(page.getByText("Drive / folder intake", { exact: true }), "open drive intake settings");
    await closeModal(page);
    await page.getByLabel("Intake review mission").fill("Home organizer service notes, proof, source copy, platform assets, and campaign visuals. Random screenshots are not wanted.");
    logClick("intake review mission");
    await page.getByRole("button", { name: /Refresh Drives/i }).waitFor();
    logClick("drive refresh control visible");
    await page.getByRole("button", { name: /Scan My Content Folders/i }).waitFor();
    await page.getByRole("button", { name: /Review Flash Drive/i }).waitFor();
    await page.getByLabel("Intake scan roots").fill(intakeSeed);
    await click(page.getByRole("button", { name: /Import Listed Folders/i }), "run intake agent");
    await page.waitForTimeout(1200);
    const mediaCards = await page.locator(".media-vault-list button").count();
    if (mediaCards < 1) throw new Error("Media vault has no clickable cards after intake.");
    await click(page.locator(".media-vault-list button").first(), "media card detail");
    await page.getByLabel("Rename inventory title").waitFor();
    logClick("media rename option visible");
    await closeModal(page);
    await page.getByLabel("Search IP vault").fill("organizer");
    logClick("ip vault search");
    await page.getByLabel("Filter IP lane").selectOption("all");
    logClick("ip vault lane filter");
    await page.getByLabel("Filter IP lane").selectOption("all");
    await page.getByLabel("Search IP vault").fill("organizer");
    await page.getByLabel("Filter IP lane").selectOption("all");
    const vaultSources = await page.locator(".source-vault-list button").count();
    if (vaultSources < 1) throw new Error("IP Vault has no source buttons.");
    await click(page.locator(".source-vault-list button").first(), "open source document");
    await page.locator(".document-content").filter({ hasText: /organizer/i }).waitFor();
    logClick("source document content visible");
    await click(page.getByRole("button", { name: /Use In Creator/i }), "use document in creator");
    await click(page.getByRole("button", { name: "Agents", exact: true }), "agent tab after source load");
    await page.locator(".agent-source-panel").filter({ hasText: /Agent Source/i }).waitFor();
    logClick("agent source panel visible");
    await page.locator(".agent-source-current").filter({ hasText: /Kitchen Reset Service|organizer-service-note/i }).waitFor();
    logClick("agent current source visible");
    const agentSourceButtons = await page.locator(".agent-source-list button").count();
    if (agentSourceButtons < 1) throw new Error("Agent page has no saved source selector buttons.");
    await click(page.locator(".agent-source-list button").first(), "agent source selector load");
    await page.waitForFunction(() => {
      const btn = document.querySelector(".agent-source-actions button.primary-action");
      return btn && !btn.disabled;
    }, { timeout: 6000 });
    await click(page.getByRole("button", { name: "Vault", exact: true }), "return ip vault");

    await click(page.getByRole("button", { name: "Monitor", exact: true }), "task monitor tab");
    for (const [selector, label] of [
      [".monitor-panel .panel-icon-action", "system monitor info"],
      [".monitor-tile", "monitor tile info"],
      [".sparkline", "telemetry trace info"],
      [".lower-grid .panel:nth-child(1) .panel-icon-action", "task monitor filter info"],
      [".lower-grid .panel:nth-child(2) .panel-icon-action", "capability truth info"]
    ]) {
      await click(page.locator(selector).first(), label);
      await closeModal(page);
    }
    await page.locator(".task-search").fill("source");
    logClick("task search");
    await page.locator(".task-search").fill("");
    for (const filter of ["all", "running", "done"]) {
      await click(page.locator(".filter-row button").filter({ hasText: filter }).first(), `task filter ${filter}`);
    }
    await click(page.locator(".task-list .task-row").first(), "task row info");
    await page.getByRole("button", { name: /Open Related Surface/i }).waitFor();
    await closeModal(page);

    const capabilityButtons = await page.locator(".capability-list button").count();
    if (capabilityButtons < 1) throw new Error("Capability truth map has no controls.");
    for (let i = 0; i < capabilityButtons; i += 1) {
      await click(page.locator(".capability-list button").nth(i), `capability ${i + 1}`);
      await closeModal(page);
    }
    await click(page.getByRole("button", { name: "Console", exact: true }), "console capabilities complete");

    await click(page.getByRole("button", { name: "Audit", exact: true }), "snapshot tab");
    await click(page.getByRole("button", { name: /Save Snapshot/i }).first(), "save snapshot");
    await click(page.getByLabel("Run Agent"), "dock run agent");
    await click(page.getByLabel("Export Output"), "dock export output");
    await click(page.locator(".terminal-button"), "dock console");

    await assertNoTextOverflow(page);
    const consoleSectionAudit = await page.evaluate(() => {
      const required = [
        [".campaign-autopilot", "Campaign Autopilot"],
        [".campaign-review", "Campaign review"],
        [".native-preview", "Native platform preview"],
        [".autopilot-next-step", "Campaign next step"],
        [".context-agent-tools", "Context agent tools"]
      ];
      return required
        .map(([selector, label]) => ({ label, count: document.querySelectorAll(selector).length }))
        .filter((item) => item.count === 0);
    });
    if (consoleSectionAudit.length) throw new Error(`Empty required console sections: ${JSON.stringify(consoleSectionAudit)}`);
    await click(page.getByRole("button", { name: "Vault", exact: true }), "final ip vault verification");
    const vaultSectionAudit = await page.evaluate(() => {
      const required = [
        [".source-vault-list button", "IP Vault sources"],
        [".media-vault-list button", "Media vault"],
        [".intake-panel", "Intake panel"]
      ];
      return required
        .map(([selector, label]) => ({ label, count: document.querySelectorAll(selector).length }))
        .filter((item) => item.count === 0);
    });
    if (vaultSectionAudit.length) throw new Error(`Empty required vault sections: ${JSON.stringify(vaultSectionAudit)}`);
    await click(page.getByRole("button", { name: "Console", exact: true }), "final console screenshot state");
    await page.waitForTimeout(3800);
    const shot = path.join(AUDIT_DIR, "wake-v6-electron-button-audit.png");
    await page.screenshot({ path: shot, fullPage: true });

    if (errors.length) throw new Error(`Browser errors: ${errors.join(" | ")}`);
    console.log(`\n${clicked.length} controls/actions verified`);
    console.log(`Screenshot: ${shot}`);
  } finally {
    await app.close().catch(() => {});
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`\nUI AUDIT FAILED: ${error.message}`);
  if (errors.length) console.error(`BROWSER ERRORS: ${errors.join(" | ")}`);
  process.exit(1);
});
