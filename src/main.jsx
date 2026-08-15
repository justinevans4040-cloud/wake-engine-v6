import "./styles.css";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Archive,
  Camera,
  CircleAlert,
  CircleCheck,
  Clipboard,
  Cpu,
  Database,
  Download,
  Filter,
  Gauge,
  HardDrive,
  Heart,
  Hexagon,
  Images,
  Info,
  Layers,
  ListChecks,
  MemoryStick,
  MessageSquare,
  Play,
  Radio,
  Repeat2,
  RotateCcw,
  Save,
  Send,
  Share2,
  Sparkles,
  TerminalSquare,
  Vault,
  Volume2,
  VolumeX,
  WandSparkles,
  Zap
} from "lucide-react";
import { api, apiStream } from "./api.js";
import {
  BOOT_SEQUENCE_MS,
  abilityAgentDefaults,
  abilityBlueprints,
  bootLines,
  emblemSrc,
  polishPrompts,
  standaloneRoutes,
  statusTone,
  tabs,
  voicePresets
} from "./app-config.jsx";
import {
  Pill,
  Panel,
  PanelTitle,
  OperatorGate,
  jsonBlock,
  outputTitle,
  sourceDocumentBody,
  chatProviderLabel,
  metricValue,
  buildExportPreview
} from "./components/common/UIPrimitives.jsx";
import {
  AbilityCommandHeader,
  AbilityActionRail,
  ActiveTaskSpine,
  NextStepPanel,
  ExportPreviewPanel
} from "./components/common/AbilityScaffold.jsx";
import { Header } from "./components/Header.jsx";
import { SectionChat } from "./components/chat/SectionChat.jsx";
import { ConsoleTab } from "./components/tabs/ConsoleTab.jsx";
import { AgentsTab } from "./components/tabs/AgentsTab.jsx";
import { ClusterTab } from "./components/tabs/ClusterTab.jsx";
import { VaultTab } from "./components/tabs/VaultTab.jsx";
import { LibraryTab } from "./components/tabs/LibraryTab.jsx";
import { InstructionsTab } from "./components/tabs/InstructionsTab.jsx";
import { AutomationsTab } from "./components/tabs/AutomationsTab.jsx";
import { MonitorTab } from "./components/tabs/MonitorTab.jsx";
import { AuditTab } from "./components/tabs/AuditTab.jsx";

