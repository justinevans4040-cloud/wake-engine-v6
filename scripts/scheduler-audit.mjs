#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  computeHash,
  isCronMatch,
  loadSourceBundle,
  renderAutomationMarkdown,
  runAutomationCycle
} from "../server/scheduler.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "wake-scheduler-audit-"));
const sourceDir = path.join(root, "source");
const exportDir = path.join(root, "exports");
fs.mkdirSync(sourceDir, { recursive: true });
fs.writeFileSync(path.join(sourceDir, "brief.txt"), "A neighborhood kitchen sells handmade tamales.\nOrders are prepared locally.\nCustomers can choose pickup windows.", "utf8");
fs.writeFileSync(path.join(sourceDir, "notes.md"), "The campaign should explain the menu, ordering steps, and pickup process.", "utf8");
fs.writeFileSync(path.join(sourceDir, "ignored.bin"), "ignore", "utf8");

const fixedDate = new Date("2026-08-03T02:00:00.000Z");
const now = () => new Date(fixedDate);

assert.equal(isCronMatch("0 19 * * 0", { minute: 0, hour: 19, date: 2, month: 8, day: 0 }), true);
assert.equal(isCronMatch("*/15 * * * *", { minute: 30, hour: 1, date: 2, month: 8, day: 0 }), true);
assert.equal(isCronMatch("61 * * * *", { minute: 1, hour: 1, date: 2, month: 8, day: 0 }), false);
assert.equal(isCronMatch("bad cron", { minute: 0, hour: 0, date: 1, month: 1, day: 0 }), false);

const bundle = loadSourceBundle(sourceDir);
assert.deepEqual(bundle.files, ["brief.txt", "notes.md"]);
assert.equal(bundle.hash, computeHash(bundle.text));
assert.match(bundle.text, /handmade tamales/);

let pipelineCalls = 0;
const runPipeline = ({ source, retrievalContext }) => {
  pipelineCalls += 1;
  assert.match(source, /pickup process/);
  assert.equal(typeof retrievalContext.baseAsk, "string");
  return {
    ok: true,
    runId: `pipeline-${pipelineCalls}`,
    pack: {
      runId: `pipeline-${pipelineCalls}`,
      hooks: ["Handmade tamales, prepared locally."],
      scripts: [{ time: "0:00-0:05", beat: "Open", line: "Handmade tamales, prepared locally." }],
      platformVariants: [{ platform: "Shorts", hook: "See how local pickup works." }],
      evidenceMap: [{ id: "evidence-1", quote: "A neighborhood kitchen sells handmade tamales." }],
      qaVerdict: { verdict: "pass", blockers: [], nextAction: "Review and export." },
      exportManifest: { title: "Neighborhood Kitchen Campaign" },
      nextAction: "Review and export."
    }
  };
};

const makeStore = (automation) => ({
  automations: [automation],
  automationRuns: [],
  reviewQueue: [],
  history: []
});

const reviewStore = makeStore({
  id: "review-automation",
  name: "Review Automation",
  sourceDir,
  exportDir,
  scheduleCron: "0 19 * * 0",
  timeZone: "America/Los_Angeles",
  operatorAsk: "Build a local campaign.",
  approvalMode: "Review Required",
  enabled: false,
  forceRun: true
});
reviewStore.automationRuns.push({
  id: "manual-placeholder",
  automationId: "review-automation",
  status: "queued",
  sourceHash: "manual-run",
  createdAt: fixedDate.toISOString()
});

const reviewSummary = await runAutomationCycle({
  storeRef: () => reviewStore,
  updateStore: () => {},
  runPipeline,
  now
});
assert.equal(reviewSummary.awaitingReview, 1);
assert.equal(reviewStore.automationRuns.length, 1);
assert.equal(reviewStore.automationRuns[0].id, "manual-placeholder");
assert.equal(reviewStore.automationRuns[0].status, "awaiting-review");
assert.equal(reviewStore.reviewQueue.length, 1);
assert.equal(reviewStore.automations[0].forceRun, false);

const duplicateStore = makeStore({
  id: "duplicate-automation",
  name: "Duplicate Automation",
  sourceDir,
  exportDir,
  scheduleCron: "* * * * *",
  timeZone: "UTC",
  operatorAsk: "Build a local campaign.",
  approvalMode: "Review Required",
  enabled: true,
  forceRun: false
});
duplicateStore.automationRuns.push({
  id: "prior-run",
  automationId: "duplicate-automation",
  status: "completed",
  sourceHash: bundle.hash,
  createdAt: new Date(fixedDate.getTime() - 86_400_000).toISOString()
});
const callsBeforeDuplicate = pipelineCalls;
const duplicateSummary = await runAutomationCycle({
  storeRef: () => duplicateStore,
  updateStore: () => {},
  runPipeline,
  now
});
assert.equal(duplicateSummary.skipped, 1);
assert.equal(pipelineCalls, callsBeforeDuplicate);
assert.equal(duplicateStore.history[0].type, "AUTOMATION_SKIPPED");

const exportStore = makeStore({
  id: "export-automation",
  name: "Auto Export Campaign",
  sourceDir,
  exportDir,
  scheduleCron: "0 19 * * 0",
  timeZone: "America/Los_Angeles",
  operatorAsk: "Build a local campaign.",
  approvalMode: "Auto Export",
  enabled: false,
  forceRun: true
});
const exportSummary = await runAutomationCycle({
  storeRef: () => exportStore,
  updateStore: () => {},
  runPipeline,
  now
});
assert.equal(exportSummary.completed, 1);
assert.equal(exportStore.automationRuns[0].status, "completed");
assert.equal(exportStore.automationRuns[0].exportFiles.length, 2);
for (const artifact of exportStore.automationRuns[0].exportFiles) {
  assert.equal(fs.existsSync(artifact.path), true);
}
const jsonArtifact = exportStore.automationRuns[0].exportFiles.find((item) => item.type === "json");
const exportedJson = JSON.parse(fs.readFileSync(jsonArtifact.path, "utf8"));
assert.equal(exportedJson.schema, "wake-engine-automation-export");
assert.equal(exportedJson.pack.exportManifest.title, "Neighborhood Kitchen Campaign");

const markdown = renderAutomationMarkdown(runPipeline({ source: bundle.text, retrievalContext: { baseAsk: "" } }).pack);
assert.match(markdown, /Neighborhood Kitchen Campaign/);
assert.match(markdown, /## Evidence/);

const missingStore = makeStore({
  id: "missing-automation",
  name: "Missing Source",
  sourceDir: path.join(root, "missing"),
  exportDir,
  scheduleCron: "* * * * *",
  timeZone: "UTC",
  operatorAsk: "Build a local campaign.",
  approvalMode: "Review Required",
  enabled: false,
  forceRun: true
});
const missingSummary = await runAutomationCycle({
  storeRef: () => missingStore,
  updateStore: () => {},
  runPipeline,
  now
});
assert.equal(missingSummary.failed, 1);
assert.equal(missingStore.automationRuns[0].status, "failed");
assert.equal(missingStore.automations[0].forceRun, false);

fs.rmSync(root, { recursive: true, force: true });

console.log(JSON.stringify({
  status: "pass",
  checks: [
    "cron-validation",
    "source-loading-and-hashing",
    "manual-placeholder-reuse",
    "review-queue",
    "unchanged-source-skip",
    "markdown-and-json-export",
    "missing-source-failure"
  ],
  pipelineCalls
}, null, 2));
