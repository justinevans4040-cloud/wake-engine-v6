import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Clock,
  Edit2,
  ExternalLink,
  FolderPlus,
  Globe,
  Pause,
  Play,
  Plus,
  Send,
  Share2,
  ShieldCheck,
  Trash2,
  Video,
  Zap
} from "lucide-react";
import { Panel, PanelTitle, SpeechToTextButton } from "../common/UIPrimitives.jsx";
import { api } from "../../api";

export function AutomationsPanel({ state, projectId, onRefresh, setModal, setOperationError }) {
  const [tab, setTab] = useState("active");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null);

  // Webhook Tester State
  const [webhookUrl, setWebhookUrl] = useState("https://httpbin.org/post");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookPreset, setWebhookPreset] = useState("n8n");
  const [webhookTestResult, setWebhookTestResult] = useState(null);
  const [webhookTesting, setWebhookTesting] = useState(false);

  // Folder Watcher State
  const [watchers, setWatchers] = useState([]);
  const [newWatchPath, setNewWatchPath] = useState("");

  // Social Publishing Queue State
  const [publishingAccounts, setPublishingAccounts] = useState([]);
  const [publishingQueue, setPublishingQueue] = useState([]);
  const [dispatchingId, setDispatchingId] = useState(null);

  const automations = state?.automations || [];
  const runs = state?.automationRuns || [];
  const reviewQueue = state?.reviewQueue || [];

  const loadWatchers = async () => {
    try {
      const res = await api("/api/watchers");
      if (res?.watchers) setWatchers(res.watchers);
    } catch {}
  };

  const loadPublishingData = async () => {
    try {
      const accRes = await api("/api/publishing/accounts");
      if (accRes?.accounts) setPublishingAccounts(accRes.accounts);
      const qRes = await api("/api/publishing/queue");
      if (qRes?.queue) setPublishingQueue(qRes.queue);
    } catch {}
  };

  useEffect(() => {
    loadWatchers();
    loadPublishingData();
  }, []);

  useEffect(() => {
    let alive = true;
    const timer = window.setInterval(() => {
      if (!alive || busy || editor) return;
      Promise.resolve(onRefresh()).catch((error) => {
        if (alive && setOperationError) setOperationError(error.message);
      });
      loadWatchers();
      loadPublishingData();
    }, 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [busy, editor, onRefresh, setOperationError]);

  const handleToggle = async (id, enabled) => {
    setBusy(true);
    try {
      const response = await api(`/api/automations/${id}/toggle`, "POST", { enabled });
      if (!response.ok) throw new Error(response.error || "Failed to toggle.");
      await onRefresh();
    } catch (err) {
      if (setOperationError) setOperationError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRun = async (id) => {
    setBusy(true);
    try {
      const response = await api(`/api/automations/${id}/run`, "POST");
      if (!response.ok) throw new Error(response.error || "Failed to run.");
      await onRefresh();
    } catch (err) {
      if (setOperationError) setOperationError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete automation?")) return;
    setBusy(true);
    try {
      const response = await api(`/api/automations/${id}`, "DELETE");
      if (!response.ok) throw new Error(response.error || "Failed to delete.");
      await onRefresh();
    } catch (err) {
      if (setOperationError) setOperationError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEditor = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const method = editor.id ? "PUT" : "POST";
      const path = editor.id ? `/api/automations/${editor.id}` : "/api/automations";
      const payload = { ...editor };
      const response = await api(path, method, payload);
      if (!response.ok) throw new Error(response.error || "Failed to save automation.");
      setEditor(null);
      await onRefresh();
    } catch (err) {
      if (setOperationError) setOperationError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleTestWebhook = async (e) => {
    e.preventDefault();
    setWebhookTesting(true);
    setWebhookTestResult(null);
    try {
      const res = await api("/api/connectors/dispatch", "POST", {
        webhookUrl,
        secret: webhookSecret,
        targetPlatform: webhookPreset,
        payload: {
          event: "wake.automation.test",
          timestamp: new Date().toISOString(),
          projectId: projectId || "wake-v6-main",
          samplePacket: {
            title: "Hostile Test Pipeline Packet",
            hook: "Why 99% of automation workflows fail silently in production",
            summary: "Validated end-to-end webhook delivery packet with cryptographic signature."
          }
        }
      });
      setWebhookTestResult(res);
    } catch (err) {
      setWebhookTestResult({ ok: false, statusCode: 500, error: err.message });
    } finally {
      setWebhookTesting(false);
    }
  };

  const handleAddWatcher = async (e) => {
    e.preventDefault();
    if (!newWatchPath.trim()) return;
    setBusy(true);
    try {
      const res = await api("/api/watchers", "POST", {
        path: newWatchPath.trim(),
        projectId: projectId || state?.projects?.[0]?.id || "wake-v6-main"
      });
      if (res?.ok) {
        setNewWatchPath("");
        await loadWatchers();
      } else {
        throw new Error(res?.error || "Failed to add watcher.");
      }
    } catch (err) {
      if (setOperationError) setOperationError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveWatcher = async (watcherId) => {
    setBusy(true);
    try {
      await api(`/api/watchers/${watcherId}`, "DELETE");
      await loadWatchers();
    } catch (err) {
      if (setOperationError) setOperationError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDispatchSocialPost = async (postId) => {
    setDispatchingId(postId);
    try {
      const res = await api(`/api/publishing/dispatch/${postId}`, "POST");
      if (res?.ok) {
        await loadPublishingData();
      }
    } catch (err) {
      if (setOperationError) setOperationError(err.message);
    } finally {
      setDispatchingId(null);
    }
  };

  const handleDeleteSocialPost = async (postId) => {
    try {
      await api(`/api/publishing/${postId}`, "DELETE");
      await loadPublishingData();
    } catch {}
  };

  return (
    <Panel className="automations-panel">
      <PanelTitle icon={Clock} title="Scheduler, Webhooks & Automations" />
      <div
        className="monitor-grid"
        style={{ marginBottom: "1rem", padding: "1rem", borderBottom: "1px solid var(--border)", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
      >
        <button
          className={tab === "active" ? "primary-action" : "mini-action"}
          onClick={() => setTab("active")}
        >
          Active Automations
        </button>
        <button
          className={tab === "publishing" ? "primary-action" : "mini-action"}
          onClick={() => setTab("publishing")}
        >
          <Share2 size={14} style={{ marginRight: "4px" }} /> Social Publishing Queue ({publishingQueue.length})
        </button>
        <button
          className={tab === "webhooks" ? "primary-action" : "mini-action"}
          onClick={() => setTab("webhooks")}
        >
          <Globe size={14} style={{ marginRight: "4px" }} /> Webhooks & Integrations
        </button>
        <button
          className={tab === "watchers" ? "primary-action" : "mini-action"}
          onClick={() => setTab("watchers")}
        >
          <FolderPlus size={14} style={{ marginRight: "4px" }} /> Folder Watchers ({watchers.length})
        </button>
        <button
          className={tab === "review" ? "primary-action" : "mini-action"}
          onClick={() => setTab("review")}
        >
          Review Queue ({reviewQueue.length})
        </button>
        <button
          className={tab === "history" ? "primary-action" : "mini-action"}
          onClick={() => setTab("history")}
        >
          Run History
        </button>
      </div>

      <div style={{ padding: "0 1rem 1rem 1rem" }}>
        {tab === "active" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3>Configured Automations</h3>
              <button
                className="primary-action"
                onClick={() =>
                  setEditor({ projectId: projectId || state?.projects?.[0]?.id || "wake-v6-main", campaignType: "Custom Prompt", scheduleCron: "0 19 * * 0", timeZone: "America/Los_Angeles", approvalMode: "Review Required" })
                }
              >
                <Plus size={16} /> New Automation
              </button>
            </div>
            <div className="library-list">
              {automations.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    marginBottom: "0.5rem",
                    background: "var(--surface)"
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "1.1rem", display: "block", marginBottom: "0.25rem" }}>
                      {a.name || a.campaignType}
                    </strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      Schedule: <code>{a.scheduleCron}</code> ({a.timeZone}) • Mode: {a.approvalMode} • Status:{" "}
                      <span style={{ color: a.enabled ? "var(--live)" : "var(--text-muted)" }}>
                        {a.enabled ? "Active" : "Paused"}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="mini-action" onClick={() => handleToggle(a.id, !a.enabled)} disabled={busy}>
                      {a.enabled ? "Pause" : "Resume"}
                    </button>
                    <button className="mini-action" onClick={() => handleRun(a.id)} disabled={busy}>
                      Run Now
                    </button>
                    <button className="mini-action" onClick={() => setEditor(a)} disabled={busy}>
                      Edit
                    </button>
                    <button className="mini-action" onClick={() => handleDelete(a.id)} disabled={busy}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {!automations.length && <p style={{ color: "var(--text-muted)" }}>No automations configured.</p>}
            </div>
          </div>
        )}

        {/* Social Publishing Queue Tab */}
        {tab === "publishing" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ margin: 0 }}>Direct Social Publishing & Staging Queue</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  Review, approve, and dispatch scheduled posts and video reels directly to connected platform channels.
                </p>
              </div>
            </div>

            {/* Connected Accounts Status Strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {publishingAccounts.map((acc) => (
                <div key={acc.accountId} style={{ padding: "0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "0.85rem", textTransform: "capitalize" }}>{acc.platform}</strong>
                    <span style={{ fontSize: "0.7rem", color: "var(--live)", display: "flex", alignItems: "center", gap: "3px" }}>
                      <CheckCircle2 size={12} /> Connected
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{acc.handles}</div>
                </div>
              ))}
            </div>

            {/* Staging Queue List */}
            <div className="library-list">
              {publishingQueue.map((item) => {
                const isDelivered = item.status === "published";
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: "1rem",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      marginBottom: "0.75rem",
                      background: "var(--surface)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start"
                    }}
                  >
                    <div style={{ flex: 1, marginRight: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span className="badge" style={{ background: "rgba(0,255,200,0.1)", color: "var(--live)", border: "1px solid var(--live)", padding: "1px 6px", borderRadius: "8px", fontSize: "0.7rem", textTransform: "uppercase" }}>
                          {item.platform}
                        </span>
                        <strong style={{ fontSize: "1rem" }}>{item.title}</strong>
                        <span style={{ fontSize: "0.75rem", color: isDelivered ? "var(--live)" : "var(--text-muted)" }}>
                          • {item.status.toUpperCase()}
                        </span>
                      </div>

                      <p style={{ margin: "4px 0 6px 0", fontSize: "0.85rem", color: "var(--text-muted)", maxHeight: "60px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.content}
                      </p>

                      {item.receipt && (
                        <div style={{ fontSize: "0.75rem", color: "var(--live)", background: "rgba(0,255,200,0.05)", padding: "4px 8px", borderRadius: "4px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span>Delivered:</span>
                          <a href={item.receipt.postUrl} target="_blank" rel="noreferrer" style={{ color: "var(--live)", textDecoration: "underline", display: "flex", alignItems: "center", gap: "3px" }}>
                            {item.receipt.postUrl} <ExternalLink size={11} />
                          </a>
                          <span>({item.receipt.latencyMs}ms)</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      {!isDelivered && (
                        <button
                          className="primary-action"
                          type="button"
                          disabled={dispatchingId === item.id}
                          onClick={() => handleDispatchSocialPost(item.id)}
                          style={{ fontSize: "0.8rem", padding: "4px 8px", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <Send size={13} /> {dispatchingId === item.id ? "Publishing..." : "Publish Now"}
                        </button>
                      )}
                      <button
                        className="mini-action"
                        type="button"
                        onClick={() => handleDeleteSocialPost(item.id)}
                        style={{ fontSize: "0.8rem", padding: "4px 6px" }}
                        title="Delete from Queue"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {!publishingQueue.length && (
                <div style={{ textAlign: "center", padding: "2rem", border: "1px dashed var(--border)", borderRadius: "var(--radius)", color: "var(--text-muted)" }}>
                  No posts currently staged in the publishing queue. Stage days from the 30-Day Matrix or Creator Tab to queue direct dispatch.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "webhooks" && (
          <div>
            <h3>Outbound Webhook Pipeline & Connectors</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
              Configure live webhooks with HMAC-SHA256 signatures to dispatch approved campaign packets directly to n8n, Make, Zapier, or custom worker endpoints.
            </p>

            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1.25rem", background: "var(--surface)", maxWidth: "680px" }}>
              <h4 style={{ margin: "0 0 1rem 0" }}>Interactive Webhook Dispatch Tester</h4>
              <form onSubmit={handleTestWebhook} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Connector Target Preset</label>
                  <select
                    className="chat-input"
                    value={webhookPreset}
                    onChange={(e) => setWebhookPreset(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="n8n">n8n Automation Node (HTTP Trigger)</option>
                    <option value="make">Make / Integromat Custom Webhook</option>
                    <option value="zapier">Zapier Catch Hook</option>
                    <option value="custom">Custom Internal API Gateway</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Target Webhook Endpoint URL</label>
                  <input
                    type="url"
                    className="chat-input"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-n8n-instance.com/webhook/wake-dispatch"
                    required
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>HMAC Signature Secret (Optional)</label>
                  <input
                    type="password"
                    className="chat-input"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="whsec_..."
                    style={{ width: "100%" }}
                  />
                  <small style={{ color: "var(--text-muted)", display: "block", marginTop: "2px" }}>
                    When provided, requests include an <code>X-Wake-Signature</code> header with SHA-256 HMAC.
                  </small>
                </div>

                <button type="submit" className="primary-action" disabled={webhookTesting} style={{ alignSelf: "flex-start" }}>
                  <Send size={16} /> {webhookTesting ? "Dispatching Packet..." : "Dispatch Test Payload"}
                </button>
              </form>

              {webhookTestResult && (
                <div
                  style={{
                    marginTop: "1.25rem",
                    padding: "0.75rem",
                    borderRadius: "var(--radius)",
                    border: `1px solid ${webhookTestResult.ok ? "var(--live)" : "var(--error, #e53e3e)"}`,
                    background: "rgba(0, 0, 0, 0.2)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <ShieldCheck size={18} color={webhookTestResult.ok ? "var(--live)" : "var(--error, #e53e3e)"} />
                      <strong>
                        {webhookTestResult.ok ? "Delivery Verified (200 OK)" : `Delivery Error (${webhookTestResult.statusCode || "Failed"})`}
                      </strong>
                    </div>
                    {webhookTestResult.latencyMs !== undefined && (
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        Latency: {webhookTestResult.latencyMs}ms
                      </span>
                    )}
                  </div>
                  {webhookTestResult.responseSummary && (
                    <pre style={{ fontSize: "0.8rem", overflowX: "auto", margin: 0, padding: "0.5rem", background: "var(--background)", borderRadius: "4px" }}>
                      {webhookTestResult.responseSummary}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "watchers" && (
          <div>
            <h3>Real-Time Folder Watchers</h3>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
              Monitors designated local folders for newly dropped text, markdown, audio transcripts, or client briefs and automatically triggers source ingestion.
            </p>

            <form onSubmit={handleAddWatcher} style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <input
                type="text"
                placeholder="C:\\Users\\...\\wake-engine\\intake-dropzone"
                value={newWatchPath}
                onChange={(e) => setNewWatchPath(e.target.value)}
                className="chat-input"
                style={{ flex: 1 }}
                required
              />
              <button type="submit" className="primary-action" disabled={busy}>
                <Plus size={16} /> Attach Directory
              </button>
            </form>

            <div className="library-list">
              {watchers.map((w) => (
                <div
                  key={w.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    marginBottom: "0.5rem",
                    background: "var(--surface)"
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "1.05rem", display: "block", marginBottom: "0.2rem" }}>
                      {w.path}
                    </strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      Project: {w.projectId} • Detected Drops: {w.filesDetectedCount || 0} • Status:{" "}
                      <span style={{ color: w.active ? "var(--live)" : "var(--text-muted)" }}>
                        {w.active ? "Monitoring Active" : "Idle"}
                      </span>
                    </div>
                  </div>
                  <button className="mini-action" onClick={() => handleRemoveWatcher(w.id)}>
                    <Trash2 size={16} /> Detach
                  </button>
                </div>
              ))}
              {!watchers.length && (
                <p style={{ color: "var(--text-muted)" }}>
                  No active folder watchers. Attach a local directory above to enable automatic intake on file drop.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "review" && (
          <div>
            <h3>Pending Review</h3>
            <div className="library-list">
              {reviewQueue.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: "1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    marginBottom: "0.5rem",
                    background: "var(--surface)"
                  }}
                >
                  <strong style={{ fontSize: "1.1rem", display: "block" }}>{r.campaignType || "Draft Packet"}</strong>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    Run ID: {r.id} • Created: {new Date(r.createdAt || Date.now()).toLocaleString()}
                  </div>
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                    <button
                      className="primary-action"
                      onClick={() => setModal({ type: "review", data: r })}
                    >
                      View Generated Packet
                    </button>
                  </div>
                </div>
              ))}
              {!reviewQueue.length && <p style={{ color: "var(--text-muted)" }}>No drafts currently waiting for operator review.</p>}
            </div>
          </div>
        )}

        {tab === "history" && (
          <div>
            <h3>Execution History</h3>
            <div className="library-list">
              {runs.map((h) => (
                <div
                  key={h.id}
                  style={{
                    padding: "0.75rem 1rem",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    marginBottom: "0.5rem",
                    background: "var(--surface)",
                    fontSize: "0.9rem"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{h.campaignType || "Scheduled Run"}</strong>
                    <span style={{ color: h.status === "completed" ? "var(--live)" : "var(--text-muted)" }}>
                      Status: {h.status}
                    </span>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                    {new Date(h.timestamp || Date.now()).toLocaleString()} • Automation ID: {h.automationId}
                  </div>
                </div>
              ))}
              {!runs.length && <p style={{ color: "var(--text-muted)" }}>No automation history recorded.</p>}
            </div>
          </div>
        )}
      </div>

      {editor && (
        <div className="modal-backdrop" onClick={() => setEditor(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editor.id ? "Edit Automation" : "New Automation"}</h3>
            <form onSubmit={handleSaveEditor} className="automation-form" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label htmlFor="auto-name">Name</label>
                <input
                  id="auto-name"
                  aria-label="Name"
                  type="text"
                  className="chat-input"
                  value={editor.name || ""}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="auto-proj">Project ID</label>
                <input
                  id="auto-proj"
                  aria-label="Project ID"
                  type="text"
                  className="chat-input"
                  value={editor.projectId || ""}
                  onChange={(e) => setEditor({ ...editor, projectId: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="auto-src">Source Directory</label>
                <input
                  id="auto-src"
                  aria-label="Source Directory"
                  type="text"
                  className="chat-input"
                  value={editor.sourceDir || ""}
                  onChange={(e) => setEditor({ ...editor, sourceDir: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="auto-camp">Campaign Type</label>
                <input
                  id="auto-camp"
                  aria-label="Campaign Type"
                  type="text"
                  className="chat-input"
                  value={editor.campaignType || ""}
                  onChange={(e) => setEditor({ ...editor, campaignType: e.target.value })}
                  required
                />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label htmlFor="auto-ask" style={{ margin: 0 }}>Operator Ask (Strategist context)</label>
                  <SpeechToTextButton
                    onTranscript={(text) => setEditor((prev) => ({ ...prev, operatorAsk: prev.operatorAsk ? `${prev.operatorAsk} ${text}` : text }))}
                    label="Speak Ask"
                  />
                </div>
                <textarea
                  id="auto-ask"
                  aria-label="Operator Ask (Strategist context)"
                  className="chat-input"
                  value={editor.operatorAsk || ""}
                  onChange={(e) => setEditor({ ...editor, operatorAsk: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="auto-cron">Schedule Cron</label>
                <input
                  id="auto-cron"
                  aria-label="Schedule Cron"
                  type="text"
                  className="chat-input"
                  value={editor.scheduleCron || ""}
                  onChange={(e) => setEditor({ ...editor, scheduleCron: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="auto-tz">Time Zone</label>
                <input
                  id="auto-tz"
                  aria-label="Time Zone"
                  type="text"
                  className="chat-input"
                  value={editor.timeZone || ""}
                  onChange={(e) => setEditor({ ...editor, timeZone: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="auto-mode">Approval Mode</label>
                <select aria-label="Approval Mode" id="auto-mode" className="chat-input" value={editor.approvalMode || "Review Required"} onChange={(e) => setEditor({ ...editor, approvalMode: e.target.value })}>
                  <option value="Review Required">Review Required</option>
                  <option value="Auto Approved">Auto Approved</option>
                  <option value="Auto Export">Auto Export</option>
                </select>
              </div>
              <div>
                <label htmlFor="auto-export">Export Directory</label>
                <input
                  id="auto-export"
                  aria-label="Export Directory"
                  type="text"
                  className="chat-input"
                  value={editor.exportDir || ""}
                  onChange={(e) => setEditor({ ...editor, exportDir: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" className="mini-action" onClick={() => setEditor(null)}>
                  Cancel
                </button>
                <button type="submit" className="primary-action" disabled={busy}>
                  Save Automation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Panel>
  );
}

export const AutomationsTab = AutomationsPanel;
