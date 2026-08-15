import React, { useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Database,
  Download,
  FileText,
  ImageIcon,
  Maximize2,
  Play,
  Sparkles,
  TerminalSquare,
  WandSparkles
} from "lucide-react";
import { Pill, Panel, PanelTitle, SpeechToTextButton } from "../common/UIPrimitives.jsx";
import { OutputStudio } from "../common/OutputStudio.jsx";
import { api } from "../../api.js";

export function AgentSourcePanel({
  source,
  sourceId,
  projectSources,
  busy,
  onSelectSource,
  onOpenConsole,
  onRunAgent
}) {
  const hasSource = Boolean(source?.trim());
  const selectedSource = projectSources.find((item) => item.id === sourceId);
  const currentTitle =
    selectedSource?.title?.replace(/^\[[^\]]+\]\s*/, "") ||
    (hasSource ? "Unsaved pasted source" : "No source selected");
  const preview = hasSource
    ? (selectedSource?.excerpt || source).slice(0, 340)
    : "Select a saved project source below or open Console to paste new source material. Agents will not run blind.";
  const visibleSources = projectSources.slice(0, 8);
  return (
    <Panel className={`agent-source-panel ${hasSource ? "source-ready" : "source-missing"}`}>
      <PanelTitle
        icon={Database}
        title="Agent Source"
        right={<Pill tone={hasSource ? "live" : "partial"}>{hasSource ? "source loaded" : "source required"}</Pill>}
      />
      <div className="agent-source-layout">
        <article className="agent-source-current">
          <small>Current source for every agent response</small>
          <h3>{currentTitle}</h3>
          <p>{preview}</p>
          <div className="agent-source-meta">
            <span>{hasSource ? `${source.trim().length.toLocaleString()} chars loaded` : "0 chars loaded"}</span>
            <span>{selectedSource?.lane || "Agent context"}</span>
            <span>{sourceId || "no saved source id"}</span>
          </div>
        </article>
        <div className="agent-source-picker">
          <div className="agent-source-picker-title">
            <small>Saved project sources</small>
            <strong>{projectSources.length} available</strong>
          </div>
          <div className="agent-source-list" aria-label="Saved sources for agents">
            {visibleSources.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === sourceId ? "selected" : ""}
                onClick={() => onSelectSource(item)}
              >
                <span>{item.lane || item.sourceType || "Source"}</span>
                <strong>{item.title.replace(/^\[[^\]]+\]\s*/, "")}</strong>
                <small>
                  {item.characterCount?.toLocaleString?.() || item.characterCount || 0} chars · load for agents
                </small>
              </button>
            ))}
            {!visibleSources.length ? (
              <div className="agent-source-empty">
                <FileText size={18} />
                <span>No saved sources in this project yet.</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="agent-source-actions">
        <button type="button" className="primary-action" disabled={busy || !hasSource} onClick={onRunAgent}>
          Run Tier Zero Agents
          <Play size={16} />
        </button>
        <button type="button" className="mini-action" onClick={onOpenConsole}>
          Open Console
          <TerminalSquare size={16} />
        </button>
      </div>
    </Panel>
  );
}

