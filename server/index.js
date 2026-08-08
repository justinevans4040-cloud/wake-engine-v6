import express from "express";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chatProfileFor } from "./chat-profiles.js";
import { cleanupLocalCache, createDataBundle, listDataBundles, restoreDataBundle } from "./backup-manager.js";
import { createWakeStateStore, readJsonDurable, recoverDurableJsonTree, writeFileAtomic, writeJsonDurable } from "./durable-storage.js";
import { createLocalSessionManager, isAllowedOrigin, isLoopbackAddress } from "./local-session.js";
import { auditNoTheater } from "./no-theater.js";
import { generateOriginalImage, imageGenerationStatus } from "./image-generation.js";
import { CANONICAL_PACKET_CONTRACT, TIER_ZERO_AGENT_PIPELINE, auditTierZeroRuntime, runTierZeroNetwork } from "./tier-zero-runtime.js";
import { TIER_ZERO_SPEC_STATUS } from "./tier-zero-spec-status.js";
import { startScheduler } from "./scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const DATA_DIR = process.env.WAKE_DATA_DIR || path.join(ROOT, "server", "data");
const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");
const EXPORT_DIR = path.join(DATA_DIR, "exports");
const INTAKE_DIR = path.join(DATA_DIR, "intake");
const GENERATED_IMAGE_DIR = path.join(DATA_DIR, "generated-images");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const CACHE_DIR = path.join(DATA_DIR, "cache");
const LOG_DIR = process.env.WAKE_LOG_DIR || path.join(DATA_DIR, "logs");
const LOG_FILE = path.join(LOG_DIR, "wake-engine.ndjson");
const IMAGE_SETTINGS_FILE = path.join(DATA_DIR, "image-generation-settings.json");
const STORE_FILE = path.join(DATA_DIR, "wake-v6-store.json");
const PORT = Number(process.env.PORT || 8786);
const OLLAMA_URLS = [
  process.env.WAKE_OLLAMA_URL,
  "http://127.0.0.1:11434",
  "http://localhost:11434",
  "http://ichabodcrane:11434"
].filter(Boolean);
const OLLAMA_MODEL = process.env.WAKE_OLLAMA_MODEL || "";
const INTAKE_MAX_FILES = Number(process.env.WAKE_INTAKE_MAX_FILES || 9000);
const INTAKE_MAX_DIRECTORIES = Number(process.env.WAKE_INTAKE_MAX_DIRECTORIES || 25000);
const INTAKE_REVIEW_MAX_CANDIDATES = Number(process.env.WAKE_INTAKE_REVIEW_MAX_CANDIDATES || 1000);
let ollamaStatusCache = null;
let providerCredentialBroker = null;

function yieldToRuntime() {
  return new Promise((resolve) => setImmediate(resolve));
}

function canonicalPacketSummary(packet = {}) {
  const qa = packet.tierZeroQa || packet.qaVerdict || packet.qaGate || {};
  return {
    contract: CANONICAL_PACKET_CONTRACT,
    runId: packet.runId || packet.tierZeroRuntime?.runId || null,
    title: packet.frame?.title || packet.sourceInbox?.title || packet.title || null,
    complete: CANONICAL_PACKET_CONTRACT.requiredSections.every((key) => packet[key] !== undefined && packet[key] !== null),
    counts: {
      evidence: packet.evidenceMap?.length || 0,
      claims: packet.claimMap?.length || 0,
      scripts: packet.scripts?.length || 0,
      variants: packet.platformVariants?.length || 0,
      a2aMessages: packet.a2aTrace?.length || 0,
      toolReceipts: packet.toolTrace?.length || 0
    },
    qa: {
      verdict: qa.verdict || (qa.passed ? "pass" : "unknown"),
      passed: qa.passed === true || qa.score?.passed === true,
      score: qa.score?.overall ?? qa.score?.score ?? null
    },
    nextAction: packet.nextAction || qa.nextBestStep || packet.campaignPacket?.nextAction || null
  };
}

function runtimeTruthEvidence() {
  return {
    benchmarkScript: fs.existsSync(path.join(ROOT, "scripts", "benchmark-wake-v6.mjs")),
    chatTarget: "/api/agent-chat/stream",
    exportInspection: typeof inspectExportOutput === "function",
    tierZeroSpecDisclaimer: TIER_ZERO_SPEC_STATUS.disclaimer,
    packetContract: CANONICAL_PACKET_CONTRACT
  };
}

const CLOUD_PATH_PATTERN = /(?:^|[\\/])(OneDrive|Dropbox|GoogleDrive|Google Drive|iCloud|iCloudDrive)(?:[\\/]|$)/i;

function containsCloudPath(value) {
  return CLOUD_PATH_PATTERN.test(String(value || ""));
}

function cloudProvenanceValues(record) {
  const values = [
    record?.sourcePath,
    record?.path,
    record?.localPath,
    record?.importKey,
    record?.relativePath
  ];
  const source = String(record?.source || "");
  const localPath = source.match(/^Local path:\s*(.+)$/im)?.[1]?.trim();
  const driveUrl = source.match(/^Google Drive URL:\s*(.+)$/im)?.[1]?.trim();
  values.push(localPath, driveUrl);
  return values.filter(Boolean);
}

function recordHasCloudProvenance(record) {
  return cloudProvenanceValues(record).some((value) => containsCloudPath(value));
}

function sanitizeCloudRecords(records) {
  const safe = [];
  const quarantined = [];
  for (const record of Array.isArray(records) ? records : []) {
    if (recordHasCloudProvenance(record)) quarantined.push(record);
    else safe.push(record);
  }
  return { safe, quarantined };
}

fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
fs.mkdirSync(EXPORT_DIR, { recursive: true });
fs.mkdirSync(INTAKE_DIR, { recursive: true });
fs.mkdirSync(GENERATED_IMAGE_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });
recoverDurableJsonTree(DATA_DIR);

const defaultStore = {
  projects: [
    {
      id: "wake-v6-main",
      name: "WAKE Engine V6",
      status: "active",
      createdAt: "2026-07-05T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z"
    }
  ],
  sources: [],
  mediaAssets: [],
  activeTask: {
    id: "task-wake-v6-main",
    title: "Build WAKE Engine V6 into an elite operator app",
    objective: "Turn source, chat, agents, clusters, and exports into one coherent task-completion system.",
    status: "active",
    nextAction: "Use Console or section chat to advance the current ask.",
    blockers: [],
    completed: [],
    updatedAt: "2026-07-14T00:00:00.000Z"
  },
  agentChats: [],
  intakeRuns: [],
  intakeReviews: [],
  generations: [],
  campaigns: [],
  generatedImages: [],
  runRecords: [],
  a2aMessages: [],
  replayableHandoffs: [],
  toolReceipts: [],
  memoryReceipts: [],
  exportInspections: [],
  exports: [],
  history: [],
  automations: [
    {
      id: "auto-tsg-weekly",
      name: "The Sixth Gate Weekly Campaign",
      projectId: "wake-v6-main",
      sourceDir: "C:\\WakeSource\\TheSixthGate",
      campaignType: "Custom Prompt",
      operatorAsk: "You are generating a weekly content package for The Sixth Gate fantasy series. Produce: three short-video scripts (TikTok/Reels/Shorts); two image-post concepts with midjourney prompts; one excerpt post highlighting dialogue; one revision-log post for patreon; captions; and visual prompts. Ensure all claims map back to the source text provided.",
      scheduleCron: "0 19 * * 0",
      timeZone: "America/Los_Angeles",
      approvalMode: "Review Required",
      exportDir: "C:\\WakeExport\\TheSixthGate",
      enabled: false,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z"
    },
    {
      id: "auto-ar-weekly",
      name: "Architects Renaissance Weekly Campaign",
      projectId: "wake-v6-main",
      sourceDir: "C:\\WakeSource\\ArchitectsRenaissance",
      campaignType: "Custom Prompt",
      operatorAsk: "You are generating a weekly content package for the Architects Renaissance series. Produce: three short-video scripts; two image-post concepts; one excerpt post; one revision-log post; captions; and visual prompts. Ensure all claims map strictly to the source text.",
      scheduleCron: "0 20 * * 0",
      timeZone: "America/Los_Angeles",
      approvalMode: "Review Required",
      exportDir: "C:\\WakeExport\\ArchitectsRenaissance",
      enabled: false,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z"
    }
  ],
  automationRuns: [],
  reviewQueue: []
};

const durableStore = createWakeStateStore(STORE_FILE, {
  defaultValue: defaultStore,
  retention: 24
});
const sessionManager = createLocalSessionManager({
  dataDir: DATA_DIR,
  testBypass: process.env.WAKE_TEST_AUTH_BYPASS === "1",
  authenticationRequired: process.env.WAKE_REQUIRE_LOGIN === "1"
});
let requestMutationTail = Promise.resolve();

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStore() {
  const loaded = durableStore.read();
  const sourceRecords = sanitizeCloudRecords(loaded.sources);
  const mediaRecords = sanitizeCloudRecords(loaded.mediaAssets);
  const chatRecords = sanitizeCloudRecords(loaded.agentChats);
  const generationRecords = sanitizeCloudRecords(loaded.generations);
  const historyRecords = sanitizeCloudRecords(loaded.history);
  const quarantine = {
    sources: sourceRecords.quarantined.length,
    mediaAssets: mediaRecords.quarantined.length,
    agentChats: chatRecords.quarantined.length,
    generations: generationRecords.quarantined.length,
    history: historyRecords.quarantined.length
  };
  return {
    projects: Array.isArray(loaded.projects) && loaded.projects.length ? loaded.projects : defaultStore.projects,
    sources: sourceRecords.safe,
    mediaAssets: mediaRecords.safe,
    activeTask: loaded.activeTask && typeof loaded.activeTask === "object" ? { ...defaultStore.activeTask, ...loaded.activeTask } : defaultStore.activeTask,
    agentChats: chatRecords.safe,
    intakeRuns: Array.isArray(loaded.intakeRuns) ? loaded.intakeRuns : [],
    intakeReviews: Array.isArray(loaded.intakeReviews) ? loaded.intakeReviews : [],
    generations: generationRecords.safe,
    campaigns: Array.isArray(loaded.campaigns) ? loaded.campaigns : [],
    generatedImages: Array.isArray(loaded.generatedImages) ? loaded.generatedImages : [],
    runRecords: Array.isArray(loaded.runRecords) ? loaded.runRecords : [],
    a2aMessages: Array.isArray(loaded.a2aMessages) ? loaded.a2aMessages : [],
    replayableHandoffs: Array.isArray(loaded.replayableHandoffs) ? loaded.replayableHandoffs : [],
    toolReceipts: Array.isArray(loaded.toolReceipts) ? loaded.toolReceipts : [],
    memoryReceipts: Array.isArray(loaded.memoryReceipts) ? loaded.memoryReceipts : [],
    exportInspections: Array.isArray(loaded.exportInspections) ? loaded.exportInspections : [],
    exports: Array.isArray(loaded.exports) ? loaded.exports : [],
    history: historyRecords.safe,
    automations: Array.isArray(loaded.automations) ? loaded.automations : defaultStore.automations,
    automationRuns: Array.isArray(loaded.automationRuns) ? loaded.automationRuns : [],
    reviewQueue: Array.isArray(loaded.reviewQueue) ? loaded.reviewQueue : [],
    quarantine
  };
}

function writeStore(store, reason = "state-mutation") {
  return durableStore.write(store, { reason });
}

function serializeMutatingRequest(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const previous = requestMutationTail;
  let release;
  requestMutationTail = new Promise((resolve) => {
    release = resolve;
  });
  previous.then(() => {
    let released = false;
    let releaseStoreLock = null;
    const finish = () => {
      if (released) return;
      released = true;
      releaseStoreLock?.();
      release();
    };
    res.once("finish", finish);
    res.once("close", finish);
    try {
      releaseStoreLock = durableStore.beginExclusiveMutation();
      next();
    } catch (error) {
      next(error);
    }
  }).catch(next);
}

function readImageSettings() {
  const fallback = { externalImagesEnabled: process.env.WAKE_ALLOW_EXTERNAL_IMAGES === "1", updatedAt: null };
  try {
    const saved = readJsonDurable(IMAGE_SETTINGS_FILE, fallback);
    return { ...fallback, ...saved, externalImagesEnabled: saved.externalImagesEnabled === true };
  } catch {
    return fallback;
  }
}

function writeImageSettings(input = {}) {
  const settings = {
    externalImagesEnabled: input.externalImagesEnabled === true,
    updatedAt: now()
  };
  writeJsonDurable(IMAGE_SETTINGS_FILE, settings, { reason: "image-generation-settings" });
  return settings;
}

function providerCredentials() {
  return providerCredentialBroker?.read?.() || null;
}

function currentImageGenerationStatus() {
  const settings = readImageSettings();
  return {
    ...imageGenerationStatus({ allowExternal: settings.externalImagesEnabled, providerConfig: providerCredentials() }),
    externalImagesEnabled: settings.externalImagesEnabled,
    settingsUpdatedAt: settings.updatedAt,
    credentialVault: providerCredentialBroker?.status?.() || { available: false, configured: false }
  };
}

function recordHistory(store, type, detail, payload = {}) {
  const entry = { id: id("hist"), type, detail, payload, createdAt: now() };
  store.history.unshift(entry);
  store.history = store.history.slice(0, 200);
  return entry;
}

function updateActiveTask(store, input = {}) {
  const current = store.activeTask || defaultStore.activeTask;
  const task = {
    ...current,
    title: String(input.title || current.title || "Current WAKE task").trim(),
    objective: String(input.objective || current.objective || "").trim(),
    status: String(input.status || current.status || "active"),
    nextAction: String(input.nextAction || current.nextAction || "Define the next action.").trim(),
    blockers: Array.isArray(input.blockers) ? input.blockers.slice(0, 12).map(String) : current.blockers || [],
    completed: Array.isArray(input.completed) ? input.completed.slice(0, 30).map(String) : current.completed || [],
    updatedAt: now()
  };
  store.activeTask = task;
  recordHistory(store, "active-task", `Active task updated: ${task.title}`, { task });
  return task;
}

function scoreChatAnswer(answer, context = {}) {
  const text = String(answer || "");
  const wordCount = words(text).length;
  const sourceCount = context.sources?.length || 0;
  const hasNextMove = /next|move|action|recommend|ship|export|apply|fix/i.test(text);
  const sourceSupport = Math.min(100, sourceCount * 24 + (/\[|\(|source|found|match/i.test(text) ? 16 : 0));
  const clarity = Math.min(100, Math.max(35, Math.round(wordCount * 1.8)));
  const usefulness = Math.min(100, Math.round((sourceSupport * 0.35) + (clarity * 0.35) + (hasNextMove ? 30 : 8)));
  return {
    sourceSupport,
    clarity,
    usefulness,
    marketReady: usefulness >= 78 && sourceSupport >= 45,
    nextMovePresent: hasNextMove
  };
}

const monitorLog = [
  { id: "log-boot", level: "ok", message: "WAKE desktop runtime online.", createdAt: now() },
  { id: "log-monitor", level: "ok", message: "CPU/RAM/GPU monitor attached.", createdAt: now() },
  { id: "log-ledger", level: "ok", message: "Local memory ledger active.", createdAt: now() }
];

function addMonitorLog(level, message) {
  const entry = { id: id("log"), level, message: String(message).slice(0, 500), createdAt: now() };
  monitorLog.unshift(entry);
  monitorLog.splice(24);
  try {
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // In-app monitoring remains available when the log device is temporarily unavailable.
  }
}

function cpuAverage() {
  const cpus = os.cpus();
  const total = cpus.reduce((sum, cpu) => {
    const times = cpu.times;
    return sum + times.user + times.nice + times.sys + times.idle + times.irq;
  }, 0);
  const idle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0);
  return { idle, total };
}

let previousCpu = cpuAverage();

function cpuPercent() {
  const current = cpuAverage();
  const idle = current.idle - previousCpu.idle;
  const total = current.total - previousCpu.total;
  previousCpu = current;
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idle / total) * 100)));
}

function memoryStats() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    totalGb: Number((total / 1024 / 1024 / 1024).toFixed(1)),
    usedGb: Number((used / 1024 / 1024 / 1024).toFixed(1)),
    percent: Math.round((used / total) * 100)
  };
}

function folderTarget(target) {
  const map = {
    data: DATA_DIR,
    exports: EXPORT_DIR,
    snapshots: SNAPSHOT_DIR
  };
  return map[target] || DATA_DIR;
}

async function gpuStats() {
  if (process.platform !== "win32") {
    return { name: "GPU", utilization: 0, status: "unsupported" };
  }
  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "$gpu=(Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name); " +
        "$samples=(Get-Counter '\\GPU Engine(*)\\Utilization Percentage' -ErrorAction SilentlyContinue).CounterSamples; " +
        "$value=0; if($samples){ $value=[math]::Round(($samples | Measure-Object CookedValue -Sum).Sum) }; " +
        "[pscustomobject]@{name=$gpu; utilization=$value} | ConvertTo-Json -Compress"
    ], { timeout: 5000 });
    const parsed = JSON.parse(stdout.trim() || "{}");
    return {
      name: parsed.name || "GPU",
      utilization: Number.isFinite(Number(parsed.utilization)) ? Math.max(0, Math.min(100, Number(parsed.utilization))) : 0,
      status: "live"
    };
  } catch (error) {
    try {
      const { stdout } = await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "(Get-CimInstance Win32_VideoController | Select-Object -First 1 -ExpandProperty Name)"
      ], { timeout: 5000 });
      return { name: stdout.trim() || "GPU", utilization: 0, status: "live", detail: "Utilization counter warming up." };
    } catch {
      return { name: "GPU", utilization: 0, status: "live", detail: error.message };
    }
  }
}

async function systemMetrics() {
  const gpu = await gpuStats();
  return {
    ok: true,
    sampledAt: now(),
    cpu: {
      model: os.cpus()[0]?.model || "CPU",
      cores: os.cpus().length,
      percent: cpuPercent()
    },
    memory: memoryStats(),
    gpu,
    runtime: {
      platform: os.platform(),
      uptimeSeconds: Math.round(process.uptime()),
      pid: process.pid,
      port: PORT
    },
    logs: monitorLog
  };
}

function upsertProject(store, input) {
  const name = String(input?.name || "").trim() || "Untitled Project";
  const existing = input?.id ? store.projects.find((project) => project.id === input.id) : null;
  if (existing) {
    existing.name = name;
    existing.status = String(input.status || existing.status || "active");
    existing.updatedAt = now();
    recordHistory(store, "project.updated", `Updated project: ${existing.name}`, { projectId: existing.id });
    return existing;
  }
  const project = {
    id: id("proj"),
    name,
    status: String(input?.status || "active"),
    createdAt: now(),
    updatedAt: now()
  };
  store.projects.unshift(project);
  recordHistory(store, "project.created", `Created project: ${project.name}`, { projectId: project.id });
  return project;
}

function saveSource(store, input) {
  const source = String(input?.source || "").trim();
  if (!source) {
    const error = new Error("Source text is required.");
    error.status = 400;
    throw error;
  }
  const projectId = String(input?.projectId || store.projects[0]?.id || "wake-v6-main");
  const saved = {
    id: id("src"),
    projectId,
    title: titleFromSource(source),
    source,
    characterCount: source.length,
    createdAt: now(),
    updatedAt: now()
  };
  store.sources.unshift(saved);
  recordHistory(store, "source.saved", `Saved source: ${saved.title}`, { sourceId: saved.id, projectId });
  addMonitorLog("ok", `Source saved: ${saved.title}`);
  return saved;
}

function sourceMaterialFromGeneratedImage({ image, campaign, platform }) {
  return [
    `# ${campaign?.title || platform?.label || "Generated Campaign Image"}`,
    "",
    `Lane: Generated Campaign Creative`,
    `Source type: generated_image`,
    `Local path: ${image.absolutePath}`,
    `MIME type: ${image.mimeType}`,
    `Extraction: image_metadata`,
    `Tags: generated-image, ${image.platform || platform?.id || "campaign"}, source-material`,
    "",
    "## Extracted Content",
    "",
    `Generated image source material for ${campaign?.title || "campaign creative"}.`,
    `Platform: ${platform?.label || image.platform || "campaign"}.`,
    `Prompt: ${image.prompt || platform?.imagePrompt || "No prompt recorded."}`,
    `Local file: ${image.relativePath || image.absolutePath}.`,
    `Dimensions: ${image.width || "unknown"}x${image.height || "unknown"} (${image.aspectRatio || "unknown aspect"}).`,
    `Provider: ${image.provider || "unknown"}${image.model ? ` / ${image.model}` : ""}.`,
    `SHA-256: ${image.sha256 || "not recorded"}.`
  ].join("\n");
}

