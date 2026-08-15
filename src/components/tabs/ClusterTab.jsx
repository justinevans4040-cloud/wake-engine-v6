import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  BarChart2,
  Calendar,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileAudio,
  FileText,
  Film,
  Gauge,
  GitFork,
  Layers,
  Music,
  Play,
  PlaySquare,
  Radio,
  Send,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Video,
  Volume2,
  Zap
} from "lucide-react";
import { Panel, PanelTitle, buildExportPreview } from "../common/UIPrimitives.jsx";
import { OutputStudio } from "../common/OutputStudio.jsx";
import { ExportPreviewPanel } from "../common/AbilityScaffold.jsx";
import { api } from "../../api.js";

const DEFAULT_PROFILES = [
  { id: "authority-doc", name: "Deep Authority & Documentary", speed: 0.95, pitch: 0.85, tag: "Warm & Deliberate" },
  { id: "hyper-hook", name: "High-Energy Viral Reel", speed: 1.25, pitch: 1.1, tag: "Punchy & Fast" },
  { id: "storyteller", name: "Empathetic Storyteller", speed: 1.0, pitch: 1.0, tag: "Conversational" },
  { id: "analytical-teardown", name: "Analytical Teardown", speed: 1.05, pitch: 0.95, tag: "Crisp & Precise" }
];

