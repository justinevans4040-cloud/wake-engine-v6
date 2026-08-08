import fs from "node:fs";

const file = "server/index.js";
let source = fs.readFileSync(file, "utf8");

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: target not found`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: target is not unique`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "instructions Ollama prompt",
  '      const prompt = `You are the WAKE Engine Operations Guide. The user says: "${message}"\\nProvide a clear, step-by-step manual workflow using ONLY the existing WAKE Engine pipeline (Inbox -> Archivist -> Strategist -> Scriptwriter -> Creative Director -> QA -> Export). Tell them exactly what to click or type. Do not invent features. Format as markdown.`;',
  '      const prompt = `You are the WAKE Engine Operations Guide. The user says: "${message}"\\nProvide a clear step-by-step workflow using ONLY capabilities that exist in the current WAKE Engine V6 desktop app. User-facing surfaces are Console, Agents, Cluster, Vault, Library, Instructions, Automations, Monitor, and Audit. Internal stages are Archivist, Strategist, Scriptwriter, Creative Director, QA, and Export; never present an internal stage as a clickable page. If the requested capability is not implemented, say so explicitly and give the closest supported workflow. Do not invent buttons, pages, publishing integrations, or file support. Format as markdown.`;'
);

const oldFallback = `    // Fallback static runbook
    const staticRunbook = \`# Manual Runbook for: \${message}\n\nHere is how to run this end-to-end using the WAKE Engine manual pipeline:\n\n1. **Inbox**: Drop your approved source materials into the Inbox.\n2. **Archivist**: Run the Archivist to extract the evidence map and citation list.\n3. **Strategist**: Run the Strategist to set your audience, promise, and call to action.\n4. **Scriptwriter & Creative Director**: Run the content agents to produce your scripts, hooks, and visual prompts.\n5. **QA**: Run QA to verify all claims are backed by your source evidence.\n6. **Export**: Export the final approved packet to your local directory.\`;
    res.json({ ok: true, instructions: staticRunbook, generated: false });`;

const newFallback = `    const request = String(message).trim();
    const lower = request.toLowerCase();
    let steps;
    if (/runtime|health|cpu|memory|ram|status|monitor|telemetry/.test(lower)) {
      steps = [
        "Open **Monitor** from the WAKE navigation.",
        "Inspect the runtime truth labels, current tasks, CPU/RAM/system state, and any visible blockers.",
        "Open **Audit** when you need a durable snapshot or recovery evidence for the current state.",
        "Use **Console** only if the runtime finding requires new source-backed work; Monitor itself is the inspection surface."
      ];
    } else if (/schedule|automation|recurring|cron|run now/.test(lower)) {
      steps = [
        "Open **Automations** and choose **New Automation**.",
        "Set the source directory, five-field cron schedule, timezone, operator ask, approval mode, and export directory.",
        "Save the automation, then use **Resume/Pause** or **Run Now** as needed.",
        "Use **Review Queue** for Review Required runs and **Run History** to inspect completed, skipped, or failed executions."
      ];
    } else if (/import|folder|vault|source|document|file/.test(lower)) {
      steps = [
        "Open **Vault** to review or import an approved local folder, or use **Console** to paste source text directly.",
        "Review candidates before import when scanning a drive or folder.",
        "Load the selected source, then open **Agents** to run the Tier Zero content workflow.",
        "Inspect the resulting evidence and QA before exporting."
      ];
    } else if (/publish|post to|social network|instagram api|tiktok api|linkedin api/.test(lower)) {
      steps = [
        "WAKE V6 does **not** currently publish directly to social networks.",
        "Build and QA the content in **Console / Agents / Cluster**.",
        "Export the approved local output.",
        "Publish the exported material manually in the destination platform."
      ];
    } else {
      steps = [
        "Start in **Console** with pasted approved source, or use **Vault** to import approved local source files.",
        "Use **Agents** to run the Tier Zero pipeline: Archivist → Strategist → Scriptwriter → Creative Director → QA → Export.",
        "Inspect evidence, claim support, and QA results; use **Cluster** to review the completed content packet and output lanes.",
        "Export only after QA permits it, then use **Library** to find saved work and **Audit** for a durable snapshot when needed."
      ];
    }
    const staticRunbook = [\`# WAKE V6 Runbook: \${request}\`, "", ...steps.map((step, index) => \`\${index + 1}. \${step}\`)].join("\\n");
    res.json({ ok: true, instructions: staticRunbook, generated: false });`;

replaceOnce("instructions deterministic fallback", oldFallback, newFallback);

fs.writeFileSync(file, source, "utf8");
console.log("WAK-7 claim repair applied to server/index.js");