export function App() {
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
  const [voiceMuted, setVoiceMuted] = useState(
    () => localStorage.getItem("wake.voiceMuted") === "true" || localStorage.getItem("wake.voicePreset") === "muted"
  );
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

      const tones =
        kind === "online"
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
        oscillator.frequency.exponentialRampToValueAtTime(
          tone.frequency * (kind === "online" ? 1.22 : 0.72),
          started + tone.end
        );
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
    if (!fresh.projects?.some((project) => project.id === projectId) && fresh.projects?.[0]?.id) {
      setProjectId(fresh.projects[0].id);
    }
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
    const saved = (state?.agentChats || []).find(
      (item) => item.ability === active && (!item.projectId || item.projectId === projectId)
    );
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
    setIntakeIntent(
      [
        project?.name,
        state.activeTask?.objective,
        "Import only project-relevant content, documents, platform assets, scripts, thumbnails, source notes, and media. Exclude random screenshots or unrelated files."
      ]
        .filter(Boolean)
        .join(" — ")
    );
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
    return tasks.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        acc.all += 1;
        return acc;
      },
      { all: 0 }
    );
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
  const projectGenerations = useMemo(
    () => (state?.recentGenerations || []).filter((item) => item.projectId === projectId),
    [state, projectId]
  );
  const projectExports = useMemo(
    () => (state?.recentExports || []).filter((item) => item.projectId === projectId),
    [state, projectId]
  );
  const projectHistory = useMemo(
    () => (state?.recentHistory || []).filter((item) => item.payload?.projectId === projectId),
    [state, projectId]
  );

  const filteredSources = useMemo(() => {
    const query = sourceQuery.trim().toLowerCase();
    return projectSources.filter((item) => {
      const matchesLane = laneFilter === "all" || item.lane === laneFilter;
      const text = `${item.title} ${item.lane || ""} ${item.sourceType || ""} ${(item.tags || []).join(" ")} ${
        item.localPath || ""
      } ${item.driveUrl || ""} ${item.excerpt || ""}`.toLowerCase();
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
      setOperationError({
        ability: "agent",
        action: "agent",
        message: "Choose a saved source or paste source before running agents."
      });
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
      const data = await api(
        "/autopilot",
        {
          projectId,
          direction: campaignDirection,
          source: source.trim() || undefined
        },
        { timeoutMs: 240000 }
      );
      setCampaign(data.campaign);
      setCluster(data.campaign.cluster);
      setOutput(data.campaign);
      setGenerationId(data.campaign.generation?.id || null);
      setSelectedPlatform("tiktok");
      setExportPreview(null);
      setNotice(
        data.campaign.generatedImages?.length
          ? "Campaign and original images are ready."
          : "Campaign is ready. Connect the image engine once to create original images."
      );
    });
  }

  async function generateCampaignImage() {
    if (!campaign) return;
    setImageBusy(true);
    setNotice("");
    try {
      const data = await api(
        "/images/generate",
        {
          campaignId: campaign.id,
          platform: selectedPlatform,
          prompt: campaign.platforms?.[selectedPlatform]?.imagePrompt
        },
        { timeoutMs: 240000 }
      );
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
    const approved = window.confirm(
      "Enable original image generation? Wake will send only the creative image prompt to the configured external image service, then save the returned image locally."
    );
    if (!approved) return;
    setImageBusy(true);
    setNotice("");
    try {
      const data = await api("/image-generation/settings", { externalImagesEnabled: true });
      await refresh();
      setNotice(
        data.imageGeneration?.configured
          ? "Original image generation enabled."
          : "Image provider still needs configuration."
      );
      if (campaign && data.imageGeneration?.configured) {
        const generated = await api(
          "/images/generate",
          {
            campaignId: campaign.id,
            platform: selectedPlatform,
            prompt: campaign.platforms?.[selectedPlatform]?.imagePrompt
          },
          { timeoutMs: 240000 }
        );
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
    });
  }

  async function exportLatestChat() {
    await runAction("chat-export", async () => {
      if (!latestChat?.answer) throw new Error("Generate an agent answer before export.");
      const chatOutput = {
        ...latestChat,
        title: `${latestChat.agentLabel || "Content Agent"} Answer`,
        nextAction:
          latestChat.nextAction || "Continue this answer in the current ability or promote it into production output."
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
    setChatMessage((current) => (current.trim() ? `${current.trim()}\n\n${prompt}` : prompt));
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
        setChatMessage((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript));
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
    ]
      .filter(Boolean)
      .join("\n\n");
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
      if (active === "agent" && !source.trim()) {
        throw new Error("Choose a saved source or paste source before chatting with this agent.");
      }
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
      await apiStream(
        "/agent-chat/stream",
        {
          projectId,
          sourceId,
          agentId: selectedAgent,
          ability: active,
          mode: chatMode,
          message: contextualAgentMessage()
        },
        (event) => {
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
        },
        { timeoutMs: 32000 }
      );
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
      const roots =
        Array.isArray(rootsOverride) && rootsOverride.length
          ? rootsOverride
          : intakeRootsText.split(/\r?\n/).map((root) => root.trim()).filter(Boolean);
      if (!roots.length) throw new Error("Choose a local folder, drive, or flash drive before importing.");
      setIntakeRootsText(roots.join("\n"));
      const data = await api("/intake/run", { roots, projectId, intent: intakeIntent }, { timeoutMs: 600000 });
      await refresh();
      setNotice(
        `Scanned ${label}: ${data.run.scanned} files. Added ${data.run.sourceAdded} sources and ${data.run.mediaAdded} media assets.`
      );
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
      const roots =
        Array.isArray(rootsOverride) && rootsOverride.length
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

  const latestIntakeReview =
    (state?.intakeReviews || []).find((review) => review.projectId === projectId) || null;

  function toggleReviewCandidate(candidateId) {
    setIntakeReviewSelection((current) =>
      current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId]
    );
  }

  function selectReviewCandidates(mode) {
    if (!latestIntakeReview || mode === "none") {
      setIntakeReviewSelection([]);
      return;
    }
    const ids = latestIntakeReview.candidates
      .filter(
        (candidate) => candidate.decisionStatus === "recommended" && candidate.eligible && !candidate.alreadyImported
      )
      .slice(0, 80)
      .map((candidate) => candidate.reviewId);
    setIntakeReviewSelection(ids);
  }

  async function applyIntakeReview() {
    if (!latestIntakeReview || !intakeReviewSelection.length) return;
    setIntakeBusy(true);
    setNotice("");
    try {
      const data = await api(
        `/intake/reviews/${encodeURIComponent(latestIntakeReview.id)}/apply`,
        { candidateIds: intakeReviewSelection },
        { timeoutMs: 600000 }
      );
      await refresh();
      setIntakeReviewSelection([]);
      setNotice(
        `Imported reviewed items: ${data.result.sourceAdded} sources and ${data.result.mediaAdded} media assets.`
      );
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
    setModal({
      kind: "document",
      title: item.title.replace(/^\[[^\]]+\]\s*/, ""),
      body: "Loading document...",
      loading: true
    });
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
      ]
        .filter(Boolean)
        .join("\n"),
      mediaItem: asset,
      previewUrl: isImage
        ? `/api/media/${encodeURIComponent(asset.id)}/preview?v=${encodeURIComponent(
            asset.updatedAt || asset.importedAt || asset.modifiedAt || ""
          )}`
        : null,
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
    <SectionChat
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
                <span key={line}>
                  <b>{String(index + 1).padStart(2, "0")}</b> {line}
                </span>
              ))}
            </div>
            <div className="boot-progress" aria-label="Boot progress">
              <i style={{ width: `${progress}%` }} />
            </div>
            <p>{progress >= 100 ? "SYSTEM ONLINE" : `BOOT SEQUENCE ${progress}%`}</p>
            <div className="boot-actions">
              <button type="button" className="primary-action" onClick={finishBoot}>
                Skip Boot
              </button>
              <button
                type="button"
                aria-label={voiceMuted ? "Unmute system voice" : "Mute system voice"}
                onClick={() => setVoiceMuted((value) => !value)}
              >
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

        <Header
          active={active}
          navigateSection={navigateSection}
          state={state}
          projectId={projectId}
          switchProject={switchProject}
          setModal={setModal}
          showVoicePanel={showVoicePanel}
          setShowVoicePanel={setShowVoicePanel}
          voiceMuted={voiceMuted}
          setVoiceMuted={setVoiceMuted}
          voicePreset={voicePreset}
          setVoicePreset={setVoicePreset}
          voices={voices}
          voiceName={voiceName}
          setVoiceName={setVoiceName}
          ttsStatus={ttsStatus}
          speakSystemVoice={speakSystemVoice}
          stopSystemVoice={stopSystemVoice}
          replayBoot={replayBoot}
        />

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
                operationError={operationError}
              />

              <AbilityActionRail
                active={active}
                hasSource={Boolean(source?.trim())}
                source={source}
                output={output}
                cluster={cluster}
                state={state}
                busy={busy || intakeBusy}
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

          {active === "console" && (
            <ConsoleTab
              state={state}
              projectId={projectId}
              projectSources={projectSources}
              campaignDirection={campaignDirection}
              setCampaignDirection={setCampaignDirection}
              campaign={campaign}
              selectedPlatform={selectedPlatform}
              setSelectedPlatform={setSelectedPlatform}
              busy={busy}
              imageBusy={imageBusy}
              createCampaign={createCampaign}
              generateCampaignImage={generateCampaignImage}
              saveCampaignImageToSource={saveCampaignImageToSource}
              exportCampaign={exportCampaign}
              enableExternalImageGeneration={enableExternalImageGeneration}
              setModal={setModal}
              source={source}
              setSource={setSource}
              saveSource={saveSource}
              exportPreview={exportPreview}
              projectName={projectName}
              setProjectName={setProjectName}
              saveProject={saveProject}
              createProject={createProject}
              createManualBackup={createManualBackup}
              restoreLatestBackup={restoreLatestBackup}
              exportAllData={exportAllData}
              cleanupCache={cleanupCache}
              operationError={operationError}
            />
          )}

          {active === "agent" && (
            <AgentsTab
              source={source}
              sourceId={sourceId}
              projectSources={projectSources}
              busy={busy || intakeBusy}
              onSelectSource={selectSourceForAgent}
              onOpenConsole={() => navigateSection("console")}
              onRunAgent={runAgent}
              output={output}
              onCopyOutput={copyOutput}
              onExportOutput={exportOutput}
            />
          )}

          {active === "console" || active === "cluster" ? (
            <details className="context-agent-tools">
              <summary>Ask content agents</summary>
              {sectionAgentChat}
            </details>
          ) : standaloneRoutes.has(active) ? null : sectionAgentChat}

          {exportPreview && active !== "console" && active !== "cluster" && !standaloneRoutes.has(active) && (
            <ExportPreviewPanel preview={exportPreview} />
          )}

          {active === "cluster" && (
            <ClusterTab
              cluster={cluster}
              busy={busy}
              exportCluster={exportCluster}
              buildCluster={buildCluster}
              exportPreview={exportPreview}
              operationError={operationError}
              source={source}
            />
          )}

          {active === "vault" && (
            <VaultTab
              state={state}
              projectId={projectId}
              intakeRootsText={intakeRootsText}
              setIntakeRootsText={setIntakeRootsText}
              intakeBusy={intakeBusy}
              intakeIntent={intakeIntent}
              setIntakeIntent={setIntakeIntent}
              driveTargets={driveTargets}
              refreshIntakeTargets={refreshIntakeTargets}
              runIntakeAgent={runIntakeAgent}
              reviewIntakeAgent={reviewIntakeAgent}
              latestIntakeReview={latestIntakeReview}
              intakeReviewSelection={intakeReviewSelection}
              toggleReviewCandidate={toggleReviewCandidate}
              selectReviewCandidates={selectReviewCandidates}
              applyIntakeReview={applyIntakeReview}
              openMediaAsset={openMediaAsset}
              setModal={setModal}
              projectSources={projectSources}
              sourceQuery={sourceQuery}
              setSourceQuery={setSourceQuery}
              laneFilter={laneFilter}
              setLaneFilter={setLaneFilter}
              filteredSources={filteredSources}
              openSourceDocument={openSourceDocument}
            />
          )}

          {active === "library" && (
            <LibraryTab
              projectSources={projectSources}
              openSourceDocument={openSourceDocument}
              projectGenerations={projectGenerations}
              loadGeneration={loadGeneration}
              projectExports={projectExports}
              setModal={setModal}
              projectHistory={projectHistory}
            />
          )}

          {active === "instructions" && (
            <InstructionsTab
              instructionsQuery={instructionsQuery}
              setInstructionsQuery={setInstructionsQuery}
              instructionsBusy={instructionsBusy}
              fetchInstructions={fetchInstructions}
              instructionsResult={instructionsResult}
            />
          )}

          {active === "automations" && (
            <AutomationsTab
              state={state}
              projectId={projectId}
              onRefresh={refresh}
              setModal={setModal}
              setOperationError={setOperationError}
            />
          )}

          {active === "tasks" && (
            <MonitorTab
              system={system}
              systemHistory={systemHistory}
              openMonitorCard={openMonitorCard}
              setModal={setModal}
              openFolder={openFolder}
              taskSearch={taskSearch}
              setTaskSearch={setTaskSearch}
              taskFilter={taskFilter}
              setTaskFilter={setTaskFilter}
              taskCounts={taskCounts}
              filteredTasks={filteredTasks}
              openTaskCard={openTaskCard}
              state={state}
              openCapabilityCard={openCapabilityCard}
            />
          )}

          {active === "snapshot" && <AuditTab state={state} busy={busy} saveSnapshot={saveSnapshot} />}
        </section>

        <footer className="status-rail">
          <span>
            <Cpu size={18} /> CPU {metricValue(system?.cpu?.percent)}
          </span>
          <span>
            <MemoryStick size={18} /> RAM {metricValue(system?.memory?.percent)}
          </span>
          <span>
            <Gauge size={18} /> GPU {metricValue(system?.gpu?.utilization)}
          </span>
          <span>
            <Database size={18} /> Sources {state?.runtime?.sources || 0}
          </span>
        </footer>

        <div className="dock">
          <button type="button" className="terminal-button" onClick={() => setActive("console")}>
            <TerminalSquare size={28} />
          </button>
          <button
            type="button"
            className="run-button"
            aria-label="Run Agent"
            disabled={busy || !source.trim()}
            onClick={runAgent}
          >
            <Play size={24} /> Run Agent <small>{source.trim() ? "Save output" : "Source required"}</small>
          </button>
          <button
            type="button"
            className="snapshot-button"
            aria-label="Export Output"
            disabled={busy || !output}
            onClick={exportOutput}
          >
            <Download size={24} /> Export <small>MD + JSON</small>
          </button>
        </div>
      </main>

      {notice && <div className="toast">{notice}</div>}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div
            className={`modal ${modal.kind === "document" ? "document-modal" : ""} ${
              modal.kind === "media" ? "media-modal" : ""
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{modal.title}</h2>
            {modal.meta ? <small className="document-meta">{modal.meta}</small> : null}
            {modal.previewUrl ? <img className="modal-media-preview" src={modal.previewUrl} alt={modal.title} /> : null}
            {modal.kind === "document" ? (
              <pre className={modal.error ? "document-content error" : "document-content"}>{modal.body}</pre>
            ) : (
              <p>{modal.body}</p>
            )}
            {modal.rename ? (
              <label className="modal-rename">
                <span>Rename inventory title</span>
                <input
                  value={modal.rename.value}
                  onChange={(event) =>
                    setModal((current) => ({
                      ...current,
                      rename: { ...current.rename, value: event.target.value }
                    }))
                  }
                  aria-label="Rename inventory title"
                />
              </label>
            ) : null}
            <div className="modal-actions">
              {modal.sourceItem && !modal.loading ? (
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => {
                    const item = modal.sourceItem;
                    setModal(null);
                    loadSource(item);
                  }}
                >
                  Use In Creator
                </button>
              ) : null}
              {modal.mediaItem ? (
                <button type="button" className="primary-action" onClick={() => openMediaItem(modal.mediaItem)}>
                  Open Item
                </button>
              ) : null}
              {modal.rename ? (
                <button type="button" className="primary-action" onClick={saveModalRename}>
                  Save Rename
                </button>
              ) : null}
              {modal.action ? (
                <button type="button" className="primary-action" onClick={modal.action.onClick}>
                  {modal.action.label}
                </button>
              ) : null}
              <button
                type="button"
                className={modal.sourceItem ? "ghost-action" : "primary-action"}
                onClick={() => setModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