function saveGeneratedImageAsSourceMaterial(store, input = {}) {
  const imageId = String(input.imageId || "").trim();
  const campaignId = String(input.campaignId || "").trim();
  const platformId = String(input.platform || "").toLowerCase();
  const campaign = store.campaigns.find((item) => item.id === campaignId) || null;
  const platform = campaign?.platforms?.[platformId] || Object.values(campaign?.platforms || {}).find((item) => item?.image?.id === imageId) || null;
  const image = store.generatedImages.find((item) => item.id === imageId)
    || platform?.image
    || (campaign?.generatedImages || []).find((item) => item.id === imageId);
  if (!image) {
    const error = new Error("Generated image was not found.");
    error.status = 404;
    throw error;
  }
  const projectId = String(input.projectId || campaign?.projectId || image.projectId || store.projects[0]?.id || "wake-v6-main");
  const existingSource = store.sources.find((source) => source.generatedImageId === image.id);
  const existingMedia = store.mediaAssets.find((asset) => asset.generatedImageId === image.id);
  const title = `${platform?.label || image.platform || "Campaign"} image — ${campaign?.title || image.filename || image.id}`;
  const sourceText = sourceMaterialFromGeneratedImage({ image, campaign, platform });
  const source = existingSource || {
    id: id("src"),
    projectId,
    title,
    source: sourceText,
    characterCount: sourceText.length,
    sourceType: "generated_image",
    sourcePath: image.absolutePath,
    generatedImageId: image.id,
    campaignId: campaign?.id || image.campaignId || null,
    lane: "Generated Campaign Creative",
    tags: ["generated-image", image.platform || platformId || "campaign", "source-material"],
    creativeEligibility: "approved",
    createdAt: now(),
    updatedAt: now()
  };
  if (existingSource) {
    existingSource.title = title;
    existingSource.source = sourceText;
    existingSource.characterCount = sourceText.length;
    existingSource.updatedAt = now();
  } else {
    store.sources.unshift(source);
  }
  const media = existingMedia || {
    id: `asset-${stableId(image.absolutePath || image.id)}`,
    projectId,
    title,
    name: image.filename || title,
    path: image.absolutePath,
    extension: path.extname(image.filename || image.absolutePath || ".png").toLowerCase(),
    kind: "image",
    lane: "Generated Campaign Creative",
    tags: ["generated-image", image.platform || platformId || "campaign", "source-material"],
    sizeBytes: fs.existsSync(image.absolutePath || "") ? fs.statSync(image.absolutePath).size : 0,
    modifiedAt: fs.existsSync(image.absolutePath || "") ? fs.statSync(image.absolutePath).mtime.toISOString() : now(),
    excerpt: image.prompt || platform?.imagePrompt || "",
    extractStatus: "generated_image",
    importKey: `generated-image:${image.id}`,
    generatedImageId: image.id,
    campaignId: campaign?.id || image.campaignId || null,
    creativeEligibility: "approved",
    importedAt: now()
  };
  if (!existingMedia) store.mediaAssets.unshift(media);
  recordHistory(store, "source.saved-image", `Saved generated image as source material: ${title}`, {
    projectId,
    sourceId: source.id,
    mediaId: media.id,
    imageId: image.id,
    campaignId: campaign?.id || image.campaignId || null
  });
  addMonitorLog("ok", `Generated image saved as source material: ${title}`);
  return { source, media };
}

function saveGeneration(store, input) {
  const generation = {
    id: id("gen"),
    projectId: String(input.projectId || store.projects[0]?.id || "wake-v6-main"),
    sourceId: input.sourceId || null,
    kind: input.kind,
    title: input.title || input.kind,
    output: input.output,
    createdAt: now()
  };
  store.generations.unshift(generation);
  recordHistory(store, `${input.kind}.generated`, `Generated ${input.kind}: ${generation.title}`, {
    generationId: generation.id,
    projectId: generation.projectId,
    sourceId: generation.sourceId
  });
  addMonitorLog("ok", `Generated ${input.kind}: ${generation.title}`);
  return generation;
}

function persistTierZeroRun(store, network, context = {}) {
  const runRecord = {
    id: network.runId,
    projectId: context.projectId || null,
    sourceId: context.sourceId || null,
    generationId: context.generationId || null,
    kind: context.kind || "tier-zero-run",
    ok: network.ok,
    runtime: network.runtime,
    tierZeroPromoted: network.tierZeroPromoted === true,
    tierZeroAuthority: network.tierZeroAuthority,
    agentTrace: network.agentTrace || network.pack?.agentTrace || [],
    qaVerdict: network.pack?.tierZeroQa || network.pack?.qaVerdict || null,
    exportManifest: network.pack?.exportManifest || null,
    agentInbox: network.agentInbox || network.pack?.agentInbox || {},
    agentOutbox: network.agentOutbox || network.pack?.agentOutbox || {},
    replayableHandoffs: (network.replayableHandoffs || network.pack?.replayableHandoffs || []).map((item) => item.id),
    createdAt: network.generatedAt || now()
  };
  store.runRecords.unshift(runRecord);
  store.runRecords = store.runRecords.slice(0, 160);

  const a2a = (network.a2aMessages || network.pack?.a2aTrace || []).map((message) => ({
    ...message,
    projectId: context.projectId || null,
    sourceId: context.sourceId || null,
    generationId: context.generationId || null
  }));
  store.a2aMessages.unshift(...a2a);
  store.a2aMessages = store.a2aMessages.slice(0, 600);

  const replay = (network.replayableHandoffs || network.pack?.replayableHandoffs || []).map((handoff) => ({
    ...handoff,
    projectId: context.projectId || null,
    sourceId: context.sourceId || null,
    generationId: context.generationId || null
  }));
  store.replayableHandoffs = Array.isArray(store.replayableHandoffs) ? store.replayableHandoffs : [];
  store.replayableHandoffs.unshift(...replay);
  store.replayableHandoffs = store.replayableHandoffs.slice(0, 600);

  const tools = (network.toolCalls || network.pack?.toolTrace || []).map((receipt) => ({
    ...receipt,
    projectId: context.projectId || null,
    sourceId: context.sourceId || null,
    generationId: context.generationId || null
  }));
  store.toolReceipts.unshift(...tools);
  store.toolReceipts = store.toolReceipts.slice(0, 1000);

  const memory = [
    ...(network.memoryWrites || []).map((receipt) => ({ ...receipt, direction: "write" })),
    ...(network.memoryReads || []).map((receipt) => ({ ...receipt, direction: "read" }))
  ].map((receipt) => ({
    ...receipt,
    projectId: context.projectId || null,
    sourceId: context.sourceId || null,
    generationId: context.generationId || null
  }));
  store.memoryReceipts.unshift(...memory);
  store.memoryReceipts = store.memoryReceipts.slice(0, 1000);

  recordHistory(store, "tier-zero.run", `Persisted Tier Zero run: ${runRecord.id}`, {
    runId: runRecord.id,
    projectId: runRecord.projectId,
    sourceId: runRecord.sourceId,
    generationId: runRecord.generationId
  });
  return runRecord;
}

const CLUSTER_REQUIRED_FIELDS = [
  "campaignPacket",
  "platformLanes",
  "hooks",
  "titles",
  "captions",
  "scripts",
  "shortsReelsTikTok",
  "youtube",
  "linkedin",
  "carousel",
  "thumbnailPrompts",
  "visualPrompts",
  "quoteEvidencePack",
  "distributionPlan",
  "qaVerdict",
  "nextAction",
  "a2aTrace",
  "toolTrace"
];

const EXPORT_REQUIRED_FIELDS = [
  "manifest",
  "source",
  "sourceProfile",
  "evidence",
  "citations",
  "evidenceMap",
  "citationMap",
  "claimMap",
  "scripts",
  "variants",
  "platformVariants",
  "creativeDirection",
  "visualPrompts",
  "productionNotes",
  "qaVerdict",
  "traces",
  "nextAction",
  "a2aTrace",
  "agentInbox",
  "agentOutbox",
  "replayableHandoffs",
  "toolTrace",
  "filePaths",
  "exportManifest"
];

function isMissingValue(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object") return Object.keys(value).length === 0;
  return value === undefined || value === null || value === "";
}

function qaStatusForOutput(output = {}) {
  const qa = output.tierZeroQa || output.qaVerdict || output.qaGate || null;
  if (!qa) return { present: false, passed: null, verdict: "not-applicable", blockers: [], repairSuggestions: [] };
  const passed = qa.passed === true || qa.verdict === "pass" || qa.score?.passed === true;
  const blocked = qa.verdict === "blocked" || qa.passed === false || qa.score?.passed === false;
  return {
    present: true,
    passed: passed && !blocked,
    verdict: blocked ? "blocked" : passed ? "pass" : "unverified",
    blockers: qa.blockers || qa.score?.blockers || [],
    repairSuggestions: qa.repairSuggestions || qa.score?.repairSuggestions || [],
    nextBestStep: qa.nextBestStep || qa.nextAction || qa.score?.nextBestStep || output.nextAction || "Repair QA before export."
  };
}

function inspectContentCluster(cluster = {}) {
  const missing = CLUSTER_REQUIRED_FIELDS.filter((field) => isMissingValue(cluster[field]));
  const laneMissing = ["shortsReelsTikTok", "youtube", "linkedin", "carousel"].filter((field) => isMissingValue(cluster.platformLanes?.[field]));
  const qa = qaStatusForOutput(cluster);
  return {
    id: id("clui"),
    ok: missing.length === 0 && laneMissing.length === 0 && qa.passed === true,
    requiredFields: CLUSTER_REQUIRED_FIELDS,
    missing,
    laneMissing,
    qa,
    counts: {
      hooks: cluster.hooks?.length || 0,
      titles: cluster.titles?.length || 0,
      captions: cluster.captions?.length || 0,
      scripts: cluster.scripts?.length || 0,
      variants: cluster.platformVariants?.length || 0,
      a2aMessages: cluster.a2aTrace?.length || 0,
      toolReceipts: cluster.toolTrace?.length || 0
    },
    inspectedAt: now()
  };
}

function inspectExportOutput(output = {}) {
  const missing = EXPORT_REQUIRED_FIELDS.filter((field) => isMissingValue(output[field]));
  const manifestSections = output.exportManifest?.requiredSections || [];
  const manifestMissing = EXPORT_REQUIRED_FIELDS.filter((field) => !manifestSections.includes(field));
  const qa = qaStatusForOutput(output);
  const inspection = {
    id: id("expi"),
    ok: missing.length === 0 && manifestMissing.length === 0 && qa.passed === true,
    requiredFields: EXPORT_REQUIRED_FIELDS,
    missing,
    manifestMissing,
    qa,
    counts: {
      evidence: output.evidenceMap?.length || 0,
      citations: output.citationMap?.length || 0,
      claims: output.claimMap?.length || 0,
      scripts: output.scripts?.length || 0,
      platformVariants: output.platformVariants?.length || output.variants?.length || 0,
      a2aMessages: output.a2aTrace?.length || 0,
      replayableHandoffs: output.replayableHandoffs?.length || 0,
      toolReceipts: output.toolTrace?.length || 0
    },
    inspectedAt: now()
  };
  return inspection;
}

function exportMarkdown(payload) {
  const title = payload?.manifest?.title || payload?.title || payload?.frame?.title || payload?.sourceInbox?.title || "WAKE V6 Export";
  return [
    `# ${title}`,
    "",
    `Generated: ${payload?.manifest?.generatedAt || now()}`,
    "",
    "## Manifest",
    "",
    JSON.stringify(payload?.manifest || payload?.exportManifest || {}, null, 2),
    "",
    "## Source",
    "",
    typeof payload?.source === "string" ? payload.source : JSON.stringify(payload?.source || payload?.sourceProfile || {}, null, 2),
    "",
    "## Evidence And Citations",
    "",
    JSON.stringify({ evidence: payload?.evidence || payload?.evidenceMap || [], citations: payload?.citations || payload?.citationMap || [] }, null, 2),
    "",
    "## Claim Map",
    "",
    JSON.stringify(payload?.claimMap || [], null, 2),
    "",
    "## Scripts And Variants",
    "",
    JSON.stringify({ scripts: payload?.scripts || [], variants: payload?.variants || payload?.platformVariants || [] }, null, 2),
    "",
    "## Creative Direction And Visual Prompts",
    "",
    JSON.stringify({ creativeDirection: payload?.creativeDirection || {}, visualPrompts: payload?.visualPrompts || [] }, null, 2),
    "",
    "## QA Verdict",
    "",
    JSON.stringify(payload?.qaVerdict || payload?.tierZeroQa || payload?.qaGate || {}, null, 2),
    "",
    "## Traces",
    "",
    JSON.stringify(payload?.traces || {}, null, 2),
    "",
    "## Next Action",
    "",
    String(payload?.nextAction || ""),
    "",
    "## File Paths",
    "",
    JSON.stringify(payload?.filePaths || {}, null, 2),
    "",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
    ""
  ].join("\n");
}

function sourceRecordForExport(store, input, output) {
  const sourceId = input?.sourceId || output?.sourceId;
  const record = sourceId ? store.sources.find((item) => item.id === sourceId) : null;
  if (record) {
    return {
      id: record.id,
      title: record.title,
      text: record.source,
      characterCount: record.characterCount,
      createdAt: record.createdAt
    };
  }
  return output?.source || output?.sourceText || output?.sourceInbox || output?.sourceProfile || {
    title: output?.frame?.title || output?.title || "Source unavailable",
    text: "",
    characterCount: 0
  };
}

function buildExportBundle(store, input, paths) {
  const output = input?.output ?? {};
  const title = String(input?.title || output.title || output?.frame?.title || output?.sourceInbox?.title || "WAKE V6 Export").trim();
  const source = sourceRecordForExport(store, input, output);
  const creativeDirection = output.creativeDirection || {
    visualDirection: output.productionNotes?.visualDirection || output.creativeSystem?.visualDirection || output.visualDirection || "",
    editRules: output.productionNotes?.editRules || output.creativeSystem?.editRules || [],
    assetPrompts: output.productionNotes?.assetPrompts || output.visualPrompts || output.thumbnailPrompts || []
  };
  const traces = {
    a2aTrace: output.a2aTrace || output.a2aMessages || [],
    agentInbox: output.agentInbox || {},
    agentOutbox: output.agentOutbox || {},
    replayableHandoffs: output.replayableHandoffs || [],
    toolTrace: output.toolTrace || output.toolCalls || [],
    agentTrace: output.agentTrace || [],
    memoryWrites: output.memoryWrites || [],
    memoryReads: output.memoryReads || []
  };
  const requiredSections = Array.from(new Set([
    ...EXPORT_REQUIRED_FIELDS,
    ...(output.exportManifest?.requiredSections || [])
  ]));
  return {
    ...output,
    manifest: {
      id: id("expm"),
      title,
      generatedAt: now(),
      product: "Wake Engine",
      runtime: output.engine || "local content runtime",
      qaStatus: qaStatusForOutput(output),
      files: paths,
      requiredSections
    },
    source,
    evidence: output.evidenceMap || output.evidence || [],
    citations: output.citationMap || output.citations || [],
    variants: output.platformVariants || output.variants || [],
    creativeDirection,
    visualPrompts: output.visualPrompts || output.productionNotes?.assetPrompts || output.thumbnailPrompts || [],
    qaVerdict: output.qaVerdict || output.tierZeroQa || output.qaGate || {},
    repairSuggestions: output.repairSuggestions || output.tierZeroQa?.repairSuggestions || output.qaVerdict?.repairSuggestions || [],
    traces,
    nextAction: output.nextAction || output.operatorHandoff?.nextBestStep || output.campaignPacket?.nextAction || "Review QA, then continue production.",
    filePaths: paths,
    exportManifest: {
      ...(output.exportManifest || {}),
      title,
      requiredSections,
      files: paths
    }
  };
}

function saveExport(store, input) {
  const output = input?.output ?? {};
  const title = String(input?.title || output.title || output?.frame?.title || "WAKE V6 Export").trim();
  const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "wake-v6-export";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `${stamp}_${safeTitle}`;
  const jsonName = `${base}.json`;
  const mdName = `${base}.md`;
  const jsonPath = path.join(EXPORT_DIR, jsonName);
  const mdPath = path.join(EXPORT_DIR, mdName);
  const filePaths = {
    jsonPath,
    mdPath,
    relativeJsonPath: `data/exports/${jsonName}`,
    relativeMdPath: `data/exports/${mdName}`
  };
  const bundle = buildExportBundle(store, input, filePaths);
  const inspection = inspectExportOutput(bundle);
  bundle.exportInspection = inspection;
  writeJsonDurable(jsonPath, bundle, { reason: "content-export" });
  writeFileAtomic(mdPath, exportMarkdown(bundle));
  const saved = {
    id: id("exp"),
    projectId: String(input?.projectId || store.projects[0]?.id || "wake-v6-main"),
    sourceId: input?.sourceId || null,
    generationId: input?.generationId || null,
    title,
    jsonPath,
    mdPath,
    relativeJsonPath: filePaths.relativeJsonPath,
    relativeMdPath: filePaths.relativeMdPath,
    inspection,
    bundlePreview: {
      manifest: bundle.manifest,
      source: bundle.source,
      qaVerdict: bundle.qaVerdict,
      nextAction: bundle.nextAction,
      filePaths: bundle.filePaths
    },
    createdAt: now()
  };
  store.exports.unshift(saved);
  store.exportInspections.unshift({ ...inspection, exportId: saved.id, projectId: saved.projectId, sourceId: saved.sourceId, generationId: saved.generationId });
  store.exportInspections = store.exportInspections.slice(0, 240);
  const exportRun = {
    id: id("run-export"),
    kind: "export",
    status: inspection.ok ? "done" : "blocked",
    projectId: saved.projectId,
    sourceId: saved.sourceId,
    generationId: saved.generationId,
    exportId: saved.id,
    sourceRunId: output.runId || output.tierZeroRuntime?.runId || null,
    agentTrace: output.agentTrace || [],
    a2aTrace: output.a2aTrace || output.a2aMessages || [],
    toolTrace: output.toolTrace || output.toolCalls || [],
    exportInspection: inspection,
    filePaths,
    createdAt: now()
  };
  store.runRecords.unshift(exportRun);
  store.runRecords = store.runRecords.slice(0, 240);
  recordHistory(store, "export.saved", `Saved export: ${title}`, { projectId: saved.projectId, exportId: saved.id, runId: exportRun.id, inspection });
  addMonitorLog("ok", `Export saved: ${title}`);
  return saved;
}

const tasks = [
  { id: "WAKE-001", title: "Source prompt builder", owner: "Console", status: "running", updated: "2m ago", detail: "Turns pasted source into a structured WAKE frame with role, objective, scenes, hooks, constraints, and output contract." },
  { id: "WAKE-002", title: "Tier Zero content agents", owner: "Agent", status: "running", updated: "4m ago", detail: "Runs source-driven agent tools, A2A handoffs, local memory, quality gates, and optional local Ollama generation." },
  { id: "WAKE-003", title: "Snapshot storage", owner: "Runtime", status: "done", updated: "12m ago", detail: "Saves the current source, output, runtime status, and capability map to local application data." },
  { id: "WAKE-004", title: "Task monitor scaling", owner: "Console", status: "done", updated: "20m ago", detail: "Bounded, searchable, filterable task surface so the list does not grow forever." },
  { id: "WAKE-005", title: "Content Cluster creation network", owner: "Cluster", status: "running", updated: "now", detail: "Creates campaign packets, platform lanes, scripts, visual prompts, evidence packs, distribution plans, and export bundles." },
  { id: "WAKE-006", title: "Local export writer", owner: "Distribution", status: "done", updated: "now", detail: "Writes markdown and JSON exports under local application data." },
  { id: "WAKE-007", title: "Local memory ledger", owner: "Runtime", status: "done", updated: "now", detail: "Persists projects, sources, generations, exports, and history in the local WAKE store." },
  { id: "WAKE-008", title: "System monitor", owner: "Runtime", status: "running", updated: "live", detail: "Samples CPU, RAM, GPU, runtime, and local action logs." }
];

const capabilities = [
  { id: "ingest", label: "Ingest & Parse", status: "live", detail: "Accepts pasted source text and turns it into structured frame fields.", evidence: ["/api/sources", "/api/frame"] },
  { id: "local-agent", label: "Tier Zero Content Agent Runtime", status: "live", tierZeroVerified: true, detail: "Runs the promoted Wake Engine Tier Zero content agents with contracts, local tools, A2A handoffs, memory receipts, and QA output.", evidence: ["/api/run-agent", "/api/tier-zero/run"], runtimeProof: "/api/tier-zero/audit" },
  { id: "agent-chat", label: "Agent Chat Console", status: "live", tierZeroVerified: true, detail: "Chats with verified content agents, retrieves local context, streams fast deterministic draft first, then upgrades with Ollama when reachable.", evidence: ["/api/agent-chat", "/api/agent-chat/stream", "/api/tier-zero/agents"], runtimeProof: "/api/tier-zero/audit" },
  { id: "ip-intake", label: "IP / Media Intake Agent", status: "live", detail: "Scans configured local folders for text, docs, images, audio, video, and source metadata.", evidence: ["/api/intake/run"] },
  { id: "content-cluster", label: "Content Cluster Builder", status: "live", detail: "Locally groups any source into pillars, output lanes, proof notes, and handoff drafts.", evidence: ["/api/content-cluster"] },
  { id: "snapshot", label: "Snapshot Storage", status: "live", detail: "Writes auditable JSON snapshots to the local repo runtime folder.", evidence: ["/api/snapshot"] },
  { id: "script", label: "Script & Structure Agent", status: "live", tierZeroVerified: true, detail: "Frames scenes, hooks, captions, titles, platform blocks, CTAs, claim maps, and edit rules from source.", evidence: ["/api/run-agent", "/api/tier-zero/run"], runtimeProof: "/api/tier-zero/audit" },
  { id: "distribution", label: "Local Distribution Pack", status: "live", detail: "Exports reviewed outputs as local markdown and JSON files.", evidence: ["/api/export"] },
  { id: "memory", label: "Local Memory Ledger", status: "live", detail: "Persists projects, sources, generations, exports, snapshots, and action history in Electron userData.", evidence: ["atomic store", "write-ahead journal", "integrity hash"] },
  { id: "monitor", label: "GPU / System Monitor", status: "live", detail: "Samples CPU, RAM, GPU counters, process uptime, port, and local action logs.", evidence: ["/api/system"] }
];

const externalOperators = [];

const agentPipeline = TIER_ZERO_AGENT_PIPELINE;

const INTAKE_ROOTS = [INTAKE_DIR];

