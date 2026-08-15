import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DurableJsonStore,
  createDurableJsonFileStore,
  createWakeStateStore,
  fileHash,
  readJsonDurable,
  writeJsonDurable,
  writeFileAtomic,
  ensureDiskCapacity
} from "../server/durable-storage.js";
import {
  createLocalSessionManager,
  isLoopbackAddress,
  isAllowedOrigin
} from "../server/local-session.js";
import { createSecureVault } from "../electron/secure-vault.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DIR = path.join(ROOT, ".challenger-track4-test");

console.log("=================================================================");
console.log(" TRACK 4 EMPIRICAL ADVERSARIAL TEST HARNESS");
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
// 1. DURABILITY & ATOMIC WRITE ADVERSARIAL STRESS TESTS
// -----------------------------------------------------------------------------
async function testAtomicWritesAndDiskFaults() {
  const dir = path.join(TEST_DIR, "atomic-writes");
  fs.mkdirSync(dir, { recursive: true });
  const targetFile = path.join(dir, "atomic-test.json");

  // A1. Standard atomic write and verification
  const initialPayload = JSON.stringify({ key: "initial_value", timestamp: Date.now() });
  const r1 = writeFileAtomic(targetFile, initialPayload);
  const readBack = fs.readFileSync(targetFile, "utf8");
  recordResult("Durability-Atomic", "Atomic write produces exact payload and sha256 match", readBack === initialPayload && r1.sha256 === fileHash(initialPayload));

  // A2. Overwrite atomic with .previous cleanup
  const updatedPayload = JSON.stringify({ key: "updated_value", timestamp: Date.now() });
  writeFileAtomic(targetFile, updatedPayload);
  recordResult("Durability-Atomic", "Atomic overwrite updates content and cleans .previous", fs.readFileSync(targetFile, "utf8") === updatedPayload && !fs.existsSync(`${targetFile}.previous`));

  // A3. Injected failure during rename leaves state in .previous, which recovers cleanly
  const previousPayload = fs.readFileSync(targetFile, "utf8");
  let caughtError = false;
  try {
    writeFileAtomic(targetFile, JSON.stringify({ key: "doomed_value" }), {
      onBoundary(point) {
        if (point === "atomic:after-previous-rename") {
          throw new Error("Simulated disk I/O fault after previous rename");
        }
      }
    });
  } catch (err) {
    caughtError = true;
  }
  // At this boundary, the original file is preserved at .previous
  const previousExists = fs.existsSync(`${targetFile}.previous`);
  const previousContent = previousExists ? fs.readFileSync(`${targetFile}.previous`, "utf8") : null;
  // Test store recovery from .previous
  const testStore = new DurableJsonStore(targetFile, { defaultValue: {} });
  const recoveredData = testStore.read();
  recordResult(
    "Durability-Atomic",
    "Crash after previous-rename preserves state in .previous and recovers via store.read()",
    caughtError && previousContent === previousPayload && JSON.stringify(recoveredData) === previousPayload
  );

  // A4. Disk capacity pre-check enforcement
  process.env.WAKE_TEST_FORCE_DISK_FULL = "1";
  let diskFullCaught = false;
  try {
    ensureDiskCapacity(targetFile, 1024);
  } catch (err) {
    diskFullCaught = err.code === "WAKE_DISK_FULL" && err.status === 507;
  } finally {
    delete process.env.WAKE_TEST_FORCE_DISK_FULL;
  }
  recordResult("Durability-Atomic", "Disk full simulation enforces WAKE_DISK_FULL (507)", diskFullCaught);
}

