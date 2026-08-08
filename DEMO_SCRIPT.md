# WAKE Engine V6 — Two-Minute Demonstration Script

## Goal

Prove one complete usefulness claim: WAKE turns approved local source material into a source-backed content package, blocks unsupported wording, preserves receipts, and exports reviewable artifacts.

## Recording requirements

- Record the full desktop, not cropped UI fragments.
- Show the repository or release version at the beginning.
- Use `examples/proof-of-usefulness-source.md` as the source.
- Do not use private manuscripts, credentials, client material, or personal paths.
- Keep the mouse visible and avoid jump cuts during the core workflow.
- End on the exported Markdown, exported JSON, and audit receipt.

## 0:00–0:12 — State the problem

Narration:

> Creators and small teams have valuable notes and briefs, but generic AI tools can lose source provenance, invent claims, require cloud uploads, and provide no durable audit trail. WAKE Engine keeps the workflow local and makes every publishable claim inspectable.

Show:

- WAKE Engine title screen or Console.
- Version or release identifier.

## 0:12–0:28 — Load approved source

Show:

- Open `examples/proof-of-usefulness-source.md`.
- Paste it into Console or select its folder through Vault.
- Save the source.

Narration:

> This is an ordinary local business brief with explicit facts, audience, offer, and restrictions.

## 0:28–0:53 — Run the workflow

Show:

- Start the deterministic content workflow.
- Open the agent trace or output packet.
- Briefly show Archivist, Strategist, Scriptwriter, Creative Director, QA, and Export stages.

Narration:

> WAKE extracts evidence, builds strategy and platform content, maps claims back to the source, and records tool calls and agent handoffs.

## 0:53–1:13 — Prove evidence and QA

Show:

- Evidence map.
- Citation map.
- Claim map.
- QA verdict and any blocked or non-publishable item available in the current packet.

Narration:

> The important part is not the number of agents. The important part is that the output carries evidence and the QA gate prevents unsupported wording from being treated as publishable.

Do not claim a blocked item exists unless it is visibly present. If the sample produces no blocked claim, show the zero-unsupported count and then show the scheduler audit that explicitly tests QA export blocking.

## 1:13–1:33 — Review queue and export dispositions

Show:

- Send a scheduled packet to Review Required.
- Open the pending review item and inspect the generated packet.
- Run a separate QA-passing automation in Auto Export mode.
- Open the generated Markdown and JSON files.

Narration:

> WAKE can hold a packet as a pending review item for human inspection, or use the separate QA-gated Auto Export disposition to write a readable Markdown handoff and complete machine-readable JSON packet.

## 1:33–1:47 — Duplicate suppression

Show:

- Run the same unchanged source again.
- Show the skipped or unchanged-source history record.

Narration:

> Re-running an unchanged source does not create a duplicate campaign. WAKE hashes the source and records the skip.

## 1:47–2:00 — Durability and close

Show:

- Monitor or Audit.
- A snapshot, WAL, recovery receipt, or test verdict.
- GitHub Actions status and installer checksum.

Narration:

> WAKE is a local-first, crash-resilient content workbench with evidence-linked claims, a pending human review queue, durable state, and a verifiable Windows installer.

Final frame:

- `github.com/justinevans4040-cloud/wake-engine-v6`
- “Built by Justin Evans — ForgeFront Systems”

## Claims allowed in the video

- local-first Windows desktop workflow;
- deterministic and auditable six-stage content pipeline;
- evidence and citation maps;
- unsupported-claim blocking at QA;
- human review queue;
- Markdown and JSON export;
- duplicate suppression for unchanged scheduled source;
- atomic storage, WAL, recovery, and audit evidence for documented cases;
- optional Ollama enhancement.

## Claims prohibited in the video

- six independent AI models are reasoning autonomously;
- zero chance of data loss;
- fully offline installation;
- automatic social publishing;
- scheduler uses Ollama;
- military-grade, unhackable, or impossible to copy;
- any benchmark or user count that is not shown by evidence.