const LANE_RULES = [
  { category: "book_wake", name: "Book WAKE", terms: ["book wake", "book_wake", "wake book", "wake source", "wake master", "wake content", "wake_system"] },
  { category: "wake_forged", name: "WAKE Forged", terms: ["wakeforged", "wake forged", "respawn academy", "respawn"] },
  { category: "forgefront_systems", name: "ForgeFront Systems", terms: ["forgefront", "forge front", "forgefront systems", "vanguard", "viral forge"] },
  { category: "man_in_the_mirror", name: "Man in the Mirror", terms: ["man in the mirror", "mirror masterclass", "the mirror"] },
  { category: "aurora_storytime", name: "Aurora Storytime", terms: ["aurora storytime", "aurora", "storytime"] },
  { category: "athere_mesh", name: "Athere Mesh / Titan", terms: ["athere mesh", "aethermesh", "titan", "sentinel", "odin", "caretaker", "the britt"] }
];

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".json", ".html", ".htm", ".rtf", ".csv", ".log"]);
const DOC_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".odt"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".ico", ".svg"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".webm", ".avi"]);
const INTAKE_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ...DOC_EXTENSIONS, ...IMAGE_EXTENSIONS, ...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "release",
  ".smoke-run",
  ".ui-audit-run",
  "Temp",
  "AppData",
  "$Recycle.Bin",
  "Windows",
  "Program Files",
  "Program Files (x86)",
  "ProgramData",
  "Recovery",
  "System Volume Information",
  "$WinREAgent"
]);
const SKIP_DIR_NAMES = new Set([...SKIP_DIRS].map((name) => String(name).toLowerCase()));
const MAX_TEXT_BYTES = 750_000;
const OPERATIONAL_FILE_PATTERN = /(?:^|[\s_.-])(?:status(?:[-_ ]and[-_ ]gaps)?|gaps|handoff|readme|remote[-_ ]setup|commit(?:[-_ ]checklist)?|registry|audit|install|boot[-_ ]contract|naming(?:[-_ ]conventions)?|boundaries|thread[-_ ](?:export|prompt|drift)|files[-_ ]changed|copy[-_ ]log|node[-_ ]report|current[-_ ]state|active[-_ ]work|reminders|filing[-_ ]system|repo[-_ ]lock|source[-_ ]map)(?:$|[\s_.-])/i;
const OPERATIONAL_PATH_PATTERN = /[\\/](?:\.git|node_modules|archive|archives|handoffs|thread-exports|c&c coms|branch_map|notes inventory|data reports - json txt logs)[\\/]/i;
const OPERATIONAL_CONTENT_PATTERN = /\b(?:working checkpoint|status and gaps|desktop registry(?: root)?|registry setup|setup notes|file paths?|do not rename things early|remaining (?:docs|registry|migration|archive trails)|files changed in this thread|commit checklist|local machine inventory|repo lock|branch map|copy log)\b/i;
const OPERATIONAL_REPORT_FILE_PATTERN = /\b(?:wake[_\s.-]*(?:c[_\s.-]*drive[_\s.-]*total[_\s.-]*)?file[_\s.-]*inventory|total[_\s.-]*file[_\s.-]*inventory|drive[_\s.-]*inventory|inventory[_\s.-]*(?:errors?|audit|partial[_\s.-]*summary|no[_\s.-]*exclusions)|file[_\s.-]*control[_\s.-]*(?:generic[_\s.-]*name[_\s.-]*)?audit|generic[_\s.-]*name[_\s.-]*audit|content[_\s.-]*awareness[_\s.-]*inventory)\b/i;
const OPERATIONAL_REPORT_PATH_PATTERN = /[\\/]WAKE_ENTERPRISE_FILE_CONTROL[\\/]reports[\\/]|[\\/](?:file[-_\s]?control|inventory|scanner|scan[-_\s]?reports?)[\\/]/i;
const OPERATIONAL_REPORT_CONTENT_PATTERN = /\b(?:access to the path .* is denied|exception calling \"?enumerate(?:files|directories)\"?|recorded but not traversed to avoid filesystem loops|this report is inventory only|do not rename from it directly|source csv:|records summarized:|name risk counts|domain hint counts from paths|worst duplicate file names|worst duplicate filename groups|high-risk generic document records|duplicate ambiguous filename groups|scanned roots|inventory[_\s.-]*errors?|generic[_\s.-]*software[_\s.-]*or[_\s.-]*code[_\s.-]*name|code_or_software_convention_review|generic_document_name|duplicate_copy_name)\b/i;
const RANDOM_SCREENSHOT_PATTERN = /(?:^|[\s_.\\/-])(?:screenshot|screen[-_ ]?shot|snip|screenclip|clipboard|pasted[-_ ]?image|capture|img[-_ ]?\d+|image[-_ ]?\d+|photo[-_ ]?\d+|dsc\d+|wa\d+|unknown)(?:$|[\s_.\\/-]|\d)/i;
const CONTENT_ASSET_PATTERN = /\b(?:tiktok|tik[-_ ]?tok|youtube|shorts?|instagram|facebook|linkedin|twitter|thumbnail|cover|banner|logo|brand|post|reel|story|caption|hook|script|template|asset|reference|campaign|content|social)\b/i;

function creativeEligibility(record = {}) {
  if (record.creativeEligibility === "approved") return { eligible: true, reason: null };
  const title = String(record.title || record.name || "");
  const sourcePath = String(record.sourcePath || record.path || "");
  const content = sourceContent(record.source || record.excerpt || "").trim();
  const locator = `${title} ${sourcePath}`;
  if (OPERATIONAL_REPORT_FILE_PATTERN.test(locator) || OPERATIONAL_REPORT_PATH_PATTERN.test(sourcePath)) {
    return { eligible: false, reason: "operational inventory/report file" };
  }
  if (OPERATIONAL_REPORT_CONTENT_PATTERN.test(content)) return { eligible: false, reason: "operational inventory/report content" };
  if (OPERATIONAL_CONTENT_PATTERN.test(content)) return { eligible: false, reason: "operational content" };
  if (!content && (OPERATIONAL_FILE_PATTERN.test(title) || OPERATIONAL_PATH_PATTERN.test(sourcePath))) {
    return { eligible: false, reason: "empty operational shell" };
  }
  return { eligible: true, reason: null };
}

function isCreativeSourceEligible(record) {
  return creativeEligibility(record).eligible;
}

function intakeContextText(store, input = {}, projectId = null) {
  const project = store.projects.find((item) => item.id === projectId);
  return [
    input.intent,
    input.message,
    input.task,
    project?.name,
    store.activeTask?.title,
    store.activeTask?.objective,
    store.activeTask?.nextAction
  ].filter(Boolean).join(" ");
}

function intakeTerms(value) {
  const stop = new Set([
    "this", "that", "with", "from", "into", "your", "have", "need", "make", "create", "build", "content", "source", "project",
    "files", "file", "image", "video", "audio", "document", "local", "drive", "folder", "task", "agent", "engine", "wake"
  ]);
  return queryTerms(value).filter((term) => !stop.has(term)).slice(0, 24);
}

function classifyIntakeEntry(entry, eligibility, contextText = "") {
  if (!eligibility.eligible) {
    return { status: "excluded", recommended: false, confidence: 0.98, reason: eligibility.reason || "operational or non-creative file" };
  }
  const haystack = `${entry.title} ${entry.path} ${entry.lane} ${(entry.tags || []).join(" ")} ${entry.excerpt || ""}`.toLowerCase();
  const contextTerms = intakeTerms(contextText);
  const matchedTerms = contextTerms.filter((term) => haystack.includes(term.toLowerCase()));
  const hasContext = contextTerms.length > 0;
  const isMedia = ["image", "audio", "video"].includes(entry.kind);
  const isScreenshotLike = RANDOM_SCREENSHOT_PATTERN.test(`${entry.title} ${entry.path}`);
  const contentAsset = CONTENT_ASSET_PATTERN.test(haystack);
  const hasLaneSignal = entry.lane && entry.lane !== "General Source";
  const hasTextSignal = String(entry.excerpt || "").trim().length >= 80;

  if (isScreenshotLike && isMedia && !contentAsset && matchedTerms.length < 2) {
    return { status: "excluded", recommended: false, confidence: 0.93, reason: "looks like a random screenshot with no task/message match" };
  }
  if (hasContext && matchedTerms.length >= 2) {
    return { status: "recommended", recommended: true, confidence: 0.9, reason: `matches task/message terms: ${matchedTerms.slice(0, 4).join(", ")}` };
  }
  if (hasLaneSignal && (hasTextSignal || contentAsset)) {
    return { status: "recommended", recommended: true, confidence: 0.82, reason: `matches known lane: ${entry.lane}` };
  }
  if (contentAsset && !isScreenshotLike && (!hasContext || matchedTerms.length >= 1)) {
    return { status: "recommended", recommended: true, confidence: 0.74, reason: "looks like a reusable content or platform asset" };
  }
  if (contentAsset && hasContext && matchedTerms.length < 1) {
    return { status: "review", recommended: false, confidence: 0.6, reason: "asset-like file, but it does not clearly match the task/message" };
  }
  if (hasTextSignal && !isMedia) {
    if (hasContext) {
      return { status: "review", recommended: false, confidence: 0.62, reason: "readable text exists, but it does not clearly match the task/message" };
    }
    return { status: "recommended", recommended: true, confidence: 0.72, reason: "contains readable source text" };
  }
  if (isMedia && !hasTextSignal) {
    return { status: "review", recommended: false, confidence: 0.52, reason: "media has no readable text; operator review required" };
  }
  return { status: "review", recommended: false, confidence: 0.58, reason: "not enough signal to import without review" };
}

function words(source) {
  return source
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function stripInstructionWrapper(source) {
  const clean = source.trim().replace(/\s+/g, " ");
  const colonParts = clean.split(":");
  if (colonParts.length > 1) {
    const prefix = colonParts[0].toLowerCase();
    const rest = colonParts.slice(1).join(":").trim();
    if (
      rest.length > 24 &&
      /^(build|create|make|generate|write|draft|turn|produce)\b/.test(prefix) &&
      /(talking points|source|notes|brief|video|clip|content|prompt)/.test(prefix)
    ) {
      return rest;
    }
  }
  return clean
    .replace(/^(these\s+)?talking points:\s*/i, "")
    .replace(/^(source|notes|brief):\s*/i, "")
    .trim();
}

function cleanMarkdownLine(value) {
  return String(value || "")
    .replace(/^(?:#{1,6}\s*)+/, "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/`+/g, "")
    .trim();
}

function sourceTitle(source) {
  const lines = String(source || "").split(/\r?\n/);
  const heading = lines.find((line) => /^#\s+\S/.test(line.trim()));
  if (heading) return titleCase(cleanMarkdownLine(heading)).slice(0, 78).replace(/[:\s-]+$/g, "");
  return titleFromSource(source);
}

function sourceContent(source) {
  const raw = String(source || "");
  const contentMarker = raw.search(/^##\s+Extracted Content\s*$/im);
  const body = contentMarker >= 0 ? raw.slice(contentMarker).replace(/^##\s+Extracted Content\s*$/im, "") : raw;
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^(Lane|Source type|Local path|Google Drive URL|Google file ID|MIME type|Extraction|Tags):/i.test(line)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function sentenceCandidates(source) {
  const content = sourceContent(source)
    .replace(/\r/g, "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  const seen = new Set();
  const candidates = content
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((sentence) => cleanMarkdownLine(sentence).replace(/\s+/g, " ").trim())
    .map((sentence) => sentence.replace(/^[(":]+|[")]+$/g, ""))
    .filter((sentence) => sentence.length >= 32 && sentence.length <= 220)
    .filter((sentence) => !/^(metadata-only entry|full source is referenced|generated:|lane:|source type:)/i.test(sentence))
    .filter((sentence) => {
      const key = sentence.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
  if (candidates.length >= 3) return candidates;
  for (const fragment of content
    .replace(/^[^:]{1,140}:\s*/i, "")
    .split(/,|\band\b|\.|\n/)
    .map((item) => cleanMarkdownLine(item).replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 14 && item.length <= 180)) {
    const key = fragment.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(fragment);
    }
    if (candidates.length >= 5) break;
  }
  while (candidates.length < 3 && content) {
    const words = content.split(/\s+/).slice(candidates.length * 10, candidates.length * 10 + 16).join(" ");
    if (!words) break;
    candidates.push(words);
  }
  return candidates.slice(0, 12);
}

function pickSentence(sentences, fallback, index = 0) {
  return sentences[index] || sentences[0] || fallback;
}

function sourceMeta(source) {
  const lane = String(source || "").match(/^Lane:\s*(.+)$/im)?.[1]?.trim() || null;
  const sourceType = String(source || "").match(/^Source type:\s*(.+)$/im)?.[1]?.trim() || null;
  const extraction = String(source || "").match(/^Extraction:\s*(.+)$/im)?.[1]?.trim() || null;
  const tags = String(source || "").match(/^Tags:\s*(.+)$/im)?.[1]?.split(",").map((tag) => tag.trim()).filter(Boolean) || [];
  return { lane, sourceType, extraction, tags };
}

function sourceMetadataFromSaved(source) {
  const text = String(source?.source || "");
  const meta = sourceMeta(text);
  return {
    lane: meta.lane || "Unlabeled IP Lane",
    sourceType: meta.sourceType || "direct_source",
    extraction: meta.extraction || "source_text",
    tags: meta.tags,
    localPath: text.match(/^Local path:\s*(.+)$/im)?.[1]?.trim() || null,
    driveUrl: text.match(/^Google Drive URL:\s*(.+)$/im)?.[1]?.trim() || null,
    driveFileId: text.match(/^Google file ID:\s*(.+)$/im)?.[1]?.trim() || null,
    excerpt: sentenceCandidates(text)[0] || sourceContent(text).slice(0, 220) || source?.title || "No extracted body text available."
  };
}

function stableId(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 16);
}

function matchLane(haystack) {
  const lower = String(haystack || "").toLowerCase();
  const matches = [];
  for (const lane of LANE_RULES) {
    const hits = lane.terms.filter((term) => lower.includes(term));
    if (hits.length) matches.push({ lane, hits });
  }
  matches.sort((a, b) => b.hits.length - a.hits.length);
  return matches[0] || null;
}

function ipSummary(store) {
  const eligibleSources = store.sources.filter(isCreativeSourceEligible);
  const lanes = new Map();
  const sourceTypes = new Map();
  const tagCounts = new Map();
  for (const source of eligibleSources) {
    const meta = sourceMetadataFromSaved(source);
    lanes.set(meta.lane, (lanes.get(meta.lane) || 0) + 1);
    sourceTypes.set(meta.sourceType, (sourceTypes.get(meta.sourceType) || 0) + 1);
    for (const tag of meta.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
  const sortCounts = (map) => [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    total: eligibleSources.length,
    lanes: sortCounts(lanes),
    sourceTypes: sortCounts(sourceTypes),
    tags: sortCounts(tagCounts).slice(0, 36)
  };
}

function mediaSummary(store) {
  const eligibleMedia = store.mediaAssets.filter((asset) => creativeEligibility(asset).eligible);
  const kinds = new Map();
  const lanes = new Map();
  for (const asset of eligibleMedia) {
    kinds.set(asset.kind, (kinds.get(asset.kind) || 0) + 1);
    lanes.set(asset.lane || "Unlabeled Media", (lanes.get(asset.lane || "Unlabeled Media") || 0) + 1);
  }
  const sortCounts = (map) => [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { total: eligibleMedia.length, kinds: sortCounts(kinds), lanes: sortCounts(lanes) };
}

function queryTerms(value) {
  return [...new Set(words(String(value || "").toLowerCase()).filter((word) => word.length > 3).slice(0, 16))];
}

function retrieveContext(store, message, agentId = "strategist", limit = 6, mediaLimit = 5, projectId = null, sourceId = null) {
  const terms = queryTerms(`${message} ${agentId}`);
  const eligibleSources = store.sources.filter(isCreativeSourceEligible);
  const eligibleMedia = store.mediaAssets.filter((asset) => creativeEligibility(asset).eligible);
  const projectSources = projectId ? eligibleSources.filter((source) => source.projectId === projectId) : eligibleSources;
  const projectMedia = projectId ? eligibleMedia.filter((asset) => !asset.projectId || asset.projectId === projectId) : eligibleMedia;
  const pinnedSource = sourceId ? projectSources.find((source) => source.id === sourceId) || eligibleSources.find((source) => source.id === sourceId) : null;
  const scoreSource = (source) => {
    const meta = sourceMetadataFromSaved(source);
    const text = `${source.title} ${meta.lane} ${meta.tags.join(" ")} ${meta.excerpt} ${source.source}`.toLowerCase();
    let score = 0;
    for (const term of terms) if (text.includes(term)) score += 3;
    if (text.includes(agentId)) score += 2;
    if (agentId === "archivist") score += meta.localPath || meta.driveUrl ? 2 : 0;
    if (agentId === "creative-director" && /image|visual|design|brand|asset|photo|logo/.test(text)) score += 4;
    return { source, meta, score };
  };
  const sources = projectSources
    .map(scoreSource)
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.source.createdAt) - new Date(a.source.createdAt))
    .slice(0, limit);
  if (pinnedSource && !sources.some((item) => item.source.id === pinnedSource.id)) {
    sources.unshift({ source: pinnedSource, meta: sourceMetadataFromSaved(pinnedSource), score: 999 });
  }
  const media = projectMedia
    .map((asset) => {
      const text = `${asset.title} ${asset.lane} ${asset.kind} ${asset.path} ${(asset.tags || []).join(" ")}`.toLowerCase();
      let score = 0;
      for (const term of terms) if (text.includes(term)) score += 2;
      if (agentId === "creative-director" && asset.kind === "image") score += 3;
      return { asset, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, mediaLimit);
  if (!sources.length && projectSources.length) {
    sources.push(...projectSources.slice(0, Math.min(limit, 3)).map((source) => ({ source, meta: sourceMetadataFromSaved(source), score: 1 })));
  }
  return {
    sources: sources.slice(0, limit).map(({ source, meta, score }) => ({
      id: source.id,
      title: source.title,
      lane: meta.lane,
      sourceType: meta.sourceType,
      path: meta.localPath || meta.driveUrl || null,
      excerpt: meta.excerpt,
      score
    })),
    media: media.map(({ asset, score }) => ({ ...asset, score }))
  };
}

function fallbackAgentReply({ agent, message, context, llmStatus }) {
  const top = context.sources[0];
  const operatorRequest = String(message || "").match(/Operator request:\s*([\s\S]*?)(?:\n\nCurrent source excerpt:|\n\nCurrent output excerpt:|\n\nAnswer as|$)/i)?.[1]?.trim() || String(message || "").trim();
  const currentSource = String(message || "").match(/Current source excerpt:\s*([\s\S]*?)(?:\n\nCurrent output excerpt:|\n\nAnswer as|$)/i)?.[1]?.trim();
  const creationSource = currentSource || top?.excerpt || operatorRequest;
  if (creationSource.length < 24) {
    return "NOT ENOUGH SOURCE\n\nAdd the offer, audience, concrete proof, desired platform, and next action. I will create from those facts without inventing claims.";
  }

  const packet = makePack(creationSource);
  const evidence = packet.evidenceMap || [];
  const variants = packet.platformVariants || [];
  const hooks = packet.hooks || [];
  const scripts = packet.scripts || packet.scenePlan || [];
  const visualPrompts = packet.visualPrompts || packet.productionNotes?.assetPrompts || [];
  const lines = {
    archivist: [
      "EVIDENCE PACK",
      ...evidence.slice(0, 5).map((item, index) => `${index + 1}. ${item.quote || item.text || item.sourceLine}`),
      "",
      `Creation brief: ${operatorRequest}`
    ],
    strategist: [
      "CAMPAIGN DIRECTION",
      `Audience: ${packet.sourceProfile?.audience || "unknown/not enough source"}`,
      `Promise: ${packet.strategicBrief?.promise || evidence[0]?.quote || "unknown/not enough source"}`,
      `Tension: ${packet.strategicBrief?.tension || "unknown/not enough source"}`,
      `Angle: ${packet.strategicBrief?.transformation || "Lead with the strongest source-backed change."}`,
      `CTA: ${variants[0]?.cta || packet.frame?.cta || "Use the source-defined next action."}`,
      "",
      "Hooks:",
      ...hooks.slice(0, 4).map((item, index) => `${index + 1}. ${item.line || item}`)
    ],
    scriptwriter: [
      "CONTENT DRAFT",
      `Hook: ${hooks[0]?.line || hooks[0] || variants[0]?.hook || evidence[0]?.quote}`,
      "",
      ...scripts.slice(0, 6).map((item) => `${item.time || item.beat || item.purpose || "Beat"}: ${item.line}`),
      "",
      `Caption: ${packet.captions?.[0] || variants[0]?.caption || ""}`,
      `CTA: ${variants[0]?.cta || packet.frame?.cta || ""}`
    ],
    "creative-director": [
      "CREATIVE DIRECTION",
      `Visual system: ${packet.creativeDirection?.visualDirection || packet.productionNotes?.visualDirection || "Source-specific documentary detail with clear product proof."}`,
      "",
      "Shot / asset prompts:",
      ...visualPrompts.slice(0, 6).map((item, index) => `${index + 1}. ${typeof item === "string" ? item : item.prompt || item.description}`),
      "",
      `Thumbnail: ${packet.thumbnailPrompts?.[0] || "Feature the strongest concrete proof with one readable focal point."}`
    ],
    qa: [
      "CONTENT QA",
      `Verdict: ${packet.tierZeroQa?.verdict || packet.qaVerdict?.verdict || "review"}`,
      `Score: ${packet.tierZeroQa?.score?.overall ?? packet.qaVerdict?.score?.overall ?? "inspect"}`,
      `Claim support: ${(packet.claimMap || []).filter((claim) => claim.publishable !== false).length}/${(packet.claimMap || []).length} publishable`,
      "",
      ...((packet.tierZeroQa?.repairSuggestions || packet.qaVerdict?.repairSuggestions || ["No blocked repairs."]).slice(0, 5).map((item) => `- ${item}`)),
      "",
      `Next: ${packet.tierZeroQa?.nextBestStep || packet.nextAction || "Export the approved packet."}`
    ],
    export: [
      "EXPORT-READY CONTENT SET",
      ...variants.slice(0, 4).flatMap((item) => [
        `\n${item.platform}`,
        `Hook: ${item.hook}`,
        `Caption: ${item.caption || ""}`,
        `CTA: ${item.cta}`
      ]),
      "",
      "Promote this answer, then use Export Answer to write the local Markdown and JSON bundle."
    ]
  };
  const answer = (lines[agent.id] || lines.strategist).filter((line) => line !== undefined && line !== null).join("\n");
  const providerTruth = llmStatus?.live
    ? `\n\nDraft source: Instant Local Draft. ${llmStatus.model || "Installed model"} is available for streamed replacement.`
    : "\n\nDraft source: Instant Local Draft.";
  return `${answer}${providerTruth}`;
}

async function ollamaStatus() {
  if (ollamaStatusCache && Date.now() - ollamaStatusCache.checkedAt < 15000) return ollamaStatusCache.status;
  for (const url of OLLAMA_URLS) {
    try {
      const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(900) });
      if (!response.ok) continue;
      const data = await response.json();
      const models = Array.isArray(data.models) ? data.models.map((model) => model.name).filter(Boolean) : [];
      const status = { live: true, url, models, model: OLLAMA_MODEL || models[0] || null };
      ollamaStatusCache = { checkedAt: Date.now(), status };
      return status;
    } catch {
      // Try next configured runtime.
    }
  }
  const status = { live: false, url: OLLAMA_URLS[0] || null, models: [], model: OLLAMA_MODEL || null };
  ollamaStatusCache = { checkedAt: Date.now(), status };
  return status;
}

async function askOllama({ status, agent, message, context, profile }) {
  if (!status.live || !status.model) return null;
  if (!profile?.timeoutMs) return null;
  const citations = context.sources.map((item, index) => `[${index + 1}] ${item.title} (${item.lane}): ${item.excerpt}`).join("\n");
  const media = context.media.map((item, index) => `[M${index + 1}] ${item.title} (${item.kind}): ${item.path}`).join("\n");
  const prompt = [
    `You are ${agent.label}, a WAKE Engine V6 local agent.`,
    agent.persona,
    "Answer Justin directly. Use the retrieved IP. Do not invent capabilities or facts. Cite source titles inline when useful.",
    "",
    "Retrieved IP:",
    citations || "No matching text source.",
    "",
    "Retrieved media:",
    media || "No matching media asset.",
    "",
    `Justin: ${message}`
  ].join("\n");
  try {
    const response = await fetch(`${status.url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: status.model,
        prompt,
        stream: false,
        options: { num_predict: profile.numPredict, temperature: profile.temperature }
      }),
      signal: AbortSignal.timeout(profile.timeoutMs)
    });
    if (!response.ok) return null;
    const data = await response.json();
    return String(data.response || "").trim() || null;
  } catch {
    return null;
  }
}

async function streamOllama({ status, agent, message, context, profile, onToken }) {
  if (!status.live || !status.model || !profile?.timeoutMs) return "";
  const citations = context.sources.map((item, index) => `[${index + 1}] ${item.title} (${item.lane}): ${item.excerpt}`).join("\n");
  const media = context.media.map((item, index) => `[M${index + 1}] ${item.title} (${item.kind}): ${item.path}`).join("\n");
  const prompt = [
    `You are ${agent.label}, a WAKE Engine V6 local agent.`,
    agent.persona,
    "Answer Justin directly. Use retrieved IP. Do not invent facts. Be concrete. End with the next action.",
    "",
    "Retrieved IP:",
    citations || "No matching text source.",
    "",
    "Retrieved media:",
    media || "No matching media asset.",
    "",
    `Justin: ${message}`
  ].join("\n");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), profile.timeoutMs);
  let answer = "";
  try {
    const response = await fetch(`${status.url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: status.model,
        prompt,
        stream: true,
        options: { num_predict: profile.numPredict, temperature: profile.temperature }
      }),
      signal: controller.signal
    });
    if (!response.ok || !response.body) return "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const payload = JSON.parse(line);
        const token = String(payload.response || "");
        if (token) {
          answer += token;
          onToken(token);
        }
      }
    }
    return answer.trim();
  } catch {
    return answer.trim();
  } finally {
    clearTimeout(timer);
  }
}

function chatTitle(agent, message) {
  return `${agent.label}: ${String(message || "").slice(0, 54).trim() || "Agent Chat"}`;
}

function fileKind(ext) {
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  if (DOC_EXTENSIONS.has(ext)) return "document";
  return "file";
}

const DRIVE_TYPE_LABELS = {
  2: "removable",
  3: "fixed",
  4: "network",
  5: "optical"
};

function bytesToGb(value) {
  const numeric = Number(value || 0);
  return numeric > 0 ? Math.round((numeric / 1024 / 1024 / 1024) * 10) / 10 : null;
}

function defaultContentRoots() {
  const home = os.homedir();
  return ["Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music"]
    .map((name) => path.join(home, name))
    .filter((root) => fs.existsSync(root) && !containsCloudPath(root));
}

function fallbackLocalDrives() {
  if (process.platform !== "win32") {
    return ["/"].filter((root) => fs.existsSync(root)).map((root) => ({
      root,
      label: root,
      type: "fixed",
      eligible: !containsCloudPath(root),
      reason: containsCloudPath(root) ? "cloud path excluded" : null
    }));
  }
  const drives = [];
  for (let code = 65; code <= 90; code += 1) {
    const root = `${String.fromCharCode(code)}:\\`;
    if (fs.existsSync(root)) {
      drives.push({
        root,
        label: root,
        type: "fixed",
        eligible: !containsCloudPath(root),
        reason: containsCloudPath(root) ? "cloud path excluded" : null
      });
    }
  }
  return drives;
}

async function detectLocalDrives() {
  if (process.platform !== "win32") return fallbackLocalDrives();
  try {
    const script = "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,DriveType,VolumeName,FileSystem,Size,FreeSpace | ConvertTo-Json -Compress";
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", script], { windowsHide: true, timeout: 8000 });
    const parsed = JSON.parse(stdout.trim() || "[]");
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .filter((row) => row?.DeviceID)
      .map((row) => {
        const root = `${row.DeviceID}\\`;
        const type = DRIVE_TYPE_LABELS[Number(row.DriveType)] || "unknown";
        const eligible = ["fixed", "removable"].includes(type) && fs.existsSync(root) && !containsCloudPath(root);
        return {
          root,
          label: row.VolumeName ? `${row.DeviceID} ${row.VolumeName}` : root,
          type,
          fileSystem: row.FileSystem || null,
          sizeGb: bytesToGb(row.Size),
          freeGb: bytesToGb(row.FreeSpace),
          eligible,
          reason: eligible ? null : type === "network" ? "network drive excluded" : type === "optical" ? "optical drive excluded" : containsCloudPath(root) ? "cloud path excluded" : "not available"
        };
      });
  } catch {
    return fallbackLocalDrives();
  }
}

async function walkIntakeRoots(roots) {
  const files = [];
  const stack = roots.filter((root) => fs.existsSync(root) && !containsCloudPath(root));
  let visitedDirectories = 0;
  while (stack.length && files.length < INTAKE_MAX_FILES && visitedDirectories < INTAKE_MAX_DIRECTORIES) {
    const current = stack.pop();
    visitedDirectories += 1;
    if (visitedDirectories % 80 === 0) await yieldToRuntime();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (containsCloudPath(fullPath)) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIR_NAMES.has(entry.name.toLowerCase())) stack.push(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (INTAKE_EXTENSIONS.has(ext)) files.push(fullPath);
      }
      if (files.length >= INTAKE_MAX_FILES) break;
    }
  }
  return { files, visitedDirectories, directoryLimitHit: stack.length > 0 && visitedDirectories >= INTAKE_MAX_DIRECTORIES };
}

function readTextExcerpt(filePath, ext, size) {
  if (!TEXT_EXTENSIONS.has(ext) || size > MAX_TEXT_BYTES) return "";
  try {
    return fs.readFileSync(filePath, "utf8").replace(/\s+/g, " ").trim().slice(0, 2400);
  } catch {
    return "";
  }
}

function makeIntakeSource(entry) {
  return [
    `# ${entry.name}`,
    "",
    `Lane: ${entry.lane}`,
    `Source type: local_disk`,
    `Local path: ${entry.path}`,
    `Extraction: ${entry.extractStatus}`,
    `Tags: ${(entry.tags || []).join(", ")}`,
    "",
    "## Extracted Content",
    "",
    entry.excerpt || `Metadata-only entry for ${entry.kind} file. Full source is referenced at ${entry.path}.`
  ].join("\n");
}

async function runLocalIntake(store, input = {}) {
  const roots = Array.isArray(input.roots) && input.roots.length ? input.roots.map((root) => path.resolve(String(root))) : INTAKE_ROOTS;
  const scan = await walkIntakeRoots(roots);
  const files = scan.files;
  const projectId = String(input.projectId || store.projects[0]?.id || "wake-v6-main");
  const contextText = intakeContextText(store, input, projectId);
  const existingSourceKeys = new Set(store.sources.map((source) => source.importKey).filter(Boolean));
  const existingMediaKeys = new Set(store.mediaAssets.map((asset) => asset.importKey).filter(Boolean));
  let sourceAdded = 0;
  let mediaAdded = 0;
  let scannedText = 0;
  let scannedMedia = 0;
  let skippedOperational = 0;
  for (const [index, filePath] of files.entries()) {
    if (index > 0 && index % 120 === 0) await yieldToRuntime();
    if (containsCloudPath(filePath)) continue;
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    const ext = path.extname(filePath).toLowerCase();
    const kind = fileKind(ext);
    const excerpt = readTextExcerpt(filePath, ext, stat.size);
    const laneMatch = matchLane(`${filePath}\n${excerpt}`) || { lane: { name: "General Source", category: "general_source" }, hits: [] };
    const importKey = `intake:${filePath.toLowerCase()}`;
    const entry = {
      id: `asset-${stableId(filePath)}`,
      title: path.basename(filePath),
      name: path.basename(filePath),
      path: filePath,
      extension: ext,
      kind,
      lane: laneMatch.lane.name,
      tags: [...new Set(laneMatch.hits)],
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      excerpt,
      extractStatus: excerpt ? "text_extracted" : kind === "document" ? "metadata_only_document" : "metadata_only_media",
      importKey,
      importedAt: now()
    };
    const eligibility = creativeEligibility({ ...entry, sourcePath: filePath, source: excerpt });
    const decision = classifyIntakeEntry(entry, eligibility, contextText);
    if (decision.status === "excluded" || decision.status === "review") {
      skippedOperational += 1;
      continue;
    }
    if (kind === "text" || (kind === "document" && excerpt)) {
      scannedText += 1;
      if (!existingSourceKeys.has(importKey)) {
        const sourceText = makeIntakeSource(entry);
        store.sources.unshift({
          id: id("src"),
          projectId,
          title: `[${entry.lane}] ${entry.title}`,
          source: sourceText,
          characterCount: sourceText.length,
          importKey,
          sourceType: "local_disk",
          sourcePath: filePath,
          lane: entry.lane,
          tags: entry.tags,
          intakeDecision: decision,
          createdAt: now(),
          updatedAt: now()
        });
        existingSourceKeys.add(importKey);
        sourceAdded += 1;
      }
    } else {
      scannedMedia += 1;
      if (!existingMediaKeys.has(importKey)) {
        store.mediaAssets.unshift({ ...entry, projectId, intakeDecision: decision });
        existingMediaKeys.add(importKey);
        mediaAdded += 1;
      }
    }
  }
  store.sources = store.sources.slice(0, 2000);
  store.mediaAssets = store.mediaAssets.slice(0, 5000);
  const run = {
    id: id("intake"),
    roots,
    scanned: files.length,
    visitedDirectories: scan.visitedDirectories,
    directoryLimitHit: scan.directoryLimitHit,
    scannedText,
    scannedMedia,
    skippedOperational,
    sourceAdded,
    mediaAdded,
    projectId,
    createdAt: now()
  };
  store.intakeRuns.unshift(run);
  store.intakeRuns = store.intakeRuns.slice(0, 50);
  recordHistory(store, "intake.completed", `Intake scanned ${files.length} files, added ${sourceAdded} sources and ${mediaAdded} media assets, and excluded ${skippedOperational} operational files.`, run);
  addMonitorLog("ok", `Intake added ${sourceAdded} sources / ${mediaAdded} media assets; excluded ${skippedOperational} operational files.`);
  return run;
}

function intakeEntryFromFile(filePath, stat, contextText = "") {
  const ext = path.extname(filePath).toLowerCase();
  const kind = fileKind(ext);
  const excerpt = readTextExcerpt(filePath, ext, stat.size);
  const laneMatch = matchLane(`${filePath}\n${excerpt}`) || { lane: { name: "General Source", category: "general_source" }, hits: [] };
  const importKey = `intake:${filePath.toLowerCase()}`;
  const entry = {
    id: `asset-${stableId(filePath)}`,
    reviewId: `candidate-${stableId(filePath)}`,
    title: path.basename(filePath),
    name: path.basename(filePath),
    path: filePath,
    extension: ext,
    kind,
    lane: laneMatch.lane.name,
    tags: [...new Set(laneMatch.hits)],
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    excerpt,
    extractStatus: excerpt ? "text_extracted" : kind === "document" ? "metadata_only_document" : "metadata_only_media",
    importKey,
    importedAt: now()
  };
  const eligibility = creativeEligibility({ ...entry, sourcePath: filePath, source: excerpt });
  const decision = classifyIntakeEntry(entry, eligibility, contextText);
  return {
    ...entry,
    eligible: eligibility.eligible && decision.status !== "excluded",
    reason: decision.reason || eligibility.reason,
    decision,
    decisionStatus: decision.status,
    decisionReason: decision.reason,
    decisionConfidence: decision.confidence,
    recommended: decision.recommended,
    importAs: kind === "text" || (kind === "document" && excerpt) ? "source" : "media"
  };
}

async function buildIntakeReview(store, input = {}) {
  const roots = Array.isArray(input.roots) && input.roots.length ? input.roots.map((root) => path.resolve(String(root))) : INTAKE_ROOTS;
  const scan = await walkIntakeRoots(roots);
  const files = scan.files;
  const projectId = String(input.projectId || store.projects[0]?.id || "wake-v6-main");
  const contextText = intakeContextText(store, input, projectId);
  const existingSourceKeys = new Set(store.sources.map((source) => source.importKey).filter(Boolean));
  const existingMediaKeys = new Set(store.mediaAssets.map((asset) => asset.importKey).filter(Boolean));
  const candidates = [];
  let eligible = 0;
  let alreadyImported = 0;
  let skippedOperational = 0;
  let recommended = 0;
  let reviewNeeded = 0;
  for (const [index, filePath] of files.entries()) {
    if (index > 0 && index % 120 === 0) await yieldToRuntime();
    if (containsCloudPath(filePath)) continue;
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    const entry = intakeEntryFromFile(filePath, stat, contextText);
    const exists = entry.importAs === "source" ? existingSourceKeys.has(entry.importKey) : existingMediaKeys.has(entry.importKey);
    if (exists) alreadyImported += 1;
    if (entry.decisionStatus === "excluded") skippedOperational += 1;
    if (entry.decisionStatus === "recommended" && !exists) recommended += 1;
    if (entry.decisionStatus === "review" && !exists) reviewNeeded += 1;
    if (entry.eligible && !exists) eligible += 1;
    if (candidates.length < INTAKE_REVIEW_MAX_CANDIDATES) {
      candidates.push({
        ...entry,
        alreadyImported: exists,
        excerpt: entry.excerpt ? entry.excerpt.slice(0, 600) : "",
        approved: false
      });
    }
  }
  return {
    id: id("intake-review"),
    status: "awaiting-review",
    roots,
    projectId,
    scanned: files.length,
    visitedDirectories: scan.visitedDirectories,
    directoryLimitHit: scan.directoryLimitHit,
    candidateLimitHit: candidates.length < files.length,
    candidateLimit: INTAKE_REVIEW_MAX_CANDIDATES,
    eligible,
    recommended,
    reviewNeeded,
    alreadyImported,
    skippedOperational,
    candidates,
    createdAt: now()
  };
}

function importReviewedCandidates(store, review, candidateIds = []) {
  const wanted = new Set(candidateIds.map(String));
  const importAllEligible = wanted.size === 0;
  const existingSourceKeys = new Set(store.sources.map((source) => source.importKey).filter(Boolean));
  const existingMediaKeys = new Set(store.mediaAssets.map((asset) => asset.importKey).filter(Boolean));
  let sourceAdded = 0;
  let mediaAdded = 0;
  let skipped = 0;
  for (const candidate of review.candidates || []) {
    if (!importAllEligible && !wanted.has(candidate.reviewId)) continue;
    if (!candidate.eligible || candidate.alreadyImported || candidate.decisionStatus === "excluded") {
      skipped += 1;
      continue;
    }
    if (candidate.importAs === "source") {
      if (existingSourceKeys.has(candidate.importKey)) {
        skipped += 1;
        continue;
      }
      const sourceText = makeIntakeSource(candidate);
      store.sources.unshift({
        id: id("src"),
        projectId: review.projectId,
        title: `[${candidate.lane}] ${candidate.title}`,
        source: sourceText,
        characterCount: sourceText.length,
        importKey: candidate.importKey,
        sourceType: "local_disk",
        sourcePath: candidate.path,
        lane: candidate.lane,
        tags: candidate.tags,
        intakeDecision: candidate.decision,
        createdAt: now(),
        updatedAt: now()
      });
      existingSourceKeys.add(candidate.importKey);
      sourceAdded += 1;
    } else {
      if (existingMediaKeys.has(candidate.importKey)) {
        skipped += 1;
        continue;
      }
      store.mediaAssets.unshift({ ...candidate, id: `asset-${stableId(candidate.path)}`, projectId: review.projectId, importedAt: now(), intakeDecision: candidate.decision });
      existingMediaKeys.add(candidate.importKey);
      mediaAdded += 1;
    }
  }
  store.sources = store.sources.slice(0, 2000);
  store.mediaAssets = store.mediaAssets.slice(0, 5000);
  return { sourceAdded, mediaAdded, skipped };
}

function audienceFor(meta, terms) {
  const lane = (meta.lane || "").toLowerCase();
  if (lane.includes("storytime") || terms.includes("aurora")) return "parents, educators, and families looking for warm story-driven content";
  if (lane.includes("mirror") || terms.includes("respawn")) return "operators rebuilding identity, discipline, and execution after a reset";
  if (lane.includes("forgefront")) return "founders and operators who need systems, automation, and proof of execution";
  if (lane.includes("wake")) return "Wake Engine operators turning scattered source material into repeatable output";
  return "operators who need a clean source-to-output workflow";
}

function visualFor(meta, terms) {
  const lane = (meta.lane || "").toLowerCase();
  if (lane.includes("storytime")) return "warm illustrated storybook frames, gentle camera movement, readable title cards, and soft ember/steel accents";
  if (lane.includes("mirror")) return "dim mirror imagery, harsh side light, hands working, blueprint overlays, and restrained industrial motion";
  if (lane.includes("forgefront")) return "ForgeFront emblem lockup, dark glass panels, cyan telemetry lines, orange execution accents, and system diagrams";
  return `source-first visuals around ${terms.slice(0, 3).join(", ")}, with text overlays limited to proof phrases`;
}

function titleCase(value) {
  const minor = new Set(["a", "an", "and", "as", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with"]);
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const clean = word.replace(/[^a-z0-9'-]/gi, "");
      if (!clean) return "";
      if (/^[A-Z0-9]{2,}$/.test(clean)) return clean;
      const lower = clean.toLowerCase();
      if (index > 0 && minor.has(lower)) return lower;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function titleFromSource(source) {
  const clean = stripInstructionWrapper(sourceContent(source) || source);
  if (!clean) return "Untitled Source";
  const sentence = clean.split(/[.!?\n]/).find((part) => part.trim().length > 8) || clean;
  const firstClause = sentence.split(/[,;]|\s+-\s+/).find((part) => part.trim().length > 8) || sentence;
  const titled = titleCase(firstClause);
  if (titled.length <= 68) return titled.replace(/[:\s-]+$/g, "");
  const clipped = titled.slice(0, 68);
  return clipped.slice(0, Math.max(0, clipped.lastIndexOf(" "))).replace(/[:\s-]+$/g, "");
}

function topTerms(source) {
  const stop = new Set([
    "about", "after", "also", "and", "are", "but", "can", "for", "from", "have", "into", "like", "not", "our", "that", "the", "their", "then", "there", "this", "with", "your"
    , "build", "create", "draft", "generate", "honestly", "live", "marks", "shows", "talking", "points", "unverified", "verified", "video", "what"
  ]);
  const counts = new Map();
  for (const word of words(source).map((item) => item.toLowerCase())) {
    if (word.length < 4 || stop.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([term, count]) => ({ term, count }));
}

function makeFrame(source) {
  const rawInput = source.trim();
  const input = stripInstructionWrapper(sourceContent(rawInput) || rawInput);
  const list = words(input);
  const title = sourceTitle(rawInput);
  const isVideo = /video|clip|reel|short|tiktok|youtube|caption|thumbnail/i.test(rawInput);
  const isSystem = /agent|engine|workflow|automation|console|runtime/i.test(rawInput);
  const terms = topTerms(input).slice(0, 4).map((item) => item.term);
  return {
    title,
    duration: isVideo ? "60s" : "n/a",
    format: isVideo ? "vertical" : "structured brief",
    role: isVideo ? "Content Agent" : isSystem ? "Systems Agent" : "Prompt Builder",
    objective: isVideo
      ? `Turn "${title}" into a short-form content packet with hooks, scenes, captions, and CTA.`
      : `Turn "${title}" into a structured, auditable source operating frame.`,
    scenes: isVideo ? 6 : 3,
    hooks: Math.min(3, Math.max(1, Math.ceil(list.length / 24))),
    cta: isVideo ? "Use the source-backed packet for the next publish step." : "Run the next verified source-backed action.",
    constraints: [
      "No fake capability claims.",
      "Keep local outputs auditable.",
      "Keep output inspectable and copyable."
    ],
    focusTerms: terms,
    sourceCharacterCount: rawInput.length
  };
}

function makeContentCluster(source, packetInput = null) {
  const input = sourceContent(source) || source.trim();
  const title = sourceTitle(source);
  const terms = topTerms(input);
  const focusTerms = terms.length ? terms.map((item) => item.term) : ["source", "structure", "output"];
  const focusA = focusTerms[0] || "source";
  const focusB = focusTerms[1] || "structure";
  const focusC = focusTerms[2] || "output";
  const packet = packetInput || makePack(source);
  const scripts = packet.scripts || packet.scenePlan || [];
  const hooks = packet.hooks || [];
  const titles = packet.titles || [];
  const captions = packet.captions || [];
  const variants = packet.platformVariants || [];
  const shortVariant = variants.find((item) => /short|tiktok|reel/i.test(item.platform || "")) || variants[0] || {};
  const youtubeVariant = variants.find((item) => /youtube/i.test(item.platform || "")) || {
    platform: "YouTube",
    hook: hooks[0] || packet.strategicBrief?.promise || title,
    structure: "long-form outline plus short cutdown",
    caption: captions[0] || packet.strategicBrief?.operatorTakeaway || title,
    cta: packet.nextAction || "Review the source-backed packet."
  };
  const linkedInVariant = variants.find((item) => /linkedin/i.test(item.platform || "")) || variants[variants.length - 1] || {};
  const carousel = packet.contentArsenal?.carousel || {
    slides: (packet.claimMap || []).slice(0, 5).map((claim, index) => ({
      slide: index + 1,
      headline: claim.onScreenText || `Source proof ${index + 1}`,
      body: claim.sourceLine
    }))
  };
  const distributionPlan = [
    {
      lane: "Shorts / Reels / TikTok",
      action: "Publish the strongest short-form script first.",
      source: "shortsReelsTikTok"
    },
    {
      lane: "YouTube",
      action: "Use the long-form outline or short cutdown as the second asset.",
      source: "youtube"
    },
    {
      lane: "LinkedIn",
      action: "Turn the proof and implication into an operator note.",
      source: "linkedin"
    },
    {
      lane: "Carousel",
      action: "Ship the evidence-led carousel as a follow-up education asset.",
      source: "carousel"
    },
    {
      lane: "QA",
      action: "Keep every claim tied to the evidence and citation maps.",
      source: "claimMap"
    }
  ];
  const platformLanes = {
    shortsReelsTikTok: {
      platform: "Shorts / Reels / TikTok",
      hook: shortVariant.hook || hooks[0],
      caption: shortVariant.caption || captions[0],
      script: scripts.slice(0, 6),
      cta: shortVariant.cta || packet.nextAction,
      thumbnailPrompt: packet.productionNotes?.assetPrompts?.[0] || packet.thumbnailPrompts?.[0] || `Source-backed thumbnail for ${title}`
    },
    youtube: {
      platform: "YouTube",
      hook: youtubeVariant.hook,
      caption: youtubeVariant.caption,
      outline: packet.contentArsenal?.longFormOutline || scripts,
      cta: youtubeVariant.cta || packet.nextAction
    },
    linkedin: {
      platform: "LinkedIn",
      hook: linkedInVariant.hook || hooks[1] || hooks[0],
      caption: linkedInVariant.caption || captions[1] || captions[0],
      cta: linkedInVariant.cta || packet.nextAction,
      proofLine: packet.claimMap?.[0]?.sourceLine || packet.strategicBrief?.promise
    },
    carousel
  };
  const quoteEvidencePack = {
    quotes: packet.quotePack || [],
    evidence: packet.evidenceMap || packet.claimMap || [],
    citations: packet.citationMap || [],
    claims: packet.claimMap || []
  };
  const exportManifest = {
    ...(packet.exportManifest || {}),
    title,
    status: packet.tierZeroQa?.passed || packet.tierZeroQa?.score?.passed ? "pass" : "blocked",
    nextAction: packet.nextAction || packet.operatorHandoff?.nextBestStep || "Review QA, then export the packet.",
    requiredSections: Array.from(new Set([
      ...(packet.exportManifest?.requiredSections || []),
      ...CLUSTER_REQUIRED_FIELDS,
      "sourceProfile",
      "evidenceMap",
      "citationMap",
      "claimMap",
      "platformVariants",
      "exportManifest"
    ]))
  };
  const cluster = {
    ok: packet.tierZeroQa?.passed === true,
    generatedAt: new Date().toISOString(),
    engine: "WAKE Engine Tier Zero creation cluster",
    sourceInbox: {
      title,
      characters: input.length,
      terms,
      proofStatus: "local-only"
    },
    campaignPacket: {
      title,
      promise: packet.strategicBrief?.promise,
      audience: packet.sourceProfile?.audience,
      nextAction: packet.nextAction || packet.operatorHandoff?.nextBestStep || "Review QA, then export the packet.",
      distributionPlan
    },
    sourceProfile: packet.sourceProfile,
    pillars: [
      {
        id: "cluster-proof",
        label: "Proof / Trust",
        theme: `Show what is real about ${focusA}.`,
        angle: "Lead with verified capability, limits, and next action."
      },
      {
        id: "cluster-system",
        label: "System / Process",
        theme: `Turn ${focusB} into repeatable steps.`,
        angle: "Make the invisible workflow legible enough to hand off."
      },
      {
        id: "cluster-output",
        label: "Output / Distribution",
        theme: `Package ${focusC} into reusable assets.`,
        angle: "Separate shorts, captions, titles, hooks, prompts, and dispatch notes."
      }
    ],
    outputMatrix: [
      { lane: "Shorts", count: 3, status: "ready-local", detail: "Use frame objective, hooks, and scene list." },
      { lane: "Captions", count: 5, status: "ready-local", detail: "Use proof-first captions with no fake operator claims." },
      { lane: "Titles", count: 5, status: "ready-local", detail: "Use source title plus cluster pillar angles." },
      { lane: "Quote Pack", count: 4, status: "ready-local", detail: "Pull crisp statements from the pasted source only." },
      { lane: "Thumbnail Directions", count: 3, status: "ready-local", detail: "Describe visual direction prompts from the pasted source." },
      { lane: "Prompt Pack", count: 4, status: "ready-local", detail: "Create prompts for follow-up agents and manual review." }
    ],
    platformLanes,
    shortsReelsTikTok: platformLanes.shortsReelsTikTok,
    youtube: platformLanes.youtube,
    linkedin: platformLanes.linkedin,
    carousel: platformLanes.carousel,
    hooks,
    titles,
    captions,
    scripts,
    platformVariants: variants,
    productionNotes: packet.productionNotes || {},
    thumbnailPrompts: packet.productionNotes?.assetPrompts || packet.thumbnailPrompts || [],
    visualPrompts: packet.productionNotes?.assetPrompts || packet.visualPrompts || packet.thumbnailPrompts || [],
    quotePack: packet.quotePack,
    quoteEvidencePack,
    evidenceMap: packet.evidenceMap || packet.claimMap,
    citationMap: packet.citationMap || [],
    claimMap: packet.claimMap,
    creativeDirection: packet.creativeDirection || {
      visualDirection: packet.productionNotes?.visualDirection || packet.creativeSystem?.visualDirection || "",
      editRules: packet.productionNotes?.editRules || packet.creativeSystem?.editRules || [],
      assetPrompts: packet.productionNotes?.assetPrompts || []
    },
    distributionPlan,
    qaVerdict: packet.qaVerdict || packet.qaGate,
    repairSuggestions: packet.repairSuggestions || packet.tierZeroQa?.repairSuggestions || [],
    nextAction: packet.nextAction || packet.operatorHandoff?.nextBestStep || "Review QA, then export the packet.",
    a2aTrace: packet.a2aTrace || [],
    agentInbox: packet.agentInbox || {},
    agentOutbox: packet.agentOutbox || {},
    replayableHandoffs: packet.replayableHandoffs || [],
    toolTrace: packet.toolTrace || [],
    exportManifest,
    dispatchQueue: [
      { operator: "Proof Pack", status: "ready-local", action: "Review claims", detail: "Packages proof notes and constraints for human review." },
      { operator: "Script Pack", status: "ready-local", action: "Shape scripts", detail: "Packages hooks, scenes, captions, and CTAs for production." },
      { operator: "Memory Pack", status: "ready-local", action: "Save learning", detail: "Persists source, output, export, and history records locally." },
      { operator: "Export Pack", status: "ready-local", action: "Ship files", detail: "Writes markdown and JSON deliverables to the local export folder." }
    ],
    auditNotes: [
      "Cluster generation is deterministic and local.",
      "Dispatch cards create local handoff packages.",
      "No outside app is claimed as active inside V6."
    ]
  };
  const clusterInspection = inspectContentCluster(cluster);
  return {
    ...cluster,
    ok: clusterInspection.ok,
    clusterInspection
  };
}

function autonomousProjectSource(store, projectId, direction = "", unsavedSource = "") {
  const requestedDirection = String(direction || "").trim();
  const currentSource = String(unsavedSource || "").trim();
  const projectSources = store.sources
    .filter((item) => (!projectId || item.projectId === projectId) && !recordHasCloudProvenance(item) && isCreativeSourceEligible(item))
    .slice(0, 8);
  if (!projectSources.length && currentSource.length < 40 && requestedDirection.length < 40) {
    const error = new Error("Wake needs either existing project knowledge or one clear direction before it can create autonomously.");
    error.status = 400;
    throw error;
  }
  const knowledge = projectSources.map((item, index) => {
    const content = sourceContent(item.source).trim().slice(0, 2600);
    return `## Project source ${index + 1}: ${item.title.replace(/^\[[^\]]+\]\s*/, "")}\n${content}`;
  });
  if (currentSource) knowledge.unshift(`## Current unsaved source\n${currentSource.slice(0, 5000)}`);
  return {
    source: [
      requestedDirection ? `# Creative direction\n${requestedDirection}` : "# Autonomous campaign brief\nUse the strongest current project opportunity and create an original campaign without waiting for more operator input.",
      "# Project knowledge",
      ...knowledge
    ].join("\n\n").slice(0, 18000),
    requestedDirection,
    projectSources,
    currentSource,
    knowledgeSourceCount: projectSources.length + (currentSource ? 1 : 0),
    primarySourceId: projectSources[0]?.id || null
  };
}

function parseModelJson(value) {
  const text = String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("The local creative model returned an invalid campaign packet.");
  }
}

function modelCreativeText(value, preferredKeys = []) {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return value.map((item) => modelCreativeText(item, preferredKeys)).filter(Boolean).join(" ").trim();
  if (!value || typeof value !== "object") return "";
  for (const key of preferredKeys) {
    const text = modelCreativeText(value[key]);
    if (text) return text;
  }
  return Object.values(value).map((item) => modelCreativeText(item)).filter(Boolean).join(" ").trim();
}

function creativeSeedMarkdown(seed) {
  const script = Array.isArray(seed.script) ? seed.script.map((line) => modelCreativeText(line, ["line", "voiceover", "narration", "text", "content"])).filter(Boolean).slice(0, 8) : [];
  const imagePrompts = Array.isArray(seed.imagePrompts) ? seed.imagePrompts.map((line) => modelCreativeText(line, ["prompt", "description", "scene"])).filter(Boolean).slice(0, 4) : [];
  const required = [seed.title, seed.premise, seed.hook, seed.caption, seed.cta, seed.visualDirection, script.length === 6, imagePrompts.length >= 2];
  if (required.some((value) => !value)) throw new Error("The local creative model returned an incomplete campaign packet.");
  return [
    `# ${String(seed.title).trim()}`,
    String(seed.premise).trim(),
    String(seed.centralIdea || seed.premise).trim(),
    String(seed.hook).trim(),
    "## Finished content",
    ...script,
    "## Social caption",
    String(seed.caption).trim(),
    "## Audience action",
    String(seed.cta).trim(),
    "## Visual concept",
    String(seed.visualDirection).trim(),
    ...imagePrompts
  ].join("\n\n");
}

const PUBLISHABLE_META_PATTERN = /(?:use the strongest current project opportunity|project source\s*\d*|current unsaved source|autonomous campaign brief|creative direction:|original creative premise:|central idea:|working checkpoint|status and gaps|desktop registry|local machine inventory|source excerpts?|proof markers?|do not rename things early)/i;
const GENERIC_CREATIVE_CTA_PATTERN = /^(?:learn more\b|read the story\b|share (?:it|this|the story)\b|follow for more\b|click (?:here|the link)\b|check it out\b|save this\b|review the source\b|review the packet\b)/i;

function normalizedCreativeSeed(seed = {}) {
  const normalized = {
    title: modelCreativeText(seed.title, ["title", "name"]),
    premise: modelCreativeText(seed.premise, ["premise", "description", "text"]),
    audience: modelCreativeText(seed.audience, ["primary", "audience", "description"]),
    centralIdea: modelCreativeText(seed.centralIdea || seed.premise, ["centralIdea", "idea", "message", "text"]),
    hook: modelCreativeText(seed.hook, ["hook", "line", "text"]),
    script: Array.isArray(seed.script) ? seed.script.map((line) => modelCreativeText(line, ["line", "voiceover", "narration", "text", "content"])).filter(Boolean).slice(0, 6) : [],
    caption: modelCreativeText(seed.caption, ["caption", "text"]),
    cta: modelCreativeText(seed.cta, ["cta", "callToAction", "text"]),
    visualDirection: modelCreativeText(seed.visualDirection, ["description", "direction", "style", "text"]),
    imagePrompts: Array.isArray(seed.imagePrompts) ? seed.imagePrompts.map((line) => modelCreativeText(line, ["prompt", "description", "scene"])).filter(Boolean).slice(0, 2) : []
  };
  const minimumLengths = { title: 3, premise: 8, audience: 3, centralIdea: 8, hook: 8, caption: 8, cta: 8, visualDirection: 8 };
  const missing = Object.entries(minimumLengths).filter(([key, length]) => normalized[key].length < length).map(([key]) => key);
  if (normalized.script.length !== 6 || normalized.script.some((line) => line.length < 8)) missing.push("script");
  if (normalized.imagePrompts.length !== 2 || normalized.imagePrompts.some((line) => line.length < 40)) missing.push("imagePrompts");
  const publishableText = JSON.stringify(normalized);
  if (PUBLISHABLE_META_PATTERN.test(publishableText)) missing.push("internal metadata leakage");
  if (GENERIC_CREATIVE_CTA_PATTERN.test(normalized.cta)) missing.push("project-specific CTA");
  if (missing.length) {
    const error = new Error(`The local creative model did not produce a publishable original campaign: ${Array.from(new Set(missing)).join(", ")}.`);
    error.status = 502;
    throw error;
  }
  return normalized;
}

function sanitizeOriginalCreativeArtifacts(value, rawSeed) {
  const seed = normalizedCreativeSeed(rawSeed);
  if (typeof value === "string") {
    return value
      .replace(/read the story and share its central lesson\.?/gi, seed.cta)
      .replace(/use visible details from [^;\n]+(?:;|\.)?\s*hero frame for [^\n]+/gi, seed.imagePrompts[0])
      .replace(/use visible details from [^;\n]+(?:;|\.)?/gi, seed.visualDirection)
      .replace(/source evidence card stack;?\s*premium content treatment;?\s*readable proof markers/gi, seed.imagePrompts[1])
      .replace(/readable source excerpts?/gi, "specific scene detail")
      .replace(/(?:readable )?proof markers?/gi, "specific visual detail");
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeOriginalCreativeArtifacts(item, seed));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeOriginalCreativeArtifacts(item, seed)]));
  }
  return value;
}

function assertOriginalCreativeArtifactsClean(value) {
  const text = JSON.stringify(value);
  const match = text.match(PUBLISHABLE_META_PATTERN) || text.match(/read the story and share its central lesson|\[object Object\]/i);
  if (match) {
    const error = new Error(`Campaign creation stopped because internal material reached a creative artifact: ${match[0]}.`);
    error.status = 500;
    throw error;
  }
}

function applyOriginalCreativeSeed(cluster, rawSeed) {
  if (!rawSeed) return cluster;
  const seed = normalizedCreativeSeed(rawSeed);
  cluster = sanitizeOriginalCreativeArtifacts(cluster, seed);
  const times = ["0:00-0:03", "0:03-0:12", "0:12-0:24", "0:24-0:38", "0:38-0:50", "0:50-1:00"];
  const beats = ["Open", "Tension", "Discovery", "Turn", "Resolution", "Action"];
  const scripts = seed.script.map((line, index) => ({
    time: times[index],
    beat: beats[index],
    purpose: beats[index],
    line,
    visual: index < 2 ? seed.imagePrompts[0] : seed.imagePrompts[1],
    evidenceId: cluster.claimMap?.[Math.min(index, Math.max(0, (cluster.claimMap?.length || 1) - 1))]?.id || null
  }));
  const hooks = [seed.hook, seed.centralIdea, seed.premise];
  const titles = [seed.title, `${seed.title}: ${seed.centralIdea}`, `${seed.title} | ${seed.hook}`];
  const captions = [seed.caption, `${seed.hook}\n\n${seed.caption}`, `${seed.centralIdea}\n\n${seed.cta}`];
  const platformVariants = [
    { platform: "TikTok / Shorts", hook: seed.hook, structure: "six-beat vertical story", caption: seed.caption, cta: seed.cta },
    { platform: "Instagram", hook: seed.centralIdea, structure: "visual reel or carousel", caption: seed.caption, cta: seed.cta },
    { platform: "X", hook: seed.hook, structure: "concise premise, turn, and resolution", caption: `${seed.centralIdea} ${seed.cta}`, cta: seed.cta },
    { platform: "LinkedIn", hook: seed.centralIdea, structure: "audience-relevant narrative and takeaway", caption: `${seed.premise}\n\n${seed.caption}`, cta: seed.cta },
    { platform: "YouTube", hook: seed.hook, structure: "complete narrative with conflict, turn, resolution, and lesson", caption: seed.caption, cta: seed.cta }
  ];
  const carousel = {
    slides: scripts.map((script, index) => ({
      slide: index + 1,
      headline: index === 0 ? seed.hook : beats[index],
      body: script.line
    }))
  };
  const platformLanes = {
    shortsReelsTikTok: {
      platform: "Shorts / Reels / TikTok",
      hook: seed.hook,
      caption: seed.caption,
      script: scripts,
      cta: seed.cta,
      thumbnailPrompt: seed.imagePrompts[0]
    },
    youtube: {
      platform: "YouTube",
      hook: seed.hook,
      caption: seed.caption,
      outline: scripts,
      cta: seed.cta
    },
    linkedin: {
      platform: "LinkedIn",
      hook: seed.centralIdea,
      caption: `${seed.premise}\n\n${seed.caption}`,
      cta: seed.cta,
      proofLine: seed.premise
    },
    carousel
  };
  const productionNotes = {
    ...(cluster.productionNotes || {}),
    visualDirection: seed.visualDirection,
    creativeDirection: seed.visualDirection,
    assetPrompts: seed.imagePrompts
  };
  const creativeDirection = {
    ...(cluster.creativeDirection || {}),
    visualDirection: seed.visualDirection,
    assetPrompts: seed.imagePrompts
  };
  const contentArsenal = {
    ...(cluster.contentArsenal || {}),
    shortForm60: {
      title: seed.title,
      runtime: "60s",
      voiceover: scripts.map((item) => `${item.time}: ${item.line}`).join("\n"),
      editPattern: "six-beat original narrative"
    },
    carousel,
    longFormOutline: scripts.map((item) => ({ section: item.beat, point: item.line }))
  };
  const updated = {
    ...cluster,
    sourceInbox: { ...(cluster.sourceInbox || {}), title: seed.title },
    sourceProfile: { ...(cluster.sourceProfile || {}), title: seed.title, audience: seed.audience },
    campaignPacket: {
      ...(cluster.campaignPacket || {}),
      title: seed.title,
      promise: seed.premise,
      audience: seed.audience,
      centralIdea: seed.centralIdea
    },
    hooks,
    titles,
    captions,
    scripts,
    scenePlan: scripts,
    platformVariants,
    platformLanes,
    shortsReelsTikTok: platformLanes.shortsReelsTikTok,
    youtube: platformLanes.youtube,
    linkedin: platformLanes.linkedin,
    carousel,
    contentArsenal,
    productionNotes,
    creativeDirection,
    thumbnailPrompts: seed.imagePrompts,
    visualPrompts: seed.imagePrompts,
    originalCreative: seed,
    exportManifest: { ...(cluster.exportManifest || {}), title: seed.title }
  };
  const sanitized = sanitizeOriginalCreativeArtifacts(updated, seed);
  assertOriginalCreativeArtifactsClean(sanitized);
  const clusterInspection = inspectContentCluster(sanitized);
  return { ...sanitized, ok: clusterInspection.ok, clusterInspection };
}

function deterministicAutopilotSeed(referenceBodies) {
  const source = referenceBodies.join("\n\n").slice(0, 18000);
  const sentences = sentenceCandidates(source);
  const terms = topTerms(source).map((item) => item.term).slice(0, 4);
  const focus = terms[0] || "the central idea";
  const first = sentences[0] || sourceContent(source).slice(0, 180) || "A clear idea deserves a finished creative treatment.";
  const second = sentences[1] || `The opportunity becomes stronger when ${focus} is concrete and useful.`;
  const third = sentences[2] || `A focused choice turns ${focus} into something an audience can act on.`;
  return normalizedCreativeSeed({
    title: sourceTitle(source),
    premise: first,
    audience: "the audience described in the approved material",
    centralIdea: second,
    hook: first,
    script: [
      first,
      second,
      third,
      `Show the moment when ${focus} changes the audience's understanding.`,
      `Resolve the idea with a concrete outcome grounded in ${terms[1] || focus}.`,
      `Invite the audience to take the next specific step with ${focus}.`
    ],
    caption: `${first} ${second}`,
    cta: `Put ${focus} into action with one concrete next step.`,
    visualDirection: `Create an original editorial scene centered on ${terms.join(", ") || focus}, with a clear subject, purposeful composition, natural lighting, and no rendered text.`,
    imagePrompts: [
      `Original vertical editorial scene centered on ${terms.join(", ") || focus}; one clear subject in action, grounded environment, natural cinematic lighting, specific foreground and background detail, no rendered text.`,
      `Original landscape campaign image expressing ${second}; decisive human-scale moment, layered composition, realistic material detail, purposeful color contrast, no logos and no rendered text.`
    ]
  });
}

async function generateAutonomousCreativeSeed(project, brief) {
  const referenceBodies = [
    brief.currentSource ? `Current source:\n${brief.currentSource}` : null,
    ...brief.projectSources.map((item) => `${item.title.replace(/^\[[^\]]+\]\s*/, "")}:\n${sourceContent(item.source)}`)
  ].filter(Boolean);
  if (process.env.WAKE_TEST_DETERMINISTIC_AUTOPILOT === "1") {
    const seed = deterministicAutopilotSeed(referenceBodies);
    return {
      source: creativeSeedMarkdown(seed),
      provider: "deterministic-test-path",
      model: null,
      originalDraft: false,
      referenceSourceIds: brief.projectSources.map((item) => item.id),
      seed
    };
  }
  const status = await ollamaStatus();
  if (!status.live || !status.model) {
    const error = new Error("Campaign Autopilot needs the installed local creative model online before it can create original content.");
    error.status = 503;
    throw error;
  }
  const prompt = [
    "You are the senior original-content creator inside Wake Engine.",
    `Create one finished, original campaign for the project named ${project?.name || "Current Project"}.`,
    brief.requestedDirection ? `Operator direction: ${brief.requestedDirection}` : "Choose the strongest original creative direction yourself.",
    "Treat references as brand, audience, product, or story-world constraints. Do not summarize the references.",
    "Never mention source files, documents, registries, checkpoints, systems, blueprints, prompts, or project administration in publishable copy.",
    "Never repeat these instructions. Create the actual content. For a story brand, invent a new complete story concept with a concrete character, conflict, resolution, and lesson.",
    "The hook, caption, and call to action must be finished audience-facing copy specific to this campaign. Never use generic directions such as read the story, share its lesson, learn more, follow for more, or review the source.",
    "Every script item must be one natural spoken beat with no field label. Every image prompt must name the campaign's actual characters, setting, action, composition, lighting, and art direction; never request source excerpts, proof markers, interface imagery, or rendered text.",
    "Return strict JSON only with keys: title, premise, audience, centralIdea, hook, script (6 concise finished beats), caption, cta, visualDirection, imagePrompts (2 detailed original image prompts).",
    "Keep every factual brand or offer claim within the references. Fictional story events may be original.",
    "",
    "ELIGIBLE PROJECT REFERENCES:",
    referenceBodies.join("\n\n---\n\n").slice(0, 14000)
  ].join("\n");
  const response = await fetch(`${status.url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: status.model,
      prompt,
      stream: false,
      format: "json",
      keep_alive: "10m",
      options: { num_predict: 1100, temperature: 0.78, top_p: 0.9 }
    }),
    signal: AbortSignal.timeout(90000)
  });
  if (!response.ok) {
    const error = new Error(`The local creative model failed with HTTP ${response.status}.`);
    error.status = 503;
    throw error;
  }
  const payload = await response.json();
  const seed = normalizedCreativeSeed(parseModelJson(payload.response));
  return {
    source: creativeSeedMarkdown(seed),
    provider: "ollama",
    model: status.model,
    originalDraft: true,
    referenceSourceIds: brief.projectSources.map((item) => item.id),
    seed
  };
}

function platformPreviewPackage(cluster, projectName) {
  const terms = cluster.sourceInbox?.terms?.slice(0, 5).map((item) => item.term) || [];
  const hashtags = terms.map((term) => `#${String(term).replace(/[^a-z0-9]+/gi, "")}`).filter((tag) => tag.length > 1);
  const title = cluster.campaignPacket?.title || cluster.sourceInbox?.title || "Original campaign";
  const short = cluster.platformLanes?.shortsReelsTikTok || {};
  const linkedIn = cluster.platformLanes?.linkedin || {};
  const xCaption = [cluster.hooks?.[1] || short.hook || title, cluster.quotePack?.[0] || linkedIn.proofLine || ""].filter(Boolean).join("\n\n").slice(0, 270);
  const instagramCaption = [short.caption || cluster.captions?.[0] || cluster.campaignPacket?.promise, hashtags.slice(0, 5).join(" ")].filter(Boolean).join("\n\n");
  return {
    tiktok: {
      id: "tiktok",
      label: "TikTok",
      format: "9:16",
      account: projectName,
      hook: short.hook || cluster.hooks?.[0] || title,
      caption: short.caption || cluster.captions?.[0] || cluster.campaignPacket?.promise,
      script: short.script || cluster.scripts?.slice(0, 6) || [],
      cta: short.cta || cluster.nextAction,
      hashtags: hashtags.slice(0, 5),
      imagePrompt: short.thumbnailPrompt || cluster.visualPrompts?.[0] || title,
      assetIndex: 0
    },
    instagram: {
      id: "instagram",
      label: "Instagram",
      format: "4:5",
      account: projectName,
      hook: cluster.hooks?.[1] || short.hook || title,
      caption: instagramCaption,
      cta: short.cta || cluster.nextAction,
      hashtags: hashtags.slice(0, 8),
      imagePrompt: cluster.visualPrompts?.[1] || cluster.visualPrompts?.[0] || title,
      assetIndex: 1
    },
    x: {
      id: "x",
      label: "X",
      format: "16:9",
      account: projectName,
      hook: cluster.hooks?.[2] || short.hook || title,
      caption: xCaption,
      cta: cluster.nextAction,
      hashtags: hashtags.slice(0, 2),
      imagePrompt: cluster.visualPrompts?.[1] || cluster.visualPrompts?.[0] || title,
      assetIndex: 1
    },
    linkedin: {
      id: "linkedin",
      label: "LinkedIn",
      format: "16:9",
      account: projectName,
      hook: linkedIn.hook || cluster.hooks?.[0] || title,
      caption: linkedIn.caption || cluster.captions?.[1] || cluster.campaignPacket?.promise,
      cta: linkedIn.cta || cluster.nextAction,
      proofLine: linkedIn.proofLine || cluster.quotePack?.[0],
      hashtags: hashtags.slice(0, 4),
      imagePrompt: cluster.visualPrompts?.[0] || title,
      assetIndex: 0
    }
  };
}

async function createAutonomousCampaign(store, input = {}) {
  const projectId = String(input.projectId || store.projects[0]?.id || "wake-v6-main");
  const project = store.projects.find((item) => item.id === projectId) || store.projects[0];
  const brief = autonomousProjectSource(store, projectId, input.direction, input.source);
  const creativeSeed = await generateAutonomousCreativeSeed(project, brief);
  const basePack = makePack(creativeSeed.source);
  const retrievalContext = retrieveContext(store, creativeSeed.source, "creative-director", 8, 8, projectId);
  const rawNetwork = runTierZeroNetwork({ source: creativeSeed.source, basePack, retrievalContext });
  const network = creativeSeed.seed ? sanitizeOriginalCreativeArtifacts(rawNetwork, creativeSeed.seed) : rawNetwork;
  const packet = {
    ...basePack,
    ...network.pack,
    ok: network.ok,
    engine: "WAKE Engine Tier Zero autonomous campaign network",
    generatedAt: network.generatedAt,
    tierZeroRuntime: network,
    packetContract: CANONICAL_PACKET_CONTRACT,
    tierZeroSpecStatus: TIER_ZERO_SPEC_STATUS
  };
  const cluster = applyOriginalCreativeSeed(makeContentCluster(creativeSeed.source, packet), creativeSeed.seed);
  const campaignId = id("campaign");
  const platforms = platformPreviewPackage(cluster, project?.name || "Current Project");
  const provider = currentImageGenerationStatus();
  const generatedImages = [];
  const imageErrors = [];
  if (provider.configured) {
    const requests = [
      { prompt: platforms.tiktok.imagePrompt, platform: "tiktok", index: 0 },
      { prompt: platforms.instagram.imagePrompt, platform: "instagram", index: 1 }
    ];
    const results = await Promise.allSettled(requests.map((request) => generateOriginalImage({
      ...request,
      outputDir: GENERATED_IMAGE_DIR,
      projectId,
      campaignId,
      allowExternal: provider.externalImagesEnabled,
      providerConfig: providerCredentials()
    })));
    results.forEach((result) => {
      if (result.status === "fulfilled") generatedImages.push(result.value);
      else imageErrors.push(result.reason?.message || "Image generation failed.");
    });
  }
  Object.values(platforms).forEach((platform) => {
    const requestedAsset = generatedImages[platform.assetIndex] || generatedImages[0] || null;
    platform.image = requestedAsset;
    platform.imageStatus = requestedAsset ? "generated" : provider.configured ? "failed" : "provider-required";
  });
  const campaign = {
    ...cluster,
    id: campaignId,
    projectId,
    sourceId: brief.primarySourceId,
    title: cluster.campaignPacket?.title || cluster.sourceInbox?.title,
    direction: brief.requestedDirection || null,
    autonomous: true,
    autonomousCreation: {
      provider: creativeSeed.provider,
      model: creativeSeed.model,
      originalDraft: creativeSeed.originalDraft,
      referenceSourceIds: creativeSeed.referenceSourceIds
    },
    knowledgeSourceCount: brief.knowledgeSourceCount,
    generatedAt: now(),
    packetContract: CANONICAL_PACKET_CONTRACT,
    packetSummary: canonicalPacketSummary(cluster),
    campaignPacket: cluster.campaignPacket,
    platforms,
    generatedImages,
    imageGeneration: {
      ...provider,
      live: generatedImages.length > 0,
      generatedCount: generatedImages.length,
      errors: imageErrors
    },
    qaVerdict: cluster.qaVerdict,
    nextAction: generatedImages.length ? "Review the four platform previews, then export the campaign." : "Connect the image provider once, then generate the original campaign images.",
    cluster,
    a2aTrace: cluster.a2aTrace,
    toolTrace: cluster.toolTrace,
    exportManifest: {
      ...cluster.exportManifest,
      campaignId,
      platformPreviews: Object.keys(platforms),
      generatedImageCount: generatedImages.length
    }
  };
  if (creativeSeed.seed) assertOriginalCreativeArtifactsClean(campaign);
  const generation = saveGeneration(store, {
    projectId,
    sourceId: brief.primarySourceId,
    kind: "autonomous-campaign",
    title: campaign.title,
    output: campaign
  });
  campaign.generation = {
    id: generation.id,
    projectId: generation.projectId,
    sourceId: generation.sourceId,
    kind: generation.kind,
    title: generation.title,
    createdAt: generation.createdAt
  };
  store.campaigns.unshift(campaign);
  store.campaigns = store.campaigns.slice(0, 80);
  store.generatedImages.unshift(...generatedImages);
  store.generatedImages = store.generatedImages.slice(0, 240);
  persistTierZeroRun(store, network, {
    projectId,
    sourceId: brief.primarySourceId,
    generationId: generation.id,
    kind: "autonomous-campaign"
  });
  recordHistory(store, "autonomous-campaign", `Autonomous campaign created: ${campaign.title}`, {
    projectId,
    campaignId,
    generationId: generation.id,
    platforms: Object.keys(platforms),
    generatedImages: generatedImages.map((image) => image.id)
  });
  return campaign;
}

function makePack(source) {
  const frame = makeFrame(source);
  const terms = frame.focusTerms?.length ? frame.focusTerms : ["source", "structure", "output"];
  const subject = frame.title;
  const meta = sourceMeta(source);
  const sentences = sentenceCandidates(source);
  const proof = pickSentence(sentences, `${subject} needs a clearer proof beat.`, 0);
  const tension = pickSentence(sentences, proof, 1);
  const turn = pickSentence(sentences, tension, 2);
  const close = pickSentence(sentences, turn, 3);
  const quotePack = sentences.slice(0, 5);
  const opener = proof.length > 120 ? `${proof.slice(0, 117).trim()}...` : proof;
  const second = tension.length > 120 ? `${tension.slice(0, 117).trim()}...` : tension;
  const audience = audienceFor(meta, terms);
  const visualDirection = visualFor(meta, terms);
  const scenePlan = [
    { time: "0:00-0:03", purpose: "Pattern break", visual: visualDirection, line: opener },
    { time: "0:03-0:10", purpose: "Name the tension", visual: `Show the cost or pressure behind ${terms[0]}.`, line: tension },
    { time: "0:10-0:22", purpose: "Proof beat", visual: `Cut to concrete evidence, workflow, artifact, or source excerpt for ${terms[1] || terms[0]}.`, line: turn },
    { time: "0:22-0:38", purpose: "System turn", visual: `Show the repeatable mechanism behind ${terms.slice(0, 3).join(", ")}.`, line: pickSentence(sentences, close, 4) },
    { time: "0:38-0:52", purpose: "Transformation", visual: "Before/after structure: raw source on one side, finished packet on the other.", line: close },
    { time: "0:52-1:00", purpose: "CTA", visual: "End on saved export, source ledger, or named next action.", line: "Save the packet, review the proof, then ship the next verified output." }
  ];
  const platformVariants = [
    {
      platform: "TikTok / Shorts",
      hook: opener,
      structure: "fast proof-first cutdown",
      caption: `${proof} ${terms[0]} becomes visible when the system forces a next action.`,
      cta: "Follow the source, not the noise."
    },
    {
      platform: "Instagram",
      hook: second,
      structure: "carousel or reel with quote overlays",
      caption: `${subject}: ${turn}`,
      cta: "Save this as an execution frame."
    },
    {
      platform: "LinkedIn",
      hook: turn,
      structure: "operator note with source claim, implication, and action",
      caption: `${proof}\n\nImplication: ${turn}\n\nAction: ${close}`,
      cta: "Turn the principle into one repeatable process."
    }
  ];
  const claimMap = quotePack.map((quote, index) => ({
    id: `claim-${index + 1}`,
    sourceLine: quote,
    contentUse: index === 0 ? "opening hook" : index === 1 ? "tension beat" : index === 2 ? "transformation beat" : "supporting proof",
    risk: "source-backed",
    onScreenText: quote.length > 72 ? `${quote.slice(0, 69).trim()}...` : quote
  }));
  const contentArsenal = {
    shortForm60: {
      title: subject,
      runtime: "60s",
      voiceover: scenePlan.map((scene) => `${scene.time}: ${scene.line}`).join("\n"),
      editPattern: "6-beat proof arc: pattern break, tension, proof, system turn, transformation, CTA"
    },
    shortForm30: {
      title: `${subject}: Fast Cut`,
      runtime: "30s",
      voiceover: [proof, turn, close].join(" "),
      editPattern: "3-beat cutdown: proof, implication, action"
    },
    carousel: {
      slides: [
        { slide: 1, headline: opener, body: "Lead with the source claim." },
        { slide: 2, headline: "The pressure", body: tension },
        { slide: 3, headline: "The system turn", body: turn },
        { slide: 4, headline: "The operator takeaway", body: close },
        { slide: 5, headline: "Next action", body: "Convert the source into one repeatable workflow." }
      ]
    },
    longFormOutline: [
      { section: "Cold open", point: proof },
      { section: "Why it matters", point: tension },
      { section: "The system", point: turn },
      { section: "Execution model", point: close },
      { section: "Practical handoff", point: "Save the source, generate the packet, review claims, export the final." }
    ]
  };
  const qaGate = {
    stage: "source-packet-preflight",
    score: null,
    passed: null,
    readyForTierZeroQa: sentences.length >= 1 && quotePack.length >= 1,
    checks: [
      { name: "source excerpts available", passed: quotePack.length >= 1 },
      { name: "non-repetitive title usage", passed: ![proof, tension, turn, close].every((item) => item.includes(subject)) },
      { name: "platform variants", passed: platformVariants.length >= 3 },
      { name: "scene plan", passed: scenePlan.length >= 6 },
      { name: "local-only honesty", passed: true }
    ],
    note: "Preflight only. Final approval comes from the Tier Zero 11-dimension quality rubric."
  };
  const citationMap = quotePack.map((quote, index) => ({
    citation: `[S${index + 1}]`,
    sourceLine: quote,
    allowedUses: ["hook", "caption", "script", "claim support"]
  }));
  const scripts = scenePlan.map((scene) => ({
    time: scene.time,
    beat: scene.purpose,
    line: scene.line,
    visual: scene.visual,
    evidenceId: `claim-${Math.min(scenePlan.indexOf(scene) + 1, Math.max(1, claimMap.length))}`
  }));
  const nextAction = qaGate.readyForTierZeroQa ? "Run the Tier Zero quality rubric before export." : "Repair source coverage before generation.";
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    engine: "WAKE V6 local deterministic agent",
    frame,
    sourceProfile: {
      title: subject,
      lane: meta.lane || "Unlabeled IP lane",
      sourceType: meta.sourceType || "direct_source",
      extraction: meta.extraction || "source_text",
      audience,
      focusTerms: terms,
      sourceSentencesUsed: sentences.length
    },
    strategicBrief: {
      promise: proof,
      tension,
      transformation: turn,
      operatorTakeaway: close,
      contentUse: "Produce source-faithful scripts, captions, scenes, and platform variants without inventing external capability."
    },
    hooks: [
      opener,
      `The turn: ${second}`,
      `${titleCase(terms[0])} is not the topic. The proof is how it changes the next action.`
    ],
    titles: [
      subject,
      `${titleCase(terms.slice(0, 2).join(" ")) || "Source"}: The Operating Frame`,
      `${subject}: Proof, Turn, Action`
    ],
    captions: [
      `${proof}`,
      `${tension}`,
      `${close}`
    ],
    platformBlocks: {
      youtubeShorts: `Open on: "${opener}" Then cut to the concrete turn: "${second}"`,
      tiktok: `Use ${terms.slice(0, 3).join(", ")} as on-screen proof labels, but make the spoken line come from the source quotes.`,
      linkedin: `Lead with the source claim, then explain the system implication: ${turn}`
    },
    scriptBeats: [
      { beat: "Open", direction: proof },
      { beat: "Pressure", direction: tension },
      { beat: "Turn", direction: turn },
      { beat: "Close", direction: close }
    ],
    scenePlan,
    scripts,
    platformVariants,
    evidenceMap: claimMap.map((claim, index) => ({
      id: `evidence-${index + 1}`,
      quote: claim.sourceLine,
      use: claim.contentUse
    })),
    citationMap,
    claimMap,
    contentArsenal,
    productionNotes: {
      visualDirection,
      audioDirection: meta.lane?.toLowerCase().includes("storytime")
        ? "warm narration, patient pacing, light musical bed, no aggressive jump cuts"
        : "controlled industrial pulse, low noise floor, deliberate pauses, no hype-track masking weak ideas",
      editRules: [
        "Every on-screen claim must map to a source sentence or saved local artifact.",
        "Do not reuse the title as filler copy.",
        "Cut any line that cannot be tied to the source profile, proof line, or operator takeaway."
      ],
      assetPrompts: [
        `${visualDirection}; hero frame for ${subject}; premium source-faithful composition`,
        `Close-up detail frame showing ${terms[0]} and ${terms[1] || "execution"} as tangible system evidence`,
        `Final CTA frame with saved source ledger and export-ready packet`
      ]
    },
    executionChecklist: [
      "Review source profile and confirm the lane is correct.",
      "Pick one platform variant before generating final media.",
      "Use quotePack as the only source for direct quote overlays.",
      "Export markdown and JSON after founder review."
    ],
    operatorHandoff: {
      creativeDirector: `Build the first cut around ${proof}`,
      editor: `Use the scene plan exactly; keep visual density highest around ${turn}`,
      designer: `Use this visual system: ${visualDirection}`,
      reviewer: "Reject the packet if any claim cannot be mapped to claimMap.",
      publisher: `Start with ${platformVariants[0].platform}; adapt after QA passes.`,
      nextBestStep: nextAction
    },
    qaVerdict: qaGate,
    nextAction,
    visualPrompts: [
      `${visualDirection}; hero frame for ${subject}; premium source-faithful composition`,
      `Close-up detail frame showing ${terms[0]} and ${terms[1] || "execution"} as tangible system evidence`,
      `Final CTA frame with saved source ledger and export-ready packet`
    ],
    exportManifest: {
      title: subject,
      status: "pending-tier-zero-qa",
      nextAction,
      requiredSections: ["sourceProfile", "evidenceMap", "citationMap", "claimMap", "scripts", "platformVariants", "productionNotes", "qaVerdict"]
    },
    qaGate,
    quotePack,
    qualityFlags: {
      wrapperRemoved: !subject.toLowerCase().startsWith("build a 60-second"),
      titleSource: /^#\s+\S/m.test(String(source)) ? "source heading" : "cleaned source",
      sourceSentenceCount: sentences.length,
      localOnly: true,
      avoidsTitleEcho: ![proof, tension, turn, close].every((item) => item.includes(subject)),
      productionPacket: true
    }
  };
}

function state() {
  const store = readStore();
  const eligibleSources = store.sources.filter(isCreativeSourceEligible);
  const eligibleMedia = store.mediaAssets.filter((asset) => creativeEligibility(asset).eligible);
  const noTheater = auditNoTheater({ capabilities, agentPipeline, runtimeEvidence: runtimeTruthEvidence() });
  return {
    ok: true,
    product: "Wake Engine",
    console: "WAKE Command Console V6",
    version: "V6",
    status: "active",
    url: `http://127.0.0.1:${PORT}/`,
    activeTask: store.activeTask,
    tasks,
    capabilities,
    noTheater,
    packetContract: CANONICAL_PACKET_CONTRACT,
    tierZeroSpecStatus: TIER_ZERO_SPEC_STATUS,
    externalOperators,
    agentPipeline,
    projects: store.projects,
    recentSources: eligibleSources.slice(0, 200),
    ipSources: eligibleSources.slice(0, 200).map((source) => ({
      id: source.id,
      projectId: source.projectId,
      title: source.title,
      characterCount: source.characterCount,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      source: source.source,
      ...sourceMetadataFromSaved(source)
    })),
    ipSummary: ipSummary(store),
    mediaAssets: eligibleMedia.slice(0, 160),
    mediaSummary: mediaSummary(store),
    campaigns: store.campaigns.slice(0, 40),
    generatedImages: store.generatedImages.slice(0, 80),
    imageGeneration: currentImageGenerationStatus(),
    agentChats: store.agentChats.slice(0, 200),
    tierZeroRuns: store.runRecords.slice(0, 24),
    a2aMessages: store.a2aMessages.slice(0, 80),
    replayableHandoffs: store.replayableHandoffs.slice(0, 80),
    toolReceipts: store.toolReceipts.slice(0, 80),
    memoryReceipts: store.memoryReceipts.slice(0, 80),
    exportInspections: store.exportInspections.slice(0, 24),
    intakeRuns: store.intakeRuns.slice(0, 12),
    intakeReviews: store.intakeReviews.slice(0, 6),
    automations: store.automations.slice(0, 200),
    automationRuns: store.automationRuns.slice(0, 200),
    reviewQueue: store.reviewQueue.slice(0, 100),
    intakeRoots: INTAKE_ROOTS,
    llmBridge: {
      configuredUrls: OLLAMA_URLS,
      preferredModel: OLLAMA_MODEL || null,
      statusEndpoint: "/api/agent-chat/status"
    },
    tierZeroRuntime: auditTierZeroRuntime(),
    recentGenerations: store.generations.slice(0, 200),
    recentExports: store.exports.slice(0, 200),
    recentHistory: store.history.slice(0, 200),
    dataProtection: {
      storage: durableStore.status(),
      bundles: listDataBundles(DATA_DIR).slice(0, 20),
      dataDir: DATA_DIR,
      backupDir: BACKUP_DIR,
      cacheDir: CACHE_DIR,
      credentials: providerCredentialBroker?.status?.() || { available: false, configured: false }
    },
    runtime: {
      cpuLabel: "local",
      queue: tasks.filter((task) => task.status === "running").length,
      snapshots: fs.readdirSync(SNAPSHOT_DIR).filter((name) => name.endsWith(".json")).length,
      exports: store.exports.length,
      sources: eligibleSources.length,
      mediaAssets: eligibleMedia.length,
      generations: store.generations.length,
      campaigns: store.campaigns.length,
      generatedImages: store.generatedImages.length,
      tierZeroRuns: store.runRecords.length,
      a2aMessages: store.a2aMessages.length,
      replayableHandoffs: store.replayableHandoffs.length,
      toolReceipts: store.toolReceipts.length,
      memoryReceipts: store.memoryReceipts.length
    },
    traceSummary: {
      runs: store.runRecords.length,
      a2aMessages: store.a2aMessages.length,
      replayableHandoffs: store.replayableHandoffs.length,
      toolReceipts: store.toolReceipts.length,
      memoryReceipts: store.memoryReceipts.length,
      exportInspections: store.exportInspections.length
    },
    quarantine: store.quarantine || null
  };
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  const hostname = String(req.hostname || "").replace(/^\[|\]$/g, "");
  if (!isLoopbackAddress(req.socket.remoteAddress) || !["127.0.0.1", "localhost", "::1"].includes(hostname)) {
    return res.status(403).json({ ok: false, code: "LOCAL_ONLY", error: "Wake Engine accepts local requests only." });
  }
  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ ok: false, code: "ORIGIN_REJECTED", error: "Request origin is not allowed." });
  }
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/api/session/status", (req, res) => {
  res.json({ ok: true, ...sessionManager.status(req) });
});

app.post("/api/session/login", (req, res) => {
  try {
    const result = sessionManager.login(req.body?.operator, req.body?.phrase);
    res.setHeader("Set-Cookie", result.cookie);
    res.json({ ok: true, authenticated: true, enrolled: result.enrolled, operator: result.session.operator, csrfToken: result.session.csrf, expiresAt: result.session.expiresAt });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || "LOGIN_FAILED", error: error.message });
  }
});

