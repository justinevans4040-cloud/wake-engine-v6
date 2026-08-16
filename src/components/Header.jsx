import React, { useState } from "react";
import {
  Download,
  FolderArchive,
  Info,
  Plus,
  Radio,
  RotateCcw,
  Square,
  Upload,
  Volume2,
  VolumeX
} from "lucide-react";
import { emblemSrc, tabs, voicePresets } from "../app-config.jsx";
import { api } from "../api.js";

export function Header({
  active,
  navigateSection,
  state,
  projectId,
  switchProject,
  setModal,
  showVoicePanel,
  setShowVoicePanel,
  voiceMuted,
  setVoiceMuted,
  voicePreset,
  setVoicePreset,
  voices,
  voiceName,
  setVoiceName,
  ttsStatus,
  speakSystemVoice,
  stopSystemVoice,
  replayBoot
}) {
  const [exportingVault, setExportingVault] = useState(false);

  const handleExportVault = async () => {
    setExportingVault(true);
    try {
      const res = await api(`/api/projects/${projectId}/export-vault`, "POST");
      if (res?.bundle) {
        const blob = new Blob([JSON.stringify(res.bundle, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || `${projectId}-vault.wake.json`;
        a.click();
        URL.revokeObjectURL(url);
        setModal({
          title: "Vault Export Complete",
          body: `Exported ${res.bundle.counts?.sources || 0} sources and assets to ${res.filename}. SHA-256: ${res.sha256?.slice(0, 16)}...`
        });
      }
    } catch (err) {
      setModal({ title: "Vault Export Failed", body: err.message });
    } finally {
      setExportingVault(false);
    }
  };

  const handleImportVaultClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.wake";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const bundle = JSON.parse(text);
        const res = await api("/api/projects/import-vault", "POST", { bundle });
        if (res?.project) {
          switchProject(res.project.id);
          setModal({
            title: "Vault Imported",
            body: `Successfully imported "${res.project.name}" with ${res.addedSources || 0} sources.`
          });
        }
      } catch (err) {
        setModal({ title: "Vault Import Failed", body: err.message });
      }
    };
    input.click();
  };

  return (
    <header className="hero-panel">
      <div className="brand-lockup">
        <div className="emblem-stage" aria-label="ForgeFront Systems emblem">
          <img src={emblemSrc} alt="ForgeFront Systems emblem" />
        </div>
        <div className="title-stack">
          <div className="forge-wordmark">ForgeFront Systems</div>
          <div className="title-line">
            <h1>WAKE Engine</h1>
            <span className="version">Omega</span>
          </div>
          <div className="engine-status">
            <span className="status-dot" />
            <strong>DESKTOP APP LIVE</strong>
            <span>local runtime :8786</span>
            <button
              type="button"
              aria-label="Inspect runtime"
              onClick={() =>
                setModal({
                  title: "Runtime",
                  body: "WAKE Engine Omega is running locally with persistent packets, traces, exports, snapshots, and history. Tier Zero claims refer to the user-promoted local build parameters; no separate canonical Tier Zero specification exists in this repo."
                })
              }
            >
              <Radio size={15} />
              Inspect
            </button>
            <button
              type="button"
              aria-label="Open voice settings"
              onClick={() => setShowVoicePanel((value) => !value)}
            >
              {voiceMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              Voice
            </button>
            <button type="button" aria-label="Replay boot sequence" onClick={replayBoot}>
              <RotateCcw size={15} />
              Replay Boot
            </button>
          </div>
        </div>
        <button
          className="round-info"
          type="button"
          aria-label="Open WAKE truth rule"
          onClick={() =>
            setModal({
              title: "No Theater Rule",
              body: "WAKE Omega shows only the local desktop functions that are active in this app. Local functions are persisted and auditable."
            })
          }
        >
          <Info size={24} />
        </button>
      </div>

      <nav className="tab-grid" aria-label="WAKE Engine Omega sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={active === id ? "selected" : ""}
            onClick={() => navigateSection(id)}
          >
            <Icon size={30} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <label className="project-switcher">
          <span>Project</span>
          <select
            value={projectId}
            onChange={(event) => switchProject(event.target.value)}
            aria-label="Current project"
          >
            {(state?.projects || []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            className="mini-action"
            onClick={handleExportVault}
            disabled={exportingVault}
            title="Export full project vault as standalone .wake bundle"
            style={{ fontSize: "11px", padding: "4px 6px" }}
          >
            <Download size={13} style={{ marginRight: "3px" }} />
            .wake
          </button>
          <button
            type="button"
            className="mini-action"
            onClick={handleImportVaultClick}
            title="Import standalone .wake vault bundle"
            style={{ fontSize: "11px", padding: "4px 6px" }}
          >
            <Upload size={13} style={{ marginRight: "3px" }} />
            Import
          </button>
        </div>
      </div>

      {showVoicePanel && (
        <div className="voice-panel">
          <div>
            <small>Installed System TTS</small>
            <strong>{voiceMuted ? "Muted" : voicePresets[voicePreset]?.label || "Villain"}</strong>
            <span>Uses the installed desktop/browser speech synthesis runtime. No custom voice model is claimed.</span>
            <span>
              {(voices || []).length} installed voices detected · {ttsStatus}
            </span>
          </div>
          <div className="voice-presets">
            {Object.entries(voicePresets)
              .filter(([id]) => id !== "muted")
              .map(([id, preset]) => (
                <button
                  key={id}
                  type="button"
                  className={voicePreset === id ? "selected" : ""}
                  onClick={() => setVoicePreset(id)}
                >
                  {preset.label}
                </button>
              ))}
          </div>
          <select
            value={voiceName}
            onChange={(event) => setVoiceName(event.target.value)}
            aria-label="System voice"
          >
            <option value="">Auto voice</option>
            {(voices || []).map((voice) => (
              <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                {voice.name} · {voice.lang}
              </option>
            ))}
          </select>
          <div className="voice-actions">
            <button
              type="button"
              aria-label={voiceMuted ? "Unmute system voice" : "Mute system voice"}
              onClick={() => setVoiceMuted((value) => !value)}
            >
              {voiceMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              {voiceMuted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              className="primary-action"
              disabled={voiceMuted || !window.speechSynthesis}
              onClick={() => speakSystemVoice("System online. Wake Engine is awake.")}
            >
              Test Voice
              <Volume2 size={16} />
            </button>
            {ttsStatus === "speaking" || ttsStatus === "starting" ? (
              <button type="button" aria-label="Stop system voice" onClick={stopSystemVoice}>
                <Square size={15} /> Stop
              </button>
            ) : null}
            <button type="button" onClick={replayBoot}>
              <RotateCcw size={15} /> Replay Boot
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
