import {
  createMemorySnapshot,
  rankComparableCases,
  summarizeMemorySnapshotV1,
  toCaseSignature,
  type CaseSignature,
  type DecisionCase,
  type MemorySnapshot,
  type MemorySummaryV1,
} from "../memory";
import {
  createInitialVersion,
  PLAYBOOK_ACTORS,
  type Playbook,
  type PlaybookRule,
  type PlaybookVersion,
} from "../playbook";
import {
  evaluatePreflight,
  type DecisionIntegrationSuccess,
} from "../decision";
import type { DirectionalEvidenceDimension, DirectionalEvidenceState } from "../evidence/types";
import type { CandidateEvaluation, DM1EvidenceSnapshot } from "../strategy/dm1/types";

export const DEMO_PLAYBOOK_PROVENANCE = "DEMO PLAYBOOK" as const;
export const DEMO_SESSION_PLAYBOOK_PROVENANCE = "DEMO SESSION PLAYBOOK" as const;
export const DEMO_MEMORY_PROVENANCE = "DETERMINISTIC DECISION MEMORY" as const;

export type DemoPlaybookProvenance =
  | typeof DEMO_PLAYBOOK_PROVENANCE
  | typeof DEMO_SESSION_PLAYBOOK_PROVENANCE;

export const DEMO_PLAYBOOK_RULES: readonly PlaybookRule[] = [
  {
    id: "wait-on-abstain",
    effect: "WAIT",
    conditions: [
      { field: "decision", operator: "EQUALS", value: "ABSTAIN" },
    ],
  },
  {
    id: "caution-on-high-similarity-memory",
    effect: "CAUTION",
    conditions: [
      {
        field: "memory.highSimilarityCaseCount",
        operator: "GTE",
        value: 1,
      },
    ],
  },
  {
    id: "block-on-safety-veto",
    effect: "BLOCK",
    conditions: [{ field: "safety", operator: "EQUALS", value: "VETO" }],
  },
];

export interface DemoGovernanceState {
  readonly playbookProvenance: DemoPlaybookProvenance;
  readonly memoryProvenance: typeof DEMO_MEMORY_PROVENANCE;
  readonly playbook: Playbook;
  readonly playbookVersion: PlaybookVersion;
  readonly historicalCases: readonly DecisionCase[];
  readonly targetSignature: CaseSignature;
  readonly memorySnapshot: MemorySnapshot;
  readonly memorySummary: MemorySummaryV1;
  readonly preflight: DecisionIntegrationSuccess;
}

interface SnapshotOverrides {
  readonly evidence?: Partial<
    Record<DirectionalEvidenceDimension, DirectionalEvidenceState>
  >;
  readonly risk?: DM1EvidenceSnapshot["risk"];
  readonly safety?: DM1EvidenceSnapshot["safety"];
  readonly regimeFit?: DM1EvidenceSnapshot["regimeFit"];
}

function requireSuccess<T extends { ok: boolean }>(
  result: T,
): Extract<T, { ok: true }> {
  if (!result.ok) {
    throw new Error("Demo governance construction failed.");
  }
  return result as Extract<T, { ok: true }>;
}

function snapshotWith(
  target: DM1EvidenceSnapshot,
  overrides: SnapshotOverrides,
): DM1EvidenceSnapshot {
  return {
    evidence: { ...target.evidence, ...overrides.evidence },
    risk: overrides.risk ?? target.risk,
    safety: overrides.safety ?? target.safety,
    regimeFit: overrides.regimeFit ?? target.regimeFit,
  };
}

function canonicalState(
  state: DirectionalEvidenceState | undefined,
): DirectionalEvidenceState {
  return state ?? "UNKNOWN";
}

function oppositeState(state: DirectionalEvidenceState): DirectionalEvidenceState {
  switch (state) {
    case "STRONGLY_SUPPORTIVE":
      return "STRONGLY_OPPOSING";
    case "SUPPORTIVE":
      return "OPPOSING";
    case "OPPOSING":
      return "SUPPORTIVE";
    case "STRONGLY_OPPOSING":
      return "STRONGLY_SUPPORTIVE";
    case "NEUTRAL":
      return "STRONGLY_OPPOSING";
    case "UNKNOWN":
      return "UNKNOWN";
  }
}

