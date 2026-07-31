import crypto from "node:crypto";
import path from "node:path";
import { readJsonDurable, writeJsonDurable } from "./durable-storage.js";

const COOKIE_NAME = "wake_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const BIOMETRIC_CHALLENGE_TTL_MS = 2 * 60 * 1000;

function parseCookies(header = "") {
  return Object.fromEntries(String(header).split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [decodeURIComponent(index < 0 ? part : part.slice(0, index)), decodeURIComponent(index < 0 ? "" : part.slice(index + 1))];
  }));
}

function phraseHash(phrase, salt) {
  return crypto.scryptSync(String(phrase), salt, 64).toString("hex");
}

function base64urlBuffer(value) {
  return Buffer.from(String(value || ""), "base64url");
}

function loopbackOriginMatches(origin, rpId) {
  try {
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.hostname === rpId && ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function verifyAuthenticatorData(encoded, rpId) {
  const authenticatorData = base64urlBuffer(encoded);
  if (authenticatorData.length < 37) throw Object.assign(new Error("Windows Hello returned incomplete authenticator data."), { status: 400, code: "BIOMETRIC_DATA_INVALID" });
  const expectedRpIdHash = crypto.createHash("sha256").update(rpId).digest();
  if (!crypto.timingSafeEqual(authenticatorData.subarray(0, 32), expectedRpIdHash)) throw Object.assign(new Error("Windows Hello relying-party verification failed."), { status: 401, code: "BIOMETRIC_RP_REJECTED" });
  const flags = authenticatorData[32];
  if ((flags & 0x01) === 0 || (flags & 0x04) === 0) throw Object.assign(new Error("Windows Hello did not verify operator presence and identity."), { status: 401, code: "BIOMETRIC_VERIFICATION_REQUIRED" });
  return { authenticatorData, signCount: authenticatorData.readUInt32BE(33) };
}

export function createLocalSessionManager({ dataDir, testBypass = false, authenticationRequired = false } = {}) {
  const verifierPath = path.join(dataDir, "auth-verifier.json");
  const biometricPath = path.join(dataDir, "windows-hello-credentials.json");
  const sessions = new Map();
  const biometricChallenges = new Map();

  function readBiometrics() {
    const saved = readJsonDurable(biometricPath, { schemaVersion: 1, credentials: [] });
    return { schemaVersion: 1, credentials: Array.isArray(saved?.credentials) ? saved.credentials : [] };
  }

  function writeBiometrics(value, reason) {
    writeJsonDurable(biometricPath, value, { reason });
    return value;
  }

  function issueBiometricChallenge(type, context = {}) {
    const challenge = crypto.randomBytes(32).toString("base64url");
    biometricChallenges.set(challenge, { type, ...context, expiresAt: Date.now() + BIOMETRIC_CHALLENGE_TTL_MS });
    for (const [key, value] of biometricChallenges) if (value.expiresAt <= Date.now()) biometricChallenges.delete(key);
    return challenge;
  }

  function consumeBiometricChallenge(challenge, type) {
    const record = biometricChallenges.get(String(challenge || ""));
    biometricChallenges.delete(String(challenge || ""));
    if (!record || record.type !== type || record.expiresAt <= Date.now()) throw Object.assign(new Error("Windows Hello challenge expired. Try again."), { status: 401, code: "BIOMETRIC_CHALLENGE_REJECTED" });
    return record;
  }

  function parseClientData(encoded, expectedType) {
    let clientData;
    try {
      clientData = JSON.parse(base64urlBuffer(encoded).toString("utf8"));
    } catch {
      throw Object.assign(new Error("Windows Hello client data was invalid."), { status: 400, code: "BIOMETRIC_CLIENT_DATA_INVALID" });
    }
    if (clientData?.type !== expectedType || !clientData?.challenge || !clientData?.origin) throw Object.assign(new Error("Windows Hello client data did not match this request."), { status: 401, code: "BIOMETRIC_CLIENT_DATA_REJECTED" });
    return clientData;
  }

  function readVerifier() {
    try {
      const verifier = readJsonDurable(verifierPath, null);
      return verifier?.salt && verifier?.hash ? verifier : null;
    } catch {
      return null;
    }
  }

  function writeVerifier(operator, phrase) {
    const salt = crypto.randomBytes(24).toString("hex");
    const verifier = { schemaVersion: 1, operator: String(operator).toUpperCase(), salt, hash: phraseHash(phrase, salt), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    writeJsonDurable(verifierPath, verifier, { reason: "local-auth-enrollment" });
    return verifier;
  }

  function verifyPhrase(phrase, verifier) {
    const expected = Buffer.from(verifier.hash, "hex");
    const actual = Buffer.from(phraseHash(phrase, verifier.salt), "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  function createSession(operator) {
    const token = crypto.randomBytes(32).toString("base64url");
    const csrf = crypto.randomBytes(24).toString("base64url");
    const session = { token, csrf, operator: String(operator).toUpperCase(), createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS };
    sessions.set(token, session);
    return session;
  }

  function sessionFromRequest(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    const session = token ? sessions.get(token) : null;
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    return session;
  }

  function cookie(session) {
    return `${COOKIE_NAME}=${encodeURIComponent(session.token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
  }

  function clearCookie() {
    return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
  }

  return {
    status(req) {
      const session = sessionFromRequest(req);
      const biometrics = readBiometrics();
      const localUnlocked = testBypass || !authenticationRequired;
      return { authenticated: localUnlocked || Boolean(session), authenticationRequired, enrolled: Boolean(readVerifier()), biometricEnrolled: biometrics.credentials.length > 0, biometricCredentialCount: biometrics.credentials.length, operator: session?.operator || (localUnlocked ? "JUSTIN" : null), csrfToken: session?.csrf || (localUnlocked ? "local-unlocked" : null), expiresAt: session?.expiresAt || null };
    },
    login(operator, phrase) {
      const cleanOperator = String(operator || "").trim();
      const cleanPhrase = String(phrase || "").trim();
      if (!cleanOperator || !cleanPhrase) {
        const error = new Error("Callsign and access phrase are required.");
        error.status = 400;
        throw error;
      }
      let verifier = readVerifier();
      const enrolled = !verifier;
      if (!verifier) verifier = writeVerifier(cleanOperator, cleanPhrase);
      else if (!verifyPhrase(cleanPhrase, verifier)) {
        const error = new Error("Access phrase rejected.");
        error.status = 401;
        error.code = "ACCESS_PHRASE_REJECTED";
        throw error;
      }
      const session = createSession(cleanOperator);
      return { session, enrolled, cookie: cookie(session) };
    },
    logout(req) {
      const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
      if (token) sessions.delete(token);
      return { cookie: clearCookie() };
    },
    beginBiometricRegistration(req) {
      const session = sessionFromRequest(req);
      if (!session) throw Object.assign(new Error("Sign in with the access phrase before enrolling Windows Hello."), { status: 401, code: "AUTH_REQUIRED" });
      const rpId = String(req.hostname || "").replace(/^\[|\]$/g, "");
      const challenge = issueBiometricChallenge("register", { operator: session.operator, rpId, sessionToken: session.token });
      return {
        challenge,
        rp: { id: rpId, name: "Wake Engine V6" },
        user: { id: crypto.createHash("sha256").update(session.operator).digest().subarray(0, 32).toString("base64url"), name: session.operator, displayName: `${session.operator} / Wake Operator` },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", requireResidentKey: false, userVerification: "required" },
        attestation: "none",
        timeout: 60_000
      };
    },
    finishBiometricRegistration(req, input = {}) {
      const session = sessionFromRequest(req);
      if (!session) throw Object.assign(new Error("Your Wake session expired before Windows Hello enrollment completed."), { status: 401, code: "AUTH_REQUIRED" });
      const clientData = parseClientData(input.clientDataJSON, "webauthn.create");
      const pending = consumeBiometricChallenge(clientData.challenge, "register");
      if (pending.sessionToken !== session.token || pending.operator !== session.operator || !loopbackOriginMatches(clientData.origin, pending.rpId)) throw Object.assign(new Error("Windows Hello enrollment origin or session did not match."), { status: 401, code: "BIOMETRIC_ENROLLMENT_REJECTED" });
      const { signCount } = verifyAuthenticatorData(input.authenticatorData, pending.rpId);
      const credentialId = String(input.credentialId || "");
      const publicKey = base64urlBuffer(input.publicKey);
      if (!credentialId || publicKey.length < 64) throw Object.assign(new Error("Windows Hello did not return a usable public key."), { status: 400, code: "BIOMETRIC_PUBLIC_KEY_MISSING" });
      crypto.createPublicKey({ key: publicKey, format: "der", type: "spki" });
      const biometrics = readBiometrics();
      const credential = {
        id: credentialId,
        operator: session.operator,
        rpId: pending.rpId,
        publicKey: publicKey.toString("base64url"),
        algorithm: Number(input.algorithm || -7),
        transports: Array.isArray(input.transports) ? input.transports.map(String) : ["internal"],
        signCount,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      };
      biometrics.credentials = [credential, ...biometrics.credentials.filter((item) => item.id !== credential.id)].slice(0, 5);
      writeBiometrics(biometrics, "windows-hello-enrollment");
      return { enrolled: true, credentialId: credential.id, operator: credential.operator, transports: credential.transports };
    },
    beginBiometricLogin(req) {
      const biometrics = readBiometrics();
      const rpId = String(req.hostname || "").replace(/^\[|\]$/g, "");
      const credentials = biometrics.credentials.filter((item) => item.rpId === rpId);
      if (!credentials.length) throw Object.assign(new Error("Windows Hello is not enrolled for this Wake address yet."), { status: 404, code: "BIOMETRIC_NOT_ENROLLED" });
      const challenge = issueBiometricChallenge("login", { rpId, credentialIds: credentials.map((item) => item.id) });
      return { challenge, rpId, allowCredentials: credentials.map((item) => ({ type: "public-key", id: item.id, transports: item.transports })), userVerification: "required", timeout: 60_000 };
    },
    finishBiometricLogin(input = {}) {
      const clientDataBuffer = base64urlBuffer(input.clientDataJSON);
      const clientData = parseClientData(input.clientDataJSON, "webauthn.get");
      const pending = consumeBiometricChallenge(clientData.challenge, "login");
      if (!loopbackOriginMatches(clientData.origin, pending.rpId)) throw Object.assign(new Error("Windows Hello login origin did not match Wake Engine."), { status: 401, code: "BIOMETRIC_ORIGIN_REJECTED" });
      const biometrics = readBiometrics();
      const credential = biometrics.credentials.find((item) => item.id === input.credentialId && pending.credentialIds.includes(item.id));
      if (!credential) throw Object.assign(new Error("Windows Hello credential was not recognized."), { status: 401, code: "BIOMETRIC_CREDENTIAL_REJECTED" });
      const { authenticatorData, signCount } = verifyAuthenticatorData(input.authenticatorData, credential.rpId);
      const signedData = Buffer.concat([authenticatorData, crypto.createHash("sha256").update(clientDataBuffer).digest()]);
      const publicKey = crypto.createPublicKey({ key: base64urlBuffer(credential.publicKey), format: "der", type: "spki" });
      if (!crypto.verify("sha256", signedData, publicKey, base64urlBuffer(input.signature))) throw Object.assign(new Error("Windows Hello signature verification failed."), { status: 401, code: "BIOMETRIC_SIGNATURE_REJECTED" });
      if (Number(credential.signCount || 0) > 0 && signCount > 0 && signCount <= Number(credential.signCount)) throw Object.assign(new Error("Windows Hello credential counter did not advance."), { status: 401, code: "BIOMETRIC_COUNTER_REJECTED" });
      credential.signCount = signCount;
      credential.lastUsedAt = new Date().toISOString();
      writeBiometrics(biometrics, "windows-hello-login");
      const session = createSession(credential.operator);
      return { session, cookie: cookie(session) };
    },
    require(req, res, next) {
      const session = testBypass || !authenticationRequired
        ? { token: "local-unlocked", csrf: "local-unlocked", operator: testBypass ? "AUDIT" : "JUSTIN", expiresAt: Date.now() + SESSION_TTL_MS, bypass: true }
        : sessionFromRequest(req);
      if (!session) return res.status(401).json({ ok: false, code: "AUTH_REQUIRED", error: "Local Wake session required." });
      if (!session.bypass && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const csrf = String(req.headers["x-wake-csrf"] || "");
        if (!csrf || csrf !== session.csrf) return res.status(403).json({ ok: false, code: "CSRF_REJECTED", error: "Wake session verification failed." });
      }
      req.wakeSession = session;
      next();
    },
    verifierPath
  };
}

export function isLoopbackAddress(address = "") {
  const value = String(address).replace(/^::ffff:/, "");
  return value === "127.0.0.1" || value === "::1" || value === "localhost";
}

export function isAllowedOrigin(origin = "") {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) && ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
