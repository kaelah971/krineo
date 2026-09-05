import { DM1_CONFIG } from "../strategy/dm1/config";
import type { DM1RequiredEvidence } from "../strategy/dm1/types";
import {
  KILL_SWITCH_EFFECTS,
  KILL_SWITCH_SEVERITIES,
  KILL_SWITCH_VERDICTS,
  type KillSwitchEffect,
  type KillSwitchEvidenceItem,
  type KillSwitchReasonCode,
  type KillSwitchSeverity,
  type KillSwitchValidationInput,
  type KillSwitchVerdict,
} from "./types";

export interface KillSwitchCheckResult {
  verdict: KillSwitchVerdict;
  severity: KillSwitchSeverity;
  effect: KillSwitchEffect;
  reasonCodes: readonly KillSwitchReasonCode[];
  diagnostics: readonly string[];
}

function reason(code: KillSwitchReasonCode): KillSwitchReasonCode {
  return code;
}

function clearResult(
  diagnostic: string,
  reasonCode: KillSwitchReasonCode = "CHALLENGE_NOT_SUPPORTED",
): KillSwitchCheckResult {
  return {
    verdict: KILL_SWITCH_VERDICTS.CLEAR,
    severity: KILL_SWITCH_SEVERITIES.NONE,
    effect: KILL_SWITCH_EFFECTS.NONE,
    reasonCodes: [reasonCode],
    diagnostics: [diagnostic],
  };
}

function unknownResult(
  diagnostic: string,
  reasonCode: KillSwitchReasonCode = "CHALLENGE_EVIDENCE_UNKNOWN",
): KillSwitchCheckResult {
  return {
    verdict: KILL_SWITCH_VERDICTS.UNKNOWN,
    severity: KILL_SWITCH_SEVERITIES.CRITICAL,
    effect: KILL_SWITCH_EFFECTS.NONE,
    reasonCodes: [reasonCode],
    diagnostics: [diagnostic],
  };
}

function cautionResult(
  diagnostic: string,
  reasonCode: KillSwitchReasonCode,
  effect: KillSwitchEffect = KILL_SWITCH_EFFECTS.CAUTION,
): KillSwitchCheckResult {
  return {
    verdict: KILL_SWITCH_VERDICTS.CAUTION,
    severity: KILL_SWITCH_SEVERITIES.HIGH,
    effect,
    reasonCodes: [reasonCode],
    diagnostics: [diagnostic],
  };
}

function vetoResult(
  diagnostic: string,
  reasonCode: KillSwitchReasonCode,
): KillSwitchCheckResult {
  return {
    verdict: KILL_SWITCH_VERDICTS.VETO,
    severity: KILL_SWITCH_SEVERITIES.CRITICAL,
    effect: KILL_SWITCH_EFFECTS.VETO,
    reasonCodes: [reasonCode],
    diagnostics: [diagnostic],
  };
}

function relevantItems(
  items: readonly KillSwitchEvidenceItem[],
  kind: KillSwitchEvidenceItem["kind"],
): KillSwitchEvidenceItem[] {
  return items.filter((item) => item.kind === kind);
}

function unknownIfStateUnavailable(
  items: readonly KillSwitchEvidenceItem[],
  diagnostic: string,
): KillSwitchCheckResult | null {
  return items.some((item) => item.state === "UNKNOWN")
    ? unknownResult(diagnostic)
    : null;
}

