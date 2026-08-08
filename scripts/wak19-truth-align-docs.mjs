import fs from "node:fs";

const edits = {
  "README.md": [
    ["6. Place scheduled output into human review or export Markdown and JSON.", "6. Place scheduled output into a pending review queue or, when configured for Auto Export and QA passes, write Markdown and JSON."],
    ["| Human review | Stores completed scheduled packets in a review queue | Automations page |", "| Review queue | Stores Review Required packets as a pending review item and exposes the generated packet for inspection; it does not yet persist approve/reject decisions | Automations page + hostile UI audit |"],
    ["- Human review remains the recommended approval mode for externally published content.", "- Review Required creates a pending review item for inspection; the current queue does not yet persist approve/reject/return/approve-and-export decisions."],
    ["6. Send the packet to review.\n7. Export Markdown and JSON.\n8. Inspect the audit receipt.", "6. Send a scheduled packet to Review Required and open the pending review item.\n7. Use a separate QA-passing Auto Export automation to produce and open Markdown and JSON.\n8. Inspect the audit receipt."]
  ],
  "SUBMISSION.md": [
    ["6. places completed packets into human review or exports Markdown and JSON;", "6. places completed packets into a pending review queue or, as a separate Auto Export disposition, writes Markdown and JSON after QA passes;"],
    ["`Source intake → Archivist → Strategist → Scriptwriter → Creative Director → QA → Review/Export`", "`Source intake → Archivist → Strategist → Scriptwriter → Creative Director → QA → Pending Review Queue / Auto Export`"],
    ["7. Send the packet to Review Required.\n8. Export Markdown and JSON.", "7. Send a scheduled packet to Review Required and inspect the pending review item and generated packet.\n8. Use a separate Auto Export automation with a QA-passing packet to produce Markdown and JSON."],
    ["- Human review remains recommended before external publication.", "- Review Required creates a pending review queue item for inspection; persisted approve/reject/return/approve-and-export decisions are not implemented yet."],
    ["Lead with the completed user job: private local source becomes an evidence-linked, reviewed, exportable content package with measurable receipts.", "Lead with the completed user job: private local source becomes an evidence-linked packet that can be inspected in a pending review queue or automatically exported as Markdown and JSON, with measurable receipts."],
    ["Lead with local ownership, loopback execution, optional local models, inspectable provenance, credential isolation, human approval, and reduced dependency on centralized cloud generation.", "Lead with local ownership, loopback execution, optional local models, inspectable provenance, credential isolation, a human review queue with explicit operator authority, and reduced dependency on centralized cloud generation."]
  ],
  "DEMO_SCRIPT.md": [
    ["## 1:13–1:33 — Human review and export", "## 1:13–1:33 — Review queue and export dispositions"],
    ["- Send the packet to Review Required.\n- Open the review item.\n- Export the approved packet.\n- Open the generated Markdown and JSON files.", "- Send a scheduled packet to Review Required.\n- Open the pending review item and inspect the generated packet.\n- Run a separate QA-passing automation in Auto Export mode.\n- Open the generated Markdown and JSON files."],
    ["> WAKE keeps a human in control and exports both a readable handoff and a complete machine-readable packet.", "> WAKE can hold a packet as a pending review item for human inspection, or use the separate QA-gated Auto Export disposition to write a readable Markdown handoff and complete machine-readable JSON packet."],
    ["> WAKE is a local-first, crash-resilient content workbench with evidence-linked claims, human review, durable state, and a verifiable Windows installer.", "> WAKE is a local-first, crash-resilient content workbench with evidence-linked claims, a pending human review queue, durable state, and a verifiable Windows installer."]
  ],
  "ARCHITECTURE.md": [
    ["WAKE Engine is a local-first Windows desktop workbench for transforming operator-approved source material into evidence-linked content packages with human review, durable state, and inspectable receipts.", "WAKE Engine is a local-first Windows desktop workbench for transforming operator-approved source material into evidence-linked content packages with a pending human review queue, QA-gated automatic export, durable state, and inspectable receipts."],
    ["    Q -->|pass| H[Human Review]\n    Q -->|blocked| F[Repair Guidance]\n    H --> O[Markdown + JSON Export]", "    Q -->|pass| D{Disposition}\n    Q -->|blocked| F[Repair Guidance]\n    D -->|Review Required| H[Pending Review Queue]\n    D -->|Auto Export| O[Markdown + JSON Export]"],
    ["- handles source intake, runtime execution, state, review, export, and audit operations;", "- handles source intake, runtime execution, state, review-queue state, export, and audit operations;"],
    ["Generated material is not automatically equivalent to approved content. QA controls publishability, and human review remains the recommended final authority.", "Generated material is not automatically equivalent to approved content. QA controls automatic-export eligibility. Review Required creates a Pending Review Queue item for human inspection; current V6 does not persist approve/reject/return/approve-and-export decisions in that queue." ]
  ],
  "docs/wake-engine/wake_engine_manual.md": [
    ["5. Finished work: review, export, and save an **Audit** snapshot.", "5. Finished work: inspect or queue the packet for review, use the appropriate export path, and save an **Audit** snapshot."],
    ["- Promote an approved result into the saved project workflow.", "- Promote a result you have personally approved into the saved project workflow."],
    ["- Export only after the packet passes review.", "- Export only after QA passes and you have personally inspected the packet."],
    ["The completed packet is placed into the review queue. This is the recommended mode for content intended for external publication.", "The completed packet is placed into a pending review queue. The current queue is inspection-only: you can open the generated packet, but it does not currently persist approve/reject/return/approve-and-export decisions. This is the recommended holding path for content that still needs human review before external publication."],
    ["6. Review the final packet in Cluster.\n7. Export Markdown and JSON.", "6. Inspect the final packet in Cluster yourself and confirm QA has passed.\n7. Export Markdown and JSON when you choose to proceed, or use Review Required to hold scheduled output as a pending review item."],
    ["- Human review is recommended before public distribution.", "- Human review is recommended before public distribution; the current Review Required queue is inspection-only and does not currently persist approve/reject/return/approve-and-export decisions."]
  ],
  "JUDGING_EVIDENCE.md": [
    ["| Scheduler parses cron, reuses manual records, skips unchanged source, exports packets, and records failures | `npm run audit:scheduler` | `scripts/scheduler-audit.mjs` and CI logs |", "| Scheduler parses cron, reuses manual records, skips unchanged source, exports packets, and records failures | `npm run audit:scheduler` | `scripts/scheduler-audit.mjs` and CI logs |\n| Review Required creates a pending review item and exposes the generated packet for inspection | `npm run audit:ui` | `scripts/route-ui-audit.mjs` and Windows CI logs |\n| Auto Export writes two real files after a QA-passing scheduled run | `npm run audit:ui` and `npm run audit:scheduler` | Electron hostile workflow plus scheduler audit |"],
    ["- A feature shown in UI text is not treated as implemented unless executable behavior or code supports it.", "- A feature shown in UI text is not treated as implemented unless executable behavior or code supports it.\n- A pending review item is not evidence of a persisted approve/reject decision; those controls are not current V6 functionality."]
  ],
  "KNOWN_LIMITATIONS.md": [
    ["- Human review is recommended before external publication.", "- Human review is recommended before external publication. The current review queue is inspection-only: it exposes the generated packet but does not persist approve/reject/return/approve-and-export decisions."],
    ["- unattended external publication without human authority.", "- unattended external publication without human authority;\n- persisted approve/reject/return/approve-and-export review decisions (planned Review workspace functionality)."]
  ]
};

for (const [file, replacements] of Object.entries(edits)) {
  let source = fs.readFileSync(file, "utf8");
  for (const [before, after] of replacements) {
    const first = source.indexOf(before);
    if (first < 0) throw new Error(`${file}: target not found: ${before.slice(0, 80)}`);
    if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${file}: target not unique: ${before.slice(0, 80)}`);
    source = source.slice(0, first) + after + source.slice(first + before.length);
  }
  fs.writeFileSync(file, source, "utf8");
  console.log(`truth-aligned ${file}`);
}
