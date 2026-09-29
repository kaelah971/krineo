import { evaluatePreflight, type DecisionIntegrationResult } from "../decision";
import {
  aggregateKillSwitchResults,
  validateKillSwitch,
} from "../killswitch/validator";
import type {
  KillSwitchAggregateResult,
  KillSwitchEvidenceItem,
  KillSwitchValidationResult,
} from "../killswitch/types";
import type { MemorySnapshot } from "../memory";
import {
  createPracticeLedger,
  createPracticePortfolio,
  openPracticePosition,
  calculatePracticePnl,
} from "../practice/ledger";
import type { PracticePnl } from "../practice/types";
import type { PlaybookVersion } from "../playbook";
import { buildDM1InvalidationRules } from "../thesis/invalidation";
import type { InvalidationRule } from "../thesis/types";
import { buildThesisReceipt } from "../thesis/receipt";
import { createThesis } from "../thesis/build";
import { evaluateCandidate } from "../strategy/dm1/decision";
import { selectAutonomousCandidate } from "../strategy/dm1/selection";
import type {
  AutonomousSelectionResult,
  CandidateEvaluation,
} from "../strategy/dm1/types";
import {
  RESEARCH_REASON_CODES,
  RESEARCH_RUN_STAGES,
  RESEARCH_RUN_STATUSES,
  type ResearchCandidateRun,
  type ResearchCommitResult,
  type ResearchDecisionProposal,
  type ResearchEvidenceSnapshot,
  type ResearchMemoryInput,
  type ResearchPracticeResult,
  type ResearchPreflightFailure,
  type ResearchProviderIssue,
  type ResearchRun,
  type ResearchRunStage,
  type ResearchRunStatus,
} from "./types";
import {
  MAX_RESEARCH_CANDIDATES,
  type ResearchProvider,
} from "./provider";

export const RESEARCH_NORMALIZER_VERSION = "research-normalizer-v1" as const;
export const DEFAULT_REPLAY_STARTED_AT = "2026-09-28T13:25:01.000Z" as const;

export interface ResearchRunInput {
  readonly provider: ResearchProvider;
  readonly playbookVersion: PlaybookVersion;
  readonly memorySnapshot?: ResearchMemoryInput;
  readonly runId?: string;
  readonly startedAt?: string;
  readonly autoCommitPractice?: boolean;
  readonly practiceEntryPrice?: number;
  readonly practiceCurrentPrice?: number;
}

interface RunState {
  readonly providerWarnings: ResearchProviderIssue[];
  readonly providerFailures: ResearchProviderIssue[];
  readonly reasonCodes: string[];
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function addUnique(items: string[], values: readonly string[]): void {
  for (const value of values) {
    if (!items.includes(value)) items.push(value);
  }
}

function freezeDeep<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== "object") return value;
  const object = value as object;
  if (seen.has(object)) return value;
  seen.add(object);
  for (const child of Object.values(value as Record<string, unknown>)) {
    freezeDeep(child, seen);
  }
  return Object.freeze(value);
}

function errorIssue(
  code: string,
  message: string,
  source: string,
  status?: ResearchProviderIssue["status"],
): ResearchProviderIssue {
  return { code, message, source, ...(status === undefined ? {} : { status }) };
}

function emptySelection(): AutonomousSelectionResult {
  return selectAutonomousCandidate([]);
}

