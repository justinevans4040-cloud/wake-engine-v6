import React from "react";
import {
  Archive,
  Clapperboard,
  FileText,
  Images,
  Megaphone,
  MessageSquare,
  Route,
  Shield,
  Target,
  TextQuote,
  WandSparkles,
  Workflow
} from "lucide-react";
import { Pill, StudioCard, jsonBlock } from "./UIPrimitives.jsx";

export function OutputStudio({ output }) {
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
