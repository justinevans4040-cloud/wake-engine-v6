import { create } from "zustand";

export const useWakeStore = create((set, get) => ({
  // Navigation & Session
  activeTab: "console",
  setActiveTab: (tab) => set({ activeTab: tab }),
  booted: false,
  setBooted: (booted) => set({ booted }),
  session: { authenticated: true, operator: "JUSTIN" },
  setSession: (session) => set({ session }),

  // Server & App State
  serverState: null,
  setServerState: (serverState) => set({ serverState }),
  activeProjectId: "wake-v6-main",
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),

  // Working Documents
  source: "",
  setSource: (source) => set({ source }),
  frame: null,
  setFrame: (frame) => set({ frame }),
  output: null,
  setOutput: (output) => set({ output }),
  cluster: null,
  setCluster: (cluster) => set({ cluster }),
  campaign: null,
  setCampaign: (campaign) => set({ campaign }),

  // Telemetry & Hardware
  systemMetrics: null,
  setSystemMetrics: (systemMetrics) => set({ systemMetrics }),
  llmStatus: { live: false, url: null, models: [], model: null },
  setLlmStatus: (llmStatus) => set({ llmStatus }),
  voicePreset: "sentinel",
  setVoicePreset: (voicePreset) => set({ voicePreset }),

  // Active Task & Editing
  taskDraft: { title: "", objective: "", nextAction: "" },
  setTaskDraft: (taskDraft) => set({ taskDraft }),

  // Chat & Stream
  agentId: "strategist",
  setAgentId: (agentId) => set({ agentId }),
  chatMode: "auto",
  setChatMode: (chatMode) => set({ chatMode }),
  chatInput: "",
  setChatInput: (chatInput) => set({ chatInput }),
  chatStreaming: false,
  setChatStreaming: (chatStreaming) => set({ chatStreaming }),
  chatStreamAnswer: "",
  setChatStreamAnswer: (chatStreamAnswer) => set({ chatStreamAnswer }),
  chatStreamMeta: null,
  setChatStreamMeta: (chatStreamMeta) => set({ chatStreamMeta }),
  latestChat: null,
  setLatestChat: (latestChat) => set({ latestChat }),

  // Modals & Banners
  modal: null,
  setModal: (modal) => set({ modal }),
  operationNotice: null,
  setOperationNotice: (operationNotice) => set({ operationNotice }),
  operationError: null,
  setOperationError: (operationError) => set({ operationError }),

  // Filters & Search
  sourceQuery: "",
  setSourceQuery: (sourceQuery) => set({ sourceQuery }),
  laneFilter: "all",
  setLaneFilter: (laneFilter) => set({ laneFilter }),
  libraryQuery: "",
  setLibraryQuery: (libraryQuery) => set({ libraryQuery }),
  libraryFilter: "all",
  setLibraryFilter: (libraryFilter) => set({ libraryFilter }),
  historyQuery: "",
  setHistoryQuery: (historyQuery) => set({ historyQuery }),
  historyFilter: "all",
  setHistoryFilter: (historyFilter) => set({ historyFilter })
}));