export function checkDirectionContradiction(
  input: KillSwitchValidationInput,
  items: readonly KillSwitchEvidenceItem[],
): KillSwitchCheckResult {
  const directionalItems = relevantItems(items, "DIRECTIONAL");
  if (directionalItems.length === 0) {
    return unknownResult("No referenced directional evidence was available.");
  }

  const unavailable = unknownIfStateUnavailable(
    directionalItems,
    "Referenced directional evidence contains an unavailable state.",
  );
  if (unavailable !== null) {
    return unavailable;
  }

  const direction = input.decision.provisional.decision;
  if (direction === "ABSTAIN") {
    return clearResult("No directional thesis is available to contradict.");
  }

  const contradictory = directionalItems.filter((item) =>
    direction === "LONG"
      ? item.state === "OPPOSING" || item.state === "STRONGLY_OPPOSING"
      : item.state === "SUPPORTIVE" || item.state === "STRONGLY_SUPPORTIVE",
  );

  if (contradictory.length === 0) {
    return clearResult("Referenced directional evidence does not contradict the thesis.");
  }

  const hasStrongContradiction = contradictory.some((item) =>
    direction === "LONG"
      ? item.state === "STRONGLY_OPPOSING"
      : item.state === "STRONGLY_SUPPORTIVE",
  );

  return hasStrongContradiction
    ? vetoResult(
        "Strong directional evidence contradicts the provisional thesis.",
        reason("DIRECTION_CONTRADICTION_FOUND"),
      )
    : cautionResult(
        "Directional evidence contradicts the provisional thesis.",
        reason("DIRECTION_CONTRADICTION_FOUND"),
      );
}

export function checkSingleSourceFragility(
  items: readonly KillSwitchEvidenceItem[],
): KillSwitchCheckResult {
  const directionalItems = relevantItems(items, "DIRECTIONAL");
  if (directionalItems.length === 0) {
    return unknownResult("No referenced directional evidence was available.");
  }

  const unavailable = unknownIfStateUnavailable(
    directionalItems,
    "Referenced directional evidence contains an unavailable state.",
  );
  if (unavailable !== null) {
    return unavailable;
  }

  const sources = new Set(directionalItems.map((item) => item.source));
  if (sources.size !== 1 || sources.has("")) {
    return clearResult("Directional evidence is not dependent on a single source.");
  }

  return cautionResult(
    "All referenced directional evidence depends on one source.",
    reason("SINGLE_SOURCE_FRAGILITY_FOUND"),
  );
}

export function checkRegimeConflict(
  input: KillSwitchValidationInput,
  items: readonly KillSwitchEvidenceItem[],
): KillSwitchCheckResult {
  const regimeItems = relevantItems(items, "REGIME_FIT");
  if (regimeItems.length === 0) {
    return unknownResult("No referenced regime evidence was available.");
  }

  const unavailable = unknownIfStateUnavailable(
    regimeItems,
    "Referenced regime evidence is unavailable.",
  );
  if (unavailable !== null) {
    return unavailable;
  }

  switch (input.evidence.dm1.regimeFit) {
    case "BROKEN":
      return vetoResult("The current regime is incompatible with DM-1.", reason("REGIME_CONFLICT_FOUND"));
    case "DEGRADED":
      return cautionResult("The current regime is degraded for DM-1.", reason("REGIME_CONFLICT_FOUND"));
    case "UNKNOWN":
      return unknownResult("Regime fit cannot be evaluated.");
    case "FIT":
      return clearResult("The current regime fits DM-1.");
  }
}

export function checkRelativeOpportunityFailure(
  input: KillSwitchValidationInput,
): KillSwitchCheckResult {
  if (!input.comparison.available) {
    return unknownResult(
      "Opportunity comparison is unavailable; relative strength cannot be established.",
      reason("CHALLENGE_CANDIDATE_UNAVAILABLE"),
    );
  }

  const target = input.comparison.candidates.find(
    (candidate) => candidate.evaluation.asset === input.decision.provisional.asset,
  );
  if (target === undefined || target.evaluation.thesisStrength === null) {
    return unknownResult(
      "The provisional candidate is unavailable in the comparison state.",
      reason("CHALLENGE_CANDIDATE_UNAVAILABLE"),
    );
  }

  const requestedAssets = input.challenge.assets;
  const competitors = input.comparison.candidates.filter(
    (candidate) =>
      candidate.id !== target.id &&
      candidate.evaluation.decision !== "ABSTAIN" &&
      candidate.evaluation.thesisStrength !== null &&
      (requestedAssets === undefined || requestedAssets.includes(candidate.evaluation.asset)),
  );
  const stronger = competitors.some(
    (candidate) =>
      (candidate.evaluation.thesisStrength ?? -Infinity) >=
      (target.evaluation.thesisStrength ?? -Infinity) + DM1_CONFIG.minimumRelativeEdge,
  );

  if (!stronger) {
    return clearResult("No materially stronger eligible alternative was found.");
  }

  return cautionResult(
    "A materially stronger eligible alternative invalidates the current relative ranking.",
    reason("RELATIVE_OPPORTUNITY_FAILURE_FOUND"),
    KILL_SWITCH_EFFECTS.RECOMPUTE,
  );
}

