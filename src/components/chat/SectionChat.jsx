import React from "react";
import {
  CircleAlert,
  Database,
  MessageSquare,
  Mic,
  MicOff,
  Send,
  Volume2
} from "lucide-react";
import { Pill, Panel, PanelTitle, chatProviderLabel } from "../common/UIPrimitives.jsx";
import { abilityBlueprints, polishPrompts } from "../../app-config.jsx";

export function AgentChatConsole({
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
  const visibleHistory = [...(chatHistory || []), ...(state.agentChats || [])]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .filter((item) => (!item.projectId || item.projectId === projectId) && (item.section || item.ability) === active)
    .slice(0, 8);
  const latestProvider = chatProviderLabel(latestChat, llmStatus);
  const latestTone =
    latestChat?.provider === "ollama" ? "live" : latestChat?.provider === "error" ? "partial" : "queued";
  return (
    <Panel className={`agent-chat-panel ${isAgentPage ? "" : "compact-chat"}`}>
      <PanelTitle
        icon={MessageSquare}
        title={`${ability.title} Chat`}
        right={
          <Pill tone={llmStatus?.live ? "live" : "partial"}>
            {llmStatus?.live ? llmStatus.model || "Ollama" : "Instant Local Draft"}
          </Pill>
        }
      />
      <div className="section-chat-brief">
        <div>
          <small>Working agent</small>
          <strong>{selected?.label || "Content Agent"}</strong>
          <span>
            {selected?.persona || selected?.action || "Talk through polish, edit, and next-step passes for this ability."}
          </span>
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
          <button
            key={value}
            type="button"
            className={chatMode === value ? "selected" : ""}
            onClick={() => setChatMode(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="agent-chat-grid">
        <div className={`agent-selector ${isAgentPage ? "" : "compact-selector"}`}>
          {(state.agentPipeline || []).map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={selectedAgent === agent.id ? "selected" : ""}
              onClick={() => setSelectedAgent(agent.id)}
            >
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
              <strong>
                {latestChat?.answer
                  ? `${latestChat.agentLabel || "Content Agent"} Answer`
                  : chatBusy
                  ? "Agent is working"
                  : "Agent answer appears here"}
              </strong>
              <Pill tone={latestChat ? latestTone : "queued"}>
                {latestChat ? latestProvider : chatBusy ? "connecting" : "waiting"}
              </Pill>
            </header>
            {latestChat?.answer ? (
              <>
                <p className="chat-question">{latestChat.message}</p>
                <p>{latestChat.answer}</p>
                {chatBusy && (
                  <div className="chat-upgrade-status">
                    <span className="status-dot" />
                    {latestChat.status === "upgrading"
                      ? `Streaming upgrade from ${latestProvider}`
                      : "Instant Local Draft is visible while provider detection finishes."}
                  </div>
                )}
                {latestChat.quality && (
                  <div className="quality-grid">
                    <span>
                      Support <b>{latestChat.quality.sourceSupport}</b>
                    </span>
                    <span>
                      Clarity <b>{latestChat.quality.clarity}</b>
                    </span>
                    <span>
                      Useful <b>{latestChat.quality.usefulness}</b>
                    </span>
                  </div>
                )}
                <div className="answer-meta">
                  <span>{latestChat.profile || "auto profile"}</span>
                  <span>
                    {latestChat.historyStatus === "saved"
                      ? "saved to history"
                      : chatBusy
                      ? "saving on completion"
                      : "local answer"}
                  </span>
                </div>
                <div className="answer-actions">
                  <button type="button" onClick={onApplyAnswerToSource}>
                    Apply to Source
                  </button>
                  <button type="button" onClick={onPromoteAnswer}>
                    Promote Output
                  </button>
                  <button type="button" onClick={onExport}>
                    Export Answer
                  </button>
                  <button type="button" disabled={!ttsSupported} onClick={onSpeakAnswer}>
                    <Volume2 size={15} /> {ttsStatus === "speaking" ? "Speaking" : "Read Aloud"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onPrompt(`Apply this answer as an edit pass:\n\n${latestChat.answer}`)}
                  >
                    Edit Further
                  </button>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(latestChat.answer)}>
                    Copy Answer
                  </button>
                </div>
              </>
            ) : chatBusy ? (
              <p>
                Reading this section, source, and output. Fast sections use tighter budgets; deeper sections get more
                context. The answer will appear here.
              </p>
            ) : (
              <p>
                Type or speak a polish/edit request. The selected agent’s answer will appear here first, then save into
                history.
              </p>
            )}
            {chatError && (
              <div className="chat-error" role="alert">
                <CircleAlert size={17} />
                <span>{chatError}</span>
              </div>
            )}
            {sourceRequired && !hasSource ? (
              <div className="chat-source-warning" role="alert">
                <Database size={17} />
                <span>Choose a source above before chatting with this agent. The answer will land here.</span>
              </div>
            ) : null}
          </div>
          <div className="chat-history">
            {visibleHistory.length ? (
              visibleHistory.map((item) => (
                <article key={item.id}>
                  <header>
                    <strong>{item.agentLabel}</strong>
                    <Pill tone={item.provider === "ollama" ? "live" : "partial"}>
                      {chatProviderLabel(item, llmStatus)}
                    </Pill>
                  </header>
                  <p className="chat-question">{item.message}</p>
                  <p>{item.answer}</p>
                  <div className="citation-row">
                    {(item.context?.sources || []).slice(0, 3).map((source) => (
                      <span key={source.id}>
                        {source.lane}: {source.title}
                      </span>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <div className="chat-history-empty">
                <MessageSquare size={18} />
                <span>No saved answers for this ability yet.</span>
              </div>
            )}
          </div>
          <form
            className="chat-compose"
            onSubmit={(event) => {
              event.preventDefault();
              onSend();
            }}
          >
            <textarea
              value={chatMessage}
              onChange={(event) => setChatMessage(event.target.value)}
              aria-label="Message agent"
              placeholder={`Talk to ${selected?.label || "this agent"} for polish, edits, or next-step guidance...`}
            />
            <div className="chat-command-stack">
              <button
                type="button"
                aria-label="Speak with runtime speech recognition"
                className={`voice-action ${listening ? "listening" : ""}`}
                disabled={busy || !speechSupported}
                onClick={onListen}
              >
                {speechSupported ? <Mic size={16} /> : <MicOff size={16} />}
                {listening ? "Listening" : "Speak"}
              </button>
              <button
                type="submit"
                className="primary-action"
                disabled={busy || chatBusy || !chatMessage.trim() || (sourceRequired && !hasSource)}
              >
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

export function SectionChat(props) {
  return <AgentChatConsole {...props} />;
}
