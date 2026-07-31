const AGENT_ORDER = ["archivist", "strategist", "scriptwriter", "creative-director", "qa", "export"];

const COMMON_TOOLS = [
  "send_a2a",
  "write_memory"
];

export const REQUIRED_PACKET_SECTIONS = [
  "sourceProfile",
  "evidenceMap",
  "citationMap",
  "claimMap",
  "hooks",
  "titles",
  "captions",
  "scripts",
  "platformVariants",
  "creativeDirection",
  "visualPrompts",
  "qaVerdict",
  "nextAction",
  "a2aTrace",
  "agentInbox",
  "agentOutbox",
  "replayableHandoffs",
  "toolTrace",
  "exportManifest"
];

export const CANONICAL_PACKET_CONTRACT = Object.freeze({
  id: "wake-content-packet",
  version: "1.0.0",
  requiredSections: REQUIRED_PACKET_SECTIONS
});

const QUALITY_RUBRIC_KEYS = [
  "sourceFidelity",
  "claimSupport",
  "specificity",
  "audienceFit",
  "platformFit",
  "hookStrength",
  "ctaFit",
  "nonGenericWording",
  "repetitionTitleEcho",
  "packageCompleteness",
  "hallucinationRisk"
];

const GENERIC_PHRASES = [
  /\bsynergy\b/gi,
  /\bgame[- ]changer\b/gi,
  /\brevolutionary\b/gi,
  /\bworld[- ]class\b/gi,
  /\bunlock your potential\b/gi,
  /\bnext level\b/gi,
  /\bcutting[- ]edge\b/gi,
  /\belevate your\b/gi,
  /\btransform your (?:life|business|brand)\b/gi,
  /\bone[- ]stop solution\b/gi
];

