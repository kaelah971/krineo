import type { EvidenceItem } from "../../lib/evidence/types";
import type {
  KillSwitchAggregateResult,
  KillSwitchValidationResult,
} from "../../lib/killswitch/types";
import { buildThesisReceipt } from "../../lib/thesis/receipt";
import type {
  InvalidationRule,
  ThesisReceiptInput,
} from "../../lib/thesis/types";
import {
  makeExistingThesisHistory,
  makeKillSwitchAggregate,
} from "./thesis";
import { makeCandidateEvaluation } from "./dm1";

export const receiptEvidence: readonly EvidenceItem[] = [
  {
    id: "evidence-momentum",
    dimension: "DIRECTIONAL_MOMENTUM",
    state: "STRONGLY_SUPPORTIVE",
    source: "momentum-source",
    observedAt: "2026-09-05T11:00:00.000Z",
    reasonCode: "STRONG_DIRECTIONAL_MOMENTUM",
    explanation: "Momentum supports the direction.",
  },
  {
    id: "evidence-technical",
    dimension: "TECHNICAL_CONFLUENCE",
    state: "OPPOSING",
    source: "technical-source",
    observedAt: "2026-09-05T11:01:00.000Z",
    reasonCode: "TECHNICAL_CONFLUENCE_SUPPORTIVE",
    explanation: "Technical evidence is a counterweight.",
  },
  {
    id: "evidence-relative",
    dimension: "RELATIVE_OPPORTUNITY",
    state: "SUPPORTIVE",
    source: "relative-source",
    observedAt: "2026-09-05T11:02:00.000Z",
    reasonCode: "RELATIVE_OPPORTUNITY_WINNER",
    explanation: "Relative opportunity supports the candidate.",
  },
  {
    id: "evidence-market",
    dimension: "MARKET_ALIGNMENT",
    state: "NEUTRAL",
    source: "market-source",
    observedAt: "2026-09-05T11:03:00.000Z",
    reasonCode: "MARKET_ALIGNMENT_SUPPORTIVE",
    explanation: "Market alignment is neutral.",
  },
  {
    id: "evidence-unknown",
    dimension: "SENTIMENT_DERIVATIVES",
    state: "UNKNOWN",
    source: "sentiment-source",
    observedAt: "2026-09-05T11:04:00.000Z",
    reasonCode: "REQUIRED_EVIDENCE_UNAVAILABLE",
    explanation: "Sentiment evidence is unavailable.",
  },
];

export const receiptRules: readonly InvalidationRule[] = [
  {
    id: "rule-regime",
    ruleType: "REGIME_BREAK",
    effect: "INVALIDATE",
    condition: { field: "regimeFit", operator: "EQ", value: "BROKEN" },
    description: "Regime fit must not break.",
  },
  {
    id: "rule-direction-loss",
    ruleType: "DIRECTION_LOSS",
    effect: "WEAKEN",
    condition: { field: "directionalScore", operator: "LT", value: 60 },
  },
];

export function makeValidatedChallenge(
  overrides: Partial<KillSwitchValidationResult> = {},
): KillSwitchValidationResult {
  return {
    challengeId: "challenge-1",
    challengeType: "DIRECTION_CONTRADICTION",
    verdict: "CAUTION",
    severity: "HIGH",
    effect: "CAUTION",
    validatedEvidenceIds: ["evidence-technical"],
    missingEvidenceIds: [],
    validatedCandidateIds: [],
    reasonCodes: ["DIRECTION_CONTRADICTION_FOUND"],
    diagnostics: ["A validated directional concern exists."],
    ...overrides,
  };
}

export function makeReceiptKillSwitch(
  overrides: Partial<KillSwitchAggregateResult> = {},
): KillSwitchAggregateResult {
  return {
    ...makeKillSwitchAggregate("CLEAR"),
    results: [makeValidatedChallenge()],
    ...overrides,
  };
}

export function makeReceiptInput(
  overrides: Partial<ThesisReceiptInput> = {},
): ThesisReceiptInput {
  const { thesis, versions } = makeExistingThesisHistory();
  const target = makeCandidateEvaluation({
    asset: "SOL",
    selected: true,
    thesisStrength: 70,
  });
  const alternative = makeCandidateEvaluation({
    asset: "ETH",
    selected: false,
    thesisStrength: 65,
  });

  return {
    thesis,
    version: versions[0],
    receiptId: "receipt-1",
    normalizerVersion: "normalizer-1.0.0",
    evidenceItems: receiptEvidence,
    candidateEvaluations: [alternative, target],
    killSwitch: makeReceiptKillSwitch(),
    killSwitchRunId: versions[0].killSwitchRunId,
    invalidationRules: receiptRules,
    ...overrides,
  };
}

export function buildReceiptFixture() {
  const result = buildThesisReceipt(makeReceiptInput());
  if (!result.ok) {
    throw new Error(`Receipt fixture setup failed: ${result.code}`);
  }
  return result;
}
