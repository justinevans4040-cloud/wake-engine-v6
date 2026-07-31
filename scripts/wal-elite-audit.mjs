#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WAL_COMPACTION_BOUNDARIES,
  WAL_IO_BOUNDARIES,
  WAL_RECOVERY_BOUNDARIES,
  WAL_ROLLBACK_BOUNDARIES,
  WAL_TAIL_REPAIR_BOUNDARIES,
  WAL_WRITE_BOUNDARIES,
  fileHash
} from "../server/durable-storage.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = path.join(ROOT, "scripts", "wal-crash-worker.mjs");
const RUN_DIR = path.join(ROOT, ".wal-elite-audit");
const OUT_DIR = path.join(ROOT, "phase-audit", "phase-09-durability-security");
const BASELINE_DIR = path.join(RUN_DIR, "baseline");
const results = [];

fs.rmSync(RUN_DIR, { recursive: true, force: true });
fs.mkdirSync(RUN_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

function run(operation, directory, point = "", mode = "exit", count = 0, timeout = 120_000) {
  return spawnSync(process.execPath, [WORKER, operation, directory, point, mode, String(count)], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout
  });
}

function clone(source, target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, { recursive: true });
}

function parseRecovery(result) {
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function terminalForLatestTransaction(journal) {
  const pending = [...journal].reverse().find((record) => record.status === "pending" && record.reason === "crash-audit");
  if (!pending) return null;
  return [...journal].reverse().find((record) => record.transactionId === pending.transactionId && ["committed", "recovered-commit", "rolled-back"].includes(record.status)) || null;
}

function preparePending(source, target) {
  clone(source, target);
  const pending = run("write", target, "journal-pending:after-fsync");
  if (pending.status !== 86) throw new Error(`Pending fixture failed with exit ${pending.status}.`);
}

function prepareRollback(source, target, corruptStage = false) {
  preparePending(source, target);
  const transactionDir = path.join(target, "journal", "transactions");
  for (const name of fs.readdirSync(transactionDir)) {
    const filePath = path.join(transactionDir, name);
    if (corruptStage) fs.writeFileSync(filePath, "{truncated", "utf8");
    else fs.rmSync(filePath, { force: true });
  }
  fs.writeFileSync(path.join(target, "state.json"), `${JSON.stringify({ revision: 99, marker: "foreign-partial-state" }, null, 2)}\n`, "utf8");
}

function killOnMarker(operation, directory, point, marker) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [WORKER, operation, directory, point, "external", "0"], { cwd: ROOT, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let reached = false;
    const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (!reached && stdout.includes(marker)) {
        reached = true;
        child.kill("SIGKILL");
      }
    });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ reached, code, signal, stdout, stderr, terminated: reached && (code !== 0 || signal) });
    });
  });
}

function integrityState(directory) {
  const storePath = path.join(directory, "state.json");
  const payload = fs.readFileSync(storePath);
  const hash = fs.readFileSync(`${storePath}.sha256`, "utf8").trim();
  const metadata = JSON.parse(fs.readFileSync(`${storePath}.meta.json`, "utf8"));
  return { hash, valid: hash === fileHash(payload) && metadata.sha256 === hash };
}

function add(name, passed, details = {}) {
  results.push({ name, passed: Boolean(passed), ...details });
}

const seeded = run("seed", BASELINE_DIR);
if (seeded.status !== 0) throw new Error(`Elite WAL baseline failed: ${seeded.stderr || seeded.stdout}`);

const pendingTemplate = path.join(RUN_DIR, "pending-template");
preparePending(BASELINE_DIR, pendingTemplate);
const rollbackTemplate = path.join(RUN_DIR, "rollback-template");
prepareRollback(BASELINE_DIR, rollbackTemplate);

const pendingWriteIndex = WAL_WRITE_BOUNDARIES.indexOf("journal-pending:after-write");
const pendingDurableIndex = WAL_WRITE_BOUNDARIES.indexOf("journal-pending:after-fsync");
for (const [index, boundary] of WAL_WRITE_BOUNDARIES.entries()) {
  const caseDir = path.join(RUN_DIR, "external-write", boundary.replaceAll(":", "_"));
  clone(BASELINE_DIR, caseDir);
  const killed = await killOnMarker("write", caseDir, boundary, `BOUNDARY:${boundary}`);
  const recoveryProcess = run("recover", caseDir);
  const recovered = parseRecovery(recoveryProcess);
  const accepted = index < pendingWriteIndex ? [1] : index < pendingDurableIndex ? [1, 2] : [2];
  add(`external-write:${boundary}`, killed.terminated && recoveryProcess.status === 0 && accepted.includes(recovered?.value?.revision) && recovered?.integrity === true && recovered?.status?.pendingTransactions === 0, { killed, revision: recovered?.value?.revision, accepted });
}

