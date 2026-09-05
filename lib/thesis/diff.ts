import {
  DIRECTIONAL_EVIDENCE_DIMENSIONS,
  type DirectionalEvidenceDimension,
  type EvidenceItem,
} from "../evidence/types";
import type { CandidateEvaluation, DecisionResult } from "../strategy/dm1/types";
import type { ReasonCode, WarningCode } from "../strategy/dm1/reason-codes";
import type {
  InvalidationConditionValue,
  InvalidationRule,
  ThesisLifecycleState,
  ThesisVersion,
} from "./types";

const DIMENSION_ORDER: readonly DirectionalEvidenceDimension[] = [
  DIRECTIONAL_EVIDENCE_DIMENSIONS.DIRECTIONAL_MOMENTUM,
  DIRECTIONAL_EVIDENCE_DIMENSIONS.TECHNICAL_CONFLUENCE,
  DIRECTIONAL_EVIDENCE_DIMENSIONS.RELATIVE_OPPORTUNITY,
  DIRECTIONAL_EVIDENCE_DIMENSIONS.MARKET_ALIGNMENT,
  DIRECTIONAL_EVIDENCE_DIMENSIONS.SENTIMENT_DERIVATIVES,
];

const DIRECTIONAL_STATES = new Set<string>([
  "STRONGLY_SUPPORTIVE",
  "SUPPORTIVE",
  "NEUTRAL",
  "OPPOSING",
  "STRONGLY_OPPOSING",
  "UNKNOWN",
]);

const DIRECTIONAL_DIMENSIONS = new Set<string>(DIMENSION_ORDER);

function compareLexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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

function sortedUniqueStrings<T extends string>(items: readonly T[]): T[] {
  return [...new Set(items)].sort(compareLexical);
}

function sameStringList<T extends string>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  const leftSorted = sortedUniqueStrings(left);
  const rightSorted = sortedUniqueStrings(right);
  return (
    leftSorted.length === rightSorted.length &&
    leftSorted.every((item, index) => item === rightSorted[index])
  );
}

function copyEvidence(item: EvidenceItem): EvidenceItem {
  return { ...item };
}

function copyCandidate(candidate: CandidateEvaluation): CandidateEvaluation {
  return {
    ...candidate,
    hardGateResults: candidate.hardGateResults.map((gate) => ({ ...gate })),
    reasonCodes: [...candidate.reasonCodes],
    warningCodes: [...candidate.warningCodes],
  };
}

function copyRule(rule: InvalidationRule): InvalidationRule {
  return {
    ...rule,
    condition: { ...rule.condition },
  };
}

export interface StrategyDiffSnapshot {
  readonly version: ThesisVersion;
  readonly normalizerVersion: string;
  readonly evidenceItems: readonly EvidenceItem[];
  readonly candidateEvaluations: readonly CandidateEvaluation[];
  readonly invalidationRules: readonly InvalidationRule[];
}

export interface StrategyDiffInput {
  readonly before: StrategyDiffSnapshot;
  readonly after: StrategyDiffSnapshot;
}

export const STRATEGY_DIFF_REJECTION_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_SNAPSHOT: "INVALID_SNAPSHOT",
  INVALID_EVIDENCE: "INVALID_EVIDENCE",
  DUPLICATE_EVIDENCE_ID: "DUPLICATE_EVIDENCE_ID",
  DUPLICATE_EVIDENCE_DIMENSION: "DUPLICATE_EVIDENCE_DIMENSION",
  INVALID_CANDIDATE: "INVALID_CANDIDATE",
  DUPLICATE_CANDIDATE_ASSET: "DUPLICATE_CANDIDATE_ASSET",
  INVALID_INVALIDATION_RULE: "INVALID_INVALIDATION_RULE",
  DUPLICATE_INVALIDATION_RULE_ID: "DUPLICATE_INVALIDATION_RULE_ID",
  THESIS_ID_MISMATCH: "THESIS_ID_MISMATCH",
  ASSET_MISMATCH: "ASSET_MISMATCH",
  STRATEGY_ID_MISMATCH: "STRATEGY_ID_MISMATCH",
  STRATEGY_VERSION_MISMATCH: "STRATEGY_VERSION_MISMATCH",
  NORMALIZER_VERSION_MISMATCH: "NORMALIZER_VERSION_MISMATCH",
} as const;

