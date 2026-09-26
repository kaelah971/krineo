import {
  DIRECTIONAL_EVIDENCE_DIMENSIONS,
  DIRECTIONAL_EVIDENCE_STATES,
  type DirectionalEvidenceDimension,
  type DirectionalEvidenceState,
} from "../evidence/types";
import type { MemorySummaryV1 } from "../memory";
import type { EvaluationContext } from "../playbook";
import type { DM1EvidenceSnapshot } from "../strategy/dm1/types";
import type {
  CanonicalDirectionalEvidence,
  DecisionContextInput,
} from "./types";

const UNKNOWN_EVIDENCE = DIRECTIONAL_EVIDENCE_STATES.UNKNOWN;

function isDirectionalEvidenceState(
  value: unknown,
): value is DirectionalEvidenceState {
  return (
    typeof value === "string" &&
    (Object.values(DIRECTIONAL_EVIDENCE_STATES) as readonly string[]).includes(
      value,
    )
  );
}

function canonicalEvidence(
  snapshot: DM1EvidenceSnapshot,
): CanonicalDirectionalEvidence {
  const source =
    snapshot !== null &&
    typeof snapshot === "object" &&
    snapshot.evidence !== null &&
    typeof snapshot.evidence === "object"
      ? snapshot.evidence
      : {};
  const result = {} as Record<
    DirectionalEvidenceDimension,
    DirectionalEvidenceState
  >;
  for (const dimension of Object.values(
    DIRECTIONAL_EVIDENCE_DIMENSIONS,
  ) as readonly DirectionalEvidenceDimension[]) {
    const value = source[dimension];
    result[dimension] = isDirectionalEvidenceState(value)
      ? value
      : UNKNOWN_EVIDENCE;
  }
  return Object.freeze(result);
}

function copySummaryCounts(summary: MemorySummaryV1): {
  readonly rankedCaseCount: number;
  readonly comparableCaseCount: number;
  readonly highSimilarityCaseCount: number;
} {
  return Object.freeze({
    rankedCaseCount: summary.rankedCaseCount,
    comparableCaseCount: summary.comparableCaseCount,
    highSimilarityCaseCount: summary.highSimilarityCaseCount,
  });
}

/** Builds the exact context consumed by the playbook evaluator. */
export function buildEvaluationContext(
  input: DecisionContextInput,
): EvaluationContext {
  const { marketResult, evidence, memorySummary = null } = input;
  const context: EvaluationContext = {
    strategyId: marketResult.strategyId,
    strategyVersion: marketResult.strategyVersion,
    decision: marketResult.decision,
    evidence: canonicalEvidence(evidence),
    risk: evidence.risk,
    safety: evidence.safety,
    regimeFit: evidence.regimeFit,
    coverage: marketResult.coverage,
    coverageLabel: marketResult.coverageLabel,
    conflict: marketResult.conflict,
    conflictLabel: marketResult.conflictLabel,
    reasonCodes: Object.freeze([...marketResult.reasonCodes]),
    ...(memorySummary === null
      ? {}
      : { memory: copySummaryCounts(memorySummary) }),
  };
  return Object.freeze(context);
}
