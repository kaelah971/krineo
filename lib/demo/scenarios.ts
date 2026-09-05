import type {
  DirectionalEvidenceDimension,
  DirectionalEvidenceState,
  EvidenceItem,
} from "../evidence/types";
import {
  buildStrategyDiff,
  type StrategyDiff,
} from "../thesis/diff";
import {
  buildDM1InvalidationRules,
  evaluateDM1Invalidation,
  type InvalidationEvaluation,
} from "../thesis/invalidation";
import { buildThesisReceipt } from "../thesis/receipt";
import {
  appendThesisVersion,
  createThesis,
} from "../thesis/build";
import type {
  Thesis,
  InvalidationRule,
  ThesisReceipt,
  ThesisVersion,
} from "../thesis/types";
import { evaluateCandidate } from "../strategy/dm1/decision";
import type {
  CandidateEvaluation,
  DM1EvidenceSnapshot,
} from "../strategy/dm1/types";
import { REASON_CODES, type ReasonCode } from "../strategy/dm1/reason-codes";
import {
  aggregateKillSwitchResults,
  validateKillSwitch,
} from "../killswitch/validator";
import type {
  KillSwitchAggregateResult,
  KillSwitchEvidenceItem,
  KillSwitchValidationResult,
} from "../killswitch/types";
import {
  calculatePracticePnl,
  closePracticePosition,
  createPracticeLedger,
  createPracticePortfolio,
  mapInvalidationOutcomeToPracticeAction,
  openPracticePosition,
  replacePracticePosition,
} from "../practice/ledger";
import type {
  PracticeLedger,
  PracticePnl,
  PracticePosition,
  PracticePositionAction,
} from "../practice/types";

export type DemoScenarioId = "directional" | "abstain" | "changed";

export interface DemoPracticeState {
  readonly ledger: PracticeLedger;
  readonly position: PracticePosition | null;
  readonly pnl: PracticePnl | null;
  readonly action: PracticePositionAction | null;
  readonly currentPrice: number;
}

export interface DemoScenario {
  readonly id: DemoScenarioId;
  readonly label: string;
  readonly eyebrow: string;
  readonly request: string;
  readonly description: string;
  readonly asset: string;
  readonly thesis: Thesis;
  readonly originalVersion: ThesisVersion;
  readonly currentVersion: ThesisVersion;
  readonly originalDecision: CandidateEvaluation;
  readonly currentDecision: CandidateEvaluation;
  readonly originalEvidence: readonly EvidenceItem[];
  readonly currentEvidence: readonly EvidenceItem[];
  readonly originalKillSwitch: KillSwitchAggregateResult;
  readonly currentKillSwitch: KillSwitchAggregateResult;
  readonly currentKillSwitchValidation: KillSwitchValidationResult;
  readonly receipt: ThesisReceipt;
  readonly strategyDiff: StrategyDiff | null;
  readonly invalidation: InvalidationEvaluation | null;
  readonly invalidationRules: readonly InvalidationRule[];
  readonly practice: DemoPracticeState;
}

const DIMENSIONS: readonly DirectionalEvidenceDimension[] = [
  "DIRECTIONAL_MOMENTUM",
  "TECHNICAL_CONFLUENCE",
  "RELATIVE_OPPORTUNITY",
  "MARKET_ALIGNMENT",
  "SENTIMENT_DERIVATIVES",
];

const DIMENSION_EXPLANATIONS: Record<DirectionalEvidenceDimension, string> = {
  DIRECTIONAL_MOMENTUM: "Trend persistence and directional follow-through.",
  TECHNICAL_CONFLUENCE: "Independent technical signals agree on direction.",
  RELATIVE_OPPORTUNITY: "The asset ranks above the comparison set.",
  MARKET_ALIGNMENT: "Broader market structure supports the direction.",
  SENTIMENT_DERIVATIVES: "Positioning and sentiment do not oppose the signal.",
};

const BASE_EVIDENCE: Record<DirectionalEvidenceDimension, DirectionalEvidenceState> = {
  DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
  TECHNICAL_CONFLUENCE: "STRONGLY_SUPPORTIVE",
  RELATIVE_OPPORTUNITY: "STRONGLY_SUPPORTIVE",
  MARKET_ALIGNMENT: "STRONGLY_SUPPORTIVE",
  SENTIMENT_DERIVATIVES: "STRONGLY_SUPPORTIVE",
};