export type StrategyDiffRejectionCode =
  (typeof STRATEGY_DIFF_REJECTION_CODES)[keyof typeof STRATEGY_DIFF_REJECTION_CODES];

export interface StrategyDiffRejection {
  readonly ok: false;
  readonly code: StrategyDiffRejectionCode;
  readonly message: string;
}

export type EvidenceChangeKind =
  | "UNCHANGED"
  | "PROVENANCE_CHANGED"
  | "STATE_CHANGED"
  | "BECAME_UNKNOWN"
  | "BECAME_AVAILABLE"
  | "ADDED"
  | "REMOVED";

export interface EvidenceChange {
  readonly dimension: DirectionalEvidenceDimension;
  readonly kind: EvidenceChangeKind;
  readonly before: EvidenceItem | null;
  readonly after: EvidenceItem | null;
  readonly changed: boolean;
  readonly stateChanged: boolean;
  readonly semanticChanged: boolean;
  readonly provenanceChanged: boolean;
  readonly observationChanged: boolean;
}

export interface NumberDiff {
  readonly before: number | null;
  readonly after: number | null;
  readonly changed: boolean;
  readonly delta: number | null;
}

export interface ValueDiff<T> {
  readonly before: T;
  readonly after: T;
  readonly changed: boolean;
}

export interface StringListDiff<T extends string> {
  readonly before: readonly T[];
  readonly after: readonly T[];
  readonly added: readonly T[];
  readonly removed: readonly T[];
  readonly changed: boolean;
}

export interface CandidateRankEntry {
  readonly asset: string;
  readonly rank: number;
  readonly selected: boolean;
}

export interface CandidateChange {
  readonly asset: string;
  readonly before: CandidateEvaluation | null;
  readonly after: CandidateEvaluation | null;
  readonly beforeRank: number | null;
  readonly afterRank: number | null;
  readonly rankChanged: boolean;
  readonly selectedChanged: boolean;
  readonly changed: boolean;
}

export interface CandidateRankingDiff {
  readonly before: readonly CandidateRankEntry[];
  readonly after: readonly CandidateRankEntry[];
  readonly changes: readonly CandidateChange[];
  readonly changed: boolean;
}

export type InvalidationRuleChangeKind =
  | "UNCHANGED"
  | "CHANGED"
  | "ADDED"
  | "REMOVED";

export interface InvalidationRuleChange {
  readonly id: string;
  readonly kind: InvalidationRuleChangeKind;
  readonly before: InvalidationRule | null;
  readonly after: InvalidationRule | null;
  readonly changed: boolean;
}

export interface InvalidationRuleDiff {
  readonly before: readonly InvalidationRule[];
  readonly after: readonly InvalidationRule[];
  readonly changes: readonly InvalidationRuleChange[];
  readonly changed: boolean;
}

export interface StrategyDiff {
  readonly thesisId: string;
  readonly asset: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly normalizerVersion: string;
  readonly version: ValueDiff<number>;
  readonly lifecycleStatus: ValueDiff<ThesisLifecycleState>;
  readonly evidenceSnapshot: ValueDiff<string>;
  readonly evidenceChanges: readonly EvidenceChange[];
  readonly newlyMissingEvidence: readonly EvidenceChange[];
  readonly newlyAvailableEvidence: readonly EvidenceChange[];
  readonly provenanceChanges: readonly EvidenceChange[];
  readonly score: NumberDiff;
  readonly thesisStrength: NumberDiff;
  readonly coverage: NumberDiff;
  readonly conflict: NumberDiff;
  readonly decision: ValueDiff<DecisionResult["decision"]>;
  readonly risk: ValueDiff<ThesisVersion["risk"]>;
  readonly safety: ValueDiff<ThesisVersion["safety"]>;
  readonly regimeFit: ValueDiff<ThesisVersion["regimeFit"]>;
  readonly reasonCodes: StringListDiff<ReasonCode>;
  readonly warningCodes: StringListDiff<WarningCode>;
  readonly candidateRanking: CandidateRankingDiff;
  readonly invalidationRules: InvalidationRuleDiff;
  readonly hasMeaningfulChange: boolean;
}

export interface StrategyDiffSuccess {
  readonly ok: true;
  readonly diff: StrategyDiff;
}

export type StrategyDiffResult = StrategyDiffSuccess | StrategyDiffRejection;

function rejection(
  code: StrategyDiffRejectionCode,
  message: string,
): StrategyDiffRejection {
  return { ok: false, code, message };
}