function unknownEvidence(
  asset: string,
  provider: ResearchProvider,
): ResearchEvidenceSnapshot {
  return {
    asset,
    dm1: {
      evidence: {
        DIRECTIONAL_MOMENTUM: "UNKNOWN",
        TECHNICAL_CONFLUENCE: "UNKNOWN",
        RELATIVE_OPPORTUNITY: "UNKNOWN",
        MARKET_ALIGNMENT: "UNKNOWN",
        SENTIMENT_DERIVATIVES: "UNKNOWN",
      },
      risk: "UNKNOWN",
      safety: "UNKNOWN",
      regimeFit: "UNKNOWN",
    },
    evidenceItems: [],
    provenance: {
      provider: provider.identity.id,
      source: provider.identity.source,
      tool: "research-orchestrator",
      ...(provider.identity.serverName === undefined
        ? {}
        : { serverName: provider.identity.serverName }),
      ...(provider.identity.serverVersion === undefined
        ? {}
        : { serverVersion: provider.identity.serverVersion }),
      ...(provider.identity.protocolVersion === undefined
        ? {}
        : { protocolVersion: provider.identity.protocolVersion }),
    },
    providerStatus: "UNAVAILABLE",
    normalizationNotes: {
      evidence: "Provider research failed; missing dimensions remain UNKNOWN.",
    },
  };
}

function safeAsOf(
  marketContext: ResearchRun["marketContext"],
  candidates: readonly ResearchCandidateRun[],
): string | null {
  if (marketContext?.asOf !== undefined) return marketContext.asOf;
  return candidates.find((candidate) => candidate.evidence.provenance.asOf !== undefined)
    ?.evidence.provenance.asOf ?? null;
}

function makeKillSwitchEvidence(
  snapshot: ResearchEvidenceSnapshot,
): KillSwitchEvidenceItem[] {
  return [
    ...snapshot.evidenceItems.map((item) => ({
      id: item.id,
      kind: "DIRECTIONAL" as const,
      dimension: item.dimension,
      state: item.state,
      source: item.source,
      candidateAsset: snapshot.asset,
    })),
    {
      id: `${snapshot.asset.toLowerCase()}-risk`,
      kind: "RISK" as const,
      state: snapshot.dm1.risk,
      source: `${snapshot.provenance.source}/${snapshot.provenance.tool}/risk`,
      candidateAsset: snapshot.asset,
    },
    {
      id: `${snapshot.asset.toLowerCase()}-safety`,
      kind: "SAFETY" as const,
      state: snapshot.dm1.safety,
      source: `${snapshot.provenance.source}/${snapshot.provenance.tool}/safety`,
      candidateAsset: snapshot.asset,
    },
    {
      id: `${snapshot.asset.toLowerCase()}-regime`,
      kind: "REGIME_FIT" as const,
      state: snapshot.dm1.regimeFit,
      source: `${snapshot.provenance.source}/${snapshot.provenance.tool}/regime`,
      candidateAsset: snapshot.asset,
    },
  ];
}

function runKillSwitch(
  runId: string,
  selected: CandidateEvaluation,
  snapshot: ResearchEvidenceSnapshot,
  candidates: readonly CandidateEvaluation[],
): {
  aggregate: KillSwitchAggregateResult;
  validation: KillSwitchValidationResult;
} {
  const evidence = makeKillSwitchEvidence(snapshot);
  const validation = validateKillSwitch({
    decision: { provisional: selected, final: null },
    evidence: { dm1: snapshot.dm1, items: evidence },
    comparison: {
      available: candidates.length > 0,
      selectedCandidateId: `candidate-${selected.asset.toLowerCase()}`,
      candidates: candidates.map((candidate) => ({
        id: `candidate-${candidate.asset.toLowerCase()}`,
        evaluation: candidate,
      })),
    },
    challenge: {
      id: `${runId}-killswitch-directional-contradiction`,
      challengeType: "DIRECTION_CONTRADICTION",
      claim: "Can the directional record contradict the provisional thesis?",
      evidenceIds: evidence
        .filter((item) => item.kind === "DIRECTIONAL")
        .map((item) => item.id),
      candidateIds: candidates.map(
        (candidate) => `candidate-${candidate.asset.toLowerCase()}`,
      ),
      createdBy: "MODEL",
    },
  });

  return {
    validation,
    aggregate: aggregateKillSwitchResults([validation]),
  };
}

