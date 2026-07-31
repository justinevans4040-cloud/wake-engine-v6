#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE_FILE = path.join(ROOT, "server", "data", "wake-v6-store.json");
const store = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
const aurora = store.projects.find((project) => /aurora/i.test(project.name));
const generalProjectId = store.projects.find((project) => project.id === "wake-v6-main")?.id || store.projects.find((project) => /wake engine/i.test(project.name))?.id;
let renamed = 0;
let removedSelfImports = 0;
let movedAuroraSources = 0;
let duplicateSourcesRemoved = 0;
let duplicateProjectsMerged = 0;

function clean(value) {
  if (typeof value === "string") {
    const next = value
      .replace(/Aurora\s*\/\s*Amora Storytime/gi, "Aurora Storytime")
      .replace(/\bAmora Storytime\b/gi, "Aurora Storytime");
    if (next !== value) renamed += 1;
    return next;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => !(typeof item === "string" && /^amora$/i.test(item.trim())))
      .map(clean);
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) value[key] = clean(item);
  }
  return value;
}

clean(store);
if (aurora) aurora.name = "Aurora Storytime";

const duplicateWakeProjectIds = new Set(store.projects
  .filter((project) => project.id !== generalProjectId && /^wake engine v6$/i.test(project.name.trim()))
  .map((project) => project.id));
if (duplicateWakeProjectIds.size && generalProjectId) {
  for (const key of ["sources", "mediaAssets", "generations", "agentChats", "runRecords", "exports", "history", "intakeRuns"]) {
    for (const record of store[key] || []) {
      if (duplicateWakeProjectIds.has(record.projectId)) record.projectId = generalProjectId;
      if (duplicateWakeProjectIds.has(record.payload?.projectId)) record.payload.projectId = generalProjectId;
    }
  }
  duplicateProjectsMerged = duplicateWakeProjectIds.size;
  store.projects = store.projects.filter((project) => !duplicateWakeProjectIds.has(project.id));
}

for (const source of store.sources || []) {
  if (aurora && (source.lane === "Aurora Storytime" || /^\[Aurora Storytime\]/i.test(source.title || ""))) {
    if (source.projectId !== aurora.id) movedAuroraSources += 1;
    source.projectId = aurora.id;
  }
}

store.sources = (store.sources || []).filter((source) => {
  const sourcePath = String(source.sourcePath || "");
  const selfImport = /wake-v6-store\.json$/i.test(sourcePath) || /wake-v6-store\.json$/i.test(source.title || "");
  if (selfImport) removedSelfImports += 1;
  return !selfImport;
});

const seenSources = new Set();
store.sources = store.sources.filter((source) => {
  const key = `${source.projectId}\n${String(source.source || "").trim().replace(/\s+/g, " ").toLowerCase()}`;
  if (!source.source || !seenSources.has(key)) {
    seenSources.add(key);
    return true;
  }
  duplicateSourcesRemoved += 1;
  return false;
});

fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
console.log(JSON.stringify({ ok: true, renamed, movedAuroraSources, duplicateSourcesRemoved, duplicateProjectsMerged, removedSelfImports, auroraProject: aurora?.name || null }, null, 2));
