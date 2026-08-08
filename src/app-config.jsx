import {
  Bot,
  Camera,
  Download,
  Layers,
  Library,
  ListChecks,
  TerminalSquare,
  Vault,
  BookOpen,
  Workflow
} from "lucide-react";

export const emblemSrc = "/assets/forgefront-systems-emblem.png";

export const primaryTabs = [
  { id: "project", label: "Project", icon: TerminalSquare },
  { id: "sources", label: "Sources", icon: Vault },
  { id: "create", label: "Create", icon: Workflow },
  { id: "review", label: "Review", icon: ListChecks },
  { id: "export", label: "Export", icon: Download }
];

export const secondaryTabs = [
  { id: "library", label: "Library", icon: Library },
  { id: "system", label: "System", icon: Camera }
];

export const legacyTabs = [
  { id: "console", label: "Create", icon: TerminalSquare },
  { id: "agent", label: "Context Agents", icon: Bot },
  { id: "cluster", label: "Content Cluster", icon: Layers },
  { id: "vault", label: "Sources", icon: Vault },
  { id: "instructions", label: "Instructions", icon: BookOpen },
  { id: "automations", label: "Automations", icon: Workflow },
  { id: "tasks", label: "Monitor", icon: ListChecks },
  { id: "snapshot", label: "Audit", icon: Camera }
];

export const tabs = [...primaryTabs, ...secondaryTabs, ...legacyTabs];