function preflightFailure(
  result: Exclude<DecisionIntegrationResult, { ok: true }>,
): ResearchPreflightFailure {
  return {
    code: result.code,
    message: result.message,
    ...(result.playbookCode === undefined
      ? {}
      : { playbookCode: result.playbookCode }),
  };
}

function practiceResult(
  runId: string,
  startedAt: string,
  thesis: ResearchCommitResult["thesis"],
  version: ResearchCommitResult["version"],
  entryPrice: number,
  currentPrice: number | undefined,
): ResearchPracticeResult | null {
  const portfolioResult = createPracticePortfolio({
    id: `${runId}-practice-portfolio`,
    createdAt: startedAt,
  });
  if (!portfolioResult.ok) return null;
  const ledgerResult = createPracticeLedger(portfolioResult.value);
  if (!ledgerResult.ok) return null;
  const positionResult = openPracticePosition({
    portfolio: portfolioResult.value,
    existingPositions: ledgerResult.value.positions,
    thesis,
    thesisVersion: version,
    positionId: `${runId}-practice-position`,
    entryPrice,
    entryTime: startedAt,
  });
  if (!positionResult.ok) return null;

  let pnl: PracticePnl | null = null;
  if (currentPrice !== undefined) {
    const pnlResult = calculatePracticePnl(positionResult.value, currentPrice);
    if (!pnlResult.ok) return null;
    pnl = pnlResult.value;
  }

  const finalLedger = createPracticeLedger(portfolioResult.value, [
    positionResult.value,
  ]);
  if (!finalLedger.ok) return null;
  return {
    ledger: finalLedger.value,
    position: positionResult.value,
    pnl,
  };
}

function runResult(input: {
  readonly id: string;
  readonly provider: ResearchProvider;
  readonly startedAt: string;
  readonly state: RunState;
  readonly status: ResearchRunStatus;
  readonly stage: ResearchRunStage;
  readonly marketContext: ResearchRun["marketContext"];
  readonly candidateDiscovery: ResearchRun["candidateDiscovery"];
  readonly candidates: readonly ResearchCandidateRun[];
  readonly selection: AutonomousSelectionResult;
  readonly selectedAsset: string | null;
  readonly marketDecision: ResearchRun["marketDecision"];
  readonly finalDecision: ResearchRun["finalDecision"];
  readonly preflight: ResearchRun["preflight"];
  readonly preflightFailure: ResearchRun["preflightFailure"];
  readonly killSwitch: ResearchRun["killSwitch"];
  readonly killSwitchValidation: ResearchRun["killSwitchValidation"];
  readonly proposal: ResearchDecisionProposal | null;
  readonly commit: ResearchCommitResult | null;
  readonly practice: ResearchPracticeResult | null;
  readonly autoCommitPractice: boolean;
  readonly playbookVersion: PlaybookVersion;
  readonly memorySnapshot: MemorySnapshot | null | undefined;
}): ResearchRun {
  const asOf = safeAsOf(input.marketContext, input.candidates);
  return freezeDeep({
    id: input.id,
    intent: "AUTONOMOUS_DISCOVERY",
    mode: input.provider.identity.mode,
    status: input.status,
    outcome: input.status,
    currentStage: input.stage,
    createdAt: input.startedAt,
    updatedAt: asOf ?? input.startedAt,
    startedAt: input.startedAt,
    asOf,
    provider: input.provider.identity,
    marketContext: input.marketContext,
    candidateDiscovery: input.candidateDiscovery,
    candidateAssetsConsidered: input.candidates.map((candidate) => candidate.asset),
    candidates: input.candidates,
    selection: input.selection,
    selectedAsset: input.selectedAsset,
    marketDecision: input.marketDecision,
    finalDecision: input.finalDecision,
    reasonCodes: input.state.reasonCodes,
    providerWarnings: input.state.providerWarnings,
    providerFailures: input.state.providerFailures,
    preflight: input.preflight,
    preflightFailure: input.preflightFailure,
    killSwitch: input.killSwitch,
    killSwitchValidation: input.killSwitchValidation,
    proposal: input.proposal,
    commit: input.commit,
    practice: input.practice,
    autoCommitPractice: input.autoCommitPractice,
    playbookVersionId: input.playbookVersion.id,
    memorySnapshotId: input.memorySnapshot?.snapshotId ?? null,
  });
}

