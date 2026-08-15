import React from "react";
import {
  Archive,
  BookOpen,
  Camera,
  Database,
  Download,
  Heart,
  Images,
  Layers,
  Library,
  MessageCircle,
  Play,
  Repeat2,
  Route,
  Save,
  Send,
  Share2,
  Target,
  TerminalSquare,
  Workflow,
  Zap
} from "lucide-react";
import { abilityBlueprints, tabs } from "../../app-config.jsx";
import { Pill, Panel, PanelTitle, jsonBlock, metricValue } from "./UIPrimitives.jsx";

export function abilitySignals({ active, state, source, output, cluster, system, llmStatus, filteredSources }) {
  const hasOutput = output ? "ready" : "none";
  const sourceChars = source?.length || 0;
  const signals = {
    console: [
      ["Source", `${sourceChars.toLocaleString()} chars`],
      ["Output", hasOutput],
      ["Project", state?.projects?.find((project) => project.id === state.activeProjectId)?.name || `${state?.projects?.length || 0} projects`]
    ],
    agent: [
      ["Agents", `${state?.agentPipeline?.length || 0} live`],
      ["LLM", llmStatus?.live ? llmStatus.model || "live" : "local fallback"],
      ["Chats", `${state?.recentGenerations?.filter((item) => item.kind === "agent-chat").length || 0} saved`]
    ],
    cluster: [
      ["Pillars", cluster?.pillars?.length || 0],
      ["Lanes", cluster?.outputMatrix?.length || 0],
      ["Proof", cluster?.sourceInbox?.proofStatus || "pending"]
    ],
    vault: [
      ["Sources", state?.runtime?.sources || 0],
      ["Media", state?.mediaSummary?.total || 0],
      ["Shown", filteredSources?.length || 0]
    ],
    library: [
      ["Saved", state?.runtime?.sources || 0],
      ["Generated", state?.runtime?.generations || 0],
      ["Exports", state?.runtime?.exports || 0]
    ],
    instructions: [
      ["Guide", "manual workflow"],
      ["Input", "operator goal"],
      ["Route", "standalone"]
    ],
    automations: [
      ["Automations", state?.automations?.length || 0],
      ["Review", state?.reviewQueue?.length || 0],
      ["Runs", state?.automationRuns?.length || 0]
    ],
    tasks: [
      ["CPU", metricValue(system?.cpu?.percent)],
      ["RAM", metricValue(system?.memory?.percent)],
      ["Runtime", system?.runtime ? `:${system.runtime.port}` : ":8786"]
    ],
    snapshot: [
      ["Snapshots", state?.runtime?.snapshots || 0],
      ["Exports", state?.runtime?.exports || 0],
      ["History", state?.recentHistory?.length || 0]
    ]
  };
  const routeSignals = signals[active];
  if (!routeSignals) throw new Error(`Missing ability signals for route: ${active}`);
  return routeSignals;
}

export function AbilityCommandHeader({ active, state, source, output, cluster, system, llmStatus, filteredSources, latestChat, operationError }) {
  const ability = abilityBlueprints[active];
  if (!ability) throw new Error(`Missing ability blueprint for route: ${active}`);
  const Icon = ability.icon;
  const signals = abilitySignals({ active, state, source, output, cluster, system, llmStatus, filteredSources });
  const readyByAbility = {
    console: Boolean(output),
    agent: Boolean(latestChat?.answer || output),
    cluster: Boolean(cluster),
    vault: Boolean(filteredSources?.length),
    library: Boolean(state?.recentSources?.length || state?.recentGenerations?.length || state?.recentExports?.length),
    instructions: false,
    automations: Boolean(state?.automations?.length || state?.reviewQueue?.length || state?.automationRuns?.length),
    tasks: Boolean(system),
    snapshot: Boolean(state?.runtime?.snapshots)
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

export function AbilityActionRail({
  active,
  busy,
  hasSource,
  source,
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
  const isSourceReady = hasSource !== undefined ? Boolean(hasSource) : Boolean(source?.trim?.());
  const actionSets = {
    console: [
      ["Save Source", Save, onSaveSource, false],
      ["Generate Frame", Zap, onGenerateFrame, false],
      ["Build Cluster", Layers, onBuildCluster, false]
    ],
    agent: [
      ["Run Tier Zero Agents", Play, onRunAgent, !isSourceReady],
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

export function ActiveTaskSpine({ task, draft, setDraft, onSave }) {
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

export function NextStepPanel({
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
      title: state?.runtime?.sources ? "Load a source into Console" : "Run intake",
      detail: state?.runtime?.sources
        ? "Pick the best source from the Vault, then frame it in Console."
        : "Scan your configured local source folders so the engine has material to work with.",
      button: state?.runtime?.sources ? "Open Console" : "Run Intake",
      action: state?.runtime?.sources ? () => onGo("console") : onRunIntake,
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

export function ExportPreviewPanel({ preview }) {
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

export function PlatformMedia({ platform }) {
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

export function PlatformPreview({ platform }) {
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