function validateSnapshot(
  snapshot: StrategyDiffSnapshot,
): StrategyDiffRejection | null {
  if (
    snapshot === null ||
    typeof snapshot !== "object" ||
    snapshot.version === null ||
    typeof snapshot.version !== "object" ||
    !isNonEmptyString(snapshot.normalizerVersion) ||
    !Array.isArray(snapshot.evidenceItems) ||
    !Array.isArray(snapshot.candidateEvaluations) ||
    !Array.isArray(snapshot.invalidationRules)
  ) {
    return rejection(
      STRATEGY_DIFF_REJECTION_CODES.INVALID_SNAPSHOT,
      "Strategy Diff snapshots must contain a ThesisVersion, normalizer version and structured arrays.",
    );
  }

  const version = snapshot.version;
  if (
    !isNonEmptyString(version.id) ||
    !isNonEmptyString(version.thesisId) ||
    !isNonEmptyString(version.asset) ||
    !isNonEmptyString(version.strategyId) ||
    !isNonEmptyString(version.strategyVersion) ||
    !isNonEmptyString(version.evidenceSnapshotId) ||
    !isNonEmptyString(version.createdAt)
  ) {
    return rejection(
      STRATEGY_DIFF_REJECTION_CODES.INVALID_SNAPSHOT,
      "ThesisVersion identifiers, asset, strategy metadata and timestamps are required.",
    );
  }

  const versionNumbers: readonly unknown[] = [
    version.directionalScore,
    version.thesisStrength,
    version.coverage,
    version.conflict,
  ];
  if (versionNumbers.some((value) => !isNullableFiniteNumber(value))) {
    return rejection(
      STRATEGY_DIFF_REJECTION_CODES.INVALID_SNAPSHOT,
      "ThesisVersion metrics must be finite numbers or null.",
    );
  }

  const evidenceIds = new Set<string>();
  const evidenceDimensions = new Set<string>();
  for (const item of snapshot.evidenceItems) {
    if (
      item === null ||
      typeof item !== "object" ||
      !isNonEmptyString(item.id) ||
      !isNonEmptyString(item.source) ||
      !isNonEmptyString(item.observedAt) ||
      !DIRECTIONAL_DIMENSIONS.has(item.dimension) ||
      !DIRECTIONAL_STATES.has(item.state)
    ) {
      return rejection(
        STRATEGY_DIFF_REJECTION_CODES.INVALID_EVIDENCE,
        "Evidence items require stable IDs, sources, timestamps and valid directional states.",
      );
    }

    if (evidenceIds.has(item.id)) {
      return rejection(
        STRATEGY_DIFF_REJECTION_CODES.DUPLICATE_EVIDENCE_ID,
        "Evidence item IDs must be unique within each Strategy Diff snapshot.",
      );
    }
    if (evidenceDimensions.has(item.dimension)) {
      return rejection(
        STRATEGY_DIFF_REJECTION_CODES.DUPLICATE_EVIDENCE_DIMENSION,
        "Strategy Diff requires at most one canonical evidence item per dimension.",
      );
    }
    evidenceIds.add(item.id);
    evidenceDimensions.add(item.dimension);
  }

  const candidateAssets = new Set<string>();
  for (const candidate of snapshot.candidateEvaluations) {
    if (candidate === null || typeof candidate !== "object" || !isNonEmptyString(candidate.asset)) {
      return rejection(
        STRATEGY_DIFF_REJECTION_CODES.INVALID_CANDIDATE,
        "Candidate evaluations require non-empty asset identifiers.",
      );
    }
    if (candidateAssets.has(candidate.asset)) {
      return rejection(
        STRATEGY_DIFF_REJECTION_CODES.DUPLICATE_CANDIDATE_ASSET,
        "Candidate evaluations must contain at most one entry per asset.",
      );
    }
    if (
      !isFiniteNumber(candidate.directionalScore) ||
      !isNullableFiniteNumber(candidate.thesisStrength) ||
      !isFiniteNumber(candidate.coverage) ||
      !isNullableFiniteNumber(candidate.conflict)
    ) {
      return rejection(
        STRATEGY_DIFF_REJECTION_CODES.INVALID_CANDIDATE,
        "Candidate metrics must be finite numbers or null.",
      );
    }
    candidateAssets.add(candidate.asset);
  }

  const ruleIds = new Set<string>();
  for (const rule of snapshot.invalidationRules) {
    const condition = rule?.condition;
    const parameters = condition?.parameters;
    if (
      rule === null ||
      typeof rule !== "object" ||
      !isNonEmptyString(rule.id) ||
      condition === null ||
      typeof condition !== "object" ||
      !isNonEmptyString(condition.field) ||
      !isNonEmptyString(condition.operator) ||
      !isInvalidationConditionValue(condition.value) ||
      (parameters !== undefined &&
        (parameters === null ||
          typeof parameters !== "object" ||
          Object.values(parameters).some(
            (value) => !isInvalidationConditionValue(value),
          )))
    ) {
      return rejection(
        STRATEGY_DIFF_REJECTION_CODES.INVALID_INVALIDATION_RULE,
        "Invalidation rules require unique IDs and finite structured conditions.",
      );
    }
    if (ruleIds.has(rule.id)) {
      return rejection(
        STRATEGY_DIFF_REJECTION_CODES.DUPLICATE_INVALIDATION_RULE_ID,
        "Invalidation rule IDs must be unique within each Strategy Diff snapshot.",
      );
    }
    ruleIds.add(rule.id);
  }

  return null;
}