for (const boundary of WAL_RECOVERY_BOUNDARIES) {
  const caseDir = path.join(RUN_DIR, "external-replay", boundary.replaceAll(":", "_"));
  clone(pendingTemplate, caseDir);
  const killed = await killOnMarker("recover", caseDir, boundary, `BOUNDARY:${boundary}`);
  const recoveryProcess = run("recover", caseDir);
  const recovered = parseRecovery(recoveryProcess);
  add(`external-replay:${boundary}`, killed.terminated && recovered?.value?.revision === 2 && recovered?.integrity === true && recovered?.status?.pendingTransactions === 0, { killed, revision: recovered?.value?.revision });
}

for (const boundary of WAL_ROLLBACK_BOUNDARIES) {
  const caseDir = path.join(RUN_DIR, "external-rollback", boundary.replaceAll(":", "_"));
  clone(rollbackTemplate, caseDir);
  const killed = await killOnMarker("recover", caseDir, boundary, `BOUNDARY:${boundary}`);
  const recoveryProcess = run("recover", caseDir);
  const recovered = parseRecovery(recoveryProcess);
  add(`external-rollback:${boundary}`, killed.terminated && recovered?.value?.revision === 1 && recovered?.integrity === true && recovered?.status?.pendingTransactions === 0, { killed, revision: recovered?.value?.revision });
}

for (const boundary of WAL_COMPACTION_BOUNDARIES) {
  const caseDir = path.join(RUN_DIR, "compaction-crash", boundary.replaceAll(":", "_"));
  clone(BASELINE_DIR, caseDir);
  const killed = await killOnMarker("compact-write", caseDir, boundary, `BOUNDARY:${boundary}`);
  const recovered = parseRecovery(run("recover", caseDir));
  add(`compaction-crash:${boundary}`, killed.terminated && recovered?.value?.revision === 2 && recovered?.integrity === true && recovered?.status?.pendingTransactions === 0, { killed, revision: recovered?.value?.revision, journalHealth: recovered?.status?.journalHealth });
}

for (const boundary of WAL_TAIL_REPAIR_BOUNDARIES) {
  const caseDir = path.join(RUN_DIR, "tail-repair-crash", boundary.replaceAll(":", "_"));
  clone(BASELINE_DIR, caseDir);
  fs.appendFileSync(path.join(caseDir, "journal", "state.json.ndjson"), "{\"walVersion\":3", "utf8");
  const killed = await killOnMarker("recover", caseDir, boundary, `BOUNDARY:${boundary}`);
  const recovered = parseRecovery(run("recover", caseDir));
  add(`tail-repair-crash:${boundary}`, killed.terminated && recovered?.value?.revision === 1 && recovered?.integrity === true && recovered?.status?.pendingTransactions === 0, { killed, revision: recovered?.value?.revision });
}

for (const mode of ["io-disk-full", "io-permission"]) {
  for (const boundary of WAL_IO_BOUNDARIES) {
    const caseDir = path.join(RUN_DIR, mode, boundary.replaceAll(":", "_"));
    let operation = "write";
    if (boundary.startsWith("recovery-") || boundary.startsWith("journal-recovered")) clone(pendingTemplate, caseDir);
    else if (boundary.startsWith("rollback-") || boundary.startsWith("journal-rolled")) clone(rollbackTemplate, caseDir);
    else if (boundary.startsWith("journal-compaction")) {
      clone(BASELINE_DIR, caseDir);
      operation = "compact-write";
    } else if (boundary.startsWith("journal-tail-repair")) {
      clone(BASELINE_DIR, caseDir);
      fs.appendFileSync(path.join(caseDir, "journal", "state.json.ndjson"), "{\"walVersion\":3", "utf8");
      operation = "recover";
    } else clone(BASELINE_DIR, caseDir);
    if (boundary.startsWith("recovery-") || boundary.startsWith("rollback-") || boundary.startsWith("journal-recovered") || boundary.startsWith("journal-rolled")) operation = "recover";
    const failedWrite = run(operation, caseDir, boundary, mode);
    const recovered = parseRecovery(run("recover", caseDir));
    const expectsRollback = boundary.startsWith("rollback-") || boundary.startsWith("journal-rolled");
    const prePending = ["stage:before-write", "backup:before-write", "journal-pending:before-write", "journal-tail-repair:before-write"].includes(boundary);
    const expectedRevision = expectsRollback || prePending ? 1 : 2;
    add(`${mode}:${boundary}`, failedWrite.status !== 0 && recovered?.value?.revision === expectedRevision && recovered?.integrity === true && recovered?.status?.pendingTransactions === 0, { failureExit: failedWrite.status, revision: recovered?.value?.revision, expectedRevision });
  }
}

