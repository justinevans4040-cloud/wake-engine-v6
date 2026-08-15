import React, { useState, useEffect } from "react";
import {
  Archive,
  Database,
  FileText,
  Github,
  HardDrive,
  Images,
  Radar,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Vault,
  Zap
} from "lucide-react";
import { Pill, Panel, PanelTitle, SpeechToTextButton } from "../common/UIPrimitives.jsx";
import { api } from "../../api.js";

export function CompetitorTrendPanel({ onUseSource }) {
  const [competitorText, setCompetitorText] = useState("");
  const [niche, setNiche] = useState("AI & Automation");
  const [platform, setPlatform] = useState("tiktok");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedAngle, setCopiedAngle] = useState(null);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!competitorText.trim()) return;
    setLoading(true);
    try {
      const res = await api("/api/trends/analyze", "POST", {
        text: competitorText,
        niche,
        platform
      });
      if (res?.ok) {
        setAnalysis(res);
      }
    } catch (err) {
      console.error("Trend analysis failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCounterAngle = (angle) => {
    if (onUseSource) {
      onUseSource(`COUNTER-POSITIONING CAMPAIGN:\nTarget Competitor Hook: "${analysis?.hookAnalysis?.rawHook}"\nStrategy: ${angle.strategy}\nOur Counter Hook: "${angle.hook}"\nRationale: ${angle.rationale}`);
    }
    setCopiedAngle(angle.strategy);
    setTimeout(() => setCopiedAngle(null), 2500);
  };

  return (
    <Panel className="competitor-trend-panel" style={{ marginTop: "1rem" }}>
      <PanelTitle
        icon={Radar}
        title="Competitor Hook & Niche Trend Reverse-Engineering"
        right={<Pill tone="live">Trend Intelligence</Pill>}
      />
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 1rem 0" }}>
        Paste a viral competitor script, reel transcript, or industry hook to reverse-engineer its psychological pattern, extract power vocabulary density, and synthesize 3 counter-positioning angles.
      </p>

      <form onSubmit={handleAnalyze} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "3px" }}>Industry / Niche</label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="chat-input"
              style={{ width: "100%", fontSize: "0.85rem", padding: "5px 8px" }}
              placeholder="e.g. B2B SaaS, Fitness, Creator Economy"
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "3px" }}>Target Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="chat-input"
              style={{ width: "100%", fontSize: "0.85rem", padding: "5px 8px" }}
            >
              <option value="tiktok">TikTok / Reels (Fast Paced)</option>
              <option value="linkedin">LinkedIn (Executive Authority)</option>
              <option value="x">X / Twitter (Thread / Punchy)</option>
              <option value="youtube">YouTube Shorts (Retention Driven)</option>
            </select>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>Competitor Script or Viral Video Transcript</label>
            <SpeechToTextButton
              onTranscript={(text) => setCompetitorText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
              label="Dictate Transcript"
            />
          </div>
          <textarea
            value={competitorText}
            onChange={(e) => setCompetitorText(e.target.value)}
            className="chat-input"
            rows={3}
            style={{ width: "100%", fontSize: "0.85rem", padding: "8px", fontFamily: "inherit" }}
            placeholder="Paste raw competitor video transcript or high-performing hook text..."
            required
          />
        </div>

        <button
          type="submit"
          className="primary-action"
          disabled={loading}
          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", padding: "6px 12px" }}
        >
          <Zap size={15} /> {loading ? "Reverse-Engineering Patterns..." : "Reverse-Engineer Viral Pattern"}
        </button>
      </form>

      {/* Analysis Results */}
      {analysis && (
        <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {/* Top Score Strip */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Detected Archetype:</span>
              <h4 style={{ margin: "2px 0 0 0", fontSize: "1.05rem", color: "var(--live)" }}>{analysis.hookAnalysis?.archetype}</h4>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Viral Velocity Score:</span>
              <div style={{ fontSize: "1.25rem", fontWeight: "bold", color: analysis.metrics?.viralPatternScore >= 85 ? "var(--live)" : "#ffaa00" }}>
                {analysis.metrics?.viralPatternScore}/100
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            <div style={{ background: "var(--surface)", padding: "6px 8px", borderRadius: "4px", textAlign: "center" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Hook Length</span>
              <strong style={{ fontSize: "0.85rem" }}>{analysis.metrics?.hookWordCount} words</strong>
            </div>
            <div style={{ background: "var(--surface)", padding: "6px 8px", borderRadius: "4px", textAlign: "center" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Avg Sentence</span>
              <strong style={{ fontSize: "0.85rem" }}>{analysis.metrics?.avgWordsPerSentence} wps</strong>
            </div>
            <div style={{ background: "var(--surface)", padding: "6px 8px", borderRadius: "4px", textAlign: "center" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Power Words</span>
              <strong style={{ fontSize: "0.85rem", color: "var(--live)" }}>{analysis.metrics?.powerWordCount} detected</strong>
            </div>
            <div style={{ background: "var(--surface)", padding: "6px 8px", borderRadius: "4px", textAlign: "center" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Hook Efficiency</span>
              <strong style={{ fontSize: "0.8rem", color: "var(--live)" }}>{analysis.hookAnalysis?.hookEfficiency}</strong>
            </div>
          </div>

          {/* Power Word Cloud */}
          {analysis.powerWords?.length > 0 && (
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Trigger Vocabulary Detected:</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {analysis.powerWords.map((pw) => (
                  <span key={pw} style={{ background: "rgba(0,255,200,0.08)", color: "var(--live)", border: "1px solid var(--live)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.75rem" }}>
                    {pw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3 Counter-Positioning Angles */}
          <div>
            <span style={{ fontSize: "0.8rem", fontWeight: "bold", display: "block", marginBottom: "6px" }}>
              Strategic Counter-Positioning Angles (Dismantle Competitor Position):
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {analysis.counterPositioning?.map((cp) => (
                <div key={cp.strategy} style={{ padding: "8px", border: "1px solid var(--border)", borderRadius: "4px", background: "var(--surface)", fontSize: "0.8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                    <strong style={{ color: "var(--live)", fontSize: "0.8rem" }}>{cp.strategy}</strong>
                    <button
                      className="mini-action"
                      type="button"
                      onClick={() => handleApplyCounterAngle(cp)}
                      style={{ fontSize: "0.7rem", padding: "2px 6px" }}
                    >
                      {copiedAngle === cp.strategy ? "Loaded to Creator!" : "Use as Creator Source"}
                    </button>
                  </div>
                  <div style={{ fontStyle: "italic", marginBottom: "2px" }}>"{cp.hook}"</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{cp.rationale}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function GitHubIngestionPanel({ projectId, onCloned }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");
  const [cloning, setCloning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [repos, setRepos] = useState([]);

  const loadRepos = async () => {
    try {
      const res = await api("/api/git/repos");
      if (res?.repos) setRepos(res.repos);
    } catch {}
  };

  useEffect(() => {
    loadRepos();
  }, []);

  const handleClone = async (e) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    setCloning(true);
    setError("");
    setResult(null);
    try {
      const res = await api("/api/git/clone", "POST", {
        repoUrl: repoUrl.trim(),
        branch: branch.trim() || "main",
        token: token.trim(),
        projectId
      });
      if (res?.ok) {
        setResult(res);
        setRepoUrl("");
        loadRepos();
        if (onCloned) onCloned();
      } else {
        setError(res?.error || "Failed to clone repository.");
      }
    } catch (err) {
      setError(err.message || "Failed to clone repository.");
    } finally {
      setCloning(false);
    }
  };

  return (
    <Panel className="github-ingest-panel" style={{ marginTop: "1rem" }}>
      <PanelTitle
        icon={Github}
        title="1-Click GitHub Repository Ingestion & Flagship Scanner"
        right={<Pill tone="live">Git Sync</Pill>}
      />
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 1rem 0" }}>
        Clone any public or private GitHub repository directly into WAKE Engine. The engine automatically indexes Pictures & Stills, Demo Videos, Apps & Builds, and Documents & Evidence Packs for the agents to analyze and cite.
      </p>

      <form onSubmit={handleClone} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "3px" }}>
              GitHub Repository URL
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="chat-input"
              style={{ width: "100%", fontSize: "0.85rem", padding: "6px 8px" }}
              placeholder="https://github.com/your-username/your-repository"
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "3px" }}>
              Branch
            </label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="chat-input"
              style={{ width: "100%", fontSize: "0.85rem", padding: "6px 8px" }}
              placeholder="main"
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "3px" }}>
            Personal Access Token (Optional — only for private repos)
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="chat-input"
            style={{ width: "100%", fontSize: "0.85rem", padding: "6px 8px" }}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (Never saved to disk)"
          />
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="submit"
            className="primary-action"
            disabled={cloning || !repoUrl.trim()}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Zap size={16} /> {cloning ? "Cloning & Indexing..." : "Clone & Index GitHub Repo"}
          </button>
        </div>
      </form>

      {error && (
        <div style={{ padding: "0.75rem", background: "rgba(229, 62, 62, 0.15)", border: "1px solid #e53e3e", borderRadius: "4px", color: "#ff6b6b", fontSize: "0.85rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ padding: "1rem", background: "rgba(0, 240, 255, 0.05)", border: "1px solid var(--live)", borderRadius: "6px", marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <strong style={{ color: "var(--live)", fontSize: "0.95rem" }}>
              ✓ Repository Ingested: {result.repoName} ({result.branch})
            </strong>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{result.commit}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px", textAlign: "center" }}>
            <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "4px" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Pictures / Stills</span>
              <strong style={{ fontSize: "1rem", color: "var(--cyan)" }}>{result.stats?.pictures || 0}</strong>
            </div>
            <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "4px" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Demo Videos</span>
              <strong style={{ fontSize: "1rem", color: "var(--cyan)" }}>{result.stats?.videos || 0}</strong>
            </div>
            <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "4px" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Apps & Builds</span>
              <strong style={{ fontSize: "1rem", color: "var(--cyan)" }}>{result.stats?.apps || 0}</strong>
            </div>
            <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "4px" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Evidence Docs</span>
              <strong style={{ fontSize: "1rem", color: "var(--cyan)" }}>{result.stats?.documents || 0}</strong>
            </div>
            <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "4px", border: "1px solid var(--live)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--live)", display: "block" }}>Flagship Assets</span>
              <strong style={{ fontSize: "1rem", color: "var(--live)" }}>{result.stats?.flagship || 0}</strong>
            </div>
          </div>
        </div>
      )}

      {repos.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
          <small style={{ display: "block", color: "var(--text-muted)", marginBottom: "6px", fontWeight: "600" }}>
            CONNECTED GITHUB REPOSITORIES ({repos.length})
          </small>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {repos.map((r) => (
              <div key={r.slug} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--surface)", borderRadius: "4px", border: "1px solid var(--border)", fontSize: "0.85rem" }}>
                <div>
                  <strong>{r.slug}</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "8px" }}>{r.path}</span>
                </div>
                <button
                  type="button"
                  className="mini-action"
                  onClick={() => {
                    setRepoUrl(`https://github.com/${r.slug.replace("_", "/")}`);
                  }}
                >
                  Sync Latest
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

export function IPVault({
  projectName,
  projectSources,
  sourceQuery,
  setSourceQuery,
  laneFilter,
  setLaneFilter,
  filteredSources,
  openSourceDocument
}) {
  const [searchMode, setSearchMode] = React.useState("keyword"); // "keyword" | "semantic"
  const [semanticResults, setSemanticResults] = React.useState(null);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (searchMode !== "semantic" || !sourceQuery.trim()) {
      setSemanticResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch("/api/semantic/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: sourceQuery,
            lane: laneFilter,
            limit: 24,
            minScore: 0.05
          })
        });
        if (response.ok) {
          const data = await response.json();
          setSemanticResults(data.results || []);
        }
      } catch {
        // Fallback to keyword search
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchMode, sourceQuery, laneFilter]);

  const countBy = (values) =>
    [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map()).entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const lanes = countBy(projectSources.map((item) => item.lane || "General Source"));
  const tags = countBy(projectSources.flatMap((item) => item.tags || [])).slice(0, 18);
  const visibleSources = semanticResults !== null ? semanticResults : filteredSources.slice(0, 24);

  return (
    <div className="vault-stack">
      <Panel className="vault-command">
        <PanelTitle
          icon={Vault}
          title={projectName || "Current Project Sources"}
          right={
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div className="search-mode-toggle" style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "6px", padding: "2px" }}>
                <button
                  type="button"
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    background: searchMode === "keyword" ? "var(--accent-primary, #00f0ff)" : "transparent",
                    color: searchMode === "keyword" ? "#000" : "inherit",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                  onClick={() => setSearchMode("keyword")}
                >
                  Exact / Text
                </button>
                <button
                  type="button"
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    background: searchMode === "semantic" ? "var(--accent-primary, #00f0ff)" : "transparent",
                    color: searchMode === "semantic" ? "#000" : "inherit",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                  onClick={() => setSearchMode("semantic")}
                >
                  Vector / Semantic
                </button>
              </div>
              <Pill tone="live">{projectSources.length} Sources</Pill>
            </div>
          }
        />
        <div className="vault-search-row">
          <label className="search-box">
            <Search size={18} />
            <input
              value={sourceQuery}
              onChange={(event) => setSourceQuery(event.target.value)}
              placeholder={searchMode === "semantic" ? "Describe a concept, topic, or question..." : "Search IP, lanes, tags, paths..."}
              aria-label="Search IP vault"
            />
          </label>
          <select
            value={laneFilter}
            onChange={(event) => setLaneFilter(event.target.value)}
            aria-label="Filter IP lane"
          >
            <option value="all">All source groups</option>
            {lanes.map((lane) => (
              <option key={lane.label} value={lane.label}>
                {lane.label} ({lane.count})
              </option>
            ))}
          </select>
        </div>
        <div className="vault-lane-pills">
          <button
            type="button"
            className={`vault-lane-chip ${laneFilter === "all" ? "active" : ""}`}
            onClick={() => setLaneFilter("all")}
          >
            All <small>{projectSources.length}</small>
          </button>
          {lanes.map((lane) => (
            <button
              key={lane.label}
              type="button"
              className={`vault-lane-chip ${laneFilter === lane.label ? "active" : ""}`}
              onClick={() => setLaneFilter(lane.label)}
            >
              {lane.label} <small>{lane.count}</small>
            </button>
          ))}
        </div>
        <div className="tag-cloud">
          {tags.map((tag) => (
            <button
              key={tag.label}
              type="button"
              className="tag-chip"
              onClick={() => setSourceQuery(tag.label)}
            >
              #{tag.label} <small>{tag.count}</small>
            </button>
          ))}
        </div>
      </Panel>
      <div className="vault-grid source-vault-list">
        {visibleSources.map((source) => (
          <Panel key={source.id} className="source-card">
            <div className="source-card-header">
              <div>
                <span className="source-lane">{source.lane || "General Source"}</span>
                <h3>{source.title || "Untitled source"}</h3>
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {source._score !== undefined && (
                  <Pill tone="live">
                    {Math.round(source._score * 100)}% Match
                  </Pill>
                )}
                <Pill tone="idle">{source.wordCount || 0} words</Pill>
              </div>
            </div>
            <p className="source-summary">{source.summary || "No summary available."}</p>
            <div className="source-tags">
              {(source.tags || []).slice(0, 4).map((tag) => (
                <span key={tag} className="source-tag">
                  #{tag}
                </span>
              ))}
            </div>
            <div className="source-card-footer">
              <span className="source-path">{source.path || source.id}</span>
              <button
                type="button"
                className="mini-action"
                onClick={() => openSourceDocument(source)}
              >
                Open <FileText size={14} />
              </button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export function IntakePanel({
  state,
  projectId,
  intakeRootsText,
  setIntakeRootsText,
  intakeBusy,
  intakeIntent,
  setIntakeIntent,
  driveTargets,
  onRefreshIntakeTargets,
  onRunIntake,
  onReviewIntake,
  intakeReview,
  intakeReviewSelection,
  onToggleReviewCandidate,
  onSelectReviewCandidates,
  onApplyReview,
  onOpenMediaAsset,
  setModal
}) {
  const projectMedia = (state.mediaAssets || []).filter(
    (asset) => (asset.projectId || "wake-v6-main") === (projectId || "wake-v6-main")
  );

  return (
    <Panel className="intake-panel">
      <PanelTitle
        icon={HardDrive}
        title="Local Drive Ingestion & Evidence Vault"
        right={
          <div className="inline-actions">
            <button
              type="button"
              className="ghost-action"
              disabled={intakeBusy}
              onClick={() =>
                setModal({
                  title: "Drive / Folder Intake Settings",
                  body: "WAKE Engine scans attached local drives, Obsidian vaults, and project asset folders strictly within local machine boundaries."
                })
              }
            >
              Drive / folder intake
            </button>
            <button
              type="button"
              className="mini-action"
              disabled={intakeBusy}
              onClick={onRefreshIntakeTargets}
            >
              Refresh Drives
            </button>
            <button
              type="button"
              className="mini-action"
              disabled={intakeBusy}
              onClick={onRunIntake}
            >
              Scan My Content Folders
            </button>
            <button
              type="button"
              className="mini-action"
              disabled={intakeBusy}
              onClick={onReviewIntake}
            >
              Review Flash Drive
            </button>
            <button
              type="button"
              className="primary-action"
              disabled={intakeBusy}
              onClick={onRunIntake}
            >
              Import Listed Folders <Zap size={16} />
            </button>
          </div>
        }
      />
      <div className="intake-form-grid">
        <label className="field-group">
          <span>Intake scan roots</span>
          <textarea
            aria-label="Intake scan roots"
            value={intakeRootsText}
            onChange={(event) => setIntakeRootsText(event.target.value)}
            placeholder="C:\ObsidianVault&#10;D:\BrandAssets&#10;E:\ClientRecordings"
            rows={3}
          />
        </label>
        <div className="field-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Intake review mission</span>
            <SpeechToTextButton
              onTranscript={(text) => setIntakeIntent((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
              label="Speak Mission"
            />
          </div>
          <input
            aria-label="Intake review mission"
            type="text"
            value={intakeIntent}
            onChange={(event) => setIntakeIntent(event.target.value)}
            placeholder="Target audience, brand positioning, or ingestion focus..."
          />
        </div>
      </div>
      {intakeReview ? (
        <div className="intake-review-box">
          <div className="intake-review-header">
            <div>
              <strong>{intakeReview.title || "Intake Review Mission"}</strong>
              <small>{intakeReview.summary}</small>
            </div>
            <div className="inline-actions">
              <button
                type="button"
                className="ghost-action"
                disabled={intakeBusy}
                onClick={() => onSelectReviewCandidates("all")}
              >
                Select All
              </button>
              <button
                type="button"
                className="ghost-action"
                disabled={intakeBusy}
                onClick={() => onSelectReviewCandidates("none")}
              >
                Clear
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={intakeBusy}
                onClick={onApplyReview}
              >
                Import Selected
              </button>
            </div>
          </div>
          <div className="intake-review-list">
            {(intakeReview.candidates || []).map((candidate) => {
              const selected = intakeReviewSelection.has(candidate.reviewId);
              const disabled = candidate.decisionStatus === "blocked";
              return (
                <label
                  key={candidate.reviewId}
                  className={`intake-review-row ${disabled ? "disabled" : ""} ${selected ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    disabled={disabled || intakeBusy}
                    checked={selected}
                    onChange={() => onToggleReviewCandidate(candidate.reviewId)}
                  />
                  <span>
                    <strong>{candidate.title}</strong>
                    <small>
                      {candidate.importAs} · {candidate.decisionReason || candidate.reason} · {candidate.path}
                    </small>
                  </span>
                  <Pill
                    tone={
                      candidate.decisionStatus === "recommended"
                        ? "live"
                        : candidate.decisionStatus === "review"
                        ? "partial"
                        : "blocked"
                    }
                  >
                    {candidate.alreadyImported ? "exists" : candidate.decisionStatus || "review"}
                  </Pill>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="media-vault-list">
        {projectMedia.slice(0, 12).map((asset) => (
          <button key={asset.id} type="button" onClick={() => onOpenMediaAsset(asset)}>
            {asset.kind === "image" ? (
              <img
                className="media-card-thumb"
                src={`/api/media/${encodeURIComponent(asset.id)}/preview?v=${encodeURIComponent(
                  asset.updatedAt || asset.importedAt || asset.modifiedAt || ""
                )}`}
                alt=""
                loading="lazy"
              />
            ) : (
              <Pill tone="live">{asset.kind}</Pill>
            )}
            <strong>{asset.title}</strong>
            <small>
              {asset.lane} · {asset.extension} · click to open/rename
            </small>
          </button>
        ))}
      </div>
    </Panel>
  );
}

export function VaultTab({
  state,
  projectId,
  intakeRootsText,
  setIntakeRootsText,
  intakeBusy,
  intakeIntent,
  setIntakeIntent,
  driveTargets,
  refreshIntakeTargets,
  runIntakeAgent,
  reviewIntakeAgent,
  latestIntakeReview,
  intakeReviewSelection,
  toggleReviewCandidate,
  selectReviewCandidates,
  applyIntakeReview,
  openMediaAsset,
  setModal,
  projectSources,
  sourceQuery,
  setSourceQuery,
  laneFilter,
  setLaneFilter,
  filteredSources,
  openSourceDocument,
  onUseSource
}) {
  return (
    <>
      <IntakePanel
        state={state}
        projectId={projectId}
        intakeRootsText={intakeRootsText}
        setIntakeRootsText={setIntakeRootsText}
        intakeBusy={intakeBusy}
        intakeIntent={intakeIntent}
        setIntakeIntent={setIntakeIntent}
        driveTargets={driveTargets}
        onRefreshIntakeTargets={refreshIntakeTargets}
        onRunIntake={runIntakeAgent}
        onReviewIntake={reviewIntakeAgent}
        intakeReview={latestIntakeReview}
        intakeReviewSelection={intakeReviewSelection}
        onToggleReviewCandidate={toggleReviewCandidate}
        onSelectReviewCandidates={selectReviewCandidates}
        onApplyReview={applyIntakeReview}
        onOpenMediaAsset={openMediaAsset}
        setModal={setModal}
      />
      <GitHubIngestionPanel projectId={projectId} />
      <CompetitorTrendPanel onUseSource={onUseSource} />
      <IPVault
        projectName={state.projects?.find((project) => project.id === projectId)?.name}
        projectSources={projectSources}
        sourceQuery={sourceQuery}
        setSourceQuery={setSourceQuery}
        laneFilter={laneFilter}
        setLaneFilter={setLaneFilter}
        filteredSources={filteredSources}
        openSourceDocument={openSourceDocument}
      />
    </>
  );
}
