import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { ensureDiskCapacity, fileHash, writeFileAtomic, writeJsonDurable } from "./durable-storage.js";

const MAX_BUNDLE_BYTES = 300 * 1024 * 1024;

function safeStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function collectFiles(dataDir) {
  const entries = [];
  let totalBytes = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(dataDir, fullPath).replaceAll("\\", "/");
      if (entry.isDirectory()) {
        if (["backups", "cache", "journal"].includes(relativePath.split("/")[0]) || [".wake-wal", ".wake-backups"].includes(entry.name) || entry.name.endsWith(".lock") || relativePath === "exports/all-data") continue;
        walk(fullPath);
        continue;
      }
      if (/\.tmp-|\.previous$|\.sha256$|\.meta\.json$|\.lock$/.test(entry.name)) continue;
      const data = fs.readFileSync(fullPath);
      totalBytes += data.length;
      if (totalBytes > MAX_BUNDLE_BYTES) {
        const error = new Error("Wake data exceeds the 300 MB portable backup limit.");
        error.code = "WAKE_BACKUP_TOO_LARGE";
        error.status = 413;
        throw error;
      }
      entries.push({ path: relativePath, bytes: data.length, sha256: fileHash(data), base64: data.toString("base64") });
    }
  };
  walk(dataDir);
  return { entries, totalBytes };
}

function rotate(directory, limit) {
  const files = fs.readdirSync(directory)
    .filter((name) => name.endsWith(".wakebundle"))
    .map((name) => ({ name, time: fs.statSync(path.join(directory, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  for (const item of files.slice(limit)) fs.rmSync(path.join(directory, item.name), { force: true });
}

export function createDataBundle(dataDir, { kind = "manual", targetDir } = {}) {
  const outputDir = targetDir || path.join(dataDir, "backups", kind);
  fs.mkdirSync(outputDir, { recursive: true });
  const { entries, totalBytes } = collectFiles(dataDir);
  const payload = {
    schemaVersion: 1,
    product: "Wake Engine",
    kind,
    createdAt: new Date().toISOString(),
    totalBytes,
    entries
  };
  const serialized = Buffer.from(JSON.stringify(payload), "utf8");
  const compressed = zlib.gzipSync(serialized, { level: 9 });
  ensureDiskCapacity(path.join(outputDir, "bundle"), compressed.length);
  const digest = fileHash(compressed);
  const fileName = `wake-${kind}-${safeStamp()}-${digest.slice(0, 10)}.wakebundle`;
  const filePath = path.join(outputDir, fileName);
  writeFileAtomic(filePath, compressed);
  writeFileAtomic(`${filePath}.sha256`, `${digest}\n`);
  rotate(outputDir, kind === "manual" ? 20 : 12);
  return { id: fileName, kind, fileName, filePath, sha256: digest, bytes: compressed.length, sourceBytes: totalBytes, entryCount: entries.length, createdAt: payload.createdAt };
}

function resolveBundle(dataDir, fileName) {
  const safeName = path.basename(String(fileName || ""));
  for (const directory of [path.join(dataDir, "backups", "manual"), path.join(dataDir, "exports", "all-data"), path.join(dataDir, "backups", "pre-restore")]) {
    const candidate = path.join(directory, safeName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function restoreDataBundle(dataDir, fileName, { stateStore = null } = {}) {
  const bundlePath = resolveBundle(dataDir, fileName);
  if (!bundlePath) {
    const error = new Error("Backup bundle was not found.");
    error.status = 404;
    throw error;
  }
  const compressed = fs.readFileSync(bundlePath);
  const expectedHashPath = `${bundlePath}.sha256`;
  const expectedHash = fs.existsSync(expectedHashPath) ? fs.readFileSync(expectedHashPath, "utf8").trim() : null;
  if (expectedHash && expectedHash !== fileHash(compressed)) throw new Error("Backup bundle integrity check failed.");
  const payload = JSON.parse(zlib.gunzipSync(compressed).toString("utf8"));
  if (payload.schemaVersion !== 1 || payload.product !== "Wake Engine" || !Array.isArray(payload.entries)) throw new Error("Backup bundle format is invalid.");
  const preRestore = createDataBundle(dataDir, { kind: "pre-restore", targetDir: path.join(dataDir, "backups", "pre-restore") });
  for (const entry of payload.entries) {
    const relativePath = String(entry.path || "").replaceAll("\\", "/");
    if (!relativePath || relativePath.startsWith("/") || relativePath.split("/").includes("..")) throw new Error("Backup bundle contains an unsafe path.");
    const data = Buffer.from(entry.base64 || "", "base64");
    if (data.length !== entry.bytes || fileHash(data) !== entry.sha256) throw new Error(`Backup entry integrity failed: ${relativePath}`);
    const targetPath = path.join(dataDir, ...relativePath.split("/"));
    if (path.extname(targetPath).toLowerCase() === ".json") {
      const value = JSON.parse(data.toString("utf8"));
      if (relativePath === "wake-v6-store.json" && stateStore) stateStore.write(value, { reason: "portable-backup-restore" });
      else writeJsonDurable(targetPath, value, { reason: "portable-backup-restore" });
    } else writeFileAtomic(targetPath, data);
  }
  return { restored: true, fileName: path.basename(bundlePath), entryCount: payload.entries.length, preRestore };
}

export function listDataBundles(dataDir) {
  const groups = [
    ["manual", path.join(dataDir, "backups", "manual")],
    ["export-all", path.join(dataDir, "exports", "all-data")],
    ["pre-restore", path.join(dataDir, "backups", "pre-restore")]
  ];
  const results = [];
  for (const [kind, directory] of groups) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).filter((item) => item.endsWith(".wakebundle"))) {
      const filePath = path.join(directory, name);
      const stat = fs.statSync(filePath);
      results.push({ id: name, kind, fileName: name, filePath, bytes: stat.size, createdAt: stat.birthtime.toISOString() });
    }
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function cleanupLocalCache(dataDir) {
  const cacheDir = path.join(dataDir, "cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  let removed = 0;
  let reclaimedBytes = 0;
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  const roots = [cacheDir, dataDir];
  for (const root of roots) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (root === dataDir && !/\.tmp-|\.previous$/.test(entry.name)) continue;
      const filePath = path.join(root, entry.name);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs > cutoff) continue;
      reclaimedBytes += stat.size;
      fs.rmSync(filePath, { force: true });
      removed += 1;
    }
  }
  return { removed, reclaimedBytes, cacheDir, cleanedAt: new Date().toISOString() };
}
