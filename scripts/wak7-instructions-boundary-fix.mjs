import fs from "node:fs";

const file = "server/index.js";
let source = fs.readFileSync(file, "utf8");
const before = '    if (/runtime|health|cpu|memory|ram|status|monitor|telemetry/.test(lower)) {';
const after = '    if (/\\b(?:runtime|health|cpu|memory|ram|status|monitor|telemetry)\\b/.test(lower)) {';
const first = source.indexOf(before);
if (first < 0) throw new Error("Loose Instructions runtime classifier not found.");
if (source.indexOf(before, first + before.length) >= 0) throw new Error("Loose Instructions runtime classifier is not unique.");
source = source.slice(0, first) + after + source.slice(first + before.length);
fs.writeFileSync(file, source, "utf8");
console.log("WAK-7 Instructions runtime classifier now uses whole-word matching.");
