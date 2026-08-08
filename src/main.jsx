import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Archive,
  Bot,
  BookOpen,
  Box,
  Camera,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  Clapperboard,
  Clipboard,
  Clock,
  Code2,
  Cpu,
  Database,
  Download,
  Edit2,
  FileText,
  Filter,
  Gauge,
  HardDrive,
  Heart,
  Hexagon,
  Images,
  Info,
  Layers,
  Library,
  ListChecks,
  Megaphone,
  MemoryStick,
  MessageCircle,
  MessageSquare,
  Mic,
  MicOff,
  Pause,
  Play,
  Plus,
  Radio,
  Repeat2,
  RotateCcw,
  Route,
  Save,
  Search,
  Send,
  Share2,
  Shield,
  Sparkles,
  Square,
  Target,
  TerminalSquare,
  TextQuote,
  Trash2,
  Vault,
  Volume2,
  VolumeX,
  WandSparkles,
  Workflow,
  Zap
} from "lucide-react";
import { api, apiStream } from "./api";
import {
  abilityAgentDefaults,
  abilityBlueprints,
  bootLines,
  emblemSrc,
  polishPrompts,
  statusTone,
  tabs,
  voicePresets
} from "./app-config.jsx";
import "./styles.css";

const BOOT_SEQUENCE_MS = 6500;
const standaloneRoutes = new Set(["instructions", "automations"]);

function Pill({ children, tone = "queued" }) {
  return <span className={`pill ${statusTone[tone] || tone}`}>{children}</span>;
}