function requireOk<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) {
    throw new Error("Demo fixture construction failed.");
  }
  return result as Extract<T, { ok: true }>;
}

function makeSnapshot(
  overrides: Partial<Record<DirectionalEvidenceDimension, DirectionalEvidenceState>> = {},
  policy: Partial<Pick<DM1EvidenceSnapshot, "risk" | "safety" | "regimeFit">> = {},
): DM1EvidenceSnapshot {
  return {
    evidence: { ...BASE_EVIDENCE, ...overrides },
    risk: policy.risk ?? "ACCEPTABLE",
    safety: policy.safety ?? "CLEAR",
    regimeFit: policy.regimeFit ?? "FIT",
  };
}

function reasonCodeFor(
  dimension: DirectionalEvidenceDimension,
  state: DirectionalEvidenceState,
): ReasonCode {
  if (state === "UNKNOWN" || state === "NEUTRAL") {
    return REASON_CODES.INSUFFICIENT_DIRECTIONAL_EVIDENCE;
  }

  switch (dimension) {
    case "DIRECTIONAL_MOMENTUM":
      return REASON_CODES.STRONG_DIRECTIONAL_MOMENTUM;
    case "TECHNICAL_CONFLUENCE":
      return REASON_CODES.TECHNICAL_CONFLUENCE_SUPPORTIVE;
    case "RELATIVE_OPPORTUNITY":
      return REASON_CODES.RELATIVE_OPPORTUNITY_WINNER;
    case "MARKET_ALIGNMENT":
      return REASON_CODES.MARKET_ALIGNMENT_SUPPORTIVE;
    case "SENTIMENT_DERIVATIVES":
      return REASON_CODES.MARKET_ALIGNMENT_SUPPORTIVE;
  }
}

function buildEvidenceItems(
  asset: string,
  snapshot: DM1EvidenceSnapshot,
  snapshotId: string,
  sourceSuffix: string,
): EvidenceItem[] {
  return DIMENSIONS.map((dimension) => {
    const state = snapshot.evidence[dimension] ?? "UNKNOWN";
    return {
      id: `${asset.toLowerCase()}-${dimension.toLowerCase()}`,
      dimension,
      state,
      source: `${asset.toLowerCase()}-${dimension.toLowerCase()}-${sourceSuffix}`,
      observedAt: "2026-09-05T12:00:00.000Z",
      reasonCode: reasonCodeFor(dimension, state),
      explanation: DIMENSION_EXPLANATIONS[dimension],
      rawReference: `fixture://${snapshotId}/${dimension}`,
    };
  });
}

function buildKillSwitchItems(
  evidence: readonly EvidenceItem[],
  snapshot: DM1EvidenceSnapshot,
): KillSwitchEvidenceItem[] {
  return [
    ...evidence.map((item) => ({
      id: item.id,
      kind: "DIRECTIONAL" as const,
      dimension: item.dimension,
      state: item.state,
      source: item.source,
      candidateAsset: "SOL",
    })),
    {
      id: "fixture-risk",
      kind: "RISK" as const,
      state: snapshot.risk,
      source: "fixture-risk-policy",
      candidateAsset: "SOL",
    },
    {
      id: "fixture-safety",
      kind: "SAFETY" as const,
      state: snapshot.safety,
      source: "fixture-safety-policy",
      candidateAsset: "SOL",
    },
    {
      id: "fixture-regime",
      kind: "REGIME_FIT" as const,
      state: snapshot.regimeFit,
      source: "fixture-regime-policy",
      candidateAsset: "SOL",
    },
  ];
}

function candidateSet(
  asset: string,
  targetSnapshot: DM1EvidenceSnapshot,
  alternateSnapshot: DM1EvidenceSnapshot,
): CandidateEvaluation[] {
  return [
    {
      ...evaluateCandidate({ asset, evidence: targetSnapshot }),
      selected: true,
    },
    {
      ...evaluateCandidate({ asset: "ETH", evidence: alternateSnapshot }),
      selected: false,
    },
    {
      ...evaluateCandidate({
        asset: "BTC",
        evidence: makeSnapshot({
          DIRECTIONAL_MOMENTUM: "NEUTRAL",
          TECHNICAL_CONFLUENCE: "NEUTRAL",
          RELATIVE_OPPORTUNITY: "NEUTRAL",
          MARKET_ALIGNMENT: "NEUTRAL",
          SENTIMENT_DERIVATIVES: "UNKNOWN",
        }),
      }),
      selected: false,
    },
  ];
}

