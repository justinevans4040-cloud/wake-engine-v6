import fs from "node:fs";

const file = "src/main.jsx";
let source = fs.readFileSync(file, "utf8");
const before = '<select value={editor.approvalMode || "Review Required"} onChange={e => setEditor({...editor, approvalMode: e.target.value})} className="chat-input">';
const after = '<select aria-label="Approval Mode" value={editor.approvalMode || "Review Required"} onChange={e => setEditor({...editor, approvalMode: e.target.value})} className="chat-input">';
const first = source.indexOf(before);
if (first < 0) throw new Error("Automation Approval Mode select target not found.");
if (source.indexOf(before, first + before.length) >= 0) throw new Error("Automation Approval Mode select target is not unique.");
source = source.slice(0, first) + after + source.slice(first + before.length);
fs.writeFileSync(file, source, "utf8");
console.log("Automation Approval Mode now has an explicit accessible name.");