function Panel({ className = "", children }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

function PanelTitle({ icon: Icon, title, right }) {
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

function jsonBlock(value) {
  return JSON.stringify(value, null, 2);
}

function outputTitle(output) {
  return output?.title || output?.frame?.title || output?.sourceInbox?.title || "Current Output";
}

function sourceDocumentBody(value) {
  const text = String(value || "");
  const marker = text.search(/^##\s+Extracted Content\s*$/im);
  return marker >= 0 ? text.slice(marker).replace(/^##\s+Extracted Content\s*$/im, "").trim() : text;
}

function chatProviderLabel(chat, llmStatus) {
  if (!chat) return llmStatus?.live ? llmStatus.model || "Ollama" : "Instant Local Draft";
  if (chat.providerLabel) return chat.providerLabel;
  if (chat.provider === "ollama") return chat.model || llmStatus?.model || "Ollama";
  if (chat.provider === "streaming") return "Connecting";
  if (chat.provider === "error") return "Error";
  return "Instant Local Draft";
}

function buildExportPreview(output, savedExport = null) {
  if (!output) return null;
  const requiredSections = output.exportManifest?.requiredSections || [];
  return {
    status: savedExport ? "saved" : "ready",
    title: outputTitle(output),
    packetContract: output.packetContract || savedExport?.packetContract || null,
    requiredSections,
    counts: {
      evidence: output.evidenceMap?.length || output.quoteEvidencePack?.evidence?.length || 0,
      claims: output.claimMap?.length || output.quoteEvidencePack?.claims?.length || 0,
      scripts: output.scripts?.length || 0,
      variants: output.platformVariants?.length || 0,
      a2aMessages: output.a2aTrace?.length || 0,
      toolReceipts: output.toolTrace?.length || 0
    },
    qaVerdict: output.qaVerdict || output.tierZeroQa || output.qaGate || {},
    nextAction: output.nextAction || output.campaignPacket?.nextAction || output.operatorHandoff?.nextBestStep || "",
    filePaths: savedExport?.bundlePreview?.filePaths || {
      relativeJsonPath: savedExport?.relativeJsonPath,
      relativeMdPath: savedExport?.relativeMdPath
    },
    inspection: savedExport?.inspection || null
  };
}

function metricValue(value, suffix = "%") {
  return value === null || value === undefined ? "READ" : `${value}${suffix}`;
}

function MonitorTile({ icon: Icon, label, value, detail, tone = "live", onClick }) {
  return (
    <button type="button" className={`monitor-tile ${tone}`} onClick={onClick}>
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </button>
  );
}

function Sparkline({ label, values, tone = "cyan", onClick }) {
  const safeValues = values.length ? values : [0];
  return (
    <button type="button" className={`sparkline ${tone}`} onClick={onClick}>
      <span>{label}</span>
      <div>
        {safeValues.slice(-28).map((value, index) => (
          <i key={`${label}-${index}`} style={{ height: `${Math.max(6, Math.min(100, value))}%` }} />
        ))}
      </div>
    </button>
  );
}

function OperatorGate({ operator, phrase, status, onOperatorChange, onPhraseChange, onSubmit }) {
  const diagnostics = [
    ["CORE", "LOCAL"],
    ["VAULT", "SEALED"],
    ["AGENTS", "ARMED"],
    ["TRACE", "READY"]
  ];

  return (
    <main className="operator-gate boot-terminal">
      <form className="operator-console" onSubmit={onSubmit}>
        <div className="operator-scanline" aria-hidden="true" />
        <div className="operator-left">
          <div className="operator-orb">
            <span>W</span>
            <i />
          </div>
          <div className="operator-runes" aria-hidden="true">
            {diagnostics.map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
        <section className="operator-panel">
          <div className="operator-kicker">
            <TerminalSquare size={17} />
            <span>WAKE ENGINE V6</span>
          </div>
          <h1>Operator Login</h1>
          <div className="operator-readout" aria-live="polite">
            <span>{">"} local session gate online</span>
            <span>{">"} content runtime isolated</span>
            <span>{">"} {status}</span>
          </div>
          <label className="operator-field">
            <span>CALLSIGN</span>
            <input
              aria-label="Operator callsign"
              value={operator}
              onChange={(event) => onOperatorChange(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="operator-field">
            <span>ACCESS PHRASE</span>
            <input
              aria-label="Access phrase"
              value={phrase}
              onChange={(event) => onPhraseChange(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="operator-actions">
            <button type="submit" className="operator-enter" aria-label="Enter Wake Engine">
              <Shield size={18} />
              <span>Enter Wake Engine</span>
              <Zap size={18} />
            </button>
            <div className="operator-status">
              <span />
              <strong>{status}</strong>
            </div>
          </div>
        </section>
      </form>
    </main>
  );
}

function abilitySignals({ active, state, source, output, cluster, system, llmStatus, filteredSources }) {
  const hasOutput = output ? "ready" : "none";
  const sourceChars = source?.length || 0;
  const signals = {
    console: [
      ["Source", `${sourceChars.toLocaleString()} chars`],
      ["Output", hasOutput],
      ["Project", state.projects.find((project) => project.id === state.activeProjectId)?.name || `${state.projects.length} projects`]
    ],
    agent: [
      ["Agents", `${state.agentPipeline?.length || 0} live`],
      ["LLM", llmStatus?.live ? llmStatus.model || "live" : "local fallback"],
      ["Chats", `${state.recentGenerations.filter((item) => item.kind === "agent-chat").length} saved`]
    ],
    cluster: [
      ["Pillars", cluster?.pillars?.length || 0],
      ["Lanes", cluster?.outputMatrix?.length || 0],
      ["Proof", cluster?.sourceInbox?.proofStatus || "pending"]
    ],
    vault: [
      ["Sources", state.runtime.sources],
      ["Media", state.mediaSummary?.total || 0],
      ["Shown", filteredSources?.length || 0]
    ],
    library: [
      ["Saved", state.runtime.sources],
      ["Generated", state.runtime.generations],
      ["Exports", state.runtime.exports]
    ],
    instructions: [
      ["Guide", "manual workflow"],
      ["Input", "operator goal"],
      ["Route", "standalone"]
    ],
    automations: [
      ["Automations", state.automations?.length || 0],
      ["Review", state.reviewQueue?.length || 0],
      ["Runs", state.automationRuns?.length || 0]
    ],
    tasks: [
      ["CPU", metricValue(system?.cpu?.percent)],
      ["RAM", metricValue(system?.memory?.percent)],
      ["Runtime", system?.runtime ? `:${system.runtime.port}` : ":8786"]
    ],
    snapshot: [
      ["Snapshots", state.runtime.snapshots],
      ["Exports", state.runtime.exports],
      ["History", state.recentHistory.length]
    ]
  };
  const routeSignals = signals[active];
  if (!routeSignals) throw new Error(`Missing ability signals for route: ${active}`);
  return routeSignals;
}

function AbilityCommandHeader({ active, state, source, output, cluster, system, llmStatus, filteredSources, latestChat, operationError }) {
  const ability = abilityBlueprints[active];
  if (!ability) throw new Error(`Missing ability blueprint for route: ${active}`);
  const Icon = ability.icon;
  const signals = abilitySignals({ active, state, source, output, cluster, system, llmStatus, filteredSources });
  const readyByAbility = {
    console: Boolean(output),
    agent: Boolean(latestChat?.answer || output),
    cluster: Boolean(cluster),
    vault: Boolean(filteredSources?.length),
    library: Boolean(state.recentSources?.length || state.recentGenerations?.length || state.recentExports?.length),
    instructions: false,
    automations: Boolean(state.automations?.length || state.reviewQueue?.length || state.automationRuns?.length),
    tasks: Boolean(system),
    snapshot: Boolean(state.runtime?.snapshots)
  };
  const ready = readyByAbility[active];
  const stateTone = operationError ? "partial" : ready ? "done" : "queued";
  return (
    <Panel className="ability-command">
      <div className="ability-hero">
        <div className="ability-icon">
          <Icon size={30} />
        </div>
        <div>
          <small>{ability.eyebrow}</small>
          <h2>{ability.title}</h2>
          <p>{ability.mission}</p>
        </div>
        <div className="ability-contract">
          <span>Input: <strong>{ability.input}</strong></span>
          <span>Output: <strong>{ability.output}</strong></span>
        </div>
      </div>
      <div className="ability-signal-grid">
        {signals.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="done-when">
        <span>Done when</span>
        {ability.doneWhen.map((item) => (
          <Pill key={item} tone="done">{item}</Pill>
        ))}
      </div>
      <div className="ability-route-strip">
        <div className="ability-output-destination">
          <span>Output destination</span>
          <strong>{ability.outputDestination}</strong>
        </div>
        <div>
          <span>Primary action</span>
          <strong>{ability.primaryAction}</strong>
        </div>
        <div>
          <span>Continue</span>
          <strong>{ability.continueRoute}</strong>
        </div>
      </div>
      <div className={`ability-state ${operationError ? "error" : ready ? "ready" : "empty"}`} role={operationError ? "alert" : "status"}>
        <Pill tone={stateTone}>{operationError ? "error" : ready ? "ready" : "empty"}</Pill>
        <div>
          <strong>{operationError ? `${operationError.action} failed` : ready ? `${ability.outputDestination} ready` : `${ability.outputDestination} waiting`}</strong>
          <span>{operationError?.message || (ready ? "This ability has a visible result and a continuation route." : `Use ${ability.primaryAction} to create the first result for this ability.`)}</span>
        </div>
      </div>
    </Panel>
  );
}

function AbilityActionRail({
  active,
  busy,
  hasSource,
  output,
  cluster,
  onGo,
  onSaveSource,
  onGenerateFrame,
  onRunAgent,
  onBuildCluster,
  onExport,
  onSaveSnapshot,
  onRunIntake,
  onOpenFolder
}) {
  const actionSets = {
    console: [
      ["Save Source", Save, onSaveSource, false],
      ["Generate Frame", Zap, onGenerateFrame, false],
      ["Build Cluster", Layers, onBuildCluster, false]
    ],
    agent: [
      ["Run Tier Zero Agents", Play, onRunAgent, !hasSource],
      ["Export Output", Download, onExport, !output],
      ["Open Cluster", Layers, () => onGo("cluster"), false]
    ],
    cluster: [
      ["Build Cluster", Zap, onBuildCluster, false],
      ["Export Cluster", Download, onExport, !cluster && !output],
      ["Open Library", Library, () => onGo("library"), false]
    ],
    vault: [
      ["Run Intake", Images, onRunIntake, false],
      ["Open Console", TerminalSquare, () => onGo("console"), false],
      ["Open Data", Database, () => onOpenFolder("data"), false]
    ],
    library: [
      ["Open Exports", Download, () => onOpenFolder("exports"), false],
      ["Open Console", TerminalSquare, () => onGo("console"), false],
      ["Save Snapshot", Camera, onSaveSnapshot, false]
    ],
    instructions: [
      ["Use Operations Guide", BookOpen, () => onGo("instructions"), false]
    ],
    automations: [
      ["Use Scheduler", Workflow, () => onGo("automations"), false]
    ],
    tasks: [
      ["Open Data", Database, () => onOpenFolder("data"), false],
      ["Save Snapshot", Camera, onSaveSnapshot, false],
      ["Continue Work", TerminalSquare, () => onGo("console"), false]
    ],
    snapshot: [
      ["Save Snapshot", Camera, onSaveSnapshot, false],
      ["Open Snapshots", Archive, () => onOpenFolder("snapshots"), false],
      ["Open Library", Library, () => onGo("library"), false]
    ]
  };
  const actions = actionSets[active];
  if (!actions) throw new Error(`Missing action set for route: ${active}`);
  return (
    <div className="ability-action-rail" aria-label="Ability actions">
      {actions.map(([label, Icon, action, disabled], index) => (
        <button key={label} type="button" data-primary-action={index === 0 ? "true" : undefined} disabled={busy || disabled} onClick={action}>
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function ActiveTaskSpine({ task, draft, setDraft, onSave }) {
  if (!task) return null;
  return (
    <Panel className="active-task-spine">
      <PanelTitle icon={Target} title="Active Task Spine" right={<Pill tone={task.status || "active"}>{task.status || "active"}</Pill>} />
      <div className="task-spine-grid">
        <label>
          <span>Task</span>
          <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <label>
          <span>Objective</span>
          <input value={draft.objective} onChange={(event) => setDraft((current) => ({ ...current, objective: event.target.value }))} />
        </label>
        <label>
          <span>Next action</span>
          <input value={draft.nextAction} onChange={(event) => setDraft((current) => ({ ...current, nextAction: event.target.value }))} />
        </label>
        <button type="button" className="primary-action" onClick={onSave}>
          Lock Task
          <Save size={16} />
        </button>
      </div>
    </Panel>
  );
}

function NextStepPanel({
  active,
  source,
  output,
  cluster,
  state,
  busy,
  onGo,
  onGenerateFrame,
  onRunAgent,
  onBuildCluster,
  onExport,
  onSaveSnapshot,
  onRunIntake
}) {
  const hasSource = Boolean(source?.trim());
  const qa = output?.tierZeroQa || output?.qaVerdict || null;
  const qaBlocked = qa?.verdict === "blocked" || qa?.passed === false || qa?.score?.passed === false;
  const page = tabs.find((item) => item.id === active);
  let step = null;

  if (active === "console") {
    if (!hasSource) {
      step = {
        title: "Paste the task or source",
        detail: "Wake Engine needs source material before it can frame, agent, cluster, or export anything.",
        button: "Stay in Console",
        action: () => onGo("console"),
        tone: "queued"
      };
    } else if (!output) {
      step = {
        title: "Generate the first frame",
        detail: "This converts the ask/source into a structured content packet so the next ability has something clean to work from.",
        button: "Generate Frame",
        action: onGenerateFrame,
        tone: "live"
      };
    } else {
      step = {
        title: "Deepen the packet",
        detail: "The frame exists. Next, run an agent for interpretation or build a cluster for a fuller operating map.",
        button: "Run Agent",
        action: onRunAgent,
        tone: "live"
      };
    }
  } else if (active === "agent") {
    step = !hasSource
      ? {
          title: "Choose source for this agent",
          detail: "Pick a saved source on this page or open Console to paste new source material before the agents answer.",
          button: "Open Console",
          action: () => onGo("console"),
          tone: "partial"
        }
      : qaBlocked
      ? {
          title: "Repair the blocked packet",
          detail: qa?.nextBestStep || qa?.nextAction || "Resolve the QA blockers before export.",
          button: "Open Console",
          action: () => onGo("console"),
          tone: "partial"
        }
      : output
      ? {
          title: "Package the agent output",
          detail: "The agent has produced usable work. Export it or send it into Cluster for organization.",
          button: "Export Output",
          action: onExport,
          tone: "live"
        }
      : {
          title: "Generate a source frame first",
          detail: "Agents work best after Console has framed the source. Go there if the current ask is still raw.",
          button: "Open Console",
          action: () => onGo("console"),
          tone: "partial"
        };
  } else if (active === "cluster") {
    step = qaBlocked
      ? {
          title: "Repair the blocked cluster",
          detail: qa?.nextBestStep || qa?.nextAction || "Resolve the QA blockers before export.",
          button: "Open Console",
          action: () => onGo("console"),
          tone: "partial"
        }
      : cluster
      ? {
          title: "Export the cluster",
          detail: "The cluster is complete enough to become a handoff packet.",
          button: "Export Output",
          action: onExport,
          tone: "live"
        }
      : {
          title: "Build the cluster",
          detail: "Turn the current source into pillars, output lanes, proof notes, and handoff drafts.",
          button: "Build Cluster",
          action: onBuildCluster,
          tone: "live"
        };
  } else if (active === "vault") {
    step = {
      title: state.runtime.sources ? "Load a source into Console" : "Run intake",
      detail: state.runtime.sources
        ? "Pick the best source from the Vault, then frame it in Console."
        : "Scan your configured local source folders so the engine has material to work with.",
      button: state.runtime.sources ? "Open Console" : "Run Intake",
      action: state.runtime.sources ? () => onGo("console") : onRunIntake,
      tone: "live"
    };
  } else if (active === "library") {
    step = {
      title: "Resume or ship saved work",
      detail: "Open a saved source/output, continue it in Console, or open exports if the work is ready to use.",
      button: "Open Console",
      action: () => onGo("console"),
      tone: "live"
    };
  } else if (active === "instructions") {
    step = {
      title: "Describe the operation",
      detail: "Use the Operations Guide to get a workflow grounded only in capabilities that WAKE currently implements.",
      button: "Use Operations Guide",
      action: () => onGo("instructions"),
      tone: "live"
    };
  } else if (active === "automations") {
    step = {
      title: "Configure or review an automation",
      detail: "Use Scheduler & Automations to create, pause, run, or inspect scheduled local work.",
      button: "Use Scheduler",
      action: () => onGo("automations"),
      tone: "live"
    };
  } else if (active === "tasks") {
    step = {
      title: "Return to the workbench",
      detail: "Monitor tells you what is running and truthful. When the system is healthy, continue the task in Console.",
      button: "Open Console",
      action: () => onGo("console"),
      tone: "done"
    };
  } else if (active === "snapshot") {
    step = {
      title: "Save the receipt",
      detail: "Capture a snapshot after meaningful work so the local trail stays auditable.",
      button: "Save Snapshot",
      action: onSaveSnapshot,
      tone: "live"
    };
  }

  if (!step) throw new Error(`Missing next-step contract for route: ${active}`);

  return (
    <Panel className="next-step-panel">
      <PanelTitle icon={Route} title={`${page?.label || "WAKE"} Next Step`} right={<Pill tone={step.tone}>{step.tone}</Pill>} />
      <div className="next-step-body">
        <div>
          <strong>{step.title}</strong>
          <span>{step.detail}</span>
        </div>
        <button type="button" className="primary-action" disabled={busy} onClick={step.action}>
          {step.button}
          <Zap size={16} />
        </button>
      </div>
    </Panel>
  );
}

function StudioCard({ icon: Icon, label, children, tone = "cyan" }) {
  return (
    <article className={`studio-card ${tone}`}>
      <div className="studio-card-title">
        <Icon size={18} />
        <span>{label}</span>
      </div>
      {children}
    </article>
  );
}

function ExportPreviewPanel({ preview }) {
  if (!preview) return null;
  const inspection = preview.inspection;
  return (
    <div className="export-preview">
      <div className="export-preview-head">
        <div>
          <small>{preview.status === "saved" ? "Export Saved" : "Export Preview"}</small>
          <strong>{preview.title}</strong>
          {preview.packetContract ? <span>{preview.packetContract.id} v{preview.packetContract.version}</span> : null}
        </div>
        <Pill tone={inspection?.ok === false ? "warn" : preview.status === "saved" ? "done" : "live"}>
          {inspection ? (inspection.ok ? "inspected" : "blocked") : "ready"}
        </Pill>
      </div>
      <div className="export-preview-grid">
        {Object.entries(preview.counts || {}).map(([label, value]) => (
          <span key={label}><strong>{value}</strong><small>{label}</small></span>
        ))}
      </div>
      <div className="claim-list">
        <div>
          <Pill tone="live">next</Pill>
          <span>{preview.nextAction || "Review QA, then export."}</span>
        </div>
        {inspection?.missing?.length ? (
          <div>
            <Pill tone="warn">missing</Pill>
            <span>{inspection.missing.join(", ")}</span>
          </div>
        ) : null}
        {preview.filePaths?.relativeMdPath ? (
          <div>
            <Pill tone="done">md</Pill>
            <span>{preview.filePaths.relativeMdPath}</span>
          </div>
        ) : null}
        {preview.filePaths?.relativeJsonPath ? (
          <div>
            <Pill tone="done">json</Pill>
            <span>{preview.filePaths.relativeJsonPath}</span>
          </div>
        ) : null}
      </div>
      <details className="raw-output">
        <summary>Inspect Export Preview</summary>
        <pre>{jsonBlock(preview)}</pre>
      </details>
    </div>
  );
}

const campaignPlatforms = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" }
];

function PlatformMedia({ platform }) {
  if (platform?.image?.url) {
    return <img src={platform.image.url} alt={`Original ${platform.label} campaign creative`} />;
  }
  return (
    <div className="platform-media-empty">
      <Images size={34} />
      <strong>Original image pending</strong>
      <span>{platform?.imageStatus === "provider-required" ? "Image engine connection required" : "Image generation did not complete"}</span>
    </div>
  );
}

function PlatformPreview({ platform }) {
  if (!platform) return null;
  const account = platform.account || "Current Project";
  if (platform.id === "tiktok") {
    return (
      <article className="native-preview tiktok-preview" aria-label="TikTok campaign preview">
        <div className="native-media"><PlatformMedia platform={platform} /></div>
        <div className="tiktok-top"><span>Following</span><strong>For You</strong></div>
        <div className="tiktok-actions"><Heart /><MessageCircle /><Share2 /></div>
        <div className="tiktok-copy"><strong>@{account.replace(/\s+/g, "").toLowerCase()}</strong><p>{platform.caption}</p><span>{(platform.hashtags || []).join(" ")}</span></div>
      </article>
    );
  }
  if (platform.id === "instagram") {
    return (
      <article className="native-preview instagram-preview" aria-label="Instagram campaign preview">
        <header><div className="native-avatar">{account.slice(0, 1)}</div><strong>{account}</strong><span>•••</span></header>
        <div className="native-media"><PlatformMedia platform={platform} /></div>
        <div className="instagram-actions"><span><Heart /><MessageCircle /><Send /></span><Archive /></div>
        <p><strong>{account}</strong> {platform.caption}</p>
      </article>
    );
  }
  if (platform.id === "x") {
    return (
      <article className="native-preview x-preview" aria-label="X campaign preview">
        <header><div className="native-avatar">{account.slice(0, 1)}</div><div><strong>{account}</strong><span>@{account.replace(/\s+/g, "").toLowerCase()} · now</span></div></header>
        <p>{platform.caption}</p>
        <div className="native-media"><PlatformMedia platform={platform} /></div>
        <footer><MessageCircle /><Repeat2 /><Heart /><Share2 /></footer>
      </article>
    );
  }
  return (
    <article className="native-preview linkedin-preview" aria-label="LinkedIn campaign preview">
      <header><div className="native-avatar">{account.slice(0, 1)}</div><div><strong>{account}</strong><span>Just now · Public</span></div></header>
      <p>{platform.caption}</p>
      <div className="native-media"><PlatformMedia platform={platform} /></div>
      <footer><span><Heart size={16} /> Like</span><span><MessageCircle size={16} /> Comment</span><span><Repeat2 size={16} /> Repost</span><span><Send size={16} /> Send</span></footer>
    </article>
  );
}

function CampaignAutopilot({
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
            <Pill tone={imageGeneration?.configured ? "live" : "partial"}>{imageGeneration?.configured ? "image engine ready" : imageGeneration?.consentRequired ? "images need approval" : "image engine offline"}</Pill>
          </div>
        </div>
        <div className="autopilot-input-row">
          <textarea value={direction} onChange={(event) => setDirection(event.target.value)} aria-label="Optional campaign direction" placeholder="Optional direction, idea, launch, offer, or constraint..." />
          <button type="button" className="autopilot-create" disabled={busy || !canCreate} onClick={onCreate}>
            {busy ? <Activity size={21} /> : <Sparkles size={21} />}
            <span>{busy ? "Creating Campaign" : "Create Campaign"}</span>
            <small>{direction.trim() ? "Use direction + project memory" : "Use project memory"}</small>
          </button>
        </div>
        <div className={`autopilot-progress ${busy ? "working" : ""}`} aria-live="polite">
          {["Research", "Write", "Design", "QA"].map((step) => <span key={step}><i />{step}</span>)}
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
              <Pill tone={campaign.qaVerdict?.passed || campaign.qaVerdict?.score?.passed ? "live" : "partial"}>QA {campaign.qaVerdict?.passed || campaign.qaVerdict?.score?.passed ? "passed" : "review"}</Pill>
              <button type="button" className="mini-action" onClick={onExport}><Download size={16} /> Export</button>
            </div>
          </header>
          <div className="platform-switcher" role="tablist" aria-label="Platform preview">
            {campaignPlatforms.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={selectedPlatform === item.id} className={selectedPlatform === item.id ? "selected" : ""} onClick={() => setSelectedPlatform(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="campaign-preview-layout">
            <div className="preview-stage"><PlatformPreview platform={platform} /></div>
            <aside className="campaign-copy-panel">
              <div><small>Hook</small><strong>{platform?.hook}</strong></div>
              <div><small>Caption</small><p>{platform?.caption}</p></div>
              {platform?.script?.length ? <div><small>Script</small><ol>{platform.script.slice(0, 6).map((beat, index) => <li key={`${beat.time || beat.beat}-${index}`}><span>{beat.time || beat.beat || `Beat ${index + 1}`}</span>{beat.line}</li>)}</ol></div> : null}
              <div><small>Call to action</small><p>{platform?.cta}</p></div>
              <div className="autopilot-next-step"><small>Next step</small><p>{campaign.nextAction}</p></div>
              <div className="campaign-copy-actions">
                <button type="button" onClick={() => navigator.clipboard?.writeText([platform?.hook, platform?.caption, platform?.cta].filter(Boolean).join("\n\n"))}><Clipboard size={16} /> Copy</button>
                <button type="button" disabled={imageBusy || !imageGeneration?.configured} onClick={onGenerateImage}><Images size={16} /> {imageBusy ? "Generating" : platform?.image ? "New Image" : "Generate Image"}</button>
                {platform?.image ? <button type="button" className="save-image-source-action" onClick={() => onSaveImageToSource(platform)}><Save size={16} /> Save Image to Source</button> : null}
                {!imageGeneration?.configured ? <button type="button" onClick={onOpenImageSetup}><Zap size={16} /> {imageGeneration?.consentRequired ? "Enable Images" : "Connect Image Engine"}</button> : null}
              </div>
              <details className="campaign-receipts"><summary>Creative direction and receipts</summary><p>{platform?.imagePrompt}</p><pre>{jsonBlock({ packet: campaign.packetSummary, images: campaign.generatedImages, nextAction: campaign.nextAction })}</pre></details>
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
          <textarea value={source} onChange={(event) => setSource(event.target.value)} aria-label="Source material" />
          <div className="source-actions"><span>{source.length} characters</span><button type="button" className="mini-action" onClick={onSaveSource}><Save size={16} /> Save Source</button></div>
        </div>
      </details>
    </section>
  );
}

function OutputStudio({ output }) {
  if (!output) {
    return (
      <div className="empty-studio">
        <WandSparkles size={26} />
        <strong>Output Studio waiting.</strong>
        <span>Save source, frame it, run the agent, build a cluster, then export.</span>
      </div>
    );
  }

  if (output.agentId && output.answer) {
    return (
      <div className="output-studio">
        <div className="studio-hero">
          <div>
            <small>Agent Conversation</small>
            <h2>{output.agentLabel}</h2>
            <p>{output.answer}</p>
          </div>
          <Pill tone={output.provider === "ollama" ? "live" : "partial"}>{output.provider}</Pill>
        </div>
        <div className="studio-grid compact">
          <StudioCard icon={MessageSquare} label="Question">
            <p>{output.message}</p>
          </StudioCard>
          <StudioCard icon={Archive} label="Retrieved Sources">
            <div className="claim-list">
              {(output.context?.sources || []).slice(0, 5).map((source) => (
                <div key={source.id}>
                  <Pill tone="live">{source.lane}</Pill>
                  <span>{source.title}</span>
                </div>
              ))}
            </div>
          </StudioCard>
          <StudioCard icon={Images} label="Retrieved Media">
            <div className="claim-list">
              {(output.context?.media || []).slice(0, 5).map((asset) => (
                <div key={asset.id}>
                  <Pill tone="live">{asset.kind}</Pill>
                  <span>{asset.title}</span>
                </div>
              ))}
            </div>
          </StudioCard>
        </div>
        <details className="raw-output">
          <summary>Inspect Raw Chat</summary>
          <pre>{jsonBlock(output)}</pre>
        </details>
      </div>
    );
  }

  if (output.sourceProfile && output.strategicBrief) {
    const qa = output.tierZeroQa || output.qaVerdict || output.qaGate || {};
    const rawQaScore = qa.score?.overall ?? qa.score?.score ?? qa.score;
    const qaScore = typeof rawQaScore === "number" ? rawQaScore : "READ";
    const qaPassed = qa.passed === true || qa.verdict === "pass" || qa.score?.passed === true;
    const rubricEntries = Object.entries(qa.score?.rubric || qa.rubric || {});
    return (
      <div className="output-studio">
        <div className="studio-hero">
          <div>
            <small>Production Packet</small>
            <h2>{output.frame?.title || output.sourceProfile.title}</h2>
            <p>{output.strategicBrief.promise}</p>
          </div>
          <div className={`qa-score ${qaPassed ? "pass" : "warn"}`}>
            <span>QA</span>
            <strong>{qaScore}</strong>
            <small>{qaPassed ? "passed" : "blocked"}</small>
          </div>
        </div>

        <div className="studio-grid production-grid">
          <StudioCard icon={Target} label="Source Profile">
            <dl>
              <dt>Lane</dt><dd>{output.sourceProfile.lane}</dd>
              <dt>Audience</dt><dd>{output.sourceProfile.audience}</dd>
              <dt>Source Type</dt><dd>{output.sourceProfile.sourceType}</dd>
            </dl>
          </StudioCard>
          <StudioCard icon={Route} label="Strategy">
            <p><strong>Tension:</strong> {output.strategicBrief.tension}</p>
            <p><strong>Transformation:</strong> {output.strategicBrief.transformation}</p>
            <p><strong>Takeaway:</strong> {output.strategicBrief.operatorTakeaway}</p>
          </StudioCard>
          <StudioCard icon={Clapperboard} label="Scene Plan">
            <div className="scene-list">
              {(output.scenePlan || []).map((scene) => (
                <div key={scene.time}>
                  <time>{scene.time}</time>
                  <strong>{scene.purpose}</strong>
                  <span>{scene.line}</span>
                </div>
              ))}
            </div>
          </StudioCard>
          <StudioCard icon={Megaphone} label="Platform Variants">
            <div className="variant-list">
              {(output.platformVariants || []).map((variant) => (
                <button key={variant.platform} type="button" onClick={() => navigator.clipboard?.writeText(`${variant.platform}\n${variant.hook}\n${variant.caption}\n${variant.cta}`)}>
                  <strong>{variant.platform}</strong>
                  <span>{variant.hook}</span>
                  <small>{variant.cta}</small>
                </button>
              ))}
            </div>
          </StudioCard>
          <StudioCard icon={TextQuote} label="Claim Map">
            <div className="claim-list">
              {(output.claimMap || []).slice(0, 6).map((claim) => (
                <div key={claim.id}>
                  <Pill tone={claim.publishable === false ? "partial" : "live"}>{claim.status || claim.risk}</Pill>
                  <span>{claim.sourceLine || claim.line}</span>
                </div>
              ))}
            </div>
          </StudioCard>
          <StudioCard icon={Shield} label="Accuracy And Quality">
            <div className="claim-list">
              {rubricEntries.map(([key, dimension]) => (
                <div key={key}>
                  <Pill tone={dimension.passed ? "live" : "partial"}>{dimension.score}</Pill>
                  <span>{key.replace(/([A-Z])/g, " $1").trim()}</span>
                </div>
              ))}
            </div>
          </StudioCard>
          <StudioCard icon={Route} label="Repair And Next Step">
            <p><strong>{qa.nextBestStep || qa.nextAction || output.nextAction}</strong></p>
            {(qa.repairSuggestions || []).length ? (
              <ul>{qa.repairSuggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul>
            ) : <p>No blocked QA repairs.</p>}
          </StudioCard>
          <StudioCard icon={Workflow} label="Operator Handoff">
            <dl>
              {Object.entries(output.operatorHandoff || {}).map(([role, value]) => (
                <React.Fragment key={role}>
                  <dt>{role}</dt>
                  <dd>{value}</dd>
                </React.Fragment>
              ))}
            </dl>
          </StudioCard>
          <StudioCard icon={Route} label="A2A Message Layer">
            <div className="claim-list">
              {(output.a2aTrace || []).slice(0, 8).map((message) => (
                <div key={message.id}>
                  <Pill tone={message.status === "acknowledged" ? "live" : "partial"}>{message.status}</Pill>
                  <span>{message.producer} {"->"} {message.consumer}: {message.intent}</span>
                </div>
              ))}
              {output.replayableHandoffs?.length ? (
                <div>
                  <Pill tone="done">{output.replayableHandoffs.length}</Pill>
                  <span>replayable handoffs persisted for this run</span>
                </div>
              ) : null}
            </div>
          </StudioCard>
        </div>

        <details className="raw-output">
          <summary>Production details and receipts</summary>
          <pre>{jsonBlock(output)}</pre>
        </details>
      </div>
    );
  }

  if (output.pillars && output.outputMatrix) {
    const platformEntries = Object.entries(output.platformLanes || {});
    const rawClusterQaScore = output.qaVerdict?.score?.overall ?? output.qaVerdict?.score?.score ?? output.qaVerdict?.score;
    const clusterQaScore = typeof rawClusterQaScore === "object" ? "inspect" : rawClusterQaScore;
    const clusterQaPassed = output.qaVerdict?.passed || output.qaVerdict?.score?.passed;
    return (
      <div className="output-studio">
        <div className="studio-hero">
          <div>
            <small>Content Cluster</small>
            <h2>{output.sourceInbox?.title || "Cluster Output"}</h2>
            <p>{output.campaignPacket?.promise || output.auditNotes?.[0] || "Local creation cluster ready."}</p>
          </div>
          <div className={`qa-score ${output.clusterInspection?.ok ? "pass" : "warn"}`}>
            <span>Cluster</span>
            <strong>{output.clusterInspection?.ok ? "OK" : "FIX"}</strong>
            <small>{platformEntries.length} lanes</small>
          </div>
        </div>
        <div className="studio-grid cluster-output-grid">
          <StudioCard icon={Target} label="Campaign Packet">
            <dl>
              <dt>Audience</dt><dd>{output.campaignPacket?.audience}</dd>
              <dt>Promise</dt><dd>{output.campaignPacket?.promise}</dd>
              <dt>Next Action</dt><dd>{output.campaignPacket?.nextAction}</dd>
            </dl>
          </StudioCard>
          <StudioCard icon={Megaphone} label="Platform Lanes">
            <div className="variant-list">
              {platformEntries.map(([key, lane]) => (
                <button key={key} type="button" onClick={() => navigator.clipboard?.writeText(jsonBlock(lane))}>
                  <strong>{lane.platform || key}</strong>
                  <span>{lane.hook || lane.caption || lane.outline?.[0]?.point || lane.slides?.[0]?.headline}</span>
                  <small>{lane.cta || `${lane.slides?.length || lane.script?.length || lane.outline?.length || 0} items`}</small>
                </button>
              ))}
            </div>
          </StudioCard>
          <StudioCard icon={Clapperboard} label="Scripts">
            <div className="scene-list">
              {(output.scripts || []).slice(0, 6).map((script, index) => (
                <div key={`${script.time || script.beat || "script"}-${index}`}>
                  <time>{script.time || `Beat ${index + 1}`}</time>
                  <strong>{script.beat || script.purpose}</strong>
                  <span>{script.line}</span>
                </div>
              ))}
            </div>
          </StudioCard>
          <StudioCard icon={TextQuote} label="Quote / Evidence Pack">
            <div className="claim-list">
              {(output.quoteEvidencePack?.claims || output.claimMap || []).slice(0, 6).map((claim) => (
                <div key={claim.id || claim.sourceLine}>
                  <Pill tone="live">{claim.risk || "source"}</Pill>
                  <span>{claim.sourceLine}</span>
                </div>
              ))}
            </div>
          </StudioCard>
          <StudioCard icon={Images} label="Visual Prompts">
            <ul>
              {(output.visualPrompts || output.thumbnailPrompts || []).slice(0, 6).map((prompt) => <li key={prompt}>{prompt}</li>)}
            </ul>
          </StudioCard>
          <StudioCard icon={Route} label="Distribution Plan">
            <div className="claim-list">
              {(output.distributionPlan || []).map((item) => (
                <div key={item.lane || item}>
                  <Pill tone="live">{item.lane || "step"}</Pill>
                  <span>{item.action || item}</span>
                </div>
              ))}
            </div>
          </StudioCard>
          <StudioCard icon={Shield} label="QA Verdict">
            <dl>
              <dt>Status</dt><dd>{clusterQaPassed ? "passed" : "blocked"}</dd>
              <dt>Score</dt><dd>{clusterQaScore === undefined ? "inspect" : String(clusterQaScore)}</dd>
              <dt>Next</dt><dd>{output.nextAction}</dd>
            </dl>
            <div className="claim-list">
              {Object.entries(output.qaVerdict?.score?.rubric || output.qaVerdict?.rubric || {}).map(([key, dimension]) => (
                <div key={key}>
                  <Pill tone={dimension.passed ? "live" : "partial"}>{dimension.score}</Pill>
                  <span>{key.replace(/([A-Z])/g, " $1").trim()}</span>
                </div>
              ))}
            </div>
            {(output.qaVerdict?.repairSuggestions || output.repairSuggestions || []).length ? (
              <ul>{(output.qaVerdict?.repairSuggestions || output.repairSuggestions).map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul>
            ) : null}
          </StudioCard>
          <StudioCard icon={Workflow} label="A2A And Tool Trace">
            <div className="claim-list">
              <div><Pill tone="live">{output.a2aTrace?.length || 0}</Pill><span>A2A messages persisted for this cluster</span></div>
              <div><Pill tone="live">{output.toolTrace?.length || 0}</Pill><span>tool receipts attached to this cluster</span></div>
              {(output.a2aTrace || []).slice(0, 5).map((message) => (
                <div key={message.id}>
                  <Pill tone={message.status === "acknowledged" ? "done" : "warn"}>{message.status}</Pill>
                  <span>{message.producer} {"->"} {message.consumer}: {message.intent}</span>
                </div>
              ))}
            </div>
          </StudioCard>
        </div>
        <details className="raw-output">
          <summary>Inspect Raw Cluster</summary>
          <pre>{jsonBlock(output)}</pre>
        </details>
      </div>
    );
  }

  return (
    <div className="output-studio">
      <div className="studio-hero">
        <div>
          <small>Structured Frame</small>
          <h2>{output.title || "Source Frame"}</h2>
          <p>{output.objective || "Structured output is ready."}</p>
        </div>
        <Pill tone="live">{output.format || "ready"}</Pill>
      </div>
      <div className="studio-grid compact">
        <StudioCard icon={FileText} label="Frame">
          <dl>
            <dt>Role</dt><dd>{output.role}</dd>
            <dt>Scenes</dt><dd>{output.scenes}</dd>
            <dt>Hooks</dt><dd>{output.hooks}</dd>
            <dt>CTA</dt><dd>{output.cta}</dd>
          </dl>
        </StudioCard>
        <StudioCard icon={Shield} label="Constraints">
          <ul>
            {(output.constraints || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </StudioCard>
      </div>
      <details className="raw-output">
        <summary>Inspect Raw Frame</summary>
        <pre>{jsonBlock(output)}</pre>
      </details>
    </div>
  );
}

function IPVault({ projectName, projectSources, sourceQuery, setSourceQuery, laneFilter, setLaneFilter, filteredSources, openSourceDocument }) {
  const countBy = (values) => [...values.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map()).entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const lanes = countBy(projectSources.map((item) => item.lane || "General Source"));
  const tags = countBy(projectSources.flatMap((item) => item.tags || [])).slice(0, 18);
  const visibleSources = filteredSources.slice(0, 24);
  return (
    <div className="vault-stack">
      <Panel className="vault-command">
        <PanelTitle icon={Vault} title={projectName || "Current Project Sources"} right={<Pill tone="live">{projectSources.length} Sources</Pill>} />
        <div className="vault-search-row">
          <label className="search-box">
            <Search size={18} />
            <input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Search IP, lanes, tags, paths..." aria-label="Search IP vault" />
          </label>
          <select value={laneFilter} onChange={(event) => setLaneFilter(event.target.value)} aria-label="Filter IP lane">
            <option value="all">All source groups</option>
            {lanes.map((lane) => <option key={lane.label} value={lane.label}>{lane.label} ({lane.count})</option>)}
          </select>
        </div>
        {(lanes.length > 1 || tags.length) ? (
          <details className="source-filters">
            <summary>More filters</summary>
            <div className="tag-strip">
              {tags.map((tag) => (
                <button key={tag.label} type="button" onClick={() => setSourceQuery(tag.label)}>
                  {tag.label}<span>{tag.count}</span>
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </Panel>

      <Panel>
        <PanelTitle icon={Archive} title="Searchable Source Inventory" right={<span className="result-count">{filteredSources.length} shown</span>} />
        <div className="source-vault-list">
          {visibleSources.map((item) => (
            <button key={item.id} type="button" onClick={() => openSourceDocument(item)}>
              <div>
                <Pill tone="live">{item.lane}</Pill>
                <strong>{item.title.replace(/^\[[^\]]+\]\s*/, "")}</strong>
                <p>{item.excerpt}</p>
                <small>{item.sourceType} · {item.characterCount} characters</small>
              </div>
              <FileText size={20} />
            </button>
          ))}
          {!visibleSources.length ? <div className="vault-empty">No source documents in this project.</div> : null}
        </div>
        {filteredSources.length > visibleSources.length ? <p className="result-limit">Refine the search to narrow {filteredSources.length} matching documents.</p> : null}
      </Panel>
    </div>
  );
}

function AgentChatConsole({
  state,
  active,
  source,
  sourceRequired = false,
  projectId,
  selectedAgent,
  setSelectedAgent,
  chatMessage,
  setChatMessage,
  chatHistory,
  latestChat,
  chatBusy,
  chatMode,
  setChatMode,
  llmStatus,
  busy,
  onSend,
  onPrompt,
  onApplyAnswerToSource,
  onPromoteAnswer,
  onExport,
  onSpeakAnswer,
  speechSupported,
  listening,
  onListen,
  ttsSupported,
  ttsStatus,
  chatError
}) {
  const ability = abilityBlueprints[active];
  if (!ability) throw new Error(`Missing chat blueprint for route: ${active}`);
  const prompts = polishPrompts[active];
  if (!prompts) throw new Error(`Missing polish prompts for route: ${active}`);
  const selected = (state.agentPipeline || []).find((agent) => agent.id === selectedAgent);
  const isAgentPage = active === "agent";
  const hasSource = Boolean(source?.trim());
  const visibleHistory = [...chatHistory, ...(state.agentChats || [])]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .filter((item) => (!item.projectId || item.projectId === projectId) && (item.section || item.ability) === active)
    .slice(0, 8);
  const latestProvider = chatProviderLabel(latestChat, llmStatus);
  const latestTone = latestChat?.provider === "ollama" ? "live" : latestChat?.provider === "error" ? "partial" : "queued";
  return (
    <Panel className={`agent-chat-panel ${isAgentPage ? "" : "compact-chat"}`}>
      <PanelTitle
        icon={MessageSquare}
        title={`${ability.title} Chat`}
        right={<Pill tone={llmStatus?.live ? "live" : "partial"}>{llmStatus?.live ? llmStatus.model || "Ollama" : "Instant Local Draft"}</Pill>}
      />
      <div className="section-chat-brief">
        <div>
          <small>Working agent</small>
          <strong>{selected?.label || "Content Agent"}</strong>
          <span>{selected?.persona || selected?.action || "Talk through polish, edit, and next-step passes for this ability."}</span>
        </div>
        <div className="polish-prompts" aria-label="Polish prompts">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => onPrompt(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      </div>
      <div className="chat-mode-row" aria-label="Response mode">
        {[
          ["auto", "Fast"],
          ["deep", "Deep"],
          ["elite", "Elite"]
        ].map(([value, label]) => (
          <button key={value} type="button" className={chatMode === value ? "selected" : ""} onClick={() => setChatMode(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="agent-chat-grid">
        <div className={`agent-selector ${isAgentPage ? "" : "compact-selector"}`}>
          {(state.agentPipeline || []).map((agent) => (
            <button key={agent.id} type="button" className={selectedAgent === agent.id ? "selected" : ""} onClick={() => setSelectedAgent(agent.id)}>
              <strong>{agent.label}</strong>
              <small>{agent.persona || agent.action}</small>
            </button>
          ))}
        </div>
        <div className="chat-surface">
          <div
            className={`latest-answer ${chatBusy ? "thinking" : ""}`}
            data-provider={latestChat?.provider || "none"}
            data-provider-label={latestChat ? latestProvider : chatBusy ? "connecting" : "waiting"}
            data-chat-status={latestChat?.status || (chatBusy ? "working" : "idle")}
          >
            <header>
              <strong>{latestChat?.answer ? `${latestChat.agentLabel || "Content Agent"} Answer` : chatBusy ? "Agent is working" : "Agent answer appears here"}</strong>
              <Pill tone={latestChat ? latestTone : "queued"}>
                {latestChat ? latestProvider : chatBusy ? "connecting" : "waiting"}
              </Pill>
            </header>
            {latestChat?.answer ? (
              <>
                <p className="chat-question">{latestChat.message}</p>
                <p>{latestChat.answer}</p>
                {chatBusy && <div className="chat-upgrade-status"><span className="status-dot" />{latestChat.status === "upgrading" ? `Streaming upgrade from ${latestProvider}` : "Instant Local Draft is visible while provider detection finishes."}</div>}
                {latestChat.quality && (
                  <div className="quality-grid">
                    <span>Support <b>{latestChat.quality.sourceSupport}</b></span>
                    <span>Clarity <b>{latestChat.quality.clarity}</b></span>
                    <span>Useful <b>{latestChat.quality.usefulness}</b></span>
                  </div>
                )}
                <div className="answer-meta">
                  <span>{latestChat.profile || "auto profile"}</span>
                  <span>{latestChat.historyStatus === "saved" ? "saved to history" : chatBusy ? "saving on completion" : "local answer"}</span>
                </div>
                <div className="answer-actions">
                  <button type="button" onClick={onApplyAnswerToSource}>Apply to Source</button>
                  <button type="button" onClick={onPromoteAnswer}>Promote Output</button>
                  <button type="button" onClick={onExport}>Export Answer</button>
                  <button type="button" disabled={!ttsSupported} onClick={onSpeakAnswer}><Volume2 size={15} /> {ttsStatus === "speaking" ? "Speaking" : "Read Aloud"}</button>
                  <button type="button" onClick={() => onPrompt(`Apply this answer as an edit pass:\n\n${latestChat.answer}`)}>Edit Further</button>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(latestChat.answer)}>Copy Answer</button>
                </div>
              </>
            ) : chatBusy ? (
              <p>Reading this section, source, and output. Fast sections use tighter budgets; deeper sections get more context. The answer will appear here.</p>
            ) : (
              <p>Type or speak a polish/edit request. The selected agent’s answer will appear here first, then save into history.</p>
            )}
            {chatError && <div className="chat-error" role="alert"><CircleAlert size={17} /><span>{chatError}</span></div>}
            {sourceRequired && !hasSource ? (
              <div className="chat-source-warning" role="alert">
                <Database size={17} />
                <span>Choose a source above before chatting with this agent. The answer will land here.</span>
              </div>
            ) : null}
          </div>
          <div className="chat-history">
            {visibleHistory.length ? visibleHistory.map((item) => (
              <article key={item.id}>
                <header>
                  <strong>{item.agentLabel}</strong>
                  <Pill tone={item.provider === "ollama" ? "live" : "partial"}>{chatProviderLabel(item, llmStatus)}</Pill>
                </header>
                <p className="chat-question">{item.message}</p>
                <p>{item.answer}</p>
                <div className="citation-row">
                  {(item.context?.sources || []).slice(0, 3).map((source) => (
                    <span key={source.id}>{source.lane}: {source.title}</span>
                  ))}
                </div>
              </article>
            )) : <div className="chat-history-empty"><MessageSquare size={18} /><span>No saved answers for this ability yet.</span></div>}
          </div>
          <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
            <textarea value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} aria-label="Message agent" placeholder={`Talk to ${selected?.label || "this agent"} for polish, edits, or next-step guidance...`} />
            <div className="chat-command-stack">
              <button type="button" aria-label="Speak with runtime speech recognition" className={`voice-action ${listening ? "listening" : ""}`} disabled={busy || !speechSupported} onClick={onListen}>
                {speechSupported ? <Mic size={16} /> : <MicOff size={16} />}
                {listening ? "Listening" : "Speak"}
              </button>
              <button type="submit" className="primary-action" disabled={busy || chatBusy || !chatMessage.trim() || (sourceRequired && !hasSource)}>
                {chatBusy ? "Thinking" : "Send"}
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </Panel>
  );
}

function AgentSourcePanel({
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
  const currentTitle = selectedSource?.title?.replace(/^\[[^\]]+\]\s*/, "") || (hasSource ? "Unsaved pasted source" : "No source selected");
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
              <button key={item.id} type="button" className={item.id === sourceId ? "selected" : ""} onClick={() => onSelectSource(item)}>
                <span>{item.lane || item.sourceType || "Source"}</span>
                <strong>{item.title.replace(/^\[[^\]]+\]\s*/, "")}</strong>
                <small>{item.characterCount?.toLocaleString?.() || item.characterCount || 0} chars · load for agents</small>
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

function IntakePanel({
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
  const projectMedia = (state.mediaAssets || []).filter((asset) => !asset.projectId || asset.projectId === projectId);
  const contentRoots = driveTargets?.contentRoots || [];
  const removableDrives = driveTargets?.removableDrives || [];
  const fixedDrives = driveTargets?.fixedDrives || [];
  const allDriveRoots = fixedDrives.map((drive) => drive.root);
  return (
    <Panel className="intake-panel">
      <PanelTitle icon={Images} title="Import Project Sources" right={<Pill tone="live">{projectMedia.length} Media</Pill>} />
      <div className="intake-toolbar">
        <button type="button" className="primary-action intake-run" disabled={intakeBusy} onClick={() => onRunIntake()}>
          Import Listed Folders
          <Zap size={16} />
        </button>
        <button type="button" className="primary-action intake-run" disabled={intakeBusy || !contentRoots.length} onClick={() => onRunIntake(contentRoots, "user content folders")}>
          Scan My Content Folders
          <HardDrive size={16} />
        </button>
        <button type="button" className="primary-action intake-run usb-intake" disabled={intakeBusy || !removableDrives.length} onClick={() => onReviewIntake(removableDrives.map((drive) => drive.root), "flash drives")}>
          Review Flash Drive
          <Database size={16} />
        </button>
        <details className="intake-settings">
          <summary>Drive / folder intake</summary>
          <label className="intake-intent">
            <span>What belongs in this project?</span>
            <textarea value={intakeIntent} onChange={(event) => setIntakeIntent(event.target.value)} aria-label="Intake review mission" placeholder="Describe what should be imported. Example: Aurora Storytime platform assets, scripts, thumbnails, social posts. Random screenshots should be excluded." />
          </label>
          <div className="drive-scan-panel">
            <div className="drive-scan-header">
              <div>
                <small>Detected local targets</small>
                <strong>{fixedDrives.length} drives · {removableDrives.length} removable</strong>
              </div>
              <button type="button" className="mini-action" disabled={intakeBusy} onClick={onRefreshIntakeTargets}>Refresh Drives</button>
            </div>
            <div className="drive-actions">
              <button type="button" disabled={intakeBusy || !allDriveRoots.length} onClick={() => onReviewIntake(allDriveRoots, "local drives")}>Review All Local Drives</button>
              {fixedDrives.map((drive) => (
                <button key={drive.root} type="button" disabled={intakeBusy} onClick={() => onReviewIntake([drive.root], drive.label || drive.root)}>
                  <strong>{drive.label || drive.root}</strong>
                  <small>{drive.type} · review first · {drive.sizeGb ? `${drive.sizeGb} GB` : "size unknown"}</small>
                </button>
              ))}
              {removableDrives.map((drive) => (
                <button key={drive.root} type="button" className="usb-drive-action" disabled={intakeBusy} onClick={() => onReviewIntake([drive.root], drive.label || drive.root)}>
                  <strong>{drive.label || drive.root}</strong>
                  <small>flash/removable · review first</small>
                </button>
              ))}
              {!removableDrives.length ? <span className="drive-empty">No flash drive detected. Plug one in, then Refresh Drives.</span> : null}
            </div>
          </div>
          <label className="intake-roots">
            <span>One local folder per line</span>
            <textarea value={intakeRootsText} onChange={(event) => setIntakeRootsText(event.target.value)} aria-label="Intake scan roots" />
          </label>
          <small className="intake-limit-note">Local only. Cloud paths and system folders are excluded. Scan cap: {(driveTargets?.maxFiles || 0).toLocaleString()} files.</small>
        </details>
      </div>
      {intakeReview ? (
        <div className="intake-review-panel">
          <div className="intake-review-header">
            <div>
              <small>Review before import</small>
              <strong>{intakeReview.eligible} eligible · {intakeReview.alreadyImported} already imported · {intakeReview.skippedOperational} excluded</strong>
              <span>{intakeReview.recommended || 0} recommended · {intakeReview.reviewNeeded || 0} need manual review. {intakeReview.candidateLimitHit ? `Showing first ${intakeReview.candidateLimit} candidates. Narrow folders for a smaller review.` : `${intakeReview.candidates.length} candidates staged.`}</span>
            </div>
            <div className="intake-review-actions">
              <button type="button" disabled={intakeBusy} onClick={() => onSelectReviewCandidates("recommended")}>Select Recommended</button>
              <button type="button" disabled={intakeBusy} onClick={() => onSelectReviewCandidates("none")}>Clear</button>
              <button type="button" className="primary-action" disabled={intakeBusy || !intakeReviewSelection.length} onClick={onApplyReview}>Import Selected ({intakeReviewSelection.length})</button>
            </div>
          </div>
          <div className="intake-review-list">
            {intakeReview.candidates.slice(0, 80).map((candidate) => {
              const disabled = !candidate.eligible || candidate.alreadyImported || candidate.decisionStatus === "excluded";
              const selected = intakeReviewSelection.includes(candidate.reviewId);
              return (
                <label key={candidate.reviewId} className={`intake-review-row ${disabled ? "disabled" : ""} ${selected ? "selected" : ""}`}>
                  <input type="checkbox" disabled={disabled || intakeBusy} checked={selected} onChange={() => onToggleReviewCandidate(candidate.reviewId)} />
                  <span>
                    <strong>{candidate.title}</strong>
                    <small>{candidate.importAs} · {candidate.decisionReason || candidate.reason} · {candidate.path}</small>
                  </span>
                  <Pill tone={candidate.decisionStatus === "recommended" ? "live" : candidate.decisionStatus === "review" ? "partial" : "blocked"}>{candidate.alreadyImported ? "exists" : candidate.decisionStatus || "review"}</Pill>
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
              <img className="media-card-thumb" src={`/api/media/${encodeURIComponent(asset.id)}/preview?v=${encodeURIComponent(asset.updatedAt || asset.importedAt || asset.modifiedAt || "")}`} alt="" loading="lazy" />
            ) : (
              <Pill tone="live">{asset.kind}</Pill>
            )}
            <strong>{asset.title}</strong>
            <small>{asset.lane} · {asset.extension} · click to open/rename</small>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function AutomationsPanel({ state, onRefresh, setModal, setOperationError }) {
  const [tab, setTab] = useState("active");
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null);

  const automations = state?.automations || [];
  const runs = state?.automationRuns || [];
  const reviewQueue = state?.reviewQueue || [];

  const handleToggle = async (id, enabled) => {
    setBusy(true);
    try {
      const response = await api(`/api/automations/${id}/toggle`, "POST", { enabled });
      if (!response.ok) throw new Error(response.error || "Failed to toggle.");
      await onRefresh();
    } catch (err) {
      setOperationError(err.message);
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
      setOperationError(err.message);
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
      setOperationError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const endpoint = editor.id ? `/api/automations/${editor.id}` : `/api/automations`;
      const method = editor.id ? "PUT" : "POST";
      const response = await api(endpoint, method, editor);
      if (!response.ok) throw new Error(response.error || "Failed to save.");
      setEditor(null);
      await onRefresh();
    } catch (err) {
      setOperationError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (editor) {
    return (
      <Panel>
        <PanelTitle icon={Clock} title={editor.id ? "Edit Automation" : "New Automation"} />
        <form onSubmit={handleSave} className="automation-form" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label>Name<input required value={editor.name || ""} onChange={e => setEditor({...editor, name: e.target.value})} className="chat-input" /></label>
          <label>Project ID<input required value={editor.projectId || "wake-v6-main"} onChange={e => setEditor({...editor, projectId: e.target.value})} className="chat-input" /></label>
          <label>Source Directory<input required value={editor.sourceDir || ""} onChange={e => setEditor({...editor, sourceDir: e.target.value})} className="chat-input" /></label>
          <label>Campaign Type<input required value={editor.campaignType || "Custom Prompt"} onChange={e => setEditor({...editor, campaignType: e.target.value})} className="chat-input" /></label>
          <label>Operator Ask (Strategist context)<textarea rows={3} required value={editor.operatorAsk || ""} onChange={e => setEditor({...editor, operatorAsk: e.target.value})} className="chat-input" /></label>
          <label>Schedule Cron<input required placeholder="0 19 * * 0" pattern="^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$" title="Must be a valid 5-part cron expression" value={editor.scheduleCron || ""} onChange={e => setEditor({...editor, scheduleCron: e.target.value})} className="chat-input" /></label>
          <label>Time Zone<input required placeholder="America/Los_Angeles" value={editor.timeZone || "America/Los_Angeles"} onChange={e => setEditor({...editor, timeZone: e.target.value})} className="chat-input" /></label>
          <label>Approval Mode
            <select value={editor.approvalMode || "Review Required"} onChange={e => setEditor({...editor, approvalMode: e.target.value})} className="chat-input">
              <option>Review Required</option>
              <option>Auto Export</option>
            </select>
          </label>
          <label>Export Directory<input required value={editor.exportDir || ""} onChange={e => setEditor({...editor, exportDir: e.target.value})} className="chat-input" /></label>
          
          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
            <button type="submit" className="primary-action" disabled={busy}>Save Automation</button>
            <button type="button" className="mini-action" disabled={busy} onClick={() => setEditor(null)}>Cancel</button>
          </div>
        </form>
      </Panel>
    );
  }

  return (
    <Panel className="automations-panel">
      <PanelTitle icon={Clock} title="Scheduler & Automations" />
      <div className="monitor-grid" style={{ marginBottom: "1rem", padding: "1rem", borderBottom: "1px solid var(--border)" }}>
         <button className={tab === "active" ? "primary-action" : "mini-action"} onClick={() => setTab("active")}>Active Automations</button>
         <button className={tab === "review" ? "primary-action" : "mini-action"} onClick={() => setTab("review")}>Review Queue ({reviewQueue.length})</button>
         <button className={tab === "history" ? "primary-action" : "mini-action"} onClick={() => setTab("history")}>Run History</button>
      </div>

      <div style={{ padding: "0 1rem 1rem 1rem" }}>
        {tab === "active" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
               <h3>Configured Automations</h3>
               <button className="primary-action" onClick={() => setEditor({})}>
                 <Plus size={16} /> New Automation
               </button>
            </div>
            <div className="library-list">
              {automations.map(a => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginBottom: "0.5rem", background: "var(--surface)" }}>
                  <div>
                    <strong style={{ fontSize: "1.1rem", display: "block", marginBottom: "0.2rem" }}>{a.name}</strong>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {a.scheduleCron} ({a.timeZone}) • {a.approvalMode} • <span style={{ color: a.enabled ? "var(--live)" : "var(--partial)" }}>{a.enabled ? "Active" : "Paused"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button className="mini-action" onClick={() => handleToggle(a.id, !a.enabled)}>
                      {a.enabled ? <Pause size={16} /> : <Play size={16} />} {a.enabled ? "Pause" : "Resume"}
                    </button>
                    <button className="mini-action" onClick={() => handleRun(a.id)}>
                      <Zap size={16} /> Run Now
                    </button>
                    <button className="mini-action" onClick={() => setEditor(a)}>
                      <Edit2 size={16} /> Edit
                    </button>
                    <button className="mini-action" onClick={() => handleDelete(a.id)}>
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>
              ))}
              {!automations.length && <p>No automations configured.</p>}
            </div>
          </div>
        )}

        {tab === "review" && (
          <div>
            <h3>Pending Review</h3>
            <div className="library-list">
              {reviewQueue.map(r => (
                <div key={r.id} style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginBottom: "0.5rem", background: "var(--surface)" }}>
                   <strong>Run: {r.runId}</strong>
                   <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{new Date(r.createdAt).toLocaleString()}</div>
                   <button className="mini-action" style={{ marginTop: "0.5rem" }} onClick={() => setModal({ title: "Review Content", body: JSON.stringify(r.result, null, 2) })}>View Generated Packet</button>
                </div>
              ))}
              {!reviewQueue.length && <p>No items pending review.</p>}
            </div>
          </div>
        )}

        {tab === "history" && (
           <div>
              <h3>Run History</h3>
              <div className="library-list">
                 {runs.map(r => (
                    <div key={r.id} style={{ padding: "0.5rem 1rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                       <div>
                          <strong>{r.automationId}</strong>
                          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Status: {r.status} {r.error && `- ${r.error}`}</div>
                       </div>
                       <small>{new Date(r.createdAt).toLocaleString()}</small>
                    </div>
                 ))}
                 {!runs.length && <p>No runs recorded.</p>}
              </div>
           </div>
        )}
      </div>
    </Panel>
  );
}

function App() {
  const [active, setActive] = useState("console");
  const [state, setState] = useState(null);
  const [projectId, setProjectId] = useState(() => localStorage.getItem("wake.projectId") || "wake-v6-main");
  const [projectName, setProjectName] = useState("");
  const [source, setSource] = useState("");
  const [sourceId, setSourceId] = useState(null);
  const [output, setOutput] = useState(null);
  const [generationId, setGenerationId] = useState(null);
  const [cluster, setCluster] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [campaignDirection, setCampaignDirection] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("tiktok");
  const [imageBusy, setImageBusy] = useState(false);
  const [exportPreview, setExportPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [system, setSystem] = useState(null);
  const [systemHistory, setSystemHistory] = useState([]);
  const [loginComplete, setLoginComplete] = useState(false);
  const [operatorName, setOperatorName] = useState(() => localStorage.getItem("wake.operatorName") || "JUSTIN");
  const [accessPhrase, setAccessPhrase] = useState("");
  const [loginStatus, setLoginStatus] = useState("AWAITING OPERATOR");
  const [bootProgress, setBootProgress] = useState(0);
  const [bootComplete, setBootComplete] = useState(() => localStorage.getItem("wake.bootSeen") === "true");
  const [bootReplayNonce, setBootReplayNonce] = useState(0);
  const [hasSpokenOnline, setHasSpokenOnline] = useState(false);
  const [voicePreset, setVoicePreset] = useState(() => {
    const saved = localStorage.getItem("wake.voicePreset") || "villain";
    return saved === "muted" ? "villain" : saved;
  });
  const [voiceMuted, setVoiceMuted] = useState(() => localStorage.getItem("wake.voiceMuted") === "true" || localStorage.getItem("wake.voicePreset") === "muted");
  const [voiceName, setVoiceName] = useState(() => localStorage.getItem("wake.voiceName") || "");
  const [voices, setVoices] = useState([]);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [ttsStatus, setTtsStatus] = useState("idle");
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskSearch, setTaskSearch] = useState("");
  const [sourceQuery, setSourceQuery] = useState("");
  const [laneFilter, setLaneFilter] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState("strategist");
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [latestChat, setLatestChat] = useState(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMode, setChatMode] = useState("auto");
  const [llmStatus, setLlmStatus] = useState(null);
  const [chatError, setChatError] = useState("");
  const [operationError, setOperationError] = useState(null);
  const [taskDraft, setTaskDraft] = useState({ title: "", objective: "", nextAction: "" });
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [intakeRootsText, setIntakeRootsText] = useState("");
  const [instructionsQuery, setInstructionsQuery] = useState("");
  const [instructionsResult, setInstructionsResult] = useState(null);
  const [instructionsBusy, setInstructionsBusy] = useState(false);
  const [intakeIntent, setIntakeIntent] = useState("");
  const [driveTargets, setDriveTargets] = useState(null);
  const [intakeReviewSelection, setIntakeReviewSelection] = useState([]);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const activeSectionRef = useRef(null);
  const utteranceRef = useRef(null);
  const audioContextRef = useRef(null);

  function scrollToActiveSection() {
    window.setTimeout(() => {
      activeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  }

  function navigateSection(id) {
    setActive(id);
    scrollToActiveSection();
  }

  function switchProject(id) {
    if (id === projectId) return;
    setProjectId(id);
    setSource("");
    setSourceId(null);
    setOutput(null);
    setGenerationId(null);
    setCluster(null);
    setCampaign(null);
    setCampaignDirection("");
    setSelectedPlatform("tiktok");
    setExportPreview(null);
    setLatestChat(null);
    setChatHistory([]);
    setSourceQuery("");
    setLaneFilter("all");
    setNotice("Project switched. Creator cleared to prevent cross-project mixing.");
  }

  function playBootAudio(kind = "start") {
    if (voiceMuted || typeof window === "undefined") return false;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    try {
      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      if (context.state === "suspended") context.resume().catch(() => {});
      const started = context.currentTime + 0.02;
      const master = context.createGain();
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(kind === "online" ? 720 : 520, started);
      filter.Q.setValueAtTime(8, started);
      master.gain.setValueAtTime(0.0001, started);
      master.gain.exponentialRampToValueAtTime(kind === "online" ? 0.18 : 0.11, started + 0.08);
      master.gain.exponentialRampToValueAtTime(0.0001, started + (kind === "online" ? 1.35 : 1.9));
      filter.connect(master);
      master.connect(context.destination);

      const tones = kind === "online"
        ? [
            { frequency: 92, end: 1.25, type: "sine", gain: 0.65 },
            { frequency: 184, end: 1.05, type: "triangle", gain: 0.38 },
            { frequency: 368, end: 0.72, type: "sine", gain: 0.24 }
          ]
        : [
            { frequency: 42, end: 1.8, type: "sine", gain: 0.7 },
            { frequency: 84, end: 1.45, type: "sawtooth", gain: 0.18 },
            { frequency: 126, end: 1.15, type: "triangle", gain: 0.22 }
          ];

      tones.forEach((tone, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = tone.type;
        oscillator.frequency.setValueAtTime(tone.frequency, started);
        oscillator.frequency.exponentialRampToValueAtTime(tone.frequency * (kind === "online" ? 1.22 : 0.72), started + tone.end);
        gain.gain.setValueAtTime(0.0001, started + index * 0.04);
        gain.gain.exponentialRampToValueAtTime(tone.gain, started + 0.12 + index * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, started + tone.end);
        oscillator.connect(gain);
        gain.connect(filter);
        oscillator.start(started);
        oscillator.stop(started + tone.end + 0.05);
      });
      return true;
    } catch {
      return false;
    }
  }

  function finishBoot() {
    setBootProgress(100);
    setBootComplete(true);
    localStorage.setItem("wake.bootSeen", "true");
  }

  function replayBoot() {
    window.speechSynthesis?.cancel();
    setTtsStatus("idle");
    setHasSpokenOnline(false);
    setBootProgress(0);
    setBootComplete(false);
    setBootReplayNonce((value) => value + 1);
  }

  async function refresh() {
    const fresh = await api("/state");
    setState(fresh);
    if (!fresh.projects?.some((project) => project.id === projectId) && fresh.projects?.[0]?.id) setProjectId(fresh.projects[0].id);
    return fresh;
  }

  async function refreshIntakeTargets() {
    const targets = await api("/intake/roots");
    setDriveTargets(targets);
    if (!intakeRootsText && targets.contentRoots?.length) setIntakeRootsText(targets.contentRoots.join("\n"));
    return targets;
  }

  useEffect(() => {
    let activeSession = true;
    api("/session/status")
      .then(async (session) => {
        if (!activeSession || !session.authenticated) return;
        if (session.operator) setOperatorName(session.operator);
        setLoginComplete(true);
        await refresh();
      })
      .catch((error) => {
        if (activeSession) setLoginStatus(error.message.toUpperCase());
      });
    const requireLogin = () => {
      setLoginComplete(false);
      setState(null);
      setLoginStatus("SESSION EXPIRED");
    };
    window.addEventListener("wake:auth-required", requireLogin);
    return () => {
      activeSession = false;
      window.removeEventListener("wake:auth-required", requireLogin);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("wake.projectId", projectId);
  }, [projectId]);

  useEffect(() => {
    if (!loginComplete) return;
    api("/agent-chat/status").then(setLlmStatus).catch(() => setLlmStatus({ live: false }));
    refreshIntakeTargets().catch(() => setDriveTargets(null));
  }, [loginComplete]);

  useEffect(() => {
    if (!window.speechSynthesis) return undefined;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("wake.voicePreset", voicePreset);
    localStorage.setItem("wake.voiceName", voiceName);
    localStorage.setItem("wake.voiceMuted", String(voiceMuted));
  }, [voicePreset, voiceName, voiceMuted]);

  useEffect(() => {
    if (!state || bootComplete) return undefined;
    setBootProgress(0);
    playBootAudio("start");
    const started = Date.now();
    const timer = window.setInterval(() => {
      const progress = Math.min(100, Math.round(((Date.now() - started) / BOOT_SEQUENCE_MS) * 100));
      setBootProgress(progress);
      if (progress >= 100) {
        window.clearInterval(timer);
        playBootAudio("online");
        finishBoot();
      }
    }, 60);
    return () => window.clearInterval(timer);
  }, [state, bootComplete, bootReplayNonce]);

  useEffect(() => {
    if (!bootComplete || hasSpokenOnline || voiceMuted) return;
    speakSystemVoice();
    setHasSpokenOnline(true);
  }, [bootComplete, hasSpokenOnline, voicePreset, voiceName, voiceMuted, voices]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      audioContextRef.current?.close?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(Recognition));
  }, []);

  useEffect(() => {
    const defaultAgent = abilityAgentDefaults[active];
    if (defaultAgent && active !== "agent") setSelectedAgent(defaultAgent);
  }, [active]);

  useEffect(() => {
    const currentAbility = latestChat?.section || latestChat?.ability;
    if (currentAbility === active && latestChat?.projectId === projectId) return;
    const saved = (state?.agentChats || []).find((item) => item.ability === active && (!item.projectId || item.projectId === projectId));
    setLatestChat(saved ? { ...saved, section: saved.ability } : null);
    setChatError("");
  }, [active, projectId, state?.agentChats]);

  useEffect(() => {
    if (!state?.activeTask) return;
    setTaskDraft({
      title: state.activeTask.title || "",
      objective: state.activeTask.objective || "",
      nextAction: state.activeTask.nextAction || ""
    });
  }, [state?.activeTask?.id, state?.activeTask?.updatedAt]);

  useEffect(() => {
    if (state?.intakeRoots?.length && !intakeRootsText) setIntakeRootsText(state.intakeRoots.join("\n"));
  }, [state, intakeRootsText]);

  useEffect(() => {
    if (!state || intakeIntent.trim()) return;
    const project = state.projects?.find((item) => item.id === projectId);
    setIntakeIntent([
      project?.name,
      state.activeTask?.objective,
      "Import only project-relevant content, documents, platform assets, scripts, thumbnails, source notes, and media. Exclude random screenshots or unrelated files."
    ].filter(Boolean).join(" — "));
  }, [state, projectId, intakeIntent]);

  useEffect(() => {
    const latestCampaign = state?.campaigns?.find((item) => item.projectId === projectId) || null;
    if (!campaign || campaign.projectId !== projectId) setCampaign(latestCampaign);
  }, [projectId, state?.campaigns]);

  useEffect(() => {
    if (!loginComplete) return undefined;
    let alive = true;
    async function refreshSystem() {
      try {
        const fresh = await api("/system");
        if (alive) {
          setSystem(fresh);
          setSystemHistory((history) => [...history.slice(-27), fresh]);
        }
      } catch (error) {
        if (alive) setNotice(error.message);
      }
    }
    refreshSystem();
    const timer = window.setInterval(refreshSystem, 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [loginComplete]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const tasks = state?.tasks || [];
  const taskCounts = useMemo(() => {
    return tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      acc.all += 1;
      return acc;
    }, { all: 0 });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const query = taskSearch.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesFilter = taskFilter === "all" || task.status === taskFilter;
      const text = `${task.id} ${task.title} ${task.owner} ${task.status} ${task.detail}`.toLowerCase();
      return matchesFilter && (!query || text.includes(query));
    });
  }, [tasks, taskFilter, taskSearch]);

  const projectSources = useMemo(() => {
    const items = state?.ipSources || state?.recentSources || [];
    return items.filter((item) => item.projectId === projectId);
  }, [state, projectId]);
  const projectGenerations = useMemo(() => (state?.recentGenerations || []).filter((item) => item.projectId === projectId), [state, projectId]);
  const projectExports = useMemo(() => (state?.recentExports || []).filter((item) => item.projectId === projectId), [state, projectId]);
  const projectHistory = useMemo(() => (state?.recentHistory || []).filter((item) => item.payload?.projectId === projectId), [state, projectId]);

  const filteredSources = useMemo(() => {
    const query = sourceQuery.trim().toLowerCase();
    return projectSources.filter((item) => {
      const matchesLane = laneFilter === "all" || item.lane === laneFilter;
      const text = `${item.title} ${item.lane || ""} ${item.sourceType || ""} ${(item.tags || []).join(" ")} ${item.localPath || ""} ${item.driveUrl || ""} ${item.excerpt || ""}`.toLowerCase();
      return matchesLane && (!query || text.includes(query));
    });
  }, [projectSources, sourceQuery, laneFilter]);

  async function runAction(label, action) {
    const startedAbility = active;
    setBusy(true);
    setNotice("");
    setOperationError(null);
    try {
      await action();
      await refresh();
    } catch (error) {
      setNotice(error.message);
      setOperationError({ ability: startedAbility, action: label, message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function saveProject() {
    await runAction("project", async () => {
      const data = await api("/projects", { id: projectId, name: projectName || "Wake Engine V6", status: "active" });
      switchProject(data.project.id);
      setProjectName("");
      setNotice(`Project saved: ${data.project.name}`);
    });
  }

  async function saveActiveTask() {
    await runAction("active-task", async () => {
      const data = await api("/active-task", {
        ...state.activeTask,
        title: taskDraft.title,
        objective: taskDraft.objective,
        nextAction: taskDraft.nextAction,
        status: state.activeTask?.status || "active"
      });
      setNotice(`Active task locked: ${data.task.title}`);
    });
  }

  async function createProject() {
    await runAction("project", async () => {
      const name = projectName.trim();
      if (!name) throw new Error("Project name is required.");
      const data = await api("/projects", { name, status: "active" });
      switchProject(data.project.id);
      setProjectName("");
      setNotice(`Project created: ${data.project.name}`);
    });
  }

  async function saveSource() {
    await runAction("source", async () => {
      const data = await api("/sources", { projectId, source });
      setSourceId(data.source.id);
      setNotice(`Source saved: ${data.source.title}`);
    });
  }

  async function generateFrame() {
    await runAction("frame", async () => {
      const data = await api("/frame", { projectId, sourceId, source });
      setOutput(data.frame);
      setGenerationId(data.generation?.id || null);
      setNotice("Frame generated and saved locally.");
    });
  }

  async function runAgent() {
    if (!source.trim()) {
      navigateSection("agent");
      setNotice("Choose a saved source or paste source before running agents.");
      setOperationError({ ability: "agent", action: "agent", message: "Choose a saved source or paste source before running agents." });
      return;
    }
    await runAction("agent", async () => {
      const data = await api("/run-agent", { projectId, sourceId, source });
      setOutput(data);
      setGenerationId(data.generation?.id || null);
      navigateSection("agent");
      setNotice("Agent pack generated and saved locally.");
    });
  }

  async function buildCluster() {
    await runAction("cluster", async () => {
      const data = await api("/content-cluster", { projectId, sourceId, source });
      setCluster(data);
      setOutput(data);
      setGenerationId(data.generation?.id || null);
      navigateSection("cluster");
      setNotice("Content cluster generated and saved locally.");
    });
  }

  async function createCampaign() {
    await runAction("autonomous campaign", async () => {
      const data = await api("/autopilot", {
        projectId,
        direction: campaignDirection,
        source: source.trim() || undefined
      }, { timeoutMs: 240000 });
      setCampaign(data.campaign);
      setCluster(data.campaign.cluster);
      setOutput(data.campaign);
      setGenerationId(data.campaign.generation?.id || null);
      setSelectedPlatform("tiktok");
      setExportPreview(null);
      setNotice(data.campaign.generatedImages?.length ? "Campaign and original images are ready." : "Campaign is ready. Connect the image engine once to create original images.");
    });
  }

  async function generateCampaignImage() {
    if (!campaign) return;
    setImageBusy(true);
    setNotice("");
    try {
      const data = await api("/images/generate", {
        campaignId: campaign.id,
        platform: selectedPlatform,
        prompt: campaign.platforms?.[selectedPlatform]?.imagePrompt
      }, { timeoutMs: 240000 });
      setCampaign(data.campaign);
      setOutput(data.campaign);
      setNotice(`Original ${data.campaign.platforms?.[selectedPlatform]?.label || "campaign"} image created.`);
      await refresh();
    } catch (error) {
      setNotice(error.message);
      setOperationError({ ability: "console", action: "image generation", message: error.message });
    } finally {
      setImageBusy(false);
    }
  }

  async function saveCampaignImageToSource(platform) {
    const image = platform?.image;
    if (!campaign || !image?.id) {
      setNotice("Generate an image first, then save it to Source material.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const data = await api("/images/save-source", {
        projectId,
        campaignId: campaign.id,
        platform: platform.id || selectedPlatform,
        imageId: image.id
      });
      setSource(data.source.source);
      setNotice("Generated image saved to Source material and Media Vault.");
      await refresh();
    } catch (error) {
      setNotice(error.message);
      setOperationError({ ability: "console", action: "save image to source", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function enableExternalImageGeneration() {
    const approved = window.confirm("Enable original image generation? Wake will send only the creative image prompt to the configured external image service, then save the returned image locally.");
    if (!approved) return;
    setImageBusy(true);
    setNotice("");
    try {
      const data = await api("/image-generation/settings", { externalImagesEnabled: true });
      await refresh();
      setNotice(data.imageGeneration?.configured ? "Original image generation enabled." : "Image provider still needs configuration.");
      if (campaign && data.imageGeneration?.configured) {
        const generated = await api("/images/generate", {
          campaignId: campaign.id,
          platform: selectedPlatform,
          prompt: campaign.platforms?.[selectedPlatform]?.imagePrompt
        }, { timeoutMs: 240000 });
        setCampaign(generated.campaign);
        setOutput(generated.campaign);
        setNotice(`Original ${generated.campaign.platforms?.[selectedPlatform]?.label || "campaign"} image created.`);
        await refresh();
      }
    } catch (error) {
      setNotice(error.message);
      setOperationError({ ability: "console", action: "image generation setup", message: error.message });
    } finally {
      setImageBusy(false);
    }
  }

  async function exportCampaign() {
    if (!campaign) return;
    setOutput(campaign);
    await runAction("campaign export", async () => {
      setExportPreview(buildExportPreview(campaign));
      const data = await api("/export", {
        projectId,
        sourceId: campaign.sourceId,
        generationId: campaign.generation?.id || generationId,
        title: campaign.title,
        output: campaign
      });
      setExportPreview(buildExportPreview(campaign, data.export));
      setNotice(`Campaign export saved: ${data.export.relativeMdPath}`);
    });
  }

  async function exportCluster() {
    if (!cluster) return;
    setOutput(cluster);
    await runAction("cluster export", async () => {
      setExportPreview(buildExportPreview(cluster));
      const data = await api("/export", {
        projectId,
        sourceId: campaign?.sourceId || sourceId,
        generationId: campaign?.generation?.id || cluster.generation?.id || generationId,
        title: cluster.campaignPacket?.title || cluster.sourceInbox?.title || "Content Cluster",
        output: cluster
      });
      setExportPreview(buildExportPreview(cluster, data.export));
      setNotice(`Cluster export saved: ${data.export.relativeMdPath}`);
      await loadState();
    });
  }

  async function exportOutput() {
    await runAction("export", async () => {
      if (!output) throw new Error("Generate output before export.");
      setExportPreview(buildExportPreview(output));
      const data = await api("/export", {
        projectId,
        sourceId,
        generationId,
        title: outputTitle(output),
        output
      });
      setExportPreview(buildExportPreview(output, data.export));
      setNotice(`Export saved: ${data.export.relativeMdPath}`);
      await loadState();
    });
  }

  async function exportLatestChat() {
    await runAction("chat-export", async () => {
      if (!latestChat?.answer) throw new Error("Generate an agent answer before export.");
      const chatOutput = {
        ...latestChat,
        title: `${latestChat.agentLabel || "Content Agent"} Answer`,
        nextAction: latestChat.nextAction || "Continue this answer in the current ability or promote it into production output."
      };
      setExportPreview(buildExportPreview(chatOutput));
      const data = await api("/export", {
        projectId,
        sourceId,
        generationId: latestChat.id || generationId,
        title: chatOutput.title,
        output: chatOutput
      });
      setExportPreview(buildExportPreview(chatOutput, data.export));
      setNotice(`Answer export saved: ${data.export.relativeMdPath}`);
      await loadState();
    });
  }

  async function saveSnapshot() {
    await runAction("snapshot", async () => {
      const data = await api("/snapshot", { source, output });
      navigateSection("snapshot");
      setNotice(`Snapshot saved: ${data.relativePath}`);
    });
  }

  async function createManualBackup() {
    await runAction("manual-backup", async () => {
      const data = await api("/backups", {});
      setNotice(`Backup saved: ${data.backup.fileName}`);
      await refresh();
    });
  }

  async function restoreLatestBackup() {
    const backup = state?.dataProtection?.bundles?.find((item) => item.kind === "manual");
    if (!backup) return setNotice("Create a manual backup first.");
    if (!window.confirm(`Restore ${backup.fileName}? Wake will create a pre-restore rollback bundle first.`)) return;
    await runAction("backup-restore", async () => {
      const data = await api("/backups/restore", { fileName: backup.fileName });
      setState(data.state);
      setNotice(`Backup restored: ${backup.fileName}`);
    });
  }

  async function exportAllData() {
    await runAction("export-all", async () => {
      const data = await api("/export-all", {});
      setNotice(`Full data export saved: ${data.export.fileName}`);
      await refresh();
    });
  }

  async function cleanupCache() {
    await runAction("cache-cleanup", async () => {
      const data = await api("/cache/cleanup", {});
      setNotice(`Cache cleaned: ${data.cleanup.removed} files removed.`);
      await refresh();
    });
  }

  async function openFolder(target) {
    await runAction("open-folder", async () => {
      const data = await api("/open-folder", { target });
      setNotice(`Opened ${data.target} folder.`);
    });
  }

  function bestSystemVoice(preset) {
    if (!voices.length) return null;
    const saved = voices.find((voice) => voice.name === voiceName);
    if (saved) return saved;
    const preferred = voices.find((voice) => preset.preferredVoice?.test?.(`${voice.name} ${voice.lang}`));
    if (preferred) return preferred;
    const scored = voices
      .map((voice) => {
        const name = `${voice.name} ${voice.lang}`.toLowerCase();
        const score =
          (/natural|online|neural/.test(name) ? 60 : 0) +
          (/guy|david|mark|ryan|george|jenny|aria|zira|libby|sonia|susan/.test(name) ? 30 : 0) +
          (/en-|english|united states|great britain/.test(name) ? 10 : 0) -
          (/desktop|microsoft sam|robot|legacy/.test(name) ? 20 : 0);
        return { voice, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0]?.voice || voices[0];
  }

  function speakSystemVoice(customText) {
    const preset = voicePresets[voicePreset] || voicePresets.villain;
    const text = customText || preset.text;
    if (!text) return false;
    if (voiceMuted) {
      setTtsStatus("muted");
      setNotice("Installed System TTS is muted.");
      return false;
    }
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setTtsStatus("unavailable");
      setNotice("System voice is not available in this desktop runtime.");
      return false;
    }
    const utterance = new window.SpeechSynthesisUtterance(text);
    const selectedVoice = bestSystemVoice(preset);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = preset.rate;
    utterance.pitch = preset.pitch;
    utterance.volume = preset.volume;
    utterance.onstart = () => setTtsStatus("speaking");
    utterance.onend = () => {
      utteranceRef.current = null;
      setTtsStatus("idle");
    };
    utterance.onerror = (event) => {
      utteranceRef.current = null;
      if (event.error === "canceled" || event.error === "interrupted") {
        setTtsStatus("idle");
        return;
      }
      setTtsStatus("error");
      setNotice(`Installed System TTS failed: ${event.error || "unavailable"}.`);
    };
    window.speechSynthesis.cancel();
    utteranceRef.current = utterance;
    setTtsStatus("starting");
    window.speechSynthesis.speak(utterance);
    return true;
  }

  function stopSystemVoice() {
    window.speechSynthesis?.cancel();
    utteranceRef.current = null;
    setTtsStatus("idle");
  }

  function usePolishPrompt(prompt) {
    setChatMessage((current) => current.trim() ? `${current.trim()}\n\n${prompt}` : prompt);
  }

  function startSpeechInput() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechSupported(false);
      setNotice("Speech-to-text is not available in this desktop runtime. Typed chat is ready.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => {
      setListening(true);
      setNotice("Listening for speech input...");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((result) => result?.[0]?.transcript || "")
        .join(" ")
        .trim();
      if (transcript) {
        setChatMessage((current) => current.trim() ? `${current.trim()} ${transcript}` : transcript);
        setNotice("Speech captured into chat.");
      }
    };
    recognition.onerror = (event) => {
      setNotice(`Speech input stopped: ${event.error || "unavailable"}.`);
    };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
    } catch (error) {
      setListening(false);
      setNotice(error.message);
    }
  }

  function contextualAgentMessage() {
    const ability = abilityBlueprints[active];
    if (!ability) throw new Error(`Missing contextual-agent blueprint for route: ${active}`);
    const raw = chatMessage.trim();
    const sourceExcerpt = source.trim().slice(0, 900);
    const outputExcerpt = output ? jsonBlock(output).slice(0, 900) : "";
    return [
      `Wake Engine ability: ${ability.title}`,
      `Mission: ${ability.mission}`,
      `Operator request: ${raw}`,
      sourceExcerpt ? `Current source excerpt:\n${sourceExcerpt}` : "",
      outputExcerpt ? `Current output excerpt:\n${outputExcerpt}` : "",
      "Answer as a polish/edit pass for the current page. Be concrete, source-backed, and steer to the next best action."
    ].filter(Boolean).join("\n\n");
  }

  async function fetchInstructions() {
    if (!instructionsQuery.trim()) return;
    setInstructionsBusy(true);
    setInstructionsResult(null);
    setOperationError(null);
    try {
      const response = await api("/api/instructions/generate", "POST", { message: instructionsQuery });
      if (!response.ok) throw new Error(response.error || "Failed to generate instructions.");
      setInstructionsResult(response.instructions);
    } catch (error) {
      setOperationError(error.message);
    } finally {
      setInstructionsBusy(false);
    }
  }

  async function sendAgentMessage() {
    setChatBusy(true);
    setNotice("");
    setChatError("");
    setOperationError(null);
    let visibleAnswer = "";
    try {
      const rawMessage = chatMessage.trim();
      if (!rawMessage) throw new Error("Message is required.");
      if (active === "agent" && !source.trim()) throw new Error("Choose a saved source or paste source before chatting with this agent.");
      const pendingChat = {
        id: `pending-${Date.now()}`,
        projectId,
        agentLabel: "Content Agent",
        message: rawMessage,
        answer: "",
        provider: "streaming",
        providerLabel: "Instant Local Draft",
        profile: "streaming",
        responseBudgetMs: 0,
        section: active,
        status: "connecting",
        quality: null
      };
      setLatestChat(pendingChat);
      setChatMessage("");
      let modelAnswer = "";
      await apiStream("/agent-chat/stream", {
        projectId,
        sourceId,
        agentId: selectedAgent,
        ability: active,
        mode: chatMode,
        message: contextualAgentMessage()
      }, (event) => {
        if (event.type === "meta") {
          setLatestChat((current) => ({
            ...current,
            agentLabel: event.agentLabel,
            profile: event.profile,
            responseBudgetMs: event.responseBudgetMs,
            providerLabel: event.providerLabel || "Instant Local Draft"
          }));
        }
        if (event.type === "draft") {
          visibleAnswer = event.answer || "";
          setLatestChat((current) => ({
            ...current,
            answer: visibleAnswer,
            provider: event.provider,
            providerLabel: event.providerLabel || "Instant Local Draft",
            status: "draft",
            quality: event.quality
          }));
        }
        if (event.type === "provider-status") {
          setLatestChat((current) => ({
            ...current,
            providerLabel: event.llmLive ? event.model || "Ollama" : "Instant Local Draft",
            model: event.model || current?.model
          }));
        }
        if (event.type === "upgrade-start") {
          modelAnswer = "";
          setLatestChat((current) => ({
            ...current,
            provider: "ollama",
            providerLabel: event.model || "Ollama",
            model: event.model,
            status: "upgrading"
          }));
        }
        if (event.type === "token") {
          modelAnswer += event.token;
          visibleAnswer = modelAnswer;
          setLatestChat((current) => ({ ...current, answer: modelAnswer, provider: "ollama", status: "streaming" }));
        }
        if (event.type === "final") {
          const chat = { ...event.chat, message: rawMessage, section: active };
          visibleAnswer = chat.answer || visibleAnswer;
          setChatHistory((items) => [chat, ...items].slice(0, 16));
          setLatestChat(chat);
          setOutput(chat);
          setGenerationId(chat.id);
          setNotice(`${chat.agentLabel} answered with ${chatProviderLabel(chat, llmStatus)}.`);
        }
        if (event.type === "error") throw new Error(event.error);
      }, { timeoutMs: 32000 });
      await refresh();
    } catch (error) {
      const message = error.message || "Agent chat failed without returning an answer.";
      setChatError(message);
      setOperationError({ ability: active, action: "agent chat", message });
      setLatestChat((current) => ({
        ...(current || {}),
        id: current?.id || `failed-${Date.now()}`,
        agentLabel: current?.agentLabel || "Content Agent",
        message: current?.message || chatMessage.trim(),
        answer: current?.answer || visibleAnswer || `No answer was returned. ${message}`,
        provider: "error",
        providerLabel: "Error",
        section: active,
        status: "error"
      }));
      setNotice(message);
    } finally {
      setChatBusy(false);
      api("/agent-chat/status").then(setLlmStatus).catch(() => setLlmStatus({ live: false }));
    }
  }

  async function runIntakeAgent(rootsOverride = null, label = "listed folders") {
    setIntakeBusy(true);
    setNotice("");
    try {
      const roots = Array.isArray(rootsOverride) && rootsOverride.length
        ? rootsOverride
        : intakeRootsText.split(/\r?\n/).map((root) => root.trim()).filter(Boolean);
      if (!roots.length) throw new Error("Choose a local folder, drive, or flash drive before importing.");
      setIntakeRootsText(roots.join("\n"));
      const data = await api("/intake/run", { roots, projectId, intent: intakeIntent }, { timeoutMs: 600000 });
      await refresh();
      setNotice(`Scanned ${label}: ${data.run.scanned} files. Added ${data.run.sourceAdded} sources and ${data.run.mediaAdded} media assets.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setIntakeBusy(false);
    }
  }

  async function reviewIntakeAgent(rootsOverride = null, label = "listed folders") {
    setIntakeBusy(true);
    setNotice("");
    try {
      const roots = Array.isArray(rootsOverride) && rootsOverride.length
        ? rootsOverride
        : intakeRootsText.split(/\r?\n/).map((root) => root.trim()).filter(Boolean);
      if (!roots.length) throw new Error("Choose a local folder, drive, or flash drive before review.");
      setIntakeRootsText(roots.join("\n"));
      const data = await api("/intake/review", { roots, projectId, intent: intakeIntent }, { timeoutMs: 600000 });
      await refresh();
      setIntakeReviewSelection([]);
      setNotice(`Review staged for ${label}: ${data.review.eligible} eligible items. Nothing was imported yet.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setIntakeBusy(false);
    }
  }

  const latestIntakeReview = (state?.intakeReviews || []).find((review) => review.projectId === projectId) || null;

  function toggleReviewCandidate(candidateId) {
    setIntakeReviewSelection((current) => current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId]);
  }

  function selectReviewCandidates(mode) {
    if (!latestIntakeReview || mode === "none") {
      setIntakeReviewSelection([]);
      return;
    }
    const ids = latestIntakeReview.candidates
      .filter((candidate) => candidate.decisionStatus === "recommended" && candidate.eligible && !candidate.alreadyImported)
      .slice(0, 80)
      .map((candidate) => candidate.reviewId);
    setIntakeReviewSelection(ids);
  }

  async function applyIntakeReview() {
    if (!latestIntakeReview || !intakeReviewSelection.length) return;
    setIntakeBusy(true);
    setNotice("");
    try {
      const data = await api(`/intake/reviews/${encodeURIComponent(latestIntakeReview.id)}/apply`, { candidateIds: intakeReviewSelection }, { timeoutMs: 600000 });
      await refresh();
      setIntakeReviewSelection([]);
      setNotice(`Imported reviewed items: ${data.result.sourceAdded} sources and ${data.result.mediaAdded} media assets.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setIntakeBusy(false);
    }
  }

  function loadSource(item) {
    setSource(sourceDocumentBody(item.source));
    setSourceId(item.id);
    setProjectId(item.projectId);
    navigateSection("console");
    setNotice(`Loaded source: ${item.title}`);
  }

  async function selectSourceForAgent(item) {
    setBusy(true);
    setNotice("");
    setOperationError(null);
    try {
      const data = await api(`/sources/${encodeURIComponent(item.id)}/content`);
      setSource(sourceDocumentBody(data.document.content));
      setSourceId(item.id);
      setProjectId(item.projectId);
      navigateSection("agent");
      setNotice(`Agent source loaded: ${data.document.title}`);
    } catch (error) {
      setSource(sourceDocumentBody(item.source));
      setSourceId(item.id);
      setProjectId(item.projectId);
      navigateSection("agent");
      setNotice(`Agent source loaded from saved preview: ${item.title}`);
    } finally {
      setBusy(false);
    }
  }

  async function openSourceDocument(item) {
    setModal({ kind: "document", title: item.title.replace(/^\[[^\]]+\]\s*/, ""), body: "Loading document...", loading: true });
    try {
      const data = await api(`/sources/${encodeURIComponent(item.id)}/content`);
      setModal({
        kind: "document",
        title: data.document.title,
        body: data.document.content,
        meta: `${data.document.sourceType} · ${data.document.characterCount} characters`,
        sourceItem: item,
        rename: { type: "source", id: item.id, value: data.document.title }
      });
    } catch (error) {
      setModal({ kind: "document", title: item.title, body: error.message, error: true });
    }
  }

  function openMediaAsset(asset) {
    const isImage = asset.kind === "image";
    setModal({
      kind: "media",
      title: asset.title,
      body: [
        `Kind: ${asset.kind}`,
        `Lane: ${asset.lane || "Unlabeled Media"}`,
        `Extension: ${asset.extension || "unknown"}`,
        `Path: ${asset.path || "not available"}`,
        asset.sizeBytes ? `Size: ${asset.sizeBytes.toLocaleString()} bytes` : null,
        asset.modifiedAt ? `Modified: ${new Date(asset.modifiedAt).toLocaleString()}` : null
      ].filter(Boolean).join("\n"),
      mediaItem: asset,
      previewUrl: isImage ? `/api/media/${encodeURIComponent(asset.id)}/preview?v=${encodeURIComponent(asset.updatedAt || asset.importedAt || asset.modifiedAt || "")}` : null,
      rename: { type: "media", id: asset.id, value: asset.title }
    });
  }

  async function openMediaItem(asset) {
    if (!asset?.id) return;
    try {
      await api(`/media/${encodeURIComponent(asset.id)}/open`, {});
      setNotice(`Opened media item: ${asset.title}`);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function saveModalRename() {
    if (!modal?.rename) return;
    const title = String(modal.rename.value || "").trim();
    if (!title) {
      setNotice("Rename needs a title.");
      return;
    }
    try {
      if (modal.rename.type === "media") {
        await api(`/media/${encodeURIComponent(modal.rename.id)}/rename`, { title });
      } else if (modal.rename.type === "source") {
        await api(`/sources/${encodeURIComponent(modal.rename.id)}/rename`, { title });
      }
      await refresh();
      setNotice(`Renamed: ${title}`);
      setModal(null);
    } catch (error) {
      setNotice(error.message);
    }
  }

  function loadGeneration(item) {
    setOutput(item.output);
    setGenerationId(item.id);
    setProjectId(item.projectId);
    if (item.kind === "autonomous-campaign") {
      setCampaign(item.output);
      setCluster(item.output?.cluster || null);
      setSelectedPlatform("tiktok");
      navigateSection("console");
    } else if (item.kind === "content-cluster") {
      setCluster(item.output);
      navigateSection("cluster");
    } else {
      navigateSection("agent");
    }
    setNotice(`Loaded output: ${item.title}`);
  }

  function routeToWorkSurface(route, agentId = null) {
    setModal(null);
    if (agentId) setSelectedAgent(agentId);
    navigateSection(route);
    setNotice(`Opened ${tabs.find((item) => item.id === route)?.label || route}.`);
  }

  function taskRoute(task) {
    const text = `${task.title} ${task.owner} ${task.detail}`.toLowerCase();
    if (/agent|tier zero|chat/.test(text)) return { route: "agent", agentId: "strategist" };
    if (/cluster|campaign|platform|content/.test(text)) return { route: "cluster" };
    if (/source|prompt|frame|console/.test(text)) return { route: "console" };
    if (/snapshot|audit/.test(text)) return { route: "snapshot" };
    if (/export|distribution|library|memory|ledger/.test(text)) return { route: "library" };
    if (/intake|media|vault/.test(text)) return { route: "vault" };
    return { route: "tasks" };
  }

  function capabilityRoute(capability) {
    const routes = {
      ingest: { route: "console" },
      "local-agent": { route: "agent", agentId: "strategist" },
      "agent-chat": { route: "agent", agentId: "strategist" },
      "ip-intake": { route: "vault" },
      "content-cluster": { route: "cluster" },
      snapshot: { route: "snapshot" },
      script: { route: "agent", agentId: "scriptwriter" },
      distribution: { route: "library" },
      memory: { route: "library" },
      monitor: { route: "tasks" }
    };
    return routes[capability.id] || { route: "tasks" };
  }

  function openTaskCard(task) {
    const target = taskRoute(task);
    setModal({
      title: task.title,
      body: [
        `Status: ${task.status}`,
        `Owner: ${task.owner}`,
        `Updated: ${task.updated}`,
        "",
        task.detail,
        "",
        `Click Open to jump to the ${tabs.find((item) => item.id === target.route)?.label || target.route} surface.`
      ].join("\n"),
      action: { label: "Open Related Surface", onClick: () => routeToWorkSurface(target.route, target.agentId) }
    });
  }

  function openCapabilityCard(capability) {
    const target = capabilityRoute(capability);
    const evidence = (capability.evidence || []).join("\n");
    setModal({
      title: capability.label,
      body: [
        `Status: ${capability.status}`,
        capability.tierZeroVerified ? "Tier Zero: verified in this runtime" : "Tier Zero: not claimed for this item",
        "",
        capability.detail,
        "",
        evidence ? `Evidence:\n${evidence}` : "Evidence: local runtime state"
      ].join("\n"),
      action: { label: "Open Related Surface", onClick: () => routeToWorkSurface(target.route, target.agentId) }
    });
  }

  function openMonitorCard(label, body) {
    setModal({ title: label, body });
  }

  function copyOutput() {
    navigator.clipboard?.writeText(output ? jsonBlock(output) : source);
    setNotice("Current output copied.");
  }

  const sectionAgentChat = (
    <AgentChatConsole
      state={state}
      active={active}
      source={source}
      sourceRequired={active === "agent"}
      projectId={projectId}
      selectedAgent={selectedAgent}
      setSelectedAgent={setSelectedAgent}
      chatMessage={chatMessage}
      setChatMessage={setChatMessage}
      chatHistory={chatHistory}
      latestChat={latestChat}
      chatBusy={chatBusy}
      chatMode={chatMode}
      setChatMode={setChatMode}
      llmStatus={llmStatus}
      busy={busy || intakeBusy}
      onSend={sendAgentMessage}
      onPrompt={usePolishPrompt}
      onApplyAnswerToSource={applyLatestChatToSource}
      onPromoteAnswer={promoteLatestChatOutput}
      onExport={exportLatestChat}
      onSpeakAnswer={() => speakSystemVoice(latestChat?.answer)}
      speechSupported={speechSupported}
      listening={listening}
      onListen={startSpeechInput}
      ttsSupported={Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance)}
      ttsStatus={ttsStatus}
      chatError={chatError}
    />
  );

  function applyLatestChatToSource() {
    if (!latestChat?.answer) return;
    setSource(latestChat.answer);
    setSourceId(null);
    navigateSection("console");
    setNotice("Agent answer applied to Source Workspace.");
  }

  function promoteLatestChatOutput() {
    if (!latestChat) return;
    setOutput(latestChat);
    setGenerationId(latestChat.id);
    setNotice("Agent answer promoted as current output.");
  }

  async function submitOperatorGate(event) {
    event.preventDefault();
    const operator = operatorName.trim();
    const phrase = accessPhrase.trim();
    if (!operator || !phrase) {
      setLoginStatus("CALLSIGN AND PHRASE REQUIRED");
      return;
    }
    setLoginStatus("AUTHENTICATING");
    try {
      const session = await api("/session/login", { operator, phrase });
      localStorage.setItem("wake.operatorName", session.operator || operator.toUpperCase());
      sessionStorage.removeItem("wake.operatorGate");
      setOperatorName(session.operator || operator.toUpperCase());
      setAccessPhrase("");
      setLoginStatus("ACCESS GRANTED");
      setLoginComplete(true);
      await refresh();
    } catch (error) {
      setLoginStatus(error.code === "ACCESS_PHRASE_REJECTED" ? "ACCESS DENIED" : "LOGIN FAILED");
    }
  }

  if (!loginComplete) {
    return (
      <OperatorGate
        operator={operatorName}
        phrase={accessPhrase}
        status={loginStatus}
        onOperatorChange={setOperatorName}
        onPhraseChange={setAccessPhrase}
        onSubmit={submitOperatorGate}
      />
    );
  }

  if (!state || !bootComplete) {
    const progress = state ? bootProgress : 6;
    const activeLineCount = Math.max(1, Math.ceil((progress / 100) * bootLines.length));
    return (
      <main className="boot boot-terminal">
        <div className="crt-frame">
          <div className="wake-mark">W</div>
          <div className="boot-copy">
            <small>WAKE ENGINE V6 / LOCAL DESKTOP RUNTIME</small>
            <h1>INITIALIZING SYSTEM</h1>
            <div className="boot-lines">
              {bootLines.slice(0, activeLineCount).map((line, index) => (
                <span key={line}><b>{String(index + 1).padStart(2, "0")}</b> {line}</span>
              ))}
            </div>
            <div className="boot-progress" aria-label="Boot progress">
              <i style={{ width: `${progress}%` }} />
            </div>
            <p>{progress >= 100 ? "SYSTEM ONLINE" : `BOOT SEQUENCE ${progress}%`}</p>
            <div className="boot-actions">
              <button type="button" className="primary-action" onClick={finishBoot}>Skip Boot</button>
              <button type="button" aria-label={voiceMuted ? "Unmute system voice" : "Mute system voice"} onClick={() => setVoiceMuted((value) => !value)}>
                {voiceMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                {voiceMuted ? "Voice Muted" : "Voice On"}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <main className="phone-frame">
        <div className="identity-rail">
          <img src={emblemSrc} alt="ForgeFront Systems" />
          <span>ForgeFront Systems</span>
          <strong>WAKE Engine V6</strong>
          <Pill tone="live">Desktop Live</Pill>
        </div>
        <header className="hero-panel">
          <div className="brand-lockup">
            <div className="emblem-stage" aria-label="ForgeFront Systems emblem">
              <img src={emblemSrc} alt="ForgeFront Systems emblem" />
            </div>
            <div className="title-stack">
              <div className="forge-wordmark">ForgeFront Systems</div>
              <div className="title-line">
                <h1>WAKE Engine</h1>
                <span className="version">V6</span>
              </div>
              <div className="engine-status">
                <span className="status-dot" />
                <strong>DESKTOP APP LIVE</strong>
                <span>local runtime :8786</span>
                <button type="button" aria-label="Inspect runtime" onClick={() => setModal({ title: "Runtime", body: "WAKE Engine V6 is running locally with persistent packets, traces, exports, snapshots, and history. Tier Zero claims refer to the user-promoted local build parameters; no separate canonical Tier Zero specification exists in this repo." })}>
                  <Radio size={15} />
                  Inspect
                </button>
                <button type="button" aria-label="Open voice settings" onClick={() => setShowVoicePanel((value) => !value)}>
                  {voiceMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  Voice
                </button>
                <button type="button" aria-label="Replay boot sequence" onClick={replayBoot}>
                  <RotateCcw size={15} />
                  Replay Boot
                </button>
              </div>
            </div>
            <button className="round-info" type="button" aria-label="Open WAKE truth rule" onClick={() => setModal({ title: "No Theater Rule", body: "WAKE V6 shows only the local desktop functions that are active in this app. Local functions are persisted and auditable." })}>
              <Info size={24} />
            </button>
          </div>

          <nav className="tab-grid" aria-label="WAKE V6 sections">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={active === id ? "selected" : ""} onClick={() => navigateSection(id)}>
                <Icon size={30} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <label className="project-switcher">
            <span>Project</span>
            <select value={projectId} onChange={(event) => switchProject(event.target.value)} aria-label="Current project">
              {state.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>

          {showVoicePanel && (
            <div className="voice-panel">
              <div>
                <small>Installed System TTS</small>
                <strong>{voiceMuted ? "Muted" : voicePresets[voicePreset]?.label || "Villain"}</strong>
                <span>Uses the installed desktop/browser speech synthesis runtime. No custom voice model is claimed.</span>
                <span>{voices.length} installed voices detected · {ttsStatus}</span>
              </div>
              <div className="voice-presets">
                {Object.entries(voicePresets).filter(([id]) => id !== "muted").map(([id, preset]) => (
                  <button key={id} type="button" className={voicePreset === id ? "selected" : ""} onClick={() => setVoicePreset(id)}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <select value={voiceName} onChange={(event) => setVoiceName(event.target.value)} aria-label="System voice">
                <option value="">Auto voice</option>
                {voices.map((voice) => (
                  <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>
                ))}
              </select>
              <div className="voice-actions">
                <button type="button" aria-label={voiceMuted ? "Unmute system voice" : "Mute system voice"} onClick={() => setVoiceMuted((value) => !value)}>
                  {voiceMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  {voiceMuted ? "Unmute" : "Mute"}
                </button>
                <button type="button" className="primary-action" disabled={voiceMuted || !window.speechSynthesis} onClick={() => speakSystemVoice("System online. Wake Engine is awake.")}>
                  Test Voice
                  <Volume2 size={16} />
                </button>
                {ttsStatus === "speaking" || ttsStatus === "starting" ? (
                  <button type="button" aria-label="Stop system voice" onClick={stopSystemVoice}><Square size={15} /> Stop</button>
                ) : null}
                <button type="button" onClick={replayBoot}><RotateCcw size={15} /> Replay Boot</button>
              </div>
            </div>
          )}
        </header>

        <section className="content-flow">
          {active !== "console" && active !== "cluster" && !standaloneRoutes.has(active) ? (
            <>
              <ActiveTaskSpine
                task={state.activeTask}
                draft={taskDraft}
                setDraft={setTaskDraft}
                onSave={saveActiveTask}
              />

              <NextStepPanel
                active={active}
                source={source}
                output={output}
                cluster={cluster}
                state={state}
                busy={busy || intakeBusy}
                onGo={navigateSection}
                onGenerateFrame={generateFrame}
                onRunAgent={runAgent}
                onBuildCluster={buildCluster}
                onExport={exportOutput}
                onSaveSnapshot={saveSnapshot}
                onRunIntake={runIntakeAgent}
              />

              <AbilityCommandHeader
                active={active}
                state={state}
                source={source}
                output={output}
                cluster={cluster}
                system={system}
                llmStatus={llmStatus}
                filteredSources={filteredSources}
                latestChat={latestChat}
                operationError={operationError?.ability === active ? operationError : chatError ? { action: "agent chat", message: chatError } : null}
              />

              <AbilityActionRail
                active={active}
                busy={busy || intakeBusy}
                hasSource={Boolean(source.trim())}
                output={output}
                cluster={cluster}
                onGo={navigateSection}
                onSaveSource={saveSource}
                onGenerateFrame={generateFrame}
                onRunAgent={runAgent}
                onBuildCluster={buildCluster}
                onExport={exportOutput}
                onSaveSnapshot={saveSnapshot}
                onRunIntake={runIntakeAgent}
                onOpenFolder={openFolder}
              />
            </>
          ) : null}

          <div id="active-section" ref={activeSectionRef} className="active-section-anchor" />

          {active === "agent" ? (
            <AgentSourcePanel
              source={source}
              sourceId={sourceId}
              projectSources={projectSources}
              busy={busy || intakeBusy}
              onSelectSource={selectSourceForAgent}
              onOpenConsole={() => navigateSection("console")}
              onRunAgent={runAgent}
            />
          ) : null}

          {active === "console" || active === "cluster" ? (
            <details className="context-agent-tools">
              <summary>Ask content agents</summary>
              {sectionAgentChat}
            </details>
          ) : standaloneRoutes.has(active) ? null : sectionAgentChat}

          {exportPreview && active !== "console" && active !== "cluster" && !standaloneRoutes.has(active) && (
            <ExportPreviewPanel preview={exportPreview} />
          )}

          {active === "agent" && output && (
            <Panel className="agent-output-panel">
              <PanelTitle
                icon={WandSparkles}
                title="Created Content"
                right={<div className="inline-actions"><button type="button" className="mini-action" onClick={copyOutput}><Clipboard size={16} /> Copy</button><button type="button" className="mini-action" onClick={exportOutput}><Download size={16} /> Export</button></div>}
              />
              <OutputStudio output={output} />
            </Panel>
          )}

          {active === "console" && (
            <>
              {operationError?.ability === "console" ? <div className="ability-state error"><strong>Campaign action failed</strong><p>{operationError.message}</p></div> : null}
              <CampaignAutopilot
                projectName={state.projects.find((project) => project.id === projectId)?.name || "Current Project"}
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
                onOpenImageSetup={state.imageGeneration?.consentRequired ? enableExternalImageGeneration : () => setModal({ title: "Connect Image Engine", body: "Wake stores provider credentials in Windows secure storage and keeps generated originals in local application data." })}
                source={source}
                setSource={setSource}
                onSaveSource={saveSource}
              />
              {exportPreview ? <ExportPreviewPanel preview={exportPreview} /> : null}
              <details className="autopilot-admin">
                <summary>Project settings</summary>
                <div className="project-row">
                  <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name..." aria-label="Project name" />
                  <div className="project-actions">
                    <button type="button" className="mini-action" disabled={busy} onClick={saveProject}>Rename</button>
                    <button type="button" className="mini-action" disabled={busy || !projectName.trim()} onClick={createProject}>Create</button>
                  </div>
                </div>
                <div className="data-protection-row" aria-label="Local data protection">
                  <button type="button" className="mini-action" disabled={busy} onClick={createManualBackup} title="Create local backup"><Save size={15} /> Backup</button>
                  <button type="button" className="mini-action" disabled={busy || !state.dataProtection?.bundles?.some((item) => item.kind === "manual")} onClick={restoreLatestBackup} title="Restore latest local backup"><RotateCcw size={15} /> Restore</button>
                  <button type="button" className="mini-action" disabled={busy} onClick={exportAllData} title="Export all local data"><Download size={15} /> Export All</button>
                  <button type="button" className="mini-action" disabled={busy} onClick={cleanupCache} title="Clean temporary cache"><HardDrive size={15} /> Clean Cache</button>
                  <small>{state.dataProtection?.storage?.recovery?.status || "local"} · {state.dataProtection?.bundles?.length || 0} bundles</small>
                </div>
              </details>
            </>
          )}

          {active === "cluster" && (
            <>
            {operationError?.ability === "cluster" ? <div className="ability-state error"><strong>Cluster action failed</strong><p>{operationError.message}</p></div> : null}
            <Panel className="cluster-panel">
              <PanelTitle icon={Layers} title="Content Cluster" right={<div className="inline-actions"><button className="mini-action" type="button" disabled={busy || !cluster} onClick={exportCluster}><Download size={16} /> Export Cluster</button><button className="primary-action" type="button" disabled={busy} onClick={buildCluster}>Build Cluster <Zap size={16} /></button></div>} />
              {!cluster ? (
                <div className="cluster-empty">
                  <Database size={28} />
                  <h2>Source in. Cluster out.</h2>
                  <p>Builds persistent pillars, output lanes, proof notes, and operator handoff drafts locally.</p>
                  <button type="button" className="primary-action" disabled={busy} onClick={buildCluster}>Build Content Cluster</button>
                </div>
              ) : (
                <div className="cluster-stack">
                  <div className="term-strip">
                    {cluster.sourceInbox.terms.map((item) => (
                      <span key={item.term}>{item.term}<small>{item.count}</small></span>
                    ))}
                  </div>
                  <OutputStudio output={cluster} />
                  <div className="autopilot-next-step"><small>Next step</small><p>{cluster.nextAction}</p></div>
                  <ExportPreviewPanel preview={exportPreview || buildExportPreview(cluster)} />
                </div>
              )}
            </Panel>
            </>
          )}

          {active === "vault" && (
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
              <IPVault
                projectName={state.projects.find((project) => project.id === projectId)?.name}
                projectSources={projectSources}
                sourceQuery={sourceQuery}
                setSourceQuery={setSourceQuery}
                laneFilter={laneFilter}
                setLaneFilter={setLaneFilter}
                filteredSources={filteredSources}
                openSourceDocument={openSourceDocument}
              />
            </>
          )}

          {active === "library" && (
            <div className="lower-grid library-grid">
              <Panel>
                <PanelTitle icon={Archive} title="Saved Sources" />
                <div className="library-list">
                  {projectSources.map((item) => (
                    <button key={item.id} type="button" onClick={() => openSourceDocument(item)}>
                      <strong>{item.title.replace(/^\[[^\]]+\]\s*/, "")}</strong>
                      <small>{item.characterCount} chars · {new Date(item.createdAt).toLocaleString()}</small>
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
                      <small>{item.kind} · {new Date(item.createdAt).toLocaleString()}</small>
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel>
                <PanelTitle icon={Download} title="Exports" />
                <div className="library-list">
                  {projectExports.map((item) => (
                    <button key={item.id} type="button" onClick={() => setModal({
                      title: item.title,
                      body: [
                        `Markdown: ${item.relativeMdPath}`,
                        `JSON: ${item.relativeJsonPath}`,
                        `Inspection: ${item.inspection?.ok ? "passed" : "blocked"}`,
                        item.inspection?.missing?.length ? `Missing: ${item.inspection.missing.join(", ")}` : "Missing: none"
                      ].join("\n")
                    })}>
                      <strong>{item.title}</strong>
                      <small>{item.inspection?.ok ? "inspected" : "needs review"} · {item.relativeMdPath}</small>
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel>
                <PanelTitle icon={ListChecks} title="History" />
                <div className="library-list">
                  {projectHistory.map((item) => (
                    <button key={item.id} type="button" onClick={() => setModal({ title: item.type, body: item.detail })}>
                      <strong>{item.detail}</strong>
                      <small>{new Date(item.createdAt).toLocaleString()}</small>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          )}
          {active === "instructions" && (
            <Panel>
              <PanelTitle icon={BookOpen} title="Operations Guide" />
              <div className="instructions-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>
                <p>Describe your goal to receive a step-by-step WAKE Engine manual workflow.</p>
                <textarea
                  className="chat-input"
                  placeholder="What do you want to do simply?"
                  value={instructionsQuery}
                  onChange={(e) => setInstructionsQuery(e.target.value)}
                  disabled={instructionsBusy}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
                <button 
                  type="button" 
                  className="primary-action" 
                  disabled={instructionsBusy || !instructionsQuery.trim()} 
                  onClick={fetchInstructions}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {instructionsBusy ? "Generating..." : "Get Instructions"}
                </button>
                {instructionsResult && (
                  <div className="instructions-result" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <pre className="document-content" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{instructionsResult}</pre>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {active === "automations" && (
            <AutomationsPanel 
              state={state} 
              onRefresh={refresh}
              setModal={setModal} 
              setOperationError={setOperationError} 
            />
          )}

          {active === "tasks" && (
            <>
            <Panel className="monitor-panel">
              <PanelTitle
                icon={Activity}
                title="System Monitor"
                right={<button type="button" className="panel-icon-action" aria-label="System monitor info" onClick={() => openMonitorCard("System Monitor", "Live local telemetry for CPU, RAM, GPU, runtime port, process uptime, and recent action logs. Click any tile or trace for the exact value behind it.")}><Info size={18} /></button>}
              />
              <div className="monitor-grid">
                <MonitorTile
                  icon={Cpu}
                  label="CPU"
                  value={metricValue(system?.cpu?.percent)}
                  detail={system?.cpu ? `${system.cpu.cores} cores` : "sampling"}
                  onClick={() => openMonitorCard("CPU", system?.cpu ? `Current CPU: ${system.cpu.percent}%\nCores: ${system.cpu.cores}` : "CPU telemetry is still sampling.")}
                />
                <MonitorTile
                  icon={MemoryStick}
                  label="RAM"
                  value={metricValue(system?.memory?.percent)}
                  detail={system?.memory ? `${system.memory.usedGb}/${system.memory.totalGb} GB` : "sampling"}
                  onClick={() => openMonitorCard("RAM", system?.memory ? `Current RAM: ${system.memory.percent}%\nUsed: ${system.memory.usedGb} GB\nTotal: ${system.memory.totalGb} GB` : "RAM telemetry is still sampling.")}
                />
                <MonitorTile
                  icon={Gauge}
                  label="GPU"
                  value={metricValue(system?.gpu?.utilization)}
                  detail={system?.gpu?.name || "sampling"}
                  tone={system?.gpu?.status === "unavailable" ? "warn" : "live"}
                  onClick={() => openMonitorCard("GPU", system?.gpu ? `Current GPU: ${metricValue(system.gpu.utilization)}\nName: ${system.gpu.name || "unknown"}\nStatus: ${system.gpu.status || "sampling"}` : "GPU telemetry is still sampling.")}
                />
                <MonitorTile
                  icon={HardDrive}
                  label="Runtime"
                  value={system?.runtime ? `:${system.runtime.port}` : ":8786"}
                  detail={system?.runtime ? `PID ${system.runtime.pid}` : "local"}
                  onClick={() => openMonitorCard("Runtime", system?.runtime ? `Local runtime port: ${system.runtime.port}\nPID: ${system.runtime.pid}\nUptime: ${system.runtime.uptime || "sampling"}` : "Runtime telemetry is still sampling.")}
                />
              </div>
              <div className="telemetry-grid">
                <Sparkline label="CPU Trace" values={systemHistory.map((item) => item.cpu?.percent || 0)} onClick={() => openMonitorCard("CPU Trace", `${systemHistory.length} samples retained in this session.\nLatest: ${metricValue(system?.cpu?.percent)}`)} />
                <Sparkline label="RAM Trace" values={systemHistory.map((item) => item.memory?.percent || 0)} tone="green" onClick={() => openMonitorCard("RAM Trace", `${systemHistory.length} samples retained in this session.\nLatest: ${metricValue(system?.memory?.percent)}`)} />
                <Sparkline label="GPU Trace" values={systemHistory.map((item) => item.gpu?.utilization || 0)} tone="ember" onClick={() => openMonitorCard("GPU Trace", `${systemHistory.length} samples retained in this session.\nLatest: ${metricValue(system?.gpu?.utilization)}`)} />
              </div>
              <div className="log-strip">
                {(system?.logs || []).slice(0, 4).map((entry) => (
                  <button key={entry.id} type="button" onClick={() => setModal({ title: entry.level.toUpperCase(), body: `${entry.message}\n${new Date(entry.createdAt).toLocaleString()}` })}>
                    <span className={`log-dot ${entry.level}`} />
                    <strong>{entry.message}</strong>
                    <small>{new Date(entry.createdAt).toLocaleTimeString()}</small>
                  </button>
                ))}
              </div>
              <div className="desktop-actions">
                <button type="button" onClick={() => openFolder("exports")}><Download size={16} /> Open Exports</button>
                <button type="button" onClick={() => openFolder("snapshots")}><Camera size={16} /> Open Snapshots</button>
                <button type="button" onClick={() => openFolder("data")}><Database size={16} /> Open Data</button>
              </div>
            </Panel>

            <div className="lower-grid">
              <Panel>
                <PanelTitle icon={ListChecks} title="Task Monitor" right={<button type="button" className="panel-icon-action" aria-label="Task monitor filter info" onClick={() => openMonitorCard("Task Monitor Filters", "Use All, Running, or Done to narrow the task list. Click any task row to get its detail and jump to the related Wake Engine surface.")}><Filter size={18} /></button>} />
                <input className="task-search" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="Search tasks..." />
                <div className="filter-row">
                  {["all", "running", "done"].map((filter) => (
                    <button key={filter} type="button" className={taskFilter === filter ? "active-filter" : ""} onClick={() => setTaskFilter(filter)}>
                      {filter}<span>{taskCounts[filter] || 0}</span>
                    </button>
                  ))}
                </div>
                <div className="task-list">
                  {filteredTasks.map((task) => (
                    <button key={task.id} type="button" className="task-row" onClick={() => openTaskCard(task)}>
                        <span className={`task-light ${statusTone[task.status] || task.status}`} />
                        <span><strong>{task.title}</strong><small>{task.status}</small></span>
                        <em>{task.updated}</em>
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel>
                <PanelTitle icon={Hexagon} title="Capability Truth Map" right={<button type="button" className="panel-icon-action" aria-label="Capability truth map info" onClick={() => openMonitorCard("Capability Truth Map", "Every row is tied to local runtime evidence. Click a capability to see status, evidence, and a jump button to the section or agent it represents.")}><CircleAlert size={18} /></button>} />
                <div className="capability-list">
                  {state.capabilities.map((capability) => (
                    <button key={capability.id} type="button" onClick={() => openCapabilityCard(capability)}>
                      <span className={`task-light ${statusTone[capability.status]}`} />
                      <span><strong>{capability.label}</strong><small>{capability.detail}</small></span>
                      <Pill tone={capability.status}>{capability.status}</Pill>
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
            </>
          )}

          {active === "snapshot" && (
            <Panel>
              <PanelTitle icon={Camera} title="Snapshot / Audit Trail" />
              <div className="snapshot-box">
                <CircleCheck size={34} />
                <h2>{state.runtime.snapshots} snapshots · {state.runtime.exports} exports</h2>
                <p>Sources, generated outputs, exports, history, and snapshots are persistent files in Wake Engine local application data.</p>
                <button type="button" className="primary-action" disabled={busy} onClick={saveSnapshot}>Save Snapshot</button>
              </div>
            </Panel>
          )}
        </section>

        <footer className="status-rail">
          <span><Cpu size={18} /> CPU {metricValue(system?.cpu?.percent)}</span>
          <span><MemoryStick size={18} /> RAM {metricValue(system?.memory?.percent)}</span>
          <span><Gauge size={18} /> GPU {metricValue(system?.gpu?.utilization)}</span>
          <span><Database size={18} /> Sources {state.runtime.sources}</span>
        </footer>

        <div className="dock">
          <button type="button" className="terminal-button" onClick={() => setActive("console")}><TerminalSquare size={28} /></button>
          <button type="button" className="run-button" aria-label="Run Agent" disabled={busy || !source.trim()} onClick={runAgent}><Play size={24} /> Run Agent <small>{source.trim() ? "Save output" : "Source required"}</small></button>
          <button type="button" className="snapshot-button" aria-label="Export Output" disabled={busy || !output} onClick={exportOutput}><Download size={24} /> Export <small>MD + JSON</small></button>
        </div>
      </main>

      {notice && <div className="toast">{notice}</div>}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className={`modal ${modal.kind === "document" ? "document-modal" : ""} ${modal.kind === "media" ? "media-modal" : ""}`} onClick={(event) => event.stopPropagation()}>
            <h2>{modal.title}</h2>
            {modal.meta ? <small className="document-meta">{modal.meta}</small> : null}
            {modal.previewUrl ? <img className="modal-media-preview" src={modal.previewUrl} alt={modal.title} /> : null}
            {modal.kind === "document" ? <pre className={modal.error ? "document-content error" : "document-content"}>{modal.body}</pre> : <p>{modal.body}</p>}
            {modal.rename ? (
              <label className="modal-rename">
                <span>Rename inventory title</span>
                <input
                  value={modal.rename.value}
                  onChange={(event) => setModal((current) => ({ ...current, rename: { ...current.rename, value: event.target.value } }))}
                  aria-label="Rename inventory title"
                />
              </label>
            ) : null}
            <div className="modal-actions">
              {modal.sourceItem && !modal.loading ? (
                <button type="button" className="primary-action" onClick={() => { const item = modal.sourceItem; setModal(null); loadSource(item); }}>Use In Creator</button>
              ) : null}
              {modal.mediaItem ? (
                <button type="button" className="primary-action" onClick={() => openMediaItem(modal.mediaItem)}>Open Item</button>
              ) : null}
              {modal.rename ? (
                <button type="button" className="primary-action" onClick={saveModalRename}>Save Rename</button>
              ) : null}
              {modal.action ? (
                <button type="button" className="primary-action" onClick={modal.action.onClick}>{modal.action.label}</button>
              ) : null}
              <button type="button" className={modal.sourceItem ? "ghost-action" : "primary-action"} onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
