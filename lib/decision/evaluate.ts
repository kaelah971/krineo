import {
  CASE_SIMILARITY_ALGORITHM_VERSION,
  MEMORY_SUMMARY_V1_THRESHOLDS,
  MEMORY_SUMMARY_V1_VERSION,
  summarizeMemorySnapshotV1,
  toCaseSignature,
  validateCaseSignature,
  validateDecisionCase,
  type MemorySnapshot,
  type MemorySummaryV1,
} from "../memory";
import {
  EFFECT_PRECEDENCE,
  evaluateVersion,
  type Effect,
  type EvaluationContext,
  type PlaybookRejectionCode,
  type VersionEvaluation,
} from "../playbook";
import { evaluateDM1 } from "../strategy/dm1/decision";
import {
  REASON_CODES,
  WARNING_CODES,
  type ReasonCode,
  type WarningCode,
} from "../strategy/dm1/reason-codes";
import { buildEvaluationContext } from "./context";
import type { DecisionResult } from "../strategy/dm1/types";
import { deriveMarketEffect, classifyReasonCode } from "./abstain";
import {
  DECISION_DIAGNOSTIC_SOURCES,
  DECISION_INTEGRATION_REJECTION_CODES,
  DECISION_INTEGRATION_V1_VERSION,
  DECISION_SOURCES,
  DECISION_STATUSES,
  type DecisionDiagnostic,
  type DecisionIntegrationInput,
  type DecisionIntegrationRejection,
  type DecisionIntegrationResult,
  type DecisionIntegrationSuccess,
  type DecisionSource,
  type DecisionStatus,
} from "./types";

const REASON_ORDER = Object.values(REASON_CODES) as readonly ReasonCode[];
const WARNING_ORDER = Object.values(WARNING_CODES) as readonly WarningCode[];
const GATE_ORDER = [
  "REQUIRED_DIRECTIONAL_EVIDENCE",
  "COVERAGE",
  "SAFETY",
  "RISK",
  "REGIME_FIT",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    if (Array.isArray(value)) {
      for (const item of value) deepFreeze(item);
    } else {
      for (const key of Object.keys(value)) {
        deepFreeze((value as Record<string, unknown>)[key]);
      }
    }
    Object.freeze(value);
  }
  return value;
}

function failure(
  code: DecisionIntegrationRejection["code"],
  message: string,
  playbookCode?: PlaybookRejectionCode,
): DecisionIntegrationRejection {
  return deepFreeze({
    ok: false as const,
    code,
    message,
    playbookCode,
  });
}