export async function runResearch(input: ResearchRunInput): Promise<ResearchRun> {
  const mode = input.provider.identity.mode;
  const startedAt = input.startedAt ??
    (mode === "REPLAY" ? DEFAULT_REPLAY_STARTED_AT : new Date().toISOString());
  const defaultRunId = mode === "REPLAY"
    ? `research-replay-${input.provider.identity.source.toLowerCase()}`
    : `research-live-${startedAt.replace(/[^A-Za-z0-9._-]/g, "-")}`;
  const runId = input.runId ?? defaultRunId;
  const autoCommitPractice = input.autoCommitPractice ?? false;
  const state: RunState = {
    providerWarnings: [],
    providerFailures: [],
    reasonCodes: [],
  };
  const base = {
    id: runId,
    provider: input.provider,
    startedAt,
    state,
    marketContext: null,
    candidateDiscovery: null,
    candidates: [] as readonly ResearchCandidateRun[],
    selection: emptySelection(),
    selectedAsset: null,
    marketDecision: "ABSTAIN" as const,
    finalDecision: "ABSTAIN" as const,
    preflight: null,
    preflightFailure: null,
    killSwitch: null,
    killSwitchValidation: null,
    proposal: null,
    commit: null,
    practice: null,
    autoCommitPractice,
    playbookVersion: input.playbookVersion,
    memorySnapshot: input.memorySnapshot,
  };

  let preparation;
  try {
    preparation = await input.provider.prepare();
  } catch (error) {
    state.providerFailures.push(
      errorIssue(
        RESEARCH_REASON_CODES.PROVIDER_DISCOVERY_UNAVAILABLE,
        error instanceof Error ? error.message : "Provider discovery failed.",
        "provider.prepare",
        "UNAVAILABLE",
      ),
    );
    state.reasonCodes.push(RESEARCH_REASON_CODES.PROVIDER_DISCOVERY_UNAVAILABLE);
    return runResult({
      ...base,
      status: RESEARCH_RUN_STATUSES.DEGRADED,
      stage: RESEARCH_RUN_STAGES.FAILED,
    });
  }

  state.providerWarnings.push(...preparation.warnings);
  state.providerFailures.push(...preparation.failures);
  if (!preparation.ok) {
    state.reasonCodes.push(RESEARCH_REASON_CODES.PROVIDER_DISCOVERY_UNAVAILABLE);
    return runResult({
      ...base,
      status: RESEARCH_RUN_STATUSES.DEGRADED,
      stage: RESEARCH_RUN_STAGES.FAILED,
    });
  }

  let marketContext: ResearchRun["marketContext"];
  try {
    marketContext = await input.provider.marketContext();
  } catch (error) {
    marketContext = null;
    const failure = errorIssue(
      RESEARCH_REASON_CODES.MARKET_CONTEXT_UNAVAILABLE,
      error instanceof Error ? error.message : "Market context research failed.",
      "market_context",
      "UNAVAILABLE",
    );
    state.providerFailures.push(failure);
    state.reasonCodes.push(RESEARCH_REASON_CODES.MARKET_CONTEXT_UNAVAILABLE);
  }
  if (marketContext !== null) {
    state.providerWarnings.push(...marketContext.warnings);
    if (
      marketContext.status !== "SUCCESS" &&
      marketContext.status !== "PARTIAL"
    ) {
      state.providerFailures.push(
        errorIssue(
          RESEARCH_REASON_CODES.MARKET_CONTEXT_UNAVAILABLE,
          "Market context is unavailable; candidate evidence remains authoritative.",
          marketContext.provenance.tool,
          marketContext.status,
        ),
      );
      addUnique(state.reasonCodes, [RESEARCH_REASON_CODES.MARKET_CONTEXT_UNAVAILABLE]);
    }
  }

  let candidateDiscovery: ResearchRun["candidateDiscovery"];
  try {
    candidateDiscovery = await input.provider.discoverCandidates(
      MAX_RESEARCH_CANDIDATES,
    );
  } catch (error) {
    candidateDiscovery = null;
    state.providerFailures.push(
      errorIssue(
        RESEARCH_REASON_CODES.CANDIDATE_SCAN_UNAVAILABLE,
        error instanceof Error ? error.message : "Candidate scan failed.",
        "candidate_discovery",
        "UNAVAILABLE",
      ),
    );
    state.reasonCodes.push(RESEARCH_REASON_CODES.CANDIDATE_SCAN_UNAVAILABLE);
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      status: RESEARCH_RUN_STATUSES.DEGRADED,
      stage: RESEARCH_RUN_STAGES.FAILED,
    });
  }

  state.providerWarnings.push(...candidateDiscovery.warnings);
  state.providerFailures.push(...candidateDiscovery.failures);
  const scanUnavailable =
    candidateDiscovery.status !== "SUCCESS" &&
    candidateDiscovery.status !== "PARTIAL";
  if (scanUnavailable) {
    state.reasonCodes.push(RESEARCH_REASON_CODES.CANDIDATE_SCAN_UNAVAILABLE);
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      status: RESEARCH_RUN_STATUSES.DEGRADED,
      stage: RESEARCH_RUN_STAGES.FAILED,
    });
  }

  const validCandidates = candidateDiscovery.candidates.filter((candidate) => {
    const valid = /^[A-Za-z0-9._-]{1,32}$/.test(candidate.asset);
    if (!valid) {
      state.providerWarnings.push(
        errorIssue(
          RESEARCH_REASON_CODES.INVALID_CANDIDATE_ASSET,
          `Candidate asset "${candidate.asset}" was rejected by the research boundary.`,
          "candidate_discovery",
          candidateDiscovery.status,
        ),
      );
    }
    return valid;
  });
  const uniqueCandidates = validCandidates.filter(
    (candidate, index, candidates) =>
      candidates.findIndex((entry) => entry.asset === candidate.asset) === index,
  );
  if (candidateDiscovery.candidates.length > MAX_RESEARCH_CANDIDATES) {
    state.reasonCodes.push(RESEARCH_REASON_CODES.CANDIDATE_LIMIT_REACHED);
  }
  const candidatesToResearch = uniqueCandidates.slice(0, MAX_RESEARCH_CANDIDATES);

  if (candidatesToResearch.length === 0) {
    state.reasonCodes.push(RESEARCH_REASON_CODES.NO_DIRECTIONAL_CANDIDATE);
    const degraded = candidateDiscovery.failures.length > 0;
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      status: degraded
        ? RESEARCH_RUN_STATUSES.DEGRADED
        : RESEARCH_RUN_STATUSES.ABSTAINED,
      stage: RESEARCH_RUN_STAGES.ABSTAINED,
    });
  }

  const candidates: ResearchCandidateRun[] = [];
  for (const descriptor of candidatesToResearch) {
    let evidence;
    try {
      evidence = await input.provider.researchCandidate(descriptor.asset);
    } catch (error) {
      const failure = errorIssue(
        RESEARCH_REASON_CODES.CANDIDATE_RESEARCH_UNAVAILABLE,
        error instanceof Error ? error.message : "Candidate research failed.",
        `candidate:${descriptor.asset}`,
        "UNAVAILABLE",
      );
      state.providerFailures.push(failure);
      evidence = {
        asset: descriptor.asset,
        snapshot: unknownEvidence(descriptor.asset, input.provider),
        warnings: [],
        failures: [failure],
      };
    }

    state.providerWarnings.push(...evidence.warnings);
    state.providerFailures.push(...evidence.failures);
    const dm1 = evaluateCandidate({
      asset: descriptor.asset,
      evidence: evidence.snapshot.dm1,
    });
    candidates.push({
      asset: descriptor.asset,
      providerRank: descriptor.providerRank,
      evidence: evidence.snapshot,
      dm1,
      providerWarnings: evidence.warnings,
      providerFailures: evidence.failures,
    });
  }

  const evaluations = candidates.map((candidate) => candidate.dm1);
  const selection = selectAutonomousCandidate(evaluations);
  addUnique(state.reasonCodes, [
    ...selection.reasonCodes,
    ...selection.warningCodes,
  ]);
  if (selection.selected === null) {
    if (state.providerFailures.length > 0) {
      addUnique(state.reasonCodes, [RESEARCH_REASON_CODES.CANDIDATE_RESEARCH_UNAVAILABLE]);
    }
    if (selection.reasonCodes.includes("INSUFFICIENT_DIRECTIONAL_EVIDENCE")) {
      addUnique(state.reasonCodes, [RESEARCH_REASON_CODES.INSUFFICIENT_EVIDENCE]);
    }
    if (selection.reasonCodes.includes("NO_CLEAR_RELATIVE_WINNER")) {
      addUnique(state.reasonCodes, [RESEARCH_REASON_CODES.NO_CLEAR_RELATIVE_WINNER]);
    }
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      status: state.providerFailures.length > 0
        ? RESEARCH_RUN_STATUSES.DEGRADED
        : RESEARCH_RUN_STATUSES.ABSTAINED,
      stage: RESEARCH_RUN_STAGES.ABSTAINED,
    });
  }

  const selectedCandidate = selection.selected;
  if (
    selectedCandidate.decision !== "LONG" &&
    selectedCandidate.decision !== "SHORT"
  ) {
    state.reasonCodes.push(RESEARCH_REASON_CODES.INSUFFICIENT_EVIDENCE);
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      selectedAsset: selectedCandidate.asset,
      status: RESEARCH_RUN_STATUSES.ABSTAINED,
      stage: RESEARCH_RUN_STAGES.ABSTAINED,
    });
  }
  const selectedResearchCandidate = candidates.find(
    (candidate) => candidate.asset === selectedCandidate.asset,
  );
  if (selectedResearchCandidate === undefined) {
    state.reasonCodes.push(RESEARCH_REASON_CODES.CANDIDATE_RESEARCH_UNAVAILABLE);
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      selectedAsset: selectedCandidate.asset,
      marketDecision: selectedCandidate.decision,
      status: RESEARCH_RUN_STATUSES.DEGRADED,
      stage: RESEARCH_RUN_STAGES.FAILED,
    });
  }
  if (
    selectedResearchCandidate.providerFailures.length > 0 ||
    (selectedResearchCandidate.evidence.providerStatus !== "SUCCESS" &&
      selectedResearchCandidate.evidence.providerStatus !== "PARTIAL")
  ) {
    state.reasonCodes.push(RESEARCH_REASON_CODES.CANDIDATE_RESEARCH_UNAVAILABLE);
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      selectedAsset: selectedCandidate.asset,
      marketDecision: selectedCandidate.decision,
      finalDecision: "ABSTAIN",
      status: RESEARCH_RUN_STATUSES.DEGRADED,
      stage: RESEARCH_RUN_STAGES.FAILED,
    });
  }

  const preflightResult = evaluatePreflight({
    marketResult: selectedCandidate,
    evidence: selectedResearchCandidate.evidence.dm1,
    playbookVersion: input.playbookVersion,
    memorySnapshot: input.memorySnapshot ?? null,
  });
  if (!preflightResult.ok) {
    const failure = preflightFailure(preflightResult);
    state.reasonCodes.push(RESEARCH_REASON_CODES.PREFLIGHT_REJECTED);
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      selectedAsset: selectedCandidate.asset,
      marketDecision: selectedCandidate.decision,
      finalDecision: "ABSTAIN",
      preflightFailure: failure,
      status: RESEARCH_RUN_STATUSES.ABSTAINED,
      stage: RESEARCH_RUN_STAGES.ABSTAINED,
    });
  }

  const preflight = preflightResult;
  if (preflight.status === "WAIT") {
    state.reasonCodes.push(RESEARCH_REASON_CODES.PREFLIGHT_WAIT);
  } else if (preflight.status === "BLOCK") {
    state.reasonCodes.push(RESEARCH_REASON_CODES.PREFLIGHT_BLOCK);
  }
  if (preflight.status === "WAIT" || preflight.status === "BLOCK") {
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      selectedAsset: selectedCandidate.asset,
      marketDecision: selectedCandidate.decision,
      finalDecision: preflight.effectiveDecision,
      preflight,
      status: RESEARCH_RUN_STATUSES.ABSTAINED,
      stage: RESEARCH_RUN_STAGES.ABSTAINED,
    });
  }

  const killSwitchResult = runKillSwitch(
    runId,
    selectedCandidate,
    selectedResearchCandidate.evidence,
    evaluations,
  );
  if (killSwitchResult.aggregate.verdict === "VETO") {
    state.reasonCodes.push(RESEARCH_REASON_CODES.KILLSWITCH_VETO);
  } else if (killSwitchResult.aggregate.verdict === "UNKNOWN") {
    state.reasonCodes.push(RESEARCH_REASON_CODES.KILLSWITCH_UNKNOWN);
  }
  if (
    killSwitchResult.aggregate.verdict === "VETO" ||
    killSwitchResult.aggregate.verdict === "UNKNOWN"
  ) {
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      selectedAsset: selectedCandidate.asset,
      marketDecision: selectedCandidate.decision,
      finalDecision: "ABSTAIN",
      preflight,
      killSwitch: killSwitchResult.aggregate,
      killSwitchValidation: killSwitchResult.validation,
      status: RESEARCH_RUN_STATUSES.ABSTAINED,
      stage: RESEARCH_RUN_STAGES.ABSTAINED,
    });
  }

  const proposal: ResearchDecisionProposal = {
    thesisId: `${runId}-thesis`,
    versionId: `${runId}-thesis-v1`,
    evidenceSnapshotId: `${runId}-evidence`,
    asset: selectedCandidate.asset,
    decision: selectedCandidate.decision,
    eligible: true,
  };

  if (!autoCommitPractice) {
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      selectedAsset: selectedCandidate.asset,
      marketDecision: selectedCandidate.decision,
      finalDecision: selectedCandidate.decision,
      preflight,
      killSwitch: killSwitchResult.aggregate,
      killSwitchValidation: killSwitchResult.validation,
      proposal,
      status: RESEARCH_RUN_STATUSES.PROPOSED,
      stage: RESEARCH_RUN_STAGES.PROVISIONAL,
    });
  }

  if (!isPositiveFiniteNumber(input.practiceEntryPrice)) {
    state.reasonCodes.push(RESEARCH_REASON_CODES.PRACTICE_COMMIT_REJECTED);
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      selectedAsset: selectedCandidate.asset,
      marketDecision: selectedCandidate.decision,
      finalDecision: selectedCandidate.decision,
      preflight,
      killSwitch: killSwitchResult.aggregate,
      killSwitchValidation: killSwitchResult.validation,
      proposal: { ...proposal, eligible: false },
      status: RESEARCH_RUN_STATUSES.ABSTAINED,
      stage: RESEARCH_RUN_STAGES.ABSTAINED,
    });
  }

  const created = createThesis({
    thesisId: proposal.thesisId,
    versionId: proposal.versionId,
    createdAt: startedAt,
    asset: selectedCandidate.asset,
    evidenceSnapshotId: proposal.evidenceSnapshotId,
    decision: selectedCandidate,
    killSwitch: killSwitchResult.aggregate,
    killSwitchRunId: `${runId}-killswitch`,
  });
  if (!created.ok) {
    state.reasonCodes.push(RESEARCH_REASON_CODES.THESIS_COMMIT_REJECTED);
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      selectedAsset: selectedCandidate.asset,
      marketDecision: selectedCandidate.decision,
      finalDecision: selectedCandidate.decision,
      preflight,
      killSwitch: killSwitchResult.aggregate,
      killSwitchValidation: killSwitchResult.validation,
      proposal: { ...proposal, eligible: false },
      status: RESEARCH_RUN_STATUSES.ABSTAINED,
      stage: RESEARCH_RUN_STAGES.ABSTAINED,
    });
  }

  const invalidationRules: readonly InvalidationRule[] =
    buildDM1InvalidationRules(selectedCandidate.decision);
  const receiptResult = buildThesisReceipt({
    thesis: created.thesis,
    version: created.version,
    receiptId: `${runId}-receipt-v1`,
    normalizerVersion: RESEARCH_NORMALIZER_VERSION,
    evidenceItems: selectedResearchCandidate.evidence.evidenceItems,
    candidateEvaluations: selection.candidates,
    killSwitch: killSwitchResult.aggregate,
    killSwitchRunId: `${runId}-killswitch`,
    invalidationRules,
  });
  if (!receiptResult.ok) {
    state.reasonCodes.push(RESEARCH_REASON_CODES.RECEIPT_REJECTED);
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      selectedAsset: selectedCandidate.asset,
      marketDecision: selectedCandidate.decision,
      finalDecision: selectedCandidate.decision,
      preflight,
      killSwitch: killSwitchResult.aggregate,
      killSwitchValidation: killSwitchResult.validation,
      proposal: { ...proposal, eligible: false },
      status: RESEARCH_RUN_STATUSES.ABSTAINED,
      stage: RESEARCH_RUN_STAGES.ABSTAINED,
    });
  }

  const practice = practiceResult(
    runId,
    startedAt,
    created.thesis,
    created.version,
    input.practiceEntryPrice,
    input.practiceCurrentPrice,
  );
  if (practice === null) {
    state.reasonCodes.push(RESEARCH_REASON_CODES.PRACTICE_COMMIT_REJECTED);
    return runResult({
      ...base,
      marketContext,
      candidateDiscovery,
      candidates,
      selection,
      selectedAsset: selectedCandidate.asset,
      marketDecision: selectedCandidate.decision,
      finalDecision: selectedCandidate.decision,
      preflight,
      killSwitch: killSwitchResult.aggregate,
      killSwitchValidation: killSwitchResult.validation,
      proposal: { ...proposal, eligible: false },
      status: RESEARCH_RUN_STATUSES.ABSTAINED,
      stage: RESEARCH_RUN_STAGES.ABSTAINED,
    });
  }

  const commit: ResearchCommitResult = {
    thesis: created.thesis,
    version: created.version,
    receipt: receiptResult.receipt,
    practice,
  };
  return runResult({
    ...base,
    marketContext,
    candidateDiscovery,
    candidates,
    selection,
    selectedAsset: selectedCandidate.asset,
    marketDecision: selectedCandidate.decision,
    finalDecision: selectedCandidate.decision,
    preflight,
    killSwitch: killSwitchResult.aggregate,
    killSwitchValidation: killSwitchResult.validation,
    proposal,
    commit,
    practice,
    status: RESEARCH_RUN_STATUSES.COMMITTED,
    stage: RESEARCH_RUN_STAGES.COMMITTED,
  });
}