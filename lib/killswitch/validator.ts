import { isKillSwitchChallengeType } from "./challenge-schema";
import {
  checkDirectionContradiction,
  checkMissingCriticalEvidence,
  checkRegimeConflict,
  checkRelativeOpportunityFailure,
  checkRiskIncompatibility,
  checkSafetyFailure,
  checkSingleSourceFragility,
  type KillSwitchCheckResult,
} from "./checks";
import {
  KILL_SWITCH_EFFECTS,
  KILL_SWITCH_SEVERITIES,
  KILL_SWITCH_VERDICTS,
  type KillSwitchAggregateResult,
  type KillSwitchEffect,
  type KillSwitchEvidenceItem,
  type KillSwitchReasonCode,
  type KillSwitchSeverity,
  type KillSwitchValidationInput,
  type KillSwitchValidationResult,
  type KillSwitchVerdict,
} from "./types";

function unique(items: readonly string[]): string[] {
  return [...new Set(items)];
}

function baseResult(
  input: KillSwitchValidationInput,
  overrides: Partial<KillSwitchValidationResult> = {},
): KillSwitchValidationResult {
  return {
    challengeId: input.challenge.id,
    challengeType: input.challenge.challengeType,
    verdict: KILL_SWITCH_VERDICTS.UNKNOWN,
    severity: KILL_SWITCH_SEVERITIES.CRITICAL,
    effect: KILL_SWITCH_EFFECTS.NONE,
    validatedEvidenceIds: [],
    missingEvidenceIds: [],
    validatedCandidateIds: [],
    reasonCodes: [],
    diagnostics: [],
    ...overrides,
  };
}

function fromCheck(
  input: KillSwitchValidationInput,
  items: readonly KillSwitchEvidenceItem[],
  check: KillSwitchCheckResult,
  validatedCandidateIds: readonly string[],
): KillSwitchValidationResult {
  return baseResult(input, {
    verdict: check.verdict,
    severity: check.severity,
    effect: check.effect,
    validatedEvidenceIds: items.map((item) => item.id),
    validatedCandidateIds,
    reasonCodes: check.reasonCodes,
    diagnostics: check.diagnostics,
  });
}

function unsupportedResult(
  input: KillSwitchValidationInput,
): KillSwitchValidationResult {
  return baseResult(input, {
    severity: KILL_SWITCH_SEVERITIES.NONE,
    reasonCodes: ["UNSUPPORTED_CHALLENGE_TYPE"],
    diagnostics: [
      "This challenge type is not evaluated by the deterministic P1.3 validator.",
    ],
  });
}

function unavailableEvidenceResult(
  input: KillSwitchValidationInput,
  missingEvidenceIds: readonly string[],
  validatedEvidenceIds: readonly string[],
  validatedCandidateIds: readonly string[],
  diagnostic: string,
  reasonCode: KillSwitchReasonCode = "CHALLENGE_EVIDENCE_UNAVAILABLE",
): KillSwitchValidationResult {
  return baseResult(input, {
    validatedEvidenceIds,
    missingEvidenceIds,
    validatedCandidateIds,
    reasonCodes: [reasonCode],
    diagnostics: [diagnostic],
  });
}

function resolveEvidence(
  input: KillSwitchValidationInput,
): {
  items: KillSwitchEvidenceItem[];
  missingIds: string[];
  duplicateIds: string[];
} {
  const requestedIds = unique(input.challenge.evidenceIds);
  const byId = new Map<string, KillSwitchEvidenceItem>();
  const duplicateIds = new Set<string>();

  for (const item of input.evidence.items) {
    if (byId.has(item.id)) {
      duplicateIds.add(item.id);
    } else {
      byId.set(item.id, item);
    }
  }

  const items = requestedIds.flatMap((id) => {
    const item = byId.get(id);
    return item === undefined ? [] : [item];
  });
  const missingIds = requestedIds.filter((id) => !byId.has(id));

  return {
    items,
    missingIds,
    duplicateIds: [...duplicateIds].filter((id) => requestedIds.includes(id)),
  };
}

function resolveCandidateIds(input: KillSwitchValidationInput): {
  validatedIds: string[];
  missingIds: string[];
} {
  const requestedIds = unique(input.challenge.candidateIds ?? []);
  const knownIds = new Set(
    input.comparison.candidates.map((candidate) => candidate.id),
  );

  return {
    validatedIds: requestedIds.filter((id) => knownIds.has(id)),
    missingIds: requestedIds.filter((id) => !knownIds.has(id)),
  };
}

function resolveAssets(input: KillSwitchValidationInput): string[] {
  const requestedAssets = unique(input.challenge.assets ?? []);
  const knownAssets = new Set(
    input.comparison.candidates.map((candidate) => candidate.evaluation.asset),
  );
  return requestedAssets.filter((asset) => !knownAssets.has(asset));
}