function sortedCodes<T extends string>(
  values: readonly T[],
  order: readonly T[],
): readonly T[] {
  const rank = new Map(order.map((value, index) => [value, index]));
  return [...values].sort(
    (left, right) =>
      (rank.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
}

function comparableMarketResult(result: DecisionResult): Record<string, unknown> {
  const gates = [...result.hardGateResults].sort(
    (left, right) => GATE_ORDER.indexOf(left.gate) - GATE_ORDER.indexOf(right.gate),
  );
  return {
    strategyId: result.strategyId,
    strategyVersion: result.strategyVersion,
    decision: result.decision,
    provisionalDirection: result.provisionalDirection,
    directionalScore: result.directionalScore,
    thesisStrength: result.thesisStrength,
    coverage: result.coverage,
    coverageLabel: result.coverageLabel,
    conflict: result.conflict,
    conflictLabel: result.conflictLabel,
    risk: result.risk,
    safety: result.safety,
    regimeFit: result.regimeFit,
    hardGateResults: gates.map((gate) => ({
      gate: gate.gate,
      passed: gate.passed,
      ...(gate.reasonCode === undefined ? {} : { reasonCode: gate.reasonCode }),
    })),
    reasonCodes: sortedCodes(result.reasonCodes, REASON_ORDER),
    warningCodes: sortedCodes(result.warningCodes, WARNING_ORDER),
  };
}

function marketResultsMatch(
  supplied: DecisionResult,
  canonical: DecisionResult,
): boolean {
  return (
    JSON.stringify(comparableMarketResult(supplied)) ===
    JSON.stringify(comparableMarketResult(canonical))
  );
}

function isFiniteCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function validateSummary(summary: unknown): MemorySummaryV1 {
  if (!isRecord(summary)) {
    throw new Error("Memory summary must be an object.");
  }
  if (summary.summaryVersion !== MEMORY_SUMMARY_V1_VERSION) {
    throw new Error("Memory summary has an unsupported version.");
  }
  if (
    !isRecord(summary.thresholds) ||
    summary.thresholds.minimumComparisonCoverage !==
      MEMORY_SUMMARY_V1_THRESHOLDS.minimumComparisonCoverage ||
    summary.thresholds.minimumComparableOverallSimilarity !==
      MEMORY_SUMMARY_V1_THRESHOLDS.minimumComparableOverallSimilarity ||
    summary.thresholds.minimumHighSimilarityOverallSimilarity !==
      MEMORY_SUMMARY_V1_THRESHOLDS.minimumHighSimilarityOverallSimilarity
  ) {
    throw new Error("Memory summary thresholds are invalid.");
  }
  for (const field of [
    "rankedCaseCount",
    "comparableCaseCount",
    "highSimilarityCaseCount",
  ] as const) {
    if (!isFiniteCount(summary[field])) {
      throw new Error(`Memory summary ${field} is invalid.`);
    }
  }
  const rankedCaseCount = summary.rankedCaseCount as number;
  const comparableCaseCount = summary.comparableCaseCount as number;
  const highSimilarityCaseCount = summary.highSimilarityCaseCount as number;
  if (
    highSimilarityCaseCount > comparableCaseCount ||
    comparableCaseCount > rankedCaseCount
  ) {
    throw new Error("Memory summary counts are inconsistent.");
  }
  return deepFreeze({
    summaryVersion: summary.summaryVersion,
    thresholds: deepFreeze({
      minimumComparisonCoverage: summary.thresholds.minimumComparisonCoverage,
      minimumComparableOverallSimilarity:
        summary.thresholds.minimumComparableOverallSimilarity,
      minimumHighSimilarityOverallSimilarity:
        summary.thresholds.minimumHighSimilarityOverallSimilarity,
    }),
    rankedCaseCount,
    comparableCaseCount,
    highSimilarityCaseCount,
  } as MemorySummaryV1);
}

function signaturesMatch(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftEvidence = left.evidence;
  const rightEvidence = right.evidence;
  if (!isRecord(leftEvidence) || !isRecord(rightEvidence)) return false;
  const dimensions = [
    "DIRECTIONAL_MOMENTUM",
    "TECHNICAL_CONFLUENCE",
    "RELATIVE_OPPORTUNITY",
    "MARKET_ALIGNMENT",
    "SENTIMENT_DERIVATIVES",
  ] as const;
  return (
    dimensions.every((dimension) => leftEvidence[dimension] === rightEvidence[dimension]) &&
    left.risk === right.risk &&
    left.safety === right.safety &&
    left.regimeFit === right.regimeFit
  );
}

function memorySummaryFor(
  input: DecisionIntegrationInput,
): MemorySummaryV1 | null {
  if (input.memorySnapshot !== undefined && input.memorySnapshot !== null) {
    const snapshot = input.memorySnapshot as MemorySnapshot;
    if (!isRecord(snapshot) || snapshot.algorithmVersion !== CASE_SIMILARITY_ALGORITHM_VERSION) {
      throw new Error("Memory snapshot algorithm version is invalid.");
    }
    validateCaseSignature(snapshot.targetSignature);
    const targetSignature = toCaseSignature(input.evidence);
    if (!signaturesMatch(snapshot.targetSignature, targetSignature)) {
      throw new Error("Memory snapshot targetSignature does not match evidence.");
    }
    if (snapshot.targetCase !== null && snapshot.targetCase !== undefined) {
      validateDecisionCase(snapshot.targetCase);
      if (!signaturesMatch(snapshot.targetCase.signature, snapshot.targetSignature)) {
        throw new Error("Memory snapshot targetCase signature does not match targetSignature.");
      }
    }
    const summary = summarizeMemorySnapshotV1(snapshot);
    if (input.memorySummary !== undefined && input.memorySummary !== null) {
      const suppliedSummary = validateSummary(input.memorySummary);
      if (JSON.stringify(summary) !== JSON.stringify(suppliedSummary)) {
        throw new Error("Supplied memory summary does not match snapshot.");
      }
    }
    return summary;
  }
  if (input.memorySummary === undefined || input.memorySummary === null) return null;
  return validateSummary(input.memorySummary);
}

function combineEffects(marketEffect: Effect, playbookEffect: Effect): Effect {
  for (const effect of EFFECT_PRECEDENCE) {
    if (marketEffect === effect || playbookEffect === effect) return effect;
  }
  return "PASS";
}

function winningSource(
  marketEffect: Effect,
  playbookEffect: Effect,
  effect: Effect,
): DecisionSource {
  if (marketEffect === effect && playbookEffect === effect) {
    return DECISION_SOURCES.BOTH;
  }
  return marketEffect === effect
    ? DECISION_SOURCES.MARKET
    : DECISION_SOURCES.PLAYBOOK;
}

function statusFor(effect: Effect): DecisionStatus {
  return effect === "PASS" ? DECISION_STATUSES.FIT : effect;
}

function effectiveDecision(
  marketDecision: DecisionResult["decision"],
  marketEffect: Effect,
  playbookEffect: Effect,
): DecisionResult["decision"] {
  if (marketDecision === "ABSTAIN") return "ABSTAIN";
  if (marketEffect === "WAIT" || marketEffect === "BLOCK") return "ABSTAIN";
  if (playbookEffect === "WAIT" || playbookEffect === "BLOCK") return "ABSTAIN";
  return marketDecision;
}

function marketDiagnostics(marketResult: DecisionResult): DecisionDiagnostic[] {
  return sortedCodes(marketResult.reasonCodes, REASON_ORDER).map((reasonCode) => ({
    source: DECISION_DIAGNOSTIC_SOURCES.MARKET,
    code: reasonCode,
    reasonCode,
    effect: classifyReasonCode(reasonCode),
    message: `Market reason: ${reasonCode}.`,
  }));
}

function memoryDiagnostics(summary: MemorySummaryV1 | null): DecisionDiagnostic[] {
  if (summary === null) {
    return [
      {
        source: DECISION_DIAGNOSTIC_SOURCES.MEMORY,
        code: "MEMORY_UNAVAILABLE",
        message: "Memory summary is unavailable.",
      },
    ];
  }
  return [
    {
      source: DECISION_DIAGNOSTIC_SOURCES.MEMORY,
      code: "MEMORY_AVAILABLE",
      message: "Memory summary is available.",
      rankedCaseCount: summary.rankedCaseCount,
      comparableCaseCount: summary.comparableCaseCount,
      highSimilarityCaseCount: summary.highSimilarityCaseCount,
    },
  ];
}

function playbookDiagnostics(evaluation: VersionEvaluation): DecisionDiagnostic[] {
  const diagnostics: DecisionDiagnostic[] = [
    {
      source: DECISION_DIAGNOSTIC_SOURCES.PLAYBOOK,
      code: "PLAYBOOK_AGGREGATE",
      effect: evaluation.aggregateEffect,
      message: `Playbook aggregate effect: ${evaluation.aggregateEffect}.`,
    },
  ];
  for (const ruleEvaluation of evaluation.ruleEvaluations) {
    for (const diagnostic of ruleEvaluation.diagnostics) {
      diagnostics.push({
        source: DECISION_DIAGNOSTIC_SOURCES.PLAYBOOK,
        code: diagnostic.code,
        message: diagnostic.message,
        ruleId: ruleEvaluation.rule.id,
        outcome: ruleEvaluation.outcome,
      });
    }
  }
  return diagnostics;
}

function finalDiagnostic(
  marketEffect: Effect,
  playbookEffect: Effect,
  effect: Effect,
  status: DecisionStatus,
  source: DecisionSource,
  decision: DecisionResult["decision"],
  effective: DecisionResult["decision"],
): DecisionDiagnostic {
  return {
    source: DECISION_DIAGNOSTIC_SOURCES.DECISION,
    code: "FINAL_PRECEDENCE",
    message: `Final effect ${effect} from market ${marketEffect} and playbook ${playbookEffect}.`,
    marketEffect,
    playbookEffect,
    effect,
    status,
    winningSource: source,
    effectiveDecision: effective,
    outcome: decision,
  };
}

function diagnosticsFor(
  marketResult: DecisionResult,
  summary: MemorySummaryV1 | null,
  evaluation: VersionEvaluation,
  effect: Effect,
  status: DecisionStatus,
  source: DecisionSource,
  effective: DecisionResult["decision"],
  marketEffect: Effect,
  playbookEffect: Effect,
): readonly DecisionDiagnostic[] {
  return [
    ...marketDiagnostics(marketResult),
    ...memoryDiagnostics(summary),
    ...playbookDiagnostics(evaluation),
    finalDiagnostic(
      marketEffect,
      playbookEffect,
      effect,
      status,
      source,
      marketResult.decision,
      effective,
    ),
  ];
}

/**
 * Integrates one canonical DM-1 market result with one approved playbook
 * version. The evaluator is deliberately the sole call site of evaluateVersion.
 */
export function evaluatePreflight(
  input: DecisionIntegrationInput,
): DecisionIntegrationResult {
  if (!isRecord(input)) {
    return failure(
      DECISION_INTEGRATION_REJECTION_CODES.INVALID_INPUT,
      "Decision integration input must be an object.",
    );
  }

  const marketResult = input.marketResult;
  const playbookVersion = input.playbookVersion;
  if (!isRecord(marketResult) || !isRecord(playbookVersion)) {
    return failure(
      DECISION_INTEGRATION_REJECTION_CODES.INVALID_INPUT,
      "Decision integration requires a market result and playbook version.",
    );
  }
  if (
    marketResult.strategyId !== playbookVersion.strategyId ||
    marketResult.strategyVersion !== playbookVersion.strategyVersion
  ) {
    return failure(
      DECISION_INTEGRATION_REJECTION_CODES.STRATEGY_MISMATCH,
      "Market result and playbook version target different strategies.",
    );
  }

  let canonicalMarket: DecisionResult;
  try {
    canonicalMarket = evaluateDM1(input.evidence);
  } catch {
    return failure(
      DECISION_INTEGRATION_REJECTION_CODES.EVIDENCE_RESULT_MISMATCH,
      "Market evidence could not produce a canonical result.",
    );
  }
  if (!marketResultsMatch(marketResult, canonicalMarket)) {
    return failure(
      DECISION_INTEGRATION_REJECTION_CODES.EVIDENCE_RESULT_MISMATCH,
      "Market result does not match the supplied evidence.",
    );
  }

  let memorySummary: MemorySummaryV1 | null;
  try {
    memorySummary = memorySummaryFor(input);
  } catch (error) {
    return failure(
      DECISION_INTEGRATION_REJECTION_CODES.INVALID_MEMORY_TARGET_SIGNATURE,
      error instanceof Error ? error.message : "Memory summary is invalid.",
    );
  }

  const context: EvaluationContext = buildEvaluationContext({
    marketResult: canonicalMarket,
    evidence: input.evidence,
    memorySummary,
  });
  const playbookResult = evaluateVersion(playbookVersion, context);
  if (playbookResult.ok !== true) {
    return failure(
      DECISION_INTEGRATION_REJECTION_CODES.PLAYBOOK_EVALUATION_REJECTED,
      playbookResult.message,
      playbookResult.code,
    );
  }

  const playbookEvaluation = playbookResult.evaluation;
  const marketEffect = deriveMarketEffect(canonicalMarket);
  const playbookEffect = playbookEvaluation.aggregateEffect;
  const effect = combineEffects(marketEffect, playbookEffect);
  const status = statusFor(effect);
  const source = winningSource(marketEffect, playbookEffect, effect);
  const effective = effectiveDecision(
    canonicalMarket.decision,
    marketEffect,
    playbookEffect,
  );
  const diagnostics = diagnosticsFor(
    canonicalMarket,
    memorySummary,
    playbookEvaluation,
    effect,
    status,
    source,
    effective,
    marketEffect,
    playbookEffect,
  );

  const result: DecisionIntegrationSuccess = {
    ok: true,
    contractVersion: DECISION_INTEGRATION_V1_VERSION,
    status,
    effect,
    marketDecision: canonicalMarket.decision,
    effectiveDecision: effective,
    marketEffect,
    playbookEffect,
    winningSource: source,
    strategyId: canonicalMarket.strategyId,
    strategyVersion: canonicalMarket.strategyVersion,
    playbookVersionId: playbookEvaluation.versionId,
    marketResult: canonicalMarket,
    playbookEvaluation,
    memorySummary,
    diagnostics,
  };
  return deepFreeze(result);
}
