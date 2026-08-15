import crypto from "node:crypto";

/**
 * WAKE Engine V6 Batch Synthesis & Timed Subtitle Engine
 * Generates 30-day content calendar matrices and synchronized .srt / .vtt subtitle tracks.
 */

export function generateSubtitleTrack(scriptText, { wordsPerMinute = 150, format = "srt" } = {}) {
  if (!scriptText || typeof scriptText !== "string") {
    return { ok: false, error: "Script text is required." };
  }

  // Segment script into clean subtitle chunks (by sentence or punctuation break)
  const rawSegments = scriptText
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const segments = [];
  for (const seg of rawSegments) {
    // If a sentence is long, break it into 6-10 word chunks
    const words = seg.split(/\s+/);
    if (words.length > 10) {
      for (let i = 0; i < words.length; i += 8) {
        segments.push(words.slice(i, i + 8).join(" "));
      }
    } else {
      segments.push(seg);
    }
  }

  let currentTimeSec = 0.5; // slight lead-in
  const timedItems = [];

  for (let i = 0; i < segments.length; i++) {
    const text = segments[i];
    const wordCount = text.split(/\s+/).length;
    const durationSec = Math.max(1.5, (wordCount / wordsPerMinute) * 60);
    const startSec = currentTimeSec;
    const endSec = currentTimeSec + durationSec;
    currentTimeSec = endSec + 0.25; // 250ms gap between subtitle cues

    timedItems.push({
      index: i + 1,
      startSec,
      endSec,
      startFormatted: formatTimestamp(startSec, format),
      endFormatted: formatTimestamp(endSec, format),
      text
    });
  }

  let trackContent = "";
  if (format === "vtt") {
    trackContent = "WEBVTT\n\n" + timedItems.map((item) => `${item.index}\n${item.startFormatted} --> ${item.endFormatted}\n${item.text}\n`).join("\n");
  } else {
    // Default SRT
    trackContent = timedItems.map((item) => `${item.index}\n${item.startFormatted} --> ${item.endFormatted}\n${item.text}\n`).join("\n");
  }

  return {
    ok: true,
    format,
    totalDurationSec: Math.ceil(currentTimeSec),
    segmentCount: timedItems.length,
    timedItems,
    trackContent
  };
}

function formatTimestamp(totalSeconds, format = "srt") {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor((totalSeconds % 1) * 1000);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const ms = String(millis).padStart(3, "0");

  if (format === "vtt") {
    return `${hh}:${mm}:${ss}.${ms}`;
  }
  return `${hh}:${mm}:${ss},${ms}`;
}

export function generate30DayMatrix({ sourceText, projectId = "wake-v6-main", theme = "Authority & Conversion" } = {}) {
  const cleanSource = (sourceText || "General authority content strategy").trim();
  const sourceSnippet = cleanSource.slice(0, 120);

  const platforms = ["TikTok / Reels (9:16)", "Instagram Carousel", "X Thread (Long-Form)", "LinkedIn Thought Leadership"];
  const formats = ["Hook & Story Short", "5-Slide Educational Breakdown", "Deep-Dive Teardown", "Contrarian Perspective", "Actionable Framework", "Case Study & Result"];
  
  const pillars = [
    { title: "Core Frameworks & Foundations", focus: "Educate audience on the underlying philosophy and mechanics." },
    { title: "Common Mistakes & Mythbusting", focus: "Identify high-cost pitfalls and explain why traditional methods fail." },
    { title: "Step-by-Step Tactical Execution", focus: "Give actionable, immediately implementable walkthroughs." },
    { title: "Case Studies & Proof In Action", focus: "Demonstrate verified results, client breakdowns, and evidence." }
  ];

  const days = [];
  for (let d = 1; d <= 30; d++) {
    const pillar = pillars[(d - 1) % pillars.length];
    const platform = platforms[(d - 1) % platforms.length];
    const format = formats[(d - 1) % formats.length];
    const weekNum = Math.ceil(d / 7);

    const title = `Day ${d}: ${pillar.title.split(" ")[0]} — Part ${((d - 1) % 4) + 1}`;
    const hook = `Most people get this completely wrong: here is how to master ${pillar.title.toLowerCase()} without wasted effort.`;
    const bodyScript = `Day ${d} Strategy Breakdown:\n\nBased on your source: "${sourceSnippet}..."\n\n1. The Problem: What holding back progress.\n2. The Shift: The specific counter-intuitive technique.\n3. The Action: Implement step one today and measure the result.`;

    const subtitleTrack = generateSubtitleTrack(bodyScript, { format: "srt" });

    days.push({
      day: d,
      week: weekNum,
      id: `matrix-day-${d}-${crypto.randomBytes(3).toString("hex")}`,
      title,
      pillar: pillar.title,
      platform,
      format,
      hook,
      script: bodyScript,
      visualPrompt: `High-definition minimalist editorial scene showing ${pillar.title.toLowerCase()} concept in clean modern aesthetic, 8k resolution, cinematic lighting.`,
      status: "Ready",
      subtitleTrack: {
        srt: subtitleTrack.trackContent,
        segmentCount: subtitleTrack.segmentCount,
        durationSec: subtitleTrack.totalDurationSec
      }
    });
  }

  return {
    ok: true,
    projectId,
    theme,
    createdAt: new Date().toISOString(),
    totalDays: 30,
    weeksCount: 5,
    days,
    summary: {
      tiktokCount: days.filter((d) => d.platform.includes("TikTok")).length,
      instagramCount: days.filter((d) => d.platform.includes("Instagram")).length,
      xCount: days.filter((d) => d.platform.includes("X Thread")).length,
      linkedinCount: days.filter((d) => d.platform.includes("LinkedIn")).length
    }
  };
}
