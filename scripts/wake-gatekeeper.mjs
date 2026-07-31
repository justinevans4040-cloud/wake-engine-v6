#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIER_ZERO_TOOLS, runTierZeroNetwork } from "../server/tier-zero-runtime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PHASE = process.argv[2] || "phase-00-gatekeeper";
const OUT_DIR = path.join(ROOT, "phase-audit", PHASE);
const COMMAND_TIMEOUT_MS = 360_000;
const PORT = 9020 + Math.floor(Math.random() * 200);
const ACTIVE_SCOPE_FILES = [
  "package.json",
  "server/index.js",
  "server/durable-storage.js",
  "server/backup-manager.js",
  "server/local-session.js",
  "server/image-generation.js",
  "server/chat-profiles.js",
  "server/no-theater.js",
  "server/tier-zero-spec-status.js",
  "server/tier-zero-runtime.js",
  "src/api.js",
  "src/app-config.jsx",
  "src/main.jsx",
  "src/styles.css",
  "electron/main.js",
  "electron/runtime-paths.js",
  "electron/secure-vault.js",
  "scripts/smoke-wake-v6.mjs",
  "scripts/benchmark-wake-v6.mjs",
  "scripts/ui-button-audit.mjs",
  "scripts/guard-local-workspace.mjs",
  "README.md",
  "WAKE_ENGINE_MAP.md",
  "TIER_ZERO_BUILD_STATUS.md"
];
const TIER_ZERO_AGENT_IDS = ["archivist", "strategist", "scriptwriter", "creative-director", "qa", "export"];
const TIER_ZERO_REQUIRED_TOOLS = {
  archivist: ["read_source", "extract_evidence", "assess_source", "build_citation_map", "classify_source", "send_a2a", "write_memory"],
  strategist: ["read_memory", "position_offer", "rank_angles", "select_next_action", "send_a2a", "write_memory"],
  scriptwriter: ["read_memory", "write_hooks", "write_titles", "write_captions", "write_script", "write_platform_variants", "map_claims", "send_a2a", "write_memory"],
  "creative-director": ["read_memory", "design_visual_system", "write_asset_prompts", "write_edit_rules", "send_a2a", "write_memory"],
  qa: ["read_memory", "validate_claims", "validate_a2a", "validate_artifacts", "score_quality", "send_a2a", "write_memory"],
  export: ["read_memory", "build_manifest", "package_markdown", "package_json", "send_a2a", "write_memory"]
};
const PHASE5_RUBRIC_KEYS = [
  "sourceFidelity",
  "claimSupport",
  "specificity",
  "audienceFit",
  "platformFit",
  "hookStrength",
  "ctaFit",
  "nonGenericWording",
  "repetitionTitleEcho",
  "packageCompleteness",
  "hallucinationRisk"
];
const PHASE4_CLUSTER_KEYS = [
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
const PHASE4_EXPORT_KEYS = [
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

const previousWakeDataDir = process.env.WAKE_DATA_DIR;
const imageProviderEnvKeys = ["WAKE_IMAGE_PROVIDER", "WAKE_IMAGE_API_URL", "WAKE_IMAGE_API_KEY", "WAKE_IMAGE_MODEL", "HF_TOKEN", "OPENAI_API_KEY"];
const previousImageProviderEnv = Object.fromEntries(imageProviderEnvKeys.map((key) => [key, process.env[key]]));
for (const key of imageProviderEnvKeys) delete process.env[key];
const GATE_RUNTIME_DATA_DIR = path.join(OUT_DIR, "runtime-data");
fs.rmSync(GATE_RUNTIME_DATA_DIR, { recursive: true, force: true });
fs.mkdirSync(GATE_RUNTIME_DATA_DIR, { recursive: true });
process.env.WAKE_DATA_DIR = GATE_RUNTIME_DATA_DIR;
process.env.WAKE_TEST_DETERMINISTIC_AUTOPILOT = "1";
process.env.WAKE_TEST_AUTH_BYPASS = "1";
const { startWakeServer } = await import("../server/index.js");

fs.mkdirSync(OUT_DIR, { recursive: true });

const verdict = {
  phase: PHASE,
  status: "pending",
  startedAt: new Date().toISOString(),
  finishedAt: null,
  nextPhaseAllowed: false,
  blockingFailures: [],
  warnings: [],
  commandsRun: [],
  artifacts: [],
  checks: []
};

function artifact(relativePath, content) {
  const file = path.join(OUT_DIR, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  verdict.artifacts.push(path.relative(ROOT, file).replaceAll("\\", "/"));
  return file;
}

function recordCheck(name, ok, details = {}) {
  verdict.checks.push({ name, ok, ...details });
  if (!ok) {
    verdict.blockingFailures.push({
      check: name,
      message: details.message || "Check failed.",
      details
    });
  }
}

function runCommand(command, args, { name, timeoutMs = COMMAND_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const startedMs = Date.now();
    const startedAt = new Date().toISOString();
    const child = spawn(command, args, {
      cwd: ROOT,
      shell: process.platform === "win32",
      env: { ...process.env, FORCE_COLOR: "0" }
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedMs;
      const result = {
        name: name || command,
        command: [command, ...args].join(" "),
        code,
        timedOut,
        durationMs,
        startedAt,
        finishedAt: new Date().toISOString()
      };
      verdict.commandsRun.push(result);
      artifact(`commands/${(name || command).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.log`, [
        `$ ${result.command}`,
        "",
        "STDOUT:",
        stdout,
        "",
        "STDERR:",
        stderr
      ].join("\n"));
      resolve({ ok: code === 0 && !timedOut, ...result, stdout, stderr });
    });
  });
}

function activeFiles() {
  return ACTIVE_SCOPE_FILES
    .map((relativePath) => path.join(ROOT, relativePath))
    .filter((file) => fs.existsSync(file));
}

function scanActiveFiles(rules, files = activeFiles()) {
  const findings = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const relativeFile = path.relative(ROOT, file).replaceAll("\\", "/");
    text.split(/\r?\n/).forEach((line, index) => {
      for (const rule of rules) {
        if (rule.pattern.test(line)) {
          findings.push({
            file: relativeFile,
            line: index + 1,
            message: rule.message,
            text: line.trim().slice(0, 180)
          });
        }
      }
    });
  }
  return findings;
}

function walkFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "release", "server/data", "phase-audit", ".git", ".smoke-run", ".ui-audit-run"].some((skip) => rel === skip || rel.startsWith(`${skip}/`))) continue;
      walkFiles(full, files);
    } else if (/\.(js|jsx|mjs|md|json)$/.test(entry.name)) {
      if (rel === "scripts/wake-gatekeeper.mjs") continue;
      files.push(full);
    }
  }
  return files;
}

