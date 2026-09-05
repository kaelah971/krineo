import { createHash } from "node:crypto";
import {
  DIRECTIONAL_EVIDENCE_DIMENSIONS,
  type DirectionalEvidenceDimension,
  type EvidenceItem,
} from "../evidence/types";
import {
  KILL_SWITCH_CHALLENGE_TYPES,
} from "../killswitch/types";
import type { CandidateEvaluation } from "../strategy/dm1/types";
import {
  INVALIDATION_RULE_TYPE_ORDER,
  RECEIPT_MODES,
  RECEIPT_SCHEMA_VERSION,
  THESIS_RECEIPT_REJECTION_CODES,
  type InvalidationRule,
  type ReceiptCandidateSummary,
  type ReceiptChallengeSummary,
  type ReceiptEvidenceSummary,
  type ReceiptKillSwitchState,
  type ThesisReceipt,
  type ThesisReceiptCanonicalPayload,
  type ThesisReceiptInput,
  type ThesisReceiptRejection,
  type ThesisReceiptResult,
} from "./types";

const DIMENSION_ORDER: readonly DirectionalEvidenceDimension[] = [
  DIRECTIONAL_EVIDENCE_DIMENSIONS.DIRECTIONAL_MOMENTUM,
  DIRECTIONAL_EVIDENCE_DIMENSIONS.TECHNICAL_CONFLUENCE,
  DIRECTIONAL_EVIDENCE_DIMENSIONS.RELATIVE_OPPORTUNITY,
  DIRECTIONAL_EVIDENCE_DIMENSIONS.MARKET_ALIGNMENT,
  DIRECTIONAL_EVIDENCE_DIMENSIONS.SENTIMENT_DERIVATIVES,
];

const CHALLENGE_TYPE_ORDER = [
  KILL_SWITCH_CHALLENGE_TYPES.DIRECTION_CONTRADICTION,
  KILL_SWITCH_CHALLENGE_TYPES.SINGLE_SOURCE_FRAGILITY,
  KILL_SWITCH_CHALLENGE_TYPES.REGIME_CONFLICT,
  KILL_SWITCH_CHALLENGE_TYPES.RELATIVE_OPPORTUNITY_FAILURE,
  KILL_SWITCH_CHALLENGE_TYPES.RISK_INCOMPATIBILITY,
  KILL_SWITCH_CHALLENGE_TYPES.SAFETY_FAILURE,
  KILL_SWITCH_CHALLENGE_TYPES.NARRATIVE_DISTORTION,
  KILL_SWITCH_CHALLENGE_TYPES.MISSING_CRITICAL_EVIDENCE,
] as const;

function compareLexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedStrings<T extends string>(items: readonly T[]): T[] {
  return [...items].sort(compareLexical);
}