export function checkRiskIncompatibility(
  input: KillSwitchValidationInput,
  items: readonly KillSwitchEvidenceItem[],
): KillSwitchCheckResult {
  const riskItems = relevantItems(items, "RISK");
  if (riskItems.length === 0) {
    return unknownResult("No referenced risk evidence was available.");
  }

  const unavailable = unknownIfStateUnavailable(
    riskItems,
    "Referenced risk evidence is unavailable.",
  );
  if (unavailable !== null) {
    return unavailable;
  }

  switch (input.evidence.dm1.risk) {
    case "EXTREME":
      return vetoResult("Risk exceeds the DM-1 policy limit.", reason("RISK_INCOMPATIBLE"));
    case "ELEVATED":
      return cautionResult("Risk is elevated but remains within the DM-1 policy limit.", reason("RISK_INCOMPATIBLE"));
    case "UNKNOWN":
      return unknownResult("Risk compatibility cannot be evaluated.");
    case "ACCEPTABLE":
      return clearResult("Risk is compatible with the DM-1 policy.");
  }
}

export function checkSafetyFailure(
  input: KillSwitchValidationInput,
  items: readonly KillSwitchEvidenceItem[],
): KillSwitchCheckResult {
  const safetyItems = relevantItems(items, "SAFETY");
  if (safetyItems.length === 0) {
    return unknownResult("No referenced safety evidence was available.");
  }

  const unavailable = unknownIfStateUnavailable(
    safetyItems,
    "Referenced safety evidence is unavailable.",
  );
  if (unavailable !== null) {
    return unavailable;
  }

  switch (input.evidence.dm1.safety) {
    case "VETO":
      return vetoResult("Safety policy vetoes the provisional thesis.", reason("SAFETY_FAILURE_FOUND"));
    case "UNKNOWN":
      return unknownResult("Safety cannot be evaluated.");
    case "CLEAR":
      return clearResult("Safety evidence does not veto the thesis.");
  }
}

function isMissingRequiredDirectionalEvidence(
  input: KillSwitchValidationInput,
): boolean {
  const requiredDimensions = DM1_CONFIG.requiredDirectionalDimensions;
  return requiredDimensions.some(
    (dimension) => input.evidence.dm1.evidence[dimension] === undefined || input.evidence.dm1.evidence[dimension] === "UNKNOWN",
  );
}

function isMissingRequiredPolicyEvidence(
  input: KillSwitchValidationInput,
  requiredEvidence: DM1RequiredEvidence,
): boolean {
  switch (requiredEvidence) {
    case "risk":
      return input.evidence.dm1.risk === "UNKNOWN";
    case "safety":
      return input.evidence.dm1.safety === "UNKNOWN";
    case "regimeFit":
      return input.evidence.dm1.regimeFit === "UNKNOWN";
  }
}

export function checkMissingCriticalEvidence(
  input: KillSwitchValidationInput,
): KillSwitchCheckResult {
  const missingDirectional = isMissingRequiredDirectionalEvidence(input);
  const missingPolicy = DM1_CONFIG.requiredEvidence.some((requiredEvidence) =>
    isMissingRequiredPolicyEvidence(input, requiredEvidence),
  );

  return missingDirectional || missingPolicy
    ? vetoResult(
        "A required DM-1 input is unavailable and the thesis cannot pass policy.",
        reason("MISSING_CRITICAL_EVIDENCE"),
      )
    : clearResult("All required DM-1 inputs are available.");
}