export function ClusterTab({
  cluster,
  busy,
  exportCluster,
  buildCluster,
  exportPreview,
  operationError,
  source
}) {
  const [viewMode, setViewMode] = useState("cluster"); // "cluster" | "matrix"
  const [matrix, setMatrix] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [copiedDay, setCopiedDay] = useState(null);

  // Neural Voiceover Studio State
  const [voiceProfiles, setVoiceProfiles] = useState(DEFAULT_PROFILES);
  const [selectedProfileId, setSelectedProfileId] = useState("authority-doc");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [synthesizingAudio, setSynthesizingAudio] = useState(false);
  const [synthesizedAudio, setSynthesizedAudio] = useState(null);

  // Waveform Spectrum State
  const [waveformStyle, setWaveformStyle] = useState("bars");
  const [waveformSvg, setWaveformSvg] = useState(null);
  const canvasRef = useRef(null);

  // Video Engine State
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [renderedVideo, setRenderedVideo] = useState(null);

  // Retention & Virality Analytics Simulator State
  const [analytics, setAnalytics] = useState(null);
  const [analyzingVirality, setAnalyzingVirality] = useState(false);

  // 5-Angle Hook Experimentation State
  const [hookVariants, setHookVariants] = useState([]);
  const [showHookMatrix, setShowHookMatrix] = useState(false);
  const [loadingHooks, setLoadingHooks] = useState(false);

  // 1-Click Omnichannel Transmutation Studio State
  const [omnichannelBundle, setOmnichannelBundle] = useState(null);
  const [transmuting, setTransmuting] = useState(false);
  const [activeAssetTab, setActiveAssetTab] = useState("reel");
  const [exportingBundle, setExportingBundle] = useState(false);
  const [exportedBundle, setExportedBundle] = useState(null);
  const [copiedAsset, setCopiedAsset] = useState(null);

  useEffect(() => {
    api("/api/voice/profiles", "GET")
      .then((res) => {
        if (res?.profiles?.length) setVoiceProfiles(res.profiles);
      })
      .catch(() => {});
  }, []);

  // Fetch or generate waveform SVG
  useEffect(() => {
    const duration = synthesizedAudio?.estimatedDurationSec || 15;
    api("/api/waveform/generate", "POST", {
      durationSec: duration,
      style: waveformStyle,
      color: "#00ffc8"
    })
      .then((res) => {
        if (res?.svgDataUrl) setWaveformSvg(res.svgDataUrl);
      })
      .catch(() => {});
  }, [waveformStyle, synthesizedAudio]);

  // Live Canvas Animated Waveform Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;
      const barCount = 36;
      const barWidth = width / barCount;

      phase += speaking ? 0.12 : 0.03;

      if (waveformStyle === "smooth-wave") {
        ctx.beginPath();
        ctx.moveTo(0, midY);
        for (let i = 0; i <= width; i += 4) {
          const amp = (speaking ? 28 : 12) * Math.sin((i * 0.04) + phase) * Math.cos(i * 0.02);
          ctx.lineTo(i, midY + amp);
        }
        ctx.strokeStyle = "#00ffc8";
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#00ffc8";
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (waveformStyle === "neon-pulse") {
        for (let i = 0; i < barCount; i++) {
          const x = i * barWidth + barWidth * 0.2;
          const amp = (Math.sin(i * 0.4 + phase) * 0.5 + 0.5) * (speaking ? height * 0.8 : height * 0.4);
          const y = midY - amp / 2;
          ctx.fillStyle = "#00ffc8";
          ctx.shadowBlur = speaking ? 10 : 4;
          ctx.shadowColor = "#00ffc8";
          ctx.fillRect(x, y, barWidth * 0.6, amp);
          ctx.shadowBlur = 0;
        }
      } else {
        // Equalizer Bars
        for (let i = 0; i < barCount; i++) {
          const x = i * barWidth + barWidth * 0.2;
          const amp = (Math.sin(i * 0.5 + phase) * 0.5 + 0.5) * (speaking ? height * 0.75 : height * 0.35) + 4;
          const y = height - amp - 2;
          ctx.fillStyle = "#00ffc8";
          ctx.fillRect(x, y, barWidth * 0.6, amp);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [speaking, waveformStyle]);

  useEffect(() => {
    if (selectedDay?.script) {
      setAnalyzingVirality(true);
      api("/api/analytics/simulate", "POST", {
        script: selectedDay.script,
        hook: selectedDay.hook,
        platform: selectedDay.platform?.toLowerCase().split(" ")[0] || "tiktok"
      })
        .then((res) => {
          if (res?.simulation) setAnalytics(res.simulation);
        })
        .catch(() => {})
        .finally(() => setAnalyzingVirality(false));

      // Generate 5 hook variants for day topic
      setLoadingHooks(true);
      api("/api/hooks/generate-variants", "POST", {
        sourceText: selectedDay.script,
        topic: selectedDay.title,
        platform: selectedDay.platform?.toLowerCase().split(" ")[0] || "tiktok"
      })
        .then((res) => {
          if (res?.variants) setHookVariants(res.variants);
        })
        .catch(() => {})
        .finally(() => setLoadingHooks(false));
    }
  }, [selectedDay]);

  const handleSynthesizeMatrix = async () => {
    setMatrixLoading(true);
    try {
      const res = await api("/api/synthesis/30-day-matrix", "POST", {
        sourceText: source || (cluster?.summary || ""),
        theme: "Authority & Omnichannel Growth"
      });
      if (res?.matrix) {
        setMatrix(res.matrix);
        setSelectedDay(res.matrix.days?.[0] || null);
        setViewMode("matrix");
      }
    } catch (err) {
      console.error("Matrix synthesis failed:", err);
    } finally {
      setMatrixLoading(false);
    }
  };

  const handleSpeakDayScript = (text) => {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceSpeed;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleSynthesizeNeuralAudio = async () => {
    if (!selectedDay?.script) return;
    setSynthesizingAudio(true);
    try {
      const res = await api("/api/voice/synthesize", "POST", {
        text: selectedDay.script,
        profileId: selectedProfileId,
        speed: voiceSpeed,
        format: "mp3"
      });
      if (res?.ok) {
        setSynthesizedAudio(res);
      }
    } catch (err) {
      console.error("Neural audio synthesis failed:", err);
    } finally {
      setSynthesizingAudio(false);
    }
  };

  const handleRenderVideoReel = async () => {
    if (!selectedDay) return;
    setRenderingVideo(true);
    try {
      const res = await api("/api/video/render-reel", "POST", {
        title: selectedDay.title,
        platform: selectedDay.platform.toLowerCase().split(" ")[0],
        duration: synthesizedAudio?.estimatedDurationSec || 15,
        srtContent: selectedDay.subtitleTrack?.srt || "",
        audioPath: synthesizedAudio?.filePath || null,
        waveformStyle
      });
      if (res?.ok) {
        setRenderedVideo(res);
      }
    } catch (err) {
      console.error("Video rendering failed:", err);
    } finally {
      setRenderingVideo(false);
    }
  };

  const handleDownloadSubtitles = (day, format = "srt") => {
    const content = format === "vtt" ? day.subtitleTrack?.vtt || day.subtitleTrack?.srt : day.subtitleTrack?.srt;
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Day-${day.day}-captions.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyDay = (day) => {
    const text = `DAY ${day.day}: ${day.title}\nPlatform: ${day.platform} (${day.format})\n\nHOOK:\n${day.hook}\n\nSCRIPT / CONTENT:\n${day.script}\n\nVISUAL PROMPT:\n${day.visualPrompt}`;
    navigator.clipboard.writeText(text);
    setCopiedDay(day.day);
    setTimeout(() => setCopiedDay(null), 2500);
  };

  const handleApplyHookVariant = (variant) => {
    if (!selectedDay) return;
    const updated = {
      ...selectedDay,
      hook: variant.hookText,
      script: `${variant.hookText}\n\n${selectedDay.script.split("\n\n").slice(1).join("\n\n")}`
    };
    setSelectedDay(updated);
  };

  const handleStageForPublishing = async (day) => {
    try {
      const res = await api("/api/publishing/stage", "POST", {
        platform: day.platform.toLowerCase().split(" ")[0],
        title: day.title,
        content: day.script,
        mediaPath: renderedVideo?.filePath || null
      });
      if (res?.ok) {
        setCopiedDay(`staged-${day.day}`);
        setTimeout(() => setCopiedDay(null), 2500);
      }
    } catch (err) {
      console.error("Failed to stage post:", err);
    }
  };

  const handleTransmute = async () => {
    setTransmuting(true);
    try {
      const res = await api("/api/transmute", "POST", {
        sourceText: source?.source || selectedDay?.script || "High leverage operational systems and authority engineering",
        title: source?.title || "Omnichannel Authority Campaign"
      });
      if (res?.ok && res?.bundle) {
        setOmnichannelBundle(res.bundle);
      }
    } catch (err) {
      console.error("Transmutation failed:", err);
    } finally {
      setTransmuting(false);
    }
  };

  const handleExportBundle = async () => {
    if (!omnichannelBundle) return;
    setExportingBundle(true);
    try {
      const res = await api("/api/transmute/export", "POST", { bundle: omnichannelBundle });
      if (res?.ok) {
        setExportedBundle(res);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExportingBundle(false);
    }
  };

  const handleCopyAsset = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedAsset(key);
    setTimeout(() => setCopiedAsset(null), 2500);
  };

  return (
    <>
      {operationError?.ability === "cluster" ? (
        <div className="ability-state error">
          <strong>Cluster action failed</strong>
          <p>{operationError.message}</p>
        </div>
      ) : null}
      <Panel className="cluster-panel">
        <PanelTitle
          icon={Layers}
          title="Content Cluster & 30-Day Campaign Matrix"
          right={
            <div className="inline-actions">
              <div style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2px", marginRight: "8px" }}>
                <button
                  type="button"
                  className={viewMode === "cluster" ? "mini-action" : "ghost-action"}
                  style={{ fontWeight: viewMode === "cluster" ? "bold" : "normal", fontSize: "0.8rem", padding: "4px 8px" }}
                  onClick={() => setViewMode("cluster")}
                >
                  <Layers size={13} style={{ marginRight: "4px" }} /> Single Cluster
                </button>
                <button
                  type="button"
                  className={viewMode === "matrix" ? "mini-action" : "ghost-action"}
                  style={{ fontWeight: viewMode === "matrix" ? "bold" : "normal", fontSize: "0.8rem", padding: "4px 8px" }}
                  onClick={() => {
                    setViewMode("matrix");
                    if (!matrix) handleSynthesizeMatrix();
                  }}
                >
                  <Calendar size={13} style={{ marginRight: "4px" }} /> 30-Day Matrix
                </button>
                <button
                  type="button"
                  className={viewMode === "omnichannel" ? "mini-action" : "ghost-action"}
                  style={{ fontWeight: viewMode === "omnichannel" ? "bold" : "normal", fontSize: "0.8rem", padding: "4px 8px" }}
                  onClick={() => {
                    setViewMode("omnichannel");
                    if (!omnichannelBundle) handleTransmute();
                  }}
                >
                  <Sparkles size={13} style={{ marginRight: "4px" }} /> 1-Click Omnichannel
                </button>
              </div>

              {viewMode === "cluster" ? (
                <>
                  <button
                    className="mini-action"
                    type="button"
                    disabled={busy || !cluster}
                    onClick={exportCluster}
                  >
                    <Download size={16} /> Export Cluster
                  </button>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={busy}
                    onClick={buildCluster}
                  >
                    Build Cluster <Zap size={16} />
                  </button>
                </>
              ) : viewMode === "matrix" ? (
                <button
                  className="primary-action"
                  type="button"
                  disabled={matrixLoading}
                  onClick={handleSynthesizeMatrix}
                >
                  <Zap size={16} /> {matrixLoading ? "Synthesizing..." : "Re-Synthesize 30 Days"}
                </button>
              ) : (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    className="mini-action"
                    type="button"
                    disabled={exportingBundle || !omnichannelBundle}
                    onClick={handleExportBundle}
                  >
                    <Download size={14} /> {exportingBundle ? "Exporting..." : "Export 5-Asset Folder"}
                  </button>
                  <button
                    className="primary-action"
                    type="button"
                    disabled={transmuting}
                    onClick={handleTransmute}
                  >
                    <Zap size={14} /> {transmuting ? "Transmuting 5 Formats..." : "Re-Transmute"}
                  </button>
                </div>
              )}
            </div>
          }
        />

        {viewMode === "cluster" ? (
          !cluster ? (
            <div className="cluster-empty">
              <Database size={28} />
              <h2>Source in. Cluster out.</h2>
              <p>Builds persistent pillars, output lanes, proof notes, and operator handoff drafts locally.</p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button type="button" className="primary-action" disabled={busy} onClick={buildCluster}>
                  Build Content Cluster
                </button>
                <button type="button" className="mini-action" disabled={matrixLoading} onClick={handleSynthesizeMatrix}>
                  <Calendar size={16} /> Synthesize 30-Day Matrix
                </button>
              </div>
            </div>
          ) : (
            <div className="cluster-stack">
              <div className="term-strip">
                {(cluster.sourceInbox?.terms || []).map((item) => (
                  <span key={item.term}>
                    {item.term}
                    <small>{item.count}</small>
                  </span>
                ))}
              </div>
              <OutputStudio output={cluster} />
              <div className="autopilot-next-step">
                <small>Next step</small>
                <p>{cluster.nextAction}</p>
              </div>
              <ExportPreviewPanel preview={exportPreview || buildExportPreview(cluster)} />
            </div>
          )
        ) : viewMode === "matrix" ? (
          /* 30-Day Calendar Matrix View */
          <div className="matrix-container" style={{ padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <h3 style={{ margin: 0 }}>30-Day Cross-Platform Content Calendar</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Cross-platform matrix with A/B hook variant matrix, audio spectrum waveform studio, and video reel rendering.
                </p>
              </div>
              {matrix?.summary && (
                <div style={{ display: "flex", gap: "8px", fontSize: "0.8rem" }}>
                  <span className="badge" style={{ background: "rgba(0,255,200,0.1)", color: "var(--live)", border: "1px solid var(--live)", padding: "2px 8px", borderRadius: "12px" }}>
                    TikTok: {matrix.summary.tiktokCount}
                  </span>
                  <span className="badge" style={{ background: "rgba(255,100,200,0.1)", color: "#ff64c8", border: "1px solid #ff64c8", padding: "2px 8px", borderRadius: "12px" }}>
                    Instagram: {matrix.summary.instagramCount}
                  </span>
                  <span className="badge" style={{ background: "rgba(100,180,255,0.1)", color: "#64b4ff", border: "1px solid #64b4ff", padding: "2px 8px", borderRadius: "12px" }}>
                    X Threads: {matrix.summary.xCount}
                  </span>
                  <span className="badge" style={{ background: "rgba(50,150,255,0.1)", color: "#0077b5", border: "1px solid #0077b5", padding: "2px 8px", borderRadius: "12px" }}>
                    LinkedIn: {matrix.summary.linkedinCount}
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.25rem" }}>
              {/* Calendar Days Grid */}
              <div style={{ maxHeight: "760px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.75rem", background: "var(--surface)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.6rem" }}>
                  {(matrix?.days || []).map((day) => {
                    const isSelected = selectedDay?.day === day.day;
                    return (
                      <div
                        key={day.id}
                        onClick={() => {
                          setSelectedDay(day);
                          setSynthesizedAudio(null);
                          setRenderedVideo(null);
                        }}
                        style={{
                          padding: "0.6rem",
                          border: isSelected ? "2px solid var(--live)" : "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                          background: isSelected ? "rgba(0,255,200,0.06)" : "var(--background)",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: "bold", marginBottom: "4px" }}>
                          <span>Day {day.day}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>W{day.week}</span>
                        </div>
                        <div style={{ fontSize: "0.75rem", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {day.platform.split(" ")[0]}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {day.format}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day Inspector, Analytics & Studios */}
              {selectedDay ? (
                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem", background: "var(--surface)", display: "flex", flexDirection: "column", gap: "0.85rem", maxHeight: "760px", overflowY: "auto" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "0.8rem", color: "var(--live)", fontWeight: "600", textTransform: "uppercase" }}>
                        Day {selectedDay.day} • {selectedDay.platform}
                      </div>
                      <h4 style={{ margin: "4px 0 0 0", fontSize: "1.1rem" }}>{selectedDay.title}</h4>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        Pillar: {selectedDay.pillar} • {selectedDay.format}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="mini-action"
                        type="button"
                        onClick={() => handleCopyDay(selectedDay)}
                        title="Copy Day Packet"
                      >
                        {copiedDay === selectedDay.day ? <CheckCircle2 size={14} color="var(--live)" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Hook & 5-Angle Experimenter */}
                  <div style={{ background: "var(--background)", padding: "0.6rem 0.75rem", borderRadius: "var(--radius)", borderLeft: "3px solid var(--live)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Opening Hook
                      </strong>
                      <button
                        className="ghost-action"
                        type="button"
                        onClick={() => setShowHookMatrix(!showHookMatrix)}
                        style={{ fontSize: "0.7rem", color: "var(--live)", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <GitFork size={12} /> {showHookMatrix ? "Hide 5 Angles" : "Experiment with 5 Angles"}
                      </button>
                    </div>
                    <div style={{ fontSize: "0.85rem", fontWeight: "500" }}>{selectedDay.hook}</div>

                    {/* 5-Angle Psychological Hook Matrix Drawer */}
                    {showHookMatrix && (
                      <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--border)" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: "bold", marginBottom: "6px", color: "var(--text-muted)" }}>
                          Psychological Angle Variants (A/B Test Matrix):
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {hookVariants.map((v) => {
                            const isCurrent = selectedDay.hook === v.hookText;
                            return (
                              <div
                                key={v.id}
                                style={{
                                  padding: "6px 8px",
                                  border: isCurrent ? "1px solid var(--live)" : "1px solid var(--border)",
                                  borderRadius: "4px",
                                  background: isCurrent ? "rgba(0,255,200,0.04)" : "var(--surface)",
                                  fontSize: "0.8rem"
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                                  <span style={{ fontWeight: "bold", fontSize: "0.75rem", color: "var(--live)" }}>{v.angleName}</span>
                                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Tension: {v.tensionScore}% • 3s Survival: {v.predicted3sSurvival}%</span>
                                </div>
                                <div style={{ marginBottom: "4px", fontSize: "0.8rem" }}>"{v.hookText}"</div>
                                {!isCurrent && (
                                  <button
                                    className="mini-action"
                                    type="button"
                                    onClick={() => handleApplyHookVariant(v)}
                                    style={{ fontSize: "0.7rem", padding: "2px 6px" }}
                                  >
                                    Apply as Active Hook
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Body Script */}
                  <div>
                    <strong style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "2px", textTransform: "uppercase" }}>
                      Scene Script & Content Copy
                    </strong>
                    <pre style={{ margin: 0, padding: "0.6rem 0.75rem", background: "var(--background)", borderRadius: "var(--radius)", fontSize: "0.85rem", whiteSpace: "pre-wrap", maxHeight: "100px", overflowY: "auto", fontFamily: "inherit" }}>
                      {selectedDay.script}
                    </pre>
                  </div>

                  {/* Retention Curve & Virality Analytics Simulator */}
                  {analytics && (
                    <div style={{ background: "var(--background)", padding: "0.75rem", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <TrendingUp size={15} color="var(--live)" />
                          <strong style={{ fontSize: "0.8rem" }}>Audience Retention & Virality Simulation</strong>
                        </div>
                        <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "var(--live)", background: "rgba(0,255,200,0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                          Grade: {analytics.grade} ({analytics.viralityIndex}/100)
                        </span>
                      </div>

                      {/* Gauges Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", marginBottom: "8px" }}>
                        <div style={{ background: "var(--surface)", padding: "4px 6px", borderRadius: "4px", textAlign: "center" }}>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Hook Tension</span>
                          <strong style={{ fontSize: "0.85rem", color: analytics.scores.hookTension >= 80 ? "var(--live)" : "currentColor" }}>
                            {analytics.scores.hookTension}%
                          </strong>
                        </div>
                        <div style={{ background: "var(--surface)", padding: "4px 6px", borderRadius: "4px", textAlign: "center" }}>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Pacing</span>
                          <strong style={{ fontSize: "0.85rem" }}>{analytics.scores.pacingReadability}%</strong>
                        </div>
                        <div style={{ background: "var(--surface)", padding: "4px 6px", borderRadius: "4px", textAlign: "center" }}>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>CTA Strength</span>
                          <strong style={{ fontSize: "0.85rem", color: analytics.scores.ctaConversion >= 80 ? "var(--live)" : "#ffaa00" }}>
                            {analytics.scores.ctaConversion}%
                          </strong>
                        </div>
                      </div>

                      {/* Retention Curve Bar Graph */}
                      <div style={{ fontSize: "0.75rem", marginBottom: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "3px", fontSize: "0.7rem" }}>
                          <span>Timeline</span>
                          <span>Predicted vs Benchmark</span>
                        </div>
                        {analytics.retentionCurve.map((pt) => (
                          <div key={pt.label} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                            <span style={{ width: "65px", fontSize: "0.7rem", color: "var(--text-muted)" }}>{pt.label}</span>
                            <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", height: "8px", borderRadius: "4px", overflow: "hidden", position: "relative" }}>
                              <div style={{ width: `${pt.predicted}%`, height: "100%", background: pt.predicted >= pt.benchmark ? "var(--live)" : "#ffaa00", borderRadius: "4px" }} />
                            </div>
                            <span style={{ width: "32px", fontSize: "0.7rem", textAlign: "right" }}>{pt.predicted}%</span>
                          </div>
                        ))}
                      </div>

                      {/* Optimization Tip */}
                      {analytics.optimizationTips?.[0] && (
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.02)", padding: "4px 6px", borderRadius: "4px", borderLeft: "2px solid var(--live)" }}>
                          💡 <strong>Tip:</strong> {analytics.optimizationTips[0]}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Neural Voice & Waveform Spectrum Studio */}
                  <div style={{ background: "var(--background)", padding: "0.75rem", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Music size={14} color="var(--live)" />
                        <strong style={{ fontSize: "0.8rem" }}>Neural Voiceover & Spectrum Studio</strong>
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Live Synthesis</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "8px", marginBottom: "8px" }}>
                      <select
                        value={selectedProfileId}
                        onChange={(e) => setSelectedProfileId(e.target.value)}
                        className="chat-input"
                        style={{ fontSize: "0.8rem", padding: "4px 8px" }}
                      >
                        {voiceProfiles.map((vp) => (
                          <option key={vp.id} value={vp.id}>
                            {vp.name}
                          </option>
                        ))}
                      </select>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Speed:</span>
                        <input
                          type="range"
                          min="0.8"
                          max="1.4"
                          step="0.05"
                          value={voiceSpeed}
                          onChange={(e) => setVoiceSpeed(Number(e.target.value))}
                          style={{ width: "60px" }}
                        />
                        <span style={{ fontSize: "0.75rem" }}>{voiceSpeed}x</span>
                      </div>
                    </div>

                    {/* Waveform Style Selector & Live Animated Canvas */}
                    <div style={{ marginBottom: "8px", background: "rgba(0,0,0,0.25)", padding: "6px", borderRadius: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Radio size={11} /> Spectrum Style:
                        </span>
                        <select
                          value={waveformStyle}
                          onChange={(e) => setWaveformStyle(e.target.value)}
                          className="chat-input"
                          style={{ fontSize: "0.7rem", padding: "2px 6px", height: "24px" }}
                        >
                          <option value="bars">Dynamic Equalizer Bars</option>
                          <option value="smooth-wave">Smooth Sine Wave</option>
                          <option value="neon-pulse">Neon Center Pulse</option>
                        </select>
                      </div>
                      <canvas
                        ref={canvasRef}
                        width={280}
                        height={38}
                        style={{ width: "100%", height: "38px", display: "block", borderRadius: "2px" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="primary-action"
                        type="button"
                        disabled={synthesizingAudio}
                        onClick={handleSynthesizeNeuralAudio}
                        style={{ fontSize: "0.8rem", padding: "5px 10px", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <Zap size={14} /> {synthesizingAudio ? "Synthesizing..." : "Generate Voiceover Audio"}
                      </button>
                      <button
                        className="mini-action"
                        type="button"
                        onClick={() => handleSpeakDayScript(selectedDay.script)}
                        style={{ fontSize: "0.8rem", padding: "5px 8px" }}
                        title="Quick system speech preview"
                      >
                        <Volume2 size={14} color={speaking ? "var(--live)" : "currentColor"} />
                      </button>
                    </div>

                    {/* Synthesized Audio Player Receipt */}
                    {synthesizedAudio && (
                      <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem" }}>
                        <div>
                          <span style={{ color: "var(--live)", fontWeight: "bold" }}>Synthesized: </span>
                          <span>{synthesizedAudio.estimatedDurationSec}s ({synthesizedAudio.wordCount} words)</span>
                        </div>
                        <span style={{ color: "var(--text-muted)" }}>{synthesizedAudio.profile?.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Video Reel Renderer Canvas */}
                  <div style={{ background: "var(--background)", padding: "0.75rem", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Film size={14} color="var(--live)" />
                        <strong style={{ fontSize: "0.8rem" }}>Vertical Video Reel (9:16 MP4)</strong>
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>1080x1920</span>
                    </div>

                    <button
                      className="primary-action"
                      type="button"
                      disabled={renderingVideo}
                      onClick={handleRenderVideoReel}
                      style={{ width: "100%", fontSize: "0.8rem", padding: "5px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                      <Video size={14} /> {renderingVideo ? "Stitching Visual, Waveform & Subtitles..." : "Render Vertical Video Reel (MP4)"}
                    </button>

                    {renderedVideo && (
                      <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem" }}>
                        <div>
                          <span style={{ color: "var(--live)", fontWeight: "bold" }}>Rendered: </span>
                          <span>{renderedVideo.filename} ({renderedVideo.durationSec}s)</span>
                        </div>
                        <a
                          href={renderedVideo.url || renderedVideo.relativePath}
                          download={renderedVideo.filename}
                          style={{ color: "var(--live)", textDecoration: "none", fontWeight: "bold" }}
                        >
                          Download MP4
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Subtitle Downloads & Staging Queue */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.6rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Subtitles:</span>
                      <button
                        className="mini-action"
                        type="button"
                        onClick={() => handleDownloadSubtitles(selectedDay, "srt")}
                        title="Download SubRip Subtitles"
                        style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", padding: "3px 6px" }}
                      >
                        <FileText size={12} /> .SRT
                      </button>
                      <button
                        className="mini-action"
                        type="button"
                        onClick={() => handleDownloadSubtitles(selectedDay, "vtt")}
                        title="Download WebVTT Subtitles"
                        style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", padding: "3px 6px" }}
                      >
                        <FileText size={12} /> .VTT
                      </button>
                    </div>

                    <button
                      className="primary-action"
                      type="button"
                      onClick={() => handleStageForPublishing(selectedDay)}
                      style={{ fontSize: "0.75rem", padding: "3px 8px", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      {copiedDay === `staged-${selectedDay.day}` ? (
                        <>
                          <CheckCircle2 size={12} color="var(--live)" /> Staged!
                        </>
                      ) : (
                        <>
                          <Share2 size={12} /> Stage for Publishing
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border)", borderRadius: "var(--radius)", color: "var(--text-muted)" }}>
                  Select a day to view script, retention analytics, and video reel studio.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="omnichannel-workspace" style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            {transmuting ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                <Zap size={32} className="spin" style={{ margin: "0 auto 1rem auto", color: "var(--live)" }} />
                <h3>Transmuting Source Material...</h3>
                <p>Generating Vertical Video Reel, X Thread, LinkedIn Article, Carousel Deck, and Newsletter Brief in parallel.</p>
              </div>
            ) : omnichannelBundle ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", padding: "8px 12px", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{omnichannelBundle.title}</h3>
                    <small style={{ color: "var(--text-muted)" }}>5 native platform assets generated from 1 source note</small>
                  </div>
                  {exportedBundle && (
                    <div style={{ fontSize: "0.75rem", color: "var(--live)" }}>
                      ✓ Exported {exportedBundle.filesCount} files to <code>{exportedBundle.bundleDir}</code>
                    </div>
                  )}
                </div>

                {/* 5-Asset Tab Navigation */}
                <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
                  {[
                    { id: "reel", label: "Vertical Reel (9:16)", icon: Video },
                    { id: "xThread", label: "X 7-Tweet Thread", icon: Share2 },
                    { id: "linkedIn", label: "LinkedIn Article", icon: FileText },
                    { id: "carousel", label: "Instagram Carousel", icon: Layers },
                    { id: "newsletter", label: "Email Newsletter", icon: Send }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeAssetTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        className={isActive ? "mini-action" : "ghost-action"}
                        style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", padding: "6px 12px", fontWeight: isActive ? "bold" : "normal" }}
                        onClick={() => setActiveAssetTab(tab.id)}
                      >
                        <Icon size={14} /> {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Asset Content Inspector */}
                <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem" }}>
                  {activeAssetTab === "reel" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>Vertical Reel Script & Scene Breakdown (~{omnichannelBundle.assets?.reel?.durationEstSec}s)</strong>
                        <button
                          className="mini-action"
                          type="button"
                          onClick={() => handleCopyAsset(JSON.stringify(omnichannelBundle.assets?.reel, null, 2), "reel")}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {copiedAsset === "reel" ? "Copied!" : "Copy Reel Script"}
                        </button>
                      </div>
                      <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Opening Hook:</span>
                        <p style={{ margin: "4px 0 0 0", fontWeight: "bold", color: "var(--live)" }}>"{omnichannelBundle.assets?.reel?.hook}"</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {omnichannelBundle.assets?.reel?.scenes?.map((scene, idx) => (
                          <div key={idx} style={{ background: "var(--surface)", padding: "8px", borderRadius: "4px", fontSize: "0.8rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--live)", marginBottom: "4px" }}>
                              <strong>Scene {idx + 1} ({scene.timestamp})</strong>
                            </div>
                            <p style={{ margin: "0 0 4px 0" }}><strong>Visual:</strong> {scene.visual}</p>
                            <p style={{ margin: "0 0 4px 0" }}><strong>Voiceover:</strong> "{scene.voiceover}"</p>
                            <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)" }}><strong>Prompt:</strong> <code>{scene.diffusionPrompt}</code></p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeAssetTab === "xThread" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>X / Twitter 7-Tweet Viral Thread</strong>
                        <button
                          className="mini-action"
                          type="button"
                          onClick={() => handleCopyAsset(omnichannelBundle.assets?.xThread?.tweets?.join("\n\n---\n\n"), "xThread")}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {copiedAsset === "xThread" ? "Copied All Tweets!" : "Copy Full Thread"}
                        </button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {omnichannelBundle.assets?.xThread?.tweets?.map((tweet, idx) => (
                          <div key={idx} style={{ background: "var(--surface)", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
                            {tweet}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeAssetTab === "linkedIn" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>LinkedIn Long-Form Executive Article</strong>
                        <button
                          className="mini-action"
                          type="button"
                          onClick={() => handleCopyAsset(`${omnichannelBundle.assets?.linkedIn?.headline}\n\n${omnichannelBundle.assets?.linkedIn?.body}`, "linkedIn")}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {copiedAsset === "linkedIn" ? "Copied!" : "Copy Article"}
                        </button>
                      </div>
                      <h4 style={{ margin: 0, fontSize: "1.1rem", color: "var(--live)" }}>{omnichannelBundle.assets?.linkedIn?.headline}</h4>
                      <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "4px", border: "1px solid var(--border)", fontSize: "0.85rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                        {omnichannelBundle.assets?.linkedIn?.body}
                      </div>
                    </div>
                  )}

                  {activeAssetTab === "carousel" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>Instagram 7-Slide Carousel Deck</strong>
                        <button
                          className="mini-action"
                          type="button"
                          onClick={() => handleCopyAsset(JSON.stringify(omnichannelBundle.assets?.carousel?.slides, null, 2), "carousel")}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {copiedAsset === "carousel" ? "Copied!" : "Copy Slide Deck"}
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                        {omnichannelBundle.assets?.carousel?.slides?.map((slide) => (
                          <div key={slide.slideNumber} style={{ background: "var(--surface)", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--live)" }}>
                              <strong>Slide {slide.slideNumber}</strong>
                              <span>{slide.layout}</span>
                            </div>
                            <strong style={{ fontSize: "0.9rem" }}>{slide.headline}</strong>
                            <p style={{ fontSize: "0.8rem", margin: 0, color: "var(--text-muted)" }}>{slide.subtext}</p>
                            <small style={{ fontSize: "0.7rem", fontStyle: "italic", borderTop: "1px dashed var(--border)", paddingTop: "4px" }}>
                              {slide.designNotes}
                            </small>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeAssetTab === "newsletter" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>High-Converting Email Newsletter Brief</strong>
                        <button
                          className="mini-action"
                          type="button"
                          onClick={() => handleCopyAsset(omnichannelBundle.assets?.newsletter?.body, "newsletter")}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {copiedAsset === "newsletter" ? "Copied!" : "Copy Newsletter"}
                        </button>
                      </div>
                      <div style={{ background: "var(--surface)", padding: "8px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Subject Line Options:</span>
                        {omnichannelBundle.assets?.newsletter?.subjectLines?.map((sl, i) => (
                          <div key={i} style={{ fontSize: "0.85rem", fontWeight: i === 0 ? "bold" : "normal", color: i === 0 ? "var(--live)" : "inherit" }}>
                            {i + 1}. {sl}
                          </div>
                        ))}
                      </div>
                      <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "4px", border: "1px solid var(--border)", fontSize: "0.85rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                        {omnichannelBundle.assets?.newsletter?.body}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "3rem", border: "1px dashed var(--border)", borderRadius: "var(--radius)", color: "var(--text-muted)" }}>
                <Sparkles size={32} style={{ margin: "0 auto 1rem auto", color: "var(--live)" }} />
                <h3>No Transmutation Generated Yet</h3>
                <p>Click "Transmute 5 Formats" to convert your source note into Video Reels, X Threads, LinkedIn Articles, Carousels, and Newsletters.</p>
                <button type="button" className="primary-action" onClick={handleTransmute} style={{ marginTop: "1rem" }}>
                  Transmute Current Source Now <Zap size={15} />
                </button>
              </div>
            )}
          </div>
        )}
      </Panel>
    </>
  );
}