// -----------------------------------------------------------------------------
// 2. WAL V3 HASH CHAINING & TAMPER RESISTANCE
// -----------------------------------------------------------------------------
async function testWalHashChainingAndTamperResistance() {
  const dir = path.join(TEST_DIR, "wal-chain");
  fs.mkdirSync(dir, { recursive: true });
  const storeFile = path.join(dir, "wal-store.json");
  const store = new DurableJsonStore(storeFile, { defaultValue: { count: 0 } });

  // B1. Write sequences
  store.write({ count: 1 }, { reason: "test-1" });
  store.write({ count: 2 }, { reason: "test-2" });
  store.write({ count: 3 }, { reason: "test-3" });

  const records = store.readJournalRecords();
  let chainValid = records.length >= 6; // 3 pending + 3 committed
  for (let i = 1; i < records.length; i++) {
    if (records[i].walVersion === 3) {
      if (records[i].previousRecordHash !== records[i - 1].recordHash) chainValid = false;
      if (records[i].sequence !== records[i - 1].sequence + 1) chainValid = false;
    }
  }
  recordResult("Durability-WAL", "WAL v3 records maintain monotonic sequence and previousRecordHash chain", chainValid);

  // B2. Middle record tampering detection
  const tamperedDir = path.join(TEST_DIR, "wal-tamper");
  fs.mkdirSync(tamperedDir, { recursive: true });
  const tamperedFile = path.join(tamperedDir, "tampered-store.json");
  const tamperedStore = new DurableJsonStore(tamperedFile, { defaultValue: { count: 0 } });
  tamperedStore.write({ count: 10 }, { reason: "tx-1" });
  tamperedStore.write({ count: 20 }, { reason: "tx-2" });

  const journalPath = tamperedStore.journalPath;
  const journalContent = fs.readFileSync(journalPath, "utf8").trim().split("\n");
  const parsedMiddle = JSON.parse(journalContent[1]);
  parsedMiddle.reason = "malicious-tampering";
  journalContent[1] = JSON.stringify(parsedMiddle);
  fs.writeFileSync(journalPath, journalContent.join("\n") + "\n", "utf8");

  let tamperDetected = false;
  try {
    tamperedStore.read();
  } catch (err) {
    tamperDetected = err.code === "WAKE_WAL_CORRUPT";
  }
  recordResult("Durability-WAL", "Hash chain tampering at mid-journal is detected and rejected", tamperDetected);

  // B3. Legacy downgrade record attack detection
  const downgradeDir = path.join(TEST_DIR, "wal-downgrade");
  fs.mkdirSync(downgradeDir, { recursive: true });
  const downgradeFile = path.join(downgradeDir, "downgrade-store.json");
  const downgradeStore = new DurableJsonStore(downgradeFile, { defaultValue: { count: 0 } });
  downgradeStore.write({ count: 100 }, { reason: "tx-v3" });
  fs.appendFileSync(downgradeStore.journalPath, JSON.stringify({ status: "committed", transactionId: "fake-v2" }) + "\n", "utf8");

  let downgradeDetected = false;
  try {
    downgradeStore.read();
  } catch (err) {
    downgradeDetected = err.code === "WAKE_WAL_CORRUPT";
  }
  recordResult("Durability-WAL", "Legacy unhashed records injected after v3 records are rejected", downgradeDetected);
}

// -----------------------------------------------------------------------------
// 3. TORN-TAIL DETECTION & REPAIR
// -----------------------------------------------------------------------------
async function testTornTailRepair() {
  const dir = path.join(TEST_DIR, "torn-tail");
  fs.mkdirSync(dir, { recursive: true });
  const storeFile = path.join(dir, "torn-store.json");
  const store = new DurableJsonStore(storeFile, { defaultValue: { count: 0 } });
  store.write({ count: 1 }, { reason: "tx-1" });

  // Simulate a torn tail by appending an incomplete JSON line without trailing newline
  fs.appendFileSync(store.journalPath, '{"walVersion":3,"sequence":3,"status":"pend', "utf8");

  const recordsBefore = store.read();
  const health = store.status().journalHealth;
  const journalRawAfter = fs.readFileSync(store.journalPath, "utf8");

  console.log("DEBUG TORN TAIL:", {
    recordsBefore,
    health,
    journalRawAfter
  });

  recordResult(
    "Durability-WAL",
    "Torn tail at EOF is detected, cleanly truncated, and repaired",
    recordsBefore.count === 1 && health.tornTailRecoveries >= 1 && journalRawAfter.endsWith("\n") && !journalRawAfter.includes('"sequence":3')
  );
}