function diffNumber(before: number | null, after: number | null): NumberDiff {
  const changed = before !== after;
  return {
    before,
    after,
    changed,
    delta: changed && before !== null && after !== null ? after - before : null,
  };
}

function diffValue<T>(before: T, after: T): ValueDiff<T> {
  return { before, after, changed: before !== after };
}

function diffStringList<T extends string>(
  before: readonly T[],
  after: readonly T[],
): StringListDiff<T> {
  const beforeCanonical = sortedUniqueStrings(before);
  const afterCanonical = sortedUniqueStrings(after);
  return {
    before: beforeCanonical,
    after: afterCanonical,
    added: afterCanonical.filter((item) => !beforeCanonical.includes(item)),
    removed: beforeCanonical.filter((item) => !afterCanonical.includes(item)),
    changed: !sameStringList(beforeCanonical, afterCanonical),
  };
}

function evidenceSemanticChanged(
  before: EvidenceItem,
  after: EvidenceItem,
): boolean {
  return before.state !== after.state || before.reasonCode !== after.reasonCode;
}

function evidenceProvenanceChanged(
  before: EvidenceItem,
  after: EvidenceItem,
): boolean {
  return (
    before.source !== after.source || before.rawReference !== after.rawReference
  );
}

function evidenceChange(
  dimension: DirectionalEvidenceDimension,
  before: EvidenceItem | null,
  after: EvidenceItem | null,
): EvidenceChange {
  if (before === null && after !== null) {
    return {
      dimension,
      kind: "ADDED",
      before: null,
      after: copyEvidence(after),
      changed: true,
      stateChanged: false,
      semanticChanged: true,
      provenanceChanged: false,
      observationChanged: false,
    };
  }

  if (before !== null && after === null) {
    return {
      dimension,
      kind: "REMOVED",
      before: copyEvidence(before),
      after: null,
      changed: true,
      stateChanged: false,
      semanticChanged: true,
      provenanceChanged: false,
      observationChanged: false,
    };
  }

  if (before === null && after === null) {
    return {
      dimension,
      kind: "UNCHANGED",
      before: null,
      after: null,
      changed: false,
      stateChanged: false,
      semanticChanged: false,
      provenanceChanged: false,
      observationChanged: false,
    };
  }

  if (before === null || after === null) {
    throw new Error("Evidence change requires at least one evidence item.");
  }

  const stateChanged = before.state !== after.state;
  const semanticChanged = evidenceSemanticChanged(before, after);
  const provenanceChanged = evidenceProvenanceChanged(before, after);
  const observationChanged = before.observedAt !== after.observedAt;
  const changed = semanticChanged || provenanceChanged;
  let kind: EvidenceChangeKind = "UNCHANGED";

  if (before.state !== "UNKNOWN" && after.state === "UNKNOWN") {
    kind = "BECAME_UNKNOWN";
  } else if (before.state === "UNKNOWN" && after.state !== "UNKNOWN") {
    kind = "BECAME_AVAILABLE";
  } else if (stateChanged || semanticChanged) {
    kind = "STATE_CHANGED";
  } else if (provenanceChanged) {
    kind = "PROVENANCE_CHANGED";
  }

  return {
    dimension,
    kind,
    before: copyEvidence(before),
    after: copyEvidence(after),
    changed,
    stateChanged,
    semanticChanged,
    provenanceChanged,
    observationChanged,
  };
}

