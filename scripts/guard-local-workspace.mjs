#!/usr/bin/env node
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const expectedRoot = path.join(os.homedir(), "Documents", "repos", "wake-engine");
const cloudPattern = /(?:^|[\\/])(OneDrive|Dropbox|Google Drive|GoogleDrive|iCloudDrive|iCloud Drive)(?:[\\/]|$)/i;
const checked = [
  ["repo root", root],
  ["cwd", process.cwd()],
  ["WAKE_DATA_DIR", process.env.WAKE_DATA_DIR || ""],
  ["INIT_CWD", process.env.INIT_CWD || ""]
].filter(([, value]) => value);

function normalize(value) {
  return path.resolve(String(value));
}

function samePath(a, b) {
  return normalize(a).toLowerCase() === normalize(b).toLowerCase();
}

function insideExpected(value) {
  const resolved = normalize(value);
  const relative = path.relative(expectedRoot, resolved);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

const violations = [];

if (!samePath(root, expectedRoot)) {
  violations.push(["authorized repo root", `${root} is not ${expectedRoot}`]);
}

for (const [label, value] of checked) {
  if (cloudPattern.test(String(value))) violations.push([label, value]);
  if (!insideExpected(value)) violations.push([label, `${value} is outside ${expectedRoot}`]);
}

if (violations.length) {
  console.error("LOCAL-ONLY GATE FAILED");
  for (const [label, value] of violations) console.error(`${label}: ${value}`);
  console.error(`Wake Engine must run only inside ${expectedRoot}.`);
  process.exit(1);
}

console.log(`LOCAL-ONLY GATE PASSED: ${root}`);