// -----------------------------------------------------------------------------
// 4. PROCESS LOCKING & DEAD-PID RECLAMATION
// -----------------------------------------------------------------------------
async function testProcessLockingAndDeadPid() {
  const dir = path.join(TEST_DIR, "mutex-locking");
  fs.mkdirSync(dir, { recursive: true });
  const storeFile = path.join(dir, "mutex-store.json");
  const store = new DurableJsonStore(storeFile, { defaultValue: { count: 0 }, lockTimeoutMs: 1000 });

  // D1. Lock reentrancy
  let reentrantOk = false;
  store.withProcessLock(() => {
    store.withProcessLock(() => {
      reentrantOk = store.lockDepth === 2;
    });
  });
  recordResult("Durability-Lock", "Process lock supports re-entrant lockDepth nesting", reentrantOk && store.lockDepth === 0);

  // D2. Stale / Dead PID Lock Reclamation
  const deadPid = 999999; // Non-existent PID
  fs.mkdirSync(store.lockPath, { recursive: true });
  fs.writeFileSync(
    path.join(store.lockPath, "owner.json"),
    JSON.stringify({
      schemaVersion: 2,
      pid: deadPid,
      processInstanceId: "dead-instance-id",
      nonce: "fake-nonce",
      acquiredAt: new Date(Date.now() - 60000).toISOString()
    })
  );

  let acquiredAfterDeadPid = false;
  store.withProcessLock(() => {
    acquiredAfterDeadPid = true;
  });
  recordResult("Durability-Lock", "Dead-PID lock is detected as abandoned and reclaimed", acquiredAfterDeadPid);

  // D3. Recycled Current PID with Different processInstanceId Reclamation
  fs.mkdirSync(store.lockPath, { recursive: true });
  fs.writeFileSync(
    path.join(store.lockPath, "owner.json"),
    JSON.stringify({
      schemaVersion: 2,
      pid: process.pid,
      processInstanceId: "previous-process-instance-id",
      nonce: "old-nonce",
      acquiredAt: new Date(Date.now() - 30000).toISOString()
    })
  );

  let acquiredAfterRecycledPid = false;
  store.withProcessLock(() => {
    acquiredAfterRecycledPid = true;
  });
  recordResult("Durability-Lock", "Recycled PID with foreign processInstanceId is reclaimed", acquiredAfterRecycledPid);
}

