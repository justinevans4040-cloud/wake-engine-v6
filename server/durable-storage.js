import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MIN_FREE_BYTES = 64 * 1024 * 1024;
const TERMINAL_WAL_STATES = new Set(["committed", "recovered-commit", "rolled-back"]);
const PROCESS_INSTANCE_ID = crypto.randomBytes(16).toString("hex");
const TRANSIENT_LOCK_ERRORS = new Set(["EACCES", "EBUSY", "EEXIST", "ENOTEMPTY", "EPERM"]);

const newFileBoundaries = (prefix) => ["after-temp-write", "after-temp-fsync", "after-final-rename", "after-final-fsync"].map((point) => `${prefix}:${point}`);
const replacementBoundaries = (prefix) => ["after-temp-write", "after-temp-fsync", "after-previous-rename", "after-final-rename", "after-final-fsync"].map((point) => `${prefix}:${point}`);
const journalBoundaries = (status) => [`journal-${status}:after-write`, `journal-${status}:after-fsync`];

export const WAL_WRITE_BOUNDARIES = Object.freeze([
  ...newFileBoundaries("stage"),
  ...newFileBoundaries("backup"),
  ...journalBoundaries("pending"),
  ...replacementBoundaries("primary"),
  ...replacementBoundaries("hash"),
  ...replacementBoundaries("metadata"),
  ...journalBoundaries("committed")
]);

export const WAL_RECOVERY_BOUNDARIES = Object.freeze([
  ...replacementBoundaries("recovery-primary"),
  ...replacementBoundaries("recovery-hash"),
  ...replacementBoundaries("recovery-metadata"),
  ...journalBoundaries("recovered-commit")
]);

export const WAL_ROLLBACK_BOUNDARIES = Object.freeze([
  ...replacementBoundaries("rollback-primary"),
  ...replacementBoundaries("rollback-hash"),
  ...replacementBoundaries("rollback-metadata"),
  ...journalBoundaries("rolled-back")
]);

export const WAL_COMPACTION_BOUNDARIES = Object.freeze(replacementBoundaries("journal-compaction"));
export const WAL_TAIL_REPAIR_BOUNDARIES = Object.freeze(replacementBoundaries("journal-tail-repair"));

export const WAL_IO_BOUNDARIES = Object.freeze([
  "stage:before-write",
  "backup:before-write",
  "journal-pending:before-write",
  "primary:before-write",
  "hash:before-write",
  "metadata:before-write",
  "journal-committed:before-write",
  "recovery-primary:before-write",
  "recovery-hash:before-write",
  "recovery-metadata:before-write",
  "journal-recovered-commit:before-write",
  "rollback-primary:before-write",
  "rollback-hash:before-write",
  "rollback-metadata:before-write",
  "journal-rolled-back:before-write",
  "journal-compaction:before-write",
  "journal-tail-repair:before-write"
]);

export function fileHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function ensureDiskCapacity(targetPath, requiredBytes = 0) {
  if (process.env.WAKE_TEST_FORCE_DISK_FULL === "1") {
    const error = new Error("Local storage is full. Wake preserved the existing data and stopped the write.");
    error.code = "WAKE_DISK_FULL";
    error.status = 507;
    throw error;
  }
  if (typeof fs.statfsSync !== "function") return;
  const stats = fs.statfsSync(path.dirname(targetPath));
  const available = Number(stats.bavail) * Number(stats.bsize);
  const needed = Math.max(MIN_FREE_BYTES, requiredBytes * 4);
  if (available < needed) {
    const error = new Error(`Local storage needs ${needed} bytes free before this write can continue.`);
    error.code = "WAKE_DISK_FULL";
    error.status = 507;
    throw error;
  }
}

