#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIER_ZERO_TOOLS } from "../server/tier-zero-runtime.js";
import { UNIVERSAL_CONTENT_FIXTURES, WEAK_SOURCE_FIXTURE } from "./fixtures/phase8-content-baselines.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SMOKE_DIR = path.join(ROOT, ".smoke-run");
const PORT = String(8890 + Math.floor(Math.random() * 300));
let child = null;
let passed = 0;

const QUALITY_RUBRIC_KEYS = [
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

function ok(name) {
  passed += 1;
  console.log(`  OK ${name}`);
}

async function fetchJson(pathname, init) {
  const res = await fetch(`http://127.0.0.1:${PORT}${pathname}`, {
    ...init,
    signal: AbortSignal.timeout(init?.timeoutMs || 180000)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body;
}

function assertNoWakeBranding(label, values) {
  const offenders = values
    .flat()
    .filter(Boolean)
    .map(String)
    .filter((value) => /\bWAKE\b|Wake Engine|Watch the full breakdown on WAKE|verified WAKE action/i.test(value));
  if (offenders.length) {
    throw new Error(`${label} produced Wake-branded content for a non-Wake source: ${offenders.slice(0, 3).join(" | ")}`);
  }
}

function assertUniversalPacket(label, pack) {
  assertNoWakeBranding(label, [
    pack.frame?.role,
    pack.frame?.objective,
    pack.frame?.cta,
    pack.sourceProfile?.audience,
    pack.titles || [],
    (pack.platformVariants || []).map((item) => [item.caption, item.cta, item.hook]),
    pack.productionNotes?.assetPrompts || []
  ]);
  if (!pack.contentArsenal?.shortForm60 || !pack.platformVariants?.length || !pack.claimMap?.length || !pack.tierZeroQa?.score?.passed) {
    throw new Error(`${label} is missing universal content-agent packet layers.`);
  }
  assertEliteQa(label, pack);
}

function assertEliteQa(label, pack) {
  const qa = pack.tierZeroQa;
  if (qa?.verdict !== "pass" || qa?.passed !== true || qa?.score?.overall < 82) {
    throw new Error(`${label} did not pass the elite QA verdict.`);
  }
  for (const key of QUALITY_RUBRIC_KEYS) {
    const dimension = qa.score?.rubric?.[key];
    if (!dimension || typeof dimension.score !== "number" || typeof dimension.passed !== "boolean" || dimension.passed !== true) {
      throw new Error(`${label} failed or omitted QA rubric dimension ${key}.`);
    }
  }
  if (qa.claimValidation?.unsupported?.length || qa.unknownClaims?.length) throw new Error(`${label} contains unsupported claims.`);
  if (!Array.isArray(qa.repairSuggestions) || !qa.nextBestStep) throw new Error(`${label} QA repair guidance is incomplete.`);
}

function assertPhase5ToolGates() {
  const source = "A neighborhood clinic offers Saturday vaccine appointments for working parents with online scheduling, transparent pricing, and a nurse callback before each visit.";
  const evidence = TIER_ZERO_TOOLS.extract_evidence(source);
  const sourceAssessment = TIER_ZERO_TOOLS.assess_source(source, evidence);
  const citations = TIER_ZERO_TOOLS.build_citation_map(evidence);
  const unsupported = TIER_ZERO_TOOLS.validate_claims(evidence, [{
    id: "unsupported-claim",
    beat: "Proof",
    line: "Appointments are guaranteed to cut every family's healthcare costs in half.",
    evidenceId: evidence[0]?.id,
    status: "source-backed"
  }]);
  if (unsupported.passed || unsupported.unsupported?.[0]?.status !== "unknown/not enough source" || unsupported.unsupported?.[0]?.publishable !== false) {
    throw new Error("unsupported claim gate did not block and mark the claim unknown/not enough source");
  }
  const claims = TIER_ZERO_TOOLS.map_claims([
    { beat: "Open", line: evidence[0].quote, evidenceId: evidence[0].id },
    { beat: "Detail", line: evidence[1]?.quote || evidence[0].quote, evidenceId: evidence[1]?.id || evidence[0].id },
    { beat: "Proof", line: evidence[2]?.quote || evidence[0].quote, evidenceId: evidence[2]?.id || evidence[0].id },
    { beat: "Action", line: "Book the next available appointment.", evidenceId: "strategy-next-action" }
  ], evidence);
  const claimValidation = TIER_ZERO_TOOLS.validate_claims(evidence, claims);
  const genericQuality = TIER_ZERO_TOOLS.score_quality({
    source,
    sourceAssessment,
    evidence,
    citationMap: citations,
    claims: claimValidation.claims,
    claimValidation,
    hooks: [{ line: "Unlock your potential with this revolutionary game-changer.", evidenceId: evidence[0].id }],
    titles: ["A World-Class, Next-Level Solution"],
    scripts: claims.map((claim) => ({ line: claim.line, evidenceId: claim.evidenceId })),
    platformVariants: [
      { platform: "Shorts/TikTok/Reels", hook: "Unlock your potential.", structure: "generic montage", cta: "Start now." },
      { platform: "LinkedIn", hook: "A revolutionary solution.", structure: "generic post", cta: "Start now." },
      { platform: "YouTube", hook: "The next-level answer.", structure: "generic video", cta: "Start now." }
    ],
    strategy: { audience: "working parents", promise: evidence[0].quote, angle: "world-class care" },
    creativeDirection: { visualDirection: "generic montage" },
    a2aMessages: Array.from({ length: 8 }, (_, index) => ({ id: `message-${index + 1}` }))
  });
  if (genericQuality.passed || genericQuality.rubric?.nonGenericWording?.passed !== false || !genericQuality.rubric?.nonGenericWording?.matches?.length) {
    throw new Error("generic packet quality gate did not fail");
  }
}

const CLUSTER_REQUIRED_KEYS = [
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

const EXPORT_REQUIRED_KEYS = [
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

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== undefined && value !== null && value !== "";
}

function assertCreationCluster(cluster) {
  for (const key of CLUSTER_REQUIRED_KEYS) {
    if (!hasValue(cluster[key])) throw new Error(`content cluster missing ${key}`);
  }
  for (const key of ["shortsReelsTikTok", "youtube", "linkedin", "carousel"]) {
    if (!hasValue(cluster.platformLanes?.[key])) throw new Error(`content cluster missing platform lane ${key}`);
  }
  if (cluster.clusterInspection?.ok !== true) throw new Error(`content cluster inspection failed: ${JSON.stringify(cluster.clusterInspection)}`);
  if (!cluster.exportManifest?.requiredSections?.length) throw new Error("content cluster export manifest missing required sections");
}

function assertExportBundle(exportedJson, exportRecord) {
  for (const key of EXPORT_REQUIRED_KEYS) {
    if (!hasValue(exportedJson[key])) throw new Error(`export package missing ${key}`);
  }
  if (exportRecord.inspection?.ok !== true || exportedJson.exportInspection?.ok !== true) {
    throw new Error(`export inspection failed: ${JSON.stringify(exportRecord.inspection || exportedJson.exportInspection)}`);
  }
  if (!exportedJson.filePaths?.relativeMdPath || !exportedJson.filePaths?.relativeJsonPath) throw new Error("export bundle missing clear relative file paths");
  if (!exportedJson.filePaths?.mdPath || !exportedJson.filePaths?.jsonPath) throw new Error("export bundle missing clear absolute file paths");
}

function kill() {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

function start() {
  return new Promise((resolve, reject) => {
    child = spawn("node", ["server/index.js"], {
      cwd: ROOT,
      env: { ...process.env, PORT, WAKE_DATA_DIR: SMOKE_DIR, WAKE_TEST_DETERMINISTIC_AUTOPILOT: "1", WAKE_TEST_AUTH_BYPASS: "1" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const timer = setTimeout(() => reject(new Error("server boot timeout")), 12000);
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes(PORT)) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.includes("EADDRINUSE")) {
        clearTimeout(timer);
        reject(new Error("port in use"));
      }
    });
    child.on("error", reject);
  });
}

async function main() {
  if (fs.existsSync(SMOKE_DIR)) fs.rmSync(SMOKE_DIR, { recursive: true, force: true });
  fs.mkdirSync(SMOKE_DIR, { recursive: true });
  fs.writeFileSync(path.join(SMOKE_DIR, "wake-v6-store.json"), JSON.stringify({
    projects: [{ id: "wake-v6-main", name: "WAKE Engine V6", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    sources: [
      { id: "src-valid-local", projectId: "wake-v6-main", title: "Valid Local Source", source: "A valid local restaurant source offers a Friday family dinner menu with online reservations.", characterCount: 94, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "src-creative-misnamed", projectId: "wake-v6-main", title: "STATUS.md", sourcePath: "C:\\Work\\Writing\\STATUS.md", sourceType: "local_disk", source: "A handwritten reflection on courage: We do not become brave before the storm; courage is the choice to move while the sky is still loud.", characterCount: 128, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "src-operational-local", projectId: "wake-v6-main", title: "01_STATUS_AND_GAPS.md", sourcePath: "C:\\Work\\Project\\01_STATUS_AND_GAPS.md", sourceType: "local_disk", source: "Current status and gaps. This is a working checkpoint with setup notes, file paths, and remaining registry work.", characterCount: 112, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "src-cloud-old", projectId: "wake-v6-main", title: "Quarantined Cloud Source", sourcePath: "Z:\\Dropbox\\legacy\\cloud-note.md", source: "Local path: Z:\\Dropbox\\legacy\\cloud-note.md\n\nThis old cloud-origin source must not enter retrieval.", characterCount: 110, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ],
    mediaAssets: [], campaigns: [], generatedImages: [], agentChats: [], intakeRuns: [], generations: [], runRecords: [], a2aMessages: [], replayableHandoffs: [], toolReceipts: [], memoryReceipts: [], exportInspections: [], exports: [], history: []
  }, null, 2));
  const intakeSeed = path.join(SMOKE_DIR, "intake-seed");
  fs.mkdirSync(intakeSeed, { recursive: true });
  fs.writeFileSync(path.join(intakeSeed, "organizer-service-note.md"), "# Kitchen Reset Service\n\nA local home organizer offers labeled zones, donation pickup coordination, and a simple maintenance plan.", "utf8");
  fs.writeFileSync(path.join(intakeSeed, "STATUS.md"), "# A Paper About Becoming\n\nWe inherit many names, but the truest identity is built through the choices we make when nobody is watching.", "utf8");
  fs.writeFileSync(path.join(intakeSeed, "organizer-reference.png"), "fixture-image-metadata", "utf8");
  fs.writeFileSync(path.join(intakeSeed, "01_STATUS_AND_GAPS.md"), "Current status and gaps. Working checkpoint for registry setup and file migration.", "utf8");
  fs.writeFileSync(path.join(intakeSeed, "WAKE_C_DRIVE_TOTAL_FILE_INVENTORY_ERRORS_20260717_033221.csv"), "\"Path\",\"Operation\",\"Message\"\n\"C:\\\\Windows\\\\Temp\",\"EnumerateFiles\",\"Access to the path 'C:\\\\Windows\\\\Temp' is denied.\"\n\"C:\\\\Documents and Settings\",\"SkipReparsePointDirectory\",\"Recorded but not traversed to avoid filesystem loops.\"", "utf8");
  try {
    await start();
    const health = await fetchJson("/api/health");
    if (!health.ok || health.version !== "V6" || !health.noTheater) throw new Error("health contract failed");
    ok("health");

    const state = await fetchJson("/api/state");
    if (!state.tasks.length || !state.capabilities.length) throw new Error("state missing tasks/capabilities");
    if (state.noTheater?.ok !== true) throw new Error(`no-theater audit failed: ${JSON.stringify(state.noTheater?.violations || [])}`);
    if (state.externalOperators.some((item) => item.status === "live")) throw new Error("external operator falsely marked live");
    if (!state.projects?.length) throw new Error("projects missing from state");
    if (!state.agentPipeline?.length || state.agentPipeline.length < 6) throw new Error("agent pipeline missing");
    if (state.agentPipeline.some((stage) => !["partial", "live"].includes(stage.status) || !stage.action || !stage.source)) throw new Error("agent pipeline has weak stage data");
    if (state.agentPipeline.some((stage) => stage.status === "live" && stage.tierZeroVerified !== true)) throw new Error("live agent missing tier-zero verification");
    if (!state.tierZeroRuntime?.ok || state.agentPipeline.length < 6) throw new Error("tier-zero runtime audit missing");
    if (!state.ipSummary || !Array.isArray(state.ipSources)) throw new Error("IP vault state missing");
    if (!state.llmBridge?.statusEndpoint || !Array.isArray(state.intakeRoots)) throw new Error("chat/intake state missing");
    if (state.quarantine?.sources !== 1 || !state.ipSources.some((item) => item.id === "src-valid-local") || !state.ipSources.some((item) => item.id === "src-creative-misnamed") || state.ipSources.some((item) => item.id === "src-cloud-old") || state.ipSources.some((item) => item.id === "src-operational-local")) {
      throw new Error("cloud-origin migration did not quarantine the bad record while preserving valid local content");
    }
    if (!state.packetContract?.version || !state.tierZeroSpecStatus?.disclaimer || !state.traceSummary) throw new Error("canonical packet/spec/trace state contract missing");
    ok("truth map");
    ok("cloud migration preserves valid local content");

    assertPhase5ToolGates();
    ok("Phase 5 generic and unsupported claim gates");

    const source = "Build a 60-second short form video from these talking points: A local home organizer offers a two-week kitchen reset with labeled zones, donation pickup coordination, and a simple maintenance plan for busy families.";
    const project = await fetchJson("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Smoke Project" })
    });
    if (!project.project?.id) throw new Error("project save failed");
    ok("project persistence");

    const savedSource = await fetchJson("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.project.id, source })
    });
    if (!savedSource.source?.id || savedSource.source.projectId !== project.project.id) throw new Error("source save failed");
    ok("source persistence");

    const imageStatus = await fetchJson("/api/image-generation/status");
    if (imageStatus.available !== true || imageStatus.configured !== false || imageStatus.consentRequired !== true || imageStatus.createsOriginalImages !== false) {
      throw new Error(`image generation consent/status contract failed: ${JSON.stringify(imageStatus)}`);
    }
    ok("original image provider consent contract");

    const autonomous = await fetchJson("/api/autopilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.project.id })
    });
    const campaign = autonomous.campaign;
    const platformIds = Object.keys(campaign?.platforms || {}).sort();
    if (campaign?.autonomous !== true || campaign.knowledgeSourceCount < 1 || platformIds.join(",") !== "instagram,linkedin,tiktok,x") {
      throw new Error("autonomous project-memory campaign contract failed");
    }
    if (campaign.packetContract?.id !== "wake-content-packet" || !campaign.cluster?.clusterInspection?.ok || !campaign.a2aTrace?.length || !campaign.toolTrace?.length) {
      throw new Error("autonomous campaign is missing canonical packet, cluster, or trace data");
    }
    if (campaign.generatedImages?.length !== 0 || campaign.imageGeneration?.consentRequired !== true || Object.values(campaign.platforms).some((item) => item.imageStatus !== "provider-required")) {
      throw new Error("autonomous campaign did not preserve honest pre-consent image state");
    }
    assertNoWakeBranding("autonomous campaign", [
      campaign.title,
      campaign.campaignPacket?.promise,
      Object.values(campaign.platforms).map((item) => [item.hook, item.caption, item.cta, item.imagePrompt])
    ]);
    const internalCreativeLeak = /strongest current project opportunity|project source|status and gaps|working checkpoint|registry setup|original creative premise:|central idea:|source excerpts?|proof markers?|read the story and share its central lesson|\[object Object\]/i;
    const campaignState = await fetchJson("/api/state");
    if (internalCreativeLeak.test(JSON.stringify(campaign)) || internalCreativeLeak.test(JSON.stringify({
      campaigns: campaignState.campaigns,
      runs: campaignState.tierZeroRuns,
      messages: campaignState.a2aMessages,
      handoffs: campaignState.replayableHandoffs,
      tools: campaignState.toolReceipts,
      memory: campaignState.memoryReceipts
    }))) {
      throw new Error("autonomous campaign leaked instructions, operational material, or generic packaging anywhere in its saved packet or traces");
    }
    ok("autonomous project-memory campaign");

    const blockedImageResponse = await fetch(`http://127.0.0.1:${PORT}/api/images/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id, platform: "instagram" }),
      signal: AbortSignal.timeout(10000)
    });
    const blockedImage = await blockedImageResponse.json();
    if (blockedImageResponse.status !== 409 || blockedImage.code !== "IMAGE_PROVIDER_CONSENT_REQUIRED") {
      throw new Error(`pre-consent image generation was not blocked honestly: ${JSON.stringify(blockedImage)}`);
    }
    ok("pre-consent image generation block");

    const unsavedProject = await fetchJson("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Fitness Autonomy Fixture" })
    });
    const unsavedSource = "A fitness coach helps night-shift nurses build strength with twenty-minute workouts, recovery check-ins, and flexible weekly plans.";
    const unsavedAutonomous = await fetchJson("/api/autopilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: unsavedProject.project.id, source: unsavedSource })
    });
    if (unsavedAutonomous.campaign?.knowledgeSourceCount !== 1 || !unsavedAutonomous.campaign?.platforms?.tiktok?.caption) {
      throw new Error("autonomous unsaved-source campaign contract failed");
    }
    const unsavedText = JSON.stringify(unsavedAutonomous.campaign.platforms);
    if (/home organizer|kitchen reset/i.test(unsavedText)) throw new Error("autonomous unsaved-source campaign leaked another project's source");
    assertNoWakeBranding("autonomous unsaved-source campaign", [unsavedText]);
    ok("autonomous unsaved-source campaign isolation");

    const sourceDocument = await fetchJson(`/api/sources/${savedSource.source.id}/content`);
    if (!sourceDocument.document?.content?.includes("kitchen reset") || sourceDocument.document.projectId !== project.project.id) throw new Error("source document viewer did not return the saved document");
    ok("source document content");

    const frame = await fetchJson("/api/frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.project.id, sourceId: savedSource.source.id, source })
    });
    if (!frame.frame?.title || frame.frame.format !== "vertical" || !frame.generation?.id) throw new Error("frame generation failed");
    assertNoWakeBranding("frame", [frame.frame.role, frame.frame.objective, frame.frame.cta]);
    ok("frame generation");

    const pack = await fetchJson("/api/run-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.project.id, sourceId: savedSource.source.id, source })
    });
    if (!pack.hooks?.length || pack.engine !== "WAKE Engine Tier Zero content agent network" || !pack.generation?.id) throw new Error("agent pack failed");
    if (/^build a 60-second/i.test(pack.frame.title)) throw new Error("agent title echoed instruction wrapper");
    if (pack.hooks.some((hook) => hook.includes(": :"))) throw new Error("agent hook contains broken punctuation");
    if (!pack.frame.focusTerms?.length || !pack.scriptBeats?.length) throw new Error("agent pack missing focus terms/script beats");
    if (!pack.sourceProfile || !pack.strategicBrief || !pack.scenePlan?.length || !pack.platformVariants?.length || !pack.productionNotes) {
      throw new Error("agent pack is not a production packet");
    }
    if (!pack.claimMap?.length || !pack.contentArsenal?.shortForm60 || !pack.operatorHandoff || !pack.qaGate?.checks?.length) {
      throw new Error("agent pack missing advanced creative direction layers");
    }
    if (pack.packetContract?.id !== "wake-content-packet" || pack.packetSummary?.complete !== true) throw new Error("agent canonical packet contract missing or incomplete");
    if (pack.tierZeroPromoted !== true || !pack.tierZeroAuthority) throw new Error("tier-zero promotion authority missing");
    if (!pack.tierZeroRuntime?.runtimeAudit?.ok || !pack.a2aMessages?.length || !pack.toolCalls?.length || !pack.tierZeroQa?.score?.passed) {
      throw new Error("tier-zero agent runtime did not execute contracts/tools/A2A/QA");
    }
    if (!pack.a2aTrace?.every((message) => message.status === "acknowledged" && message.consumer && message.producer)) {
      throw new Error("tier-zero A2A trace is not persisted/acknowledged");
    }
    if (!pack.toolTrace?.every((call) => call.status === "ok" && call.inputSummary && call.outputSummary)) {
      throw new Error("tier-zero tool trace is missing receipts");
    }
    if (pack.agentTrace?.some((trace) => !trace.tools?.length || !trace.memory)) {
      throw new Error("tier-zero trace missing tools or memory receipts");
    }
    if (pack.qualityFlags?.avoidsTitleEcho !== true || pack.qualityFlags?.productionPacket !== true) {
      throw new Error("agent pack still looks like title echo output");
    }
    assertUniversalPacket("local agent", pack);
    ok("local agent");

    const tierZeroAgents = await fetchJson("/api/tier-zero/agents");
    if (!tierZeroAgents.audit?.ok || tierZeroAgents.agents?.some((agent) => !agent.contract || !agent.tools?.length || !agent.a2a?.length || !agent.tests?.length)) {
      throw new Error("tier-zero agent registry failed");
    }
    ok("tier-zero registry");

    const tierZeroRun = await fetchJson("/api/tier-zero/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.project.id, sourceId: savedSource.source.id, source })
    });
    if (!tierZeroRun.tierZeroVerified || !tierZeroRun.qualityFlags?.a2aComplete || !tierZeroRun.qualityFlags?.qaPassed) {
      throw new Error("tier-zero run endpoint failed");
    }
    if (tierZeroRun.packetContract?.version !== "1.0.0" || !tierZeroRun.tierZeroSpecStatus?.disclaimer) throw new Error("tier-zero public contract truth missing");
    assertUniversalPacket("tier-zero run", tierZeroRun);
    ok("tier-zero run");

    const status = await fetchJson("/api/agent-chat/status");
    if (!("live" in status) || status.bridge !== "ollama" || status.fallback !== "Instant Local Draft") throw new Error("agent chat status missing honest provider truth");
    ok("ollama bridge status");

    const chat = await fetchJson("/api/agent-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.project.id, agentId: "strategist", message: "What is the strongest organization-service proof in my source vault?" })
    });
    if (!chat.chat?.answer || !chat.chat?.context?.sources?.length || !chat.chat?.provider || !chat.chat?.providerLabel || chat.chat?.historyStatus !== "saved") throw new Error("agent chat failed");
    if (!["ollama", "local-deterministic"].includes(chat.chat.provider)) throw new Error("agent chat provider invalid");
    if (chat.chat.context.sources.some((item) => item.id === "src-cloud-old")) throw new Error("quarantined cloud source influenced default retrieval");
    ok("agent chat with retrieval");

    const streamResponse = await fetch(`http://127.0.0.1:${PORT}/api/agent-chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.project.id, agentId: "strategist", ability: "console", mode: "auto", message: "Give me the strongest source-backed organization-service hook." }),
      signal: AbortSignal.timeout(180000)
    });
    const streamEvents = (await streamResponse.text()).trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
    const draftIndex = streamEvents.findIndex((event) => event.type === "draft");
    const providerIndex = streamEvents.findIndex((event) => event.type === "provider-status");
    const finalEvent = streamEvents.find((event) => event.type === "final");
    if (!streamResponse.ok || draftIndex < 0 || providerIndex < 0 || draftIndex > providerIndex) throw new Error("instant local draft was not emitted before provider detection");
    if (streamEvents[draftIndex].providerLabel !== "Instant Local Draft" || !streamEvents[draftIndex].answer) throw new Error("stream draft provider truth is incomplete");
    if (!finalEvent?.chat?.answer || finalEvent.chat.historyStatus !== "saved" || !finalEvent.chat.providerLabel) throw new Error("stream final answer was not persisted honestly");
    const tokenIndex = streamEvents.findIndex((event) => event.type === "token" && event.token);
    const honestProvider = finalEvent.chat.provider === "ollama"
      ? tokenIndex > providerIndex && finalEvent.chat.providerLabel === finalEvent.chat.model
      : finalEvent.chat.provider === "local-deterministic" && finalEvent.chat.providerLabel === "Instant Local Draft";
    if (!honestProvider) throw new Error(`stream provider completion was dishonest: ${JSON.stringify({ tokenIndex, providerIndex, chat: finalEvent.chat })}`);
    ok("immediate streamed chat draft and saved upgrade");

    const intakeReview = await fetchJson("/api/intake/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roots: [intakeSeed],
        intent: "Kitchen reset service source notes and organizer campaign assets. Random screenshots, status docs, and unrelated writing should not be imported."
      })
    });
    const reviewCandidates = intakeReview.review?.candidates || [];
    const reviewByName = Object.fromEntries(reviewCandidates.map((candidate) => [candidate.name, candidate]));
    if (!intakeReview.review || intakeReview.review.scanned < 4) throw new Error("intake review scan did not inspect seed files");
    if (reviewByName["organizer-service-note.md"]?.decisionStatus !== "recommended") throw new Error("intake review did not recommend on-message source");
    if (reviewByName["STATUS.md"]?.decisionStatus !== "review") throw new Error("intake review did not hold off-message readable text for review");
    if (reviewByName["01_STATUS_AND_GAPS.md"]?.decisionStatus !== "excluded") throw new Error("intake review did not exclude operational status file");
    if (reviewByName["WAKE_C_DRIVE_TOTAL_FILE_INVENTORY_ERRORS_20260717_033221.csv"]?.decisionStatus !== "excluded") throw new Error("intake review did not exclude drive inventory error logs");
    const approvedIntakeIds = reviewCandidates.filter((candidate) => candidate.decisionStatus === "recommended").map((candidate) => candidate.reviewId);
    const intake = await fetchJson(`/api/intake/reviews/${encodeURIComponent(intakeReview.review.id)}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds: approvedIntakeIds })
    });
    if (!intake.run || intake.run.scanned < 4 || intake.run.sourceAdded < 1 || intake.run.mediaAdded > 1 || intake.run.skippedOperational < 0) throw new Error("intake review apply failed content-based source eligibility");
    ok("ip/media intake review gate");

    const cluster = await fetchJson("/api/content-cluster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.project.id, sourceId: savedSource.source.id, source })
    });
    if (!cluster.pillars?.length || !cluster.outputMatrix?.length) throw new Error("content cluster failed");
    if (cluster.packetContract?.id !== "wake-content-packet" || !cluster.packetSummary) throw new Error("cluster canonical packet summary missing");
    assertCreationCluster(cluster);
    if (!cluster.generation?.id) throw new Error("content cluster generation was not saved");
    if (cluster.dispatchQueue.some((item) => item.status === "live")) throw new Error("cluster dispatch falsely marked live");
    assertNoWakeBranding("content cluster", [
      cluster.pillars.map((item) => [item.theme, item.angle]),
      cluster.outputMatrix.map((item) => [item.lane, item.detail]),
      cluster.dispatchQueue.map((item) => [item.operator, item.action, item.detail]),
      Object.values(cluster.platformLanes || {}).map((lane) => [lane.hook, lane.caption, lane.cta])
    ]);
    ok("content cluster");

    const exported = await fetchJson("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.project.id,
        sourceId: savedSource.source.id,
        generationId: pack.generation.id,
        title: pack.frame.title,
        output: pack
      })
    });
    if (!exported.export?.relativeMdPath || !exported.export?.relativeJsonPath) throw new Error("export failed");
    if (exported.packetContract?.version !== "1.0.0" || !exported.packetSummary || exported.traceSummary?.exportInspection?.ok !== true) throw new Error("export trace-compatible summary missing");
    const exportedJson = JSON.parse(fs.readFileSync(exported.export.jsonPath || path.join(ROOT, exported.export.relativeJsonPath), "utf8"));
    const exportedMarkdown = fs.readFileSync(exported.export.mdPath || path.join(ROOT, exported.export.relativeMdPath), "utf8");
    assertExportBundle(exportedJson, exported.export);
    for (const heading of ["## Manifest", "## Source", "## Evidence And Citations", "## Claim Map", "## Scripts And Variants", "## Creative Direction And Visual Prompts", "## QA Verdict", "## Traces", "## Next Action", "## File Paths"]) {
      if (!exportedMarkdown.includes(heading)) throw new Error(`export markdown missing ${heading}`);
    }
    if (!exportedMarkdown.includes("```json") || !exportedMarkdown.includes("kitchen reset")) throw new Error("export markdown does not contain inspectable package content");
    ok("export");

    for (const { label, source: fixtureSource } of UNIVERSAL_CONTENT_FIXTURES) {
      const fixturePack = await fetchJson("/api/run-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: fixtureSource })
      });
      assertUniversalPacket(`fixture:${label}`, fixturePack);
    }
    ok("non-Wake universal fixtures");

    const weakSource = await fetchJson("/api/tier-zero/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: WEAK_SOURCE_FIXTURE.source })
    });
    if (weakSource.ok !== false || weakSource.sourceAssessment?.status !== "not enough source" || weakSource.tierZeroQa?.verdict !== "blocked") {
      throw new Error("weak source did not produce an explicit blocked repair path");
    }
    if (!weakSource.tierZeroQa?.repairSuggestions?.length || !weakSource.tierZeroQa?.nextBestStep || weakSource.qualityFlags?.qaPassed !== false) {
      throw new Error("weak source is missing repair suggestions or next best step");
    }
    if (weakSource.hooks?.length || weakSource.titles?.length || weakSource.scripts?.length || weakSource.platformVariants?.length || weakSource.contentArsenal?.status !== "blocked") {
      throw new Error("weak source produced publishable-looking content instead of a blocked packet");
    }
    const blockedExportResponse = await fetch(`http://127.0.0.1:${PORT}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Weak source", output: weakSource })
    });
    const blockedExport = await blockedExportResponse.json();
    if (blockedExportResponse.status !== 422 || blockedExport.ok !== false || !blockedExport.repairSuggestions?.length) {
      throw new Error("blocked QA packet was allowed through export");
    }
    ok("weak source repair and export block");

    const snapshot = await fetchJson("/api/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, output: pack })
    });
    if (!snapshot.relativePath?.includes("data/snapshots")) throw new Error("snapshot failed");
    ok("snapshot");

    const history = await fetchJson("/api/history");
    if (!history.history?.length || !history.sources?.length || !history.generations?.length || !history.exports?.length) {
      throw new Error("history/store contract failed");
    }
    const exportRun = history.runRecords?.find((run) => run.kind === "export" && run.exportId === exported.export.id);
    if (!history.packetContract?.version || !history.traceSummary || !exportRun?.exportInspection?.ok || !Array.isArray(exportRun.a2aTrace) || !Array.isArray(exportRun.toolTrace)) throw new Error("persisted export run/trace contract missing");
    ok("history");

    const finalState = await fetchJson("/api/state");
    if (!finalState.ipSources?.length) throw new Error("IP vault sources empty after source save");
    if (!finalState.ipSummary?.lanes?.length || !finalState.ipSummary?.sourceTypes?.length) throw new Error("IP vault summary is empty");
    if (!finalState.mediaAssets?.length || !finalState.mediaSummary?.kinds?.length) throw new Error("Media vault state is empty");
    if (!finalState.agentChats?.length) throw new Error("Agent chat history missing");
    if (finalState.campaigns?.length < 2 || !finalState.campaigns.some((item) => item.id === campaign.id)) throw new Error("Autonomous campaigns were not persisted in state");
    ok("ip vault state");

    console.log(`\n${passed} passed, 0 failed`);
  } finally {
    kill();
    if (fs.existsSync(SMOKE_DIR)) fs.rmSync(SMOKE_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`\nSMOKE FAILED: ${error.message}`);
  kill();
  process.exit(1);
});