function rejection(
  code: ThesisReceiptRejection["code"],
  message: string,
): ThesisReceiptRejection {
  return { ok: false, code, message };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isInvalidationConditionValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    isFiniteNumber(value) ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function dimensionRank(dimension: string): number {
  const rank = DIMENSION_ORDER.indexOf(
    dimension as DirectionalEvidenceDimension,
  );
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function compareEvidence(
  left: ReceiptEvidenceSummary,
  right: ReceiptEvidenceSummary,
): number {
  const dimensionDifference =
    dimensionRank(left.dimension) - dimensionRank(right.dimension);
  return dimensionDifference !== 0
    ? dimensionDifference
    : compareLexical(left.id, right.id);
}

function challengeTypeRank(challengeType: string): number {
  const rank = CHALLENGE_TYPE_ORDER.indexOf(
    challengeType as (typeof CHALLENGE_TYPE_ORDER)[number],
  );
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function compareChallenges(
  left: ReceiptChallengeSummary,
  right: ReceiptChallengeSummary,
): number {
  const typeDifference =
    challengeTypeRank(left.challengeType) - challengeTypeRank(right.challengeType);
  return typeDifference !== 0
    ? typeDifference
    : typeDifference === 0 && left.challengeType !== right.challengeType
      ? compareLexical(left.challengeType, right.challengeType)
      : compareLexical(left.challengeId, right.challengeId);
}

function invalidationRuleTypeRank(ruleType: string): number {
  const rank = INVALIDATION_RULE_TYPE_ORDER.indexOf(
    ruleType as (typeof INVALIDATION_RULE_TYPE_ORDER)[number],
  );
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function compareInvalidationRules(
  left: InvalidationRule,
  right: InvalidationRule,
): number {
  const typeDifference =
    invalidationRuleTypeRank(left.ruleType) -
    invalidationRuleTypeRank(right.ruleType);
  return typeDifference !== 0
    ? typeDifference
    : typeDifference === 0 && left.ruleType !== right.ruleType
      ? compareLexical(left.ruleType, right.ruleType)
      : compareLexical(left.id, right.id);
}

function compareCandidateSummaries(
  left: ReceiptCandidateSummary,
  right: ReceiptCandidateSummary,
): number {
  const rankDifference = left.rank - right.rank;
  return rankDifference !== 0
    ? rankDifference
    : compareLexical(left.asset, right.asset);
}

function candidateStrength(candidate: CandidateEvaluation): number {
  return candidate.thesisStrength ?? Number.NEGATIVE_INFINITY;
}

function candidateConflict(candidate: CandidateEvaluation): number {
  return candidate.conflict ?? Number.POSITIVE_INFINITY;
}

function compareCandidates(
  left: CandidateEvaluation,
  right: CandidateEvaluation,
): number {
  const strengthDifference = candidateStrength(right) - candidateStrength(left);
  if (strengthDifference !== 0) {
    return strengthDifference;
  }

  const conflictDifference = candidateConflict(left) - candidateConflict(right);
  if (conflictDifference !== 0) {
    return conflictDifference;
  }

  const coverageDifference = right.coverage - left.coverage;
  if (coverageDifference !== 0) {
    return coverageDifference;
  }

  return compareLexical(left.asset, right.asset);
}

function toEvidenceSummary(item: EvidenceItem): ReceiptEvidenceSummary {
  return {
    id: item.id,
    dimension: item.dimension,
    state: item.state,
    source: item.source,
    observedAt: item.observedAt,
    reasonCode: item.reasonCode,
  };
}

function classifyEvidence(
  decision: ThesisReceiptInput["version"]["decision"],
  evidenceItems: readonly EvidenceItem[],
): {
  supportingEvidence: ReceiptEvidenceSummary[];
  contradictingEvidence: ReceiptEvidenceSummary[];
  neutralEvidence: ReceiptEvidenceSummary[];
  availableEvidence: ReceiptEvidenceSummary[];
  unknownEvidence: ReceiptEvidenceSummary[];
} {
  const summaries = evidenceItems.map(toEvidenceSummary).sort(compareEvidence);
  const unknownEvidence = summaries.filter((item) => item.state === "UNKNOWN");
  const available = summaries.filter((item) => item.state !== "UNKNOWN");

  if (decision === "ABSTAIN") {
    return {
      supportingEvidence: [],
      contradictingEvidence: [],
      neutralEvidence: [],
      availableEvidence: available,
      unknownEvidence,
    };
  }

  const supportingStates =
    decision === "LONG"
      ? ["SUPPORTIVE", "STRONGLY_SUPPORTIVE"]
      : ["OPPOSING", "STRONGLY_OPPOSING"];
  const contradictingStates =
    decision === "LONG"
      ? ["OPPOSING", "STRONGLY_OPPOSING"]
      : ["SUPPORTIVE", "STRONGLY_SUPPORTIVE"];

  return {
    supportingEvidence: available.filter((item) =>
      supportingStates.includes(item.state),
    ),
    contradictingEvidence: available.filter((item) =>
      contradictingStates.includes(item.state),
    ),
    neutralEvidence: available.filter((item) => item.state === "NEUTRAL"),
    availableEvidence: [],
    unknownEvidence,
  };
}

function toCandidateSummary(
  candidate: CandidateEvaluation,
  rank: number,
): ReceiptCandidateSummary {
  return {
    rank,
    asset: candidate.asset,
    decision: candidate.decision,
    directionalScore: candidate.directionalScore,
    thesisStrength: candidate.thesisStrength,
    coverage: candidate.coverage,
    coverageLabel: candidate.coverageLabel,
    conflict: candidate.conflict,
    conflictLabel: candidate.conflictLabel,
    risk: candidate.risk,
    safety: candidate.safety,
    regimeFit: candidate.regimeFit,
    selected: candidate.selected,
    reasonCodes: sortedStrings(candidate.reasonCodes),
    warningCodes: sortedStrings(candidate.warningCodes),
  };
}

function canonicalRule(rule: InvalidationRule): InvalidationRule {
  const baseCondition = {
    field: rule.condition.field,
    operator: rule.condition.operator,
    value: rule.condition.value,
  } satisfies Omit<InvalidationRule["condition"], "parameters">;
  const condition =
    rule.condition.parameters === undefined
      ? baseCondition
      : {
          ...baseCondition,
          parameters: { ...rule.condition.parameters },
        };
  const baseRule = {
    id: rule.id,
    ruleType: rule.ruleType,
    effect: rule.effect,
    condition,
    ...(rule.strategyId === undefined ? {} : { strategyId: rule.strategyId }),
    ...(rule.strategyVersion === undefined
      ? {}
      : { strategyVersion: rule.strategyVersion }),
    ...(rule.direction === undefined ? {} : { direction: rule.direction }),
  } satisfies Omit<InvalidationRule, "description">;

  return rule.description === undefined
    ? baseRule
    : { ...baseRule, description: rule.description };
}

function canonicalKillSwitch(
  killSwitch: ReceiptKillSwitchState | null,
): ReceiptKillSwitchState | null {
  if (killSwitch === null) {
    return null;
  }

  const baseState = {
    verdict: killSwitch.verdict,
    reasonCodes: sortedStrings(killSwitch.reasonCodes),
    challenges: [...killSwitch.challenges]
      .map((challenge) => ({
        challengeId: challenge.challengeId,
        challengeType: challenge.challengeType,
        verdict: challenge.verdict,
        severity: challenge.severity,
        effect: challenge.effect,
        validatedEvidenceIds: sortedStrings(challenge.validatedEvidenceIds),
        reasonCodes: sortedStrings(challenge.reasonCodes),
      }))
      .sort(compareChallenges),
  } satisfies Omit<ReceiptKillSwitchState, "runId">;

  return killSwitch.runId === undefined
    ? baseState
    : { ...baseState, runId: killSwitch.runId };
}

function canonicalEvidenceList(
  items: readonly ReceiptEvidenceSummary[],
): ReceiptEvidenceSummary[] {
  return [...items]
    .map((item) => ({
      id: item.id,
      dimension: item.dimension,
      state: item.state,
      source: item.source,
      observedAt: item.observedAt,
      reasonCode: item.reasonCode,
    }))
    .sort(compareEvidence);
}

function canonicalCandidateList(
  items: readonly ReceiptCandidateSummary[],
): ReceiptCandidateSummary[] {
  return [...items]
    .map((item) => ({
      rank: item.rank,
      asset: item.asset,
      decision: item.decision,
      directionalScore: item.directionalScore,
      thesisStrength: item.thesisStrength,
      coverage: item.coverage,
      coverageLabel: item.coverageLabel,
      conflict: item.conflict,
      conflictLabel: item.conflictLabel,
      risk: item.risk,
      safety: item.safety,
      regimeFit: item.regimeFit,
      selected: item.selected,
      reasonCodes: sortedStrings(item.reasonCodes),
      warningCodes: sortedStrings(item.warningCodes),
    }))
    .sort(compareCandidateSummaries);
}

function canonicalRuleList(
  rules: readonly InvalidationRule[],
): InvalidationRule[] {
  return [...rules].map(canonicalRule).sort(compareInvalidationRules);
}

export function serializeCanonicalReceiptPayload(
  payload: ThesisReceiptCanonicalPayload,
): string {
  const basePayload = {
    receiptSchemaVersion: payload.receiptSchemaVersion,
    thesisId: payload.thesisId,
    thesisVersionId: payload.thesisVersionId,
    versionNumber: payload.versionNumber,
    asset: payload.asset,
    statusAtCommit: payload.statusAtCommit,
    decision: payload.decision,
    directionalScore: payload.directionalScore,
    thesisStrength: payload.thesisStrength,
    coverage: payload.coverage,
    coverageLabel: payload.coverageLabel,
    conflict: payload.conflict,
    conflictLabel: payload.conflictLabel,
    risk: payload.risk,
    safety: payload.safety,
    regimeFit: payload.regimeFit,
    strategyId: payload.strategyId,
    strategyVersion: payload.strategyVersion,
    normalizerVersion: payload.normalizerVersion,
    evidenceSnapshotId: payload.evidenceSnapshotId,
    supportingEvidence: canonicalEvidenceList(payload.supportingEvidence),
    contradictingEvidence: canonicalEvidenceList(payload.contradictingEvidence),
    neutralEvidence: canonicalEvidenceList(payload.neutralEvidence),
    availableEvidence: canonicalEvidenceList(payload.availableEvidence),
    unknownEvidence: canonicalEvidenceList(payload.unknownEvidence),
    candidateRanking: canonicalCandidateList(payload.candidateRanking),
    killSwitch: canonicalKillSwitch(payload.killSwitch),
    invalidationRules: canonicalRuleList(payload.invalidationRules),
    reasonCodes: sortedStrings(payload.reasonCodes),
    warningCodes: sortedStrings(payload.warningCodes),
    createdAt: payload.createdAt,
  } satisfies ThesisReceiptCanonicalPayload;

  return JSON.stringify(basePayload);
}

export function canonicalizeThesisReceipt(receipt: ThesisReceipt): string {
  return serializeCanonicalReceiptPayload(receipt);
}

export function hashCanonicalReceipt(serialized: string): string {
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

export function hashThesisReceipt(receipt: ThesisReceipt): string {
  return hashCanonicalReceipt(canonicalizeThesisReceipt(receipt));
}

function validateVersionState(
  input: ThesisReceiptInput,
): ThesisReceiptRejection | null {
  if (!Number.isInteger(input.version.versionNumber) || input.version.versionNumber < 1) {
    return rejection(
      THESIS_RECEIPT_REJECTION_CODES.INVALID_VERSION,
      "The committed ThesisVersion number must be a positive integer.",
    );
  }

  if (!isNonEmptyString(input.version.statusAtCommit)) {
    return rejection(
      THESIS_RECEIPT_REJECTION_CODES.INVALID_RECEIPT_INPUT,
      "The committed ThesisVersion must preserve its lifecycle status at commit.",
    );
  }

  const numericValues: readonly unknown[] = [
    input.version.directionalScore,
    input.version.thesisStrength,
    input.version.coverage,
    input.version.conflict,
  ];
  if (numericValues.some((value) => !isNullableFiniteNumber(value))) {
    return rejection(
      THESIS_RECEIPT_REJECTION_CODES.INVALID_NUMERIC_STATE,
      "Committed ThesisVersion metrics must be finite numbers or null.",
    );
  }

  return null;
}

function validateEvidence(
  evidenceItems: readonly EvidenceItem[],
): ThesisReceiptRejection | null {
  const ids = new Set<string>();
  for (const item of evidenceItems) {
    if (
      !isNonEmptyString(item.id) ||
      !isNonEmptyString(item.source) ||
      !isNonEmptyString(item.observedAt) ||
      ids.has(item.id)
    ) {
      return rejection(
        THESIS_RECEIPT_REJECTION_CODES.INVALID_EVIDENCE,
        "Receipt evidence must have unique stable IDs, sources and observation timestamps.",
      );
    }
    ids.add(item.id);
  }
  return null;
}

function validateCandidates(
  candidates: readonly CandidateEvaluation[],
): ThesisReceiptRejection | null {
  const assets = new Set<string>();
  for (const candidate of candidates) {
    if (!isNonEmptyString(candidate.asset) || assets.has(candidate.asset)) {
      return rejection(
        THESIS_RECEIPT_REJECTION_CODES.INVALID_CANDIDATE_RANKING,
        "Candidate ranking must contain unique non-empty asset identifiers.",
      );
    }

    const numericValues: readonly unknown[] = [
      candidate.directionalScore,
      candidate.thesisStrength,
      candidate.coverage,
      candidate.conflict,
    ];
    if (numericValues.some((value) => !isNullableFiniteNumber(value))) {
      return rejection(
        THESIS_RECEIPT_REJECTION_CODES.INVALID_NUMERIC_STATE,
        "Candidate ranking metrics must be finite numbers or null.",
      );
    }
    assets.add(candidate.asset);
  }
  return null;
}

function validateInvalidationRules(
  rules: readonly InvalidationRule[],
): ThesisReceiptRejection | null {
  const ids = new Set<string>();
  for (const rule of rules) {
    const condition = rule.condition;
    const parameters = condition?.parameters;
    const conditionValue = condition?.value;
    if (
      !isNonEmptyString(rule.id) ||
      ids.has(rule.id) ||
      condition === null ||
      typeof condition !== "object" ||
      !isNonEmptyString(condition.field) ||
      !isNonEmptyString(condition.operator) ||
      !isInvalidationConditionValue(conditionValue) ||
      (parameters !== undefined &&
        (typeof parameters !== "object" ||
          Object.values(parameters).some(
            (value) => !isInvalidationConditionValue(value),
          ))) ||
      (rule.strategyId !== undefined && !isNonEmptyString(rule.strategyId)) ||
      (rule.strategyVersion !== undefined &&
        !isNonEmptyString(rule.strategyVersion)) ||
      (rule.direction !== undefined &&
        rule.direction !== "LONG" &&
        rule.direction !== "SHORT")
    ) {
      return rejection(
        THESIS_RECEIPT_REJECTION_CODES.INVALID_INVALIDATION_RULE,
        "Invalidation rules must have unique IDs and finite structured conditions.",
      );
    }
    ids.add(rule.id);
  }
  return null;
}

function buildKillSwitchState(
  input: ThesisReceiptInput,
  evidenceIds: ReadonlySet<string>,
): { state: ReceiptKillSwitchState | null; rejection: ThesisReceiptRejection | null } {
  const versionVerdict = input.version.killSwitchVerdict;
  const aggregateVerdict = input.killSwitch?.verdict;
  const verdict = aggregateVerdict ?? versionVerdict;

  if (
    versionVerdict !== undefined &&
    aggregateVerdict !== undefined &&
    versionVerdict !== aggregateVerdict
  ) {
    return {
      state: null,
      rejection: rejection(
        THESIS_RECEIPT_REJECTION_CODES.KILLSWITCH_MISMATCH,
        "KillSwitch aggregate verdict does not match the committed ThesisVersion.",
      ),
    };
  }

  if (
    input.killSwitchRunId !== undefined &&
    input.version.killSwitchRunId !== undefined &&
    input.killSwitchRunId !== input.version.killSwitchRunId
  ) {
    return {
      state: null,
      rejection: rejection(
        THESIS_RECEIPT_REJECTION_CODES.KILLSWITCH_MISMATCH,
        "KillSwitch run ID does not match the committed ThesisVersion.",
      ),
    };
  }

  if (
    (input.version.killSwitchRunId !== undefined &&
      !isNonEmptyString(input.version.killSwitchRunId)) ||
    (input.killSwitchRunId !== undefined &&
      !isNonEmptyString(input.killSwitchRunId))
  ) {
    return {
      state: null,
      rejection: rejection(
        THESIS_RECEIPT_REJECTION_CODES.KILLSWITCH_MISMATCH,
        "KillSwitch run IDs must be non-empty when supplied.",
      ),
    };
  }

  if (
    (input.version.decision === "LONG" || input.version.decision === "SHORT") &&
    verdict === undefined
  ) {
    return {
      state: null,
      rejection: rejection(
        THESIS_RECEIPT_REJECTION_CODES.KILLSWITCH_MISSING,
        "A directional ThesisVersion must preserve its KillSwitch verdict.",
      ),
    };
  }

  if (verdict === undefined) {
    if (input.killSwitchRunId !== undefined || input.version.killSwitchRunId !== undefined) {
      return {
        state: null,
        rejection: rejection(
          THESIS_RECEIPT_REJECTION_CODES.KILLSWITCH_MISMATCH,
          "A KillSwitch run ID cannot be recorded without a KillSwitch verdict.",
        ),
      };
    }
    return { state: null, rejection: null };
  }

  const challenges: ReceiptChallengeSummary[] = [];
  const challengeIds = new Set<string>();
  for (const result of input.killSwitch?.results ?? []) {
    if (
      !isNonEmptyString(result.challengeId) ||
      challengeIds.has(result.challengeId) ||
      result.validatedEvidenceIds.some((id) => !evidenceIds.has(id)) ||
      new Set(result.validatedEvidenceIds).size !== result.validatedEvidenceIds.length
    ) {
      return {
        state: null,
        rejection: rejection(
          THESIS_RECEIPT_REJECTION_CODES.KILLSWITCH_MISMATCH,
          "KillSwitch challenge summaries must contain unique validated references.",
        ),
      };
    }
    challengeIds.add(result.challengeId);
    challenges.push({
      challengeId: result.challengeId,
      challengeType: result.challengeType,
      verdict: result.verdict,
      severity: result.severity,
      effect: result.effect,
      validatedEvidenceIds: sortedStrings(result.validatedEvidenceIds),
      reasonCodes: sortedStrings(result.reasonCodes),
    });
  }

  const runId = input.killSwitchRunId ?? input.version.killSwitchRunId;
  const baseState = {
    verdict,
    reasonCodes: sortedStrings(input.killSwitch?.reasonCodes ?? []),
    challenges: challenges.sort(compareChallenges),
  } satisfies Omit<ReceiptKillSwitchState, "runId">;

  return {
    state: runId === undefined ? baseState : { ...baseState, runId },
    rejection: null,
  };
}

function buildCandidateRanking(
  candidates: readonly CandidateEvaluation[],
): ReceiptCandidateSummary[] {
  return [...candidates]
    .sort(compareCandidates)
    .map((candidate, index) => toCandidateSummary(candidate, index + 1));
}

function buildCanonicalPayload(
  input: ThesisReceiptInput,
): { payload: ThesisReceiptCanonicalPayload } | { rejection: ThesisReceiptRejection } {
  if (
    !isNonEmptyString(input.receiptId) ||
    !isNonEmptyString(input.normalizerVersion) ||
    !isNonEmptyString(input.version.createdAt) ||
    (input.receiptMode !== undefined &&
      input.receiptMode !== RECEIPT_MODES.CURRENT &&
      input.receiptMode !== RECEIPT_MODES.HISTORICAL)
  ) {
    return {
      rejection: rejection(
        THESIS_RECEIPT_REJECTION_CODES.INVALID_RECEIPT_INPUT,
        "Receipt ID, normalizer version and committed timestamp are required.",
      ),
    };
  }

  if (input.thesis.id !== input.version.thesisId) {
    return {
      rejection: rejection(
        THESIS_RECEIPT_REJECTION_CODES.THESIS_ID_MISMATCH,
        "Thesis identity does not match the committed ThesisVersion.",
      ),
    };
  }

  if (input.thesis.asset !== input.version.asset) {
    return {
      rejection: rejection(
        THESIS_RECEIPT_REJECTION_CODES.ASSET_MISMATCH,
        "Thesis asset does not match the committed ThesisVersion.",
      ),
    };
  }

  if ((input.receiptMode ?? RECEIPT_MODES.CURRENT) === RECEIPT_MODES.CURRENT) {
    if (
      input.thesis.currentVersionId !== input.version.id ||
      input.thesis.currentVersionNumber !== input.version.versionNumber
    ) {
      return {
        rejection: rejection(
          THESIS_RECEIPT_REJECTION_CODES.VERSION_NOT_CURRENT,
          "Current receipt construction requires the Thesis current-version pointer to match.",
        ),
      };
    }
  }

  const versionStateRejection = validateVersionState(input);
  if (versionStateRejection !== null) {
    return { rejection: versionStateRejection };
  }

  const evidenceRejection = validateEvidence(input.evidenceItems);
  if (evidenceRejection !== null) {
    return { rejection: evidenceRejection };
  }

  const candidateRejection = validateCandidates(input.candidateEvaluations);
  if (candidateRejection !== null) {
    return { rejection: candidateRejection };
  }

  const invalidationRejection = validateInvalidationRules(
    input.invalidationRules,
  );
  if (invalidationRejection !== null) {
    return { rejection: invalidationRejection };
  }

  const killSwitch = buildKillSwitchState(
    input,
    new Set(input.evidenceItems.map((item) => item.id)),
  );
  if (killSwitch.rejection !== null) {
    return { rejection: killSwitch.rejection };
  }

  const evidenceGroups = classifyEvidence(
    input.version.decision,
    input.evidenceItems,
  );
  const payload: ThesisReceiptCanonicalPayload = {
    receiptSchemaVersion: RECEIPT_SCHEMA_VERSION,
    thesisId: input.thesis.id,
    thesisVersionId: input.version.id,
    versionNumber: input.version.versionNumber,
    asset: input.version.asset,
    statusAtCommit: input.version.statusAtCommit,
    decision: input.version.decision,
    directionalScore: input.version.directionalScore,
    thesisStrength: input.version.thesisStrength,
    coverage: input.version.coverage,
    coverageLabel: input.version.coverageLabel,
    conflict: input.version.conflict,
    conflictLabel: input.version.conflictLabel,
    risk: input.version.risk,
    safety: input.version.safety,
    regimeFit: input.version.regimeFit,
    strategyId: input.version.strategyId,
    strategyVersion: input.version.strategyVersion,
    normalizerVersion: input.normalizerVersion,
    evidenceSnapshotId: input.version.evidenceSnapshotId,
    supportingEvidence: evidenceGroups.supportingEvidence,
    contradictingEvidence: evidenceGroups.contradictingEvidence,
    neutralEvidence: evidenceGroups.neutralEvidence,
    availableEvidence: evidenceGroups.availableEvidence,
    unknownEvidence: evidenceGroups.unknownEvidence,
    candidateRanking: buildCandidateRanking(input.candidateEvaluations),
    killSwitch: killSwitch.state,
    invalidationRules: [...input.invalidationRules]
      .map(canonicalRule)
      .sort(compareInvalidationRules),
    reasonCodes: sortedStrings(input.version.reasonCodes),
    warningCodes: sortedStrings(input.version.warningCodes),
    createdAt: input.version.createdAt,
  };

  return { payload };
}

export function buildThesisReceipt(
  input: ThesisReceiptInput,
): ThesisReceiptResult {
  const result = buildCanonicalPayload(input);
  if ("rejection" in result) {
    return result.rejection;
  }

  const canonicalSerialized = serializeCanonicalReceiptPayload(result.payload);
  const canonicalHash = hashCanonicalReceipt(canonicalSerialized);
  const receipt: ThesisReceipt = {
    id: input.receiptId,
    ...result.payload,
    canonicalHash,
  };

  return {
    ok: true,
    receipt,
    canonicalPayload: result.payload,
    canonicalSerialized,
  };
}