// -----------------------------------------------------------------------------
// 5. SCRYPT KDF PARAMETERS & SESSION AUTHENTICATION
// -----------------------------------------------------------------------------
async function testScryptAndLocalSessionSecurity() {
  const dir = path.join(TEST_DIR, "session-auth");
  fs.mkdirSync(dir, { recursive: true });

  const sessionManager = createLocalSessionManager({
    dataDir: dir,
    testBypass: false,
    authenticationRequired: true
  });

  // E1. Initial login enrolls operator and creates verifier
  const loginRes = sessionManager.login("JUSTIN", "MasterAccessPhrase!2026");
  recordResult(
    "Security-Session",
    "First login enrolls operator and issues expiring HttpOnly cookie session",
    loginRes.enrolled === true && loginRes.session.operator === "JUSTIN" && loginRes.cookie.includes("HttpOnly") && loginRes.cookie.includes("SameSite=Strict")
  );

  // E2. Verifier inspection: salt size, Scrypt hash length
  const verifier = JSON.parse(fs.readFileSync(sessionManager.verifierPath, "utf8"));
  const saltBuffer = Buffer.from(verifier.salt, "hex");
  const hashBuffer = Buffer.from(verifier.hash, "hex");
  recordResult(
    "Security-Session",
    "Scrypt verifier uses 24-byte (192-bit) salt and 64-byte key digest",
    saltBuffer.length === 24 && hashBuffer.length === 64
  );

  // E3. Bad password rejection
  let badPassCaught = false;
  try {
    sessionManager.login("JUSTIN", "WrongAccessPhrase");
  } catch (err) {
    badPassCaught = err.code === "ACCESS_PHRASE_REJECTED" && err.status === 401;
  }
  recordResult("Security-Session", "Incorrect access phrase is rejected with 401 ACCESS_PHRASE_REJECTED", badPassCaught);

  // E4. CSRF enforcement for mutating requests
  let csrfPass = false;
  let csrfFail = false;

  const mockReqValid = {
    method: "POST",
    headers: {
      cookie: `wake_session=${loginRes.session.token}`,
      "x-wake-csrf": loginRes.session.csrf
    },
    socket: { remoteAddress: "127.0.0.1" }
  };
  const mockRes = {
    status: (code) => ({
      json: (data) => {
        if (code === 403 && data.code === "CSRF_REJECTED") csrfFail = true;
      }
    })
  };

  sessionManager.require(mockReqValid, mockRes, () => {
    csrfPass = true;
  });

  const mockReqInvalidCsrf = {
    method: "POST",
    headers: {
      cookie: `wake_session=${loginRes.session.token}`,
      "x-wake-csrf": "attacker-forged-csrf-token"
    },
    socket: { remoteAddress: "127.0.0.1" }
  };
  sessionManager.require(mockReqInvalidCsrf, mockRes, () => {});

  recordResult("Security-Session", "CSRF token required and verified on mutating methods", csrfPass && csrfFail);

  // E5. Expired session rejection
  const expiredSessionManager = createLocalSessionManager({ dataDir: dir, testBypass: false, authenticationRequired: true });
  const loginExp = expiredSessionManager.login("JUSTIN", "MasterAccessPhrase!2026");
  loginExp.session.expiresAt = Date.now() - 1000; // Force expired

  let expiredRejected = false;
  const mockReqExpired = {
    method: "GET",
    headers: { cookie: `wake_session=${loginExp.session.token}` },
    socket: { remoteAddress: "127.0.0.1" }
  };
  const mockResExpired = {
    status: (code) => ({
      json: (data) => {
        if (code === 401 && data.code === "AUTH_REQUIRED") expiredRejected = true;
      }
    })
  };
  expiredSessionManager.require(mockReqExpired, mockResExpired, () => {});
  recordResult("Security-Session", "Expired session token is rejected with 401 AUTH_REQUIRED", expiredRejected);
}