function fsyncFile(filePath) {
  const descriptor = fs.openSync(filePath, "r+");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function fsyncDirectory(directory) {
  try {
    const descriptor = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  } catch {
    // Windows may reject directory fsync; payload and journal handles are still flushed directly.
  }
}

function emitBoundary(options, point, context = {}) {
  if (typeof options.onBoundary !== "function") return;
  const prefix = String(options.boundaryPrefix || "atomic");
  options.onBoundary(`${prefix}:${point}`, context);
}

export function writeFileAtomic(filePath, data, options = {}) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), options.encoding || "utf8");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  options.beforeWrite?.(`${String(options.boundaryPrefix || "atomic")}:before-write`, { filePath, bytes: payload.length });
  ensureDiskCapacity(filePath, payload.length);
  const transactionId = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
  const temporaryPath = `${filePath}.tmp-${transactionId}`;
  const previousPath = `${filePath}.previous`;
  const descriptor = fs.openSync(temporaryPath, "wx");
  try {
    fs.writeFileSync(descriptor, payload);
    emitBoundary(options, "after-temp-write", { filePath, temporaryPath, previousPath });
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  emitBoundary(options, "after-temp-fsync", { filePath, temporaryPath, previousPath });
  if (fileHash(fs.readFileSync(temporaryPath)) !== fileHash(payload)) {
    fs.rmSync(temporaryPath, { force: true });
    throw new Error(`Atomic write verification failed for ${path.basename(filePath)}.`);
  }
  fs.rmSync(previousPath, { force: true });
  if (fs.existsSync(filePath)) {
    fs.renameSync(filePath, previousPath);
    emitBoundary(options, "after-previous-rename", { filePath, temporaryPath, previousPath });
  }
  try {
    fs.renameSync(temporaryPath, filePath);
    emitBoundary(options, "after-final-rename", { filePath, temporaryPath, previousPath });
    fsyncFile(filePath);
    fsyncDirectory(path.dirname(filePath));
    emitBoundary(options, "after-final-fsync", { filePath, temporaryPath, previousPath });
    fs.rmSync(previousPath, { force: true });
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    if (!fs.existsSync(filePath) && fs.existsSync(previousPath)) fs.renameSync(previousPath, filePath);
    throw error;
  }
  return { transactionId, sha256: fileHash(payload), bytes: payload.length };
}

function readValidJson(filePath, expectedHash = null) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const payload = fs.readFileSync(filePath);
    const actualHash = fileHash(payload);
    if (expectedHash && expectedHash !== actualHash) return null;
    return { value: JSON.parse(payload.toString("utf8")), actualHash, payload };
  } catch {
    return null;
  }
}

function safeStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function readMetadata(filePath) {
  try {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : null;
  } catch {
    return null;
  }
}