function makeHistoricalCase(
  scenarioId: string,
  asset: string,
  snapshot: DM1EvidenceSnapshot,
  decision: DecisionCase["decision"],
  caseLabel: string,
  outcome: NonNullable<DecisionCase["outcome"]>,
  index: number,
): DecisionCase {
  const id = `${scenarioId}-history-${caseLabel}`;
  return {
    id,
    thesisId: `${id}-thesis`,
    versionId: `${id}-version`,
    evidenceSnapshotId: `${id}-evidence`,
    strategyId: "dm-1",
    strategyVersion: "1.0.0",
    asset,
    decision,
    signature: toCaseSignature(snapshot),
    committedAt: `2026-08-${String(index).padStart(2, "0")}T12:00:00.000Z`,
    observedAt: `2026-08-${String(index).padStart(2, "0")}T11:55:00.000Z`,
    outcome,
  };
}

export function createDemoHistoricalCases(
  scenarioId: string,
  asset: string,
  target: DM1EvidenceSnapshot,
): readonly DecisionCase[] {
  const moderate = snapshotWith(target, {
    evidence: {
      DIRECTIONAL_MOMENTUM: "SUPPORTIVE",
      TECHNICAL_CONFLUENCE:
        canonicalState(target.evidence.TECHNICAL_CONFLUENCE) === "UNKNOWN"
          ? "UNKNOWN"
          : "NEUTRAL",
      MARKET_ALIGNMENT:
        canonicalState(target.evidence.MARKET_ALIGNMENT) === "UNKNOWN"
          ? "UNKNOWN"
          : "SUPPORTIVE",
    },
    risk: target.risk === "UNKNOWN" ? "UNKNOWN" : "ELEVATED",
  });
  const weaker = snapshotWith(target, {
    evidence: {
      DIRECTIONAL_MOMENTUM: oppositeState(
        canonicalState(target.evidence.DIRECTIONAL_MOMENTUM),
      ),
      TECHNICAL_CONFLUENCE: oppositeState(
        canonicalState(target.evidence.TECHNICAL_CONFLUENCE),
      ),
      RELATIVE_OPPORTUNITY: oppositeState(
        canonicalState(target.evidence.RELATIVE_OPPORTUNITY),
      ),
      MARKET_ALIGNMENT: oppositeState(
        canonicalState(target.evidence.MARKET_ALIGNMENT),
      ),
      SENTIMENT_DERIVATIVES: oppositeState(
        canonicalState(target.evidence.SENTIMENT_DERIVATIVES),
      ),
    },
    risk: target.risk === "UNKNOWN" ? "UNKNOWN" : "EXTREME",
    safety: target.safety === "UNKNOWN" ? "UNKNOWN" : "VETO",
    regimeFit: target.regimeFit === "UNKNOWN" ? "UNKNOWN" : "BROKEN",
  });

  return [
    makeHistoricalCase(
      scenarioId,
      asset,
      target,
      "LONG",
      "strong",
      { status: "POSITIVE", resolvedAt: "2026-08-10T12:00:00.000Z", observationId: "obs-strong" },
      10,
    ),
    makeHistoricalCase(
      scenarioId,
      asset,
      moderate,
      "SHORT",
      "moderate",
      { status: "NEGATIVE", resolvedAt: "2026-08-11T12:00:00.000Z", observationId: "obs-moderate" },
      11,
    ),
    makeHistoricalCase(
      scenarioId,
      asset,
      weaker,
      "ABSTAIN",
      "different",
      { status: "INVALIDATED", resolvedAt: "2026-08-12T12:00:00.000Z", observationId: "obs-different" },
      12,
    ),
    makeHistoricalCase(
      scenarioId,
      asset,
      snapshotWith(target, {
        evidence: {
          DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING",
          TECHNICAL_CONFLUENCE: "UNKNOWN",
          RELATIVE_OPPORTUNITY: "UNKNOWN",
          MARKET_ALIGNMENT: "UNKNOWN",
          SENTIMENT_DERIVATIVES: "UNKNOWN",
        },
        risk: "UNKNOWN",
        safety: "UNKNOWN",
        regimeFit: "UNKNOWN",
      }),
      "SHORT",
      "directional-pattern-negative",
      { status: "NEGATIVE", resolvedAt: "2026-08-13T12:00:00.000Z", observationId: "obs-directional-pattern-negative" },
      13,
    ),
    makeHistoricalCase(
      scenarioId,
      asset,
      snapshotWith(target, {
        evidence: {
          DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING",
          TECHNICAL_CONFLUENCE: "UNKNOWN",
          RELATIVE_OPPORTUNITY: "UNKNOWN",
          MARKET_ALIGNMENT: "UNKNOWN",
          SENTIMENT_DERIVATIVES: "UNKNOWN",
        },
        risk: "UNKNOWN",
        safety: "UNKNOWN",
        regimeFit: "UNKNOWN",
      }),
      "ABSTAIN",
      "directional-pattern-invalidated",
      { status: "INVALIDATED", resolvedAt: "2026-08-14T12:00:00.000Z", observationId: "obs-directional-pattern-invalidated" },
      14,
    ),
  ];
}

