import type { DM1EvidenceSnapshot } from "../../lib/strategy/dm1/types";
import type {
  CaseSignature,
  DecisionCase,
} from "../../lib/memory/types";

export function makeEvidenceSnapshot(
  overrides?: Partial<DM1EvidenceSnapshot>,
): DM1EvidenceSnapshot {
  return {
    evidence: {
      DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
      TECHNICAL_CONFLUENCE: "SUPPORTIVE",
      RELATIVE_OPPORTUNITY: "SUPPORTIVE",
      MARKET_ALIGNMENT: "SUPPORTIVE",
      SENTIMENT_DERIVATIVES: "SUPPORTIVE",
      ...(overrides?.evidence ?? {}),
    },
    risk: overrides?.risk ?? "ACCEPTABLE",
    safety: overrides?.safety ?? "CLEAR",
    regimeFit: overrides?.regimeFit ?? "FIT",
  };
}

export function makeCaseSignature(
  overrides?: Partial<CaseSignature>,
): CaseSignature {
  return {
    evidence: {
      DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
      TECHNICAL_CONFLUENCE: "SUPPORTIVE",
      RELATIVE_OPPORTUNITY: "SUPPORTIVE",
      MARKET_ALIGNMENT: "SUPPORTIVE",
      SENTIMENT_DERIVATIVES: "SUPPORTIVE",
      ...(overrides?.evidence ?? {}),
    },
    risk: overrides?.risk ?? "ACCEPTABLE",
    safety: overrides?.safety ?? "CLEAR",
    regimeFit: overrides?.regimeFit ?? "FIT",
  };
}

export function makeDecisionCase(
  overrides?: Partial<DecisionCase>,
): DecisionCase {
  const id = overrides?.id ?? "case-fixture-1";
  return {
    id,
    thesisId: overrides?.thesisId ?? `thesis-for-${id}`,
    versionId: overrides?.versionId ?? `version-for-${id}`,
    evidenceSnapshotId: overrides?.evidenceSnapshotId ?? `snapshot-for-${id}`,
    strategyId: overrides?.strategyId ?? "dm-1",
    strategyVersion: overrides?.strategyVersion ?? "1.0.0",
    asset: overrides?.asset ?? "SOL",
    decision: overrides?.decision ?? "LONG",
    signature: overrides?.signature ?? makeCaseSignature(),
    committedAt: overrides?.committedAt ?? "2026-09-24T12:00:00.000Z",
    observedAt: overrides?.observedAt ?? "2026-09-24T11:59:00.000Z",
    outcome: overrides?.outcome,
  };
}
