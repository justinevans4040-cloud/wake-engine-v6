/**
 * WAKE Engine Omega — Audience Retention & Viral Velocity Analytics Simulator
 * Models platform retention curves (0-3s hook, 3-15s proof, 15-45s pacing, 45-60s CTA)
 * and evaluates virality, readability, and algorithmic distribution benchmarks.
 */

const POWER_HOOK_WORDS = Object.freeze([
  "stop", "why", "how", "secret", "mistake", "truth", "never", "always",
  "tested", "spent", "wasted", "revealed", "nobody", "everyone", "system",
  "framework", "proven", "blueprint", "hack", "algorithm", "failed"
]);

const PLATFORM_BENCHMARKS = Object.freeze({
  tiktok: { baseline3s: 65, baseline15s: 48, baseline30s: 32, baseline60s: 22, idealHookWords: 10, maxWordsPerMin: 160 },
  reels: { baseline3s: 68, baseline15s: 50, baseline30s: 35, baseline60s: 25, idealHookWords: 11, maxWordsPerMin: 155 },
  shorts: { baseline3s: 70, baseline15s: 52, baseline30s: 38, baseline60s: 28, idealHookWords: 9, maxWordsPerMin: 165 },
  linkedin: { baseline3s: 82, baseline15s: 68, baseline30s: 55, baseline60s: 42, idealHookWords: 14, maxWordsPerMin: 140 },
  x: { baseline3s: 80, baseline15s: 62, baseline30s: 48, baseline60s: 35, idealHookWords: 12, maxWordsPerMin: 150 }
});

function calculateReadingMetrics(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const wordCount = words.length || 1;
  const sentenceCount = sentences.length || 1;
  const avgSentenceLength = Math.round(wordCount / sentenceCount);

  // Approximate syllable count
  let syllableCount = 0;
  for (const word of words) {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, "");
    if (cleanWord.length <= 3) {
      syllableCount += 1;
    } else {
      const matches = cleanWord.match(/[aeiouy]{1,2}/g);
      syllableCount += matches ? matches.length : 1;
    }
  }

  // Flesch Reading Ease approximation
  const fleschScore = Math.max(
    20,
    Math.min(100, Math.round(206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount)))
  );

  return { wordCount, sentenceCount, avgSentenceLength, fleschScore };
}

export function simulateAudienceRetention(scriptText, { hook = "", platform = "tiktok" } = {}) {
  const cleanScript = String(scriptText || "").trim();
  const cleanHook = String(hook || cleanScript.split(/[.!?\n]+/)[0] || "").trim();
  const benchmark = PLATFORM_BENCHMARKS[platform.toLowerCase()] || PLATFORM_BENCHMARKS.tiktok;

  const { wordCount, avgSentenceLength, fleschScore } = calculateReadingMetrics(cleanScript);
  const hookWords = cleanHook.split(/\s+/).filter(Boolean);

  // 1. Hook Tension Score (0-100)
  let hookScore = 60;
  const hookLower = cleanHook.toLowerCase();
  const powerWordCount = POWER_HOOK_WORDS.filter((w) => hookLower.includes(w)).length;
  hookScore += Math.min(25, powerWordCount * 8);

  // Penalize excessively long hooks
  if (hookWords.length <= benchmark.idealHookWords + 2) {
    hookScore += 15;
  } else {
    hookScore -= Math.min(20, (hookWords.length - benchmark.idealHookWords) * 3);
  }
  hookScore = Math.max(30, Math.min(99, Math.round(hookScore)));

  // 2. Pacing & Readability Score (0-100)
  let pacingScore = Math.round(fleschScore * 0.7 + (avgSentenceLength <= 14 ? 30 : 15));
  pacingScore = Math.max(35, Math.min(98, pacingScore));

  // 3. CTA & Conversion Strength (0-100)
  const hasCta = /(?:comment|link|subscribe|follow|download|check out|save this|share|dm me)/i.test(cleanScript);
  const ctaScore = hasCta ? 92 : 48;

  // 4. Overall Virality Index (0-100)
  const viralityIndex = Math.round(hookScore * 0.45 + pacingScore * 0.35 + ctaScore * 0.2);

  // Grade Calculation
  let grade = "B";
  if (viralityIndex >= 90) grade = "A+";
  else if (viralityIndex >= 82) grade = "A";
  else if (viralityIndex >= 74) grade = "B+";
  else if (viralityIndex >= 65) grade = "B";
  else grade = "Needs Polish";

  // 5. Modeled Retention Curve (0s to 60s)
  const hookMultiplier = hookScore / 75;
  const pacingMultiplier = pacingScore / 75;

  const predicted3s = Math.max(40, Math.min(95, Math.round(benchmark.baseline3s * hookMultiplier)));
  const predicted15s = Math.max(30, Math.min(85, Math.round(benchmark.baseline15s * ((hookMultiplier + pacingMultiplier) / 2))));
  const predicted30s = Math.max(20, Math.min(75, Math.round(benchmark.baseline30s * pacingMultiplier)));
  const predicted60s = Math.max(12, Math.min(65, Math.round(benchmark.baseline60s * pacingMultiplier * (hasCta ? 1.1 : 0.9))));

  const retentionCurve = [
    { second: 0, label: "0s (Start)", predicted: 100, benchmark: 100 },
    { second: 3, label: "3s (Hook)", predicted: predicted3s, benchmark: benchmark.baseline3s },
    { second: 15, label: "15s (Proof)", predicted: predicted15s, benchmark: benchmark.baseline15s },
    { second: 30, label: "30s (Core)", predicted: predicted30s, benchmark: benchmark.baseline30s },
    { second: 60, label: "60s (CTA)", predicted: predicted60s, benchmark: benchmark.baseline60s }
  ];

  // Actionable Optimization Tips
  const optimizationTips = [];
  if (hookWords.length > benchmark.idealHookWords + 3) {
    optimizationTips.push(`Shorten the opening hook from ${hookWords.length} words to ~${benchmark.idealHookWords} words for faster pattern interrupt.`);
  }
  if (powerWordCount === 0) {
    optimizationTips.push("Inject a high-tension trigger word (e.g. 'Mistake', 'Secret', 'Failed', 'Truth') in the opening 3 seconds.");
  }
  if (avgSentenceLength > 15) {
    optimizationTips.push(`Split complex sentences (currently avg ${avgSentenceLength} words/sentence) to maintain high spoken cadence.`);
  }
  if (!hasCta) {
    optimizationTips.push("Add a specific, low-friction Call To Action in the final 5 seconds (e.g. 'Comment FRAMEWORK below').");
  }
  if (optimizationTips.length === 0) {
    optimizationTips.push("High-performing script architecture. Optimal hook density, sentence cadence, and conversion CTA.");
  }

  return {
    platform,
    viralityIndex,
    grade,
    scores: {
      hookTension: hookScore,
      pacingReadability: pacingScore,
      ctaConversion: ctaScore
    },
    readingStats: {
      wordCount,
      estimatedSpeechDurationSec: Math.max(5, Math.round((wordCount / benchmark.maxWordsPerMin) * 60)),
      avgSentenceLength,
      fleschScore
    },
    retentionCurve,
    optimizationTips,
    simulatedAt: new Date().toISOString()
  };
}
