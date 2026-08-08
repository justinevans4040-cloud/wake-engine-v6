#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const configPath = path.join(ROOT, "src", "app-config.jsx");
const mainPath = path.join(ROOT, "src", "main.jsx");
const serverPath = path.join(ROOT, "server", "index.js");
const obsoleteGuardPath = path.join(ROOT, "src", "route-guards.css");

function readNormalized(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

const config = readNormalized(configPath);
const main = readNormalized(mainPath);
const server = readNormalized(serverPath);

function sliceBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing ${label} start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Missing ${label} end marker: ${endMarker}`);
  return source.slice(start, end);
}

function configBlock(name, nextMarker) {
  return sliceBetween(config, `export const ${name} =`, nextMarker, name);
}

function hasKey(source, id) {
  return new RegExp(`(?:^|[,{\\n])\\s*${id}\\s*:\\s*`, "m").test(source);
}

const primaryTabsBlock = configBlock("primaryTabs", "export const secondaryTabs");
const secondaryTabsBlock = configBlock("secondaryTabs", "export const legacyTabs");
const legacyTabsBlock = configBlock("legacyTabs", "export const tabs");
const blueprintBlock = configBlock("abilityBlueprints", "export const abilityAgentDefaults");
const defaultsBlock = configBlock("abilityAgentDefaults", "export const polishPrompts");
const promptsBlock = configBlock("polishPrompts", "export const bootLines");
const primaryTabMatches = [...primaryTabsBlock.matchAll(/id:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"/g)];
const secondaryTabMatches = [...secondaryTabsBlock.matchAll(/id:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"/g)];
const legacyTabMatches = [...legacyTabsBlock.matchAll(/id:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"/g)];
const primaryTabIds = primaryTabMatches.map((match) => match[1]);
const secondaryTabIds = secondaryTabMatches.map((match) => match[1]);
const tabIds = [...primaryTabIds, ...secondaryTabIds, ...legacyTabMatches.map((match) => match[1])];

if (!tabIds.length) throw new Error("No WAKE routes found in tabs.");
if (new Set(tabIds).size !== tabIds.length) throw new Error(`Duplicate route IDs: ${tabIds.join(", ")}`);
if (primaryTabIds.join(",") !== "project,sources,create,review,export") {
  throw new Error(`WAK-8 primary navigation must be exactly Project -> Sources -> Create -> Review -> Export. Found: ${primaryTabIds.join(" -> ")}`);
}
if (secondaryTabIds.join(",") !== "library,system") {
  throw new Error(`WAK-8 secondary navigation must be exactly Library | System. Found: ${secondaryTabIds.join(" | ")}`);
}
const primaryLabels = primaryTabMatches.map((match) => match[2]);
if (primaryLabels.some((label) => /^(Agents|Cluster|Vault|Automations|Monitor|Audit|Instructions|Voice)$/i.test(label))) {
  throw new Error(`Legacy/secondary destinations still compete inside primaryTabs: ${primaryLabels.join(", ")}`);
}
if (!main.includes("{primaryTabs.map") || !main.includes("{secondaryTabs.map")) {
  throw new Error("Renderer does not use separate primary and secondary navigation.");
}
if (main.includes("{tabs.map(({ id, label, icon: Icon })")) {
  throw new Error("Renderer still maps the combined route registry as primary navigation.");
}

const signalsBlock = sliceBetween(main, "  const signals = {", "\n  };\n  const routeSignals", "abilitySignals map");
const readinessBlock = sliceBetween(main, "  const readyByAbility = {", "\n  };\n  const ready =", "readyByAbility map");
const actionSetsBlock = sliceBetween(main, "  const actionSets = {", "\n  };\n  const actions =", "actionSets map");
const nextStepBlock = sliceBetween(main, "function NextStepPanel(", "\nfunction StudioCard(", "NextStepPanel");
const stateBlock = sliceBetween(server, "function state() {", "\nconst app = express();", "server state projection");

const missing = [];
for (const id of tabIds) {
  if (!hasKey(blueprintBlock, id)) missing.push(`${id}: abilityBlueprints`);
  if (!hasKey(defaultsBlock, id)) missing.push(`${id}: abilityAgentDefaults`);
  if (!hasKey(promptsBlock, id)) missing.push(`${id}: polishPrompts`);
  if (!hasKey(signalsBlock, id)) missing.push(`${id}: abilitySignals`);
  if (!hasKey(readinessBlock, id)) missing.push(`${id}: readyByAbility`);
  if (!hasKey(actionSetsBlock, id)) missing.push(`${id}: actionSets`);
  if (!nextStepBlock.includes(`active === "${id}"`)) missing.push(`${id}: NextStepPanel`);
}

if (missing.length) {
  throw new Error(`Route contract gaps detected:\n- ${missing.join("\n- ")}`);
}

const forbiddenFallbacks = [
  "abilityBlueprints[active] ||",
  "polishPrompts[active] ||",
  "signals[active] ||",
  "actionSets[active] ||",
  "title: \"Start with source\""
];
const presentFallbacks = forbiddenFallbacks.filter((pattern) => main.includes(pattern));
if (presentFallbacks.length) {
  throw new Error(`Silent route fallbacks remain:\n- ${presentFallbacks.join("\n- ")}`);
}

const requiredFailures = [
  "Missing ability signals for route:",
  "Missing ability blueprint for route:",
  "Missing action set for route:",
  "Missing next-step contract for route:",
  "Missing chat blueprint for route:",
  "Missing polish prompts for route:",
  "Missing contextual-agent blueprint for route:"
];
const missingFailures = requiredFailures.filter((pattern) => !main.includes(pattern));
if (missingFailures.length) {
  throw new Error(`Missing fail-closed route protections:\n- ${missingFailures.join("\n- ")}`);
}

if (!main.includes('active === "create" || active === "review" || active === "console" || active === "cluster" || active === "agent"')) {
  throw new Error("Context agents are not limited to Create/Review-compatible work surfaces.");
}
if (!main.includes('active === "system" || active === "automations"') || !main.includes('active === "system" || active === "tasks"') || !main.includes('active === "system" || active === "snapshot"') || !main.includes('active === "system" || active === "instructions"')) {
  throw new Error("System route does not own automations, monitor, audit, and instructions.");
}
if (main.includes("fetchState")) {
  throw new Error("Undefined fetchState wiring remains in the WAKE renderer.");
}
if (!main.includes("onRefresh={refresh}")) {
  throw new Error("Automations is not wired to the live refresh() state callback.");
}
if (!main.includes('select aria-label="Approval Mode"')) {
  throw new Error("Automation Approval Mode select is missing its explicit accessible name.");
}
if (!main.includes('function AutomationsPanel({ state, projectId, onRefresh, setModal, setOperationError })')) {
  throw new Error("AutomationsPanel is not receiving explicit current-project context.");
}
if (!main.includes('projectId={projectId}')) {
  throw new Error("AutomationsPanel current-project prop is not wired from App.");
}
if (!main.includes('setEditor({ projectId: projectId || state?.projects?.[0]?.id || "wake-v6-main", campaignType: "Custom Prompt", scheduleCron: "0 19 * * 0", timeZone: "America/Los_Angeles", approvalMode: "Review Required" })')) {
  throw new Error("New Automation visible defaults are not initialized into submitted editor state.");
}
if (!main.includes("Promise.resolve(onRefresh()).catch") || !main.includes("}, 2500);")) {
  throw new Error("Automations does not continuously refresh persisted scheduler/review state while idle.");
}

const requiredAutomationStateProjection = [
  "automations: store.automations.slice(0, 200)",
  "automationRuns: store.automationRuns.slice(0, 200)",
  "reviewQueue: store.reviewQueue.slice(0, 100)"
];
const missingAutomationStateProjection = requiredAutomationStateProjection.filter((pattern) => !stateBlock.includes(pattern));
if (missingAutomationStateProjection.length) {
  throw new Error(`Automation persisted state is missing from /api/state projection:\n- ${missingAutomationStateProjection.join("\n- ")}`);
}

if (fs.existsSync(obsoleteGuardPath)) {
  throw new Error("Obsolete route-guards.css concealment still exists.");
}
if (config.includes("route-guards.css")) {
  throw new Error("app-config still imports the obsolete CSS concealment.");
}

console.log(`WAK-8 route contract audit passed for ${primaryTabIds.join(" -> ")} with secondary ${secondaryTabIds.join(" | ")}`);