// -----------------------------------------------------------------------------
// 6. FIDO2 / WEBAUTHN BIOMETRIC REPLAY & COUNTER VERIFICATION
// -----------------------------------------------------------------------------
async function testFido2WebAuthnBiometrics() {
  const dir = path.join(TEST_DIR, "biometrics");
  fs.mkdirSync(dir, { recursive: true });

  const sessionManager = createLocalSessionManager({
    dataDir: dir,
    testBypass: false,
    authenticationRequired: true
  });

  const loginRes = sessionManager.login("JUSTIN", "BiometricTestPhrase!2026");

  // Generate ECDSA keypair simulating WebAuthn authenticator
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

  // 1. Begin registration
  const regOptions = sessionManager.beginBiometricRegistration(mockReq);

  // Build simulated clientDataJSON and authenticatorData for registration
  const regClientData = {
    type: "webauthn.create",
    challenge: regOptions.challenge,
    origin: "http://127.0.0.1:8786"
  };
  const regClientDataJSON = Buffer.from(JSON.stringify(regClientData)).toString("base64url");

  const rpIdHash = crypto.createHash("sha256").update("127.0.0.1").digest();
  const flags = Buffer.from([0x01 | 0x04]); // UP (0x01) + UV (0x04)
  const signCountBuf = Buffer.alloc(4);
  signCountBuf.writeUInt32BE(1, 0); // initial counter = 1
  const authData = Buffer.concat([rpIdHash, flags, signCountBuf]);
  const authenticatorData = authData.toString("base64url");

  const regResult = sessionManager.finishBiometricRegistration(mockReq, {
    clientDataJSON: regClientDataJSON,
    authenticatorData,
    credentialId: "credential-justin-hello-001",
    publicKey: publicKeyDer.toString("base64url"),
    algorithm: -7,
    transports: ["internal"]
  });

  recordResult("Security-Biometric", "FIDO2 Windows Hello biometric registration succeeds with UP+UV flags", regResult.enrolled === true && regResult.credentialId === "credential-justin-hello-001");

  // 2. Biometric Login & Signature Verification
  const loginOptions = sessionManager.beginBiometricLogin(mockReq);
  const loginClientData = {
    type: "webauthn.get",
    challenge: loginOptions.challenge,
    origin: "http://127.0.0.1:8786"
  };
  const loginClientDataBuf = Buffer.from(JSON.stringify(loginClientData));
  const loginClientDataJSON = loginClientDataBuf.toString("base64url");

  // Advanced signCount = 2
  const loginSignCountBuf = Buffer.alloc(4);
  loginSignCountBuf.writeUInt32BE(2, 0);
  const loginAuthData = Buffer.concat([rpIdHash, flags, loginSignCountBuf]);
  const loginAuthenticatorData = loginAuthData.toString("base64url");

  const signedData = Buffer.concat([loginAuthData, crypto.createHash("sha256").update(loginClientDataBuf).digest()]);
  const signature = crypto.sign("sha256", signedData, keyPair.privateKey);

  const loginSuccess = sessionManager.finishBiometricLogin({
    clientDataJSON: loginClientDataJSON,
    authenticatorData: loginAuthenticatorData,
    credentialId: "credential-justin-hello-001",
    signature: signature.toString("base64url")
  });

  recordResult("Security-Biometric", "Biometric login verifies cryptographic signature & creates authenticated session", loginSuccess.session.operator === "JUSTIN" && loginSuccess.session.token.length > 20);

  // 3. Monotonic Counter Replay Attack (Cloning / Replay Detection)
  // Attempt login with counter = 2 (not strictly greater than previous 2)
  const replayOptions = sessionManager.beginBiometricLogin(mockReq);
  const replayClientData = {
    type: "webauthn.get",
    challenge: replayOptions.challenge,
    origin: "http://127.0.0.1:8786"
  };
  const replayClientDataBuf = Buffer.from(JSON.stringify(replayClientData));
  const replaySignedData = Buffer.concat([loginAuthData, crypto.createHash("sha256").update(replayClientDataBuf).digest()]);
  const replaySig = crypto.sign("sha256", replaySignedData, keyPair.privateKey);

  let counterReplayBlocked = false;
  try {
    sessionManager.finishBiometricLogin({
      clientDataJSON: replayClientDataBuf.toString("base64url"),
      authenticatorData: loginAuthenticatorData, // still counter = 2!
      credentialId: "credential-justin-hello-001",
      signature: replaySig.toString("base64url")
    });
  } catch (err) {
    counterReplayBlocked = err.code === "BIOMETRIC_COUNTER_REJECTED" && err.status === 401;
  }

  recordResult("Security-Biometric", "Biometric monotonic counter verification blocks replay and cloned authenticators", counterReplayBlocked);

  // 4. Origin Spoofing Attack Detection
  const spoofOptions = sessionManager.beginBiometricLogin(mockReq);
  const spoofClientData = {
    type: "webauthn.get",
    challenge: spoofOptions.challenge,
    origin: "http://attacker-controlled-origin.com"
  };
  const spoofClientDataBuf = Buffer.from(JSON.stringify(spoofClientData));
  const spoofSignedData = Buffer.concat([loginAuthData, crypto.createHash("sha256").update(spoofClientDataBuf).digest()]);
  const spoofSig = crypto.sign("sha256", spoofSignedData, keyPair.privateKey);

  let originSpoofBlocked = false;
  try {
    sessionManager.finishBiometricLogin({
      clientDataJSON: spoofClientDataBuf.toString("base64url"),
      authenticatorData: loginAuthenticatorData,
      credentialId: "credential-justin-hello-001",
      signature: spoofSig.toString("base64url")
    });
  } catch (err) {
    originSpoofBlocked = err.code === "BIOMETRIC_ORIGIN_REJECTED" && err.status === 401;
  }
  recordResult("Security-Biometric", "Biometric origin validation rejects foreign/unauthorized origins", originSpoofBlocked);
}

