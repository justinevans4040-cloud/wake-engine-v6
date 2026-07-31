#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createDurableJsonFileStore, DurableJsonStore, fileHash, readJsonDurable, recoverDurableJsonTree } from "../server/durable-storage.js";

const [operation, rootDir, faultPoint = "", mode = "exit", countArgument = "0"] = process.argv.slice(2);
if (!operation || !rootDir) process.exit(2);

fs.mkdirSync(rootDir, { recursive: true });
const storePath = path.join(rootDir, "state.json");
function crashInjector(point) {
  if (point !== faultPoint) return;
  if (mode === "external") {
    process.stdout.write(`BOUNDARY:${point}\n`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120_000);
    process.exit(87);
  }
  if (mode === "throw") {
    const error = new Error(`Injected I/O interruption at ${point}`);
    error.code = "EIO";
    throw error;
  }
  process.exit(86);
}

function ioFaultInjector(point) {
  if (point !== faultPoint || !mode.startsWith("io-")) return;
  const error = new Error(`Injected ${mode.slice(3)} failure at ${point}`);
  error.code = mode === "io-disk-full" ? "WAKE_DISK_FULL" : mode === "io-permission" ? "EPERM" : "EIO";
  error.status = mode === "io-disk-full" ? 507 : 500;
  throw error;
}

const store = new DurableJsonStore(storePath, {
  defaultValue: { revision: 0, marker: "default" },
  retention: 8,
  journalCompactBytes: operation === "compact-write" ? 1 : operation === "compact-stress" ? 4096 : 4_000_000,
  lockTimeoutMs: 120_000,
  crashInjector,
  ioFaultInjector
});

const artifactPath = path.join(rootDir, "exports", "campaign.json");
const artifactStore = createDurableJsonFileStore(artifactPath, {
  defaultValue: { revision: 0, marker: "artifact-default" },
  crashInjector,
  ioFaultInjector,
  lockTimeoutMs: 120_000
});

if (operation === "artifact-seed") {
  artifactStore.write({ revision: 1, marker: "artifact-before-crash" }, { reason: "artifact-seed" });
  process.exit(0);
}

if (operation === "artifact-write") {
  artifactStore.write({ revision: 2, marker: "artifact-after-replay" }, { reason: "artifact-crash-audit" });
  process.exit(0);
}

if (operation === "artifact-recover") {
  const recovered = recoverDurableJsonTree(rootDir);
  const value = readJsonDurable(artifactPath, {});
  const status = artifactStore.status();
  const payload = fs.readFileSync(artifactPath);
  const hash = fs.readFileSync(status.metadata.replace(/\.meta\.json$/, ".sha256"), "utf8").trim();
  process.stdout.write(JSON.stringify({ value, status, recovered: recovered.length, integrity: hash === fileHash(payload) }));
  process.exit(0);
}

if (operation === "seed") {
  store.read();
  store.write({ revision: 1, marker: "committed-before-crash" }, { reason: "seed" });
  process.exit(0);
}

if (operation === "write" || operation === "compact-write") {
  store.write({ revision: 2, marker: "durable-after-replay" }, { reason: "crash-audit" });
  process.exit(0);
}

if (operation === "large-write") {
  store.write({ revision: 2, marker: "large-durable-after-replay", payload: "L".repeat(2_500_000) }, { reason: "crash-audit" });
  process.exit(0);
}

if (operation === "increment") {
  const count = Number(countArgument || 0);
  for (let index = 0; index < count; index += 1) {
    store.mutate((value) => ({ ...value, counter: Number(value.counter || 0) + 1, lastWriter: process.pid }), { reason: "multi-process-stress", skipBackup: true });
  }
  process.exit(0);
}

if (operation === "compact-stress") {
  const count = Number(countArgument || 0);
  for (let index = 0; index < count; index += 1) {
    store.write({ revision: index + 2, marker: "compaction-stress", counter: index + 1 }, { reason: "compaction-stress", skipBackup: true });
  }
  process.exit(0);
}

if (operation === "hold-lock") {
  const release = store.beginExclusiveMutation();
  process.stdout.write("LOCKED\n");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120_000);
  release();
  process.exit(0);
}

if (operation === "recover" || operation === "recover-summary") {
  const value = store.read();
  const payload = fs.readFileSync(storePath);
  const hash = fs.readFileSync(`${storePath}.sha256`, "utf8").trim();
  const metadata = JSON.parse(fs.readFileSync(`${storePath}.meta.json`, "utf8"));
  const journal = fs.readFileSync(path.join(rootDir, "journal", "state.json.ndjson"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const transactionFiles = fs.readdirSync(path.join(rootDir, "journal", "transactions"));
  process.stdout.write(JSON.stringify({
    value: operation === "recover-summary" ? { revision: value.revision, marker: value.marker, counter: value.counter, payloadLength: String(value.payload || "").length } : value,
    status: store.status(),
    integrity: hash === fileHash(payload) && metadata.sha256 === hash,
    journal,
    transactionFiles
  }));
  process.exit(0);
}

process.exit(2);
