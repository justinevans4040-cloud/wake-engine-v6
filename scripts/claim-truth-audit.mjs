#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const documents = {
  readme: "README.md",
  submission: "SUBMISSION.md",
  demo: "DEMO_SCRIPT.md",
  architecture: "ARCHITECTURE.md",
  manual: "docs/wake-engine/wake_engine_manual.md",
  evidence: "JUDGING_EVIDENCE.md",
  limitations: "KNOWN_LIMITATIONS.md"
};

const text = Object.fromEntries(
  Object.entries(documents).map(([key, relativePath]) => [key, fs.readFileSync(path.join(ROOT, relativePath), "utf8")])
);

const forbidden = [
  ["demo", /Export the approved packet/i, "Demo must not claim Review Required can export an approved packet."],
  ["demo", /Human review and export/i, "Demo must not collapse pending review and export into one implemented decision workflow."],
  ["submission", /reviewed,\s*exportable/i, "Submission must not describe a queued packet as already reviewed."],
  ["submission", /human approval/i, "Submission must not claim a persisted approval workflow before the Review workspace exists."],
  ["architecture", /H\[Human Review\]/, "Architecture must model the implemented pending review queue, not a completed approval stage."],
  ["architecture", /H\s*-->\s*O\[Markdown \+ JSON Export\]/, "Architecture must not route Review Required directly into export."],
  ["readme", /Send the packet to review\.\s*\n7\. Export Markdown and JSON\./i, "README demo must not imply Review Required directly exports."],
  ["submission", /Send the packet to Review Required\.\s*\n8\. Export Markdown and JSON\./i, "Submission evaluation must distinguish Review Required from Auto Export."]
];

for (const [doc, pattern, message] of forbidden) {
  assert.equal(pattern.test(text[doc]), false, `${message} (${documents[doc]})`);
}

const required = [
  ["readme", /pending review item/i, "README must state the pending-review boundary."],
  ["readme", /does not yet persist approve\/reject/i, "README must state missing persisted review decisions."],
  ["submission", /pending review queue/i, "Submission must call Review Required a pending queue."],
  ["submission", /separate Auto Export/i, "Submission must distinguish automatic export from Review Required."],
  ["demo", /pending review item/i, "Demo must show pending review truthfully."],
  ["demo", /Auto Export/i, "Demo must use Auto Export for automated file proof."],
  ["architecture", /Pending Review Queue/, "Architecture must model the pending review queue."],
  ["architecture", /Auto Export/, "Architecture must model Auto Export separately."],
  ["manual", /inspection-only/i, "Manual must state the current review queue is inspection-only."],
  ["manual", /does not currently persist approve\/reject/i, "Manual must state missing persisted decision controls."],
  ["evidence", /Review Required creates a pending review item/i, "Evidence matrix must state what the hostile UI audit actually proves."],
  ["evidence", /Auto Export writes two real files/i, "Evidence matrix must distinguish Auto Export proof."],
  ["limitations", /review queue is inspection-only/i, "Known Limitations must state the review decision limitation."],
  ["limitations", /approve\/reject\/return\/approve-and-export/i, "Known Limitations must name the missing decision workflow."]
];

for (const [doc, pattern, message] of required) {
  assert.equal(pattern.test(text[doc]), true, `${message} (${documents[doc]})`);
}

console.log(JSON.stringify({
  status: "pass",
  documents: Object.values(documents),
  checks: [
    "no-approved-packet-export-overclaim",
    "no-reviewed-packet-overclaim",
    "no-human-approval-overclaim",
    "review-required-is-pending-queue",
    "auto-export-is-separate",
    "review-decision-limit-explicit",
    "architecture-matches-runtime-disposition"
  ]
}, null, 2));