// -----------------------------------------------------------------------------
// 7. SECURE CREDENTIAL VAULT & ZERO-PLAINTEXT LEAKAGE
// -----------------------------------------------------------------------------
async function testSecureVaultAndZeroPlaintextLeakage() {
  const dir = path.join(TEST_DIR, "secure-vault");
  fs.mkdirSync(dir, { recursive: true });

  // Simulate Electron safeStorage with XOR cipher
  const mockSafeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (str) => Buffer.from(str, "utf8").map((b) => b ^ 0x5a),
    decryptString: (buf) => Buffer.from(buf).map((b) => b ^ 0x5a).toString("utf8")
  };

  const vault = createSecureVault({
    safeStorage: mockSafeStorage,
    secureDir: dir
  });

  const secretApiKey = "sk-super-secret-production-token-999";
  vault.write({
    provider: "openai",
    apiUrl: "https://api.openai.com/v1",
    apiKey: secretApiKey,
    model: "gpt-4o"
  });

  // F1. Verify stored file is encrypted, NOT plaintext
  const fileBytes = fs.readFileSync(vault.filePath);
  const fileRawString = fileBytes.toString("utf8");
  const isEncryptedOnDisk = !fileRawString.includes(secretApiKey) && !fileRawString.includes("openai");
  recordResult("Security-Vault", "Vault file on disk contains ciphertext only (no plaintext secret leakage)", isEncryptedOnDisk);

  // F2. Verify status() never returns plaintext apiKey
  const vaultStatus = vault.status();
  const statusSerialized = JSON.stringify(vaultStatus);
  const statusLeakFree = !statusSerialized.includes(secretApiKey) && vaultStatus.configured === true && vaultStatus.provider === "openai";
  recordResult("Security-Vault", "Vault status() reports configuration metadata without exposing secret tokens", statusLeakFree);

  // F3. Verify clear() wipes file
  vault.clear();
  recordResult("Security-Vault", "Vault clear() removes encrypted file and resets status", !fs.existsSync(vault.filePath) && vault.status().configured === false);
}

// -----------------------------------------------------------------------------
// 8. LOOPBACK BINDING & ORIGIN GUARDS
// -----------------------------------------------------------------------------
async function testLoopbackAndOriginGuards() {
  // G1. Loopback addresses
  const validIps = ["127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"];
  const invalidIps = ["192.168.1.50", "10.0.0.1", "172.16.0.1", "8.8.8.8", "attacker.com"];
  const loopbackChecksPassed = validIps.every(isLoopbackAddress) && invalidIps.every((ip) => !isLoopbackAddress(ip));
  recordResult("Security-Network", "Loopback address checker strictly enforces local interfaces", loopbackChecksPassed);

  // G2. Allowed origins
  const validOrigins = ["http://127.0.0.1:8786", "http://localhost:5177", "https://[::1]:8786", ""];
  const invalidOrigins = ["https://evil.com", "http://attacker.local", "http://192.168.1.1:8786", "ftp://localhost"];
  const originChecksPassed = validOrigins.every(isAllowedOrigin) && invalidOrigins.every((orig) => !isAllowedOrigin(orig));
  recordResult("Security-Network", "Origin checker strictly permits loopback origins and rejects foreign domains", originChecksPassed);
}

// -----------------------------------------------------------------------------
// RUN ALL TESTS
// -----------------------------------------------------------------------------
async function runAll() {
  await testAtomicWritesAndDiskFaults();
  await testWalHashChainingAndTamperResistance();
  await testTornTailRepair();
  await testProcessLockingAndDeadPid();
  await testScryptAndLocalSessionSecurity();
  await testFido2WebAuthnBiometrics();
  await testSecureVaultAndZeroPlaintextLeakage();
  await testLoopbackAndOriginGuards();

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log("\n=================================================================");
  console.log(` SUMMARY: ${passed}/${total} PASSED, ${failed} FAILED`);
  console.log("=================================================================");

  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  if (failed > 0) process.exit(1);
}

runAll().catch((err) => {
  console.error("FATAL ERROR IN TEST HARNESS:", err);
  process.exit(1);
});