app.post("/api/session/logout", (req, res) => {
  const result = sessionManager.logout(req);
  res.setHeader("Set-Cookie", result.cookie);
  res.json({ ok: true, authenticated: false });
});

app.post("/api/session/biometric/register/options", sessionManager.require, (req, res) => {
  try {
    res.json({ ok: true, publicKey: sessionManager.beginBiometricRegistration(req) });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || "BIOMETRIC_ENROLLMENT_FAILED", error: error.message });
  }
});

app.post("/api/session/biometric/register/verify", sessionManager.require, (req, res) => {
  try {
    const biometric = sessionManager.finishBiometricRegistration(req, req.body);
    res.json({ ok: true, biometric });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || "BIOMETRIC_ENROLLMENT_FAILED", error: error.message });
  }
});

app.post("/api/session/biometric/login/options", (req, res) => {
  try {
    res.json({ ok: true, publicKey: sessionManager.beginBiometricLogin(req) });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || "BIOMETRIC_LOGIN_FAILED", error: error.message });
  }
});

app.post("/api/session/biometric/login/verify", (req, res) => {
  try {
    const result = sessionManager.finishBiometricLogin(req.body);
    res.setHeader("Set-Cookie", result.cookie);
    res.json({ ok: true, authenticated: true, biometric: true, operator: result.session.operator, csrfToken: result.session.csrf, expiresAt: result.session.expiresAt });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || "BIOMETRIC_LOGIN_FAILED", error: error.message });
  }
});