function evidenceByDimension(
  items: readonly EvidenceItem[],
): ReadonlyMap<DirectionalEvidenceDimension, EvidenceItem> {
  return new Map(items.map((item) => [item.dimension, item]));
}

function compareCandidates(
  left: CandidateEvaluation,
  right: CandidateEvaluation,
): number {
  const leftStrength = left.thesisStrength ?? Number.NEGATIVE_INFINITY;
  const rightStrength = right.thesisStrength ?? Number.NEGATIVE_INFINITY;
  if (rightStrength !== leftStrength) {
    return rightStrength - leftStrength;
  }

  const leftConflict = left.conflict ?? Number.POSITIVE_INFINITY;
  const rightConflict = right.conflict ?? Number.POSITIVE_INFINITY;
  if (leftConflict !== rightConflict) {
    return leftConflict - rightConflict;
  }

  if (right.coverage !== left.coverage) {
    return right.coverage - left.coverage;
  }

  return compareLexical(left.asset, right.asset);
}

function rankedCandidates(
  candidates: readonly CandidateEvaluation[],
): readonly CandidateEvaluation[] {
  return [...candidates].sort(compareCandidates);
}

function sameHardGateResults(
  left: CandidateEvaluation,
  right: CandidateEvaluation,
): boolean {
  return (
    left.hardGateResults.length === right.hardGateResults.length &&
    left.hardGateResults.every((gate, index) => {
      const other = right.hardGateResults[index];
      return (
        other !== undefined &&
        gate.gate === other.gate &&
        gate.passed === other.passed &&
        gate.reasonCode === other.reasonCode
      );
    })
  );
}

function sameCandidateState(
  left: CandidateEvaluation,
  right: CandidateEvaluation,
): boolean {
  return (
    left.asset === right.asset &&
    left.strategyId === right.strategyId &&
    left.strategyVersion === right.strategyVersion &&
    left.decision === right.decision &&
    left.provisionalDirection === right.provisionalDirection &&
    left.directionalScore === right.directionalScore &&
    left.thesisStrength === right.thesisStrength &&
    left.coverage === right.coverage &&
    left.coverageLabel === right.coverageLabel &&
    left.conflict === right.conflict &&
    left.conflictLabel === right.conflictLabel &&
    left.risk === right.risk &&
    left.safety === right.safety &&
    left.regimeFit === right.regimeFit &&
    left.selected === right.selected &&
    sameHardGateResults(left, right) &&
    sameStringList(left.reasonCodes, right.reasonCodes) &&
    sameStringList(left.warningCodes, right.warningCodes)
  );
}

function candidateRankingDiff(
  before: readonly CandidateEvaluation[],
  after: readonly CandidateEvaluation[],
): CandidateRankingDiff {
  const beforeRanked = rankedCandidates(before);
  const afterRanked = rankedCandidates(after);
  const beforeRanks = new Map(
    beforeRanked.map((candidate, index) => [candidate.asset, index + 1]),
  );
  const afterRanks = new Map(
    afterRanked.map((candidate, index) => [candidate.asset, index + 1]),
  );
  const beforeByAsset = new Map(before.map((candidate) => [candidate.asset, candidate]));
  const afterByAsset = new Map(after.map((candidate) => [candidate.asset, candidate]));
  const assets = [...new Set([...beforeRanks.keys(), ...afterRanks.keys()])].sort(
    compareLexical,
  );

  const changes = assets.map((asset): CandidateChange => {
    const beforeCandidate = beforeByAsset.get(asset) ?? null;
    const afterCandidate = afterByAsset.get(asset) ?? null;
    const beforeRank = beforeRanks.get(asset) ?? null;
    const afterRank = afterRanks.get(asset) ?? null;
    const rankChanged = beforeRank !== afterRank;
    const selectedChanged =
      (beforeCandidate?.selected ?? false) !== (afterCandidate?.selected ?? false);
    const stateChanged =
      beforeCandidate === null ||
      afterCandidate === null ||
      !sameCandidateState(beforeCandidate, afterCandidate);

    return {
      asset,
      before: beforeCandidate === null ? null : copyCandidate(beforeCandidate),
      after: afterCandidate === null ? null : copyCandidate(afterCandidate),
      beforeRank,
      afterRank,
      rankChanged,
      selectedChanged,
      changed: rankChanged || selectedChanged || stateChanged,
    };
  });

  return {
    before: beforeRanked.map((candidate, index) => ({
      asset: candidate.asset,
      rank: index + 1,
      selected: candidate.selected,
    })),
    after: afterRanked.map((candidate, index) => ({
      asset: candidate.asset,
      rank: index + 1,
      selected: candidate.selected,
    })),
    changes,
    changed: changes.some((change) => change.changed),
  };
}

