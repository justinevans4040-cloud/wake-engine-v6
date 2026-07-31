#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE8_CONTENT_FIXTURES, UNIVERSAL_CONTENT_FIXTURES } from "./fixtures/phase8-content-baselines.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EXPECTED_ROOT = path.resolve("C:\\Users\\justi\\Documents\\repos\\wake-engine");
const OUT_DIR = path.join(ROOT, "phase-audit", "phase-08-truth-baseline");
const STORE_PATH = path.join(ROOT, "server", "data", "wake-v6-store.json");
const BASELINE_PATH = path.join(OUT_DIR, "baseline-manifest.json");
const CONNECTOR_EVIDENCE_PATH = path.join(OUT_DIR, "connector-evidence.json");

fs.mkdirSync(OUT_DIR, { recursive: true });

const checks = [];
const startedAt = new Date().toISOString();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function addCheck(id, passed, details = {}) {
  checks.push({ id, passed: Boolean(passed), ...details });
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else files.push(path.relative(ROOT, fullPath).replaceAll("\\", "/"));
    }
  };
  walk(root);
  return files;
}

const packageJson = readJson(path.join(ROOT, "package.json"));
const packageLock = readJson(path.join(ROOT, "package-lock.json"));
const store = readJson(STORE_PATH);
const baseline = readJson(BASELINE_PATH);
const connectorEvidence = readJson(CONNECTOR_EVIDENCE_PATH);
const mainSource = fs.readFileSync(path.join(ROOT, "src", "main.jsx"), "utf8");
const styleSource = fs.readFileSync(path.join(ROOT, "src", "styles.css"), "utf8");
const serverSource = fs.readFileSync(path.join(ROOT, "server", "index.js"), "utf8");
const gateSource = fs.readFileSync(path.join(ROOT, "scripts", "wake-gatekeeper.mjs"), "utf8");

const normalizedRoot = ROOT.toLowerCase();
addCheck("authorized-local-repo", normalizedRoot === EXPECTED_ROOT.toLowerCase() && !/onedrive|dropbox|googledrive|google drive|icloud/i.test(ROOT), {
  actual: ROOT,
  expected: EXPECTED_ROOT
});

const lockElectron = packageLock.packages?.["node_modules/electron"]?.version;
const lockBuilder = packageLock.packages?.["node_modules/electron-builder"]?.version;
const installedElectronPath = path.join(ROOT, "node_modules", "electron", "package.json");
const installedBuilderPath = path.join(ROOT, "node_modules", "electron-builder", "package.json");
const installedElectron = fs.existsSync(installedElectronPath) ? readJson(installedElectronPath).version : null;
const installedBuilder = fs.existsSync(installedBuilderPath) ? readJson(installedBuilderPath).version : null;
addCheck("dependency-lock-alignment", installedElectron === lockElectron && installedBuilder === lockBuilder, {
  electron: { requested: packageJson.devDependencies?.electron, locked: lockElectron, installed: installedElectron },
  electronBuilder: { requested: packageJson.devDependencies?.["electron-builder"], locked: lockBuilder, installed: installedBuilder }
});

const loginTokens = [
  "function OperatorGate",
  "WAKE ENGINE V6",
  "Operator Login",
  "local session gate online",
  "content runtime isolated",
  'aria-label="Operator callsign"',
  'aria-label="Access phrase"',
  'aria-label="Enter Wake Engine"'
];
const loginStyles = [".operator-gate", ".operator-console", ".operator-orb", ".operator-runes", ".operator-panel", ".operator-readout", ".operator-enter"];
addCheck("old-school-login-contract", loginTokens.every((token) => mainSource.includes(token)) && loginStyles.every((selector) => styleSource.includes(selector)), {
  requiredTokens: loginTokens,
  requiredSelectors: loginStyles
});

const screenshotResults = baseline.screenshots.map((item) => {
  const filePath = path.join(OUT_DIR, item.file);
  const actualHash = fs.existsSync(filePath) ? sha256(filePath) : null;
  return { ...item, exists: fs.existsSync(filePath), actualHash, matches: actualHash === item.sha256 };
});
addCheck("current-run-visual-baselines", screenshotResults.length >= 11 && screenshotResults.every((item) => item.exists && item.matches), {
  lockedVisual: baseline.lockedVisual,
  screenshots: screenshotResults
});

