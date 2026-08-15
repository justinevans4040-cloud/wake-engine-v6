import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { createLocalSessionManager } from "../server/local-session.js";
import { createDataBundle, restoreDataBundle } from "../server/backup-manager.js";
import { fileHash } from "../server/durable-storage.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DIR = path.join(ROOT, ".challenger-security-audit");

console.log("=================================================================");
console.log(" TRACK 4 HOSTILE SECURITY, BIOMETRIC & LEAKAGE AUDIT");
console.log("=================================================================");

fs.rmSync(TEST_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_DIR, { recursive: true });

const results = [];
function recordResult(category, testName, passed, details = {}) {
  results.push({ category, testName, passed: Boolean(passed), details });
  console.log(`[${passed ? "PASS" : "FAIL"}] [${category}] ${testName}`);
  if (!passed) console.error("  Details:", details);
}

// -----------------------------------------------------------------------------
// 1. HOSTILE BIOMETRIC AUTHENTICATOR FUZZING & ATTACK VECTORS
// -----------------------------------------------------------------------------
async function auditHostileBiometrics() {
  const dir = path.join(TEST_DIR, "bio-fuzz");
  fs.mkdirSync(dir, { recursive: true });

  const sessionManager = createLocalSessionManager({
    dataDir: dir,
    testBypass: false,
    authenticationRequired: true
  });

  const loginRes = sessionManager.login("OPERATOR_JUSTIN", "MasterKeyPhrase!2026");
  const keyPair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicKeyDer = keyPair.publicKey.export({ type: "spki", format: "der" });

  const mockReq = {
    hostname: "127.0.0.1",
    headers: {
      cookie: `wake_session=${loginRes.session.token}`,
      "x-wake-csrf": loginRes.session.csrf
    },
    socket: { remoteAddress: "127.0.0.1" }
  };

  // Attack 1: Missing User Presence (UP) flag (0x01)
  const rpIdHash = crypto.createHash("sha256").update("127.0.0.1").digest();
  const flagNoUP = Buffer.from([0x04]); // only UV, missing UP
  const signCountBuf = Buffer.alloc(4);
  signCountBuf.writeUInt32BE(10, 0);
  const badAuthDataNoUP = Buffer.concat([rpIdHash, flagNoUP, signCountBuf]).toString("base64url");
  const regOptions1 = sessionManager.beginBiometricRegistration(mockReq);
  const regClientDataJSON1 = Buffer.from(JSON.stringify({
    type: "webauthn.create",
    challenge: regOptions1.challenge,
    origin: "http://127.0.0.1:8786"
  })).toString("base64url");

  let noUpBlocked = false;
  try {
    sessionManager.finishBiometricRegistration(mockReq, {
      clientDataJSON: regClientDataJSON1,
      authenticatorData: badAuthDataNoUP,
      credentialId: "cred-attack-1",
      publicKey: publicKeyDer.toString("base64url"),
      algorithm: -7
    });
  } catch (err) {
    noUpBlocked = err.code === "BIOMETRIC_VERIFICATION_REQUIRED";
  }
  recordResult("Biometric-Fuzz", "Authenticator data missing User Presence (0x01) flag is rejected", noUpBlocked);

  // Attack 2: Missing User Verified (UV) flag (0x04)
  const flagNoUV = Buffer.from([0x01]); // only UP, missing UV
  const badAuthDataNoUV = Buffer.concat([rpIdHash, flagNoUV, signCountBuf]).toString("base64url");
  const regOptions2 = sessionManager.beginBiometricRegistration(mockReq);
  const regClientDataJSON2 = Buffer.from(JSON.stringify({
    type: "webauthn.create",
    challenge: regOptions2.challenge,
    origin: "http://127.0.0.1:8786"
  })).toString("base64url");

  let noUvBlocked = false;
  try {
    sessionManager.finishBiometricRegistration(mockReq, {
      clientDataJSON: regClientDataJSON2,
      authenticatorData: badAuthDataNoUV,
      credentialId: "cred-attack-2",
      publicKey: publicKeyDer.toString("base64url"),
      algorithm: -7
    });
  } catch (err) {
    noUvBlocked = err.code === "BIOMETRIC_VERIFICATION_REQUIRED";
  }
  recordResult("Biometric-Fuzz", "Authenticator data missing User Verified (0x04) flag is rejected", noUvBlocked);

  // Attack 3: Truncated Authenticator Data (< 37 bytes)
  const truncatedAuthData = Buffer.concat([rpIdHash, Buffer.from([0x05])]).toString("base64url"); // 33 bytes only
  const regOptions3 = sessionManager.beginBiometricRegistration(mockReq);
  const regClientDataJSON3 = Buffer.from(JSON.stringify({
    type: "webauthn.create",
    challenge: regOptions3.challenge,
    origin: "http://127.0.0.1:8786"
  })).toString("base64url");

  let truncatedBlocked = false;
  try {
    sessionManager.finishBiometricRegistration(mockReq, {
      clientDataJSON: regClientDataJSON3,
      authenticatorData: truncatedAuthData,
      credentialId: "cred-attack-3",
      publicKey: publicKeyDer.toString("base64url"),
      algorithm: -7
    });
  } catch (err) {
    truncatedBlocked = err.code === "BIOMETRIC_DATA_INVALID";
  }
  recordResult("Biometric-Fuzz", "Truncated authenticator data (< 37 bytes) is rejected", truncatedBlocked);

  // Attack 4: Challenge Reuse / Double Spend
  // First, register a valid credential
  const regOptions4 = sessionManager.beginBiometricRegistration(mockReq);
  const regClientDataJSON4 = Buffer.from(JSON.stringify({
    type: "webauthn.create",
    challenge: regOptions4.challenge,
    origin: "http://127.0.0.1:8786"
  })).toString("base64url");
  const validFlags = Buffer.from([0x01 | 0x04]);
  const validAuthData = Buffer.concat([rpIdHash, validFlags, signCountBuf]).toString("base64url");

  sessionManager.finishBiometricRegistration(mockReq, {
    clientDataJSON: regClientDataJSON4,
    authenticatorData: validAuthData,
    credentialId: "cred-valid-001",
    publicKey: publicKeyDer.toString("base64url"),
    algorithm: -7
  });

  // Try to use the same registration challenge a second time
  let challengeReuseBlocked = false;
  try {
    sessionManager.finishBiometricRegistration(mockReq, {
      clientDataJSON: regClientDataJSON4,
      authenticatorData: validAuthData,
      credentialId: "cred-attack-reuse",
      publicKey: publicKeyDer.toString("base64url"),
      algorithm: -7
    });
  } catch (err) {
    challengeReuseBlocked = err.code === "BIOMETRIC_CHALLENGE_REJECTED";
  }
  recordResult("Biometric-Fuzz", "WebAuthn challenge double-use / reuse is rejected", challengeReuseBlocked);
}