export function AgentsTab({
  source,
  sourceId,
  projectSources,
  busy,
  onSelectSource,
  onOpenConsole,
  onRunAgent,
  output,
  onCopyOutput,
  onExportOutput
}) {
  const [selectedStage, setSelectedStage] = useState("all");
  const [showPersonaInspector, setShowPersonaInspector] = useState(false);
  const [showVisionStudio, setShowVisionStudio] = useState(false);

  // Vision & Diffusion Studio State
  const [imagePrompt, setImagePrompt] = useState(
    "High-end minimalist editorial composition, clean lighting, tactile textures, professional photography, 8k resolution, no text."
  );
  const [platformRatio, setPlatformRatio] = useState("instagram");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedGallery, setGeneratedGallery] = useState([]);
  const [activeImage, setActiveImage] = useState(null);
  const [imageError, setImageError] = useState(null);

  const stages = [
    { id: "archivist", name: "Archivist", role: "Evidence Extraction & Source Citation", icon: Database, tone: "cyan", completed: Boolean(output?.evidenceMap || output?.evidence) },
    { id: "strategist", name: "Strategist", role: "Angle, Hooks & Positioning", icon: WandSparkles, tone: "amber", completed: Boolean(output?.strategicBrief || output?.hooks) },
    { id: "scriptwriter", name: "Scriptwriter", role: "Platform Scene Beats & Scripts", icon: FileText, tone: "emerald", completed: Boolean(output?.scripts || output?.platformVariants) },
    { id: "creative-director", name: "Creative Director", role: "Visual System & Shot Prompts", icon: WandSparkles, tone: "purple", completed: Boolean(output?.visualPrompts || output?.creativeDirection) },
    { id: "qa", name: "QA Gate", role: "Claim Verification & Compliance", icon: Clipboard, tone: "blue", completed: Boolean(output?.tierZeroQa || output?.qaVerdict) },
    { id: "export", name: "Export Manifest", role: "Asset Packaging & Delivery", icon: Download, tone: "rose", completed: Boolean(output?.exportManifest || output?.manifest) }
  ];

  const handleGenerateImage = async () => {
    if (!imagePrompt) return;
    setGeneratingImage(true);
    setImageError(null);
    try {
      const res = await api("/api/images/studio-generate", "POST", {
        prompt: imagePrompt,
        platform: platformRatio,
        projectId: "wake-v6-main"
      });
      if (res?.image) {
        setGeneratedGallery((prev) => [res.image, ...prev]);
        setActiveImage(res.image);
      } else {
        throw new Error(res?.error || "Image generation failed.");
      }
    } catch (err) {
      setImageError(err.message);
    } finally {
      setGeneratingImage(false);
    }
  };

  return (
    <>
      <AgentSourcePanel
        source={source}
        sourceId={sourceId}
        projectSources={projectSources}
        busy={busy}
        onSelectSource={onSelectSource}
        onOpenConsole={onOpenConsole}
        onRunAgent={onRunAgent}
      />

      <Panel className="agent-pipeline-dag">
        <PanelTitle
          icon={WandSparkles}
          title="Tier Zero Agent Orchestration Pipeline"
          right={
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="mini-action"
                style={{ fontSize: "12px", padding: "4px 8px" }}
                onClick={() => setShowVisionStudio(!showVisionStudio)}
              >
                <ImageIcon size={13} style={{ marginRight: "4px" }} />
                {showVisionStudio ? "Hide Vision Studio" : "AI Vision & Diffusion Studio"}
              </button>
              <button
                type="button"
                className="mini-action"
                style={{ fontSize: "12px", padding: "4px 8px" }}
                onClick={() => setShowPersonaInspector(!showPersonaInspector)}
              >
                {showPersonaInspector ? "Hide Persona Specs" : "Agent Personas & Prompts"}
              </button>
              <Pill tone={output ? "done" : busy ? "live" : "queued"}>
                {output ? "All 6 Stages Complete" : busy ? "Executing Network..." : "Ready to Execute"}
              </Pill>
            </div>
          }
        />

        <div className="agent-dag-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", margin: "14px 0" }}>
          {stages.map((st, idx) => {
            const Icon = st.icon;
            const isDone = st.completed;
            const isSelected = selectedStage === st.id;
            return (
              <div
                key={st.id}
                onClick={() => {
                  setSelectedStage(isSelected ? "all" : st.id);
                  if (st.id === "creative-director") setShowVisionStudio(true);
                }}
                style={{
                  background: isSelected ? "rgba(0, 240, 255, 0.12)" : isDone ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.02)",
                  border: `1px solid ${isSelected ? "var(--accent-primary, #00f0ff)" : isDone ? "rgba(0, 255, 180, 0.3)" : "rgba(255, 255, 255, 0.1)"}`,
                  borderRadius: "8px",
                  padding: "10px 12px",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", opacity: 0.6, fontWeight: 700 }}>STAGE 0{idx + 1}</span>
                  <Pill tone={isDone ? "done" : "queued"}>{isDone ? "Pass" : "Queued"}</Pill>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon size={16} />
                  <strong style={{ fontSize: "13px" }}>{st.name}</strong>
                </div>
                <p style={{ fontSize: "11px", opacity: 0.7, margin: "6px 0 0 0", lineHeight: 1.3 }}>{st.role}</p>
              </div>
            );
          })}
        </div>

        {/* AI Vision & Diffusion Studio Canvas */}
        {showVisionStudio && (
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: "1.25rem", border: "1px solid var(--border)", margin: "1rem 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ImageIcon size={18} color="var(--live)" />
                <h4 style={{ margin: 0 }}>Creative Director — AI Vision & Diffusion Studio</h4>
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Original Diffusion Inference (Flux / Local Diffusion)</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "1.25rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: "600", margin: 0 }}>
                    Visual Direction Prompt
                  </label>
                  <SpeechToTextButton
                    onTranscript={(text) => setImagePrompt((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
                    label="Dictate Prompt"
                  />
                </div>
                <textarea
                  rows={4}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  className="chat-input"
                  style={{ width: "100%", marginBottom: "1rem" }}
                  placeholder="Describe lighting, composition, mood, and focal subject..."
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", marginBottom: "0.4rem" }}>
                      Aspect Ratio & Target
                    </label>
                    <select
                      value={platformRatio}
                      onChange={(e) => setPlatformRatio(e.target.value)}
                      className="chat-input"
                      style={{ width: "100%" }}
                    >
                      <option value="tiktok">TikTok / Reels / Shorts (9:16 - 768x1344)</option>
                      <option value="instagram">Instagram Feed / Carousel (4:5 - 896x1120)</option>
                      <option value="x">X / YouTube / LinkedIn (16:9 - 1344x768)</option>
                      <option value="square">Square Editorial (1:1 - 1024x1024)</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button
                      className="primary-action"
                      type="button"
                      disabled={generatingImage || !imagePrompt}
                      onClick={handleGenerateImage}
                      style={{ width: "100%", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                      <Sparkles size={16} /> {generatingImage ? "Generating Visual..." : "Generate Original Visual"}
                    </button>
                  </div>
                </div>

                {imageError && (
                  <div style={{ padding: "0.5rem 0.75rem", background: "rgba(229, 62, 62, 0.15)", border: "1px solid #e53e3e", borderRadius: "4px", color: "#ff6b6b", fontSize: "0.85rem" }}>
                    {imageError}
                  </div>
                )}
              </div>

              {/* Live Preview Canvas */}
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--background)", padding: "0.75rem", minHeight: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                {activeImage ? (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <img
                      src={activeImage.url || activeImage.relativePath}
                      alt={activeImage.prompt}
                      style={{ maxHeight: "200px", maxWidth: "100%", borderRadius: "4px", objectFit: "contain", border: "1px solid var(--border)" }}
                    />
                    <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", width: "100%" }}>
                      <span>{activeImage.width}x{activeImage.height} ({activeImage.aspectRatio})</span>
                      <span>SHA: {activeImage.sha256?.slice(0, 8)}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center" }}>
                    <ImageIcon size={32} style={{ opacity: 0.3, marginBottom: "6px" }} />
                    <p style={{ margin: 0 }}>Generated image preview will appear here.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Gallery of Variants */}
            {generatedGallery.length > 0 && (
              <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                <small style={{ display: "block", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
                  GENERATED VARIANTS ({generatedGallery.length})
                </small>
                <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
                  {generatedGallery.map((img) => (
                    <img
                      key={img.id}
                      src={img.url || img.relativePath}
                      alt={img.prompt}
                      onClick={() => setActiveImage(img)}
                      style={{
                        height: "60px",
                        width: "60px",
                        objectFit: "cover",
                        borderRadius: "4px",
                        border: activeImage?.id === img.id ? "2px solid var(--live)" : "1px solid var(--border)",
                        cursor: "pointer"
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {showPersonaInspector && (
          <div style={{ background: "rgba(0, 0, 0, 0.4)", borderRadius: "8px", padding: "12px", border: "1px solid rgba(255, 255, 255, 0.1)", fontSize: "12px" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#00f0ff" }}>Tier Zero Agent Persona Specifications</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
              <div>
                <strong>Archivist (Temp: 0.1)</strong>
                <p style={{ margin: "4px 0", opacity: 0.8 }}>Strictly verbatim evidence extraction. Zero hallucination tolerance. Extracts verbatim quotes with line numbers.</p>
              </div>
              <div>
                <strong>Strategist (Temp: 0.3)</strong>
                <p style={{ margin: "4px 0", opacity: 0.8 }}>Derives core promise, transformation tension, 4 platform angles, and 8 high-conversion hooks from confirmed evidence.</p>
              </div>
              <div>
                <strong>Scriptwriter (Temp: 0.4)</strong>
                <p style={{ margin: "4px 0", opacity: 0.8 }}>Generates timed scene beats (0-3s Hook, 3-15s Proof, 15-45s Value, 45-60s CTA) with platform-native formatting.</p>
              </div>
              <div>
                <strong>Creative Director (Temp: 0.4)</strong>
                <p style={{ margin: "4px 0", opacity: 0.8 }}>Defines visual style, camera framing, lighting, typography, and original diffusion prompts for image generation.</p>
              </div>
              <div>
                <strong>QA Gate (Deterministic)</strong>
                <p style={{ margin: "4px 0", opacity: 0.8 }}>Verifies 100% of generated claims against source text citations. Blocks unverified claims from export.</p>
              </div>
              <div>
                <strong>Export Manifest (Deterministic)</strong>
                <p style={{ margin: "4px 0", opacity: 0.8 }}>Packages multi-format outputs into durable markdown, structured JSON, and image manifest with SHA-256 receipts.</p>
              </div>
            </div>
          </div>
        )}
      </Panel>

      {output && (
        <Panel className="agent-output-panel">
          <PanelTitle
            icon={WandSparkles}
            title="Created Content"
            right={
              <div className="inline-actions">
                <button type="button" className="mini-action" onClick={onCopyOutput}>
                  <Clipboard size={16} /> Copy
                </button>
                <button type="button" className="mini-action" onClick={onExportOutput}>
                  <Download size={16} /> Export
                </button>
              </div>
            }
          />
          <OutputStudio output={output} />
        </Panel>
      )}
    </>
  );
}