app.get("/api/health", (_req, res) => {
  const noTheater = auditNoTheater({ capabilities, agentPipeline, runtimeEvidence: runtimeTruthEvidence() });
  res.json({
    ok: true,
    product: "Wake Engine",
    console: "WAKE Command Console V6",
    version: "V6",
    build: "wake-command-console-v6-local",
    status: "active",
    port: PORT,
    noTheater: noTheater.ok,
    noTheaterSummary: noTheater.summary,
    externalOperators
  });
});

app.use("/api", sessionManager.require, serializeMutatingRequest);
app.use("/generated-images", sessionManager.require, express.static(GENERATED_IMAGE_DIR, { fallthrough: false, maxAge: "1h" }));

app.get("/api/state", (_req, res) => {
  res.json(state());
});

app.get("/api/no-theater/status", (_req, res) => {
  const audit = auditNoTheater({ capabilities, agentPipeline, runtimeEvidence: runtimeTruthEvidence() });
  res.status(audit.ok ? 200 : 500).json({ ok: audit.ok, ...audit });
});

app.get("/api/system", async (_req, res) => {
  res.json(await systemMetrics());
});

app.get("/api/agent-chat/status", async (_req, res) => {
  const status = await ollamaStatus();
  res.json({ ok: true, ...status, bridge: "ollama", fallback: "Instant Local Draft" });
});

