#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const cloudPattern = /(?:^|[\\/])(OneDrive|Dropbox|Google Drive|GoogleDrive|iCloudDrive|iCloud Drive)(?:[\\/]|$)/i;

function normalize(value) {
  return path.resolve(String(value));
}

function insideRoot(value) {
  const resolved = normalize(value);
  const relative = path.relative(root, resolved);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

const violations = [];
const localWorkspacePaths = [
  ["repository root", root],
  ["current working directory", process.cwd()],
  ["npm initial working directory", process.env.INIT_CWD || ""]
].filter(([, value]) => value);

for (const [label, value] of localWorkspacePaths) {
  if (cloudPattern.test(String(value))) {
    violations.push([label, `${value} is inside a cloud-synchronized folder`]);
  }
}

if (!insideRoot(process.cwd())) {
  violations.push(["current working directory", `${process.cwd()} is outside repository root ${root}`]);
}

if (process.env.INIT_CWD && !insideRoot(process.env.INIT_CWD)) {
  violations.push(["npm initial working directory", `${process.env.INIT_CWD} is outside repository root ${root}`]);
}

if (process.env.WAKE_DATA_DIR && cloudPattern.test(process.env.WAKE_DATA_DIR)) {
  violations.push(["WAKE_DATA_DIR", `${process.env.WAKE_DATA_DIR} is inside a cloud-synchronized folder`]);
}

if (violations.length) {
  console.error("LOCAL-ONLY GATE FAILED");
  for (const [label, value] of violations) console.error(`${label}: ${value}`);
  console.error("Run WAKE Engine from a local, non-cloud-synchronized checkout.");
  process.exit(1);
}

console.log(`LOCAL-ONLY GATE PASSED: ${root}`);