const middleCorruption = path.join(RUN_DIR, "middle-corruption");
clone(BASELINE_DIR, middleCorruption);
const middleJournal = path.join(middleCorruption, "journal", "state.json.ndjson");
const middleLines = fs.readFileSync(middleJournal, "utf8").trim().split("\n");
const tampered = JSON.parse(middleLines[Math.min(1, middleLines.length - 1)]);
tampered.reason = "tampered-without-rehash";
middleLines[Math.min(1, middleLines.length - 1)] = JSON.stringify(tampered);
fs.writeFileSync(middleJournal, `${middleLines.join("\n")}\n`, "utf8");
const beforeCorruptionHash = integrityState(middleCorruption).hash;
const blockedCorruption = run("recover", middleCorruption);
add("hash-chain-middle-corruption-blocked", blockedCorruption.status !== 0 && integrityState(middleCorruption).hash === beforeCorruptionHash, { exit: blockedCorruption.status, stderr: blockedCorruption.stderr.slice(0, 500) });

const downgradeCorruption = path.join(RUN_DIR, "chain-downgrade");
clone(BASELINE_DIR, downgradeCorruption);
fs.appendFileSync(path.join(downgradeCorruption, "journal", "state.json.ndjson"), `${JSON.stringify({ status: "committed", transactionId: "legacy-injection" })}\n`, "utf8");
const blockedDowngrade = run("recover", downgradeCorruption);
add("hash-chain-downgrade-blocked", blockedDowngrade.status !== 0, { exit: blockedDowngrade.status, stderr: blockedDowngrade.stderr.slice(0, 500) });

const tornTail = path.join(RUN_DIR, "torn-tail");
clone(BASELINE_DIR, tornTail);
fs.appendFileSync(path.join(tornTail, "journal", "state.json.ndjson"), "{\"status\":\"pending\"", "utf8");
const repairedTail = parseRecovery(run("recover", tornTail));
add("torn-tail-repaired", repairedTail?.value?.revision === 1 && repairedTail?.integrity === true && fs.readFileSync(path.join(tornTail, "journal", "state.json.ndjson"), "utf8").endsWith("\n"), { journalHealth: repairedTail?.status?.journalHealth });

const corruptStage = path.join(RUN_DIR, "corrupt-stage");
prepareRollback(BASELINE_DIR, corruptStage, true);
const corruptStageRecovery = parseRecovery(run("recover", corruptStage));
add("short-stage-write-rolls-back", corruptStageRecovery?.value?.revision === 1 && corruptStageRecovery?.integrity === true && terminalForLatestTransaction(corruptStageRecovery?.journal || [])?.status === "rolled-back", { revision: corruptStageRecovery?.value?.revision });

