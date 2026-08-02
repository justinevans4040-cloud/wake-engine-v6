import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { runTierZeroNetwork } from "./tier-zero-runtime.js";

const SUPPORTED_SOURCE_EXTENSIONS = new Set([".txt", ".md", ".json"]);
const DEFAULT_MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const DEFAULT_INTERVAL_MS = 60_000;
const MAX_RUN_RECORDS = 200;
const MAX_REVIEW_RECORDS = 100;
const MAX_HISTORY_RECORDS = 500;

function nowIso(now) {
  return now().toISOString();
}

function pushBounded(target, value, max) {
  target.unshift(value);
  if (target.length > max) target.length = max;
}

function safeId(value) {
  return String(value || "wake-export")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "wake-export";
}

function requireFunction(value, label) {
  if (typeof value !== "function") throw new TypeError(`${label} must be a function.`);
}

function parseInteger(value) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function matchCronSegment(segment, value, min, max) {
  const [base, rawStep] = segment.split("/");
  if (segment.split("/").length > 2) return false;

  const step = rawStep === undefined ? 1 : parseInteger(rawStep);
  if (!step || step < 1) return false;

  if (base === "*") return (value - min) % step === 0;

  if (base.includes("-")) {
    const [rawStart, rawEnd] = base.split("-");
    if (base.split("-").length !== 2) return false;
    const start = parseInteger(rawStart);
    const end = parseInteger(rawEnd);
    if (start === null || end === null || start < min || end > max || start > end) return false;
    return value >= start && value <= end && (value - start) % step === 0;
  }

  if (rawStep !== undefined) return false;
  const exact = parseInteger(base);
  return exact !== null && exact >= min && exact <= max && value === exact;
}

function matchCronField(field, value, min, max) {
  return field.split(",").some((segment) => matchCronSegment(segment, value, min, max));
}

export function getTimeZoneParts(timeZone = "UTC", date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    minute: "2-digit",
    hour: "2-digit",
    day: "2-digit",
    month: "2-digit",
    weekday: "short"
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
  if (weekday === undefined) throw new Error(`Unable to resolve weekday for timezone ${timeZone}.`);
  return {
    minute: Number(parts.minute),
    hour: Number(parts.hour),
    date: Number(parts.day),
    month: Number(parts.month),
    day: weekday
  };
}