function transactionStageName(transactionId) {
  return `${transactionId}.json`;
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function walRecordDigest(record) {
  const clean = { ...record };
  delete clean.recordHash;
  return fileHash(JSON.stringify(clean));
}

function sealWalRecord(record, previousRecord = null) {
  const sealed = {
    ...record,
    walVersion: 3,
    sequence: Number(previousRecord?.sequence || 0) + 1,
    previousRecordHash: previousRecord ? previousRecord.recordHash || walRecordDigest(previousRecord) : null
  };
  sealed.recordHash = walRecordDigest(sealed);
  return sealed;
}

export class DurableJsonStore {
  constructor(filePath, { defaultValue, backupDir, journalPath, transactionDir, hashPath, metaPath, lockPath, retention = 24, crashInjector = null, ioFaultInjector = null, journalCompactBytes = 4_000_000, lockTimeoutMs = 30_000 } = {}) {
    this.filePath = filePath;
    this.hashPath = hashPath || `${filePath}.sha256`;
    this.metaPath = metaPath || `${filePath}.meta.json`;
    this.backupDir = backupDir || path.join(path.dirname(filePath), "backups", "automatic");
    this.journalPath = journalPath || path.join(path.dirname(filePath), "journal", `${path.basename(filePath)}.ndjson`);
    this.transactionDir = transactionDir || path.join(path.dirname(this.journalPath), "transactions");
    this.defaultValue = structuredClone(defaultValue || {});
    this.retention = retention;
    this.crashInjector = crashInjector;
    this.ioFaultInjector = ioFaultInjector;
    this.journalCompactBytes = journalCompactBytes;
    this.lockTimeoutMs = lockTimeoutMs;
    this.lockPath = lockPath || `${filePath}.lock`;
    this.lockDepth = 0;
    this.lockNonce = null;
    this.lastRecovery = null;
    this.tornTailRecoveries = 0;
    this.journalHealth = { status: "unchecked", records: 0, tornTailRecovered: false, corruption: null };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
    fs.mkdirSync(path.dirname(this.journalPath), { recursive: true });
    fs.mkdirSync(this.transactionDir, { recursive: true });
    fs.mkdirSync(path.dirname(this.hashPath), { recursive: true });
    fs.mkdirSync(path.dirname(this.metaPath), { recursive: true });
    fs.mkdirSync(path.dirname(this.lockPath), { recursive: true });
  }

  boundary(point, context = {}) {
    this.crashInjector?.(point, context);
  }

  ioBoundary(point, context = {}) {
    this.ioFaultInjector?.(point, context);
  }

  atomicOptions(boundaryPrefix) {
    return {
      boundaryPrefix,
      beforeWrite: (point, context) => this.ioBoundary(point, context),
      onBoundary: (point, context) => this.boundary(point, context)
    };
  }

  acquireProcessLock() {
    if (this.lockDepth > 0) {
      this.lockDepth += 1;
      return;
    }
    const started = Date.now();
    const nonce = crypto.randomBytes(16).toString("hex");
    const ownerPath = path.join(this.lockPath, "owner.json");
    while (Date.now() - started < this.lockTimeoutMs) {
      try {
        fs.mkdirSync(this.lockPath);
        try {
          writeFileAtomic(ownerPath, `${JSON.stringify({ schemaVersion: 2, pid: process.pid, processInstanceId: PROCESS_INSTANCE_ID, nonce, acquiredAt: new Date().toISOString() })}\n`);
        } catch (error) {
          fs.rmSync(this.lockPath, { recursive: true, force: true });
          throw error;
        }
        this.lockNonce = nonce;
        this.lockDepth = 1;
        return;
      } catch (error) {
        if (!fs.existsSync(this.lockPath)) {
          if (!TRANSIENT_LOCK_ERRORS.has(error?.code)) throw error;
          sleepSync(10);
          continue;
        }
        let owner = null;
        let lockAgeMs = 0;
        try {
          const stat = fs.statSync(this.lockPath);
          lockAgeMs = Math.max(0, Date.now() - stat.mtimeMs);
          const readableOwnerPath = stat.isDirectory() ? ownerPath : this.lockPath;
          owner = JSON.parse(fs.readFileSync(readableOwnerPath, "utf8"));
        } catch {
          owner = null;
        }
        const recycledCurrentPid = Number(owner?.pid) === process.pid && owner?.processInstanceId !== PROCESS_INSTANCE_ID;
        const abandoned = owner
          ? recycledCurrentPid || !processIsAlive(Number(owner.pid))
          : lockAgeMs > Math.max(5_000, this.lockTimeoutMs);
        if (abandoned) {
          try {
            fs.rmSync(this.lockPath, { recursive: true, force: true });
          } catch {
            // A competing process may have replaced or acquired the lock first.
          }
          continue;
        }
        sleepSync(10);
      }
    }
    const error = new Error(`Timed out waiting for the local state lock: ${this.lockPath}`);
    error.code = "WAKE_STORE_LOCK_TIMEOUT";
    error.status = 503;
    throw error;
  }

  releaseProcessLock() {
    if (this.lockDepth <= 0) return;
    this.lockDepth -= 1;
    if (this.lockDepth > 0) return;
    try {
      const stat = fs.statSync(this.lockPath);
      const ownerPath = stat.isDirectory() ? path.join(this.lockPath, "owner.json") : this.lockPath;
      const owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
      if (owner?.nonce === this.lockNonce && Number(owner?.pid) === process.pid) fs.rmSync(this.lockPath, { recursive: true, force: true });
    } catch {
      // A missing lock already represents a released lock.
    }
    this.lockNonce = null;
  }

  withProcessLock(operation) {
    this.acquireProcessLock();
    try {
      return operation();
    } finally {
      this.releaseProcessLock();
    }
  }

  beginExclusiveMutation() {
    this.acquireProcessLock();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.releaseProcessLock();
    };
  }

  restoreInterruptedJournalReplacement() {
    if (fs.existsSync(this.journalPath)) return;
    const previousPath = `${this.journalPath}.previous`;
    if (fs.existsSync(previousPath)) {
      fs.renameSync(previousPath, this.journalPath);
      fsyncFile(this.journalPath);
      return;
    }
    const directory = path.dirname(this.journalPath);
    const prefix = `${path.basename(this.journalPath)}.tmp-`;
    const temporary = fs.readdirSync(directory)
      .filter((name) => name.startsWith(prefix))
      .map((name) => ({ name, time: fs.statSync(path.join(directory, name)).mtimeMs }))
      .sort((a, b) => b.time - a.time)[0];
    if (temporary) {
      fs.renameSync(path.join(directory, temporary.name), this.journalPath);
      fsyncFile(this.journalPath);
    }
  }

  readJournalRecords() {
    this.restoreInterruptedJournalReplacement();
    if (!fs.existsSync(this.journalPath)) {
      this.journalHealth = { status: "clean", records: 0, tornTailRecovered: false, corruption: null };
      return [];
    }
    const raw = fs.readFileSync(this.journalPath, "utf8");
    const lines = raw.split("\n");
    const records = [];
    let previous = null;
    let sawHashedRecord = false;
    let tornTailRecovered = false;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        const isTornTail = index === lines.length - 1 && !raw.endsWith("\n");
        if (isTornTail) {
          const repaired = records.length ? `${records.map((item) => JSON.stringify(item)).join("\n")}\n` : "";
          writeFileAtomic(this.journalPath, repaired, this.atomicOptions("journal-tail-repair"));
          tornTailRecovered = true;
          this.tornTailRecoveries += 1;
          break;
        }
        const error = new Error(`Write-ahead log corruption at record ${index + 1}.`);
        error.code = "WAKE_WAL_CORRUPT";
        error.status = 500;
        this.journalHealth = { status: "corrupt", records: records.length, tornTailRecovered: false, corruption: { record: index + 1, reason: "invalid-json" } };
        throw error;
      }
      if (record.walVersion === 3) {
        sawHashedRecord = true;
        const expectedPreviousHash = previous ? previous.recordHash || walRecordDigest(previous) : null;
        const valid = record.previousRecordHash === expectedPreviousHash
          && record.recordHash === walRecordDigest(record)
          && Number(record.sequence) === Number(previous?.sequence || 0) + 1;
        if (!valid) {
          const error = new Error(`Write-ahead log hash-chain verification failed at record ${index + 1}.`);
          error.code = "WAKE_WAL_CORRUPT";
          error.status = 500;
          this.journalHealth = { status: "corrupt", records: records.length, tornTailRecovered: false, corruption: { record: index + 1, reason: "hash-chain" } };
          throw error;
        }
      } else if (sawHashedRecord) {
        const error = new Error(`Legacy write-ahead record appeared after the protected hash chain at record ${index + 1}.`);
        error.code = "WAKE_WAL_CORRUPT";
        error.status = 500;
        this.journalHealth = { status: "corrupt", records: records.length, tornTailRecovered: false, corruption: { record: index + 1, reason: "chain-downgrade" } };
        throw error;
      }
      records.push(record);
      previous = record;
    }
    this.journalHealth = { status: tornTailRecovered ? "repaired-torn-tail" : "clean", records: records.length, tornTailRecovered, tornTailRecoveries: this.tornTailRecoveries, corruption: null };
    return records;
  }

  appendJournal(record) {
    const records = this.readJournalRecords();
    const sealed = sealWalRecord(record, records.at(-1) || null);
    const line = `${JSON.stringify(sealed)}\n`;
    this.ioBoundary(`journal-${record.status}:before-write`, { transactionId: record.transactionId, journalPath: this.journalPath });
    ensureDiskCapacity(this.journalPath, Buffer.byteLength(line));
    const descriptor = fs.openSync(this.journalPath, "a");
    try {
      fs.writeFileSync(descriptor, line, "utf8");
      this.boundary(`journal-${record.status}:after-write`, { transactionId: record.transactionId, journalPath: this.journalPath });
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    this.boundary(`journal-${record.status}:after-fsync`, { transactionId: record.transactionId, journalPath: this.journalPath });
    if (fs.statSync(this.journalPath).size > this.journalCompactBytes) this.compactJournal();
    return sealed;
  }

  compactJournal() {
    const records = this.readJournalRecords();
    const terminal = new Set(records.filter((record) => TERMINAL_WAL_STATES.has(record.status)).map((record) => record.transactionId));
    const activeIds = new Set(records.filter((record) => record.status === "pending" && !terminal.has(record.transactionId)).map((record) => record.transactionId));
    const activePending = records.filter((record) => record.status === "pending" && activeIds.has(record.transactionId));
    const compacted = [];
    compacted.push(sealWalRecord({
      status: "checkpoint",
      compactedRecords: records.length,
      compactedTailHash: records.at(-1)?.recordHash || (records.length ? walRecordDigest(records.at(-1)) : null),
      activeTransactions: activePending.map((record) => record.transactionId),
      checkpointedAt: new Date().toISOString()
    }));
    for (const pending of activePending) {
      const clean = { ...pending };
      delete clean.walVersion;
      delete clean.sequence;
      delete clean.previousRecordHash;
      delete clean.recordHash;
      compacted.push(sealWalRecord(clean, compacted.at(-1)));
    }
    writeFileAtomic(this.journalPath, `${compacted.map((record) => JSON.stringify(record)).join("\n")}\n`, this.atomicOptions("journal-compaction"));
    this.journalHealth = { status: "compacted", records: compacted.length, tornTailRecovered: false, corruption: null };
  }

  rotateBackups() {
    const files = fs.readdirSync(this.backupDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => ({ name, time: fs.statSync(path.join(this.backupDir, name)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    for (const item of files.slice(this.retention)) fs.rmSync(path.join(this.backupDir, item.name), { force: true });
  }

  createAutomaticBackup({ boundaryPrefix = "backup" } = {}) {
    const current = readValidJson(this.filePath);
    if (!current) return null;
    const fileName = `${path.basename(this.filePath, ".json")}_${safeStamp()}_${current.actualHash.slice(0, 12)}.json`;
    const backupPath = path.join(this.backupDir, fileName);
    writeFileAtomic(backupPath, current.payload, this.atomicOptions(boundaryPrefix));
    this.rotateBackups();
    return { fileName, path: backupPath, sha256: current.actualHash };
  }

  walState() {
    const records = this.readJournalRecords();
    const transactions = new Map();
    for (const record of records) {
      if (!record.transactionId) continue;
      const transaction = transactions.get(record.transactionId) || { pending: null, terminal: null, records: [] };
      transaction.records.push(record);
      if (record.status === "pending") transaction.pending = record;
      if (TERMINAL_WAL_STATES.has(record.status)) transaction.terminal = record;
      transactions.set(record.transactionId, transaction);
    }
    return { records, transactions };
  }

  recoverPendingTransaction(pending) {
    const transactionId = String(pending.transactionId || "");
    const newHash = String(pending.newHash || pending.sha256 || "");
    const previousHash = String(pending.previousHash || "");
    const stageFile = path.basename(String(pending.stageFile || ""));
    const stagePath = stageFile ? path.join(this.transactionDir, stageFile) : null;
    const stage = stagePath ? readValidJson(stagePath, newHash) : null;
    const primary = readValidJson(this.filePath);
    const replayPayload = stage?.payload || (primary?.actualHash === newHash ? primary.payload : null);

    if (replayPayload) {
      if (primary?.actualHash !== newHash) writeFileAtomic(this.filePath, replayPayload, this.atomicOptions("recovery-primary"));
      writeFileAtomic(this.hashPath, `${newHash}\n`, this.atomicOptions("recovery-hash"));
      writeFileAtomic(this.metaPath, `${JSON.stringify({
        schemaVersion: 1,
        version: Number(pending.version || 0),
        transactionId,
        sha256: newHash,
        reason: pending.reason || "recovered-transaction",
        recovered: true,
        updatedAt: new Date().toISOString()
      }, null, 2)}\n`, this.atomicOptions("recovery-metadata"));
      this.appendJournal({
        transactionId,
        version: Number(pending.version || 0),
        status: "recovered-commit",
        reason: pending.reason || "recovered-transaction",
        sha256: newHash,
        recoveredAt: new Date().toISOString()
      });
      if (stagePath) fs.rmSync(stagePath, { force: true });
      return { status: "recovered", source: "write-ahead-log-replay", transactionId, sha256: newHash, at: new Date().toISOString() };
    }

    const backupName = path.basename(String(pending.backup || ""));
    const backupPath = backupName ? path.join(this.backupDir, backupName) : null;
    const rollback = primary?.actualHash === previousHash
      ? primary
      : backupPath
        ? readValidJson(backupPath, previousHash || null)
        : readValidJson(`${this.filePath}.previous`, previousHash || null);
    if (!rollback) return null;
    if (primary?.actualHash !== rollback.actualHash) writeFileAtomic(this.filePath, rollback.payload, this.atomicOptions("rollback-primary"));
    writeFileAtomic(this.hashPath, `${rollback.actualHash}\n`, this.atomicOptions("rollback-hash"));
    writeFileAtomic(this.metaPath, `${JSON.stringify({
      schemaVersion: 1,
      version: Math.max(0, Number(pending.version || 1) - 1),
      transactionId: `rollback-${transactionId}`,
      sha256: rollback.actualHash,
      reason: "wal-rollback",
      rolledBackTransactionId: transactionId,
      updatedAt: new Date().toISOString()
    }, null, 2)}\n`, this.atomicOptions("rollback-metadata"));
    this.appendJournal({ transactionId, status: "rolled-back", sha256: rollback.actualHash, rolledBackAt: new Date().toISOString() });
    if (stagePath) fs.rmSync(stagePath, { force: true });
    return { status: "recovered", source: "write-ahead-log-rollback", transactionId, sha256: rollback.actualHash, at: new Date().toISOString() };
  }

  _recoverWal() {
    const { transactions } = this.walState();
    const pendingTransactions = [...transactions.values()]
      .filter((transaction) => transaction.pending && !transaction.terminal)
      .map((transaction) => transaction.pending)
      .sort((a, b) => Number(a.version || 0) - Number(b.version || 0));
    let outcome = null;
    const unresolved = [];
    for (const pending of pendingTransactions) {
      const recovered = this.recoverPendingTransaction(pending);
      if (recovered) outcome = recovered;
      else unresolved.push(pending.transactionId);
    }
    if (unresolved.length) {
      const error = new Error(`Write-ahead recovery could not verify replay or rollback data for ${unresolved.length} transaction(s).`);
      error.code = "WAKE_WAL_UNRECOVERABLE";
      error.status = 500;
      error.transactions = unresolved;
      throw error;
    }

    const refreshed = this.walState();
    const activeStageFiles = new Set([...refreshed.transactions.values()]
      .filter((transaction) => transaction.pending && !transaction.terminal)
      .map((transaction) => path.basename(String(transaction.pending.stageFile || "")))
      .filter(Boolean));
    for (const name of fs.readdirSync(this.transactionDir)) {
      const belongsToActiveTransaction = [...activeStageFiles].some((stageFile) => name === stageFile || name.startsWith(`${stageFile}.tmp-`));
      if (!belongsToActiveTransaction) fs.rmSync(path.join(this.transactionDir, name), { force: true });
    }
    return outcome;
  }

  recoverWal() {
    return this.withProcessLock(() => this._recoverWal());
  }

  _recover() {
    const walRecovery = this._recoverWal();
    const metadata = readMetadata(this.metaPath);
    const expectedHash = fs.existsSync(this.hashPath) ? fs.readFileSync(this.hashPath, "utf8").trim() : metadata?.sha256 || null;
    const candidates = [
      { kind: "primary", path: this.filePath, expectedHash },
      { kind: "previous", path: `${this.filePath}.previous`, expectedHash: null },
      ...fs.readdirSync(path.dirname(this.filePath))
        .filter((name) => name.startsWith(`${path.basename(this.filePath)}.tmp-`))
        .map((name) => ({ kind: "temporary", path: path.join(path.dirname(this.filePath), name), expectedHash: null })),
      ...fs.readdirSync(this.backupDir)
        .filter((name) => name.endsWith(".json"))
        .map((name) => ({ kind: "automatic-backup", path: path.join(this.backupDir, name), expectedHash: null, time: fs.statSync(path.join(this.backupDir, name)).mtimeMs }))
        .sort((a, b) => (b.time || 0) - (a.time || 0))
    ];
    for (const candidate of candidates) {
      const valid = readValidJson(candidate.path, candidate.expectedHash);
      if (!valid) continue;
      if (candidate.kind !== "primary") {
        writeFileAtomic(this.filePath, valid.payload);
        writeFileAtomic(this.hashPath, `${valid.actualHash}\n`);
        writeFileAtomic(this.metaPath, `${JSON.stringify({ schemaVersion: 1, version: Number(metadata?.version || 0) + 1, transactionId: `fallback-${Date.now()}`, sha256: valid.actualHash, reason: "fallback-recovery", updatedAt: new Date().toISOString() }, null, 2)}\n`);
      } else if (!expectedHash) {
        writeFileAtomic(this.hashPath, `${valid.actualHash}\n`);
      }
      this.lastRecovery = walRecovery || { status: candidate.kind === "primary" ? "clean" : "recovered", source: candidate.kind, sourcePath: candidate.path, sha256: valid.actualHash, at: new Date().toISOString() };
      return valid.value;
    }
    this.lastRecovery = { status: "initialized", source: "default", at: new Date().toISOString() };
    this._write(this.defaultValue, { reason: "initialize-default", skipBackup: true });
    return structuredClone(this.defaultValue);
  }

  recover() {
    return this.withProcessLock(() => this._recover());
  }

  read() {
    return this.withProcessLock(() => this._recover());
  }

  _write(value, { reason = "state-mutation", skipBackup = false } = {}) {
    this._recoverWal();
    const payload = `${JSON.stringify(value, null, 2)}\n`;
    JSON.parse(payload);
    const transactionId = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const newHash = fileHash(payload);
    const metadata = readMetadata(this.metaPath);
    const version = Number(metadata?.version || 0) + 1;
    const previous = readValidJson(this.filePath);
    const stageFile = transactionStageName(transactionId);
    const stagePath = path.join(this.transactionDir, stageFile);

    writeFileAtomic(stagePath, payload, this.atomicOptions("stage"));
    const backup = skipBackup ? null : this.createAutomaticBackup({ boundaryPrefix: "backup" });
    this.appendJournal({
      schemaVersion: 2,
      transactionId,
      version,
      status: "pending",
      reason,
      previousHash: previous?.actualHash || null,
      newHash,
      sha256: newHash,
      stageFile,
      backup: backup?.fileName || null,
      createdAt: new Date().toISOString()
    });
    writeFileAtomic(this.filePath, payload, this.atomicOptions("primary"));
    writeFileAtomic(this.hashPath, `${newHash}\n`, this.atomicOptions("hash"));
    writeFileAtomic(this.metaPath, `${JSON.stringify({ schemaVersion: 1, version, transactionId, sha256: newHash, reason, updatedAt: new Date().toISOString() }, null, 2)}\n`, this.atomicOptions("metadata"));
    this.appendJournal({ transactionId, version, status: "committed", reason, sha256: newHash, backup: backup?.fileName || null, committedAt: new Date().toISOString() });
    fs.rmSync(stagePath, { force: true });
    this.lastRecovery = { status: "clean", source: "write", transactionId, version, sha256: newHash, at: new Date().toISOString() };
    return { transactionId, version, sha256: newHash, backup };
  }

  write(value, options = {}) {
    return this.withProcessLock(() => this._write(value, options));
  }

  mutate(mutator, options = {}) {
    if (typeof mutator !== "function") throw new TypeError("Durable store mutation requires a function.");
    return this.withProcessLock(() => {
      const current = this._recover();
      const next = mutator(structuredClone(current));
      if (next === undefined) throw new Error("Durable store mutation returned no state.");
      const receipt = this._write(next, options);
      return { value: next, receipt };
    });
  }

  _status() {
    const { transactions } = this.walState();
    const pendingTransactions = [...transactions.values()].filter((transaction) => transaction.pending && !transaction.terminal).length;
    return {
      file: this.filePath,
      metadata: this.metaPath,
      journal: this.journalPath,
      transactionDir: this.transactionDir,
      walSchemaVersion: 3,
      pendingTransactions,
      lockPath: this.lockPath,
      lockHeldByCurrentProcess: this.lockDepth > 0,
      journalHealth: this.journalHealth,
      backupDir: this.backupDir,
      automaticBackups: fs.readdirSync(this.backupDir).filter((name) => name.endsWith(".json")).length,
      retention: this.retention,
      recovery: this.lastRecovery
    };
  }

  status() {
    return this.withProcessLock(() => this._status());
  }
}

function artifactLayout(filePath) {
  const absolutePath = path.resolve(filePath);
  const directory = path.dirname(absolutePath);
  const id = Buffer.from(path.basename(absolutePath), "utf8").toString("base64url");
  const walDir = path.join(directory, ".wake-wal");
  const sidecarDir = path.join(walDir, "sidecars");
  return {
    filePath: absolutePath,
    id,
    walDir,
    journalPath: path.join(walDir, `json-${id}.ndjson`),
    transactionDir: path.join(walDir, "transactions", id),
    backupDir: path.join(directory, ".wake-backups", id),
    hashPath: path.join(sidecarDir, `${id}.sha256`),
    metaPath: path.join(sidecarDir, `${id}.meta.json`),
    lockPath: path.join(sidecarDir, `${id}.lock`)
  };
}

export function createDurableJsonFileStore(filePath, { defaultValue = {}, ...options } = {}) {
  const layout = artifactLayout(filePath);
  return new DurableJsonStore(layout.filePath, {
    defaultValue,
    ...layout,
    ...options
  });
}

export function createWakeStateStore(filePath, { defaultValue = {}, retention = 24, ...options } = {}) {
  const dataDir = path.dirname(path.resolve(filePath));
  return new DurableJsonStore(path.resolve(filePath), {
    defaultValue,
    backupDir: path.join(dataDir, "backups", "automatic"),
    journalPath: path.join(dataDir, "journal", "wake-v6-store.ndjson"),
    retention,
    ...options
  });
}

export function readJsonDurable(filePath, defaultValue = {}) {
  const layout = artifactLayout(filePath);
  if (!fs.existsSync(layout.filePath) && !fs.existsSync(layout.journalPath)) return structuredClone(defaultValue);
  return createDurableJsonFileStore(layout.filePath, { defaultValue }).read();
}

export function writeJsonDurable(filePath, value, options = {}) {
  const store = createDurableJsonFileStore(filePath, { defaultValue: value });
  return store.write(value, options);
}

export function recoverDurableJsonTree(rootDir) {
  const recovered = [];
  if (!fs.existsSync(rootDir)) return recovered;
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.name === ".wake-wal") {
        for (const journalName of fs.readdirSync(fullPath).filter((name) => /^json-.+\.ndjson$/.test(name))) {
          const id = journalName.slice(5, -7);
          let fileName;
          try {
            fileName = Buffer.from(id, "base64url").toString("utf8");
          } catch {
            continue;
          }
          if (!fileName || path.basename(fileName) !== fileName) continue;
          const filePath = path.join(directory, fileName);
          const store = createDurableJsonFileStore(filePath, { defaultValue: {} });
          store.recover();
          recovered.push({ filePath, journalPath: store.journalPath, status: store.status() });
        }
        continue;
      }
      if (["node_modules", ".wake-backups", "cache"].includes(entry.name)) continue;
      walk(fullPath);
    }
  };
  walk(path.resolve(rootDir));
  return recovered;
}
