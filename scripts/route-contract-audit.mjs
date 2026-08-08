#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const configPath = path.join(ROOT, "src", "app-config.jsx");
const guardPath = path.join(ROOT, "src", "route-guards.css");

const config = fs.readFileSync(configPath, "utf8");
const routeGuards = fs.readFileSync(guardPath, "utf8");

function block(name, nextMarker) {
  const start = config.indexOf(`export const ${name} =`);
  if (start < 0) throw new Error(`Missing ${name} export.`);
  const end = nextMarker ? config.indexOf(nextMarker, start) : config.length;
  if (end < 0) throw new Error(`Could not bound ${name} export.`);
  return config.slice(start, end);
}

const tabsBlock = block("tabs", "export const abilityBlueprints");
const blueprintBlock = block("abilityBlueprints", "export const abilityAgentDefaults");
const defaultsBlock = block("abilityAgentDefaults", "export const polishPrompts");
const promptsBlock = block("polishPrompts", "export const bootLines");
const tabIds = [...tabsBlock.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);

if (!tabIds.length) throw new Error("No WAKE routes found in tabs.");
if (new Set(tabIds).size !== tabIds.length) throw new Error(`Duplicate route IDs: ${tabIds.join(", ")}`);

function hasKey(source, id) {
  return new RegExp(`(?:^|\\n)\\s*${id}:\\s*`, "m").test(source);
}

const missing = [];
for (const id of tabIds) {
  if (!hasKey(blueprintBlock, id)) missing.push(`${id}: abilityBlueprints`);
  if (!hasKey(defaultsBlock, id)) missing.push(`${id}: abilityAgentDefaults`);
  if (!hasKey(promptsBlock, id)) missing.push(`${id}: polishPrompts`);
}

if (missing.length) {
  throw new Error(`Route contract gaps detected:\n- ${missing.join("\n- ")}`);
}

for (const standaloneRoute of ["instructions", "automations"]) {
  const routeMarker = standaloneRoute === "instructions" ? ".instructions-container" : ".automations-panel";
  if (!routeGuards.includes(routeMarker)) {
    throw new Error(`${standaloneRoute} is missing its standalone route guard.`);
  }
}

if (!routeGuards.includes(".automation-form")) {
  throw new Error("Automation edit mode is missing its standalone route guard.");
}

console.log(`Route contract audit passed for ${tabIds.length} routes: ${tabIds.join(", ")}`);