app.get("/api/image-generation/status", (_req, res) => {
  res.json({ ok: true, ...currentImageGenerationStatus() });
});

app.get("/api/provider-credentials/status", (_req, res) => {
  res.json({ ok: true, credentialVault: providerCredentialBroker?.status?.() || { available: false, configured: false } });
});

app.post("/api/provider-credentials", (req, res) => {
  try {
    if (!providerCredentialBroker?.write) return res.status(503).json({ ok: false, code: "SECURE_STORAGE_UNAVAILABLE", error: "Provider credentials can only be stored by the Wake desktop runtime." });
    const credentialVault = providerCredentialBroker.write(req.body || {});
    res.json({ ok: true, credentialVault, imageGeneration: currentImageGenerationStatus() });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || null, error: error.message });
  }
});

app.post("/api/provider-credentials/clear", (_req, res) => {
  try {
    if (!providerCredentialBroker?.clear) return res.status(503).json({ ok: false, code: "SECURE_STORAGE_UNAVAILABLE", error: "Provider credentials can only be cleared by the Wake desktop runtime." });
    const credentialVault = providerCredentialBroker.clear();
    res.json({ ok: true, credentialVault, imageGeneration: currentImageGenerationStatus() });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || null, error: error.message });
  }
});

app.post("/api/image-generation/settings", (req, res) => {
  const settings = writeImageSettings({ externalImagesEnabled: req.body?.externalImagesEnabled === true });
  res.json({ ok: true, settings, imageGeneration: currentImageGenerationStatus() });
});