export function createDemoPlaybook(): {
  readonly playbook: Playbook;
  readonly version: PlaybookVersion;
} {
  return requireSuccess(
    createInitialVersion({
      playbookId: "demo-playbook-dm1",
      versionId: "demo-playbook-dm1-v1",
      strategyId: "dm-1",
      strategyVersion: "1.0.0",
      rules: DEMO_PLAYBOOK_RULES,
      createdAt: "2026-09-05T11:59:00.000Z",
      approvedAt: "2026-09-05T12:00:00.000Z",
      approvedBy: PLAYBOOK_ACTORS.HUMAN,
    }),
  );
}

export function buildDemoGovernance(input: {
  readonly scenarioId: string;
  readonly asset: string;
  readonly targetSnapshotId: string;
  readonly evidence: DM1EvidenceSnapshot;
  readonly marketResult: CandidateEvaluation;
}): DemoGovernanceState {
  const { playbook, version: playbookVersion } = createDemoPlaybook();
  const targetSignature = toCaseSignature(input.evidence);
  const historicalCases = createDemoHistoricalCases(
    input.scenarioId,
    input.asset,
    input.evidence,
  );
  const rankedCases = rankComparableCases(targetSignature, historicalCases);
  const memorySnapshot = createMemorySnapshot({
    snapshotId: `memory-${input.scenarioId}-${input.targetSnapshotId}`,
    targetCase: null,
    targetSignature,
    rankedCases,
    createdAt: "2026-09-05T12:01:00.000Z",
    metadata: {
      provenance: DEMO_MEMORY_PROVENANCE,
      scenarioId: input.scenarioId,
      asset: input.asset,
    },
  });
  const memorySummary = summarizeMemorySnapshotV1(memorySnapshot);
  const preflight = requireSuccess(
    evaluatePreflight({
      marketResult: input.marketResult,
      evidence: input.evidence,
      playbookVersion,
      memorySnapshot,
    }),
  );

  return {
    playbookProvenance: DEMO_PLAYBOOK_PROVENANCE,
    memoryProvenance: DEMO_MEMORY_PROVENANCE,
    playbook,
    playbookVersion,
    historicalCases,
    targetSignature,
    memorySnapshot,
    memorySummary,
    preflight,
  };
}

export function evaluateDemoGovernanceVersion(input: {
  readonly base: DemoGovernanceState;
  readonly marketResult: CandidateEvaluation;
  readonly evidence: DM1EvidenceSnapshot;
  readonly playbook: Playbook;
  readonly playbookVersion: PlaybookVersion;
  readonly playbookProvenance?: DemoPlaybookProvenance;
}): DemoGovernanceState {
  const preflight = requireSuccess(
    evaluatePreflight({
      marketResult: input.marketResult,
      evidence: input.evidence,
      playbookVersion: input.playbookVersion,
      memorySnapshot: input.base.memorySnapshot,
    }),
  );

  return {
    ...input.base,
    playbookProvenance:
      input.playbookProvenance ?? DEMO_SESSION_PLAYBOOK_PROVENANCE,
    playbook: input.playbook,
    playbookVersion: input.playbookVersion,
    preflight,
  };
}
