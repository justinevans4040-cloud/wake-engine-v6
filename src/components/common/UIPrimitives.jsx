import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { statusTone } from "../../app-config.jsx";

export function SpeechToTextButton({
  onTranscript,
  className = "",
  size = 14,
  label = "Voice",
  title = "Speak to text (voice dictation)"
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(Recognition));
  }, []);

  const toggleListening = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      alert("Speech recognition is not supported in this browser environment.");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setListening(true);
      };

      recognition.onresult = (event) => {
        const text = Array.from(event.results || [])
          .map((r) => r?.[0]?.transcript || "")
          .join(" ")
          .trim();
        if (text && onTranscript) {
          onTranscript(text);
        }
      };

      recognition.onerror = () => {
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      className={`speech-mic-btn mini-action ${listening ? "listening" : ""} ${className}`}
      onClick={toggleListening}
      title={listening ? "Listening... click to stop" : title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 8px",
        fontSize: "0.75rem",
        background: listening ? "rgba(255, 60, 60, 0.2)" : "rgba(56, 207, 255, 0.08)",
        color: listening ? "#ff4d4d" : "var(--cyan)",
        border: listening ? "1px solid #ff4d4d" : "1px solid rgba(56, 207, 255, 0.3)",
        borderRadius: "4px",
        cursor: "pointer",
        transition: "all 0.15s ease"
      }}
    >
      {listening ? <Mic size={size} style={{ animation: "pulse 1s infinite" }} /> : <Mic size={size} />}
      {label && <span>{listening ? "Listening..." : label}</span>}
    </button>
  );
}

export function Pill({ children, tone = "queued" }) {
  return <span className={`pill ${statusTone[tone] || tone}`}>{children}</span>;
}

export function Panel({ className = "", children }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

export function PanelTitle({ icon: Icon, title, right }) {
  return (
    <div className="panel-title">
      <div className="panel-title-main">
        <Icon size={20} />
        <span>{title}</span>
      </div>
      {right}
    </div>
  );
}

export function StudioCard({ icon: Icon, label, children, tone = "cyan" }) {
  return (
    <div className={`studio-card studio-card-${tone}`}>
      <div className="studio-card-head">
        <Icon size={16} />
        <span>{label}</span>
      </div>
      <div className="studio-card-body">{children}</div>
    </div>
  );
}

export function MonitorTile({ icon: Icon, label, value, detail, tone = "live", onClick }) {
  return (
    <button type="button" className={`monitor-tile monitor-tile-${tone} ${onClick ? "clickable" : ""}`} onClick={onClick}>
      <div className="monitor-tile-top">
        <Icon size={16} />
        <span>{label}</span>
      </div>
      <div className="monitor-tile-value">{value}</div>
      {detail && <div className="monitor-tile-detail">{detail}</div>}
    </button>
  );
}

export function Sparkline({ label, values, tone = "cyan", onClick }) {
  const points = (values?.length ? values : [0, 0, 0, 0, 0, 0, 0, 0]).slice(-8);
  const max = Math.max(100, ...points);
  const count = Math.max(1, points.length - 1);
  const path = points.map((p, i) => `${(i / count) * 100},${100 - (p / max) * 100}`).join(" ");
  return (
    <button type="button" className={`sparkline sparkline-${tone} ${onClick ? "clickable" : ""}`} onClick={onClick}>
      <div className="sparkline-head">
        <span>{label}</span>
        <strong>{points[points.length - 1]}%</strong>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="sparkline-svg">
        <polyline fill="none" stroke="currentColor" strokeWidth="6" points={path} />
      </svg>
    </button>
  );
}

export function OperatorGate({ operator, phrase, status, onOperatorChange, onPhraseChange, onSubmit }) {
  return (
    <main className="operator-gate-shell" aria-label="Wake Operator Gate">
      <form className="operator-gate" onSubmit={onSubmit}>
        <div className="operator-gate-emblem" aria-hidden="true">
          <img src="/assets/forgefront-systems-emblem.png" alt="ForgeFront Systems" />
        </div>
        <small>ForgeFront Systems :: Session Authorization</small>
        <h1>WAKE ENGINE V6</h1>
        <p>Enter operator credentials for this local desktop runtime. All actions remain on this device.</p>
        <div className="operator-fields">
          <label className="operator-field">
            <span>Operator</span>
            <input
              value={operator}
              onChange={(event) => onOperatorChange(event.target.value)}
              placeholder="OPERATOR CALLSIGN"
              aria-label="Operator callsign"
            />
          </label>
          <label className="operator-field">
            <span>Session Phrase</span>
            <input
              type="password"
              value={phrase}
              onChange={(event) => onPhraseChange(event.target.value)}
              placeholder="ENTER PHRASE"
              aria-label="Session phrase"
            />
          </label>
        </div>
        <div className="operator-gate-status">
          <span className="status-dot" />
          <strong>{status}</strong>
        </div>
        <button type="submit" className="primary-action">
          Enter WAKE Engine
        </button>
      </form>
    </main>
  );
}

export function jsonBlock(value) {
  return JSON.stringify(value, null, 2);
}

export function outputTitle(output) {
  return output?.title || output?.frame?.title || output?.sourceInbox?.title || "Current Output";
}

export function sourceDocumentBody(value) {
  const text = String(value || "");
  const marker = text.search(/^##\s+Extracted Content\s*$/im);
  return marker >= 0 ? text.slice(marker).replace(/^##\s+Extracted Content\s*$/im, "").trim() : text;
}

export function chatProviderLabel(chat, llmStatus) {
  if (!chat) return llmStatus?.live ? llmStatus.model || "Ollama" : "Instant Local Draft";
  if (chat.providerLabel) return chat.providerLabel;
  if (chat.provider === "ollama") return chat.model || llmStatus?.model || "Ollama";
  if (chat.provider === "streaming") return "Connecting";
  if (chat.provider === "error") return "Error";
  return "Instant Local Draft";
}

export function metricValue(value, suffix = "%") {
  if (value === null || value === undefined) return "--";
  return `${value}${suffix}`;
}

export function buildExportPreview(output, savedExport = null) {
  if (!output) return null;
  const title = outputTitle(output);
  const markdown = savedExport?.files?.markdown || output.markdown || `# ${title}\n\n${output.frame?.objective || ""}`;
  const json = savedExport?.files?.json || jsonBlock(output);
  return { title, markdown, json };
}
