#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDataBundle, restoreDataBundle } from "../server/backup-manager.js";
import { createDurableJsonFileStore, DurableJsonStore, fileHash, readJsonDurable, recoverDurableJsonTree, writeJsonDurable } from "../server/durable-storage.js";
import { prepareRuntimeDirectories, rollbackRuntimeMigration } from "../electron/runtime-paths.js";
import { createSecureVault } from "../electron/secure-vault.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "phase-audit", "phase-09-durability-security");
const RUN_DIR = path.join(ROOT, ".phase9-audit-run");
const DATA_DIR = path.join(RUN_DIR, "data");
const LOG_DIR = path.join(RUN_DIR, "logs");
const PORT = 9260 + Math.floor(Math.random() * 100);
const checks = [];

fs.rmSync(RUN_DIR, { recursive: true, force: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

function check(id, passed, details = {}) {
  checks.push({ id, passed: Boolean(passed), ...details });
}

function artifact(name, value) {
  fs.writeFileSync(path.join(OUT_DIR, name), `${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function jsonRequest(pathname, { method = "GET", body, cookie, csrf, origin } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;
  if (csrf) headers["X-Wake-CSRF"] = csrf;
  if (origin) headers.Origin = origin;
  const response = await fetch(`http://127.0.0.1:${PORT}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function auditDurableStore() {
  const root = path.join(RUN_DIR, "durable");
  const storePath = path.join(root, "state.json");
  const store = new DurableJsonStore(storePath, { defaultValue: { revision: 0 }, retention: 3 });
  store.read();
  store.write({ revision: 1 }, { reason: "audit-one" });
  store.write({ revision: 2 }, { reason: "audit-two" });
  const metadata = JSON.parse(fs.readFileSync(`${storePath}.meta.json`, "utf8"));
  const journal = fs.readFileSync(path.join(root, "journal", "state.json.ndjson"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
  fs.writeFileSync(storePath, "{corrupt", "utf8");
  const recovered = store.read();
  const recovery = store.status().recovery;
  const automaticBackups = fs.readdirSync(path.join(root, "backups", "automatic")).filter((name) => name.endsWith(".json"));
  check("versioned-atomic-journaled-store", metadata.version >= 3 && journal.some((item) => item.status === "pending") && journal.some((item) => item.status === "committed"), { metadata, journalEntries: journal.length });
  check("crash-recovery-and-automatic-retention", recovered.revision === 1 && recovery?.status === "recovered" && automaticBackups.length <= 3, { recovered, recovery, automaticBackups });
}

function auditBundles() {
  const root = path.join(RUN_DIR, "bundles");
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "state.json"), JSON.stringify({ value: "before" }), "utf8");
  const backup = createDataBundle(root, { kind: "manual" });
  fs.writeFileSync(path.join(root, "state.json"), JSON.stringify({ value: "after" }), "utf8");
  const restored = restoreDataBundle(root, backup.fileName);
  const value = JSON.parse(fs.readFileSync(path.join(root, "state.json"), "utf8"));
  check("manual-backup-restore-export-contract", value.value === "before" && restored.preRestore?.fileName && backup.sha256 === fileHash(fs.readFileSync(backup.filePath)), { backup, restored });
}

function auditProductionJsonWalScope() {
  const root = path.join(RUN_DIR, "json-scope");
  const files = [
    path.join(root, "image-generation-settings.json"),
    path.join(root, "exports", "campaign.json"),
    path.join(root, "snapshots", "snapshot.json"),
    path.join(root, "auth-verifier.json"),
    path.join(root, "migration-v1.json")
  ];
  for (const [index, filePath] of files.entries()) writeJsonDurable(filePath, { revision: 1, index }, { reason: "phase9-json-scope" });
  const interruptedPath = files[1];
  const interrupted = createDurableJsonFileStore(interruptedPath, {
    defaultValue: {},
    crashInjector(point) {
      if (point !== "journal-pending:after-fsync") return;
      const error = new Error("Injected artifact interruption.");
      error.code = "EIO";
      throw error;
    }
  });
  try {
    interrupted.write({ revision: 2, index: 1 }, { reason: "phase9-json-scope-replay" });
  } catch {
    // Recovery below must replay the durable pending record.
  }
  const recovery = recoverDurableJsonTree(root);
  const values = files.map((filePath) => readJsonDurable(filePath, null));
  const journals = files.map((filePath) => createDurableJsonFileStore(filePath, { defaultValue: {} }).status().journal);
  check("all-production-json-artifacts-are-wal-backed", values.every((value) => value?.revision >= 1) && journals.every((journalPath) => journalPath.includes(`${path.sep}.wake-wal${path.sep}`) && fs.existsSync(journalPath)), { files, journals });
  check("artifact-tree-startup-recovery-replays-pending-json", values[1]?.revision === 2 && recovery.some((item) => item.filePath === interruptedPath), { recovered: recovery.map((item) => item.filePath), value: values[1] });
}

function auditMigration() {
  const legacy = path.join(RUN_DIR, "legacy-data");
  const userData = path.join(RUN_DIR, "user-data");
  fs.mkdirSync(path.join(legacy, "generated-images"), { recursive: true });
  fs.writeFileSync(path.join(legacy, "wake-v6-store.json"), JSON.stringify({ revision: "legacy" }), "utf8");
  fs.writeFileSync(path.join(legacy, "generated-images", "campaign.png"), "image-bytes", "utf8");
  const prepared = prepareRuntimeDirectories({ userDataDir: userData, legacyDataDir: legacy });
  const migratedStore = path.join(prepared.paths.data, "wake-v6-store.json");
  const migratedImage = path.join(prepared.paths.data, "generated-images", "campaign.png");
  fs.writeFileSync(migratedStore, JSON.stringify({ revision: "upgrade" }), "utf8");
  const rollback = rollbackRuntimeMigration({ userDataDir: userData });
  const rolledBackValue = JSON.parse(fs.readFileSync(migratedStore, "utf8"));
  const recordedPaths = prepared.migration?.files?.map((item) => item.path) || [];
  check("user-data-migration-and-rollback", fs.existsSync(migratedImage) && rollback.rolledBack && rolledBackValue.revision === "legacy" && recordedPaths.includes("generated-images/campaign.png"), { paths: prepared.paths, recordedPaths, rollback });
}

function auditSecureVault() {
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value, "utf8").map((byte) => byte ^ 0xa5),
    decryptString: (value) => Buffer.from(value).map((byte) => byte ^ 0xa5).toString("utf8")
  };
  const vault = createSecureVault({ safeStorage, secureDir: path.join(RUN_DIR, "secure") });
  vault.write({ provider: "huggingface", apiKey: "phase-nine-secret", model: "flux" });
  const raw = fs.readFileSync(vault.filePath);
  const read = vault.read();
  const status = vault.status();
  check("electron-safe-storage-provider-vault", !raw.toString("utf8").includes("phase-nine-secret") && read.apiKey === "phase-nine-secret" && status.configured && !JSON.stringify(status).includes("phase-nine-secret"), { status, vaultFile: vault.filePath });
}

function auditStaticContracts() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const files = packageJson.build?.files || [];
  const electronMain = fs.readFileSync(path.join(ROOT, "electron", "main.js"), "utf8");
  const server = fs.readFileSync(path.join(ROOT, "server", "index.js"), "utf8");
  const imageGeneration = fs.readFileSync(path.join(ROOT, "server", "image-generation.js"), "utf8");
  const installScript = fs.readFileSync(path.join(ROOT, "scripts", "install-wake-v6-local.ps1"), "utf8");
  const localSession = fs.readFileSync(path.join(ROOT, "server", "local-session.js"), "utf8");
  const runtimePaths = fs.readFileSync(path.join(ROOT, "electron", "runtime-paths.js"), "utf8");
  const packageSafe = files.includes("server/*.js") && files.includes("electron/*.js") && !files.some((item) => /server\/\*\*|data|archive|log|credential|fixture|phase-audit/i.test(item));
  check("package-excludes-live-and-audit-data", packageSafe, { files });
  check("loopback-bind-and-origin-session-guards", /app\.listen\(port, "127\.0\.0\.1"/.test(server) && /isAllowedOrigin/.test(server) && /sessionManager\.require/.test(server), {});
  check("credentials-never-env-json-log-export", !/WAKE_IMAGE_API_KEY|HF_TOKEN|OPENAI_API_KEY/.test(imageGeneration) && /safeStorage/.test(electronMain) && !/apiKey/.test(server.match(/function state\(\)[\s\S]*?const app = express\(\)/)?.[0] || ""), {});
  check("packaged-launch-has-no-dev-runtime-path", !/node_modules\\electron|C:\\Users\\justi|Arguments\s*=\s*.*root/i.test(installScript) && !/C:\\Users\\justi|OneDrive|node_modules\\electron/i.test(electronMain), {});
  check("installer-shortcut-contract", packageJson.scripts?.["package:installer"] && packageJson.build?.nsis?.createDesktopShortcut === true && /WAKE Engine Omega\.lnk/.test(installScript), {});
  check("production-json-writes-use-durable-wal-contract", /writeJsonDurable\(IMAGE_SETTINGS_FILE/.test(server) && /writeJsonDurable\(jsonPath/.test(server) && /writeJsonDurable\(file, payload/.test(server) && /writeJsonDurable\(verifierPath/.test(localSession) && /writeJsonDurable\(markerPath/.test(runtimePaths) && /createWakeStateStore\(target/.test(runtimePaths), {});
}

async function auditApi() {
  process.env.WAKE_DATA_DIR = DATA_DIR;
  process.env.WAKE_LOG_DIR = LOG_DIR;
  process.env.WAKE_REQUIRE_LOGIN = "1";
  delete process.env.WAKE_TEST_AUTH_BYPASS;
  const { startWakeServer } = await import(`../server/index.js?phase9=${Date.now()}`);
  const server = await startWakeServer({ port: PORT, host: "0.0.0.0" });
  try {
    const address = server.address();
    const unauthorized = await jsonRequest("/api/state");
    const badOrigin = await jsonRequest("/api/health", { origin: "https://attacker.invalid" });
    const login = await jsonRequest("/api/session/login", { method: "POST", body: { operator: "JUSTIN", phrase: "WAKE" } });
    const cookie = String(login.response.headers.get("set-cookie") || "").split(";")[0];
    const csrf = login.payload.csrfToken;
    const authenticated = await jsonRequest("/api/state", { cookie });
    const noCsrf = await jsonRequest("/api/projects", { method: "POST", cookie, body: { name: "Rejected Project" } });
    const backup = await jsonRequest("/api/backups", { method: "POST", cookie, csrf, body: {} });
    const concurrent = await Promise.all(Array.from({ length: 8 }, (_, index) => jsonRequest("/api/projects", { method: "POST", cookie, csrf, body: { name: `Serialized ${index}` } })));
    const projects = await jsonRequest("/api/projects", { cookie });
    const restore = await jsonRequest("/api/backups/restore", { method: "POST", cookie, csrf, body: { fileName: backup.payload.backup?.fileName } });
    const exportAll = await jsonRequest("/api/export-all", { method: "POST", cookie, csrf, body: {} });
    const cleanup = await jsonRequest("/api/cache/cleanup", { method: "POST", cookie, csrf, body: {} });
    process.env.WAKE_TEST_FORCE_DISK_FULL = "1";
    const diskFull = await jsonRequest("/api/projects", { method: "POST", cookie, csrf, body: { name: "Must Not Persist" } });
    delete process.env.WAKE_TEST_FORCE_DISK_FULL;

    const serializedNames = new Set(projects.payload.projects?.map((project) => project.name));
    check("api-bound-exclusively-to-ipv4-loopback", address?.address === "127.0.0.1", { address });
    check("unauthorized-and-invalid-origin-rejected", unauthorized.response.status === 401 && badOrigin.response.status === 403, { unauthorized: unauthorized.response.status, badOrigin: badOrigin.response.status });
    check("salted-login-http-only-expiring-session-csrf", login.response.status === 200 && /HttpOnly/i.test(login.response.headers.get("set-cookie") || "") && /Max-Age=/i.test(login.response.headers.get("set-cookie") || "") && authenticated.response.status === 200 && noCsrf.response.status === 403, { login: login.response.status, authenticated: authenticated.response.status, authenticatedPayload: authenticated.payload, noCsrf: noCsrf.response.status });
    check("serialized-api-mutations", concurrent.every((item) => item.response.ok) && Array.from({ length: 8 }, (_, index) => serializedNames.has(`Serialized ${index}`)).every(Boolean), { statuses: concurrent.map((item) => item.response.status) });
    check("backup-restore-export-cleanup-api", backup.response.ok && restore.response.ok && exportAll.response.ok && cleanup.response.ok, { backup: backup.response.status, restore: restore.response.status, restorePayload: restore.payload, exportAll: exportAll.response.status, cleanup: cleanup.response.status });
    check("disk-full-preserves-existing-data", diskFull.response.status === 507 && diskFull.payload.code === "WAKE_DISK_FULL", { status: diskFull.response.status, payload: diskFull.payload });
  } finally {
    delete process.env.WAKE_TEST_FORCE_DISK_FULL;
    delete process.env.WAKE_REQUIRE_LOGIN;
    await new Promise((resolve) => server.close(resolve));
  }
}

auditDurableStore();
auditBundles();
auditProductionJsonWalScope();
auditMigration();
auditSecureVault();
auditStaticContracts();
await auditApi();

const failed = checks.filter((item) => !item.passed);
const verdict = {
  phase: "phase-09-durability-security",
  status: failed.length ? "fail" : "pass",
  generatedAt: new Date().toISOString(),
  checks,
  failed: failed.map((item) => item.id)
};
artifact("phase9-verdict.json", verdict);
artifact(failed.length ? "PHASE_9_BLOCKED.md" : "PHASE_9_COMPLETE.md", [
  `# Phase 9 ${failed.length ? "Blocked" : "Complete"}`,
  "",
  `Status: ${verdict.status}`,
  `Checks: ${checks.length - failed.length}/${checks.length} passed`,
  "",
  "## Failed checks",
  "",
  ...(failed.length ? failed.map((item) => `- ${item.id}`) : ["- None"])
].join("\n"));

for (const item of checks) console.log(`${item.passed ? "PASS" : "FAIL"} ${item.id}`);
console.log(`Phase 9: ${verdict.status} (${checks.length - failed.length}/${checks.length})`);
fs.rmSync(RUN_DIR, { recursive: true, force: true });
if (failed.length) process.exit(1);