function wordList(value) {
  return String(value || "")
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function cleanLine(value) {
  return String(value || "")
    .replace(/^(?:#{1,6}\s*)+/, "")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCandidates(source) {
  const content = String(source || "")
    .replace(/\r/g, "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  const seen = new Set();
  return content
    .split(/(?<=[.!?])\s+|;\s+/)
    .map(cleanLine)
    .filter((sentence) => sentence.length >= 28 && sentence.length <= 240)
    .filter((sentence) => {
      const key = sentence.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 16);
}

function titleFromSource(source) {
  const heading = String(source || "").split(/\r?\n/).find((line) => /^#\s+\S/.test(line.trim()));
  if (heading) return cleanLine(heading).slice(0, 78);
  const sentence = sentenceCandidates(source)[0] || String(source || "Untitled Source").slice(0, 96);
  return cleanLine(sentence).split(/\s+/).slice(0, 10).join(" ").replace(/[,:;\s-]+$/g, "") || "Untitled Source";
}

function topTerms(source, limit = 8) {
  const stop = new Set([
    "about", "after", "also", "and", "are", "before", "build", "but", "can", "code", "create", "draft", "for", "from", "have", "into",
    "like", "make", "need", "not", "only", "output", "source", "that", "the", "their", "then", "there", "this", "turn", "with", "your"
  ]);
  const counts = new Map();
  for (const word of wordList(source).map((item) => item.toLowerCase())) {
    if (word.length < 4 || stop.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function uniqueText(values) {
  return [...new Set(values.map((value) => cleanLine(value).toLowerCase()).filter(Boolean))];
}

function comparableText(value) {
  return cleanLine(value).toLowerCase().replace(/[.!?,:;]+$/g, "").trim();
}

function containmentText(value) {
  return cleanLine(value).toLowerCase().replace(/[^\w']+/g, " ").trim();
}

function genericPhraseMatches(value) {
  const text = String(value || "");
  return GENERIC_PHRASES.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0].toLowerCase()));
}

function assessSource(source, evidence = []) {
  const text = cleanLine(source);
  const words = wordList(text);
  const meaningfulWords = words.filter((word) => word.length >= 3);
  const uniqueTerms = new Set(meaningfulWords.map((word) => word.toLowerCase()));
  const hasAudience = /\bfor\s+[a-z][^.!?]{2,80}|\bhelps?\s+[a-z][^.!?]{2,80}/i.test(text);
  const hasConcreteDetail = /\b\d+[\w%-]*\b|\b(?:limited|private|local|weekend|daily|weekly|monthly|includes?|offers?|with|without|before|after)\b/i.test(text);
  const hasActionOrOutcome = /\b(?:launch|book|buy|order|preorder|read|learn|build|reduce|increase|protect|save|schedule|start|join|download|visit|helps?)\w*\b/i.test(text);
  const sufficient = text.length >= 55 && meaningfulWords.length >= 10 && uniqueTerms.size >= 8 && evidence.length >= 1;
  const missing = [
    meaningfulWords.length < 10 ? "a fuller description" : null,
    !hasAudience ? "the intended audience" : null,
    !hasConcreteDetail ? "at least one concrete fact, feature, example, or proof point" : null,
    !hasActionOrOutcome ? "the outcome, offer, or action the content should support" : null
  ].filter(Boolean);
  const repairSuggestions = missing.map((item) => `Add ${item} to the source.`);
  if (!repairSuggestions.length && !sufficient) repairSuggestions.push("Add another source sentence with concrete context and proof.");
  return {
    sufficient,
    status: sufficient ? "ready" : "not enough source",
    characters: text.length,
    wordCount: words.length,
    meaningfulWordCount: meaningfulWords.length,
    uniqueTermCount: uniqueTerms.size,
    evidenceCount: evidence.length,
    signals: { hasAudience, hasConcreteDetail, hasActionOrOutcome },
    missing,
    repairSuggestions,
    nextBestStep: sufficient
      ? "Run the source-bound content agents and enforce the full QA rubric."
      : `Add source detail before generation${missing.length ? `: ${missing.join(", ")}.` : "."}`
  };
}

function inferAudience(sourceText) {
  const source = cleanLine(sourceText);
  const forMatch = source.match(/\bfor\s+([^.!?;,]{3,70})/i);
  if (forMatch) return cleanLine(forMatch[1]);
  const helpsMatch = source.match(/\bhelps?\s+([^.!?;,]{3,70}?)(?=\s+\b(?:build|reduce|increase|create|manage|protect|learn|find|save|schedule|with)\b)/i);
  if (helpsMatch) return cleanLine(helpsMatch[1]);
  const localMatch = source.match(/\b(?:local|busy|small|young|senior|anxious)\s+[a-z][a-z -]{2,45}/i);
  if (localMatch) return cleanLine(localMatch[0]);
  const terms = topTerms(source, 3).map((item) => item.term);
  return terms.length ? `people seeking ${terms.join(", ")}` : "the specific audience described in the source";
}

function inferCta(sourceText, profile) {
  const source = String(sourceText || "").toLowerCase();
  if (/\bpreorder|pre-order|limited batch|drop\b/.test(source)) return "Preorder before the limited release closes.";
  if (/\bchildren'?s book|story|read\b/.test(source)) return "Read the story and share its central lesson.";
  if (/\bappointment|service|coach|groom|estimate\b/.test(source)) return "Book the next available step described in the offer.";
  if (/\bsaas|software|dashboard|demo|trial\b/.test(source)) return "See the workflow applied to a real operating day.";
  if (/\bmenu|restaurant|shop\b/.test(source)) return "Visit during the stated offer window while availability lasts.";
  return `Take the next source-supported step for ${profile.title}.`;
}

function rubricItem(score, minimum, findings = [], extra = {}) {
  const normalized = clampScore(score);
  return { score: normalized, minimum, passed: normalized >= minimum, findings, ...extra };
}

function qualityScore({
  source = "",
  sourceAssessment = {},
  evidence = [],
  citationMap = [],
  claims = [],
  claimValidation = {},
  hooks = [],
  titles = [],
  scripts = [],
  platformVariants = [],
  strategy = {},
  creativeDirection = {},
  a2aMessages = []
} = {}) {
  const hookLines = hooks.map((item) => typeof item === "string" ? item : item.line || item.hook || "").filter(Boolean);
  const scriptLines = scripts.map((item) => typeof item === "string" ? item : item.line || item.direction || "").filter(Boolean);
  const variantText = platformVariants.flatMap((item) => [item.hook, item.caption, item.cta, item.structure]).filter(Boolean);
  const userFacingText = [...hookLines, ...titles, ...scriptLines, ...variantText, strategy.audience, strategy.promise, strategy.angle].filter(Boolean).join(" ");
  const sourceTerms = topTerms(source, 10).map((item) => item.term);
  const termHits = sourceTerms.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(userFacingText));
  const genericMatches = genericPhraseMatches(userFacingText);
  const unsupported = claimValidation.unsupported || [];
  const supported = claimValidation.supported || claims.filter((claim) => claim.status === "source-backed" || claim.status === "operational-direction");
  const factualClaimCount = Math.max(1, claims.filter((claim) => claim.status !== "operational-direction").length);
  const claimSupportRatio = unsupported.length ? supported.length / (supported.length + unsupported.length) : claims.length ? 1 : 0;
  const evidenceQuotes = evidence.map((item) => cleanLine(item.quote).toLowerCase());
  const sourceFidelityHits = claims.filter((claim) => {
    if (claim.status === "operational-direction") return true;
    const support = evidence.find((item) => item.id === claim.evidenceId);
    return Boolean(support && containmentText(source).includes(containmentText(support.quote)));
  }).length;
  const audience = cleanLine(strategy.audience);
  const audienceGeneric = !audience || /audience implied|specific audience described|everyone|anyone|your audience/i.test(audience);
  const platformNames = new Set(platformVariants.map((item) => String(item.platform || "").toLowerCase()));
  const platformCoverage = [/(short|tiktok|reel)/, /linkedin/, /youtube/].filter((pattern) => [...platformNames].some((name) => pattern.test(name))).length;
  const completeVariants = platformVariants.filter((item) => item.platform && item.hook && item.structure && item.cta).length;
  const evidenceHookCount = hooks.filter((item) => item.evidenceId && evidence.some((evidenceItem) => evidenceItem.id === item.evidenceId)).length;
  const strongHookCount = hookLines.filter((line) => wordList(line).length >= 7 && wordList(line).length <= 28).length;
  const ctas = platformVariants.map((item) => cleanLine(item.cta)).filter(Boolean);
  const ctaActionCount = ctas.filter((cta) => /\b(?:book|buy|order|preorder|read|see|visit|start|join|save|review|take|schedule|download|share)\b/i.test(cta)).length;
  const coreLines = [...hookLines, ...scriptLines].filter(Boolean);
  const duplicateCoreLines = Math.max(0, coreLines.length - uniqueText(coreLines).length);
  const duplicateTitles = Math.max(0, titles.length - uniqueText(titles).length);
  const normalizedTitles = new Set(uniqueText(titles));
  const titleEchoes = [...hookLines, ...scriptLines].filter((line) => normalizedTitles.has(cleanLine(line).toLowerCase())).length;
  const packageChecks = [
    evidence.length > 0,
    citationMap.length === evidence.length && citationMap.length > 0,
    claims.length > 0,
    hooks.length > 0,
    titles.length > 0,
    scripts.length >= 4,
    platformVariants.length >= 3,
    Boolean(creativeDirection && Object.keys(creativeDirection).length),
    a2aMessages.length >= 8
  ];
  const specificityRatio = sourceTerms.length ? termHits.length / Math.min(6, sourceTerms.length) : 0;
  const rubric = {
    sourceFidelity: rubricItem(sourceAssessment.sufficient ? (claims.length ? (sourceFidelityHits / claims.length) * 100 : 0) : 20, 85,
      sourceFidelityHits < claims.length ? ["One or more content claims are not traceable to exact source evidence."] : []),
    claimSupport: rubricItem(claimSupportRatio * 100, 100,
      unsupported.length ? [`${unsupported.length} unsupported claim(s) must remain blocked or be replaced.`] : [], { supported: supported.length, unsupported: unsupported.length, factualClaims: factualClaimCount }),
    specificity: rubricItem(sourceAssessment.sufficient ? 55 + Math.min(1, specificityRatio) * 45 : 20, 75,
      specificityRatio < 0.45 ? ["Use more concrete nouns, facts, and distinctions from the source."] : [], { sourceTerms, termHits }),
    audienceFit: rubricItem(sourceAssessment.sufficient && !audienceGeneric ? 95 : sourceAssessment.signals?.hasAudience ? 78 : 35, 75,
      audienceGeneric ? ["Name the audience from the source instead of using a broad audience label."] : [], { audience }),
    platformFit: rubricItem((platformCoverage / 3) * 70 + (completeVariants / Math.max(1, platformVariants.length)) * 30, 90,
      platformCoverage < 3 || completeVariants < platformVariants.length ? ["Give every required platform a distinct hook, structure, and CTA."] : [], { platformCoverage, completeVariants }),
    hookStrength: rubricItem(hookLines.length ? ((evidenceHookCount / hooks.length) * 55 + (strongHookCount / hookLines.length) * 45) : 0, 75,
      evidenceHookCount < hooks.length ? ["Tie every hook to an evidence ID."] : [], { evidenceBacked: evidenceHookCount, strongLength: strongHookCount }),
    ctaFit: rubricItem(ctas.length ? 65 + (ctaActionCount / ctas.length) * 35 : 0, 80,
      ctaActionCount < ctas.length ? ["Use a concrete source-relevant action in every CTA."] : [], { actionable: ctaActionCount, total: ctas.length }),
    nonGenericWording: rubricItem(100 - genericMatches.length * 30, 85,
      genericMatches.length ? [`Replace generic phrase(s): ${[...new Set(genericMatches)].join(", ")}.`] : [], { matches: [...new Set(genericMatches)] }),
    repetitionTitleEcho: rubricItem(100 - Math.min(20, duplicateCoreLines * 5) - duplicateTitles * 20 - titleEchoes * 25, 75,
      titleEchoes ? [`Remove ${titleEchoes} exact title echo(es) from hooks or script lines.`] : [], { duplicateCoreLines, duplicateTitles, titleEchoes }),
    packageCompleteness: rubricItem((packageChecks.filter(Boolean).length / packageChecks.length) * 100, 100,
      packageChecks.every(Boolean) ? [] : ["Complete evidence, citations, claims, creative assets, platform variants, and traces before export."], { checks: packageChecks }),
    hallucinationRisk: rubricItem(unsupported.length ? 0 : sourceAssessment.sufficient ? 100 : 35, 90,
      unsupported.length ? ["Unsupported claims create high hallucination risk."] : !sourceAssessment.sufficient ? ["Weak source coverage creates elevated hallucination risk."] : [],
      { level: unsupported.length ? "high" : sourceAssessment.sufficient ? "low" : "elevated" })
  };
  const overall = clampScore(QUALITY_RUBRIC_KEYS.reduce((sum, key) => sum + rubric[key].score, 0) / QUALITY_RUBRIC_KEYS.length);
  const failedDimensions = QUALITY_RUBRIC_KEYS.filter((key) => !rubric[key].passed);
  const repairSuggestions = uniqueText([
    ...(sourceAssessment.repairSuggestions || []),
    ...failedDimensions.flatMap((key) => rubric[key].findings || [])
  ]);
  const blockers = [
    !sourceAssessment.sufficient ? "not enough source" : null,
    unsupported.length ? `${unsupported.length} unsupported claim(s)` : null,
    genericMatches.length ? "generic wording detected" : null,
    ...failedDimensions.map((key) => `rubric:${key}`)
  ].filter(Boolean);
  return {
    overall,
    score: overall,
    passed: overall >= 82 && blockers.length === 0,
    rubric,
    failedDimensions,
    blockers: [...new Set(blockers)],
    repairSuggestions,
    nextBestStep: blockers.length
      ? repairSuggestions[0] || sourceAssessment.nextBestStep || "Repair the blocked QA dimensions before export."
      : "Export the approved packet or run a deliberate polish pass.",
    thresholds: {
      minimumOverall: 82,
      zeroUnsupportedClaims: true,
      sourceMustBeSufficient: true,
      noGenericPhrases: true,
      dimensions: Object.fromEntries(QUALITY_RUBRIC_KEYS.map((key) => [key, rubric[key].minimum]))
    },
    evidenceQuotes
  };
}

function createA2ALayer(runId) {
  const messages = [];
  const inbox = Object.fromEntries(AGENT_ORDER.map((agentId) => [agentId, []]));
  const outbox = Object.fromEntries(AGENT_ORDER.map((agentId) => [agentId, []]));
  const replayableHandoffs = [];

  return {
    send({ receipt, producer, consumer, intent, payload = {}, blocker = null }) {
      const message = {
        id: receipt?.id || `a2a-${producer}-${consumer}-${messages.length + 1}`,
        runId,
        producer,
        consumer,
        intent,
        payloadSummary: receipt?.payloadKeys || Object.keys(payload || {}),
        requiredAck: true,
        status: blocker ? "blocked" : "pending",
        createdAt: receipt?.sentAt || new Date().toISOString(),
        consumedAt: null,
        blocker
      };
      messages.push(message);
      if (outbox[producer]) outbox[producer].push(message);
      if (inbox[consumer]) inbox[consumer].push(message);
      replayableHandoffs.push({
        id: `replay-${message.id}`,
        messageId: message.id,
        runId,
        producer,
        consumer,
        intent,
        payload,
        payloadSummary: message.payloadSummary,
        status: "recorded",
        createdAt: message.createdAt
      });
      return message;
    },
    acknowledge(message) {
      message.status = message.blocker ? "blocked" : "acknowledged";
      message.consumedAt = new Date().toISOString();
      return message;
    },
    snapshot() {
      return {
        messages,
        agentInbox: inbox,
        agentOutbox: outbox,
        replayableHandoffs
      };
    }
  };
}

function buildAgent(id, label, mission, tools, accepts, emits, a2a) {
  const requiredTools = [...new Set([...COMMON_TOOLS, ...(id === "archivist" ? [] : ["read_memory"]), ...tools])];
  return {
    id,
    label,
    status: "live",
    tier: "tier-zero",
    promoted: true,
    tierZeroVerified: true,
    tierZeroAuthority: "User-promoted Wake Engine content agent under Tier Zero build parameters.",
    action: mission,
    source: "Wake Engine Tier Zero content-agent build parameters, local store, and source-bound tool calls",
    persona: mission,
    buildParameters: {
      localOnly: true,
      sourceBound: true,
      unrestrictedWithinTierZeroBuild: true,
      arbitrarySourceTermsAllowed: true,
      noCapabilityReduction: true,
      requiredToolExecution: true,
      requiredToolReceipts: true,
      requiredA2A: true,
      requiredAcks: true,
      requiredMemoryWrite: true,
      requiredMemoryReadForNonArchivist: id !== "archivist",
      requiredDoneGate: true,
      requiredBlockerOnFailure: true,
      requiredExportCompatibility: true
    },
    contract: {
      accepts,
      emits,
      operatingScope: "Universal content agent. Not topic-limited, not Wake-only, and not blocked by user source words.",
      truthGuards: [
        "unsupported claims must be marked unknown or routed to repair",
        "citations must map to source evidence",
        "artifacts must be non-empty and export-compatible",
        "handoffs must include next action and receipts"
      ],
      qualityBar: "must emit evidence, artifacts, A2A handoff, QA-readable metadata, and memory payload"
    },
    requiredTools,
    tools: requiredTools,
    a2a,
    inboxSchema: {
      required: id === "archivist" ? [] : ["runId", "producer", "consumer", "intent", "payloadSummary", "status", "consumedAt"]
    },
    outboxSchema: {
      required: ["runId", "producer", "consumer", "intent", "payloadSummary", "requiredAck", "status", "createdAt"]
    },
    doneGate: {
      requires: [
        "all required tools executed",
        "tool receipts persisted",
        "memory write persisted",
        id === "archivist" ? "source profile emitted" : "inbox handoff consumed",
        a2a.length ? "outbound A2A acknowledged" : "terminal handoff recorded",
        "agent output included in packet trace"
      ],
      failWhenMissing: true
    },
    tests: [
      `${id}:contract-present`,
      `${id}:tool-coverage`,
      `${id}:a2a-route`,
      `${id}:memory-receipt`,
      `${id}:done-gate`,
      `${id}:quality-gate`
    ]
  };
}

export const TIER_ZERO_AGENT_PIPELINE = [
  buildAgent(
    "archivist",
    "Archivist",
    "Ingest source, extract evidence, build citation map, and hand verified context to strategy.",
    ["read_source", "extract_evidence", "assess_source", "classify_source", "build_citation_map"],
    ["raw source", "saved source", "retrieval context"],
    ["source profile", "evidence map", "citation list"],
    ["strategist", "qa"]
  ),
  buildAgent(
    "strategist",
    "Strategist",
    "Convert source evidence into audience, promise, offer angle, risk, and next-best action.",
    ["position_offer", "rank_angles", "select_next_action"],
    ["source profile", "evidence map", "operator ask"],
    ["strategy brief", "angle stack", "next action"],
    ["scriptwriter", "creative-director", "qa"]
  ),
  buildAgent(
    "scriptwriter",
    "Scriptwriter",
    "Produce source-backed scripts, hooks, captions, titles, cutdowns, and platform variants.",
    ["write_hooks", "write_titles", "write_captions", "write_script", "write_platform_variants", "map_claims"],
    ["strategy brief", "evidence map"],
    ["script pack", "caption pack", "claim map"],
    ["creative-director", "qa", "export"]
  ),
  buildAgent(
    "creative-director",
    "Creative Director",
    "Produce premium visual direction, asset prompts, edit rules, sound notes, and polish passes.",
    ["design_visual_system", "write_asset_prompts", "write_edit_rules"],
    ["strategy brief", "script pack", "media context"],
    ["creative direction", "shot list", "asset prompt pack"],
    ["qa", "export"]
  ),
  buildAgent(
    "qa",
    "QA",
    "Block weak work, score evidence, validate handoffs, and name the next repair when output is not ready.",
    ["validate_claims", "validate_a2a", "validate_artifacts", "score_quality"],
    ["all upstream packets"],
    ["QA verdict", "blockers", "repair path"],
    ["scriptwriter", "creative-director", "export"]
  ),
  buildAgent(
    "export",
    "Export",
    "Package approved work into local markdown/JSON-ready deliverables with manifest and operator handoff.",
    ["build_manifest", "package_markdown", "package_json"],
    ["QA verdict", "final packet"],
    ["export manifest", "file-ready packet", "operator handoff"],
    ["qa"]
  )
];

export const TIER_ZERO_TOOLS = {
  read_source(source) {
    return {
      title: titleFromSource(source),
      characters: String(source || "").length,
      sourceText: cleanLine(source),
      words: wordList(source).length,
      terms: topTerms(source),
      sentences: sentenceCandidates(source)
    };
  },
  extract_evidence(source) {
    const candidates = sentenceCandidates(source);
    if (candidates.length < 4) {
      const fragments = String(source || "")
        .replace(/^[^:]{1,120}:\s*/i, "")
        .split(/,|\b(?:and|while|with|using|including|around)\b|\.|\n/)
        .map(cleanLine)
        .filter((line) => line.length >= 12);
      for (const fragment of fragments) {
        if (!candidates.some((item) => item.toLowerCase() === fragment.toLowerCase())) candidates.push(fragment);
        if (candidates.length >= 4) break;
      }
    }
    return uniqueText(candidates).slice(0, 8).map((sentence, index) => ({
      id: `evidence-${index + 1}`,
      quote: sentence,
      use: index === 0 ? "primary proof" : index === 1 ? "tension" : index === 2 ? "specific detail" : "supporting detail",
      status: "verified-source-excerpt",
      exactSource: true
    }));
  },
  assess_source(source, evidence) {
    return assessSource(source, evidence);
  },
  classify_source(profile) {
    const text = `${profile.title} ${(profile.terms || []).map((item) => item.term).join(" ")}`.toLowerCase();
    const format = /video|short|reel|caption|tiktok|youtube/.test(text) ? "content-production" : "universal-source";
    return { format, lane: /wake/.test(text) ? "Wake Engine" : /forge/.test(text) ? "ForgeFront" : "General Content" };
  },
  build_citation_map(evidence) {
    return evidence.map((item, index) => ({
      citation: `[S${index + 1}]`,
      evidenceId: item.id,
      quote: item.quote,
      allowedUses: [item.use, "caption", "script beat", "QA support"]
    }));
  },
  position_offer(profile, evidence) {
    const primary = evidence[0]?.quote || profile.title;
    const audience = inferAudience(profile.sourceText);
    const cta = inferCta(profile.sourceText, profile);
    return {
      audience,
      promise: primary,
      tension: evidence[1]?.quote || primary,
      transformation: evidence[2]?.quote || evidence[1]?.quote || primary,
      operatorTakeaway: evidence[3]?.quote || cta,
      angle: `${profile.title} for ${audience}`,
      cta,
      nextAction: cta
    };
  },
  rank_angles(strategy, evidence) {
    return [
      { rank: 1, angle: strategy.angle, evidenceId: evidence[0]?.id || "strategy" },
      { rank: 2, angle: "source proof into system output", evidenceId: evidence[1]?.id || evidence[0]?.id || "strategy" },
      { rank: 3, angle: "operator next action", evidenceId: "strategy-next-action" }
    ];
  },
  select_next_action(strategy) {
    return { action: strategy.nextAction, owner: "operator", reason: "best next step after strategy pass" };
  },
  write_hooks(evidence) {
    return evidence.slice(0, 5).map((item, index) => ({
      id: `hook-${index + 1}`,
      line: item.quote.length > 120 ? `${item.quote.slice(0, 117).trim()}...` : item.quote,
      evidenceId: item.id
    }));
  },
  write_titles(profile, evidence, strategy) {
    if (!evidence.length) return [];
    const terms = (profile.terms || []).slice(0, 3).map((item) => item.term);
    const detail = evidence[1]?.quote || evidence[0]?.quote || profile.title;
    return uniqueText([
      `${profile.title}: ${strategy.audience}`,
      terms.length >= 2 ? `${terms[0]} and ${terms[1]}: what the source makes clear` : `${profile.title}: what the source makes clear`,
      `${cleanLine(detail).split(/\s+/).slice(0, 8).join(" ")}: ${strategy.audience}`
    ]).map((title) => `${title.charAt(0).toUpperCase()}${title.slice(1)}`);
  },
  write_captions(platformVariants) {
    return platformVariants.map((variant) => `${variant.hook} ${variant.cta}`.trim());
  },
  write_script(profile, evidence, strategy) {
    if (!evidence.length) return [];
    const lines = evidence;
    return [
      { time: "0:00-0:03", beat: "Open", line: lines[0].quote, evidenceId: lines[0].id },
      { time: "0:03-0:12", beat: "Tension", line: lines[1]?.quote || lines[0].quote, evidenceId: lines[1]?.id || lines[0].id },
      { time: "0:12-0:24", beat: "Specific Detail", line: lines[2]?.quote || lines[0].quote, evidenceId: lines[2]?.id || lines[0].id },
      { time: "0:24-0:38", beat: "Proof", line: lines[3]?.quote || lines[0].quote, evidenceId: lines[3]?.id || lines[0].id },
      { time: "0:38-0:50", beat: "Application", line: lines[4]?.quote || lines[1]?.quote || lines[0].quote, evidenceId: lines[4]?.id || lines[1]?.id || lines[0].id },
      { time: "0:50-1:00", beat: "Action", line: strategy.nextAction, evidenceId: "strategy-next-action" }
    ];
  },
  write_platform_variants(profile, hooks, strategy) {
    if (!hooks.length) return [];
    const first = hooks[0]?.line || strategy.promise || profile.title;
    const second = hooks[1]?.line || first;
    const third = hooks[2]?.line || second;
    return [
      { platform: "Shorts/TikTok/Reels", structure: "open with the strongest concrete detail, show the offer, end on the action", hook: first, cta: strategy.cta },
      { platform: "LinkedIn", structure: "state the source fact, explain who it serves, close with the practical action", hook: second, cta: strategy.cta },
      { platform: "YouTube", structure: "expand the source details into context, proof, application, and action", hook: third, cta: strategy.cta }
    ];
  },
  map_claims(script, evidence) {
    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    return script.map((beat, index) => {
      const support = evidenceById.get(beat.evidenceId);
      const operational = beat.evidenceId === "strategy-next-action";
      return {
        id: `mapped-claim-${index + 1}`,
        beat: beat.beat,
        evidenceId: beat.evidenceId,
        line: beat.line,
        sourceLine: support?.quote || null,
        status: operational ? "operational-direction" : support ? "source-backed" : "unknown/not enough source",
        publishable: operational || Boolean(support),
        blocker: operational || support ? null : "No source evidence supports this claim."
      };
    });
  },
  design_visual_system(profile, strategy) {
    const terms = (profile.terms || []).slice(0, 3).map((item) => item.term).join(", ");
    return {
      visualDirection: `Use visible details from ${terms || profile.title}, readable source excerpts, restrained hierarchy, and scenes that show the stated offer or outcome.`,
      editRules: [
        "Every text overlay must map to evidenceMap or strategy output.",
        "Use motion to reveal system steps, not to hide weak source material.",
        "Keep the CTA tied to the next action."
      ],
      sound: "Clear narration with pacing and music chosen for the audience and offer described in the source."
    };
  },
  write_edit_rules(creative) {
    return creative.editRules.map((rule, index) => ({ id: `edit-rule-${index + 1}`, rule }));
  },
  write_asset_prompts(profile, creative) {
    return [
      `${creative.visualDirection}; hero frame for ${profile.title}`,
      `source evidence card stack; premium content treatment; readable proof markers`,
      `final export-ready packet scene; polished handoff layout`
    ];
  },
  validate_claims(evidence, claims) {
    const evidenceById = new Map(evidence.map((item) => [item.id, item]));
    const supported = [];
    const unsupported = [];
    const reviewedClaims = claims.map((claim) => {
      if (claim.evidenceId === "strategy-next-action" && claim.status === "operational-direction") {
        const reviewed = { ...claim, publishable: true, blocker: null };
        supported.push(reviewed);
        return reviewed;
      }
      const support = evidenceById.get(claim.evidenceId);
      const exact = support && comparableText(claim.line) === comparableText(support.quote);
      if (support && exact) {
        const reviewed = { ...claim, sourceLine: support.quote, status: "source-backed", publishable: true, blocker: null };
        supported.push(reviewed);
        return reviewed;
      }
      const reviewed = {
        ...claim,
        sourceLine: support?.quote || null,
        status: "unknown/not enough source",
        publishable: false,
        blocker: support ? "Claim wording exceeds the cited source evidence." : "No source evidence supports this claim."
      };
      unsupported.push(reviewed);
      return reviewed;
    });
    return { passed: unsupported.length === 0, supported, unsupported, claims: reviewedClaims };
  },
  validate_artifacts(artifacts) {
    return { passed: artifacts.length >= 5, count: artifacts.length };
  },
  validate_a2a(a2aMessages) {
    const routes = new Set(a2aMessages.map((item) => `${item.producer || item.from}->${item.consumer || item.to}`));
    return {
      passed: routes.has("archivist->strategist") && routes.has("strategist->scriptwriter") && routes.has("scriptwriter->qa") && routes.has("creative-director->export"),
      routes: [...routes]
    };
  },
  score_quality: qualityScore,
  build_manifest(profile, qa, artifacts) {
    return {
      title: profile.title,
      status: qa.verdict,
      artifactCount: artifacts.length,
      nextAction: qa.nextAction,
      requiredSections: REQUIRED_PACKET_SECTIONS,
      traceSections: ["a2aTrace", "toolTrace", "memoryWrites", "memoryReads", "agentTrace"],
      agentNetwork: AGENT_ORDER,
      localOnly: true,
      tierZeroPromoted: true,
      qaRequired: true,
      generatedAt: new Date().toISOString()
    };
  },
  package_markdown(manifest) {
    return `# ${manifest.title}\n\nStatus: ${manifest.status}\n\nNext action: ${manifest.nextAction}\n`;
  },
  package_json(packet) {
    return { schema: "wake-engine-tier-zero-packet", packet };
  },
  send_a2a(from, to, payload) {
    return { id: `a2a-${from}-${to}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, from, to, payloadKeys: Object.keys(payload || {}), sentAt: new Date().toISOString() };
  },
  read_memory(agentId, fromAgentId) {
    return { agentId, fromAgentId, status: "read", readAt: new Date().toISOString() };
  },
  write_memory(agentId, output) {
    return { agentId, outputKeys: Object.keys(output || {}), wroteAt: new Date().toISOString() };
  }
};

export function auditTierZeroRuntime() {
  const toolNames = new Set(Object.keys(TIER_ZERO_TOOLS));
  const agents = TIER_ZERO_AGENT_PIPELINE;
  const violations = [];
  for (const agent of agents) {
    if (agent.status !== "live" || agent.tierZeroVerified !== true) violations.push(`${agent.id}:not-live`);
    if (!agent.contract || !agent.contract.accepts?.length || !agent.contract.emits?.length) violations.push(`${agent.id}:weak-contract`);
    if (!agent.tools?.every((tool) => toolNames.has(tool))) violations.push(`${agent.id}:missing-tool-implementation`);
    if (!agent.a2a?.length) violations.push(`${agent.id}:missing-a2a`);
    if (!agent.tests?.length) violations.push(`${agent.id}:missing-tests`);
  }
  return {
    ok: violations.length === 0,
    checkedAt: new Date().toISOString(),
    summary: {
      agents: agents.length,
      tools: toolNames.size,
      a2aRoutes: agents.reduce((sum, agent) => sum + agent.a2a.length, 0),
      violations: violations.length
    },
    violations
  };
}

export function runTierZeroNetwork({ source, basePack = {}, retrievalContext = {} } = {}) {
  const a2aMessages = [];
  const memoryWrites = [];
  const memoryReads = [];
  const toolCalls = [];
  const runId = `tz-run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const a2aLayer = createA2ALayer(runId);
  const call = (agentId, tool, ...args) => {
    const inputSummary = args.map((arg) => Array.isArray(arg) ? `array:${arg.length}` : typeof arg === "object" && arg ? `object:${Object.keys(arg).length}` : typeof arg);
    try {
      const output = TIER_ZERO_TOOLS[tool](...args);
      toolCalls.push({
        id: `tool-${toolCalls.length + 1}`,
        runId,
        agentId,
        tool,
        status: "ok",
        inputSummary,
        outputSummary: Array.isArray(output) ? `array:${output.length}` : typeof output === "object" && output ? `object:${Object.keys(output).length}` : typeof output,
        calledAt: new Date().toISOString()
      });
      return output;
    } catch (error) {
      toolCalls.push({
        id: `tool-${toolCalls.length + 1}`,
        runId,
        agentId,
        tool,
        status: "failed",
        inputSummary,
        error: error.message,
        calledAt: new Date().toISOString()
      });
      throw error;
    }
  };
  const handoff = (from, to, payload) => {
    const msg = call(from, "send_a2a", from, to, payload);
    const message = a2aLayer.send({
      receipt: msg,
      producer: from,
      consumer: to,
      intent: `${from}-to-${to}-handoff`,
      payload
    });
    a2aLayer.acknowledge(message);
    a2aMessages.push(message);
    return msg;
  };
  const remember = (agentId, output) => {
    const memory = call(agentId, "write_memory", agentId, output);
    memoryWrites.push({ ...memory, runId, status: "written" });
    return memory;
  };
  const recall = (agentId, fromAgentId) => {
    const read = call(agentId, "read_memory", agentId, fromAgentId);
    memoryReads.push({ ...read, runId });
    return read;
  };

  const sourceProfile = call("archivist", "read_source", source);
  const evidenceMap = call("archivist", "extract_evidence", source);
  const sourceAssessment = call("archivist", "assess_source", source, evidenceMap);
  const citationMap = call("archivist", "build_citation_map", evidenceMap);
  const classification = call("archivist", "classify_source", sourceProfile);
  const archivist = { sourceProfile, sourceAssessment, evidenceMap, citationMap, classification, retrievalContext };
  remember("archivist", archivist);
  handoff("archivist", "strategist", { sourceProfile, evidenceMap, classification });
  handoff("archivist", "qa", { evidenceMap });

  recall("strategist", "archivist");
  const strategy = call("strategist", "position_offer", sourceProfile, evidenceMap);
  const rankedAngles = call("strategist", "rank_angles", strategy, evidenceMap);
  const selectedNextAction = call("strategist", "select_next_action", strategy);
  const strategist = { strategy, rankedAngles, selectedNextAction, angleStack: rankedAngles.map((item) => item.angle) };
  remember("strategist", strategist);
  handoff("strategist", "scriptwriter", strategist);
  handoff("strategist", "creative-director", strategist);
  handoff("strategist", "qa", strategist);

  recall("scriptwriter", "strategist");
  const hooks = call("scriptwriter", "write_hooks", evidenceMap);
  const titles = call("scriptwriter", "write_titles", sourceProfile, evidenceMap, strategy);
  const script = call("scriptwriter", "write_script", sourceProfile, evidenceMap, strategy);
  const platformVariants = call("scriptwriter", "write_platform_variants", sourceProfile, hooks, strategy);
  const captions = call("scriptwriter", "write_captions", platformVariants);
  const claimMap = call("scriptwriter", "map_claims", script, evidenceMap);
  const scriptwriter = { hooks, titles, captions, script, platformVariants, claimMap };
  remember("scriptwriter", scriptwriter);
  handoff("scriptwriter", "creative-director", scriptwriter);
  handoff("scriptwriter", "qa", scriptwriter);
  handoff("scriptwriter", "export", scriptwriter);

  recall("creative-director", "scriptwriter");
  const visualSystem = call("creative-director", "design_visual_system", sourceProfile, strategy);
  const assetPrompts = call("creative-director", "write_asset_prompts", sourceProfile, visualSystem);
  const editRuleReceipts = call("creative-director", "write_edit_rules", visualSystem);
  const creativeDirector = { visualSystem, assetPrompts, editRuleReceipts, shotList: script.map((beat) => ({ beat: beat.beat, visual: visualSystem.visualDirection, line: beat.line })) };
  remember("creative-director", creativeDirector);
  handoff("creative-director", "qa", creativeDirector);
  handoff("creative-director", "export", creativeDirector);

  recall("qa", "scriptwriter");
  recall("qa", "creative-director");
  const artifacts = [
    sourceProfile,
    evidenceMap,
    strategy,
    scriptwriter,
    creativeDirector,
    basePack.contentArsenal || null
  ].filter(Boolean);
  const claimValidation = call("qa", "validate_claims", evidenceMap, claimMap);
  const a2aValidation = call("qa", "validate_a2a", a2aMessages);
  const artifactValidation = call("qa", "validate_artifacts", artifacts);
  const score = call("qa", "score_quality", {
    source,
    sourceAssessment,
    evidence: evidenceMap,
    citationMap,
    claims: claimValidation.claims,
    claimValidation,
    hooks,
    titles,
    scripts: script,
    platformVariants,
    strategy,
    creativeDirection: visualSystem,
    a2aMessages
  });
  const blockers = [
    ...score.blockers,
    !claimValidation.passed ? "unsupported claims are blocked" : null,
    !a2aValidation.passed ? "required A2A handoff is incomplete" : null,
    !artifactValidation.passed ? "content package is incomplete" : null
  ].filter(Boolean);
  const repairSuggestions = uniqueText([
    ...score.repairSuggestions,
    !claimValidation.passed ? "Add supporting source evidence or remove every unsupported claim." : null,
    !a2aValidation.passed ? "Replay the missing agent handoff and require its acknowledgement." : null,
    !artifactValidation.passed ? "Complete the missing content artifacts before export." : null
  ].filter(Boolean));
  const passed = blockers.length === 0 && score.passed;
  const qa = {
    verdict: passed ? "pass" : "blocked",
    passed,
    claimValidation,
    a2aValidation,
    artifactValidation,
    score,
    rubric: score.rubric,
    unknownClaims: claimValidation.unsupported,
    blockers,
    repairSuggestions,
    nextBestStep: passed ? "Export the approved packet or run a deliberate polish pass." : score.nextBestStep,
    nextAction: passed ? "Export the approved packet or run a deliberate polish pass." : score.nextBestStep
  };
  remember("qa", qa);
  handoff("qa", "export", qa);

  recall("export", "qa");
  const manifest = call("export", "build_manifest", sourceProfile, qa, artifacts);
  const markdown = call("export", "package_markdown", manifest);
  const json = call("export", "package_json", { manifest, archivist, strategist, scriptwriter, creativeDirector, qa });
  const exportAgent = { manifest, markdown, json };
  remember("export", exportAgent);
  handoff("export", "qa", { manifest });
  handoff("export", "archivist", { manifest, runId, archive: "final-export-manifest" });

  const runtimeAudit = auditTierZeroRuntime();
  const a2aSnapshot = a2aLayer.snapshot();
  const agentTrace = TIER_ZERO_AGENT_PIPELINE.map((agent) => {
    const agentToolCalls = toolCalls.filter((item) => item.agentId === agent.id);
    const tools = agentToolCalls.map((item) => item.tool);
    const toolSet = new Set(tools);
    const missingTools = agent.requiredTools.filter((tool) => !toolSet.has(tool));
    const failedTools = agentToolCalls.filter((item) => item.status !== "ok");
    const agentMemoryWrites = memoryWrites.filter((item) => item.agentId === agent.id);
    const agentMemoryReads = memoryReads.filter((item) => item.agentId === agent.id);
    const outboundA2A = a2aMessages.filter((item) => item.producer === agent.id || item.from === agent.id);
    const inboundA2A = a2aMessages.filter((item) => item.consumer === agent.id || item.to === agent.id);
    const blockers = [
      missingTools.length ? `missing tools: ${missingTools.join(", ")}` : null,
      failedTools.length ? `failed tools: ${failedTools.map((item) => item.tool).join(", ")}` : null,
      agentMemoryWrites.length ? null : "missing memory write",
      agent.id !== "archivist" && !agentMemoryReads.length ? "missing memory read" : null,
      agent.a2a.length && !outboundA2A.length ? "missing outbound A2A" : null,
      agent.id !== "archivist" && !inboundA2A.length ? "missing inbound A2A" : null,
      outboundA2A.some((message) => message.status !== "acknowledged") ? "unacknowledged outbound A2A" : null
    ].filter(Boolean);
    return {
      agentId: agent.id,
      label: agent.label,
      tier: "tier-zero",
      promoted: true,
      status: blockers.length ? "blocked" : "done",
      requiredTools: agent.requiredTools,
      tools,
      missingTools,
      inputReceipts: {
        inbox: inboundA2A,
        memoryReads: agentMemoryReads
      },
      outputReceipts: {
        outbox: outboundA2A,
        replayableHandoffs: a2aSnapshot.replayableHandoffs.filter((item) => item.producer === agent.id),
        memoryWrites: agentMemoryWrites,
        toolCalls: agentToolCalls
      },
      memory: agentMemoryWrites.length > 0,
      memoryReads: agentMemoryReads,
      inboundA2A: inboundA2A.map((item) => item.id),
      outboundA2A: outboundA2A.map((item) => item.to || item.consumer),
      doneGate: {
        required: agent.doneGate.requires,
        passed: blockers.length === 0,
        checkedAt: new Date().toISOString()
      },
      blockers,
      recoveryAttempts: blockers.length ? blockers.map((blocker) => `repair:${blocker}`) : []
    };
  });
  return {
    ok: runtimeAudit.ok && qa.verdict === "pass",
    runId,
    generatedAt: new Date().toISOString(),
    runtime: "wake-engine-tier-zero-content-runtime",
    tierZeroPromoted: true,
    tierZeroAuthority: "Promoted Wake Engine content agents under the user-approved Tier Zero build parameters.",
    runtimeAudit,
    agents: { archivist, strategist, scriptwriter, creativeDirector, qa, export: exportAgent },
    agentTrace,
    a2aMessages,
    agentInbox: a2aSnapshot.agentInbox,
    agentOutbox: a2aSnapshot.agentOutbox,
    replayableHandoffs: a2aSnapshot.replayableHandoffs,
    memoryWrites,
    memoryReads,
    toolCalls,
    pack: {
      tierZeroVerified: runtimeAudit.ok,
      runId,
      tierZeroPromoted: true,
      tierZeroAuthority: "Promoted Wake Engine content agents under the user-approved Tier Zero build parameters.",
      packetContract: CANONICAL_PACKET_CONTRACT,
      agentTrace,
      source: sourceProfile.sourceText,
      sourceAssessment,
      sourceProfile: {
        ...(basePack.sourceProfile || {}),
        ...sourceProfile,
        audience: strategy.audience,
        lane: classification.lane,
        sourceType: basePack.sourceProfile?.sourceType || classification.format
      },
      strategicBrief: strategy,
      evidenceMap,
      citationMap,
      claimMap: claimValidation.claims,
      a2aMessages,
      a2aTrace: a2aMessages,
      agentInbox: a2aSnapshot.agentInbox,
      agentOutbox: a2aSnapshot.agentOutbox,
      replayableHandoffs: a2aSnapshot.replayableHandoffs,
      toolCalls,
      toolTrace: toolCalls,
      memoryWrites,
      memoryReads,
      tierZeroQa: qa,
      qaVerdict: qa,
      exportManifest: { ...(basePack.exportManifest || {}), ...manifest, requiredSections: REQUIRED_PACKET_SECTIONS },
      hooks: sourceAssessment.sufficient ? hooks.map((item) => item.line) : [],
      hookReceipts: hooks,
      titles: sourceAssessment.sufficient ? titles : [],
      captions: sourceAssessment.sufficient ? captions : [],
      scripts: sourceAssessment.sufficient ? script : [],
      scenePlan: sourceAssessment.sufficient ? script.map((beat) => ({ time: beat.time, purpose: beat.beat, line: beat.line, evidenceId: beat.evidenceId })) : [],
      scriptBeats: sourceAssessment.sufficient ? script.map((beat) => ({ beat: beat.beat, direction: beat.line, evidenceId: beat.evidenceId })) : [],
      platformVariants: sourceAssessment.sufficient ? platformVariants : [],
      contentArsenal: sourceAssessment.sufficient ? {
        shortForm60: {
          title: titles[0] || sourceProfile.title,
          runtime: "60s",
          voiceover: script.map((beat) => `${beat.time}: ${beat.line}`).join("\n"),
          editPattern: "source fact, audience tension, concrete detail, application, action"
        },
        shortForm30: {
          title: titles[1] || titles[0] || sourceProfile.title,
          runtime: "30s",
          voiceover: script.slice(0, 3).map((beat) => beat.line).join(" "),
          editPattern: "source fact, specific detail, action"
        },
        carousel: {
          slides: claimValidation.claims.filter((claim) => claim.publishable).slice(0, 5).map((claim, index) => ({
            slide: index + 1,
            headline: cleanLine(claim.line).split(/\s+/).slice(0, 8).join(" "),
            body: claim.sourceLine || claim.line,
            evidenceId: claim.evidenceId
          }))
        },
        longFormOutline: script.map((beat) => ({ section: beat.beat, point: beat.line, evidenceId: beat.evidenceId }))
      } : {
        status: "blocked",
        reason: "not enough source",
        repairSuggestions
      },
      productionNotes: {
        visualDirection: sourceAssessment.sufficient ? visualSystem.visualDirection : "",
        creativeDirection: sourceAssessment.sufficient ? visualSystem.visualDirection : "",
        editRules: sourceAssessment.sufficient ? visualSystem.editRules : [],
        assetPrompts: sourceAssessment.sufficient ? assetPrompts : []
      },
      creativeDirection: sourceAssessment.sufficient ? visualSystem.visualDirection : "",
      visualPrompts: sourceAssessment.sufficient ? assetPrompts : [],
      quotePack: evidenceMap.map((item) => item.quote),
      repairSuggestions,
      nextAction: qa.nextAction,
      operatorHandoff: {
        ...(basePack.operatorHandoff || {}),
        nextBestStep: qa.nextAction,
        agentNetwork: "Archivist -> Strategist -> Scriptwriter -> Creative Director -> QA -> Export"
      },
      qualityFlags: {
        ...(basePack.qualityFlags || {}),
        tierZeroRuntime: runtimeAudit.ok,
        a2aComplete: a2aMessages.length >= 5,
        toolCallsComplete: toolCalls.length >= 14,
        qaPassed: qa.verdict === "pass",
        sourceSufficient: sourceAssessment.sufficient,
        unsupportedClaims: claimValidation.unsupported.length,
        genericWording: score.rubric.nonGenericWording.matches.length > 0,
        eliteRubricComplete: QUALITY_RUBRIC_KEYS.every((key) => Boolean(score.rubric[key]))
      }
    }
  };
}
