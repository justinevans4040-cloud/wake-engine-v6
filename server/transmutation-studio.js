import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * WAKE Engine V6 1-Click Omnichannel Transmutation Studio
 * Transmutes any source document/note into 5 native platform formats:
 * 1. Vertical Video Reel (9:16)
 * 2. X / Twitter 7-Tweet Thread
 * 3. LinkedIn Long-Form Executive Article
 * 4. Instagram 7-Slide Carousel Deck
 * 5. High-Converting Email Newsletter Brief
 */

export function transmuteSourceToOmnichannel(sourceText, { title = "Omnichannel Authority Campaign", niche = "AI & Systems", tone = "Authoritative & Direct" } = {}) {
  const content = String(sourceText || "").trim();
  if (!content) {
    throw new Error("Source text is required for omnichannel transmutation.");
  }

  const sentences = content.split(/[.!?\n]+/).filter((s) => s.trim().length > 10).map((s) => s.trim());
  const leadSentence = sentences[0] || "Most creators and founders approach system scale completely backwards.";
  const keyInsights = sentences.slice(1, 6);
  const coreThesis = keyInsights[0] || "Leverage compounds when workflows are codified into deterministic protocols.";

  // 1. Vertical Video Reel (9:16)
  const reel = {
    platform: "TikTok / IG Reels / YouTube Shorts",
    aspectRatio: "9:16",
    durationEstSec: 45,
    hook: `Stop doing this manually in 2026. Here is why ${leadSentence.slice(0, 50)}...`,
    scenes: [
      {
        timestamp: "0:00 - 0:05",
        visual: "Close-up high-contrast typing / system dashboard screen capture with rapid text overlay.",
        voiceover: `Stop doing this manually in 2026. Most people get this completely wrong.`,
        diffusionPrompt: `Photorealistic close-up macro shot of glowing futuristic dark-mode analytics terminal, cinematic lighting, neon cyan accents, 9:16 vertical`
      },
      {
        timestamp: "0:05 - 0:18",
        visual: "Dynamic split screen showing messy manual process vs streamlined automated pipeline.",
        voiceover: `The core mistake is simple: ${coreThesis}. When you rely on memory, output stalls.`,
        diffusionPrompt: `Cinematic visualization of digital data streams flowing into clean organized vault, glowing blue and emerald nodes, ultra-detailed 9:16 vertical`
      },
      {
        timestamp: "0:18 - 0:35",
        visual: "Rapid 3-point bullet point sequence with smooth motion graphic transitions.",
        voiceover: `Here are the 3 non-negotiable rules: First, isolate evidence. Second, automate synthesis. Third, maintain local cryptographic ownership.`,
        diffusionPrompt: `Modern tech founder working in minimal sleek aesthetic studio, dark theme, ambient warm lighting, 8k resolution, 9:16 vertical`
      },
      {
        timestamp: "0:35 - 0:45",
        visual: "Center-aligned stark typography with pulsing action pill.",
        voiceover: `Grab the complete architecture blueprint in the link below. Start building with leverage.`,
        diffusionPrompt: `Minimalist futuristic blueprint interface with glowing holographic grid lines, ultra-crisp typography, 9:16 vertical`
      }
    ],
    caption: `The blueprint for 2026 system scale. ⚡ Stop trading hours for manual output.\n\n#Systems #AI #Automation #Productivity #Engineering`
  };

  // 2. X / Twitter 7-Tweet Thread
  const xThread = {
    platform: "X / Twitter",
    format: "7-Tweet Viral Thread",
    tweetCount: 7,
    tweets: [
      `1/7 Most operators waste 15+ hours a week because they don't understand this fundamental truth:\n\n${leadSentence}\n\nHere is the 5-step framework to automate your entire workflow 🧵👇`,
      `2/7 The Root Cause of the Bottleneck:\n\n${coreThesis}\n\nWhen every execution requires manual decision-making, velocity drops to zero. You must turn knowledge into executable systems.`,
      `3/7 Step 1: Capture Raw Evidence at the Source.\n\nNever synthesize from scratch. Always ground outputs in verified source notes, customer logs, or technical specs. Verbatim proof beats generic AI prompts every time.`,
      `4/7 Step 2: Establish Deterministic Guardrails.\n\nProbabilistic AI generates noise without deterministic quality gates. Add strict validation rules before anything touches production.`,
      `5/7 Step 3: Omnichannel Transmutation.\n\nTake 1 high-signal asset and transmute it across 5 distinct platform distributions simultaneously. 1 source -> 5 high-impact touchpoints.`,
      `6/7 Step 4: Local Cryptographic Ownership.\n\nNever let critical business IP reside solely in third-party clouds. Store your vectors, vaults, and outputs locally under your own key.`,
      `7/7 Summary Checklist:\n• Evidence first\n• Strict QA gates\n• Omnichannel distribution\n• Local data ownership\n\nIf you found this valuable:\n1. Follow for more deep-dive systems engineering\n2. RT the first tweet to share with your network 🔁`
    ]
  };

  // 3. LinkedIn Long-Form Executive Article
  const linkedIn = {
    platform: "LinkedIn",
    format: "Long-Form Authority Article",
    headline: `Why Most Content Operations Fail to Scale (And the 4-Pillar Systems Blueprint That Fixes It)`,
    readTimeMin: 3,
    body: `Most organizations treat content and operations as a creative lottery rather than an engineering pipeline.

Here is the fundamental reality: ${leadSentence}

When you examine top-performing media and engineering operations, they do not rely on sporadic creative bursts. They operate on deterministic, reproducible infrastructure.

### The 3 Structural Failure Points in Modern Workflows:

1. **Context Fragmentation**: Teams operate across siloed tools, losing source evidence between meetings and final drafts.
2. **Lack of Claim Verification**: Generic AI tools hallucinate facts because they lack grounded verbatim citation maps.
3. **Distribution Inefficiency**: Creators spend 80% of their time reformatting a single insight for different platforms manually.

### The Omnichannel Architecture:

${coreThesis}

To achieve true leverage, your pipeline must follow a strict DAG (Directed Acyclic Graph):
• **Archivist Stage**: Extract verbatim evidence and source fidelity metrics.
• **Strategist Stage**: Position the promise, tension, and angle against competitor baselines.
• **Creative Direction**: Synthesize platform-native visual prompts, audio pacing, and scene cues.
• **QA Gatekeeper**: Enforce zero-hallucination compliance before distribution.

---

**Action Item for Leaders**: Audit your current production pipeline. Are you paying high-cost talent to perform manual reformatting, or are you giving them automated leverage?

Drop your thoughts below—how is your team structuring local data ownership in 2026?

#Operations #Leadership #ArtificialIntelligence #Technology #EnterpriseSystems`
  };

  // 4. Instagram 7-Slide Carousel Deck
  const carousel = {
    platform: "Instagram Carousel",
    aspectRatio: "4:5 / 1:1",
    slideCount: 7,
    slides: [
      {
        slideNumber: 1,
        layout: "Cover Hook",
        headline: "THE 2026 SYSTEMS BLUEPRINT",
        subtext: "How to turn 1 raw idea into 5 native platform assets in 30 seconds.",
        designNotes: "High-contrast dark background (#0a0a0f), bold cyan headline typography, subtle glowing grid."
      },
      {
        slideNumber: 2,
        layout: "The Problem",
        headline: "The Manual Trap",
        subtext: leadSentence,
        designNotes: "Red warning accent tag, minimalist layout with high whitespace."
      },
      {
        slideNumber: 3,
        layout: "Core Law",
        headline: "The Law of Leverage",
        subtext: coreThesis,
        designNotes: "Large highlighted callout box with emerald green border."
      },
      {
        slideNumber: 4,
        layout: "Pillar 1",
        headline: "01. Evidence Ingestion",
        subtext: "Never write from a blank page. Ingest verbatim notes and ground all claims in local data.",
        designNotes: "Icon left, clean monospace typography for technical details."
      },
      {
        slideNumber: 5,
        layout: "Pillar 2",
        headline: "02. Multi-Agent DAG",
        subtext: "Route context through specialized agents (Archivist -> Strategist -> Scriptwriter -> QA).",
        designNotes: "Flow diagram graphic showing step-by-step nodes."
      },
      {
        slideNumber: 6,
        layout: "Pillar 3",
        headline: "03. Omnichannel Transmutation",
        subtext: "Generate vertical reels, X threads, LinkedIn essays, and newsletters simultaneously.",
        designNotes: "Matrix grid showing multi-platform icons."
      },
      {
        slideNumber: 7,
        layout: "CTA & Summary",
        headline: "SAVE THIS BLUEPRINT",
        subtext: "Tap save to reference when building your next campaign. Link in bio for the complete engine.",
        designNotes: "Bold call-to-action button graphic with bookmark icon."
      }
    ]
  };

  // 5. High-Converting Email Newsletter Brief
  const newsletter = {
    platform: "Email Newsletter",
    subjectLines: [
      `The 30-second omnichannel blueprint (${niche})`,
      `Stop doing this manually in 2026...`,
      `[Internal Memo] The new standard for content leverage`
    ],
    previewText: `How top 0.1% operators turn 1 raw note into 5 native distributions...`,
    body: `Hey Founder,\n\nHere is a brutal truth most teams take years to realize:\n\n${leadSentence}\n\nWhen we audited how much time high-output creators spend on manual reformatting, the number was staggering—over 65% of productive hours were lost to copy-pasting and tweaking hooks.\n\n### The Shift: Deterministic Transmutation\n\n${coreThesis}\n\nInstead of starting from scratch on every channel, top operators use a 3-step protocol:\n\n1. **Ground the Source**: Lock in verified evidence and transcript facts.\n2. **Run Parallel Transmutation**: Generate Video Reels, X Threads, LinkedIn Articles, and Carousel Decks simultaneously.\n3. **Enforce QA Gates**: Zero hallucinations allowed through the export gate.\n\n### Your Action for Today:\nPick your best-performing note or internal memo from this week. Do not just post it once—transmute it into all 5 formats.\n\nIf you want the full system running locally on your machine, check out the engine details below.\n\nBest,\n\n**The WAKE Team**`,
    ctaButton: {
      label: "Access the Full Blueprint",
      url: "https://wake-engine.local"
    }
  };

  const bundle = {
    ok: true,
    title,
    niche,
    tone,
    createdAt: new Date().toISOString(),
    id: `omni-${crypto.randomBytes(6).toString("hex")}`,
    assets: {
      reel,
      xThread,
      linkedIn,
      carousel,
      newsletter
    }
  };

  return bundle;
}

