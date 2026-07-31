#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WAL_RECOVERY_BOUNDARIES, WAL_ROLLBACK_BOUNDARIES, WAL_WRITE_BOUNDARIES } from "../server/durable-storage.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = path.join(ROOT, "scripts", "wal-crash-worker.mjs");
const RUN_DIR = path.join(ROOT, ".wal-crash-audit");
const OUT_DIR = path.join(ROOT, "phase-audit", "phase-09-durability-security");
const BASELINE_DIR = path.join(RUN_DIR, "baseline");
const results = [];

fs.rmSync(RUN_DIR, { recursive: true, force: true });
fs.mkdirSync(RUN_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

function run(operation, directory, crashPoint = "") {
  return spawnSync(process.execPath, [WORKER, operation, directory, crashPoint], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000
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

const seeded = run("seed", BASELINE_DIR);
if (seeded.status !== 0) throw new Error(`WAL baseline failed: ${seeded.stderr || seeded.stdout}`);

const pendingWriteIndex = WAL_WRITE_BOUNDARIES.indexOf("journal-pending:after-write");
const pendingDurableIndex = WAL_WRITE_BOUNDARIES.indexOf("journal-pending:after-fsync");
for (const [index, boundary] of WAL_WRITE_BOUNDARIES.entries()) {
  const caseDir = path.join(RUN_DIR, "write", boundary.replaceAll(":", "_"));
  clone(BASELINE_DIR, caseDir);
  const crashed = run("write", caseDir, boundary);
  const recoveredProcess = run("recover", caseDir);
  const recovered = parseRecovery(recoveredProcess);
  const acceptedRevisions = index < pendingWriteIndex ? [1] : index < pendingDurableIndex ? [1, 2] : [2];
  const terminal = recovered ? terminalForLatestTransaction(recovered.journal) : null;
  const passed = crashed.status === 86
    && recoveredProcess.status === 0
    && acceptedRevisions.includes(recovered?.value?.revision)
    && recovered?.integrity === true
    && recovered?.status?.pendingTransactions === 0
    && recovered?.transactionFiles?.length === 0
    && (recovered?.value?.revision === 1 || terminal?.status === "recovered-commit" || terminal?.status === "committed");
  results.push({ kind: "write-boundary", boundary, acceptedRevisions, crashExit: crashed.status, recoveryExit: recoveredProcess.status, recoveredRevision: recovered?.value?.revision ?? null, terminalStatus: terminal?.status || null, integrity: recovered?.integrity === true, pendingTransactions: recovered?.status?.pendingTransactions ?? null, transactionFiles: recovered?.transactionFiles || [], passed });
}

const pendingTemplate = path.join(RUN_DIR, "pending-template");
clone(BASELINE_DIR, pendingTemplate);
const pendingCrash = run("write", pendingTemplate, "journal-pending:after-fsync");
if (pendingCrash.status !== 86) throw new Error(`Could not create pending WAL fixture; exit ${pendingCrash.status}.`);

for (const boundary of WAL_RECOVERY_BOUNDARIES) {
  const caseDir = path.join(RUN_DIR, "recovery", boundary.replaceAll(":", "_"));
  clone(pendingTemplate, caseDir);
  const crashedRecovery = run("recover", caseDir, boundary);
  const finalRecoveryProcess = run("recover", caseDir);
  const recovered = parseRecovery(finalRecoveryProcess);
  const terminal = recovered ? terminalForLatestTransaction(recovered.journal) : null;
  const passed = crashedRecovery.status === 86
    && finalRecoveryProcess.status === 0
    && recovered?.value?.revision === 2
    && recovered?.integrity === true
    && recovered?.status?.pendingTransactions === 0
    && recovered?.transactionFiles?.length === 0
    && ["recovered-commit", "committed"].includes(terminal?.status);
  results.push({ kind: "recovery-boundary", boundary, crashExit: crashedRecovery.status, recoveryExit: finalRecoveryProcess.status, recoveredRevision: recovered?.value?.revision ?? null, terminalStatus: terminal?.status || null, integrity: recovered?.integrity === true, pendingTransactions: recovered?.status?.pendingTransactions ?? null, transactionFiles: recovered?.transactionFiles || [], passed });
}

const rollbackTemplate = path.join(RUN_DIR, "rollback-template");
clone(pendingTemplate, rollbackTemplate);
const rollbackTransactionDir = path.join(rollbackTemplate, "journal", "transactions");
for (const name of fs.readdirSync(rollbackTransactionDir)) fs.rmSync(path.join(rollbackTransactionDir, name), { force: true });
fs.writeFileSync(path.join(rollbackTemplate, "state.json"), `${JSON.stringify({ revision: 99, marker: "foreign-partial-state" }, null, 2)}\n`, "utf8");

for (const boundary of WAL_ROLLBACK_BOUNDARIES) {
  const caseDir = path.join(RUN_DIR, "rollback", boundary.replaceAll(":", "_"));
  clone(rollbackTemplate, caseDir);
  const crashedRollback = run("recover", caseDir, boundary);
  const finalRecoveryProcess = run("recover", caseDir);
  const recovered = parseRecovery(finalRecoveryProcess);
  const terminal = recovered ? terminalForLatestTransaction(recovered.journal) : null;
  const passed = crashedRollback.status === 86
    && finalRecoveryProcess.status === 0
    && recovered?.value?.revision === 1
    && recovered?.integrity === true
    && recovered?.status?.pendingTransactions === 0
    && recovered?.transactionFiles?.length === 0
    && terminal?.status === "rolled-back";
  results.push({ kind: "rollback-boundary", boundary, crashExit: crashedRollback.status, recoveryExit: finalRecoveryProcess.status, recoveredRevision: recovered?.value?.revision ?? null, terminalStatus: terminal?.status || null, integrity: recovered?.integrity === true, pendingTransactions: recovered?.status?.pendingTransactions ?? null, transactionFiles: recovered?.transactionFiles || [], passed });
}

const failed = results.filter((result) => !result.passed);
const verdict = {
  audit: "wal-crash-replay",
  status: failed.length ? "fail" : "pass",
  generatedAt: new Date().toISOString(),
  writeBoundaries: WAL_WRITE_BOUNDARIES.length,
  recoveryBoundaries: WAL_RECOVERY_BOUNDARIES.length,
  rollbackBoundaries: WAL_ROLLBACK_BOUNDARIES.length,
  totalBoundaries: results.length,
  passed: results.length - failed.length,
  failed: failed.map((result) => result.boundary),
  results
};
fs.writeFileSync(path.join(OUT_DIR, "wal-crash-verdict.json"), `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(OUT_DIR, failed.length ? "WAL_CRASH_BLOCKED.md" : "WAL_CRASH_COMPLETE.md"), [
  `# WAL Crash Audit ${failed.length ? "Blocked" : "Complete"}`,
  "",
  `Status: ${verdict.status}`,
  `Durable boundaries: ${verdict.passed}/${verdict.totalBoundaries}`,
  "",
  ...(failed.length ? failed.map((result) => `- ${result.kind}: ${result.boundary}`) : ["- Every write and recovery boundary recovered to an integrity-verified terminal state."])
].join("\n"), "utf8");

for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"} ${result.kind} ${result.boundary}`);
console.log(`WAL crash audit: ${verdict.status} (${verdict.passed}/${verdict.totalBoundaries})`);
fs.rmSync(RUN_DIR, { recursive: true, force: true });
if (failed.length) process.exit(1);
