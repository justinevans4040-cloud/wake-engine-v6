import { app, BrowserWindow, safeStorage, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareRuntimeDirectories } from "./runtime-paths.js";
import { createSecureVault } from "./secure-vault.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT || 8786);
const APP_URL = `http://127.0.0.1:${PORT}/`;
const ICON_PATH = path.join(ROOT, "dist", "assets", "forgefront-systems-emblem.png");

let mainWindow = null;
let wakeServer = null;
let runtimeContext = null;
let secureVault = null;

if (process.env.WAKE_AUDIT_USER_DATA) {
  app.setPath("userData", process.env.WAKE_AUDIT_USER_DATA);
} else {
  app.setPath("userData", path.join(app.getPath("appData"), "Wake Engine V6"));
}

async function waitForHealth(timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
        signal: AbortSignal.timeout(1500)
      });
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("WAKE Engine V6 server did not become healthy.");
}

async function ensureServer() {
  const wakeRoot = process.env.WAKE_V6_ROOT || ROOT;
  runtimeContext = prepareRuntimeDirectories({ userDataDir: app.getPath("userData"), legacyDataDir: path.join(wakeRoot, "server", "data") });
  secureVault = createSecureVault({ safeStorage, secureDir: runtimeContext.paths.secure });
  process.env.WAKE_V6_ROOT = wakeRoot;
  process.env.WAKE_DATA_DIR = process.env.WAKE_DATA_DIR || runtimeContext.paths.data;
  process.env.WAKE_LOG_DIR = process.env.WAKE_LOG_DIR || runtimeContext.paths.logs;
  const { startWakeServer } = await import("../server/index.js");
  try {
    wakeServer = await startWakeServer({ port: PORT, credentialBroker: secureVault });
  } catch (error) {
    if (error?.code !== "EADDRINUSE") throw error;
  }
  await waitForHealth();
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 980,
    minHeight: 720,
    title: "WAKE Engine V6",
    icon: ICON_PATH,
    backgroundColor: "#080b12",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  await mainWindow.loadURL(APP_URL);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  app.setName("WAKE Engine V6");
  try {
    await ensureServer();
    await createWindow();
  } catch (error) {
    console.error(error);
    if (runtimeContext?.paths?.logs) {
      fs.appendFileSync(path.join(runtimeContext.paths.logs, "electron-errors.log"), `${new Date().toISOString()} ${error?.stack || error}\n`, "utf8");
    }
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) await createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (wakeServer) wakeServer.close();
});