export function exportOmnichannelToFolder(bundle, targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const slug = (bundle.title || "omnichannel-bundle").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const bundleDir = path.join(targetDir, `${slug}-${Date.now().toString(36)}`);
  fs.mkdirSync(bundleDir, { recursive: true });

  const writtenFiles = [];

  // 1. Reel Script
  const reelPath = path.join(bundleDir, "01-vertical-reel-script.md");
  const reelContent = `# ${bundle.title} - Vertical Video Reel (9:16)\n\n**Hook**: ${bundle.assets.reel.hook}\n**Duration**: ~${bundle.assets.reel.durationEstSec}s\n\n## Scene Breakdown:\n` +
    bundle.assets.reel.scenes.map((s) => `### ${s.timestamp}\n- **Visual**: ${s.visual}\n- **Voiceover**: "${s.voiceover}"\n- **Diffusion Prompt**: \`${s.diffusionPrompt}\`\n`).join("\n") +
    `\n## Caption:\n${bundle.assets.reel.caption}\n`;
  fs.writeFileSync(reelPath, reelContent, "utf8");
  writtenFiles.push("01-vertical-reel-script.md");

  // 2. X Thread
  const xPath = path.join(bundleDir, "02-x-twitter-thread.md");
  const xContent = `# ${bundle.title} - X / Twitter 7-Tweet Thread\n\n` +
    bundle.assets.xThread.tweets.map((t) => `${t}\n\n---\n`).join("\n");
  fs.writeFileSync(xPath, xContent, "utf8");
  writtenFiles.push("02-x-twitter-thread.md");

  // 3. LinkedIn Article
  const liPath = path.join(bundleDir, "03-linkedin-article.md");
  const liContent = `# ${bundle.assets.linkedIn.headline}\n\n${bundle.assets.linkedIn.body}\n`;
  fs.writeFileSync(liPath, liContent, "utf8");
  writtenFiles.push("03-linkedin-article.md");

  // 4. IG Carousel
  const igPath = path.join(bundleDir, "04-instagram-carousel-deck.md");
  const igContent = `# ${bundle.title} - Instagram 7-Slide Carousel Deck\n\n` +
    bundle.assets.carousel.slides.map((s) => `## Slide ${s.slideNumber}: ${s.headline} (${s.layout})\n**Body**: ${s.subtext}\n**Design**: ${s.designNotes}\n`).join("\n");
  fs.writeFileSync(igPath, igContent, "utf8");
  writtenFiles.push("04-instagram-carousel-deck.md");

  // 5. Email Newsletter
  const emPath = path.join(bundleDir, "05-email-newsletter.md");
  const emContent = `# Email Newsletter Brief\n\n**Subject Line Options**:\n` +
    bundle.assets.newsletter.subjectLines.map((sl, i) => `${i + 1}. ${sl}`).join("\n") +
    `\n\n**Preview Text**: ${bundle.assets.newsletter.previewText}\n\n## Body:\n${bundle.assets.newsletter.body}\n\n**Primary CTA**: [${bundle.assets.newsletter.ctaButton.label}](${bundle.assets.newsletter.ctaButton.url})\n`;
  fs.writeFileSync(emPath, emContent, "utf8");
  writtenFiles.push("05-email-newsletter.md");

  // Manifest JSON
  const manifestPath = path.join(bundleDir, "omnichannel-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(bundle, null, 2), "utf8");
  writtenFiles.push("omnichannel-manifest.json");

  return {
    ok: true,
    bundleDir,
    filesCount: writtenFiles.length,
    files: writtenFiles
  };
}