app.get("/api/data-protection/status", (_req, res) => {
  res.json({
    ok: true,
    storage: durableStore.status(),
    bundles: listDataBundles(DATA_DIR),
    dataDir: DATA_DIR,
    backupDir: BACKUP_DIR,
    cacheDir: CACHE_DIR
  });
});

app.post("/api/backups", (_req, res) => {
  try {
    const backup = createDataBundle(DATA_DIR, { kind: "manual" });
    addMonitorLog("ok", `Manual backup created: ${backup.fileName}`);
    res.json({ ok: true, backup, bundles: listDataBundles(DATA_DIR) });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || null, error: error.message });
  }
});

app.post("/api/backups/restore", (req, res) => {
  try {
    const restored = restoreDataBundle(DATA_DIR, req.body?.fileName, { stateStore: durableStore });
    addMonitorLog("ok", `Backup restored: ${restored.fileName}`);
    res.json({ ok: true, restored, state: state() });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || null, error: error.message });
  }
});

app.post("/api/export-all", (_req, res) => {
  try {
    const exported = createDataBundle(DATA_DIR, { kind: "export-all", targetDir: path.join(EXPORT_DIR, "all-data") });
    addMonitorLog("ok", `Full data export created: ${exported.fileName}`);
    res.json({ ok: true, export: exported });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || null, error: error.message });
  }
});

app.post("/api/cache/cleanup", (_req, res) => {
  try {
    const cleanup = cleanupLocalCache(DATA_DIR);
    addMonitorLog("ok", `Local cache cleanup removed ${cleanup.removed} files.`);
    res.json({ ok: true, cleanup });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || null, error: error.message });
  }
});

app.get("/api/tier-zero/agents", (_req, res) => {
  res.json({ ok: true, agents: agentPipeline, audit: auditTierZeroRuntime() });
});

app.get("/api/tier-zero/audit", (_req, res) => {
  const audit = auditTierZeroRuntime();
  res.status(audit.ok ? 200 : 500).json({ ok: audit.ok, ...audit });
});

app.post("/api/tier-zero/run", (req, res) => {
  const source = String(req.body?.source || "");
  if (!source.trim()) return res.status(400).json({ ok: false, error: "Source text is required before running the tier-zero agent network." });
  const store = readStore();
  const basePack = makePack(source);
  const retrievalContext = retrieveContext(store, source, String(req.body?.agentId || "strategist"), 6, 4, req.body?.projectId);
  const network = runTierZeroNetwork({ source, basePack, retrievalContext });
  const pack = {
    ...basePack,
    ...network.pack,
    ok: network.ok,
    engine: "WAKE Engine Tier Zero content agent network",
    generatedAt: network.generatedAt,
    tierZeroRuntime: network,
    packetContract: CANONICAL_PACKET_CONTRACT,
    tierZeroSpecStatus: TIER_ZERO_SPEC_STATUS
  };
  pack.packetSummary = canonicalPacketSummary(pack);
  const generation = saveGeneration(store, {
    projectId: req.body?.projectId,
    sourceId: req.body?.sourceId,
    kind: "tier-zero-agent-pack",
    title: pack.frame.title,
    output: pack
  });
  persistTierZeroRun(store, network, {
    projectId: generation.projectId,
    sourceId: generation.sourceId,
    generationId: generation.id,
    kind: "tier-zero-run"
  });
  store.activeTask = {
    ...(store.activeTask || defaultStore.activeTask),
    nextAction: pack.tierZeroQa?.nextAction || "Review QA, export, or run a polish pass.",
    lastAgent: "Tier Zero Content Network",
    updatedAt: now()
  };
  writeStore(store);
  res.json({ ...pack, generation });
});

app.post("/api/agent-chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ ok: false, error: "Message is required." });
    const agent = agentPipeline.find((item) => item.id === String(req.body?.agentId || "strategist")) || agentPipeline[1];
    const ability = String(req.body?.ability || "agent");
    const mode = String(req.body?.mode || "auto");
    const profile = chatProfileFor(ability, mode);
    const store = readStore();
    const context = retrieveContext(store, message, agent.id, profile.contextLimit, profile.mediaLimit, req.body?.projectId, req.body?.sourceId);
    const llmStatus = profile.timeoutMs ? await ollamaStatus() : { live: false, url: OLLAMA_URLS[0] || null, models: [], model: OLLAMA_MODEL || null };
    const llmReply = await askOllama({ status: llmStatus, agent, message, context, profile });
    const answer = llmReply || fallbackAgentReply({ agent, message, context, llmStatus });
    const quality = scoreChatAnswer(answer, context);
    if (!llmReply) {
      quality.marketReady = false;
      quality.fallbackDraft = true;
    }
    const chat = {
      id: id("chat"),
      projectId: String(req.body?.projectId || store.projects[0]?.id || "wake-v6-main"),
      agentId: agent.id,
      agentLabel: agent.label,
      message,
      answer,
      provider: llmReply ? "ollama" : "local-deterministic",
      providerLabel: llmReply ? llmStatus.model || "Ollama" : "Instant Local Draft",
      model: llmReply ? llmStatus.model : null,
      llmLive: llmStatus.live,
      ability,
      mode,
      profile: profile.label,
      responseBudgetMs: profile.timeoutMs,
      quality,
      context,
      historyStatus: "saved",
      createdAt: now()
    };
    store.activeTask = {
      ...(store.activeTask || defaultStore.activeTask),
      nextAction: quality.marketReady ? "Review the answer, apply it, or export the current output." : "Run a deeper pass or improve source support before shipping.",
      lastAgent: agent.label,
      lastChatId: chat.id,
      updatedAt: now()
    };
    store.agentChats.unshift(chat);
    store.agentChats = store.agentChats.slice(0, 200);
    saveGeneration(store, {
      projectId: req.body?.projectId,
      sourceId: context.sources[0]?.id || null,
      kind: "agent-chat",
      title: chatTitle(agent, message),
      output: chat
    });
    writeStore(store);
    res.json({ ok: true, chat });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/agent-chat/stream", async (req, res) => {
  const send = (event) => res.write(`${JSON.stringify(event)}\n`);
  try {
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.socket?.setNoDelay(true);
    res.flushHeaders();
    const message = String(req.body?.message || "").trim();
    if (!message) {
      send({ type: "error", error: "Message is required." });
      return res.end();
    }
    const agent = agentPipeline.find((item) => item.id === String(req.body?.agentId || "strategist")) || agentPipeline[1];
    const ability = String(req.body?.ability || "agent");
    const mode = String(req.body?.mode || "auto");
    const profile = chatProfileFor(ability, mode);
    const store = readStore();
    const context = retrieveContext(store, message, agent.id, profile.contextLimit, profile.mediaLimit, req.body?.projectId, req.body?.sourceId);
    const pendingStatus = { live: false, url: null, model: null };
    const draft = fallbackAgentReply({ agent, message, context, llmStatus: pendingStatus });

    send({ type: "meta", agentId: agent.id, agentLabel: agent.label, ability, mode, profile: profile.label, responseBudgetMs: profile.timeoutMs, providerLabel: "Instant Local Draft" });
    send({ type: "draft", answer: draft, provider: "local-deterministic", providerLabel: "Instant Local Draft", quality: scoreChatAnswer(draft, context) });

    const llmStatus = profile.timeoutMs ? await ollamaStatus() : { live: false, url: OLLAMA_URLS[0] || null, models: [], model: OLLAMA_MODEL || null };
    send({ type: "provider-status", llmLive: llmStatus.live, model: llmStatus.model, providerLabel: llmStatus.live ? llmStatus.model || "Ollama" : "Instant Local Draft" });

    let answer = "";
    if (llmStatus.live && profile.timeoutMs) {
      send({ type: "upgrade-start", provider: "ollama", model: llmStatus.model, providerLabel: llmStatus.model || "Ollama" });
      answer = await streamOllama({
        status: llmStatus,
        agent,
        message,
        context,
        profile,
        onToken: (token) => send({ type: "token", token })
      });
    }
    const finalAnswer = answer || draft;
    const provider = answer ? "ollama" : "local-deterministic";
    const quality = scoreChatAnswer(finalAnswer, context);
    if (provider === "local-deterministic") {
      quality.marketReady = false;
      quality.fallbackDraft = true;
    }
    const chat = {
      id: id("chat"),
      projectId: String(req.body?.projectId || store.projects[0]?.id || "wake-v6-main"),
      agentId: agent.id,
      agentLabel: agent.label,
      message,
      answer: finalAnswer,
      provider,
      providerLabel: answer ? llmStatus.model || "Ollama" : "Instant Local Draft",
      model: answer ? llmStatus.model : null,
      llmLive: llmStatus.live,
      ability,
      mode,
      profile: profile.label,
      responseBudgetMs: profile.timeoutMs,
      quality,
      context,
      historyStatus: "saved",
      createdAt: now()
    };
    store.agentChats.unshift(chat);
    store.agentChats = store.agentChats.slice(0, 200);
    store.activeTask = {
      ...(store.activeTask || defaultStore.activeTask),
      nextAction: quality.marketReady ? "Review the answer, apply it, or export the current output." : "Run a deeper pass or improve source support before shipping.",
      lastAgent: agent.label,
      lastChatId: chat.id,
      updatedAt: now()
    };
    saveGeneration(store, {
      projectId: req.body?.projectId,
      sourceId: context.sources[0]?.id || null,
      kind: "agent-chat",
      title: chatTitle(agent, message),
      output: chat
    });
    writeStore(store);
    send({ type: "final", chat });
    res.end();
  } catch (error) {
    send({ type: "error", error: error.message });
    res.end();
  }
});

app.post("/api/instructions/generate", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) throw new Error("Instruction request message is required.");
    const llmStatus = await ollamaStatus();
    if (llmStatus?.live && llmStatus?.model) {
      const prompt = `You are the WAKE Engine Operations Guide. The user says: "${message}"\nProvide a clear step-by-step workflow using ONLY capabilities that exist in the current WAKE Engine V6 desktop app. User-facing surfaces are Console, Agents, Cluster, Vault, Library, Instructions, Automations, Monitor, and Audit. Internal stages are Archivist, Strategist, Scriptwriter, Creative Director, QA, and Export; never present an internal stage as a clickable page. If the requested capability is not implemented, say so explicitly and give the closest supported workflow. Do not invent buttons, pages, publishing integrations, or file support. Format as markdown.`;
      const response = await fetch(`${llmStatus.url}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: llmStatus.model,
          prompt,
          stream: false,
          options: { temperature: 0.2 }
        }),
        signal: AbortSignal.timeout(30000)
      });
      if (response.ok) {
        const data = await response.json();
        const text = String(data.response || "").trim();
        if (text) {
          return res.json({ ok: true, instructions: text, generated: true });
        }
      }
    }
    const request = String(message).trim();
    const lower = request.toLowerCase();
    let steps;
    if (/\b(?:runtime|health|cpu|memory|ram|status|monitor|telemetry)\b/.test(lower)) {
      steps = [
        "Open **Monitor** from the WAKE navigation.",
        "Inspect the runtime truth labels, current tasks, CPU/RAM/system state, and any visible blockers.",
        "Open **Audit** when you need a durable snapshot or recovery evidence for the current state.",
        "Use **Console** only if the runtime finding requires new source-backed work; Monitor itself is the inspection surface."
      ];
    } else if (/schedule|automation|recurring|cron|run now/.test(lower)) {
      steps = [
        "Open **Automations** and choose **New Automation**.",
        "Set the source directory, five-field cron schedule, timezone, operator ask, approval mode, and export directory.",
        "Save the automation, then use **Resume/Pause** or **Run Now** as needed.",
        "Use **Review Queue** for Review Required runs and **Run History** to inspect completed, skipped, or failed executions."
      ];
    } else if (/import|folder|vault|source|document|file/.test(lower)) {
      steps = [
        "Open **Vault** to review or import an approved local folder, or use **Console** to paste source text directly.",
        "Review candidates before import when scanning a drive or folder.",
        "Load the selected source, then open **Agents** to run the Tier Zero content workflow.",
        "Inspect the resulting evidence and QA before exporting."
      ];
    } else if (/publish|post to|social network|instagram api|tiktok api|linkedin api/.test(lower)) {
      steps = [
        "WAKE V6 does **not** currently publish directly to social networks.",
        "Build and QA the content in **Console / Agents / Cluster**.",
        "Export the approved local output.",
        "Publish the exported material manually in the destination platform."
      ];
    } else {
      steps = [
        "Start in **Console** with pasted approved source, or use **Vault** to import approved local source files.",
        "Use **Agents** to run the Tier Zero pipeline: Archivist → Strategist → Scriptwriter → Creative Director → QA → Export.",
        "Inspect evidence, claim support, and QA results; use **Cluster** to review the completed content packet and output lanes.",
        "Export only after QA permits it, then use **Library** to find saved work and **Audit** for a durable snapshot when needed."
      ];
    }
    const staticRunbook = [`# WAKE V6 Runbook: ${request}`, "", ...steps.map((step, index) => `${index + 1}. ${step}`)].join("\n");
    res.json({ ok: true, instructions: staticRunbook, generated: false });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

function automationValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "WAKE_AUTOMATION_INVALID";
  return error;
}

function validCronField(field, min, max) {
  const segments = String(field || "").split(",");
  if (!segments.length) return false;
  return segments.every((segment) => {
    const parts = segment.split("/");
    if (parts.length > 2) return false;
    const [base, rawStep] = parts;
    if (rawStep !== undefined && (!/^\d+$/.test(rawStep) || Number(rawStep) < 1)) return false;
    if (base === "*") return true;
    if (base.includes("-")) {
      const range = base.split("-");
      if (range.length !== 2 || !range.every((value) => /^\d+$/.test(value))) return false;
      const [from, to] = range.map(Number);
      return from >= min && to <= max && from <= to;
    }
    if (rawStep !== undefined || !/^\d+$/.test(base)) return false;
    const value = Number(base);
    return value >= min && value <= max;
  });
}

function validCronExpression(value) {
  const fields = String(value || "").trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return validCronField(fields[0], 0, 59) &&
    validCronField(fields[1], 0, 23) &&
    validCronField(fields[2], 1, 31) &&
    validCronField(fields[3], 1, 12) &&
    validCronField(fields[4], 0, 6);
}

function validTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function validateAutomationPayload(store, payload = {}) {
  const automation = {
    name: String(payload.name || "").trim(),
    projectId: String(payload.projectId || "").trim(),
    sourceDir: String(payload.sourceDir || "").trim(),
    campaignType: String(payload.campaignType || "").trim(),
    operatorAsk: String(payload.operatorAsk || "").trim(),
    scheduleCron: String(payload.scheduleCron || "").trim(),
    timeZone: String(payload.timeZone || "").trim(),
    approvalMode: String(payload.approvalMode || "").trim(),
    exportDir: String(payload.exportDir || "").trim()
  };
  if (!automation.name) throw automationValidationError("Automation name is required.");
  if (!automation.projectId || !store.projects.some((project) => project.id === automation.projectId)) {
    throw automationValidationError("Choose an existing WAKE project before saving the automation.");
  }
  if (!automation.sourceDir) throw automationValidationError("Source directory is required.");
  if (containsCloudPath(automation.sourceDir)) throw automationValidationError("Automation source directories must be local and non-cloud-synchronized.");
  if (!automation.campaignType) throw automationValidationError("Campaign type is required.");
  if (!automation.operatorAsk) throw automationValidationError("Operator ask is required.");
  if (!validCronExpression(automation.scheduleCron)) throw automationValidationError("Schedule must be a valid five-field cron expression using WAKE-supported ranges, lists, or steps.");
  if (!automation.timeZone || !validTimeZone(automation.timeZone)) throw automationValidationError("Time zone must be a valid IANA timezone.");
  if (!["Review Required", "Auto Export"].includes(automation.approvalMode)) throw automationValidationError("Approval mode must be Review Required or Auto Export.");
  if (!automation.exportDir) throw automationValidationError("Export directory is required.");
  if (containsCloudPath(automation.exportDir)) throw automationValidationError("Automation export directories must be local and non-cloud-synchronized.");
  return automation;
}

app.post("/api/automations", (req, res) => {
  try {
    const store = readStore();
    const validated = validateAutomationPayload(store, req.body || {});
    const automation = {
      id: id("auto"),
      createdAt: now(),
      updatedAt: now(),
      enabled: false,
      ...validated
    };
    store.automations.push(automation);
    recordHistory(store, "automation.created", `Automation created: ${automation.name}`, { automationId: automation.id });
    writeStore(store, "created-automation");
    res.json({ ok: true, automation });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || null, error: error.message });
  }
});