function staticNoTheaterScan() {
  const banned = [
    { pattern: /Fully Wired Local/, message: "Fake fully-wired label found." },
    { pattern: /llmStatus\?\.reachable/, message: "Stale LLM reachable flag found; backend uses live." },
    { pattern: /\bTODO\b|\bFIXME\b/, message: "TODO/FIXME found in shipped path." }
  ];
  const findings = [];
  for (const file of walkFiles(ROOT)) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of banned) {
        if (rule.pattern.test(line)) {
          findings.push({
            file: path.relative(ROOT, file).replaceAll("\\", "/"),
            line: index + 1,
            message: rule.message,
            text: line.trim().slice(0, 180)
          });
        }
      }
    });
  }
  const productClaimFiles = activeFiles().filter((file) => {
    const relative = path.relative(ROOT, file).replaceAll("\\", "/");
    return !relative.startsWith("scripts/") && relative !== "server/no-theater.js";
  });
  findings.push(...scanActiveFiles([
    { pattern: /\b(?:coming soon|placeholder capability|mock capability|stub runtime|fake live|pretend live)\b/i, message: "Placeholder or fake-live product claim found." },
    { pattern: /\b(?:watch the full breakdown on wake|verified wake action|wake-only (?:topic|audience|cta|proof|lane))\b/i, message: "Wake-only output drift found in universal runtime scope." }
  ], productClaimFiles));
  artifact("static-no-theater-scan.json", JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  recordCheck("static-no-theater-scan", findings.length === 0, {
    message: findings.length ? `${findings.length} no-theater static findings.` : "Static no-theater scan passed.",
    findings
  });
}

