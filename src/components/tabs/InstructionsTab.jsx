import React from "react";
import { BookOpen } from "lucide-react";
import { Panel, PanelTitle, SpeechToTextButton } from "../common/UIPrimitives.jsx";

export function InstructionsTab({
  instructionsQuery,
  setInstructionsQuery,
  instructionsBusy,
  fetchInstructions,
  instructionsResult
}) {
  const handleTranscript = (text) => {
    setInstructionsQuery((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  };

  return (
    <Panel>
      <PanelTitle icon={BookOpen} title="Operations Guide" />
      <div
        className="instructions-container"
        style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ margin: 0 }}>Describe your goal to receive a step-by-step WAKE Engine manual workflow.</p>
          <SpeechToTextButton onTranscript={handleTranscript} label="Speak Goal" />
        </div>
        <textarea
          className="chat-input"
          placeholder="What do you want to do simply?"
          value={instructionsQuery}
          onChange={(e) => setInstructionsQuery(e.target.value)}
          disabled={instructionsBusy}
          rows={3}
          style={{ resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="primary-action"
            disabled={instructionsBusy || !instructionsQuery.trim()}
            onClick={fetchInstructions}
            style={{ alignSelf: "flex-start" }}
          >
            {instructionsBusy ? "Generating..." : "Get Instructions"}
          </button>
          <SpeechToTextButton onTranscript={handleTranscript} label="Voice Input" />
        </div>
        {instructionsResult && (
          <div
            className="instructions-result"
            style={{
              marginTop: "1rem",
              padding: "1rem",
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)"
            }}
          >
            <pre
              className="document-content"
              style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
            >
              {instructionsResult}
            </pre>
          </div>
        )}
      </div>
    </Panel>
  );
}