function sameConditionValue(
  left: InvalidationConditionValue,
  right: InvalidationConditionValue,
): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }
  return left === right;
}

function sameRuleState(left: InvalidationRule, right: InvalidationRule): boolean {
  const leftParameters = left.condition.parameters ?? {};
  const rightParameters = right.condition.parameters ?? {};
  const leftKeys = Object.keys(leftParameters).sort(compareLexical);
  const rightKeys = Object.keys(rightParameters).sort(compareLexical);

  return (
    left.id === right.id &&
    left.ruleType === right.ruleType &&
    left.effect === right.effect &&
    left.strategyId === right.strategyId &&
    left.strategyVersion === right.strategyVersion &&
    left.direction === right.direction &&
    left.condition.field === right.condition.field &&
    left.condition.operator === right.condition.operator &&
    sameConditionValue(left.condition.value, right.condition.value) &&
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        sameConditionValue(leftParameters[key], rightParameters[key]),
    )
  );
}

function compareRules(left: InvalidationRule, right: InvalidationRule): number {
  return compareLexical(left.id, right.id);
}

function invalidationRuleDiff(
  before: readonly InvalidationRule[],
  after: readonly InvalidationRule[],
): InvalidationRuleDiff {
  const beforeSorted = [...before].sort(compareRules);
  const afterSorted = [...after].sort(compareRules);
  const beforeById = new Map(before.map((rule) => [rule.id, rule]));
  const afterById = new Map(after.map((rule) => [rule.id, rule]));
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort(
    compareLexical,
  );
  const changes = ids.map((id): InvalidationRuleChange => {
    const beforeRule = beforeById.get(id) ?? null;
    const afterRule = afterById.get(id) ?? null;
    const kind: InvalidationRuleChangeKind =
      beforeRule === null
        ? "ADDED"
        : afterRule === null
          ? "REMOVED"
          : sameRuleState(beforeRule, afterRule)
            ? "UNCHANGED"
            : "CHANGED";
    return {
      id,
      kind,
      before: beforeRule === null ? null : copyRule(beforeRule),
      after: afterRule === null ? null : copyRule(afterRule),
      changed: kind !== "UNCHANGED",
    };
  });

  return {
    before: beforeSorted.map(copyRule),
    after: afterSorted.map(copyRule),
    changes,
    changed: changes.some((change) => change.changed),
  };
}

function compareSnapshotIdentity(
  before: StrategyDiffSnapshot,
  after: StrategyDiffSnapshot,
): StrategyDiffRejection | null {
  if (before.version.thesisId !== after.version.thesisId) {
    return rejection(
      STRATEGY_DIFF_REJECTION_CODES.THESIS_ID_MISMATCH,
      "Strategy Diff snapshots must belong to the same thesis.",
    );
  }
  if (before.version.asset !== after.version.asset) {
    return rejection(
      STRATEGY_DIFF_REJECTION_CODES.ASSET_MISMATCH,
      "Strategy Diff snapshots must describe the same asset.",
    );
  }
  if (before.version.strategyId !== after.version.strategyId) {
    return rejection(
      STRATEGY_DIFF_REJECTION_CODES.STRATEGY_ID_MISMATCH,
      "Strategy Diff snapshots must use the same strategy ID.",
    );
  }
  if (before.version.strategyVersion !== after.version.strategyVersion) {
    return rejection(
      STRATEGY_DIFF_REJECTION_CODES.STRATEGY_VERSION_MISMATCH,
      "Strategy Diff snapshots must use the same strategy version.",
    );
  }
  if (before.normalizerVersion !== after.normalizerVersion) {
    return rejection(
      STRATEGY_DIFF_REJECTION_CODES.NORMALIZER_VERSION_MISMATCH,
      "Strategy Diff snapshots must use the same normalizer version.",
    );
  }
  return null;
}

