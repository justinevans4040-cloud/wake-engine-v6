const FORBIDDEN_RUNTIME_IDS = /^(?:loom|rune|echo|cpt|next|wakecodex)(?:[-_.]|$)/i;
const PLACEHOLDER_CLAIMS = /\b(?:coming soon|placeholder capability|mock capability|stub runtime|fake live|pretend live)\b/i;
const WAKE_ONLY_DRIFT = /\b(?:watch the full breakdown on wake|wake-only (?:topic|audience|cta|proof|lane)|verified wake action)\b/i;

export function auditNoTheater({ capabilities = [], agentPipeline = [], runtimeEvidence = {} } = {}) {
  const violations = [];
  const warnings = [];
  const checkedAt = new Date().toISOString();

  for (const capability of capabilities) {
    const label = capability.label || capability.id || "unknown capability";
    const text = `${capability.label || ""} ${capability.detail || ""}`.toLowerCase();
    if (FORBIDDEN_RUNTIME_IDS.test(String(capability.id || "")) || FORBIDDEN_RUNTIME_IDS.test(String(capability.label || ""))) {
      violations.push({ id: `forbidden-capability-${capability.id || label}`, target: label, severity: "critical", message: "Forbidden other-app runtime identity found." });
    }
    if (PLACEHOLDER_CLAIMS.test(text)) {
      violations.push({ id: `placeholder-capability-${capability.id || label}`, target: label, severity: "critical", message: "Placeholder or fake-live capability claim found." });
    }
    if (WAKE_ONLY_DRIFT.test(text)) {
      violations.push({ id: `wake-only-capability-${capability.id || label}`, target: label, severity: "critical", message: "Wake-only output drift found in a universal content capability." });
    }
    if (/\bmarket[- ]?ready\b/.test(text) || (capability.status === "live" && /\btier[- ]?zero\b/.test(text) && capability.tierZeroVerified !== true)) {
      violations.push({
        id: `capability-claim-${capability.id || label}`,
        target: label,
        severity: "critical",
        message: "Capability text claims market-ready status or a live tier-zero capability without runtime proof."
      });
    }
    if (capability.status === "live" && capability.tierZeroVerified === true && !capability.runtimeProof) {
      violations.push({
        id: `capability-tier-zero-without-runtime-proof-${capability.id || label}`,
        target: label,
        severity: "critical",
        message: "Tier-zero capability must declare a runtime proof endpoint."
      });
    }
    if (capability.status === "live" && (!Array.isArray(capability.evidence) || capability.evidence.length === 0)) {
      violations.push({
        id: `capability-live-without-evidence-${capability.id || label}`,
        target: label,
        severity: "high",
        message: "Live capability must declare executable evidence."
      });
    }
  }

  for (const agent of agentPipeline) {
    const label = agent.label || agent.id || "unknown agent";
    const text = `${agent.label || ""} ${agent.action || ""} ${agent.persona || ""}`.toLowerCase();
    if (FORBIDDEN_RUNTIME_IDS.test(String(agent.id || "")) || FORBIDDEN_RUNTIME_IDS.test(String(agent.label || ""))) {
      violations.push({ id: `forbidden-agent-${agent.id || label}`, target: label, severity: "critical", message: "Forbidden other-app runtime agent found." });
    }
    if (PLACEHOLDER_CLAIMS.test(text)) {
      violations.push({ id: `placeholder-agent-${agent.id || label}`, target: label, severity: "critical", message: "Placeholder or fake-live agent claim found." });
    }
    if (WAKE_ONLY_DRIFT.test(text)) {
      violations.push({ id: `wake-only-agent-${agent.id || label}`, target: label, severity: "critical", message: "Wake-only output drift found in a source-driven agent." });
    }
    if (/\bmarket[- ]?ready\b/.test(text) || (agent.status === "live" && /\btier[- ]?zero\b/.test(text))) {
      if (agent.tierZeroVerified !== true) {
        violations.push({
          id: `agent-claim-${agent.id || label}`,
          target: label,
          severity: "critical",
          message: "Agent text claims market-ready status or a live tier-zero agent without runtime proof."
        });
      }
    }
    if (agent.status === "live" && agent.tierZeroVerified !== true) {
      violations.push({
        id: `agent-live-without-tier-zero-proof-${agent.id || label}`,
        target: label,
        severity: "critical",
        message: "Agent is marked live without tier-zero proof. Live content agents require contracts, tools, A2A, memory, QA, and tests."
      });
    }
    if (agent.tierZeroVerified === true) {
      const missing = [];
      if (!agent.contract) missing.push("contract");
      if (!Array.isArray(agent.tools) || !agent.tools.length) missing.push("tools");
      if (!Array.isArray(agent.a2a) || !agent.a2a.length) missing.push("a2a");
      if (!Array.isArray(agent.tests) || !agent.tests.length) missing.push("tests");
      if (missing.length) {
        violations.push({
          id: `agent-tier-zero-missing-proof-${agent.id || label}`,
          target: label,
          severity: "critical",
          message: `Agent is marked tier-zero but is missing: ${missing.join(", ")}.`
        });
      }
    }
    if (agent.status === "partial") {
      warnings.push({
        id: `agent-partial-${agent.id || label}`,
        target: label,
        message: "Agent is truthfully marked partial until its runtime proof exists."
      });
    }
  }

  const requiredRuntimeEvidence = [
    ["benchmark-script", runtimeEvidence.benchmarkScript === true, "Benchmark script is missing."],
    ["chat-target", runtimeEvidence.chatTarget === "/api/agent-chat/stream", "Visible chat target/stream contract is missing."],
    ["export-inspection", runtimeEvidence.exportInspection === true, "Export inspection is missing."],
    ["tier-zero-spec-disclaimer", Boolean(runtimeEvidence.tierZeroSpecDisclaimer), "Tier Zero specification disclaimer is missing."],
    ["canonical-packet-contract", Boolean(runtimeEvidence.packetContract?.version && runtimeEvidence.packetContract?.requiredSections?.length), "Canonical packet contract is missing."]
  ];
  for (const [id, passed, message] of requiredRuntimeEvidence) {
    if (!passed) violations.push({ id, target: "runtime", severity: "critical", message });
  }

  return {
    ok: violations.length === 0,
    checkedAt,
    summary: {
      capabilities: capabilities.length,
      agents: agentPipeline.length,
      violations: violations.length,
      warnings: warnings.length,
      runtimeEvidence: requiredRuntimeEvidence.length
    },
    violations,
    warnings
  };
}