export function isCronMatch(cronExpression, parts) {
  if (!cronExpression || !parts) return false;
  const tokens = String(cronExpression).trim().split(/\s+/);
  if (tokens.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = tokens;
  return (
    matchCronField(minute, parts.minute, 0, 59) &&
    matchCronField(hour, parts.hour, 0, 23) &&
    matchCronField(dayOfMonth, parts.date, 1, 31) &&
    matchCronField(month, parts.month, 1, 12) &&
    matchCronField(dayOfWeek, parts.day, 0, 6)
  );
}

export function computeHash(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
}

export function loadSourceBundle(dirPath, { maxBytes = DEFAULT_MAX_SOURCE_BYTES } = {}) {
  if (!dirPath || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return null;
  }

  const files = fs.readdirSync(dirPath)
    .sort((a, b) => a.localeCompare(b))
    .filter((fileName) => SUPPORTED_SOURCE_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
    .filter((fileName) => fs.statSync(path.join(dirPath, fileName)).isFile());

  if (!files.length) return null;

  let bytes = 0;
  const sections = [];
  for (const fileName of files) {
    const absolutePath = path.join(dirPath, fileName);
    const content = fs.readFileSync(absolutePath, "utf8");
    bytes += Buffer.byteLength(content, "utf8");
    if (bytes > maxBytes) {
      throw new Error(`Source folder exceeds the ${maxBytes}-byte automation limit.`);
    }
    sections.push(`--- File: ${fileName} ---\n${content.trim()}`);
  }

  const text = sections.join("\n\n").trim();
  if (!text) return null;
  return { text, files, bytes, hash: computeHash(text) };
}

export function loadSourceFolder(dirPath, options) {
  return loadSourceBundle(dirPath, options)?.text || null;
}

export function renderAutomationMarkdown(pack, metadata = {}) {
  if (!pack || typeof pack !== "object") throw new Error("Automation result does not contain an exportable pack.");

  const title = pack.exportManifest?.title || pack.sourceProfile?.title || metadata.automationName || "WAKE Engine Export";
  const lines = [
    `# ${title}`,
    "",
    `Generated: ${metadata.generatedAt || new Date().toISOString()}`,
    `Automation: ${metadata.automationName || "Unnamed automation"}`,
    `Run ID: ${metadata.runId || pack.runId || "unknown"}`,
    `QA verdict: ${pack.qaVerdict?.verdict || pack.tierZeroQa?.verdict || "unknown"}`,
    ""
  ];

  const addList = (heading, items, formatter) => {
    if (!Array.isArray(items) || !items.length) return;
    lines.push(`## ${heading}`, "");
    for (const [index, item] of items.entries()) {
      lines.push(formatter(item, index));
    }
    lines.push("");
  };

  addList("Hooks", pack.hooks, (item) => `- ${String(item)}`);
  addList("Scripts", pack.scripts, (item, index) => {
    const label = item?.time || item?.beat || `Beat ${index + 1}`;
    return `- **${label}:** ${item?.line || item?.direction || JSON.stringify(item)}`;
  });
  addList("Platform Variants", pack.platformVariants, (item) =>
    `- **${item?.platform || "Platform"}:** ${item?.hook || item?.structure || JSON.stringify(item)}`
  );
  addList("Evidence", pack.evidenceMap, (item) =>
    `- **${item?.id || "evidence"}:** ${item?.quote || item?.sourceLine || JSON.stringify(item)}`
  );

  const blockers = pack.qaVerdict?.blockers || pack.tierZeroQa?.blockers || [];
  if (Array.isArray(blockers) && blockers.length) {
    lines.push("## Blockers", "", ...blockers.map((item) => `- ${item}`), "");
  }

  lines.push("## Next Action", "", pack.nextAction || pack.qaVerdict?.nextAction || "Review and approve the packet.", "");
  return `${lines.join("\n").trim()}\n`;
}

export function writeAutomationExport({ automation, runRecord, result }) {
  if (!automation?.exportDir) throw new Error("Automation export directory is required.");
  const pack = result?.pack || result;
  if (!pack || typeof pack !== "object") throw new Error("Automation pipeline returned no exportable packet.");

  fs.mkdirSync(automation.exportDir, { recursive: true });
  const stem = `${safeId(automation.name)}-${safeId(runRecord.id)}`;
  const markdownPath = path.join(automation.exportDir, `${stem}.md`);
  const jsonPath = path.join(automation.exportDir, `${stem}.json`);
  const metadata = {
    automationName: automation.name,
    runId: runRecord.id,
    generatedAt: runRecord.completedAt || new Date().toISOString()
  };

  fs.writeFileSync(markdownPath, renderAutomationMarkdown(pack, metadata), "utf8");
  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify({ schema: "wake-engine-automation-export", metadata, pack }, null, 2)}\n`,
    "utf8"
  );

  return [
    { type: "markdown", path: markdownPath },
    { type: "json", path: jsonPath }
  ];
}

function ensureStoreArrays(store) {
  store.automations = Array.isArray(store.automations) ? store.automations : [];
  store.automationRuns = Array.isArray(store.automationRuns) ? store.automationRuns : [];
  store.reviewQueue = Array.isArray(store.reviewQueue) ? store.reviewQueue : [];
  store.history = Array.isArray(store.history) ? store.history : [];
}

function findLastCompletedRun(store, automationId) {
  return store.automationRuns.find((run) =>
    run.automationId === automationId &&
    ["completed", "awaiting-review"].includes(run.status) &&
    typeof run.sourceHash === "string" &&
    run.sourceHash !== "manual-run"
  );
}

function findManualPlaceholder(store, automationId) {
  return store.automationRuns.find((run) =>
    run.automationId === automationId &&
    run.status === "queued" &&
    run.sourceHash === "manual-run"
  );
}

function createRunRecord(automation, timestamp) {
  return {
    id: `run-${timestamp.getTime()}-${crypto.randomBytes(3).toString("hex")}`,
    automationId: automation.id,
    status: "queued",
    sourceHash: null,
    createdAt: timestamp.toISOString()
  };
}

function recordHistory(store, record) {
  pushBounded(store.history, record, MAX_HISTORY_RECORDS);
}

export async function runAutomationCycle({
  storeRef,
  updateStore,
  runPipeline = runTierZeroNetwork,
  now = () => new Date()
} = {}) {
  requireFunction(storeRef, "storeRef");
  requireFunction(updateStore, "updateStore");
  requireFunction(runPipeline, "runPipeline");
  requireFunction(now, "now");

  const store = storeRef();
  if (!store || typeof store !== "object") throw new Error("storeRef must return a store object.");
  ensureStoreArrays(store);

  const summary = { considered: 0, completed: 0, awaitingReview: 0, skipped: 0, failed: 0 };

  for (const automation of store.automations) {
    summary.considered += 1;
    const forced = automation.forceRun === true;
    if (!automation.enabled && !forced) continue;

    const timestamp = now();
    let scheduled = false;
    if (!forced) {
      try {
        scheduled = isCronMatch(
          automation.scheduleCron,
          getTimeZoneParts(automation.timeZone || "UTC", timestamp)
        );
      } catch (error) {
        automation.lastError = `Invalid timezone or schedule: ${error.message}`;
        automation.updatedAt = timestamp.toISOString();
        summary.failed += 1;
        continue;
      }
      if (!scheduled) continue;
    }

    const placeholder = findManualPlaceholder(store, automation.id);
    const runRecord = placeholder || createRunRecord(automation, timestamp);
    if (!placeholder) pushBounded(store.automationRuns, runRecord, MAX_RUN_RECORDS);

    let bundle;
    try {
      bundle = loadSourceBundle(automation.sourceDir);
      if (!bundle) throw new Error(`Source folder is empty, missing, or unsupported: ${automation.sourceDir}`);
    } catch (error) {
      automation.forceRun = false;
      automation.lastError = error.message;
      automation.updatedAt = timestamp.toISOString();
      runRecord.status = "failed";
      runRecord.error = error.message;
      runRecord.completedAt = timestamp.toISOString();
      recordHistory(store, {
        id: `hist-${timestamp.getTime()}-${crypto.randomBytes(3).toString("hex")}`,
        type: "AUTOMATION_FAILED",
        detail: `Automation ${automation.name} failed: ${error.message}`,
        createdAt: timestamp.toISOString()
      });
      updateStore(store, "automation-source-failed");
      summary.failed += 1;
      continue;
    }

    const lastCompleted = findLastCompletedRun(store, automation.id);
    if (!forced && lastCompleted?.sourceHash === bundle.hash) {
      automation.lastDecision = {
        status: "skipped-unchanged",
        sourceHash: bundle.hash,
        at: timestamp.toISOString()
      };
      recordHistory(store, {
        id: `hist-${timestamp.getTime()}-${crypto.randomBytes(3).toString("hex")}`,
        type: "AUTOMATION_SKIPPED",
        detail: `Automation ${automation.name} skipped because the source hash is unchanged.`,
        createdAt: timestamp.toISOString()
      });
      updateStore(store, "automation-skipped-unchanged");
      summary.skipped += 1;
      continue;
    }

    automation.forceRun = false;
    automation.lastError = null;
    automation.updatedAt = timestamp.toISOString();
    runRecord.sourceHash = bundle.hash;
    runRecord.sourceFiles = bundle.files;
    runRecord.sourceBytes = bundle.bytes;
    runRecord.status = "running-pipeline";
    runRecord.startedAt = timestamp.toISOString();
    updateStore(store, "automation-started");

    try {
      const result = await Promise.resolve().then(() => runPipeline({
        source: bundle.text,
        basePack: {},
        retrievalContext: { baseAsk: automation.operatorAsk || "" }
      }));
      if (!result?.pack) throw new Error("Tier Zero pipeline returned no packet.");

      runRecord.completedAt = nowIso(now);
      runRecord.pipelineRunId = result.runId || result.pack.runId || null;
      runRecord.qaVerdict = result.pack.qaVerdict?.verdict || result.pack.tierZeroQa?.verdict || "unknown";

      if (automation.approvalMode === "Review Required") {
        pushBounded(store.reviewQueue, {
          id: `review-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
          automationId: automation.id,
          runId: runRecord.id,
          result,
          status: "pending",
          createdAt: runRecord.completedAt
        }, MAX_REVIEW_RECORDS);
        runRecord.status = "awaiting-review";
        summary.awaitingReview += 1;
      } else {
        runRecord.exportFiles = writeAutomationExport({ automation, runRecord, result });
        runRecord.status = "completed";
        summary.completed += 1;
      }

      recordHistory(store, {
        id: `hist-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        type: "AUTOMATION_COMPLETE",
        detail: `Automation ${automation.name} finished with status ${runRecord.status}.`,
        createdAt: runRecord.completedAt
      });
      updateStore(store, "automation-completed");
    } catch (error) {
      runRecord.status = "failed";
      runRecord.error = error.message;
      runRecord.completedAt = nowIso(now);
      automation.lastError = error.message;
      recordHistory(store, {
        id: `hist-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        type: "AUTOMATION_FAILED",
        detail: `Automation ${automation.name} failed: ${error.message}`,
        createdAt: runRecord.completedAt
      });
      updateStore(store, "automation-failed");
      summary.failed += 1;
    }
  }

  return summary;
}

export function startScheduler(storeRef, updateStore, _legacyOllamaStatusFn, options = {}) {
  const intervalMs = Number.isFinite(options.intervalMs) ? options.intervalMs : DEFAULT_INTERVAL_MS;
  const runPipeline = options.runPipeline || runTierZeroNetwork;
  const now = options.now || (() => new Date());
  let isRunning = false;

  const runNow = async () => {
    if (isRunning) return { skipped: true, reason: "cycle-already-running" };
    isRunning = true;
    try {
      return await runAutomationCycle({ storeRef, updateStore, runPipeline, now });
    } catch (error) {
      console.error("WAKE scheduler cycle failed:", error);
      return { failed: 1, error: error.message };
    } finally {
      isRunning = false;
    }
  };

  console.log("WAKE Engine deterministic background scheduler started.");
  const timer = setInterval(runNow, intervalMs);
  timer.unref?.();

  return {
    runNow,
    stop() {
      clearInterval(timer);
    }
  };
}
