import React from "react";
import {
  Activity,
  Archive,
  Clipboard,
  Download,
  HardDrive,
  Heart,
  Images,
  MessageCircle,
  Repeat2,
  RotateCcw,
  Save,
  Send,
  Share2,
  Sparkles,
  Zap
} from "lucide-react";
import { Pill, SpeechToTextButton, jsonBlock } from "../common/UIPrimitives.jsx";
import { ExportPreviewPanel, PlatformPreview } from "../common/AbilityScaffold.jsx";
import { WakeDarkMatterCore } from "./CoreTab.jsx";

const campaignPlatforms = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" }
];

export function CampaignAutopilot({
  projectName,
  projectSourceCount,
  direction,
  setDirection,
  campaign,
  selectedPlatform,
  setSelectedPlatform,
  busy,
  imageBusy,
  imageGeneration,
  onCreate,
  onGenerateImage,
  onSaveImageToSource,
  onExport,
  onOpenImageSetup,
  source,
  setSource,
  onSaveSource
}) {
  const platform = campaign?.platforms?.[selectedPlatform];
  const canCreate = projectSourceCount > 0 || direction.trim().length >= 40 || source.trim().length >= 40;
  return (
    <section className="campaign-autopilot">
      <div className="autopilot-command">
        <div className="autopilot-heading">
          <div>
            <small>Campaign Autopilot</small>
            <h2>{projectName || "Current Project"}</h2>
          </div>
          <div className="autopilot-readiness">
            <Pill tone={projectSourceCount ? "live" : "partial"}>{projectSourceCount} sources</Pill>
            <Pill tone={imageGeneration?.configured ? "live" : "partial"}>
              {imageGeneration?.configured
                ? "image engine ready"
                : imageGeneration?.consentRequired
                ? "images need approval"
                : "image engine offline"}
            </Pill>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <small style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Campaign Direction & Goal Prompt</small>
          <SpeechToTextButton
            onTranscript={(text) => setDirection((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
            label="Speak Direction"
          />
        </div>
        <div className="autopilot-input-row">
          <textarea
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            aria-label="Optional campaign direction"
            placeholder="Optional direction, idea, launch, offer, or constraint..."
          />
          <button type="button" className="autopilot-create" disabled={busy || !canCreate} onClick={onCreate}>
            {busy ? <Activity size={21} /> : <Sparkles size={21} />}
            <span>{busy ? "Creating Campaign" : "Create Campaign"}</span>
            <small>{direction.trim() ? "Use direction + project memory" : "Use project memory"}</small>
          </button>
        </div>
        <div className={`autopilot-progress ${busy ? "working" : ""}`} aria-live="polite">
          {["Research", "Write", "Design", "QA"].map((step) => (
            <span key={step}>
              <i />
              {step}
            </span>
          ))}
        </div>
      </div>

      {campaign ? (
        <div className="campaign-review">
          <header className="campaign-review-header">
            <div>
              <small>Campaign ready</small>
              <h2>{campaign.title}</h2>
              <p>{campaign.campaignPacket?.promise}</p>
            </div>
            <div className="campaign-header-actions">
              <Pill tone={campaign.qaVerdict?.passed || campaign.qaVerdict?.score?.passed ? "live" : "partial"}>
                QA {campaign.qaVerdict?.passed || campaign.qaVerdict?.score?.passed ? "passed" : "review"}
              </Pill>
              <button type="button" className="mini-action" onClick={onExport}>
                <Download size={16} /> Export
              </button>
            </div>
          </header>
          <div className="platform-switcher" role="tablist" aria-label="Platform preview">
            {campaignPlatforms.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selectedPlatform === item.id}
                className={selectedPlatform === item.id ? "selected" : ""}
                onClick={() => setSelectedPlatform(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="campaign-preview-layout">
            <div className="preview-stage">
              <PlatformPreview platform={platform} />
            </div>
            <aside className="campaign-copy-panel">
              <div>
                <small>Hook</small>
                <strong>{platform?.hook}</strong>
              </div>
              <div>
                <small>Caption</small>
                <p>{platform?.caption}</p>
              </div>
              {platform?.script?.length ? (
                <div>
                  <small>Script</small>
                  <ol>
                    {platform.script.slice(0, 6).map((beat, index) => (
                      <li key={`${beat.time || beat.beat}-${index}`}>
                        <span>{beat.time || beat.beat || `Beat ${index + 1}`}</span>
                        {beat.line}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div>
                <small>Call to action</small>
                <p>{platform?.cta}</p>
              </div>
              <div className="autopilot-next-step">
                <small>Next step</small>
                <p>{campaign.nextAction}</p>
              </div>
              <div className="campaign-copy-actions">
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard?.writeText(
                      [platform?.hook, platform?.caption, platform?.cta].filter(Boolean).join("\n\n")
                    )
                  }
                >
                  <Clipboard size={16} /> Copy
                </button>
                <button
                  type="button"
                  disabled={imageBusy || !imageGeneration?.configured}
                  onClick={onGenerateImage}
                >
                  <Images size={16} /> {imageBusy ? "Generating" : platform?.image ? "New Image" : "Generate Image"}
                </button>
                {platform?.image ? (
                  <button
                    type="button"
                    className="save-image-source-action"
                    onClick={() => onSaveImageToSource(platform)}
                  >
                    <Save size={16} /> Save Image to Source
                  </button>
                ) : null}
                {!imageGeneration?.configured ? (
                  <button type="button" onClick={onOpenImageSetup}>
                    <Zap size={16} /> {imageGeneration?.consentRequired ? "Enable Images" : "Connect Image Engine"}
                  </button>
                ) : null}
              </div>
              <details className="campaign-receipts">
                <summary>Creative direction and receipts</summary>
                <p>{platform?.imagePrompt}</p>
                <pre>
                  {jsonBlock({
                    packet: campaign.packetSummary,
                    images: campaign.generatedImages,
                    nextAction: campaign.nextAction
                  })}
                </pre>
              </details>
            </aside>
          </div>
        </div>
      ) : (
        <div className="campaign-empty-state">
          <Sparkles size={30} />
          <strong>Ready to create from project memory</strong>
          <span>TikTok · Instagram · X · LinkedIn</span>
        </div>
      )}

      <details className="autopilot-advanced">
        <summary>Source and advanced controls</summary>
        <div className="source-box">
          <textarea
            value={source}
            onChange={(event) => setSource(event.target.value)}
            aria-label="Source material"
          />
          <div className="source-actions">
            <span>{source.length} characters</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <SpeechToTextButton
                onTranscript={(text) => setSource((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text))}
                label="Dictate Source"
              />
              <button type="button" className="mini-action" onClick={onSaveSource}>
                <Save size={16} /> Save Source
              </button>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

export function ConsoleTab({
  state,
  projectId,
  projectSources,
  campaignDirection,
  setCampaignDirection,
  campaign,
  selectedPlatform,
  setSelectedPlatform,
  busy,
  imageBusy,
  createCampaign,
  generateCampaignImage,
  saveCampaignImageToSource,
  exportCampaign,
  enableExternalImageGeneration,
  setModal,
  source,
  setSource,
  saveSource,
  exportPreview,
  projectName,
  setProjectName,
  saveProject,
  createProject,
  createManualBackup,
  restoreLatestBackup,
  exportAllData,
  cleanupCache,
  operationError
}) {
  return (
    <>
      <WakeDarkMatterCore state={state} setModal={setModal} />
      {operationError?.ability === "console" ? (
        <div className="ability-state error">
          <strong>Campaign action failed</strong>
          <p>{operationError.message}</p>
        </div>
      ) : null}
      <CampaignAutopilot
        projectName={state.projects?.find((project) => project.id === projectId)?.name || "Current Project"}
        projectSourceCount={projectSources.length}
        direction={campaignDirection}
        setDirection={setCampaignDirection}
        campaign={campaign}
        selectedPlatform={selectedPlatform}
        setSelectedPlatform={setSelectedPlatform}
        busy={busy}
        imageBusy={imageBusy}
        imageGeneration={state.imageGeneration}
        onCreate={createCampaign}
        onGenerateImage={generateCampaignImage}
        onSaveImageToSource={saveCampaignImageToSource}
        onExport={exportCampaign}
        onOpenImageSetup={
          state.imageGeneration?.consentRequired
            ? enableExternalImageGeneration
            : () =>
                setModal({
                  title: "Connect Image Engine",
                  body: "Wake stores provider credentials in Windows secure storage and keeps generated originals in local application data."
                })
        }
        source={source}
        setSource={setSource}
        onSaveSource={saveSource}
      />
      {exportPreview ? <ExportPreviewPanel preview={exportPreview} /> : null}
      <details className="autopilot-admin">
        <summary>Project settings</summary>
        <div className="project-row">
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Project name..."
            aria-label="Project name"
          />
          <div className="project-actions">
            <button type="button" className="mini-action" disabled={busy} onClick={saveProject}>
              Rename
            </button>
            <button
              type="button"
              className="mini-action"
              disabled={busy || !projectName.trim()}
              onClick={createProject}
            >
              Create
            </button>
          </div>
        </div>
        <div className="data-protection-row" aria-label="Local data protection">
          <button
            type="button"
            className="mini-action"
            disabled={busy}
            onClick={createManualBackup}
            title="Create local backup"
          >
            <Save size={15} /> Backup
          </button>
          <button
            type="button"
            className="mini-action"
            disabled={busy || !state.dataProtection?.bundles?.some((item) => item.kind === "manual")}
            onClick={restoreLatestBackup}
            title="Restore latest local backup"
          >
            <RotateCcw size={15} /> Restore
          </button>
          <button
            type="button"
            className="mini-action"
            disabled={busy}
            onClick={exportAllData}
            title="Export all local data"
          >
            <Download size={15} /> Export All
          </button>
          <button
            type="button"
            className="mini-action"
            disabled={busy}
            onClick={cleanupCache}
            title="Clean temporary cache"
          >
            <HardDrive size={15} /> Clean Cache
          </button>
          <small>
            {state.dataProtection?.storage?.recovery?.status || "local"} ·{" "}
            {state.dataProtection?.bundles?.length || 0} bundles
          </small>
        </div>
      </details>
    </>
  );
}