export function buildStrategyDiff(input: StrategyDiffInput): StrategyDiffResult {
  if (input === null || typeof input !== "object") {
    return rejection(
      STRATEGY_DIFF_REJECTION_CODES.INVALID_INPUT,
      "Strategy Diff input must contain before and after snapshots.",
    );
  }

  const beforeRejection = validateSnapshot(input.before);
  if (beforeRejection !== null) {
    return beforeRejection;
  }
  const afterRejection = validateSnapshot(input.after);
  if (afterRejection !== null) {
    return afterRejection;
  }

  const identityRejection = compareSnapshotIdentity(input.before, input.after);
  if (identityRejection !== null) {
    return identityRejection;
  }

  const beforeEvidence = evidenceByDimension(input.before.evidenceItems);
  const afterEvidence = evidenceByDimension(input.after.evidenceItems);
  const evidenceChanges = DIMENSION_ORDER.map((dimension) =>
    evidenceChange(
      dimension,
      beforeEvidence.get(dimension) ?? null,
      afterEvidence.get(dimension) ?? null,
    ),
  );
  const newlyMissingEvidence = evidenceChanges.filter(
    (change) => change.kind === "BECAME_UNKNOWN" || change.kind === "REMOVED",
  );
  const newlyAvailableEvidence = evidenceChanges.filter(
    (change) =>
      change.kind === "BECAME_AVAILABLE" ||
      (change.kind === "ADDED" && change.after?.state !== "UNKNOWN"),
  );
  const provenanceChanges = evidenceChanges.filter(
    (change) => change.provenanceChanged || change.observationChanged,
  );
  const candidateRanking = candidateRankingDiff(
    input.before.candidateEvaluations,
    input.after.candidateEvaluations,
  );
  const invalidationRules = invalidationRuleDiff(
    input.before.invalidationRules,
    input.after.invalidationRules,
  );
  const score = diffNumber(
    input.before.version.directionalScore,
    input.after.version.directionalScore,
  );
  const thesisStrength = diffNumber(
    input.before.version.thesisStrength,
    input.after.version.thesisStrength,
  );
  const coverage = diffNumber(
    input.before.version.coverage,
    input.after.version.coverage,
  );
  const conflict = diffNumber(
    input.before.version.conflict,
    input.after.version.conflict,
  );
  const decision = diffValue(
    input.before.version.decision,
    input.after.version.decision,
  );
  const risk = diffValue(input.before.version.risk, input.after.version.risk);
  const safety = diffValue(
    input.before.version.safety,
    input.after.version.safety,
  );
  const regimeFit = diffValue(
    input.before.version.regimeFit,
    input.after.version.regimeFit,
  );
  const reasonCodes = diffStringList(
    input.before.version.reasonCodes,
    input.after.version.reasonCodes,
  );
  const warningCodes = diffStringList(
    input.before.version.warningCodes,
    input.after.version.warningCodes,
  );
  const lifecycleStatus = diffValue(
    input.before.version.statusAtCommit,
    input.after.version.statusAtCommit,
  );
  const evidenceSnapshot = diffValue(
    input.before.version.evidenceSnapshotId,
    input.after.version.evidenceSnapshotId,
  );
  const version = diffValue(
    input.before.version.versionNumber,
    input.after.version.versionNumber,
  );

  return {
    ok: true,
    diff: {
      thesisId: input.before.version.thesisId,
      asset: input.before.version.asset,
      strategyId: input.before.version.strategyId,
      strategyVersion: input.before.version.strategyVersion,
      normalizerVersion: input.before.normalizerVersion,
      version,
      lifecycleStatus,
      evidenceSnapshot,
      evidenceChanges,
      newlyMissingEvidence,
      newlyAvailableEvidence,
      provenanceChanges,
      score,
      thesisStrength,
      coverage,
      conflict,
      decision,
      risk,
      safety,
      regimeFit,
      reasonCodes,
      warningCodes,
      candidateRanking,
      invalidationRules,
      hasMeaningfulChange:
        evidenceChanges.some((change) => change.changed) ||
        score.changed ||
        thesisStrength.changed ||
        coverage.changed ||
        conflict.changed ||
        decision.changed ||
        lifecycleStatus.changed ||
        risk.changed ||
        safety.changed ||
        regimeFit.changed ||
        reasonCodes.changed ||
        warningCodes.changed ||
        candidateRanking.changed ||
        invalidationRules.changed,
    },
  };
}

export const diffStrategy = buildStrategyDiff;
