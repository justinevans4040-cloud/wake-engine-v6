import fs from "node:fs";

const file = "server/index.js";
let source = fs.readFileSync(file, "utf8");
const before = `    intakeRuns: store.intakeRuns.slice(0, 12),
    intakeReviews: store.intakeReviews.slice(0, 6),
    intakeRoots: INTAKE_ROOTS,`;
const after = `    intakeRuns: store.intakeRuns.slice(0, 12),
    intakeReviews: store.intakeReviews.slice(0, 6),
    automations: store.automations.slice(0, 200),
    automationRuns: store.automationRuns.slice(0, 200),
    reviewQueue: store.reviewQueue.slice(0, 100),
    intakeRoots: INTAKE_ROOTS,`;
const first = source.indexOf(before);
if (first < 0) throw new Error("WAKE state projection insertion point not found.");
if (source.indexOf(before, first + before.length) >= 0) throw new Error("WAKE state projection insertion point is not unique.");
source = source.slice(0, first) + after + source.slice(first + before.length);
fs.writeFileSync(file, source, "utf8");
console.log("WAKE state projection now exposes persisted Automations, runs, and review queue.");
