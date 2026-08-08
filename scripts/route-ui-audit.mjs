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

async function main() {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  fs.rmSync(PROFILE_DIR, { recursive: true, force: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

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

    const operatorInputs = page.locator(".operator-field input");
    if (await operatorInputs.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await operatorInputs.nth(0).fill("JUSTIN");
      await operatorInputs.nth(1).fill("WAKE");
      await page.getByRole("button", { name: /Enter Wake Engine/i }).click();
    }
    if (await page.locator(".boot").isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.getByRole("button", { name: /Skip Boot/i }).click();
    }
    await page.waitForSelector(".app-shell", { timeout: 20000 });

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

    await page.getByRole("button", { name: "Instructions", exact: true }).click();
    await page.locator(".instructions-container").waitFor({ state: "visible" });
    await page.getByPlaceholder("What do you want to do simply?").fill("Show me how to inspect the local runtime.");
    await page.getByRole("button", { name: "Get Instructions", exact: true }).waitFor();
    await assertStandaloneIsolation(page, "instructions");
    console.log("  OK Instructions standalone interaction contract");

    await page.getByRole("button", { name: "Automations", exact: true }).click();
    await page.locator(".automations-panel").waitFor({ state: "visible" });
    await page.getByRole("button", { name: /New Automation/i }).click();
    await page.locator(".automation-form").waitFor({ state: "visible", timeout: 10000 });
    await assertStandaloneIsolation(page, "automations-edit");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.locator(".automations-panel").waitFor({ state: "visible", timeout: 10000 });
    await assertStandaloneIsolation(page, "automations");
    console.log("  OK Automations standalone edit contract");

    if (errors.length) {
      throw new Error(`Route UI audit captured runtime errors:\n- ${errors.join("\n- ")}`);
    }

    console.log(`Route UI audit passed for all ${routes.length} configured routes.`);
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
