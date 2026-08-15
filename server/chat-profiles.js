export const CHAT_PROFILES = {
  console: { label: "fast strategy", timeoutMs: 15000, numPredict: 300, contextLimit: 4, mediaLimit: 2, temperature: 0.15 },
  agent: { label: "balanced agent", timeoutMs: 18000, numPredict: 450, contextLimit: 5, mediaLimit: 3, temperature: 0.18 },
  cluster: { label: "deeper cluster", timeoutMs: 22000, numPredict: 550, contextLimit: 6, mediaLimit: 4, temperature: 0.2 },
  vault: { label: "fast archivist", timeoutMs: 12000, numPredict: 250, contextLimit: 4, mediaLimit: 2, temperature: 0.1 },
  library: { label: "fast export", timeoutMs: 12000, numPredict: 280, contextLimit: 4, mediaLimit: 2, temperature: 0.12 },
  tasks: { label: "fast qa", timeoutMs: 12000, numPredict: 250, contextLimit: 3, mediaLimit: 1, temperature: 0.1 },
  snapshot: { label: "audit qa", timeoutMs: 12000, numPredict: 280, contextLimit: 3, mediaLimit: 1, temperature: 0.1 }
};

export function chatProfileFor(ability, mode) {
  const base = CHAT_PROFILES[ability] || CHAT_PROFILES.agent;
  if (mode === "deep") {
    return {
      ...base,
      label: `${base.label} deep`,
      timeoutMs: Math.min(30000, Math.round(base.timeoutMs * 1.6)),
      numPredict: Math.min(800, Math.round(base.numPredict * 1.6)),
      contextLimit: Math.min(7, base.contextLimit + 2),
      mediaLimit: Math.min(5, base.mediaLimit + 1)
    };
  }
  if (mode === "elite") {
    return {
      ...base,
      label: `${base.label} elite`,
      timeoutMs: Math.min(45000, Math.round(base.timeoutMs * 2.2)),
      numPredict: Math.min(1100, Math.round(base.numPredict * 2.0)),
      contextLimit: Math.min(8, base.contextLimit + 3),
      mediaLimit: Math.min(5, base.mediaLimit + 2),
      temperature: Math.max(0.08, base.temperature - 0.03)
    };
  }
  if (mode === "instant") return { ...base, label: `${base.label} instant`, timeoutMs: 0, numPredict: 0 };
  return base;
}