function killSwitchFor(
  decision: CandidateEvaluation,
  snapshot: DM1EvidenceSnapshot,
  evidence: readonly EvidenceItem[],
  candidates: readonly CandidateEvaluation[],
): { aggregate: KillSwitchAggregateResult; validation: KillSwitchValidationResult } {
  const validation = validateKillSwitch({
    decision: { provisional: decision, final: null },
    evidence: { dm1: snapshot, items: buildKillSwitchItems(evidence, snapshot) },
    comparison: {
      available: true,
      selectedCandidateId: `candidate-${decision.asset.toLowerCase()}`,
      candidates: candidates.map((candidate) => ({
        id: `candidate-${candidate.asset.toLowerCase()}`,
        evaluation: candidate,
      })),
    },
    challenge: {
      id: "challenge-directional-contradiction",
      challengeType: "DIRECTION_CONTRADICTION",
      claim: "Can the directional record contradict the provisional thesis?",
      evidenceIds: [evidence[0].id],
      createdBy: "MODEL",
    },
  });

  return {
    validation,
    aggregate: aggregateKillSwitchResults([validation]),
  };
}

function makePractice(
  scenarioId: DemoScenarioId,
  thesis: Thesis,
  version: ThesisVersion,
  invalidation: InvalidationEvaluation | null,
): DemoPracticeState {
  const portfolio = requireOk(
    createPracticePortfolio({
      id: `practice-${scenarioId}`,
      createdAt: "2026-09-05T12:00:00.000Z",
    }),
  ).value;
  const emptyLedger = requireOk(createPracticeLedger(portfolio)).value;
  const currentPrice = scenarioId === "changed" ? 126 : 145;

  if (version.decision === "ABSTAIN") {
    return {
      ledger: emptyLedger,
      position: null,
      pnl: null,
      action: null,
      currentPrice,
    };
  }

  const opened = requireOk(
    openPracticePosition({
      portfolio,
      existingPositions: emptyLedger.positions,
      thesis,
      thesisVersion: version,
      positionId: `position-${scenarioId}`,
      entryPrice: 140,
      entryTime: "2026-09-05T12:02:00.000Z",
    }),
  ).value;
  const pnl = requireOk(calculatePracticePnl(opened, currentPrice)).value;
  const action = mapInvalidationOutcomeToPracticeAction(
    invalidation?.outcome ?? "MAINTAIN",
  );

  if (action.action === "CLOSE") {
    const closed = requireOk(
      closePracticePosition({
        position: opened,
        exitPrice: currentPrice,
        exitTime: "2026-09-05T12:08:00.000Z",
        closeReason:
          action.recommendedCloseReason ?? "THESIS_INVALIDATED",
      }),
    ).value;
    return {
      ledger: requireOk(
        replacePracticePosition({
          ledger: requireOk(
            createPracticeLedger(portfolio, [opened]),
          ).value,
          position: closed,
        }),
      ).value,
      position: closed,
      pnl,
      action,
      currentPrice,
    };
  }

  return {
    ledger: requireOk(
      createPracticeLedger(portfolio, [opened]),
    ).value,
    position: opened,
    pnl,
    action,
    currentPrice,
  };
}

interface ScenarioInputs {
  readonly id: DemoScenarioId;
  readonly label: string;
  readonly eyebrow: string;
  readonly request: string;
  readonly description: string;
  readonly originalSnapshot: DM1EvidenceSnapshot;
  readonly currentSnapshot: DM1EvidenceSnapshot;
  readonly originalSnapshotId: string;
  readonly currentSnapshotId: string;
  readonly originalSourceSuffix: string;
  readonly currentSourceSuffix: string;
  readonly alternateSnapshot: DM1EvidenceSnapshot;
}

