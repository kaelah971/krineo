import { DM1_CONFIG } from "./config";
import { deriveProvisionalDirection, evaluateHardGates } from "./gates";
import {
  calculateConflict,
  calculateDirectionalMetrics,
  getConflictLabel,
  getCoverageLabel,
} from "./score";
import type {
  CandidateEvaluation,
  CandidateInput,
  DecisionResult,
  DM1Config,
  DM1EvidenceSnapshot,
} from "./types";
import { REASON_CODES, WARNING_CODES } from "./reason-codes";
import type { ReasonCode, WarningCode } from "./reason-codes";

function addUnique<T>(items: T[], item: T): void {
  if (!items.includes(item)) {
    items.push(item);
  }
}

function evidenceReasonCodes(snapshot: DM1EvidenceSnapshot): ReasonCode[] {
  const reasonCodes: ReasonCode[] = [];

  if (snapshot.evidence.DIRECTIONAL_MOMENTUM === "STRONGLY_SUPPORTIVE") {
    addUnique(reasonCodes, REASON_CODES.STRONG_DIRECTIONAL_MOMENTUM);
  }

  if (
    snapshot.evidence.TECHNICAL_CONFLUENCE === "SUPPORTIVE" ||
    snapshot.evidence.TECHNICAL_CONFLUENCE === "STRONGLY_SUPPORTIVE"
  ) {
    addUnique(reasonCodes, REASON_CODES.TECHNICAL_CONFLUENCE_SUPPORTIVE);
  }

  if (
    snapshot.evidence.RELATIVE_OPPORTUNITY === "SUPPORTIVE" ||
    snapshot.evidence.RELATIVE_OPPORTUNITY === "STRONGLY_SUPPORTIVE"
  ) {
    addUnique(reasonCodes, REASON_CODES.RELATIVE_OPPORTUNITY_WINNER);
  }

  if (
    snapshot.evidence.MARKET_ALIGNMENT === "SUPPORTIVE" ||
    snapshot.evidence.MARKET_ALIGNMENT === "STRONGLY_SUPPORTIVE"
  ) {
    addUnique(reasonCodes, REASON_CODES.MARKET_ALIGNMENT_SUPPORTIVE);
  }

  return reasonCodes;
}

function warningCodes(
  snapshot: DM1EvidenceSnapshot,
  conflict: number | null,
  config: DM1Config,
): WarningCode[] {
  const warnings: WarningCode[] = [];

  if (snapshot.risk === "ELEVATED") {
    addUnique(warnings, WARNING_CODES.ELEVATED_RISK);
  }

  if (
    conflict !== null &&
    conflict > config.lowConflictThreshold &&
    conflict <= config.maximumConflict
  ) {
    addUnique(warnings, WARNING_CODES.MODERATE_EVIDENCE_CONFLICT);
  }

  if (snapshot.regimeFit === "DEGRADED") {
    addUnique(warnings, WARNING_CODES.DEGRADED_REGIME_FIT);
  }

  return warnings;
}

export function evaluateDM1(
  snapshot: DM1EvidenceSnapshot,
  config: DM1Config = DM1_CONFIG,
): DecisionResult {
  const metrics = calculateDirectionalMetrics(snapshot, config);
  const provisionalDirection = deriveProvisionalDirection(metrics.score, config);
  const conflict = calculateConflict(snapshot, provisionalDirection, config);
  const hardGateResults = evaluateHardGates(
    snapshot,
    metrics.coverage,
    config,
  );
  const reasonCodes = evidenceReasonCodes(snapshot);

  if (provisionalDirection === null) {
    addUnique(reasonCodes, REASON_CODES.INSUFFICIENT_DIRECTIONAL_EVIDENCE);
  }

  for (const gate of hardGateResults) {
    if (gate.reasonCode !== undefined) {
      addUnique(reasonCodes, gate.reasonCode);
    }
  }

  const passesHardGates = hardGateResults.every((gate) => gate.passed);
  const decision =
    provisionalDirection !== null && passesHardGates
      ? provisionalDirection
      : "ABSTAIN";
  const thesisStrength =
    decision === "ABSTAIN"
      ? null
      : Math.abs(metrics.score) * metrics.coverage;

  return {
    strategyId: config.strategyId,
    strategyVersion: config.version,
    decision,
    provisionalDirection,
    directionalScore: metrics.score,
    thesisStrength,
    coverage: metrics.coverage,
    coverageLabel: getCoverageLabel(metrics.coverage, config),
    conflict,
    conflictLabel: getConflictLabel(conflict, config),
    risk: snapshot.risk,
    safety: snapshot.safety,
    regimeFit: snapshot.regimeFit,
    hardGateResults,
    reasonCodes,
    warningCodes: warningCodes(snapshot, conflict, config),
  };
}

export function evaluateCandidate(
  candidate: CandidateInput,
  config: DM1Config = DM1_CONFIG,
): CandidateEvaluation {
  return {
    asset: candidate.asset,
    ...evaluateDM1(candidate.evidence, config),
    selected: false,
  };
}
