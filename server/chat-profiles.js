export const CHAT_PROFILES = {
  console: { label: "fast strategy", timeoutMs: 4500, numPredict: 220, contextLimit: 3, mediaLimit: 2, temperature: 0.15 },
  agent: { label: "balanced agent", timeoutMs: 6500, numPredict: 340, contextLimit: 4, mediaLimit: 3, temperature: 0.18 },
  cluster: { label: "deeper cluster", timeoutMs: 9000, numPredict: 440, contextLimit: 5, mediaLimit: 4, temperature: 0.2 },
  vault: { label: "fast archivist", timeoutMs: 3000, numPredict: 180, contextLimit: 3, mediaLimit: 2, temperature: 0.1 },
  library: { label: "fast export", timeoutMs: 3500, numPredict: 220, contextLimit: 3, mediaLimit: 2, temperature: 0.12 },
  tasks: { label: "fast qa", timeoutMs: 3000, numPredict: 180, contextLimit: 2, mediaLimit: 1, temperature: 0.1 },
  snapshot: { label: "audit qa", timeoutMs: 3500, numPredict: 220, contextLimit: 2, mediaLimit: 1, temperature: 0.1 }
};

export function chatProfileFor(ability, mode) {
  const base = CHAT_PROFILES[ability] || CHAT_PROFILES.agent;
  if (mode === "deep") {
    return {
      ...base,
      label: `${base.label} deep`,
      timeoutMs: Math.min(18000, Math.round(base.timeoutMs * 1.8)),
      numPredict: Math.min(720, Math.round(base.numPredict * 1.7)),
      contextLimit: Math.min(7, base.contextLimit + 2),
      mediaLimit: Math.min(5, base.mediaLimit + 1)
    };
  }
  if (mode === "elite") {
    return {
      ...base,
      label: `${base.label} elite`,
      timeoutMs: Math.min(24000, Math.round(base.timeoutMs * 2.4)),
      numPredict: Math.min(900, Math.round(base.numPredict * 2.2)),
      contextLimit: Math.min(8, base.contextLimit + 3),
      mediaLimit: Math.min(5, base.mediaLimit + 2),
      temperature: Math.max(0.08, base.temperature - 0.03)
    };
  }
  if (mode === "instant") return { ...base, label: `${base.label} instant`, timeoutMs: 0, numPredict: 0 };
  return base;
}