app.put("/api/automations/:id", (req, res) => {
  try {
    const store = readStore();
    const index = store.automations.findIndex((automation) => automation.id === req.params.id);
    if (index === -1) return res.status(404).json({ ok: false, error: "Automation not found." });
    const validated = validateAutomationPayload(store, req.body || {});
    store.automations[index] = { ...store.automations[index], ...validated, updatedAt: now() };
    recordHistory(store, "automation.updated", `Automation updated: ${store.automations[index].name}`, { automationId: req.params.id });
    writeStore(store, "updated-automation");
    res.json({ ok: true, automation: store.automations[index] });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || null, error: error.message });
  }
});

app.delete("/api/automations/:id", (req, res) => {
  const store = readStore();
  const automation = store.automations.find((item) => item.id === req.params.id);
  if (!automation) return res.status(404).json({ ok: false, error: "Automation not found." });
  store.automations = store.automations.filter((item) => item.id !== req.params.id);
  recordHistory(store, "automation.deleted", `Automation deleted: ${automation.name}`, { automationId: automation.id });
  writeStore(store, "deleted-automation");
  res.json({ ok: true });
});

app.post("/api/automations/:id/toggle", (req, res) => {
  const store = readStore();
  const automation = store.automations.find((item) => item.id === req.params.id);
  if (!automation) return res.status(404).json({ ok: false, error: "Automation not found." });
  if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ ok: false, code: "WAKE_AUTOMATION_INVALID", error: "enabled must be a boolean." });
  automation.enabled = req.body.enabled;
  automation.updatedAt = now();
  recordHistory(store, "automation.toggled", `Automation ${automation.enabled ? "resumed" : "paused"}: ${automation.name}`, { automationId: automation.id, enabled: automation.enabled });
  writeStore(store, "toggled-automation");
  res.json({ ok: true, enabled: automation.enabled });
});

app.post("/api/automations/:id/run", (req, res) => {
  const store = readStore();
  const automation = store.automations.find((item) => item.id === req.params.id);
  if (!automation) return res.status(404).json({ ok: false, error: "Automation not found." });
  const existingQueued = store.automationRuns.find((run) => run.automationId === automation.id && run.status === "queued" && run.sourceHash === "manual-run");
  if (existingQueued) return res.status(409).json({ ok: false, error: "A manual run is already queued for this automation." });
  const run = {
    id: id("run"),
    automationId: automation.id,
    status: "queued",
    sourceHash: "manual-run",
    createdAt: now()
  };
  store.automationRuns.unshift(run);
  automation.forceRun = true;
  automation.updatedAt = now();
  recordHistory(store, "automation.run.queued", `Manual automation run queued: ${automation.name}`, { automationId: automation.id, runId: run.id });
  writeStore(store, "manual-run-automation");
  res.json({ ok: true, run });
});

app.post("/api/active-task", (req, res) => {
  try {
    const store = readStore();
    const task = updateActiveTask(store, req.body || {});
    writeStore(store);
    res.json({ ok: true, task });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/intake/roots", async (_req, res) => {
  const drives = await detectLocalDrives();
  const contentRoots = defaultContentRoots();
  res.json({
    ok: true,
    roots: INTAKE_ROOTS,
    contentRoots,
    drives,
    removableDrives: drives.filter((drive) => drive.type === "removable" && drive.eligible),
    fixedDrives: drives.filter((drive) => drive.type === "fixed" && drive.eligible),
    maxFiles: INTAKE_MAX_FILES,
    maxDirectories: INTAKE_MAX_DIRECTORIES
  });
});

app.post("/api/intake/run", async (req, res) => {
  try {
    const store = readStore();
    const run = await runLocalIntake(store, req.body || {});
    writeStore(store);
    res.json({ ok: true, run, state: state() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/intake/review", async (req, res) => {
  try {
    const store = readStore();
    const review = await buildIntakeReview(store, req.body || {});
    store.intakeReviews.unshift(review);
    store.intakeReviews = store.intakeReviews.slice(0, 12);
    recordHistory(store, "intake.review.created", `Review scan staged ${review.eligible} eligible items from ${review.scanned} scanned files.`, { reviewId: review.id, projectId: review.projectId });
    writeStore(store);
    res.json({ ok: true, review, state: state() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/intake/reviews/:id/apply", (req, res) => {
  try {
    const store = readStore();
    const review = store.intakeReviews.find((item) => item.id === req.params.id);
    if (!review) return res.status(404).json({ ok: false, error: "Intake review was not found." });
    const candidateIds = Array.isArray(req.body?.candidateIds) ? req.body.candidateIds : [];
    if (!candidateIds.length) return res.status(400).json({ ok: false, error: "Select review items before importing." });
    const result = importReviewedCandidates(store, review, candidateIds);
    review.status = "imported-selection";
    review.importedAt = now();
    review.importResult = result;
    const run = {
      id: id("intake"),
      roots: review.roots,
      scanned: review.scanned,
      reviewed: true,
      reviewId: review.id,
      sourceAdded: result.sourceAdded,
      mediaAdded: result.mediaAdded,
      skippedOperational: result.skipped,
      projectId: review.projectId,
      createdAt: now()
    };
    store.intakeRuns.unshift(run);
    store.intakeRuns = store.intakeRuns.slice(0, 50);
    recordHistory(store, "intake.review.imported", `Imported reviewed intake: ${result.sourceAdded} sources and ${result.mediaAdded} media assets.`, { reviewId: review.id, projectId: review.projectId });
    writeStore(store);
    res.json({ ok: true, run, review, result, state: state() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

function safeLocalAssetPath(value) {
  const filePath = String(value || "");
  if (!filePath || containsCloudPath(filePath)) return null;
  try {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return null;
    return resolved;
  } catch {
    return null;
  }
}

function findMediaAsset(store, idValue) {
  return store.mediaAssets.find((asset) => asset.id === String(idValue || ""));
}

app.get("/api/media/:id/preview", (req, res) => {
  const store = readStore();
  const asset = findMediaAsset(store, req.params.id);
  const filePath = safeLocalAssetPath(asset?.path);
  if (!asset || !filePath) return res.status(404).send("Media file was not found.");
  const ext = path.extname(filePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) return res.status(415).send("Preview is only available for images.");
  res.sendFile(filePath);
});

app.post("/api/media/:id/open", async (req, res) => {
  const store = readStore();
  const asset = findMediaAsset(store, req.params.id);
  const filePath = safeLocalAssetPath(asset?.path);
  if (!asset || !filePath) return res.status(404).json({ ok: false, error: "Media file was not found." });
  try {
    if (process.platform === "win32" && process.env.WAKE_AUDIT_NO_OPEN !== "1") {
      await execFileAsync("explorer.exe", [`/select,${filePath}`], { timeout: 5000 });
    }
    addMonitorLog("ok", `Opened media item: ${asset.title}`);
    res.json({ ok: true, id: asset.id, path: filePath });
  } catch (error) {
    addMonitorLog("warn", `Open media failed: ${asset.title}`);
    res.status(500).json({ ok: false, error: error.message, id: asset.id, path: filePath });
  }
});

app.post("/api/media/:id/rename", (req, res) => {
  const title = String(req.body?.title || "").trim().slice(0, 160);
  if (!title) return res.status(400).json({ ok: false, error: "A new media title is required." });
  const store = readStore();
  const asset = findMediaAsset(store, req.params.id);
  if (!asset) return res.status(404).json({ ok: false, error: "Media item was not found." });
  asset.title = title;
  asset.name = title;
  asset.updatedAt = now();
  recordHistory(store, "media.renamed", `Renamed media item: ${title}`, { mediaId: asset.id, projectId: asset.projectId });
  writeStore(store);
  res.json({ ok: true, media: asset, state: state() });
});

app.post("/api/sources/:id/rename", (req, res) => {
  const title = String(req.body?.title || "").trim().slice(0, 160);
  if (!title) return res.status(400).json({ ok: false, error: "A new source title is required." });
  const store = readStore();
  const source = store.sources.find((item) => item.id === req.params.id && isCreativeSourceEligible(item));
  if (!source) return res.status(404).json({ ok: false, error: "Source document was not found." });
  source.title = title;
  source.updatedAt = now();
  recordHistory(store, "source.renamed", `Renamed source: ${title}`, { sourceId: source.id, projectId: source.projectId });
  writeStore(store);
  res.json({ ok: true, source, state: state() });
});

app.get("/api/projects", (_req, res) => {
  res.json({ ok: true, projects: readStore().projects });
});

app.post("/api/projects", (req, res) => {
  const store = readStore();
  const project = upsertProject(store, req.body);
  writeStore(store);
  res.json({ ok: true, project });
});

app.get("/api/history", (_req, res) => {
  const store = readStore();
  const eligibleSources = store.sources.filter(isCreativeSourceEligible);
  res.json({
    ok: true,
    packetContract: CANONICAL_PACKET_CONTRACT,
    tierZeroSpecStatus: TIER_ZERO_SPEC_STATUS,
    history: store.history,
    agentChats: store.agentChats,
    sources: eligibleSources,
    generations: store.generations,
    campaigns: store.campaigns,
    generatedImages: store.generatedImages,
    runRecords: store.runRecords,
    a2aMessages: store.a2aMessages,
    replayableHandoffs: store.replayableHandoffs,
    toolReceipts: store.toolReceipts,
    memoryReceipts: store.memoryReceipts,
    exportInspections: store.exportInspections,
    exports: store.exports,
    traceSummary: {
      runs: store.runRecords.length,
      a2aMessages: store.a2aMessages.length,
      replayableHandoffs: store.replayableHandoffs.length,
      toolReceipts: store.toolReceipts.length,
      memoryReceipts: store.memoryReceipts.length,
      exportInspections: store.exportInspections.length
    }
  });
});

app.post("/api/sources", (req, res) => {
  try {
    const store = readStore();
    const source = saveSource(store, req.body);
    writeStore(store);
    res.json({ ok: true, source });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

app.get("/api/sources/:id/content", (req, res) => {
  const store = readStore();
  const source = store.sources.find((item) => item.id === req.params.id && isCreativeSourceEligible(item));
  if (!source) return res.status(404).json({ ok: false, error: "Source document was not found." });
  const meta = sourceMetadataFromSaved(source);
  let content = sourceContent(source.source);
  let contentSource = "saved extraction";
  if (meta.localPath && !containsCloudPath(meta.localPath) && TEXT_EXTENSIONS.has(path.extname(meta.localPath).toLowerCase())) {
    try {
      const stat = fs.statSync(meta.localPath);
      if (stat.isFile() && stat.size <= 2_000_000) {
        content = fs.readFileSync(meta.localPath, "utf8");
        contentSource = "local document";
      }
    } catch {
      // The saved extraction remains available when the original file moved.
    }
  }
  res.json({
    ok: true,
    document: {
      id: source.id,
      projectId: source.projectId,
      title: source.title.replace(/^\[[^\]]+\]\s*/, ""),
      content: content || "No readable document content is available.",
      sourceType: meta.sourceType,
      contentSource,
      characterCount: content.length
    }
  });
});

app.post("/api/frame", (req, res) => {
  const source = String(req.body?.source || "");
  if (!source.trim()) return res.status(400).json({ ok: false, error: "Source text is required." });
  const store = readStore();
  const frame = makeFrame(source);
  const generation = saveGeneration(store, {
    projectId: req.body?.projectId,
    sourceId: req.body?.sourceId,
    kind: "frame",
    title: frame.title,
    output: frame
  });
  writeStore(store);
  res.json({ ok: true, frame, generation });
});

app.post("/api/run-agent", (req, res) => {
  const source = String(req.body?.source || "");
  if (!source.trim()) return res.status(400).json({ ok: false, error: "Source text is required before running the local agent." });
  const store = readStore();
  const basePack = makePack(source);
  const retrievalContext = retrieveContext(store, source, String(req.body?.agentId || "strategist"), 6, 4, req.body?.projectId);
  const network = runTierZeroNetwork({ source, basePack, retrievalContext });
  const pack = {
    ...basePack,
    ...network.pack,
    ok: network.ok,
    engine: "WAKE Engine Tier Zero content agent network",
    generatedAt: network.generatedAt,
    tierZeroRuntime: network,
    packetContract: CANONICAL_PACKET_CONTRACT,
    tierZeroSpecStatus: TIER_ZERO_SPEC_STATUS
  };
  pack.packetSummary = canonicalPacketSummary(pack);
  const generation = saveGeneration(store, {
    projectId: req.body?.projectId,
    sourceId: req.body?.sourceId,
    kind: "tier-zero-agent-pack",
    title: pack.frame.title,
    output: pack
  });
  persistTierZeroRun(store, network, {
    projectId: generation.projectId,
    sourceId: generation.sourceId,
    generationId: generation.id,
    kind: "run-agent"
  });
  store.activeTask = {
    ...(store.activeTask || defaultStore.activeTask),
    nextAction: pack.tierZeroQa?.nextAction || "Review QA, export, or run a polish pass.",
    lastAgent: "Tier Zero Content Network",
    updatedAt: now()
  };
  writeStore(store);
  res.json({ ...pack, generation });
});

app.post("/api/content-cluster", (req, res) => {
  const source = String(req.body?.source || "");
  if (!source.trim()) return res.status(400).json({ ok: false, error: "Source text is required before building the content cluster." });
  const store = readStore();
  const basePack = makePack(source);
  const retrievalContext = retrieveContext(store, source, "creative-director", 6, 4, req.body?.projectId);
  const network = runTierZeroNetwork({ source, basePack, retrievalContext });
  const packet = {
    ...basePack,
    ...network.pack,
    ok: network.ok,
    engine: "WAKE Engine Tier Zero content agent network",
    generatedAt: network.generatedAt,
    tierZeroRuntime: network
  };
  const cluster = makeContentCluster(source, packet);
  cluster.packetContract = CANONICAL_PACKET_CONTRACT;
  cluster.tierZeroSpecStatus = TIER_ZERO_SPEC_STATUS;
  cluster.packetSummary = canonicalPacketSummary(cluster);
  const generation = saveGeneration(store, {
    projectId: req.body?.projectId,
    sourceId: req.body?.sourceId,
    kind: "content-cluster",
    title: cluster.sourceInbox.title,
    output: cluster
  });
  persistTierZeroRun(store, network, {
    projectId: generation.projectId,
    sourceId: generation.sourceId,
    generationId: generation.id,
    kind: "content-cluster"
  });
  writeStore(store);
  res.json({ ...cluster, generation });
});

app.post("/api/autopilot", async (req, res) => {
  try {
    const store = readStore();
    const campaign = await createAutonomousCampaign(store, req.body || {});
    writeStore(store);
    res.json({ ok: true, campaign });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message, code: error.code || null });
  }
});

app.post("/api/images/generate", async (req, res) => {
  try {
    const store = readStore();
    const campaign = store.campaigns.find((item) => item.id === String(req.body?.campaignId || ""));
    if (!campaign) return res.status(404).json({ ok: false, error: "Campaign was not found." });
    const platformId = String(req.body?.platform || "instagram").toLowerCase();
    const platform = campaign.platforms?.[platformId];
    if (!platform) return res.status(400).json({ ok: false, error: "Choose TikTok, Instagram, X, or LinkedIn before generating an image." });
    const image = await generateOriginalImage({
      prompt: String(req.body?.prompt || platform.imagePrompt || campaign.title),
      platform: platformId,
      outputDir: GENERATED_IMAGE_DIR,
      projectId: campaign.projectId,
      campaignId: campaign.id,
      index: campaign.generatedImages?.length || 0,
      allowExternal: readImageSettings().externalImagesEnabled,
      providerConfig: providerCredentials()
    });
    campaign.generatedImages = [image, ...(campaign.generatedImages || [])].slice(0, 12);
    campaign.platforms[platformId] = { ...platform, image, imageStatus: "generated" };
    campaign.imageGeneration = {
      ...currentImageGenerationStatus(),
      live: true,
      generatedCount: campaign.generatedImages.length,
      errors: []
    };
    campaign.updatedAt = now();
    store.generatedImages.unshift(image);
    store.generatedImages = store.generatedImages.slice(0, 240);
    recordHistory(store, "generated-image", `Original ${platform.label} image generated for ${campaign.title}`, {
      projectId: campaign.projectId,
      campaignId: campaign.id,
      platform: platformId,
      imageId: image.id
    });
    writeStore(store);
    res.json({ ok: true, image, campaign });
  } catch (error) {
    const status = error.code === "IMAGE_PROVIDER_CONSENT_REQUIRED" ? 409 : error.code === "IMAGE_PROVIDER_REQUIRED" ? 503 : error.status || 500;
    res.status(status).json({ ok: false, error: error.message, code: error.code || null, imageGeneration: currentImageGenerationStatus() });
  }
});

app.post("/api/images/save-source", (req, res) => {
  try {
    const store = readStore();
    const saved = saveGeneratedImageAsSourceMaterial(store, req.body || {});
    writeStore(store);
    res.json({ ok: true, ...saved, state: state() });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

app.post("/api/export", (req, res) => {
  const store = readStore();
  const output = req.body?.output;
  if (!output) return res.status(400).json({ ok: false, error: "Output is required before export." });
  const qa = qaStatusForOutput(output);
  if (qa.present && qa.passed !== true) {
    return res.status(422).json({
      ok: false,
      error: "Export blocked by the Tier Zero quality gate.",
      qa,
      blockers: qa.blockers,
      repairSuggestions: qa.repairSuggestions,
      nextBestStep: qa.nextBestStep,
      sourceAssessment: output.sourceAssessment || null,
      sourcePreview: String(output.source || output.sourceProfile?.sourceText || "").slice(0, 240),
      unknownClaims: output.tierZeroQa?.unknownClaims || output.qaVerdict?.unknownClaims || []
    });
  }
  const exported = saveExport(store, req.body);
  writeStore(store);
  res.json({
    ok: true,
    export: exported,
    packetContract: CANONICAL_PACKET_CONTRACT,
    packetSummary: canonicalPacketSummary(output),
    traceSummary: {
      runId: output.runId || output.tierZeroRuntime?.runId || null,
      a2aMessages: output.a2aTrace?.length || 0,
      toolReceipts: output.toolTrace?.length || 0,
      exportInspection: exported.inspection
    }
  });
});

app.post("/api/open-folder", async (req, res) => {
  const target = String(req.body?.target || "data");
  const folder = folderTarget(target);
  fs.mkdirSync(folder, { recursive: true });
  try {
    if (process.platform === "win32" && process.env.WAKE_AUDIT_NO_OPEN !== "1") {
      await execFileAsync("explorer.exe", [folder], { timeout: 5000 });
    }
    addMonitorLog("ok", `Opened folder: ${target}`);
    res.json({ ok: true, target, folder });
  } catch (error) {
    addMonitorLog("warn", `Open folder failed: ${target}`);
    res.status(500).json({ ok: false, error: error.message, target, folder });
  }
});

app.post("/api/snapshot", (req, res) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `WAKE_snapshot_${stamp}.json`;
  const file = path.join(SNAPSHOT_DIR, name);
  const payload = {
    savedAt: new Date().toISOString(),
    source: String(req.body?.source || ""),
    output: req.body?.output || null,
    state: state()
  };
  writeJsonDurable(file, payload, { reason: "operator-snapshot" });
  addMonitorLog("ok", `Snapshot saved: ${name}`);
  res.json({ ok: true, fileName: name, relativePath: `data/snapshots/${name}` });
});

app.use((error, req, res, _next) => {
  const status = Number(error?.status || (error?.code === "WAKE_DISK_FULL" ? 507 : 500));
  addMonitorLog("error", `${req.method} ${req.path}: ${error?.code || "UNHANDLED"}`);
  res.status(status).json({ ok: false, code: error?.code || "WAKE_REQUEST_FAILED", error: error?.message || "Wake request failed." });
});

if (fs.existsSync(path.join(DIST, "index.html"))) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api(?:\/|$)).*$/, (_req, res) => {
    res.sendFile(path.join(DIST, "index.html"));
  });
}

export { app };

export function startWakeServer({ port = PORT, credentialBroker = null } = {}) {
  providerCredentialBroker = credentialBroker;

  startScheduler(readStore, writeStore, ollamaStatus);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, "127.0.0.1", () => {
      console.log(`WAKE Command Console V6 -> http://127.0.0.1:${port}/`);
      resolve(server);
    });
    server.on("error", reject);
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  startWakeServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