function checkForChallengeType(
  input: KillSwitchValidationInput,
  items: readonly KillSwitchEvidenceItem[],
): KillSwitchCheckResult {
  switch (input.challenge.challengeType) {
    case "DIRECTION_CONTRADICTION":
      return checkDirectionContradiction(input, items);
    case "SINGLE_SOURCE_FRAGILITY":
      return checkSingleSourceFragility(items);
    case "REGIME_CONFLICT":
      return checkRegimeConflict(input, items);
    case "RELATIVE_OPPORTUNITY_FAILURE":
      return checkRelativeOpportunityFailure(input);
    case "RISK_INCOMPATIBILITY":
      return checkRiskIncompatibility(input, items);
    case "SAFETY_FAILURE":
      return checkSafetyFailure(input, items);
    case "MISSING_CRITICAL_EVIDENCE":
      return checkMissingCriticalEvidence(input);
    case "NARRATIVE_DISTORTION":
      return {
        verdict: KILL_SWITCH_VERDICTS.UNKNOWN,
        severity: KILL_SWITCH_SEVERITIES.NONE,
        effect: KILL_SWITCH_EFFECTS.NONE,
        reasonCodes: ["UNSUPPORTED_CHALLENGE_TYPE"],
        diagnostics: [
          "Narrative distortion is reserved for a later policy version.",
        ],
      };
  }
}

export function validateKillSwitch(
  input: KillSwitchValidationInput,
): KillSwitchValidationResult {
  if (!isKillSwitchChallengeType(input.challenge.challengeType)) {
    return unsupportedResult(input);
  }

  if (input.challenge.challengeType === "NARRATIVE_DISTORTION") {
    return unsupportedResult(input);
  }

  const evidence = resolveEvidence(input);
  const candidates = resolveCandidateIds(input);
  const invalidAssets = resolveAssets(input);

  if (evidence.missingIds.length > 0 || evidence.duplicateIds.length > 0) {
    const duplicateDiagnostic =
      evidence.duplicateIds.length > 0
        ? `Evidence IDs are not unique: ${evidence.duplicateIds.join(", ")}.`
        : "One or more referenced evidence IDs are unavailable.";
    return unavailableEvidenceResult(
      input,
      evidence.missingIds,
      evidence.items.map((item) => item.id),
      candidates.validatedIds,
      duplicateDiagnostic,
    );
  }

  if (candidates.missingIds.length > 0 || invalidAssets.length > 0) {
    const references = [
      ...candidates.missingIds,
      ...invalidAssets,
    ];
    return unavailableEvidenceResult(
      input,
      [],
      evidence.items.map((item) => item.id),
      candidates.validatedIds,
      `One or more referenced candidates are unavailable: ${references.join(", ")}.`,
      "CHALLENGE_CANDIDATE_UNAVAILABLE",
    );
  }

  if (evidence.items.length === 0) {
    return unavailableEvidenceResult(
      input,
      [],
      [],
      candidates.validatedIds,
      "A supported challenge must reference at least one evidence ID.",
    );
  }

  return fromCheck(
    input,
    evidence.items,
    checkForChallengeType(input, evidence.items),
    candidates.validatedIds,
  );
}

function uniqueReasonCodes(
  results: readonly KillSwitchValidationResult[],
): KillSwitchReasonCode[] {
  return [
    ...new Set(results.flatMap((result) => result.reasonCodes)),
  ];
}

function uniqueDiagnostics(
  results: readonly KillSwitchValidationResult[],
): string[] {
  return [...new Set(results.flatMap((result) => result.diagnostics))];
}

export function aggregateKillSwitchResults(
  results: readonly KillSwitchValidationResult[],
): KillSwitchAggregateResult {
  const veto = results.find(
    (result) => result.verdict === KILL_SWITCH_VERDICTS.VETO,
  );
  const criticalUnknown = results.find(
    (result) =>
      result.verdict === KILL_SWITCH_VERDICTS.UNKNOWN &&
      result.severity === KILL_SWITCH_SEVERITIES.CRITICAL,
  );
  const caution = results.filter(
    (result) => result.verdict === KILL_SWITCH_VERDICTS.CAUTION,
  );
  const nonCriticalUnknown = results.find(
    (result) =>
      result.verdict === KILL_SWITCH_VERDICTS.UNKNOWN &&
      result.severity !== KILL_SWITCH_SEVERITIES.CRITICAL,
  );

  let verdict: KillSwitchVerdict = KILL_SWITCH_VERDICTS.CLEAR;
  let severity: KillSwitchSeverity = KILL_SWITCH_SEVERITIES.NONE;
  let effect: KillSwitchEffect = KILL_SWITCH_EFFECTS.NONE;

  if (veto !== undefined) {
    verdict = KILL_SWITCH_VERDICTS.VETO;
    severity = KILL_SWITCH_SEVERITIES.CRITICAL;
    effect = KILL_SWITCH_EFFECTS.VETO;
  } else if (criticalUnknown !== undefined) {
    verdict = KILL_SWITCH_VERDICTS.UNKNOWN;
    severity = KILL_SWITCH_SEVERITIES.CRITICAL;
  } else if (caution.length > 0) {
    verdict = KILL_SWITCH_VERDICTS.CAUTION;
    severity = KILL_SWITCH_SEVERITIES.HIGH;
    effect = caution.some(
      (result) => result.effect === KILL_SWITCH_EFFECTS.RECOMPUTE,
    )
      ? KILL_SWITCH_EFFECTS.RECOMPUTE
      : KILL_SWITCH_EFFECTS.CAUTION;
  } else if (nonCriticalUnknown !== undefined) {
    verdict = KILL_SWITCH_VERDICTS.UNKNOWN;
    severity = nonCriticalUnknown.severity;
  }

  return {
    verdict,
    severity,
    effect,
    results,
    reasonCodes: uniqueReasonCodes(results),
    diagnostics: uniqueDiagnostics(results),
  };
}