const unrecoverable = path.join(RUN_DIR, "unrecoverable-transaction");
prepareRollback(BASELINE_DIR, unrecoverable, true);
const unrecoverableJournal = fs.readFileSync(path.join(unrecoverable, "journal", "state.json.ndjson"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
const unresolvedPending = [...unrecoverableJournal].reverse().find((record) => record.status === "pending" && record.reason === "crash-audit");
if (unresolvedPending?.backup) fs.writeFileSync(path.join(unrecoverable, "backups", "automatic", path.basename(unresolvedPending.backup)), "{corrupt", "utf8");
const blockedUnrecoverable = run("recover", unrecoverable);
add("unrecoverable-wal-blocks-fallback", blockedUnrecoverable.status !== 0 && blockedUnrecoverable.stderr.includes("could not verify replay or rollback"), { exit: blockedUnrecoverable.status, stderr: blockedUnrecoverable.stderr.slice(0, 500) });

const compactStress = path.join(RUN_DIR, "compaction-stress");
clone(BASELINE_DIR, compactStress);
const compactStressRun = run("compact-stress", compactStress, "", "exit", 500, 240_000);
const compactStressRecovery = parseRecovery(run("recover", compactStress));
const compactJournalRecords = fs.readFileSync(path.join(compactStress, "journal", "state.json.ndjson"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
add("checkpoint-compaction-stress", compactStressRun.status === 0 && compactStressRecovery?.value?.counter === 500 && compactStressRecovery?.integrity === true && compactJournalRecords[0]?.status === "checkpoint" && compactJournalRecords.length < 20, { exit: compactStressRun.status, records: compactJournalRecords.length, counter: compactStressRecovery?.value?.counter });

const staleLock = path.join(RUN_DIR, "stale-lock");
clone(BASELINE_DIR, staleLock);
const killedLockOwner = await killOnMarker("hold-lock", staleLock, "", "LOCKED");
const staleLockRecovery = parseRecovery(run("recover", staleLock));
add("stale-process-lock-recovered", killedLockOwner.terminated && staleLockRecovery?.value?.revision === 1 && staleLockRecovery?.integrity === true && !fs.existsSync(path.join(staleLock, "state.json.lock")), { killedLockOwner });

const concurrentDir = path.join(RUN_DIR, "multi-process");
clone(BASELINE_DIR, concurrentDir);
const writers = Array.from({ length: 5 }, () => new Promise((resolve) => {
  const child = spawn(process.execPath, [WORKER, "increment", concurrentDir, "", "exit", "200"], { cwd: ROOT, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.on("close", (code) => resolve({ code, stderr }));
}));
const writerResults = await Promise.all(writers);
const concurrentRecovery = parseRecovery(run("recover", concurrentDir, "", "exit", 0, 240_000));
add("multi-process-thousand-mutation-stress", writerResults.every((item) => item.code === 0) && concurrentRecovery?.value?.counter === 1000 && concurrentRecovery?.integrity === true && concurrentRecovery?.status?.pendingTransactions === 0, { writers: writerResults, counter: concurrentRecovery?.value?.counter });

const largeState = path.join(RUN_DIR, "large-state-crash");
clone(BASELINE_DIR, largeState);
const killedLargeWrite = await killOnMarker("large-write", largeState, "primary:after-previous-rename", "BOUNDARY:primary:after-previous-rename");
const largeRecovery = parseRecovery(run("recover-summary", largeState, "", "exit", 0, 240_000));
add("production-scale-large-state-replay", killedLargeWrite.terminated && largeRecovery?.value?.revision === 2 && largeRecovery?.value?.payloadLength === 2_500_000 && largeRecovery?.integrity === true, { killedLargeWrite, value: largeRecovery?.value });

const artifactScope = path.join(RUN_DIR, "artifact-json-scope");
const artifactSeed = run("artifact-seed", artifactScope);
const killedArtifactWrite = artifactSeed.status === 0
  ? await killOnMarker("artifact-write", artifactScope, "primary:after-previous-rename", "BOUNDARY:primary:after-previous-rename")
  : { reached: false, terminated: false };
const artifactRecovery = parseRecovery(run("artifact-recover", artifactScope));
add("durable-json-artifact-tree-replay", artifactSeed.status === 0 && killedArtifactWrite.terminated && artifactRecovery?.value?.revision === 2 && artifactRecovery?.integrity === true && artifactRecovery?.recovered >= 1 && artifactRecovery?.status?.journal?.includes(`${path.sep}.wake-wal${path.sep}`), { seedExit: artifactSeed.status, killedArtifactWrite, recovery: artifactRecovery });

const failed = results.filter((result) => !result.passed);
const verdict = {
  audit: "wal-elite-production",
  status: failed.length ? "fail" : "pass",
  generatedAt: new Date().toISOString(),
  checks: results.length,
  passed: results.length - failed.length,
  failed: failed.map((result) => result.name),
  results
};
fs.writeFileSync(path.join(OUT_DIR, "wal-elite-verdict.json"), `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(OUT_DIR, failed.length ? "WAL_ELITE_BLOCKED.md" : "WAL_ELITE_COMPLETE.md"), [
  `# WAL Elite Audit ${failed.length ? "Blocked" : "Complete"}`,
  "",
  `Status: ${verdict.status}`,
  `Checks: ${verdict.passed}/${verdict.checks}`,
  "",
  ...(failed.length ? failed.map((result) => `- ${result.name}`) : ["- No failures."])
].join("\n"), "utf8");

for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"} ${result.name}`);
console.log(`WAL elite audit: ${verdict.status} (${verdict.passed}/${verdict.checks})`);
fs.rmSync(RUN_DIR, { recursive: true, force: true });
if (failed.length) process.exit(1);
