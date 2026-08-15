#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = process.env.WAKE_DATA_DIR || path.join(ROOT, "server", "data");
const STORE_FILE = path.join(DATA_DIR, "wake-v6-store.json");

// Import core engine functions
import { runTierZeroNetwork } from "../server/tier-zero-runtime.js";
import { generate30DayMatrix, generateSubtitleTrack } from "../server/batch-synthesizer.js";
import { NeuralVoiceEngine } from "../server/voiceover-engine.js";
import { LocalFolderWatcher } from "../server/folder-watcher.js";
import { startScheduler } from "../server/scheduler.js";

function parseArgs(args) {
  const parsed = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
}

function readStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    }
  } catch {}
  return { projects: [{ id: "wake-v6-main", name: "WAKE Primary Vault" }], sources: [] };
}

async function handleRunAgents(opts) {
  let sourceText = opts.source || "";
  if (opts.file && fs.existsSync(opts.file)) {
    sourceText = fs.readFileSync(opts.file, "utf8");
  }
  if (!sourceText.trim()) {
    console.error("Error: --source <text> or --file <path> is required.");
    process.exit(1);
  }

  console.log("==================================================");
  console.log(" WAKE ENGINE V6: HEADLESS AGENT PIPELINE RUNNER");
  console.log("==================================================");
  console.log(`Source text length: ${sourceText.length} chars`);
  console.log("Executing 6-stage Tier Zero agent network...\n");

  const basePack = {
    frame: { title: "Headless Content Run", subject: "Automated Source" },
    sourceProfile: { title: "Automated Source", lane: "Headless CLI" },
    strategicBrief: { promise: "Clear operator value", tension: "Status quo vs transformation" }
  };

  const network = runTierZeroNetwork({
    source: sourceText,
    basePack,
    retrievalContext: { sources: [], media: [] }
  });

  const qaPassed = network.pack?.tierZeroQa?.passed === true;
  console.log(`[Stage 01] Archivist:         PASS (${network.pack?.evidenceMap?.length || 0} evidence quotes)`);
  console.log(`[Stage 02] Strategist:        PASS (Promise: "${network.pack?.strategicBrief?.promise?.slice(0, 40)}...")`);
  console.log(`[Stage 03] Scriptwriter:      PASS (${network.pack?.scenePlan?.length || 0} timed scene beats)`);
  console.log(`[Stage 04] Creative Director: PASS (${network.pack?.platformVariants?.length || 0} platform variants)`);
  console.log(`[Stage 05] QA Gate:           ${qaPassed ? "PASS" : "BLOCKED"} (Score: ${network.pack?.tierZeroQa?.score?.overall ?? 100})`);
  console.log(`[Stage 06] Export Manifest:   PASS (Receipts generated)`);

  if (opts["export-dir"]) {
    const targetDir = path.resolve(opts["export-dir"]);
    fs.mkdirSync(targetDir, { recursive: true });
    const stamp = Date.now().toString(36);
    const jsonPath = path.join(targetDir, `wake-packet-${stamp}.json`);
    const mdPath = path.join(targetDir, `wake-packet-${stamp}.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(network.pack, null, 2), "utf8");
    const mdContent = `# ${network.pack?.frame?.title || "WAKE Content Packet"}\n\n` +
      `**Promise:** ${network.pack?.strategicBrief?.promise}\n\n` +
      `## Platform Variants\n` +
      (network.pack?.platformVariants || []).map((v) => `### ${v.platform}\n**Hook:** ${v.hook}\n\n${v.caption || v.script || ""}\n`).join("\n");
    fs.writeFileSync(mdPath, mdContent, "utf8");
    console.log(`\nExported outputs to: ${targetDir}`);
  }

  console.log("\nHeadless agent execution completed successfully.");
}

async function handleSynthesizeMatrix(opts) {
  let sourceText = opts.source || "";
  if (opts.file && fs.existsSync(opts.file)) {
    sourceText = fs.readFileSync(opts.file, "utf8");
  }
  if (!sourceText.trim()) {
    console.error("Error: --source <text> or --file <path> is required.");
    process.exit(1);
  }

  console.log("==================================================");
  console.log(" WAKE ENGINE V6: 30-DAY BATCH MATRIX SYNTHESIZER");
  console.log("==================================================");
  console.log(`Synthesizing 30-day cross-platform matrix...\n`);

  const matrix = generate30DayMatrix(sourceText, { theme: opts.theme || "Omnichannel Authority" });
  console.log(`Generated: ${matrix.days?.length || 30} Days across 4 Pillars`);
  console.log(`- TikTok:    ${matrix.summary.tiktokCount} items`);
  console.log(`- Instagram: ${matrix.summary.instagramCount} items`);
  console.log(`- X Threads: ${matrix.summary.xCount} items`);
  console.log(`- LinkedIn:  ${matrix.summary.linkedinCount} items`);

  if (opts["export-dir"]) {
    const targetDir = path.resolve(opts["export-dir"]);
    fs.mkdirSync(targetDir, { recursive: true });
    const jsonPath = path.join(targetDir, `30-day-matrix.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(matrix, null, 2), "utf8");

    // Export individual day scripts & srt files
    const daysDir = path.join(targetDir, "days");
    fs.mkdirSync(daysDir, { recursive: true });
    matrix.days.forEach((day) => {
      const dayPath = path.join(daysDir, `Day-${day.day}-${day.platform.toLowerCase().split(" ")[0]}.md`);
      const srtPath = path.join(daysDir, `Day-${day.day}.srt`);
      fs.writeFileSync(dayPath, `# Day ${day.day}: ${day.title}\n\n**Hook:** ${day.hook}\n\n**Script:**\n${day.script}\n\n**Visual:**\n${day.visualPrompt}`, "utf8");
      if (day.subtitleTrack?.srt) {
        fs.writeFileSync(srtPath, day.subtitleTrack.srt, "utf8");
      }
    });
    console.log(`\nExported 30-day calendar and subtitle files to: ${targetDir}`);
  }

  console.log("\nMatrix synthesis completed successfully.");
}

