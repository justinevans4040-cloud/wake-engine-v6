/**
 * WAKE Omega — product spine + marketable tool catalog.
 * Omega is the command console. Tools are discrete, honest capabilities under it.
 */

export const WAKE_OMEGA = Object.freeze({
  id: "wake-omega",
  name: "WAKE Engine Omega",
  version: "V6",
  role: "Local command console and orchestrator",
  pitch:
    "One local Omega workbench that turns approved source into evidence-linked content packets, then hands work to specialized tools without cloud lock-in.",
  marketPosition: {
    category: "Local content operations OS",
    buyer: "Creators, operators, and small studios who need provenance, review, and durable local control",
    differentiator:
      "Source-bound Tier Zero agents, crash-resilient local state, and honest tool boundaries — not fake social autopilot"
  },
  surfaces: ["Console", "Agents", "Cluster", "Vault", "Library", "Automations", "Monitor", "Audit", "Instructions"]
});

export const OMEGA_TOOLS = Object.freeze([
  {
    id: "tier-zero",
    name: "Tier Zero Agent Runtime",
    category: "core",
    status: "live",
    marketable: true,
    pitch: "Six-stage local agent pipeline with A2A handoffs, tool receipts, memory, and QA gates.",
    honesty: "Deterministic orchestration with optional Ollama enhancement — not six independent cloud LLMs.",
    endpoints: ["/api/tier-zero/run", "/api/run-agent", "/api/tier-zero/agents"],
    proof: ["/api/tier-zero/audit"]
  },
  {
    id: "intake-vault",
    name: "Vault Intake",
    category: "ingest",
    status: "live",
    marketable: true,
    pitch: "Review local folders and SEED uploads before import. Keep operational junk out of the creative vault.",
    honesty: "Supports text/docs/media metadata intake. Binary deep parsing for every format is not claimed.",
    endpoints: ["/api/intake/review", "/api/intake/upload-review", "/api/intake/reviews/:id/apply"]
  },
  {
    id: "content-cluster",
    name: "Content Cluster",
    category: "production",
    status: "live",
    marketable: true,
    pitch: "Turn one source into pillars, platform lanes, hooks, captions, and export-ready packets.",
    honesty: "Local packet builder grounded in source evidence and QA — not automatic viral prediction.",
    endpoints: ["/api/content-cluster", "/api/export"]
  },
  {
    id: "hook-matrix",
    name: "Hook Angle Matrix",
    category: "creative",
    status: "live",
    marketable: true,
    pitch: "Generate five psychological hook angles for A/B copy exploration.",
    honesty: "Template + heuristic scoring for creative comparison — not measured platform retention data.",
    endpoints: ["/api/hooks/generate-variants"]
  },
  {
    id: "voiceover",
    name: "Local Voiceover",
    category: "media",
    status: "live",
    marketable: true,
    pitch: "Synthesize real on-device voiceover audio with subtitle tracks for reel packs.",
    honesty: "Uses Windows SAPI locally (optional remote neural endpoint if configured). Returns playable files only.",
    endpoints: ["/api/voice/synthesize", "/api/voice/profiles"]
  },
  {
    id: "video-reel",
    name: "Vertical Reel Renderer",
    category: "media",
    status: "live",
    marketable: true,
    pitch: "Render real 9:16 MP4 reels from audio (and optional stills) with FFmpeg.",
    honesty: "Requires FFmpeg on PATH and a real audio file. Does not spoof JSON as MP4.",
    endpoints: ["/api/video/render-reel", "/api/video/status"]
  },
  {
    id: "retention-sim",
    name: "Retention Simulator",
    category: "analytics",
    status: "live",
    marketable: true,
    pitch: "Score script architecture for hook density, pacing, and CTA strength before export.",
    honesty: "Heuristic simulator for creative QA — not live TikTok/YouTube analytics.",
    endpoints: ["/api/analytics/simulate"]
  },
  {
    id: "scheduler",
    name: "Automation Scheduler",
    category: "ops",
    status: "live",
    marketable: true,
    pitch: "Cron-based local folder workflows into review queue or auto-export when QA passes.",
    honesty: "Local scheduler only. Does not post to social networks.",
    endpoints: ["/api/automations"]
  },
  {
    id: "publish-stage",
    name: "Manual Publish Stage",
    category: "ops",
    status: "live",
    marketable: true,
    pitch: "Stage export-ready packets for human publication outside WAKE.",
    honesty: "Direct social API publishing is not implemented. Stage + export + publish manually.",
    endpoints: ["/api/publishing/accounts", "/api/publishing/queue", "/api/publishing/stage", "/api/publishing/dispatch/:id"]
  },
  {
    id: "durable-store",
    name: "Durable Local Store",
    category: "platform",
    status: "live",
    marketable: true,
    pitch: "Atomic writes, write-ahead log, crash recovery, and backup bundles for operator trust.",
    honesty: "Protects documented crash cases on the local disk — not a substitute for offsite backups.",
    endpoints: ["/api/state"],
    proof: ["server/durable-storage.js"]
  }
]);

export function listOmegaTools({ marketableOnly = false } = {}) {
  return OMEGA_TOOLS.filter((tool) => (marketableOnly ? tool.marketable !== false : true));
}

export function getOmegaManifest() {
  return {
    omega: WAKE_OMEGA,
    tools: listOmegaTools(),
    toolCount: OMEGA_TOOLS.length,
    generatedAt: new Date().toISOString()
  };
}

export function capabilitiesFromOmegaTools() {
  return OMEGA_TOOLS.map((tool) => {
    const isTierZero = tool.id === "tier-zero";
    return {
      id: tool.id,
      label: tool.name,
      status: tool.status,
      detail: `${tool.pitch} ${tool.honesty}`,
      evidence: tool.endpoints || [],
      runtimeProof: tool.proof?.[0] || (isTierZero ? "/api/tier-zero/audit" : null),
      tierZeroVerified: isTierZero ? true : undefined,
      category: tool.category,
      marketable: tool.marketable === true
    };
  });
}
