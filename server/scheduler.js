import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { runTierZeroNetwork } from "./tier-zero-runtime.js";

// Helper: Get current time parts in a specific timezone
function getTimeZoneParts(timeZone) {
  const now = new Date();
  const d = new Date(now.toLocaleString("en-US", { timeZone }));
  return {
    minute: d.getMinutes(),
    hour: d.getHours(),
    date: d.getDate(),
    month: d.getMonth() + 1, // 1-12
    day: d.getDay() // 0-6 (Sunday is 0)
  };
}

// Helper: Check if current time matches a cron expression (basic support)
function isCronMatch(cronStr, parts) {
  try {
    const tokens = cronStr.trim().split(/\s+/);
    if (tokens.length !== 5) return false;
    const [min, hr, dom, mon, dow] = tokens;
    const match = (val, part) => {
      if (val === "*") return true;
      if (val.includes(",")) return val.split(",").map(Number).includes(part);
      if (val.includes("/")) {
        const [, step] = val.split("/");
        return part % Number(step) === 0;
      }
      return Number(val) === part;
    };
    return match(min, parts.minute) && match(hr, parts.hour) && match(dom, parts.date) && match(mon, parts.month) && match(dow, parts.day);
  } catch (err) {
    console.error("Cron parse error:", err);
    return false;
  }
}

function computeHash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function loadSourceFolder(dirPath) {
  let combined = "";
  try {
    if (!fs.existsSync(dirPath)) return null;
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file.endsWith(".txt") || file.endsWith(".md") || file.endsWith(".json")) {
        const content = fs.readFileSync(path.join(dirPath, file), "utf8");
        combined += `\n--- File: ${file} ---\n${content}\n`;
      }
    }
  } catch (err) {
    console.error(`Failed to load source folder: ${dirPath}`, err);
    return null;
  }
  return combined.trim();
}

export function startScheduler(storeRef, updateStore, ollamaStatusFn) {
  let isRunning = false;
  console.log("WAKE Engine Background Scheduler starting...");

  setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const store = storeRef();
      const automations = store.automations || [];
      const nowMs = Date.now();
      let changed = false;

      for (const automation of automations) {
        if (!automation.enabled && !automation.forceRun) continue;

        const isForced = !!automation.forceRun;

        // Skip if it ran within the last hour to prevent double triggers
        const lastRun = store.automationRuns?.find(r => r.automationId === automation.id);
        if (!isForced && lastRun && (nowMs - new Date(lastRun.createdAt).getTime()) < 3600000) {
          continue;
        }

        let tzParts;
        try {
          tzParts = getTimeZoneParts(automation.timeZone || "UTC");
        } catch (err) {
          console.error(`Invalid timezone for ${automation.name}: ${automation.timeZone}`);
          continue;
        }

        if (isForced || isCronMatch(automation.scheduleCron, tzParts)) {
          // Trigger the automation
          console.log(`Triggering automation: ${automation.name}${isForced ? " (FORCED)" : ""}`);
          
          if (isForced) {
             automation.forceRun = false;
             changed = true;
          }

          const sourceText = loadSourceFolder(automation.sourceDir);
          if (!sourceText) {
            console.log(`Source folder empty or missing: ${automation.sourceDir}`);
            continue;
          }

          const currentHash = computeHash(sourceText);
          if (lastRun && lastRun.sourceHash === currentHash && !isForced) {
            console.log(`Source unchanged for ${automation.name}. Skipping.`);
            continue;
          }

          const runRecord = {
            id: `run-${Date.now()}`,
            automationId: automation.id,
            status: "queued",
            sourceHash: currentHash,
            createdAt: new Date().toISOString()
          };
          
          store.automationRuns = store.automationRuns || [];
          store.automationRuns.unshift(runRecord);
          changed = true;
          updateStore(store);

          // Execute pipeline
          try {
            runRecord.status = "running-pipeline";
            updateStore(store);

            // Fetch live LLM status from the provided function
            const llmStatus = await ollamaStatusFn();

            // Setup custom context to override strategist prompt
            const retrievalContext = {
               baseAsk: automation.operatorAsk
            };

            let lastUpdate = Date.now();
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
               timeoutId = setTimeout(() => reject(new Error("LLM Execution Timeout (20 mins)")), 1200000);
            });
            
            const executionPromise = runTierZeroNetwork({
              source: sourceText,
              basePack: {},
              retrievalContext,
              llmStatus,
              onProgress: (step) => {
                 runRecord.status = step;
                 if (Date.now() - lastUpdate > 2000) {
                    updateStore(store);
                    lastUpdate = Date.now();
                 }
              }
            });

            const result = await Promise.race([executionPromise, timeoutPromise]);
            clearTimeout(timeoutId);

            runRecord.status = "completed";
            runRecord.completedAt = new Date().toISOString();
            
            // Handle output disposition
            if (automation.approvalMode === "Review Required") {
              store.reviewQueue = store.reviewQueue || [];
              store.reviewQueue.unshift({
                id: `review-${Date.now()}`,
                automationId: automation.id,
                runId: runRecord.id,
                result,
                status: "pending",
                createdAt: new Date().toISOString()
              });
            } else {
              // Auto Export (if we supported it completely)
              try {
                if (!fs.existsSync(automation.exportDir)) fs.mkdirSync(automation.exportDir, { recursive: true });
                fs.writeFileSync(path.join(automation.exportDir, `export-${runRecord.id}.md`), result.finalOutput || result.raw, "utf8");
              } catch (fsErr) {
                console.error(`Export failed for ${automation.name}`, fsErr);
                throw new Error("Filesystem export failed");
              }
            }
            
            // Add to history
            store.history.unshift({
              id: `hist-${Date.now()}`,
              type: "AUTOMATION_COMPLETE",
              detail: `Automation ${automation.name} finished successfully.`,
              createdAt: new Date().toISOString()
            });

          } catch (err) {
            console.error(`Automation failed: ${err.message}`);
            runRecord.status = "failed";
            runRecord.error = err.message;
            store.history.unshift({
              id: `hist-${Date.now()}`,
              type: "AUTOMATION_FAILED",
              detail: `Automation ${automation.name} failed: ${err.message}`,
              createdAt: new Date().toISOString()
            });
          }
          changed = true;
        }
      }

      if (changed) {
        updateStore(store);
      }

    } catch (e) {
      console.error("Scheduler error:", e);
    } finally {
      isRunning = false;
    }
  }, 60000); // Check every minute
}