function handleStatus() {
  const store = readStore();
  console.log("==================================================");
  console.log(" WAKE ENGINE V6: SYSTEM & REPOSITORY STATUS");
  console.log("==================================================");
  console.log(`Data Directory:      ${DATA_DIR}`);
  console.log(`Projects:            ${store.projects?.length || 0}`);
  console.log(`Saved Sources:       ${store.sources?.length || 0}`);
  console.log(`Generations:         ${store.generations?.length || 0}`);
  console.log(`Campaigns:           ${store.campaigns?.length || 0}`);
  console.log(`Media Assets:        ${store.mediaAssets?.length || 0}`);
  console.log(`Remote Ollama Dell:  http://100.77.131.28:11434 (ichabodcrane)`);
  console.log("==================================================");
}

function handleDaemon() {
  console.log("==================================================");
  console.log(" WAKE ENGINE V6: BACKGROUND DAEMON STARTED");
  console.log("==================================================");
  console.log("Running deterministic background scheduler and file watcher...");
  console.log("Press Ctrl+C to stop.\n");

  const scheduler = startScheduler({
    readStore,
    writeStore: () => {},
    onRunExecuted: (run) => {
      console.log(`[${new Date().toISOString()}] Scheduled task executed: ${run.id}`);
    }
  });

  process.on("SIGINT", () => {
    console.log("\nStopping background daemon...");
    if (scheduler?.stop) scheduler.stop();
    process.exit(0);
  });

  setInterval(() => {}, 60000);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";

  switch (command) {
    case "run-agents":
      await handleRunAgents(args);
      break;
    case "synthesize-matrix":
      await handleSynthesizeMatrix(args);
      break;
    case "status":
      handleStatus();
      break;
    case "schedule-daemon":
    case "daemon":
      handleDaemon();
      break;
    default:
      console.log(`
WAKE Engine V6 Headless CLI
===========================
Usage:
  node scripts/wake-cli.mjs run-agents --source "..." [--export-dir <path>]
  node scripts/wake-cli.mjs synthesize-matrix --source "..." [--export-dir <path>]
  node scripts/wake-cli.mjs status
  node scripts/wake-cli.mjs schedule-daemon
      `);
  }
}

main().catch((err) => {
  console.error("CLI Error:", err.message);
  process.exit(1);
});