const requiredFixtureIds = ["restaurant", "fitness-coach", "saas-product", "construction-company", "childrens-book", "local-service", "wake-engine", "aurora-storytime", "weak-source"];
const fixtureIds = PHASE8_CONTENT_FIXTURES.map((fixture) => fixture.id);
addCheck("versioned-content-baselines", requiredFixtureIds.every((id) => fixtureIds.includes(id)) && UNIVERSAL_CONTENT_FIXTURES.every((fixture) => fixture.expectedTerms.length && fixture.forbiddenTerms.length), {
  fixtureIds
});

addCheck("required-connectors-used", connectorEvidence.googleDrive?.authenticated === true && connectorEvidence.googleDrive?.verifiedSources?.length >= 4 && connectorEvidence.huggingFace?.authenticated === true && connectorEvidence.huggingFace?.baselineCandidates?.length >= 2 && connectorEvidence.productDesign?.preflight === "passed", {
  connectorEvidence
});

const projects = Array.isArray(store.projects) ? store.projects : [];
const sources = Array.isArray(store.sources) ? store.sources : [];
const projectIds = new Set(projects.map((project) => project.id));
const auroraProjects = projects.filter((project) => /aurora|amora/i.test(project.name || ""));
const liveStoreText = JSON.stringify(store);
const contaminatedPatterns = [
  { id: "bakery", regex: /bakery|bake shop|pastry campaign|croissant campaign/i },
  { id: "stray-childrens-expert-project", regex: /cHILDRENS YOUTUBE STORY AND CONTENT EXPERT/i },
  { id: "cloud-sync-path", regex: /(?:[a-z]:\\[^\n\r"]*(?:OneDrive|Dropbox|GoogleDrive|Google Drive|iCloud)|\/(?:OneDrive|Dropbox|GoogleDrive|Google Drive|iCloud)\/)/i }
];
const contamination = contaminatedPatterns.filter(({ regex }) => regex.test(liveStoreText)).map(({ id }) => id);
addCheck("live-data-contamination", contamination.length === 0, { contamination });
addCheck("aurora-name-lock", auroraProjects.length === 1 && auroraProjects[0].name === "Aurora Storytime", {
  matches: auroraProjects.map((project) => ({ id: project.id, name: project.name }))
});

const missingProjectReferences = [];
for (const collectionName of ["sources", "generations", "campaigns", "runRecords", "history"]) {
  for (const item of Array.isArray(store[collectionName]) ? store[collectionName] : []) {
    if (item.projectId && !projectIds.has(item.projectId)) missingProjectReferences.push({ collection: collectionName, id: item.id, projectId: item.projectId });
  }
}
addCheck("project-reference-integrity", missingProjectReferences.length === 0, { missingProjectReferences });

const pathOnlySources = sources.filter((source) => {
  const content = String(source.source || source.content || "").trim();
  return content.length < 80 || /^[a-z]:\\|^\\\\|^\/[^\n]+$/i.test(content);
});
addCheck("source-content-not-path-only", pathOnlySources.length === 0, {
  offenders: pathOnlySources.map((source) => ({ id: source.id, title: source.title }))
});

addCheck("forbidden-runtime-drift-gate-present", /staticForbiddenRuntimeDriftScan\(\)/.test(gateSource) && /forbidden runtime/i.test(gateSource), {
  scope: "agent IDs, routes, modules, runtime capabilities, and product claims"
});

const arrayCounts = Object.fromEntries(Object.entries(store).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]));
const releaseFiles = listFiles(path.join(ROOT, "release", "win-unpacked", "resources"));
const packagePatterns = packageJson.build?.files || [];
const carryForward = [
  {
    id: "real-local-authentication",
    phase: 9,
    open: /sessionStorage\.setItem\("wake\.operatorGate", "unlocked"\)/.test(mainSource),
    evidence: "The approved login still accepts any non-empty phrase and stores a renderer session flag."
  },
  {
    id: "localhost-api-binding-and-session-enforcement",
    phase: 9,
    open: /0\.0\.0\.0/.test(serverSource),
    evidence: "The server source still contains a public-interface bind default."
  },
  {
    id: "atomic-persistence-and-recovery",
    phase: 9,
    open: /writeFileSync/.test(serverSource),
    evidence: "Persistence still uses synchronous direct writes without a journaled recovery contract."
  },
  {
    id: "package-live-data-exclusion",
    phase: 9,
    open: packagePatterns.some((pattern) => pattern === "server/**/*"),
    evidence: "electron-builder currently includes the entire server tree."
  },
  {
    id: "post-login-workspace-simplification",
    phase: 12,
    open: /ForgeFront Systems/.test(mainSource),
    evidence: "The current first viewport is dominated by branding and diagnostics before creation."
  },
  {
    id: "real-model-evaluation-gate",
    phase: 14,
    open: /writeHuggingFaceAudit/.test(gateSource),
    evidence: "The current Hugging Face gate records a pass without running a real model evaluation."
  }
].filter((finding) => finding.open);

const inventory = {
  generatedAt: new Date().toISOString(),
  authorizedRoot: ROOT,
  dependencies: {
    electron: { requested: packageJson.devDependencies?.electron, locked: lockElectron, installed: installedElectron },
    electronBuilder: { requested: packageJson.devDependencies?.["electron-builder"], locked: lockBuilder, installed: installedBuilder }
  },
  store: {
    path: path.relative(ROOT, STORE_PATH).replaceAll("\\", "/"),
    arrayCounts,
    projects: projects.map((project) => ({ id: project.id, name: project.name })),
    sources: sources.map((source) => ({ id: source.id, projectId: source.projectId, title: source.title, sourceType: source.sourceType || source.type || null }))
  },
  package: {
    files: packagePatterns,
    existingReleaseFileCount: releaseFiles.length,
    riskyExistingReleaseFiles: releaseFiles.filter((file) => /server\/data|exports|snapshots|archive|backup|\.log$/i.test(file))
  },
  visualBaselines: screenshotResults.map(({ file, status, sha256: expectedHash, matches }) => ({ file, status, expectedHash, matches })),
  connectors: connectorEvidence,
  carryForward
};

const failedChecks = checks.filter((check) => !check.passed);
const verdict = {
  phase: "phase-08-truth-baseline",
  status: failedChecks.length ? "fail" : "pass",
  startedAt,
  finishedAt: new Date().toISOString(),
  checks,
  failedChecks: failedChecks.map((check) => check.id),
  carryForward: carryForward.map(({ id, phase, evidence }) => ({ id, phase, evidence })),
  evidence: [
    "baseline-manifest.json",
    "connector-evidence.json",
    "PRODUCT_DESIGN_BASELINE.md",
    "phase8-inventory.json",
    "phase8-ledger.json"
  ]
};

fs.writeFileSync(path.join(OUT_DIR, "phase8-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(OUT_DIR, "phase8-ledger.json"), `${JSON.stringify({ requirements: checks, carryForward }, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(OUT_DIR, "phase8-verdict.json"), `${JSON.stringify(verdict, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(OUT_DIR, failedChecks.length ? "PHASE_8_BLOCKED.md" : "PHASE_8_COMPLETE.md"), [
  `# Phase 8 ${failedChecks.length ? "Blocked" : "Complete"}`,
  "",
  `Status: ${verdict.status}`,
  `Checks: ${checks.length - failedChecks.length}/${checks.length} passed`,
  "",
  "## Failed checks",
  "",
  ...(failedChecks.length ? failedChecks.map((check) => `- ${check.id}`) : ["- None"]),
  "",
  "## Carried forward under explicit gates",
  "",
  ...carryForward.map((finding) => `- Phase ${finding.phase}: ${finding.id} - ${finding.evidence}`)
].join("\n"), "utf8");

for (const check of checks) console.log(`${check.passed ? "PASS" : "FAIL"} ${check.id}`);
console.log(`Phase 8: ${verdict.status} (${checks.length - failedChecks.length}/${checks.length})`);
if (failedChecks.length) process.exit(1);
