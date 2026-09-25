import type {
  CaseSignature,
  CaseSimilarityResult,
  CaseState,
  SimilarityComponent,
  SimilarityDiagnosticCode,
} from "./types";
import {
  CASE_SIGNATURE_DIMENSIONS,
  CASE_SIMILARITY_ALGORITHM_VERSION,
  CASE_SIMILARITY_TOTAL_WEIGHT,
  CASE_SIMILARITY_WEIGHTS,
} from "./types";
import { validateCaseSignature } from "./signature";

const DIRECTIONAL_VALUES: Record<string, number | null> = {
  STRONGLY_SUPPORTIVE: 1,
  SUPPORTIVE: 0.5,
  NEUTRAL: 0,
  OPPOSING: -0.5,
  STRONGLY_OPPOSING: -1,
  UNKNOWN: null,
};

const RISK_VALUES: Record<string, number | null> = {
  ACCEPTABLE: 1,
  ELEVATED: 0.5,
  EXTREME: 0,
  UNKNOWN: null,
};

const SAFETY_VALUES: Record<string, number | null> = {
  CLEAR: 1,
  VETO: 0,
  UNKNOWN: null,
};

const REGIME_FIT_VALUES: Record<string, number | null> = {
  FIT: 1,
  DEGRADED: 0.5,
  BROKEN: 0,
  UNKNOWN: null,
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function normalizedValue(
  dimension: string,
  state: string,
): number | null {
  if (
    dimension === "DIRECTIONAL_MOMENTUM" ||
    dimension === "TECHNICAL_CONFLUENCE" ||
    dimension === "RELATIVE_OPPORTUNITY" ||
    dimension === "MARKET_ALIGNMENT" ||
    dimension === "SENTIMENT_DERIVATIVES"
  ) {
    return DIRECTIONAL_VALUES[state] ?? null;
  }
  if (dimension === "risk") {
    return RISK_VALUES[state] ?? null;
  }
  if (dimension === "safety") {
    return SAFETY_VALUES[state] ?? null;
  }
  return REGIME_FIT_VALUES[state] ?? null;
}

function stateFor(
  dimension: string,
  signature: CaseSignature,
): CaseState {
  if (dimension === "risk") {
    return signature.risk;
  }
  if (dimension === "safety") {
    return signature.safety;
  }
  if (dimension === "regimeFit") {
    return signature.regimeFit;
  }
  return signature.evidence[
    dimension as keyof CaseSignature["evidence"]
  ];
}

function unknownComponent(
  dimension: (typeof CASE_SIGNATURE_DIMENSIONS)[number],
  weight: number,
  targetState: CaseState,
  candidateState: CaseState,
  diagnostic: SimilarityDiagnosticCode,
): SimilarityComponent {
  return {
    dimension,
    weight,
    targetState,
    candidateState,
    diagnostic,
    distance: 1,
    penalty: 1,
    score: 0,
    weightedScore: 0,
  };
}

function scoreDimension(
  dimension: (typeof CASE_SIGNATURE_DIMENSIONS)[number],
  targetState: CaseState,
  candidateState: CaseState,
): SimilarityComponent {
  const weight = CASE_SIMILARITY_WEIGHTS[dimension];
  const targetKnown = targetState !== "UNKNOWN";
  const candidateKnown = candidateState !== "UNKNOWN";
  if (!targetKnown && !candidateKnown) {
    return unknownComponent(
      dimension,
      weight,
      targetState,
      candidateState,
      "BOTH_UNKNOWN",
    );
  }
  if (!targetKnown) {
    return unknownComponent(
      dimension,
      weight,
      targetState,
      candidateState,
      "TARGET_UNKNOWN",
    );
  }
  if (!candidateKnown) {
    return unknownComponent(
      dimension,
      weight,
      targetState,
      candidateState,
      "CANDIDATE_UNKNOWN",
    );
  }
  if (targetState === candidateState) {
    return {
      dimension,
      weight,
      targetState,
      candidateState,
      diagnostic: "MATCH",
      distance: 0,
      penalty: 0,
      score: 1,
      weightedScore: weight,
    };
  }
  const x = normalizedValue(dimension, targetState);
  const y = normalizedValue(dimension, candidateState);
  if (x === null || y === null) {
    return unknownComponent(
      dimension,
      weight,
      targetState,
      candidateState,
      "CANDIDATE_UNKNOWN",
    );
  }
  if (dimension === "safety") {
    return {
      dimension,
      weight,
      targetState,
      candidateState,
      diagnostic: "OPPOSING",
      distance: 1,
      penalty: 1,
      score: 0,
      weightedScore: 0,
    };
  }
  if (
    dimension === "DIRECTIONAL_MOMENTUM" ||
    dimension === "TECHNICAL_CONFLUENCE" ||
    dimension === "RELATIVE_OPPORTUNITY" ||
    dimension === "MARKET_ALIGNMENT" ||
    dimension === "SENTIMENT_DERIVATIVES"
  ) {
    if (x * y < 0) {
      return {
        dimension,
        weight,
        targetState,
        candidateState,
        diagnostic: "OPPOSING",
        distance: 1,
        penalty: 1,
        score: 0,
        weightedScore: 0,
      };
    }
    const score = 1 - Math.abs(x - y) / 2;
    const distance = 1 - score;
    return {
      dimension,
      weight,
      targetState,
      candidateState,
      diagnostic: "PARTIAL_ALIGNMENT",
      distance,
      penalty: distance,
      score,
      weightedScore: weight * score,
    };
  }
  const score = 1 - Math.abs(x - y);
  const distance = 1 - score;
  return {
    dimension,
    weight,
    targetState,
    candidateState,
    diagnostic:
      score === 0 ? "OPPOSING" : "PARTIAL_ALIGNMENT",
    distance,
    penalty: distance,
    score,
    weightedScore: weight * score,
  };
}

/**
 * CaseSimilarityV1: deterministic, outcome-blind signature comparison.
 * Outcome data never participates; only the two signatures are read.
 * The result and its components are deeply frozen.
 */
export function compareCaseSimilarityV1(
  target: CaseSignature,
  candidate: CaseSignature,
): CaseSimilarityResult {
  const validTarget = validateCaseSignature(target);
  const validCandidate = validateCaseSignature(candidate);
  const components: SimilarityComponent[] = [];
  let comparableWeight = 0;
  let accumulated = 0;
  let targetKnownWeight = 0;
  let candidateKnownWeight = 0;
  for (const dimension of CASE_SIGNATURE_DIMENSIONS) {
    const targetState = stateFor(dimension, validTarget);
    const candidateState = stateFor(dimension, validCandidate);
    const component = scoreDimension(dimension, targetState, candidateState);
    components.push(component);
    const weight = CASE_SIMILARITY_WEIGHTS[dimension];
    if (targetState !== "UNKNOWN") {
      targetKnownWeight += weight;
    }
    if (candidateState !== "UNKNOWN") {
      candidateKnownWeight += weight;
    }
    if (targetState !== "UNKNOWN" && candidateState !== "UNKNOWN") {
      comparableWeight += weight;
      accumulated += component.weightedScore;
    }
  }
  const totalWeight = CASE_SIMILARITY_TOTAL_WEIGHT;
  const comparisonCoverage = comparableWeight / totalWeight;
  const comparableSimilarity =
    comparableWeight > 0 ? accumulated / comparableWeight : 0;
  return deepFreeze({
    algorithmVersion: CASE_SIMILARITY_ALGORITHM_VERSION,
    overallSimilarity: accumulated / totalWeight,
    comparableSimilarity,
    comparisonCoverage,
    targetCompleteness: targetKnownWeight / totalWeight,
    candidateCompleteness: candidateKnownWeight / totalWeight,
    comparableWeight,
    totalWeight,
    components,
  });
}