export const abilityBlueprints = {
  project: {
    icon: TerminalSquare,
    eyebrow: "Workspace",
    title: "Project Workspace",
    mission: "Keep the current project visible, resumable, and pointed at the next production step.",
    input: "persisted project state",
    output: "active workspace",
    primaryAction: "Continue Work",
    outputDestination: "Project Overview",
    continueRoute: "Sources, Create, Review, or Export",
    doneWhen: ["project is selected", "counts are visible", "next action is obvious"]
  },
  sources: {
    icon: Vault,
    eyebrow: "Workflow 02",
    title: "Sources",
    mission: "Import, review, browse, search, open, and load local project source material.",
    input: "local folders + saved sources",
    output: "selected project source",
    primaryAction: "Review Intake",
    outputDestination: "Searchable Source Inventory",
    continueRoute: "Create",
    doneWhen: ["source is imported", "source is searchable", "source can load into Create"]
  },
  create: {
    icon: Workflow,
    eyebrow: "Workflow 03",
    title: "Create",
    mission: "Turn selected source material and campaign direction into generated packets, agent work, images, and clusters.",
    input: "source material + direction",
    output: "generated packet",
    primaryAction: "Create Output",
    outputDestination: "Current Generated Packet",
    continueRoute: "Review",
    doneWhen: ["source is present", "packet is generated", "review has something inspectable"]
  },
  review: {
    icon: ListChecks,
    eyebrow: "Workflow 04",
    title: "Review",
    mission: "Inspect generated packets, QA status, claim/evidence information, clusters, and pending scheduler review items.",
    input: "generated packet + queue",
    output: "inspection-ready packet",
    primaryAction: "Inspect Packet",
    outputDestination: "Review Workspace",
    continueRoute: "Export",
    doneWhen: ["packet is visible", "QA status is visible", "queue items can be inspected"]
  },
  export: {
    icon: Download,
    eyebrow: "Workflow 05",
    title: "Export",
    mission: "Expose Markdown and JSON export behavior, previews, saved exports, and export inspection.",
    input: "reviewed current packet",
    output: "Markdown + JSON files",
    primaryAction: "Export Packet",
    outputDestination: "Export Bundle",
    continueRoute: "Library",
    doneWhen: ["preview is inspectable", "files are written", "saved exports are visible"]
  },
  system: {
    icon: Camera,
    eyebrow: "Secondary",
    title: "System",
    mission: "Keep scheduler, monitor, audit, instructions, voice, and data protection subordinate to the production workflow.",
    input: "runtime state",
    output: "system controls",
    primaryAction: "Inspect Runtime",
    outputDestination: "System Workspace",
    continueRoute: "Project",
    doneWhen: ["runtime is visible", "automation status is visible", "audit/data tools are reachable"]
  },
  console: {
    icon: TerminalSquare,
    eyebrow: "Ability 01",
    title: "Source Command Console",
    mission: "Turn a messy ask, task, brief, transcript, note, or code request into a structured source frame.",
    input: "raw source or task",
    output: "structured frame",
    primaryAction: "Generate Frame",
    outputDestination: "Structured Output Studio",
    continueRoute: "Agents or Cluster",
    doneWhen: ["source is saved", "frame is generated", "next ability is obvious"]
  },
  agent: {
    icon: Bot,
    eyebrow: "Ability 02",
    title: "Agent Interface",
    mission: "Interrogate the current source with specialized content agents and retrieve relevant local context.",
    input: "framed source + question",
    output: "agent answer with retrieval trail",
    primaryAction: "Run Tier Zero Agents",
    outputDestination: "Latest Answer and Production Packet",
    continueRoute: "Export or Cluster",
    doneWhen: ["answer is source-backed", "context is cited", "output can be exported or clustered"]
  },
  cluster: {
    icon: Layers,
    eyebrow: "Ability 03",
    title: "Content Cluster",
    mission: "Organize the current source into content pillars, output lanes, proof notes, and handoff drafts.",
    input: "current source",
    output: "cluster packet",
    primaryAction: "Build Cluster",
    outputDestination: "Content Cluster Studio",
    continueRoute: "Export or Library",
    doneWhen: ["pillars exist", "handoff lanes are clear", "packet is ready to export"]
  },
  vault: {
    icon: Vault,
    eyebrow: "Ability 04",
    title: "Source Vault",
    mission: "Search, filter, and load the local source library without losing provenance.",
    input: "local folders + saved sources",
    output: "selected source loaded into Console",
    primaryAction: "Run Intake",
    outputDestination: "Searchable Source Inventory",
    continueRoute: "Console",
    doneWhen: ["right source is found", "source is loaded", "operator knows the lane"]
  },
  library: {
    icon: Library,
    eyebrow: "Ability 05",
    title: "Memory Library",
    mission: "Recover saved sources, generations, exports, and history so no useful work disappears.",
    input: "local store",
    output: "resumed or shipped work",
    primaryAction: "Open Exports",
    outputDestination: "Saved Sources, Outputs, Exports, and History",
    continueRoute: "Console or Audit",
    doneWhen: ["saved work is findable", "export paths are visible", "history is inspectable"]
  },
  instructions: {
    icon: BookOpen,
    eyebrow: "Guide",
    title: "Operations Guide",
    mission: "Explain how to complete an operation using only capabilities that exist in the current WAKE runtime.",
    input: "operator goal",
    output: "step-by-step WAKE workflow",
    primaryAction: "Get Instructions",
    outputDestination: "Operations Guide Result",
    continueRoute: "Requested WAKE surface",
    doneWhen: ["goal is understood", "steps match live capabilities", "next surface is clear"]
  },
  automations: {
    icon: Workflow,
    eyebrow: "Scheduler",
    title: "Scheduler & Automations",
    mission: "Configure, run, pause, review, and inspect local scheduled workflows without changing the current source workspace.",
    input: "schedule + source folder + operator ask",
    output: "scheduled run or review item",
    primaryAction: "New Automation",
    outputDestination: "Automation Schedule and Run History",
    continueRoute: "Review Queue or Run History",
    doneWhen: ["schedule is explicit", "approval mode is explicit", "run state is visible"]
  },
  tasks: {
    icon: ListChecks,
    eyebrow: "Ability 06",
    title: "Runtime Monitor",
    mission: "Expose machine health, task state, and capability truth so the operator can trust the surface.",
    input: "local runtime telemetry",
    output: "operational confidence",
    primaryAction: "Inspect Runtime",
    outputDestination: "Telemetry and Capability Truth Map",
    continueRoute: "Console",
    doneWhen: ["runtime is healthy", "capabilities are truth-labeled", "next work can continue"]
  },
  snapshot: {
    icon: Camera,
    eyebrow: "Ability 07",
    title: "Audit Trail",
    mission: "Capture receipts after meaningful work so WAKE remains local, inspectable, and accountable.",
    input: "current local state",
    output: "snapshot receipt",
    primaryAction: "Save Snapshot",
    outputDestination: "Local Snapshot Ledger",
    continueRoute: "Library",
    doneWhen: ["snapshot is saved", "exports are preserved", "state can be inspected later"]
  }
};