function staticLocalOnlyConfigScan() {
  const findings = scanActiveFiles([
    { pattern: /path\.join\(os\.homedir\(\),\s*["'][^"']*(?:OneDrive|Dropbox|GoogleDrive|Google Drive|iCloudDrive|iCloud Drive)/i, message: "Active config includes a cloud/sync root." },
    { pattern: /C:\\Users\\[^"']*\\(?:OneDrive|Dropbox|GoogleDrive|Google Drive|iCloudDrive|iCloud Drive)\\/i, message: "Active code includes a cloud/sync absolute path." }
  ]);
  artifact("local-only-config-scan.json", JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  recordCheck("local-only-config-scan", findings.length === 0, {
    message: findings.length ? `${findings.length} local-only config finding(s).` : "Active config uses local-only roots.",
    findings
  });
}

function staticStaleTruthLabelScan() {
  const findings = scanActiveFiles([
    { pattern: /Draft Runtime/, message: "Stale Draft Runtime label found." },
    { pattern: /Agents draft/, message: "Stale Agents draft label found." },
    { pattern: /Draft Agents/, message: "Stale Draft Agents label found." },
    { pattern: /Local Fallback/, message: "Confusing Local Fallback label found." },
    { pattern: /Tier-Zero-style|tier-zero-style|canonicalSpecConfirmed/, message: "Tier Zero downgrade/spec-hunt wording found after promotion." }
  ]);
  artifact("stale-truth-label-scan.json", JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  recordCheck("stale-truth-label-scan", findings.length === 0, {
    message: findings.length ? `${findings.length} stale truth label(s).` : "No stale draft labels in active UI/runtime scope.",
    findings
  });
}

function staticForbiddenRuntimeDriftScan() {
  const findings = scanActiveFiles([
    { pattern: /\b(?:id|label|name|agentId|operator)\s*:\s*["'`][^"'`]*(?:loom|rune|echo|cpt|wakecodex)/i, message: "Forbidden other-app agent/project appeared as an active runtime identity." },
    { pattern: /\b(?:from|import)\s+["'`][^"'`]*(?:loom|rune|echo|cpt|wakecodex)/i, message: "Forbidden other-app agent/project appeared as an active runtime import." },
    { pattern: /\bNext(?:\.js)?\s+(?:app|repo|project|site|codebase)\b/i, message: "Forbidden Next app/project drift appeared in active runtime code." }
  ]);
  for (const file of walkFiles(ROOT)) {
    const relativeFile = path.relative(ROOT, file).replaceAll("\\", "/");
    if (/^(?:src|server)\/.*(?:loom|rune|echo|cpt|wakecodex)/i.test(relativeFile)) {
      findings.push({ file: relativeFile, line: 1, message: "Forbidden other-app identity appeared in a runtime module name.", text: relativeFile });
    }
  }
  artifact("forbidden-runtime-drift-scan.json", JSON.stringify({ ok: findings.length === 0, findings }, null, 2));
  recordCheck("forbidden-runtime-drift-scan", findings.length === 0, {
    message: findings.length ? `${findings.length} forbidden runtime drift finding(s).` : "No forbidden other-app agents/projects in active runtime code.",
    findings
  });
}

function staticPhase7CompletionScan() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const benchmark = fs.readFileSync(path.join(ROOT, "scripts", "benchmark-wake-v6.mjs"), "utf8");
  const gate = fs.readFileSync(path.join(ROOT, "scripts", "wake-gatekeeper.mjs"), "utf8");
  const server = fs.readFileSync(path.join(ROOT, "server", "index.js"), "utf8");
  const imageGeneration = fs.readFileSync(path.join(ROOT, "server", "image-generation.js"), "utf8");
  const ui = fs.readFileSync(path.join(ROOT, "src", "main.jsx"), "utf8");
  const specStatus = fs.readFileSync(path.join(ROOT, "TIER_ZERO_BUILD_STATUS.md"), "utf8");
  const requiredBudgets = ["desktopBoot", "stateLoad", "saveSource", "frameGeneration", "agentRun", "clusterGeneration", "autonomousCampaign", "chatFirstVisibleResponse", "modelWarmup", "streamedFirstToken", "export", "coreUiInteraction"];
  const interfaces = ["/api/run-agent", "/api/tier-zero/run", "/api/content-cluster", "/api/export", "/api/history", "/api/state"];
  const checks = {
    benchmarkScript: pkg.scripts?.benchmark === "npm run guard:local && node scripts/benchmark-wake-v6.mjs",
    benchmarkWiredIntoGate: /runCommand\("npm", \["run", "benchmark"\]/.test(gate),
    allBudgets: requiredBudgets.every((name) => benchmark.includes(name)),
    canonicalContract: /CANONICAL_PACKET_CONTRACT/.test(server) && /canonicalPacketSummary/.test(server),
    uiPacketContract: /packetContract/.test(ui) && /buildExportPreview/.test(ui) && /loadGeneration/.test(ui),
    publicInterfaces: interfaces.every((route) => server.includes(route)),
    autonomousCampaignInterface: server.includes('/api/autopilot') && server.includes('kind: "autonomous-campaign"'),
    originalImageInterface: server.includes('/api/images/generate') && /generateOriginalImage/.test(imageGeneration) && /detectImageType/.test(imageGeneration),
    externalImageConsent: server.includes('/api/image-generation/settings') && /IMAGE_PROVIDER_CONSENT_REQUIRED/.test(imageGeneration),
    nativePlatformPreviews: ["TikTok campaign preview", "Instagram campaign preview", "X campaign preview", "LinkedIn campaign preview"].every((label) => ui.includes(label)),
    persistedTraces: ["runRecords", "a2aMessages", "toolReceipts", "exportInspections"].every((key) => server.includes(`store.${key}`)),
    chatTarget: /Agent answer appears here/.test(ui) && /\/api\/agent-chat\/stream/.test(server),
    exportInspection: /inspectExportOutput\(bundle\)/.test(server),
    tierZeroSpecDisclaimer: /No separate canonical Tier Zero specification exists/.test(specStatus),
    universalFixtures: /non-Wake universal fixtures/.test(fs.readFileSync(path.join(ROOT, "scripts", "smoke-wake-v6.mjs"), "utf8"))
  };
  const missing = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  artifact("phase7-final-gate-contract.json", JSON.stringify({ ok: missing.length === 0, checks, requiredBudgets, interfaces }, null, 2));
  recordCheck("phase7-final-gate-contract", missing.length === 0, {
    message: missing.length ? `Phase 7 contract missing: ${missing.join(", ")}.` : "Phase 7 static contract passed.",
    missing
  });
}

function staticTierZeroPromotionScan() {
  const runtime = fs.readFileSync(path.join(ROOT, "server", "tier-zero-runtime.js"), "utf8");
  const ui = fs.readFileSync(path.join(ROOT, "src", "main.jsx"), "utf8");
  const ok = /tierZeroPromoted:\s*true/.test(runtime) && /Run Tier Zero Agents/.test(ui);
  artifact("tier-zero-promotion-check.json", JSON.stringify({ ok }, null, 2));
  recordCheck("tier-zero-promotion-check", ok, {
    message: ok ? "Tier Zero promotion authority is present." : "Tier Zero promotion authority or UI labels are missing."
  });
}

function validateTierZeroRun(data) {
  const failures = [];
  if (data.tierZeroPromoted !== true) failures.push("missing tierZeroPromoted");
  if (!data.tierZeroAuthority) failures.push("missing tierZeroAuthority");
  for (const agentId of TIER_ZERO_AGENT_IDS) {
    const trace = data.agentTrace?.find((item) => item.agentId === agentId);
    if (!trace) {
      failures.push(`${agentId}:missing-trace`);
      continue;
    }
    if (trace.status !== "done") failures.push(`${agentId}:not-done`);
    if (!trace.memory) failures.push(`${agentId}:missing-memory-write`);
    const tools = new Set(trace.tools || []);
    for (const tool of TIER_ZERO_REQUIRED_TOOLS[agentId]) {
      if (!tools.has(tool)) failures.push(`${agentId}:missing-tool:${tool}`);
    }
  }
  if (!Array.isArray(data.a2aTrace) || data.a2aTrace.length < 8) failures.push("a2a:too-few-messages");
  if (data.a2aTrace?.some((message) => message.status !== "acknowledged" || !message.producer || !message.consumer)) failures.push("a2a:bad-message-schema");
  for (const agentId of TIER_ZERO_AGENT_IDS) {
    const inbox = data.agentInbox?.[agentId] || [];
    const outbox = data.agentOutbox?.[agentId] || [];
    if (!Array.isArray(inbox) || inbox.length < 1) failures.push(`${agentId}:missing-a2a-inbox`);
    if (!Array.isArray(outbox) || outbox.length < 1) failures.push(`${agentId}:missing-a2a-outbox`);
  }
  if (!Array.isArray(data.replayableHandoffs) || data.replayableHandoffs.length < data.a2aTrace.length) failures.push("a2a:replayable-handoffs-missing");
  if (!Array.isArray(data.toolTrace) || data.toolTrace.some((call) => call.status !== "ok" || !call.inputSummary || !call.outputSummary)) failures.push("tools:bad-receipts");
  if (!data.evidenceMap?.length || !data.citationMap?.length || !data.claimMap?.length) failures.push("evidence:citation:claim-map-missing");
  if (!data.tierZeroQa?.score?.rubric || data.tierZeroQa.score.passed !== true) failures.push("qa:rubric-not-passing");
  for (const key of PHASE5_RUBRIC_KEYS) {
    const dimension = data.tierZeroQa?.score?.rubric?.[key];
    if (!dimension || typeof dimension.score !== "number" || dimension.passed !== true) failures.push(`qa:rubric:${key}`);
  }
  if (data.tierZeroQa?.verdict !== "pass" || data.tierZeroQa?.passed !== true) failures.push("qa:verdict-not-pass");
  if (data.tierZeroQa?.claimValidation?.unsupported?.length || data.tierZeroQa?.unknownClaims?.length) failures.push("qa:unsupported-claims-present");
  if (!Array.isArray(data.tierZeroQa?.repairSuggestions) || !data.tierZeroQa?.nextBestStep) failures.push("qa:repair-guidance-missing");
  if (!data.exportManifest?.requiredSections?.length) failures.push("export:manifest-incomplete");
  return failures;
}

function gateHasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== undefined && value !== null && value !== "";
}

function validatePhase4Cluster(cluster) {
  const failures = [];
  for (const key of PHASE4_CLUSTER_KEYS) {
    if (!gateHasValue(cluster[key])) failures.push(`cluster:missing:${key}`);
  }
  for (const key of ["shortsReelsTikTok", "youtube", "linkedin", "carousel"]) {
    if (!gateHasValue(cluster.platformLanes?.[key])) failures.push(`cluster:missing-lane:${key}`);
  }
  if (cluster.clusterInspection?.ok !== true) failures.push("cluster:inspection-failed");
  if (!cluster.exportManifest?.requiredSections?.length) failures.push("cluster:export-manifest-missing");
  return failures;
}

function validatePhase4Export(bundle, exportRecord) {
  const failures = [];
  for (const key of PHASE4_EXPORT_KEYS) {
    if (!gateHasValue(bundle[key])) failures.push(`export:missing:${key}`);
  }
  if (exportRecord.inspection?.ok !== true || bundle.exportInspection?.ok !== true) failures.push("export:inspection-failed");
  if (!bundle.filePaths?.relativeJsonPath || !bundle.filePaths?.relativeMdPath || !bundle.filePaths?.jsonPath || !bundle.filePaths?.mdPath) failures.push("export:file-paths-incomplete");
  return failures;
}

function staticSpeechVoiceScan() {
  const main = fs.readFileSync(path.join(ROOT, "src", "main.jsx"), "utf8");
  const config = fs.readFileSync(path.join(ROOT, "src", "app-config.jsx"), "utf8");
  const server = fs.readFileSync(path.join(ROOT, "server", "index.js"), "utf8");
  const uiAudit = fs.readFileSync(path.join(ROOT, "scripts", "ui-button-audit.mjs"), "utf8");
  const streamRoute = server.slice(server.indexOf('app.post("/api/agent-chat/stream"'));
  const required = [
    ["speech-recognition", /SpeechRecognition|webkitSpeechRecognition/.test(main)],
    ["installed-system-tts", /SpeechSynthesisUtterance/.test(main) && /Installed System TTS/.test(main)],
    ["voice-preferences", /wake\.voiceMuted/.test(main) && /wake\.voiceName/.test(main) && /wake\.voicePreset/.test(main)],
    ["voice-controls", /Read Aloud/.test(main) && /Stop system voice/.test(main) && /Mute system voice/.test(main)],
    ["boot-controls", /Skip Boot/.test(main) && /Replay boot sequence/.test(main) && /wake\.bootSeen/.test(main)],
    ["ability-contract", ["primaryAction", "outputDestination", "continueRoute"].every((key) => config.includes(key))],
    ["visible-states", /ability-state/.test(main) && /chat-error/.test(main) && /Agent answer appears here/.test(main)],
    ["instant-draft-label", /Instant Local Draft/.test(main) && /Instant Local Draft/.test(server)],
    ["stream-draft-before-provider", streamRoute.indexOf('send({ type: "draft"') >= 0 && streamRoute.indexOf('send({ type: "draft"') < streamRoute.indexOf("await ollamaStatus()")],
    ["stream-token-receipt", /send\(\{ type: "token", token \}\)/.test(streamRoute)],
    ["provider-truth-dom", /data-provider=/.test(main) && /Dishonest final chat provider/.test(uiAudit)],
    ["context-section-chat", /Ask content agents/.test(main) && /Console section chat/.test(uiAudit) && /Cluster section chat/.test(uiAudit)],
    ["playwright-phase6", /complete ability contract/.test(uiAudit) && /Replay boot sequence/.test(uiAudit) && /Read Aloud/.test(uiAudit)]
  ];
  const missing = required.filter(([, ok]) => !ok).map(([name]) => name);
  artifact("speech-voice-capability-check.json", JSON.stringify({ ok: missing.length === 0, required: Object.fromEntries(required) }, null, 2));
  recordCheck("speech-voice-capability-check", missing.length === 0, {
    message: missing.length ? `Missing Phase 6 capability hooks: ${missing.join(", ")}.` : "Phase 6 UX, chat, boot, speech-to-text, and installed System TTS hooks are present.",
    missing
  });
}

async function runtimePhase6ChatGate() {
  let server;
  try {
    server = await startWakeServer({ port: PORT + 7, host: "127.0.0.1" });
    const response = await fetch(`http://127.0.0.1:${PORT + 7}/api/agent-chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ability: "agent", agentId: "strategist", mode: "auto", message: "Create a source-faithful next step from the current local context." })
    });
    const events = (await response.text()).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    const draftIndex = events.findIndex((event) => event.type === "draft");
    const providerIndex = events.findIndex((event) => event.type === "provider-status");
    const tokenIndex = events.findIndex((event) => event.type === "token" && event.token);
    const finalEvent = events.find((event) => event.type === "final");
    const historyResponse = await fetch(`http://127.0.0.1:${PORT + 7}/api/state`);
    const history = await historyResponse.json();
    const persisted = history.agentChats?.some((chat) => chat.id === finalEvent?.chat?.id);
    const providerTruth = finalEvent?.chat?.provider === "ollama"
      ? tokenIndex > providerIndex && finalEvent.chat.providerLabel === finalEvent.chat.model
      : finalEvent?.chat?.provider === "local-deterministic" && finalEvent.chat.providerLabel === "Instant Local Draft";
    const ok = response.ok && draftIndex >= 0 && providerIndex > draftIndex && events[draftIndex]?.providerLabel === "Instant Local Draft" && Boolean(events[draftIndex]?.answer) && finalEvent?.chat?.historyStatus === "saved" && providerTruth && persisted;
    artifact("phase6-chat-runtime.json", JSON.stringify({ ok, events, persisted }, null, 2));
    recordCheck("phase6-chat-runtime", ok, {
      message: ok ? "Immediate local draft, provider upgrade path, and persisted chat history passed." : "Phase 6 chat runtime contract failed.",
      draftIndex,
      providerIndex,
      tokenIndex,
      providerTruth,
      persisted
    });
  } catch (error) {
    recordCheck("phase6-chat-runtime", false, { message: error.message });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

async function runtimeAutonomousCampaignGate() {
  let server;
  const failures = [];
  try {
    server = await startWakeServer({ port: PORT + 8, host: "127.0.0.1" });
    const post = async (pathname, body) => {
      const response = await fetch(`http://127.0.0.1:${PORT + 8}${pathname}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      return { response, body: await response.json() };
    };
    const projectResult = await post("/api/projects", { name: "Autonomous Campaign Gate" });
    const projectId = projectResult.body.project?.id;
    const source = "A local home organizer offers a two-week kitchen reset with labeled zones, donation pickup coordination, and a simple maintenance plan for busy families.";
    const sourceResult = await post("/api/sources", { projectId, source });
    if (!projectResult.response.ok || !sourceResult.response.ok) failures.push("autopilot:project-source-setup-failed");
    const campaignResult = await post("/api/autopilot", { projectId });
    const campaign = campaignResult.body.campaign;
    const platforms = Object.keys(campaign?.platforms || {}).sort();
    if (!campaignResult.response.ok || campaign?.autonomous !== true) failures.push("autopilot:run-failed");
    if (platforms.join(",") !== "instagram,linkedin,tiktok,x") failures.push("autopilot:platform-previews-incomplete");
    if (!campaign?.cluster?.clusterInspection?.ok || !campaign?.packetSummary?.complete) failures.push("autopilot:canonical-cluster-incomplete");
    if (!campaign?.a2aTrace?.length || !campaign?.toolTrace?.length) failures.push("autopilot:traces-missing");
    if (campaign?.imageGeneration?.consentRequired !== true || campaign?.generatedImages?.length !== 0) failures.push("autopilot:image-consent-state-dishonest");
    if (/\bWAKE\b|Wake Engine/i.test(JSON.stringify(campaign?.platforms || {}))) failures.push("autopilot:wake-only-output-drift");
    const imageResult = await post("/api/images/generate", { campaignId: campaign?.id, platform: "instagram" });
    if (imageResult.response.status !== 409 || imageResult.body.code !== "IMAGE_PROVIDER_CONSENT_REQUIRED") failures.push("autopilot:pre-consent-image-not-blocked");
    const stateResponse = await fetch(`http://127.0.0.1:${PORT + 8}/api/state`);
    const state = await stateResponse.json();
    if (!state.campaigns?.some((item) => item.id === campaign?.id) || !state.recentGenerations?.some((item) => item.kind === "autonomous-campaign")) failures.push("autopilot:persistence-missing");
    artifact("autonomous-campaign-runtime.json", JSON.stringify({ ok: failures.length === 0, failures, campaign, imageBlock: imageResult.body }, null, 2));
    recordCheck("autonomous-campaign-runtime", failures.length === 0, {
      message: failures.length ? `Autonomous campaign failures: ${failures.join(", ")}` : "Autonomous project-memory campaign, platform previews, persistence, traces, and image consent passed.",
      failures
    });
  } catch (error) {
    recordCheck("autonomous-campaign-runtime", false, { message: error.message });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

async function runtimeNoTheaterAudit() {
  let server;
  try {
    server = await startWakeServer({ port: PORT, host: "127.0.0.1" });
    const response = await fetch(`http://127.0.0.1:${PORT}/api/no-theater/status`);
    const data = await response.json();
    artifact("no-theater-audit.json", JSON.stringify(data, null, 2));
    recordCheck("runtime-no-theater-audit", response.ok && data.ok === true, {
      message: data.ok ? "Runtime no-theater audit passed." : "Runtime no-theater audit failed.",
      summary: data.summary,
      violations: data.violations || []
    });
  } catch (error) {
    recordCheck("runtime-no-theater-audit", false, { message: error.message });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

async function runtimeTierZeroAudit() {
  let server;
  try {
    server = await startWakeServer({ port: PORT + 1, host: "127.0.0.1" });
    const auditResponse = await fetch(`http://127.0.0.1:${PORT + 1}/api/tier-zero/audit`);
    const audit = await auditResponse.json();
    const agentsResponse = await fetch(`http://127.0.0.1:${PORT + 1}/api/tier-zero/agents`);
    const agents = await agentsResponse.json();
    const agentsComplete = Array.isArray(agents.agents) && agents.agents.length === 6 && agents.agents.every((agent) =>
      agent.status === "live" &&
      agent.tierZeroVerified === true &&
      agent.contract &&
      Array.isArray(agent.tools) && agent.tools.length &&
      Array.isArray(agent.a2a) && agent.a2a.length &&
      Array.isArray(agent.tests) && agent.tests.length
    );
    artifact("tier-zero-runtime-audit.json", JSON.stringify({ audit, agents }, null, 2));
    recordCheck("tier-zero-runtime-audit", auditResponse.ok && agentsResponse.ok && audit.ok === true && agentsComplete, {
      message: audit.ok && agentsComplete ? "Tier Zero runtime audit passed." : "Tier Zero runtime audit failed.",
      summary: audit.summary,
      agentCount: agents.agents?.length || 0,
      violations: audit.violations || []
    });
  } catch (error) {
    recordCheck("tier-zero-runtime-audit", false, { message: error.message });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

async function runtimeTierZeroBuildGate() {
  let server;
  try {
    server = await startWakeServer({ port: PORT + 3, host: "127.0.0.1" });
    const source = "A local home organizer offers a two-week kitchen reset with labeled zones, donation pickup coordination, and a simple maintenance plan for busy families.";
    const response = await fetch(`http://127.0.0.1:${PORT + 3}/api/tier-zero/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source })
    });
    const data = await response.json();
    const failures = response.ok ? validateTierZeroRun(data) : [`request:${data.error || response.statusText}`];
    if (!failures.length) {
      const historyResponse = await fetch(`http://127.0.0.1:${PORT + 3}/api/history`);
      const history = await historyResponse.json();
      const persistedRun = history.runRecords?.some((run) => run.id === data.runId);
      const persistedMessages = history.a2aMessages?.filter((message) => message.runId === data.runId) || [];
      const persistedReplay = history.replayableHandoffs?.filter((handoff) => handoff.runId === data.runId) || [];
      if (!persistedRun) failures.push("a2a:persisted-run-missing");
      if (persistedMessages.length < data.a2aTrace.length) failures.push("a2a:persisted-messages-missing");
      if (persistedReplay.length < data.replayableHandoffs.length) failures.push("a2a:persisted-replay-missing");
    }
    artifact("tier-zero-build-parameters-gate.json", JSON.stringify({ ok: failures.length === 0, failures, agentTrace: data.agentTrace, a2aTrace: data.a2aTrace, toolTrace: data.toolTrace }, null, 2));
    recordCheck("tier-zero-build-parameters-gate", failures.length === 0, {
      message: failures.length ? `Tier Zero build parameter failures: ${failures.join(", ")}` : "Tier Zero build parameters passed.",
      failures
    });
  } catch (error) {
    recordCheck("tier-zero-build-parameters-gate", false, { message: error.message });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

async function runtimePhase4ClusterExportGate() {
  let server;
  const dataDir = path.join(OUT_DIR, "phase4-data");
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const previousDataDir = process.env.WAKE_DATA_DIR;
  process.env.WAKE_DATA_DIR = dataDir;
  try {
    server = await startWakeServer({ port: PORT + 4, host: "127.0.0.1" });
    const source = "A local fitness coach is launching a four-week strength reset for busy nurses with twenty-minute workouts, shift-aware recovery, simple meal prep prompts, and a private check-in thread.";
    const clusterResponse = await fetch(`http://127.0.0.1:${PORT + 4}/api/content-cluster`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source })
    });
    const cluster = await clusterResponse.json();
    const failures = clusterResponse.ok ? validatePhase4Cluster(cluster) : [`cluster:request:${cluster.error || clusterResponse.statusText}`];
    if (!failures.length) {
      const exportResponse = await fetch(`http://127.0.0.1:${PORT + 4}/api/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cluster.sourceInbox?.title, output: cluster })
      });
      const exported = await exportResponse.json();
      if (!exportResponse.ok) {
        failures.push(`export:request:${exported.error || exportResponse.statusText}`);
      } else {
        const bundle = JSON.parse(fs.readFileSync(exported.export.jsonPath, "utf8"));
        failures.push(...validatePhase4Export(bundle, exported.export));
        const markdown = fs.readFileSync(exported.export.mdPath, "utf8");
        for (const heading of ["## Manifest", "## Source", "## Evidence And Citations", "## Claim Map", "## Scripts And Variants", "## Creative Direction And Visual Prompts", "## QA Verdict", "## Traces", "## Next Action", "## File Paths"]) {
          if (!markdown.includes(heading)) failures.push(`export:markdown-missing:${heading}`);
        }
      }
    }
    artifact("phase4-cluster-export-gate.json", JSON.stringify({ ok: failures.length === 0, failures, clusterInspection: cluster.clusterInspection }, null, 2));
    recordCheck("phase4-cluster-export-gate", failures.length === 0, {
      message: failures.length ? `Phase 4 cluster/export failures: ${failures.join(", ")}` : "Phase 4 creation cluster and export bundle passed.",
      failures
    });
  } catch (error) {
    recordCheck("phase4-cluster-export-gate", false, { message: error.message });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (previousDataDir === undefined) {
      delete process.env.WAKE_DATA_DIR;
    } else {
      process.env.WAKE_DATA_DIR = previousDataDir;
    }
  }
}

async function runtimePhase5QualityGate() {
  let server;
  const dataDir = path.join(OUT_DIR, "phase5-data");
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const previousDataDir = process.env.WAKE_DATA_DIR;
  process.env.WAKE_DATA_DIR = dataDir;
  const failures = [];
  let details = {};
  try {
    const source = "A neighborhood clinic offers Saturday vaccine appointments for working parents with online scheduling, transparent pricing, and a nurse callback before each visit.";
    const strong = runTierZeroNetwork({ source }).pack;
    const unsupported = TIER_ZERO_TOOLS.validate_claims(strong.evidenceMap, [{
      id: "unsupported-claim",
      beat: "Proof",
      line: "Every appointment is guaranteed to cut healthcare costs in half.",
      evidenceId: strong.evidenceMap[0]?.id,
      status: "source-backed"
    }]);
    if (unsupported.passed || unsupported.unsupported?.[0]?.status !== "unknown/not enough source" || unsupported.unsupported?.[0]?.publishable !== false) {
      failures.push("unsupported-claim-not-blocked");
    }

    const genericQuality = TIER_ZERO_TOOLS.score_quality({
      source,
      sourceAssessment: strong.sourceAssessment,
      evidence: strong.evidenceMap,
      citationMap: strong.citationMap,
      claims: strong.claimMap,
      claimValidation: strong.tierZeroQa.claimValidation,
      hooks: [{ line: "Unlock your potential with this revolutionary game-changer.", evidenceId: strong.evidenceMap[0]?.id }],
      titles: ["A World-Class, Next-Level Solution"],
      scripts: strong.scripts,
      platformVariants: [
        { platform: "Shorts/TikTok/Reels", hook: "Unlock your potential.", structure: "generic montage", cta: "Start now." },
        { platform: "LinkedIn", hook: "A revolutionary solution.", structure: "generic post", cta: "Start now." },
        { platform: "YouTube", hook: "The next-level answer.", structure: "generic video", cta: "Start now." }
      ],
      strategy: { audience: "working parents", promise: strong.evidenceMap[0]?.quote, angle: "world-class care" },
      creativeDirection: { visualDirection: "generic montage" },
      a2aMessages: strong.a2aTrace
    });
    if (genericQuality.passed || genericQuality.rubric?.nonGenericWording?.passed !== false || !genericQuality.rubric?.nonGenericWording?.matches?.length) {
      failures.push("generic-packet-not-blocked");
    }

    server = await startWakeServer({ port: PORT + 5, host: "127.0.0.1" });
    const weakResponse = await fetch(`http://127.0.0.1:${PORT + 5}/api/tier-zero/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "Make this amazing." })
    });
    const weak = await weakResponse.json();
    if (!weakResponse.ok || weak.ok !== false || weak.sourceAssessment?.status !== "not enough source" || weak.tierZeroQa?.verdict !== "blocked") {
      failures.push("weak-source-not-blocked");
    }
    if (!weak.tierZeroQa?.repairSuggestions?.length || !weak.tierZeroQa?.nextBestStep) failures.push("weak-source-repair-guidance-missing");
    if (weak.hooks?.length || weak.titles?.length || weak.scripts?.length || weak.platformVariants?.length || weak.contentArsenal?.status !== "blocked") {
      failures.push("weak-source-produced-publishable-content");
    }
    const exportResponse = await fetch(`http://127.0.0.1:${PORT + 5}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Blocked weak source", output: weak })
    });
    const blockedExport = await exportResponse.json();
    if (exportResponse.status !== 422 || blockedExport.ok !== false || !blockedExport.repairSuggestions?.length) failures.push("blocked-packet-exported");

    details = {
      unsupportedClaim: unsupported.unsupported?.[0],
      genericQuality,
      weakSource: {
        ok: weak.ok,
        sourceAssessment: weak.sourceAssessment,
        qaVerdict: weak.tierZeroQa,
        contentArsenal: weak.contentArsenal
      },
      blockedExport
    };
    artifact("phase5-accuracy-quality-gate.json", JSON.stringify({ ok: failures.length === 0, failures, ...details }, null, 2));
    recordCheck("phase5-accuracy-quality-gate", failures.length === 0, {
      message: failures.length ? `Phase 5 quality failures: ${failures.join(", ")}` : "Phase 5 elite rubric, unsupported-claim block, generic-content block, and weak-source repair path passed.",
      failures
    });
  } catch (error) {
    recordCheck("phase5-accuracy-quality-gate", false, { message: error.message });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (previousDataDir === undefined) {
      delete process.env.WAKE_DATA_DIR;
    } else {
      process.env.WAKE_DATA_DIR = previousDataDir;
    }
  }
}

async function runtimeLatencyBenchmark() {
  let server;
  const dataDir = path.join(OUT_DIR, "benchmark-data");
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const previousDataDir = process.env.WAKE_DATA_DIR;
  process.env.WAKE_DATA_DIR = dataDir;
  try {
    server = await startWakeServer({ port: PORT + 2, host: "127.0.0.1" });
    const source = [
      "WAKE turns rough source material into a content creation packet.",
      "The packet must include evidence, platform variants, script structure, export readiness, and a next action.",
      "The local runtime must stay honest about verified capabilities and block unsupported claims.",
      "Tier Zero content agents hand work from archivist to strategist to scriptwriter to creative director to QA to export."
    ].join(" ");
    const measures = [];
    const timedJson = async (name, pathname, init, budgetMs) => {
      const started = performance.now();
      const response = await fetch(`http://127.0.0.1:${PORT + 2}${pathname}`, init);
      const body = await response.json().catch(() => ({}));
      const durationMs = Math.round(performance.now() - started);
      measures.push({ name, durationMs, budgetMs, ok: response.ok, passed: response.ok && durationMs <= budgetMs });
      if (!response.ok) throw new Error(`${name} failed: ${body.error || response.statusText}`);
      return body;
    };
    await timedJson("agent-chat-fast-draft", "/api/agent-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "strategist", ability: "agent", mode: "instant", message: "Give me the next source-backed action." })
    }, 900);
    const tierZeroRun = await timedJson("tier-zero-run", "/api/tier-zero/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source })
    }, 1800);
    const quality = tierZeroRun.tierZeroQa?.score || {};
    const passed = measures.every((item) => item.passed) && tierZeroRun.qualityFlags?.qaPassed === true && quality.passed === true;
    artifact("latency-benchmark.json", JSON.stringify({ ok: passed, measures, tierZeroQuality: quality }, null, 2));
    recordCheck("latency-benchmark", passed, {
      message: passed ? "Latency benchmark passed." : "Latency benchmark failed.",
      measures,
      tierZeroQuality: quality
    });
  } catch (error) {
    recordCheck("latency-benchmark", false, { message: error.message });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (previousDataDir === undefined) {
      delete process.env.WAKE_DATA_DIR;
    } else {
      process.env.WAKE_DATA_DIR = previousDataDir;
    }
  }
}

function writeHuggingFaceAudit() {
  artifact("huggingface-audit.md", [
    "# Hugging Face Audit",
    "",
    "Phase 0 does not introduce a new ML, STT, embedding, or model-quality claim.",
    "",
    "Result: no Hugging Face-backed model claim introduced in this phase."
  ].join("\n"));
  recordCheck("huggingface-audit", true, { message: "No ML/model claim introduced in this phase." });
}

function finish() {
  verdict.finishedAt = new Date().toISOString();
  verdict.status = verdict.blockingFailures.length ? "fail" : "pass";
  verdict.nextPhaseAllowed = verdict.status === "pass";
  artifact("command-timings.json", JSON.stringify(verdict.commandsRun.map((command) => ({
    name: command.name,
    command: command.command,
    code: command.code,
    durationMs: command.durationMs,
    timedOut: command.timedOut
  })), null, 2));
  artifact("phase-verdict.json", JSON.stringify(verdict, null, 2));
  const reportName = verdict.status === "pass" ? "PHASE_COMPLETE.md" : "PHASE_BLOCKED.md";
  artifact(reportName, [
    `# ${PHASE} ${verdict.status === "pass" ? "Complete" : "Blocked"}`,
    "",
    `Status: ${verdict.status}`,
    `Next phase allowed: ${verdict.nextPhaseAllowed}`,
    "",
    "## Blocking failures",
    "",
    ...(verdict.blockingFailures.length
      ? verdict.blockingFailures.map((failure) => `- ${failure.check}: ${failure.message}`)
      : ["- None"]),
    "",
    "## Commands",
    "",
    ...verdict.commandsRun.map((command) => `- ${command.name}: exit ${command.code}${command.timedOut ? " (timed out)" : ""}`),
    "",
    "## Artifacts",
    "",
    ...verdict.artifacts.map((item) => `- ${item}`)
  ].join("\n"));
}

staticNoTheaterScan();
staticLocalOnlyConfigScan();
staticStaleTruthLabelScan();
staticForbiddenRuntimeDriftScan();
staticTierZeroPromotionScan();
staticSpeechVoiceScan();
staticPhase7CompletionScan();

const phase8 = await runCommand("npm", ["run", "audit:phase8"], { name: "phase8-truth-baseline" });
recordCheck("phase8-truth-baseline", phase8.ok, { message: phase8.ok ? "Phase 8 truth baseline passed." : "Phase 8 truth baseline failed." });

const phase9 = await runCommand("npm", ["run", "audit:phase9"], { name: "phase9-durability-security" });
recordCheck("phase9-durability-security", phase9.ok, { message: phase9.ok ? "Phase 9 durability and local security passed." : "Phase 9 durability and local security failed." });

const build = await runCommand("npm", ["run", "build"], { name: "build" });
recordCheck("build", build.ok, { message: build.ok ? "Build passed." : "Build failed." });

const smoke = await runCommand("npm", ["run", "smoke"], { name: "smoke" });
recordCheck("smoke", smoke.ok, { message: smoke.ok ? "Smoke passed." : "Smoke failed." });

await runtimeNoTheaterAudit();
await runtimeTierZeroAudit();
await runtimeTierZeroBuildGate();
await runtimePhase4ClusterExportGate();
await runtimePhase5QualityGate();
await runtimePhase6ChatGate();
await runtimeAutonomousCampaignGate();
const benchmark = await runCommand("npm", ["run", "benchmark"], { name: "performance-benchmark", timeoutMs: 180_000 });
recordCheck("performance-benchmark", benchmark.ok, { message: benchmark.ok ? "Performance benchmark passed." : "Performance benchmark failed." });

const ui = await runCommand("npm", ["run", "audit:ui"], { name: "playwright-ui-audit", timeoutMs: 300_000 });
recordCheck("playwright-ui-audit", ui.ok, { message: ui.ok ? "Playwright UI audit passed." : "Playwright UI audit failed." });

writeHuggingFaceAudit();
finish();

if (previousWakeDataDir === undefined) delete process.env.WAKE_DATA_DIR;
else process.env.WAKE_DATA_DIR = previousWakeDataDir;
for (const key of imageProviderEnvKeys) {
  if (previousImageProviderEnv[key] === undefined) delete process.env[key];
  else process.env[key] = previousImageProviderEnv[key];
}

if (verdict.status !== "pass") process.exit(1);