function buildScenario(inputs: ScenarioInputs): DemoScenario {
  const asset = "SOL";
  const originalEvidence = buildEvidenceItems(
    asset,
    inputs.originalSnapshot,
    inputs.originalSnapshotId,
    inputs.originalSourceSuffix,
  );
  const currentEvidence = buildEvidenceItems(
    asset,
    inputs.currentSnapshot,
    inputs.currentSnapshotId,
    inputs.currentSourceSuffix,
  );
  const originalCandidates = candidateSet(
    asset,
    inputs.originalSnapshot,
    inputs.alternateSnapshot,
  );
  const currentCandidates = candidateSet(
    asset,
    inputs.currentSnapshot,
    inputs.alternateSnapshot,
  );
  const originalDecision = originalCandidates[0];
  const currentDecision = currentCandidates[0];
  const originalKillSwitch = killSwitchFor(
    originalDecision,
    inputs.originalSnapshot,
    originalEvidence,
    originalCandidates,
  );
  const currentKillSwitch = killSwitchFor(
    currentDecision,
    inputs.currentSnapshot,
    currentEvidence,
    currentCandidates,
  );
  const originalRules =
    originalDecision.decision === "ABSTAIN"
      ? []
      : buildDM1InvalidationRules(originalDecision.decision);
  const currentRules =
    currentDecision.decision === "ABSTAIN"
      ? []
      : buildDM1InvalidationRules(currentDecision.decision);
  const thesisId = `thesis-${inputs.id}`;
  const created = requireOk(
    createThesis({
      thesisId,
      versionId: `${thesisId}-v1`,
      createdAt: "2026-09-05T12:00:00.000Z",
      asset,
      evidenceSnapshotId: inputs.originalSnapshotId,
      decision: originalDecision,
      ...(originalDecision.decision === "ABSTAIN"
        ? {}
        : {
            killSwitch: originalKillSwitch.aggregate,
            killSwitchRunId: `${inputs.id}-killswitch-v1`,
          }),
    }),
  );
  const originalVersion = created.version;
  const appended =
    inputs.id === "abstain"
      ? { thesis: created.thesis, version: created.version }
      : requireOk(
          appendThesisVersion({
            thesisId,
            versionId: `${thesisId}-v2`,
            createdAt: "2026-09-05T12:08:00.000Z",
            asset,
            evidenceSnapshotId: inputs.currentSnapshotId,
            decision: currentDecision,
            thesis: created.thesis,
            versions: [created.version],
            killSwitch: currentKillSwitch.aggregate,
            killSwitchRunId: `${inputs.id}-killswitch-v2`,
          }),
        );
  const thesis = appended.thesis;
  const currentVersion = appended.version;
  const strategyDiff =
    inputs.id === "abstain"
      ? null
      : requireOk(
          buildStrategyDiff({
            before: {
              version: originalVersion,
              normalizerVersion: "fixture-normalizer-1",
              evidenceItems: originalEvidence,
              candidateEvaluations: originalCandidates,
              invalidationRules: originalRules,
            },
            after: {
              version: currentVersion,
              normalizerVersion: "fixture-normalizer-1",
              evidenceItems: currentEvidence,
              candidateEvaluations: currentCandidates,
              invalidationRules: currentRules,
            },
          }),
        ).diff;
  const invalidation =
    strategyDiff === null || originalDecision.decision === "ABSTAIN"
      ? null
      : requireOk(
          evaluateDM1Invalidation({
            originalVersion,
            invalidationRules: originalRules,
            strategyDiff,
            latestDecision: currentDecision,
            currentThesis: {
              id: thesis.id,
              asset: thesis.asset,
              status: thesis.status,
            },
          }),
        ).evaluation;
  const receipt = requireOk(
    buildThesisReceipt({
      thesis,
      version: currentVersion,
      receiptId: `${thesisId}-receipt-v${currentVersion.versionNumber}`,
      normalizerVersion: "fixture-normalizer-1",
      evidenceItems: currentEvidence,
      candidateEvaluations: currentCandidates,
      invalidationRules: currentRules,
      ...(currentDecision.decision === "ABSTAIN"
        ? {}
        : {
            killSwitch: currentKillSwitch.aggregate,
            killSwitchRunId: `${inputs.id}-killswitch-v${currentVersion.versionNumber}`,
          }),
    }),
  ).receipt;

  return {
    id: inputs.id,
    label: inputs.label,
    eyebrow: inputs.eyebrow,
    request: inputs.request,
    description: inputs.description,
    asset,
    thesis,
    originalVersion,
    currentVersion,
    originalDecision,
    currentDecision,
    originalEvidence,
    currentEvidence,
    originalKillSwitch: originalKillSwitch.aggregate,
    currentKillSwitch: currentKillSwitch.aggregate,
    currentKillSwitchValidation: currentKillSwitch.validation,
    receipt,
    strategyDiff,
    invalidation,
    invalidationRules: currentRules,
    practice: makePractice(inputs.id, thesis, originalVersion, invalidation),
  };
}

