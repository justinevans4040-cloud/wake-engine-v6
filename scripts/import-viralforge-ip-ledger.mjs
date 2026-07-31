import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE_PATH = path.join(ROOT, "server", "data", "wake-v6-store.json");
const BACKUP_DIR = path.join(ROOT, "server", "data", "backups");
const DEFAULT_LEDGER = "C:\\Users\\justi\\Desktop\\ViralForge-Local\\server\\lib\\data\\ip-intake-ledger.json";

function now() {
  return new Date().toISOString();
}

function stableId(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 16);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function sourceBody(entry) {
  const lines = [
    `# ${entry.name}`,
    "",
    `Lane: ${entry.lane || entry.category || "Uncategorized"}`,
    `Source type: ${entry.sourceType}`,
    entry.path ? `Local path: ${entry.path}` : null,
    entry.url ? `Google Drive URL: ${entry.url}` : null,
    entry.googleFileId ? `Google file ID: ${entry.googleFileId}` : null,
    entry.mimeType ? `MIME type: ${entry.mimeType}` : null,
    entry.extractStatus ? `Extraction: ${entry.extractStatus}` : null,
    Array.isArray(entry.tags) && entry.tags.length ? `Tags: ${entry.tags.join(", ")}` : null,
    "",
    "## Extracted Content",
    "",
    entry.excerpt || "Metadata-only entry. Full source is referenced above."
  ];
  return lines.filter((line) => line !== null).join("\n");
}

const ledgerPath = process.argv[2] || DEFAULT_LEDGER;
const ledger = readJson(ledgerPath);
const store = readJson(STORE_PATH);
const projectId = store.projects?.[0]?.id || "wake-v6-main";

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = now().replace(/[:.]/g, "-");
fs.copyFileSync(STORE_PATH, path.join(BACKUP_DIR, `wake-v6-store-before-ip-import-${stamp}.json`));

const existingKeys = new Set((store.sources || []).map((source) => source.importKey || source.id));
const imported = [];

for (const entry of ledger.entries || []) {
  const importKey = `viralforge-ip:${entry.sourceKey || entry.path || entry.url || entry.id}`;
  if (existingKeys.has(importKey)) continue;
  const body = sourceBody(entry);
  imported.push({
    id: `src-${stableId(importKey)}`,
    projectId,
    title: `[${entry.lane || entry.category || "IP"}] ${entry.name}`,
    source: body,
    characterCount: body.length,
    importKey,
    importedFrom: "ViralForge IP Intake",
    lane: entry.lane || entry.category || "Uncategorized",
    sourceType: entry.sourceType,
    sourcePath: entry.path || null,
    sourceUrl: entry.url || null,
    createdAt: entry.importedAt || ledger.generatedAt || now(),
    updatedAt: now()
  });
  existingKeys.add(importKey);
}

store.sources = [...imported, ...(store.sources || [])];
store.history = [
  {
    id: `hist-${stableId(`ip-import:${stamp}`)}`,
    type: "ip.imported",
    detail: `Imported ${imported.length} Viral Forge IP source(s) into WAKE Library.`,
    payload: {
      ledgerPath,
      totalLedgerEntries: (ledger.entries || []).length,
      imported: imported.length
    },
    createdAt: now()
  },
  ...(store.history || [])
].slice(0, 200);

writeJson(STORE_PATH, store);

console.log(JSON.stringify({
  ok: true,
  ledgerPath,
  imported: imported.length,
  totalSources: store.sources.length,
  storePath: STORE_PATH
}, null, 2));
