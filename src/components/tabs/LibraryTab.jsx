import React from "react";
import { Archive, Box, Download, ListChecks } from "lucide-react";
import { Panel, PanelTitle } from "../common/UIPrimitives.jsx";

export function LibraryTab({
  projectSources,
  openSourceDocument,
  projectGenerations,
  loadGeneration,
  projectExports,
  setModal,
  projectHistory
}) {
  return (
    <div className="lower-grid library-grid">
      <Panel>
        <PanelTitle icon={Archive} title="Saved Sources" />
        <div className="library-list">
          {projectSources.map((item) => (
            <button key={item.id} type="button" onClick={() => openSourceDocument(item)}>
              <strong>{item.title.replace(/^\[[^\]]+\]\s*/, "")}</strong>
              <small>
                {item.characterCount} chars · {new Date(item.createdAt).toLocaleString()}
              </small>
            </button>
          ))}
        </div>
      </Panel>
      <Panel>
        <PanelTitle icon={Box} title="Generated Outputs" />
        <div className="library-list">
          {projectGenerations.map((item) => (
            <button key={item.id} type="button" onClick={() => loadGeneration(item)}>
              <strong>{item.title}</strong>
              <small>
                {item.kind} · {new Date(item.createdAt).toLocaleString()}
              </small>
            </button>
          ))}
        </div>
      </Panel>
      <Panel>
        <PanelTitle icon={Download} title="Exports" />
        <div className="library-list">
          {projectExports.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                setModal({
                  title: item.title,
                  body: [
                    `Markdown: ${item.relativeMdPath}`,
                    `JSON: ${item.relativeJsonPath}`,
                    `Inspection: ${item.inspection?.ok ? "passed" : "blocked"}`,
                    item.inspection?.missing?.length
                      ? `Missing: ${item.inspection.missing.join(", ")}`
                      : "Missing: none"
                  ].join("\n")
                })
              }
            >
              <strong>{item.title}</strong>
              <small>
                {item.inspection?.ok ? "inspected" : "needs review"} · {item.relativeMdPath}
              </small>
            </button>
          ))}
        </div>
      </Panel>
      <Panel>
        <PanelTitle icon={ListChecks} title="History" />
        <div className="library-list">
          {projectHistory.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setModal({ title: item.type, body: item.detail })}
            >
              <strong>{item.detail}</strong>
              <small>{new Date(item.createdAt).toLocaleString()}</small>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
