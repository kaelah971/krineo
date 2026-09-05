import type { DirectionalEvidenceState } from "../../lib/evidence/types";
import type { DM1EvidenceSnapshot } from "../../lib/strategy/dm1/types";
import type { CandidateEvaluation } from "../../lib/strategy/dm1/types";

const ALL_DIMENSIONS: Record<
  "DIRECTIONAL_MOMENTUM" | "TECHNICAL_CONFLUENCE" | "RELATIVE_OPPORTUNITY" | "MARKET_ALIGNMENT" | "SENTIMENT_DERIVATIVES",
  DirectionalEvidenceState
> = {
  DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
  TECHNICAL_CONFLUENCE: "STRONGLY_SUPPORTIVE",
  RELATIVE_OPPORTUNITY: "STRONGLY_SUPPORTIVE",
  MARKET_ALIGNMENT: "STRONGLY_SUPPORTIVE",
  SENTIMENT_DERIVATIVES: "STRONGLY_SUPPORTIVE",
};

export function makeDM1Fixture(
  overrides: Partial<DM1EvidenceSnapshot> = {},
): DM1EvidenceSnapshot {
  return {
    evidence: { ...ALL_DIMENSIONS, ...overrides.evidence },
    risk: overrides.risk ?? "ACCEPTABLE",
    safety: overrides.safety ?? "CLEAR",
    regimeFit: overrides.regimeFit ?? "FIT",
  };
}

export const coherentBullish = makeDM1Fixture();

export const coherentBearish = makeDM1Fixture({
  evidence: {
    DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING",
    TECHNICAL_CONFLUENCE: "STRONGLY_OPPOSING",
    RELATIVE_OPPORTUNITY: "STRONGLY_OPPOSING",
    MARKET_ALIGNMENT: "STRONGLY_OPPOSING",
    SENTIMENT_DERIVATIVES: "STRONGLY_OPPOSING",
  },
});

export const weakDirection = makeDM1Fixture({
  evidence: {
    DIRECTIONAL_MOMENTUM: "NEUTRAL",
    TECHNICAL_CONFLUENCE: "NEUTRAL",
    RELATIVE_OPPORTUNITY: "NEUTRAL",
    MARKET_ALIGNMENT: "NEUTRAL",
    SENTIMENT_DERIVATIVES: "NEUTRAL",
  },
});

export const highConflict = makeDM1Fixture({
  evidence: {
    DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING",
    TECHNICAL_CONFLUENCE: "STRONGLY_SUPPORTIVE",
    RELATIVE_OPPORTUNITY: "STRONGLY_SUPPORTIVE",
    MARKET_ALIGNMENT: "STRONGLY_SUPPORTIVE",
    SENTIMENT_DERIVATIVES: "STRONGLY_OPPOSING",
  },
});

export const missingSafety = makeDM1Fixture({ safety: "UNKNOWN" });
export const safetyVeto = makeDM1Fixture({ safety: "VETO" });
export const extremeVolatility = makeDM1Fixture({ risk: "EXTREME" });

export const partialOptionalEvidence = makeDM1Fixture({
  evidence: { SENTIMENT_DERIVATIVES: "UNKNOWN" },
});

export const insufficientCoverage = makeDM1Fixture({
  evidence: {
    TECHNICAL_CONFLUENCE: "UNKNOWN",
    SENTIMENT_DERIVATIVES: "UNKNOWN",
  },
});

export const regimeBroken = makeDM1Fixture({ regimeFit: "BROKEN" });
export const regimeDegraded = makeDM1Fixture({ regimeFit: "DEGRADED" });

export const unknownVsNeutralUnknown = makeDM1Fixture({
  evidence: { SENTIMENT_DERIVATIVES: "UNKNOWN" },
});

export const unknownVsNeutralNeutral = makeDM1Fixture({
  evidence: { SENTIMENT_DERIVATIVES: "NEUTRAL" },
});

export const exactLongThreshold = makeDM1Fixture({
  evidence: {
    DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
    TECHNICAL_CONFLUENCE: "SUPPORTIVE",
    RELATIVE_OPPORTUNITY: "STRONGLY_SUPPORTIVE",
    MARKET_ALIGNMENT: "NEUTRAL",
    SENTIMENT_DERIVATIVES: "NEUTRAL",
  },
});

export const exactShortThreshold = makeDM1Fixture({
  evidence: {
    DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING",
    TECHNICAL_CONFLUENCE: "OPPOSING",
    RELATIVE_OPPORTUNITY: "STRONGLY_OPPOSING",
    MARKET_ALIGNMENT: "NEUTRAL",
    SENTIMENT_DERIVATIVES: "NEUTRAL",
  },
});

export const justBelowLongThreshold = makeDM1Fixture({
  evidence: {
    DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
    TECHNICAL_CONFLUENCE: "SUPPORTIVE",
    RELATIVE_OPPORTUNITY: "SUPPORTIVE",
    MARKET_ALIGNMENT: "SUPPORTIVE",
    SENTIMENT_DERIVATIVES: "NEUTRAL",
  },
});

export const justAboveShortThreshold = makeDM1Fixture({
  evidence: {
    DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING",
    TECHNICAL_CONFLUENCE: "OPPOSING",
    RELATIVE_OPPORTUNITY: "OPPOSING",
    MARKET_ALIGNMENT: "OPPOSING",
    SENTIMENT_DERIVATIVES: "NEUTRAL",
  },
});

export const moderateQualifiedConflict = makeDM1Fixture({
  evidence: {
    DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
    TECHNICAL_CONFLUENCE: "STRONGLY_SUPPORTIVE",
    RELATIVE_OPPORTUNITY: "STRONGLY_OPPOSING",
    MARKET_ALIGNMENT: "STRONGLY_SUPPORTIVE",
    SENTIMENT_DERIVATIVES: "STRONGLY_SUPPORTIVE",
  },
});

export const unknownRisk = makeDM1Fixture({ risk: "UNKNOWN" });

export const relativeClearWinner = coherentBullish;
export const relativeClearRunnerUp = makeDM1Fixture({
  evidence: { DIRECTIONAL_MOMENTUM: "SUPPORTIVE" },
});

export const relativeNearTieTop = makeDM1Fixture({
  evidence: { MARKET_ALIGNMENT: "SUPPORTIVE" },
});

export const relativeNearTieRunnerUp = makeDM1Fixture({
  evidence: { SENTIMENT_DERIVATIVES: "SUPPORTIVE" },
});

export const degradedRisk = makeDM1Fixture({ risk: "ELEVATED" });

export function makeCandidateEvaluation(
  overrides: Partial<CandidateEvaluation> = {},
): CandidateEvaluation {
  return {
    asset: "FIXTURE-ASSET",
    strategyId: "dm-1",
    strategyVersion: "1.0.0",
    decision: "LONG",
    provisionalDirection: "LONG",
    directionalScore: 70,
    thesisStrength: 70,
    coverage: 1,
    coverageLabel: "COMPLETE",
    conflict: 0.1,
    conflictLabel: "LOW",
    risk: "ACCEPTABLE",
    safety: "CLEAR",
    regimeFit: "FIT",
    hardGateResults: [],
    reasonCodes: [],
    warningCodes: [],
    selected: false,
    ...overrides,
  };
}