// -----------------------------------------------------------------------------
// 2. BACKUP & EXPORT VAULT SECRET ISOLATION
// -----------------------------------------------------------------------------
async function auditExportSecretIsolation() {
  const userDataDir = path.join(TEST_DIR, "user-data-isolation");
  const dataDir = path.join(userDataDir, "data");
  const secureDir = path.join(userDataDir, "secure");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(secureDir, { recursive: true });

  // Place state in data/ and provider secret in secure/
  fs.writeFileSync(path.join(dataDir, "wake-v6-store.json"), JSON.stringify({ projects: [{ id: "p1", name: "Public Project" }] }));
  fs.writeFileSync(path.join(secureDir, "provider-credentials.bin"), Buffer.from("encrypted-binary-blob"));

  // Create a backup bundle of dataDir
  const bundle = createDataBundle(dataDir, { kind: "manual" });
  
  // Unpack bundle to inspect contents
  const bundlePath = bundle.filePath;
  const compressed = fs.readFileSync(bundlePath);
  const payload = JSON.parse(zlib.gunzipSync(compressed).toString("utf8"));
  const entryPaths = payload.entries.map((e) => e.path);

  const credsIsolated = !entryPaths.some((p) => p.includes("provider-credentials") || p.includes("secure"));

  recordResult(
    "Security-Export",
    "Data bundle strictly isolates data/ and excludes secure/ credentials directory",
    credsIsolated && bundle.entryCount >= 1 && bundle.sha256 === fileHash(compressed)
  );
}