export function getDemoScenarios(): readonly DemoScenario[] {
  return [
    buildScenario({
      id: "directional",
      label: "Directional thesis",
      eyebrow: "Review a live directional question",
      request: "Is SOL still the clearest long opportunity in the current regime?",
      description:
        "A supportive research tape clears DM-1, survives challenge, and keeps the simulated position open.",
      originalSnapshot: makeSnapshot(),
      currentSnapshot: makeSnapshot({ TECHNICAL_CONFLUENCE: "SUPPORTIVE" }),
      originalSnapshotId: "evidence-snapshot-1",
      currentSnapshotId: "evidence-snapshot-2",
      originalSourceSuffix: "baseline",
      currentSourceSuffix: "refresh",
      alternateSnapshot: makeSnapshot({
        DIRECTIONAL_MOMENTUM: "SUPPORTIVE",
        TECHNICAL_CONFLUENCE: "SUPPORTIVE",
        RELATIVE_OPPORTUNITY: "SUPPORTIVE",
        MARKET_ALIGNMENT: "SUPPORTIVE",
        SENTIMENT_DERIVATIVES: "SUPPORTIVE",
      }),
    }),
    buildScenario({
      id: "abstain",
      label: "Intentional abstain",
      eyebrow: "Preserve uncertainty",
      request: "Should the agent commit to a direction while the evidence remains mixed?",
      description:
        "Coverage is neutral rather than decisive, so the system records the unknowns instead of forcing a position.",
      originalSnapshot: makeSnapshot({
        DIRECTIONAL_MOMENTUM: "NEUTRAL",
        TECHNICAL_CONFLUENCE: "NEUTRAL",
        RELATIVE_OPPORTUNITY: "NEUTRAL",
        MARKET_ALIGNMENT: "NEUTRAL",
        SENTIMENT_DERIVATIVES: "UNKNOWN",
      }),
      currentSnapshot: makeSnapshot({
        DIRECTIONAL_MOMENTUM: "NEUTRAL",
        TECHNICAL_CONFLUENCE: "NEUTRAL",
        RELATIVE_OPPORTUNITY: "NEUTRAL",
        MARKET_ALIGNMENT: "NEUTRAL",
        SENTIMENT_DERIVATIVES: "UNKNOWN",
      }),
      originalSnapshotId: "evidence-snapshot-abstain",
      currentSnapshotId: "evidence-snapshot-abstain",
      originalSourceSuffix: "mixed",
      currentSourceSuffix: "mixed",
      alternateSnapshot: makeSnapshot({
        DIRECTIONAL_MOMENTUM: "SUPPORTIVE",
        TECHNICAL_CONFLUENCE: "SUPPORTIVE",
        RELATIVE_OPPORTUNITY: "NEUTRAL",
        MARKET_ALIGNMENT: "SUPPORTIVE",
        SENTIMENT_DERIVATIVES: "UNKNOWN",
      }),
    }),
    buildScenario({
      id: "changed",
      label: "Thesis changed",
      eyebrow: "Close the loop on new evidence",
      request: "The evidence reversed. What changed, and what should happen to the practice position?",
      description:
        "A previously committed long thesis is challenged by a directional reversal; the precommitted rule closes the simulated position.",
      originalSnapshot: makeSnapshot(),
      currentSnapshot: makeSnapshot({
        DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING",
        TECHNICAL_CONFLUENCE: "STRONGLY_OPPOSING",
        RELATIVE_OPPORTUNITY: "STRONGLY_OPPOSING",
        MARKET_ALIGNMENT: "STRONGLY_OPPOSING",
        SENTIMENT_DERIVATIVES: "STRONGLY_OPPOSING",
      }),
      originalSnapshotId: "evidence-snapshot-1",
      currentSnapshotId: "evidence-snapshot-3",
      originalSourceSuffix: "baseline",
      currentSourceSuffix: "reversal",
      alternateSnapshot: makeSnapshot({
        DIRECTIONAL_MOMENTUM: "OPPOSING",
        TECHNICAL_CONFLUENCE: "OPPOSING",
        RELATIVE_OPPORTUNITY: "OPPOSING",
        MARKET_ALIGNMENT: "OPPOSING",
        SENTIMENT_DERIVATIVES: "OPPOSING",
      }),
    }),
  ];
}
