import fs from "node:fs";

const file = "server/index.js";
let source = fs.readFileSync(file, "utf8");
const startMarker = '  app.post("/api/automations", (req, res) => {';
const endMarker = '\napp.post("/api/active-task", (req, res) => {';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error("Automation route block markers not found.");

const replacement = `function automationValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "WAKE_AUTOMATION_INVALID";
  return error;
}

function validCronField(field, min, max) {
  const segments = String(field || "").split(",");
  if (!segments.length) return false;
  return segments.every((segment) => {
    const parts = segment.split("/");
    if (parts.length > 2) return false;
    const [base, rawStep] = parts;
    if (rawStep !== undefined && (!/^\\d+$/.test(rawStep) || Number(rawStep) < 1)) return false;
    if (base === "*") return true;
    if (base.includes("-")) {
      const range = base.split("-");
      if (range.length !== 2 || !range.every((value) => /^\\d+$/.test(value))) return false;
      const [from, to] = range.map(Number);
      return from >= min && to <= max && from <= to;
    }
    if (rawStep !== undefined || !/^\\d+$/.test(base)) return false;
    const value = Number(base);
    return value >= min && value <= max;
  });
}

function validCronExpression(value) {
  const fields = String(value || "").trim().split(/\\s+/);
  if (fields.length !== 5) return false;
  return validCronField(fields[0], 0, 59) &&
    validCronField(fields[1], 0, 23) &&
    validCronField(fields[2], 1, 31) &&
    validCronField(fields[3], 1, 12) &&
    validCronField(fields[4], 0, 6);
}

function validTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function validateAutomationPayload(store, payload = {}) {
  const automation = {
    name: String(payload.name || "").trim(),
    projectId: String(payload.projectId || "").trim(),
    sourceDir: String(payload.sourceDir || "").trim(),
    campaignType: String(payload.campaignType || "").trim(),
    operatorAsk: String(payload.operatorAsk || "").trim(),
    scheduleCron: String(payload.scheduleCron || "").trim(),
    timeZone: String(payload.timeZone || "").trim(),
    approvalMode: String(payload.approvalMode || "").trim(),
    exportDir: String(payload.exportDir || "").trim()
  };
  if (!automation.name) throw automationValidationError("Automation name is required.");
  if (!automation.projectId || !store.projects.some((project) => project.id === automation.projectId)) {
    throw automationValidationError("Choose an existing WAKE project before saving the automation.");
  }
  if (!automation.sourceDir) throw automationValidationError("Source directory is required.");
  if (containsCloudPath(automation.sourceDir)) throw automationValidationError("Automation source directories must be local and non-cloud-synchronized.");
  if (!automation.campaignType) throw automationValidationError("Campaign type is required.");
  if (!automation.operatorAsk) throw automationValidationError("Operator ask is required.");
  if (!validCronExpression(automation.scheduleCron)) throw automationValidationError("Schedule must be a valid five-field cron expression using WAKE-supported ranges, lists, or steps.");
  if (!automation.timeZone || !validTimeZone(automation.timeZone)) throw automationValidationError("Time zone must be a valid IANA timezone.");
  if (!["Review Required", "Auto Export"].includes(automation.approvalMode)) throw automationValidationError("Approval mode must be Review Required or Auto Export.");
  if (!automation.exportDir) throw automationValidationError("Export directory is required.");
  if (containsCloudPath(automation.exportDir)) throw automationValidationError("Automation export directories must be local and non-cloud-synchronized.");
  return automation;
}

app.post("/api/automations", (req, res) => {
  try {
    const store = readStore();
    const validated = validateAutomationPayload(store, req.body || {});
    const automation = {
      id: id("auto"),
      createdAt: now(),
      updatedAt: now(),
      enabled: false,
      ...validated
    };
    store.automations.push(automation);
    recordHistory(store, "automation.created", \`Automation created: \${automation.name}\`, { automationId: automation.id });
    writeStore(store, "created-automation");
    res.json({ ok: true, automation });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || null, error: error.message });
  }
});

app.put("/api/automations/:id", (req, res) => {
  try {
    const store = readStore();
    const index = store.automations.findIndex((automation) => automation.id === req.params.id);
    if (index === -1) return res.status(404).json({ ok: false, error: "Automation not found." });
    const validated = validateAutomationPayload(store, req.body || {});
    store.automations[index] = { ...store.automations[index], ...validated, updatedAt: now() };
    recordHistory(store, "automation.updated", \`Automation updated: \${store.automations[index].name}\`, { automationId: req.params.id });
    writeStore(store, "updated-automation");
    res.json({ ok: true, automation: store.automations[index] });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, code: error.code || null, error: error.message });
  }
});

app.delete("/api/automations/:id", (req, res) => {
  const store = readStore();
  const automation = store.automations.find((item) => item.id === req.params.id);
  if (!automation) return res.status(404).json({ ok: false, error: "Automation not found." });
  store.automations = store.automations.filter((item) => item.id !== req.params.id);
  recordHistory(store, "automation.deleted", \`Automation deleted: \${automation.name}\`, { automationId: automation.id });
  writeStore(store, "deleted-automation");
  res.json({ ok: true });
});

app.post("/api/automations/:id/toggle", (req, res) => {
  const store = readStore();
  const automation = store.automations.find((item) => item.id === req.params.id);
  if (!automation) return res.status(404).json({ ok: false, error: "Automation not found." });
  if (typeof req.body?.enabled !== "boolean") return res.status(400).json({ ok: false, code: "WAKE_AUTOMATION_INVALID", error: "enabled must be a boolean." });
  automation.enabled = req.body.enabled;
  automation.updatedAt = now();
  recordHistory(store, "automation.toggled", \`Automation \${automation.enabled ? "resumed" : "paused"}: \${automation.name}\`, { automationId: automation.id, enabled: automation.enabled });
  writeStore(store, "toggled-automation");
  res.json({ ok: true, enabled: automation.enabled });
});

app.post("/api/automations/:id/run", (req, res) => {
  const store = readStore();
  const automation = store.automations.find((item) => item.id === req.params.id);
  if (!automation) return res.status(404).json({ ok: false, error: "Automation not found." });
  const existingQueued = store.automationRuns.find((run) => run.automationId === automation.id && run.status === "queued" && run.sourceHash === "manual-run");
  if (existingQueued) return res.status(409).json({ ok: false, error: "A manual run is already queued for this automation." });
  const run = {
    id: id("run"),
    automationId: automation.id,
    status: "queued",
    sourceHash: "manual-run",
    createdAt: now()
  };
  store.automationRuns.unshift(run);
  automation.forceRun = true;
  automation.updatedAt = now();
  recordHistory(store, "automation.run.queued", \`Manual automation run queued: \${automation.name}\`, { automationId: automation.id, runId: run.id });
  writeStore(store, "manual-run-automation");
  res.json({ ok: true, run });
});
`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, source, "utf8");
console.log("WAK-7 Automation API hardening applied");
