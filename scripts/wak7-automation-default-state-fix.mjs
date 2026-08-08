import fs from "node:fs";

const file = "src/main.jsx";
let source = fs.readFileSync(file, "utf8");

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: target not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: target not unique`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "AutomationsPanel project context prop",
  "function AutomationsPanel({ state, onRefresh, setModal, setOperationError }) {",
  "function AutomationsPanel({ state, projectId, onRefresh, setModal, setOperationError }) {"
);

replaceOnce(
  "New Automation initialized payload",
  '<button className="primary-action" onClick={() => setEditor({})}>',
  '<button className="primary-action" onClick={() => setEditor({ projectId: projectId || state?.projects?.[0]?.id || "wake-v6-main", campaignType: "Custom Prompt", scheduleCron: "0 19 * * 0", timeZone: "America/Los_Angeles", approvalMode: "Review Required" })}>'
);

replaceOnce(
  "AutomationsPanel current project wiring",
  "              state={state} \n              onRefresh={refresh}",
  "              state={state} \n              projectId={projectId}\n              onRefresh={refresh}"
);

fs.writeFileSync(file, source, "utf8");
console.log("New Automation now initializes the same defaults it displays and receives current project context.");
