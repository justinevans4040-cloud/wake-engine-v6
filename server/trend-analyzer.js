import crypto from "node:crypto";

/**
 * WAKE Engine V6 Automated Competitor & Niche Trend Hook Analyzer
 * Reverse-engineers viral patterns, power vocabulary density, hook archetypes, and generates counter-positioning angles.
 */

export const POWER_VOCABULARY_DICTIONARY = Object.freeze([
  "obsolete", "hidden", "blueprint", "unfair", "leverage", "fatal", "automated",
  "secret", "breakthrough", "silent", "exposed", "truth", "algorithm", "million",
  "mistake", "warning", "flaw", "guaranteed", "hacked", "stole", "insider", "paradox"
]);

export const HOOK_ARCHETYPES = Object.freeze([
  { id: "contrarian-teardown", name: "Contrarian Teardown", triggerPattern: /stop|never|wrong|myth|waste|lie/i, benchmarkScore: 92 },
  { id: "negative-urgency", name: "Negative Frame Urgency", triggerPattern: /costing|losing|failing|risk|warning|kill/i, benchmarkScore: 89 },
  { id: "insider-disclosure", name: "Insider Disclosure", triggerPattern: /secret|nobody|hidden|stealth|real reason|confession/i, benchmarkScore: 94 },
  { id: "data-proof", name: "Mathematical / Data Proof", triggerPattern: /percent|analyzed|tested|\d+x|\$|\d+k|\d+%/i, benchmarkScore: 87 },
  { id: "curiosity-framework", name: "Curiosity Gap Framework", triggerPattern: /how to|the one|this is why|simple way/i, benchmarkScore: 81 }
]);

export function analyzeCompetitorContent(text, { niche = "Technology & AI", platform = "tiktok" } = {}) {
  const content = String(text || "").trim();
  if (!content) {
    return {
      ok: false,
      error: "No competitor content or transcript provided."
    };
  }

  const words = content.toLowerCase().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = content.split(/[.!?\n]+/).filter(Boolean);
  const sentenceCount = Math.max(1, sentences.length);
  const avgWordsPerSentence = Number((wordCount / sentenceCount).toFixed(1));

  // Extract first 1-2 sentences as opening hook
  const rawHook = sentences.slice(0, 2).join(". ").trim();
  const hookWords = rawHook.split(/\s+/).filter(Boolean).length;

  // Identify Hook Archetype
  let detectedArchetype = HOOK_ARCHETYPES[4]; // default curiosity
  for (const arch of HOOK_ARCHETYPES) {
    if (arch.triggerPattern.test(rawHook)) {
      detectedArchetype = arch;
      break;
    }
  }

  // Detect Power Vocabulary
  const detectedPowerWords = [];
  for (const pw of POWER_VOCABULARY_DICTIONARY) {
    const regex = new RegExp(`\\b${pw}\\b`, "i");
    if (regex.test(content)) {
      detectedPowerWords.push(pw);
    }
  }
  const powerWordDensity = Number(((detectedPowerWords.length / Math.max(1, wordCount)) * 100).toFixed(1));

  // Calculate Viral Pattern Score (0 - 100)
  let viralScore = detectedArchetype.benchmarkScore;
  if (hookWords >= 6 && hookWords <= 18) viralScore += 4;
  else if (hookWords > 25) viralScore -= 8;

  if (detectedPowerWords.length >= 3) viralScore += 4;
  if (avgWordsPerSentence <= 14) viralScore += 3;
  viralScore = Math.max(45, Math.min(99, viralScore));

  // Generate 3 Counter-Positioning Angles
  const topicSnippet = rawHook.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 45) || niche;
  const counterAngles = [
    {
      strategy: "The Inversion Counter",
      hook: `Most creators analyzing ${topicSnippet} get it backwards. Here is what the top 0.1% actually do.`,
      rationale: "Flips the competitor's premise into a positioning asset for our brand."
    },
    {
      strategy: "The Data Authority Counter",
      hook: `I tested the exact advice on ${topicSnippet} for 30 days. The results were not what they promised.`,
      rationale: "Uses empirical testing to dismantle simplistic competitor claims."
    },
    {
      strategy: "The Speed & Automation Counter",
      hook: `Stop doing ${topicSnippet} manually in 2026. Here is the automated system that replaces it in 60 seconds.`,
      rationale: "Elevates from conceptual advice to concrete software leverage."
    }
  ];

  return {
    ok: true,
    niche,
    platform,
    metrics: {
      wordCount,
      sentenceCount,
      avgWordsPerSentence,
      hookWordCount: hookWords,
      powerWordCount: detectedPowerWords.length,
      powerWordDensityPct: powerWordDensity,
      viralPatternScore: viralScore
    },
    hookAnalysis: {
      rawHook,
      archetype: detectedArchetype.name,
      archetypeId: detectedArchetype.id,
      hookEfficiency: hookWords <= 20 ? "Optimal (Fast Hook)" : "Wordy (Needs Tightening)"
    },
    powerWords: detectedPowerWords,
    counterPositioning: counterAngles,
    analyzedAt: new Date().toISOString()
  };
}
