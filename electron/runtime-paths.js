import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createWakeStateStore, readJsonDurable, writeFileAtomic, writeJsonDurable } from "../server/durable-storage.js";

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function copyDirectory(sourceDir, targetDir, records, allowedTopLevel, destinationRoot = targetDir) {
  if (!fs.existsSync(sourceDir)) return;
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (allowedTopLevel && !allowedTopLevel.has(entry.name)) continue;
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) copyDirectory(source, target, records, null, destinationRoot);
    else {
      if (fs.existsSync(target)) continue;
      const data = fs.readFileSync(source);
      if (path.extname(target).toLowerCase() === ".json") {
        const value = JSON.parse(data.toString("utf8"));
        if (path.relative(destinationRoot, target).replaceAll("\\", "/") === "wake-v6-store.json") {
          createWakeStateStore(target, { defaultValue: value }).write(value, { reason: "legacy-runtime-migration", skipBackup: true });
        } else writeJsonDurable(target, value, { reason: "legacy-runtime-migration", skipBackup: true });
      } else writeFileAtomic(target, data);
      records.push({ path: path.relative(destinationRoot, target).replaceAll("\\", "/"), bytes: fs.statSync(target).size, sha256: hashFile(target) });
    }
  }
}

export function prepareRuntimeDirectories({ userDataDir, legacyDataDir } = {}) {
  const paths = {
    userData: userDataDir,
    data: path.join(userDataDir, "data"),
    logs: path.join(userDataDir, "logs"),
    secure: path.join(userDataDir, "secure"),
    cache: path.join(userDataDir, "cache"),
    backups: path.join(userDataDir, "data", "backups")
  };
  for (const directory of Object.values(paths)) fs.mkdirSync(directory, { recursive: true });
  const markerPath = path.join(userDataDir, "migration-v1.json");
  const destinationStore = path.join(paths.data, "wake-v6-store.json");
  const legacyStore = legacyDataDir ? path.join(legacyDataDir, "wake-v6-store.json") : null;
  let migration = readJsonDurable(markerPath, null);
  if (!fs.existsSync(destinationStore) && legacyStore && fs.existsSync(legacyStore)) {
    const rollbackDir = path.join(paths.backups, "migration");
    fs.mkdirSync(rollbackDir, { recursive: true });
    const rollbackPath = path.join(rollbackDir, `legacy-wake-v6-store-${Date.now()}.json`);
    writeJsonDurable(rollbackPath, JSON.parse(fs.readFileSync(legacyStore, "utf8")), { reason: "migration-rollback-copy", skipBackup: true });
    const records = [];
    copyDirectory(legacyDataDir, paths.data, records, new Set(["wake-v6-store.json", "generated-images", "exports", "snapshots", "image-generation-settings.json"]));
    migration = {
      schemaVersion: 1,
      status: "complete",
      migratedAt: new Date().toISOString(),
      legacyDataDir,
      dataDir: paths.data,
      rollbackPath,
      rollbackSha256: hashFile(rollbackPath),
      files: records
    };
    writeJsonDurable(markerPath, migration, { reason: "runtime-migration-marker" });
  }
  return { paths, migration, markerPath };
}

export function rollbackRuntimeMigration({ userDataDir } = {}) {
  const markerPath = path.join(userDataDir, "migration-v1.json");
  if (!fs.existsSync(markerPath)) return { rolledBack: false, reason: "migration marker not found" };
  const migration = readJsonDurable(markerPath, null);
  if (!migration || typeof migration !== "object") return { rolledBack: false, reason: "migration marker is invalid" };
  if (!migration.rollbackPath || !fs.existsSync(migration.rollbackPath)) return { rolledBack: false, reason: "rollback copy not found" };
  const target = path.join(userDataDir, "data", "wake-v6-store.json");
  const restoredValue = readJsonDurable(migration.rollbackPath, null);
  createWakeStateStore(target, { defaultValue: restoredValue }).write(restoredValue, { reason: "runtime-migration-rollback" });
  const result = { rolledBack: true, restoredAt: new Date().toISOString(), rollbackPath: migration.rollbackPath, target, sha256: hashFile(target) };
  writeJsonDurable(markerPath, { ...migration, rollback: result }, { reason: "runtime-migration-rollback-marker" });
  return result;
}