export const abilityAgentDefaults = {
  project: "strategist",
  sources: "archivist",
  create: "strategist",
  review: "qa",
  export: "export",
  system: "qa",
  console: "strategist",
  agent: "strategist",
  cluster: "creative-director",
  vault: "archivist",
  library: "export",
  instructions: "qa",
  automations: "qa",
  tasks: "qa",
  snapshot: "qa"
};

export const polishPrompts = {
  project: [
    "Tell me the next best move for this project.",
    "Find what is missing before this project can ship.",
    "Summarize the current project state for continuation."
  ],
  sources: [
    "Help me choose the best source for this campaign.",
    "Tell me what source evidence is missing.",
    "Suggest a cleaner source intake mission."
  ],
  create: [
    "Strengthen this generated packet from the source.",
    "Turn this direction into a sharper campaign.",
    "Find the strongest creation lane and explain why."
  ],
  review: [
    "Inspect this packet for unsupported claims.",
    "Surface the QA blockers first.",
    "Summarize claim and evidence coverage for review."
  ],
  export: [
    "Check whether this packet is ready to export.",
    "Summarize the export contents.",
    "Turn this packet into a clean handoff note."
  ],
  system: [
    "Inspect the runtime state and call out risks.",
    "Explain what the scheduler will do.",
    "Write a short audit note for the current state."
  ],
  console: [
    "Polish this ask into a sharper operator brief.",
    "Find the missing assumptions before I generate.",
    "Rewrite this source so the next agent has cleaner context."
  ],
  agent: [
    "Challenge this answer and improve the weak parts.",
    "Make this more specific, useful, and source-backed.",
    "Turn this into an edit pass with clear changes."
  ],
  cluster: [
    "Tighten these pillars and remove overlap.",
    "Find the strongest content lane and explain why.",
    "Turn this cluster into a cleaner handoff packet."
  ],
  vault: [
    "Help me find the best source for this task.",
    "Suggest better search terms and lanes.",
    "Tell me what source evidence I still need."
  ],
  library: [
    "Help me resume the most useful saved work.",
    "Find what should be exported or continued.",
    "Turn this saved output into the next action."
  ],
  instructions: [
    "Give me the shortest valid WAKE workflow for this goal.",
    "Tell me which current WAKE surface performs each step.",
    "Call out any requested capability WAKE does not currently implement."
  ],
  automations: [
    "Check this automation setup for missing inputs.",
    "Explain what this schedule will do before it runs.",
    "Tell me whether this should require review or auto export."
  ],
  tasks: [
    "Inspect the current state and tell me what is risky.",
    "What should I fix before market use?",
    "Give me a QA pass on the current ability."
  ],
  snapshot: [
    "Summarize what should be captured in this snapshot.",
    "What evidence is missing before I call this complete?",
    "Write a clean audit note for this state."
  ]
};

export const bootLines = [
  "WAKE BIOS 6.0 :: cold start handshake",
  "isolating local runtime :8786",
  "mounting memory ledger",
  "indexing ability pages",
  "arming content agents",
  "calibrating speech interface",
  "verifying source vault boundary",
  "operator surface online"
];

export const voicePresets = {
  villain: {
    label: "Villain Clean",
    text: "System online. Wake Engine is awake.",
    rate: 0.82,
    pitch: 0.68,
    volume: 0.95,
    preferredVoice: /natural|online|guy|david|mark|ryan|george|jenny|aria/i
  },
  sentinel: {
    label: "Sentinel",
    text: "System online. Command interface ready.",
    rate: 0.9,
    pitch: 0.84,
    volume: 0.92,
    preferredVoice: /natural|online|guy|david|mark|ryan|george|jenny|aria|zira/i
  },
  calm: {
    label: "Calm Human",
    text: "System online. Wake Engine is ready.",
    rate: 0.94,
    pitch: 0.98,
    volume: 0.9,
    preferredVoice: /natural|online|jenny|aria|zira|susan|libby|sonia/i
  },
  muted: {
    label: "Muted",
    text: "",
    rate: 1,
    pitch: 1,
    volume: 0
  }
};

export const statusTone = {
  live: "live",
  running: "live",
  active: "live",
  done: "done",
  partial: "partial",
  queued: "queued",
  "ready-local": "live"
};

export const starterSource = "";
