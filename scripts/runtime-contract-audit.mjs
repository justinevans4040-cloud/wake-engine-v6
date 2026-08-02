#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  CANONICAL_PACKET_CONTRACT,
  auditTierZeroRuntime,
  runTierZeroNetwork
} from "../server/tier-zero-runtime.js";

const runtimeAudit = auditTierZeroRuntime();
assert.equal(runtimeAudit.ok, true, `Tier Zero runtime audit failed: ${runtimeAudit.violations.join(", ")}`);
assert.ok(CANONICAL_PACKET_CONTRACT.version);
assert.ok(CANONICAL_PACKET_CONTRACT.requiredSections.length > 0);

const source = [
  "A neighborhood kitchen prepares handmade tamales in small batches.",
  "Customers choose a menu item and a pickup window.",
  "Each order receives a written confirmation before pickup.",
  "The kitchen publishes ingredient and ordering information from approved local notes.",
  "Campaign claims must match those approved notes."
].join(" ");

const result = runTierZeroNetwork({
  source,
  retrievalContext: { baseAsk: "Create a source-backed campaign explaining ordering and pickup." }
});

assert.ok(result.runId);
assert.ok(result.pack);
assert.equal(result.pack.runId, result.runId);
assert.ok(Array.isArray(result.pack.evidenceMap));
assert.ok(result.pack.evidenceMap.length > 0);
assert.ok(Array.isArray(result.pack.claimMap));
assert.ok(result.pack.claimMap.length > 0);
assert.ok(result.pack.exportManifest);
assert.ok(result.pack.qaVerdict);
assert.ok(Array.isArray(result.toolCalls));
assert.ok(result.toolCalls.length > 0);
assert.ok(Array.isArray(result.replayableHandoffs));
assert.ok(result.replayableHandoffs.length > 0);

console.log(JSON.stringify({
  status: "pass",
  runtime: result.runtime,
  runId: result.runId,
  agents: runtimeAudit.summary.agents,
  tools: runtimeAudit.summary.tools,
  evidenceItems: result.pack.evidenceMap.length,
  claims: result.pack.claimMap.length,
  toolCalls: result.toolCalls.length,
  handoffs: result.replayableHandoffs.length,
  qaVerdict: result.pack.qaVerdict.verdict
}, null, 2));