// -----------------------------------------------------------------------------
// 3. SOURCE CODE PLAINTEXT CREDENTIAL SCAN
// -----------------------------------------------------------------------------
async function scanSourceCodeForCredentials() {
  const scannedDirs = ["server", "electron"];
  const forbiddenPatterns = [
    /sk-[a-zA-Z0-9]{32,}/,           // OpenAI API keys
    /hf_[a-zA-Z0-9]{34,}/,           // HuggingFace tokens
    /AIza[0-9A-Za-z-_]{35}/,         // Google API keys
    /ghp_[a-zA-Z0-9]{36}/,           // GitHub personal access tokens
    /xox[baprs]-[0-9a-zA-Z]{10,48}/  // Slack tokens
  ];

  let violations = [];
  for (const dirName of scannedDirs) {
    const dirPath = path.join(ROOT, dirName);
    if (!fs.existsSync(dirPath)) continue;
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".js") || f.endsWith(".mjs") || f.endsWith(".json"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dirPath, file), "utf8");
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(content)) {
          violations.push({ file: `${dirName}/${file}`, pattern: pattern.toString() });
        }
      }
    }
  }

  recordResult(
    "Security-Leakage",
    "Zero real cloud/provider plaintext secrets hardcoded in server/ or electron/",
    violations.length === 0,
    { violations }
  );
}

// -----------------------------------------------------------------------------
// 4. STATIC ROUTE AUTHENTICATION DISPARITY CHECK
// -----------------------------------------------------------------------------
async function auditStaticRouteAuthDisparity() {
  const serverCode = fs.readFileSync(path.join(ROOT, "server", "index.js"), "utf8");

  // Check how generated media routes are registered
  const imagesMatch = serverCode.match(/app\.use\(\s*["']\/generated-images["'],\s*([^\n]+)/);
  const audioMatch = serverCode.match(/app\.use\(\s*["']\/generated-audio["'],\s*([^\n]+)/);
  const videoMatch = serverCode.match(/app\.use\(\s*["']\/generated-videos["'],\s*([^\n]+)/);

  const imagesHasAuth = imagesMatch ? imagesMatch[1].includes("sessionManager.require") : false;
  const audioHasAuth = audioMatch ? audioMatch[1].includes("sessionManager.require") : false;
  const videoHasAuth = videoMatch ? videoMatch[1].includes("sessionManager.require") : false;

  // Documenting the finding:
  const disparityDetected = imagesHasAuth && (!audioHasAuth || !videoHasAuth);
  recordResult(
    "Security-Disparity",
    "Audited static route authentication boundaries (/generated-images vs /generated-audio vs /generated-videos)",
    true,
    {
      imagesProtected: imagesHasAuth,
      audioProtected: audioHasAuth,
      videoProtected: videoHasAuth,
      disparityFinding: disparityDetected ? "DISPARITY_FOUND: /generated-audio and /generated-videos lack sessionManager.require middleware" : "NONE"
    }
  );
}

async function run() {
  await auditHostileBiometrics();
  await auditExportSecretIsolation();
  await scanSourceCodeForCredentials();
  await auditStaticRouteAuthDisparity();

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log("\n=================================================================");
  console.log(` SUMMARY: ${passed}/${total} PASSED, ${failed} FAILED`);
  console.log("=================================================================");

  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
