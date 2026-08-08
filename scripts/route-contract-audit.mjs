#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const configPath = path.join(ROOT, "src", "app-config.jsx");
const mainPath = path.join(ROOT, "src", "main.jsx");
const obsoleteGuardPath = path.join(ROOT, "src", "route-guards.css");

function readNormalized(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

const config = readNormalized(configPath);
const main = readNormalized(mainPath);

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

const tabsBlock = configBlock("tabs", "export const abilityBlueprints");
const blueprintBlock = configBlock("abilityBlueprints", "export const abilityAgentDefaults");
const defaultsBlock = configBlock("abilityAgentDefaults", "export const polishPrompts");
const promptsBlock = configBlock("polishPrompts", "export const bootLines");
const tabMatches = [...tabsBlock.matchAll(/id:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"/g)];
const tabIds = tabMatches.map((match) => match[1]);

if (!tabIds.length) throw new Error("No WAKE routes found in tabs.");
if (new Set(tabIds).size !== tabIds.length) throw new Error(`Duplicate route IDs: ${tabIds.join(", ")}`);

const signalsBlock = sliceBetween(main, "  const signals = {", "\n  };\n  const routeSignals", "abilitySignals map");
const readinessBlock = sliceBetween(main, "  const readyByAbility = {", "\n  };\n  const ready =", "readyByAbility map");
const actionSetsBlock = sliceBetween(main, "  const actionSets = {", "\n  };\n  const actions =", "actionSets map");
const nextStepBlock = sliceBetween(main, "function NextStepPanel(", "\nfunction StudioCard(", "NextStepPanel");

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

if (!main.includes('const standaloneRoutes = new Set(["instructions", "automations"]);')) {
  throw new Error("Standalone route declaration is missing or changed.");
}
if (!main.includes('active !== "console" && active !== "cluster" && !standaloneRoutes.has(active)')) {
  throw new Error("Standalone routes are not excluded from the shared ability scaffold in React.");
}
if (!main.includes('standaloneRoutes.has(active) ? null : sectionAgentChat')) {
  throw new Error("Standalone routes are not excluded from shared agent chat in React.");
}
if (fs.existsSync(obsoleteGuardPath)) {
  throw new Error("Obsolete route-guards.css concealment still exists.");
}
if (config.includes("route-guards.css")) {
  throw new Error("app-config still imports the obsolete CSS concealment.");
}

console.log(`Hostile route contract audit passed for ${tabIds.length} routes: ${tabIds.join(", ")}`);
