import fs from "node:fs";
import path from "node:path";
import { writeFileAtomic } from "../server/durable-storage.js";

export function createSecureVault({ safeStorage, secureDir } = {}) {
  const filePath = path.join(secureDir, "provider-credentials.bin");
  fs.mkdirSync(secureDir, { recursive: true });

  function available() {
    return Boolean(safeStorage?.isEncryptionAvailable?.());
  }

  function read() {
    if (!available() || !fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(safeStorage.decryptString(fs.readFileSync(filePath)));
    } catch {
      return null;
    }
  }

  function write(credentials = {}) {
    if (!available()) {
      const error = new Error("Windows secure credential storage is unavailable.");
      error.code = "SECURE_STORAGE_UNAVAILABLE";
      error.status = 503;
      throw error;
    }
    const clean = {
      provider: String(credentials.provider || "").trim().toLowerCase(),
      apiUrl: String(credentials.apiUrl || "").trim(),
      apiKey: String(credentials.apiKey || "").trim(),
      model: String(credentials.model || "").trim(),
      updatedAt: new Date().toISOString()
    };
    if (!clean.provider || !clean.apiKey || !clean.model) {
      const error = new Error("Provider, model, and API key are required.");
      error.status = 400;
      throw error;
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(clean));
    writeFileAtomic(filePath, encrypted);
    return status();
  }

  function clear() {
    fs.rmSync(filePath, { force: true });
    return status();
  }

  function status() {
    const credentials = read();
    return {
      available: available(),
      configured: Boolean(credentials?.provider && credentials?.apiKey && credentials?.model),
      provider: credentials?.provider || null,
      model: credentials?.model || null,
      apiUrlConfigured: Boolean(credentials?.apiUrl),
      updatedAt: credentials?.updatedAt || null
    };
  }

  return { read, write, clear, status, filePath };
}
