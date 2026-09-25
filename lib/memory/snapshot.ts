import {
  CASE_SIGNATURE_DIMENSIONS,
  CASE_SIMILARITY_ALGORITHM_VERSION,
  CASE_SIMILARITY_TOTAL_WEIGHT,
  CASE_SIMILARITY_WEIGHTS,
  type CaseSignature,
  type CaseSimilarityResult,
  type DecisionCase,
  type DecisionOutcomeMetadata,
  type MemoryMetadata,
  type MemorySnapshot,
  type RankedCase,
  type SimilarityComponent,
} from "./types";
import {
  isCanonicalRfc3339Timestamp,
  validateCaseSignature,
  validateDecisionCase,
} from "./signature";

const SIGNATURE_DIMENSION_LOOKUP: Record<string, true> = {
  DIRECTIONAL_MOMENTUM: true,
  TECHNICAL_CONFLUENCE: true,
  RELATIVE_OPPORTUNITY: true,
  MARKET_ALIGNMENT: true,
  SENTIMENT_DERIVATIVES: true,
  risk: true,
  safety: true,
  regimeFit: true,
};


const SIMILARITY_DIAGNOSTIC_LOOKUP: Record<string, true> = {
  MATCH: true,
  OPPOSING: true,
  PARTIAL_ALIGNMENT: true,
  TARGET_UNKNOWN: true,
  CANDIDATE_UNKNOWN: true,
  BOTH_UNKNOWN: true,
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRfc3339Timestamp(value: unknown): value is string {
  return isCanonicalRfc3339Timestamp(value);
}

function deepFreezeValue<T>(value: T, seen: WeakSet<object>): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  const target = value as unknown as Record<string, unknown>;
  if (seen.has(target)) {
    return value;
  }
  seen.add(target);
  if (Array.isArray(target)) {
    for (const item of target) {
      deepFreezeValue(item, seen);
    }
  } else {
    for (const key of Object.keys(target)) {
      deepFreezeValue(target[key], seen);
    }
  }
  return Object.freeze(target) as unknown as T;
}

function deepClone<T>(value: T, seen: WeakMap<object, unknown>): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  const source = value as unknown as Record<string, unknown>;
  const cached = seen.get(source);
  if (cached !== undefined) {
    return cached as T;
  }
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(source, copy);
    for (const item of value) {
      copy.push(deepClone(item, seen));
    }
    return copy as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  seen.set(source, copy);
  for (const key of Object.keys(source)) {
    copy[key] = deepClone(source[key], seen);
  }
  return copy as unknown as T;
}

function clone<T>(value: T): T {
  return deepClone(value, new WeakMap());
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (
    typeof left !== "object" ||
    typeof right !== "object" ||
    left === null ||
    right === null
  ) {
    return false;
  }
  const leftIsArray = Array.isArray(left);
  const rightIsArray = Array.isArray(right);
  if (leftIsArray || rightIsArray) {
    if (!leftIsArray || !rightIsArray) {
      return false;
    }
    if (left.length !== (right as unknown[]).length) {
      return false;
    }
    return left.every((item, index) =>
      deepEqual(item, (right as unknown[])[index]),
    );
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key) &&
      deepEqual(leftRecord[key], rightRecord[key]),
  );
}

function assertValidCaseSignature(value: unknown): asserts value is CaseSignature {
  validateCaseSignature(value);
}

function assertValidDecisionCase(value: unknown): asserts value is DecisionCase {
  validateDecisionCase(value);
}

function assertValidSimilarityComponent(
  value: unknown,
): asserts value is SimilarityComponent {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid SimilarityComponent: must be an object.");
  }
  const component = value as Record<string, unknown>;
  if (
    typeof component.dimension !== "string" ||
    !SIGNATURE_DIMENSION_LOOKUP[component.dimension]
  ) {
    throw new Error(
      "Invalid SimilarityComponent: dimension must be a valid CaseSignatureDimension.",
    );
  }
  if (!isFiniteNumber(component.weight) || component.weight < 0) {
    throw new Error(
      "Invalid SimilarityComponent: weight must be a finite non-negative number.",
    );
  }
  if (!isNonEmptyString(component.targetState)) {
    throw new Error(
      "Invalid SimilarityComponent: targetState must be a non-empty string.",
    );
  }
  if (!isNonEmptyString(component.candidateState)) {
    throw new Error(
      "Invalid SimilarityComponent: candidateState must be a non-empty string.",
    );
  }
  if (
    typeof component.diagnostic !== "string" ||
    !SIMILARITY_DIAGNOSTIC_LOOKUP[component.diagnostic]
  ) {
    throw new Error(
      "Invalid SimilarityComponent: diagnostic must be a valid SimilarityDiagnosticCode.",
    );
  }
  for (const field of ["distance", "penalty", "score"] as const) {
    const numeric = component[field];
    if (!isFiniteNumber(numeric) || numeric < 0 || numeric > 1) {
      throw new Error(
        `Invalid SimilarityComponent: ${field} must be a finite number in [0, 1].`,
      );
    }
  }
  if (!isFiniteNumber(component.weightedScore)) {
    throw new Error(
      "Invalid SimilarityComponent: weightedScore must be a finite number.",
    );
  }
}

function assertValidSimilarityResult(
  value: unknown,
): asserts value is CaseSimilarityResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid CaseSimilarityResult: must be an object.");
  }
  const result = value as Record<string, unknown>;
  if (result.algorithmVersion !== CASE_SIMILARITY_ALGORITHM_VERSION) {
    throw new Error(
      `Invalid CaseSimilarityResult: algorithmVersion must be "${CASE_SIMILARITY_ALGORITHM_VERSION}".`,
    );
  }
  for (const field of [
    "overallSimilarity",
    "comparableSimilarity",
    "comparisonCoverage",
    "targetCompleteness",
    "candidateCompleteness",
  ] as const) {
    const numeric = result[field];
    if (!isFiniteNumber(numeric) || numeric < 0 || numeric > 1) {
      throw new Error(
        `Invalid CaseSimilarityResult: ${field} must be a finite number in [0, 1].`,
      );
    }
  }
  for (const field of ["comparableWeight", "totalWeight"] as const) {
    const numeric = result[field];
    if (!isFiniteNumber(numeric) || numeric < 0) {
      throw new Error(
        `Invalid CaseSimilarityResult: ${field} must be a finite non-negative number.`,
      );
    }
  }
  if (result.totalWeight !== CASE_SIMILARITY_TOTAL_WEIGHT) {
    throw new Error(
      `Invalid CaseSimilarityResult: totalWeight must be ${CASE_SIMILARITY_TOTAL_WEIGHT}.`,
    );
  }
  if (
    !Array.isArray(result.components) ||
    result.components.length !== CASE_SIGNATURE_DIMENSIONS.length
  ) {
    throw new Error(
      `Invalid CaseSimilarityResult: components must contain exactly ${CASE_SIGNATURE_DIMENSIONS.length} items.`,
    );
  }
  for (let i = 0; i < CASE_SIGNATURE_DIMENSIONS.length; i++) {
    const expectedDimension = CASE_SIGNATURE_DIMENSIONS[i];
    const expectedWeight = CASE_SIMILARITY_WEIGHTS[expectedDimension];
    const component = result.components[i];
    assertValidSimilarityComponent(component);
    if (component.dimension !== expectedDimension) {
      throw new Error(
        `Invalid CaseSimilarityResult: component[${i}] dimension must be "${expectedDimension}".`,
      );
    }
    if (component.weight !== expectedWeight) {
      throw new Error(
        `Invalid CaseSimilarityResult: component[${i}] weight must be ${expectedWeight}.`,
      );
    }
  }
}

function assertValidRankedCase(value: unknown): asserts value is RankedCase {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid RankedCase: must be an object.");
  }
  const ranked = value as Record<string, unknown>;
  if (
    !isFiniteNumber(ranked.rank) ||
    !Number.isInteger(ranked.rank) ||
    ranked.rank < 1
  ) {
    throw new Error("Invalid RankedCase: rank must be a positive integer.");
  }
  if (!isNonEmptyString(ranked.caseId)) {
    throw new Error("Invalid RankedCase: caseId must be a non-empty string.");
  }
  assertValidDecisionCase(ranked.decisionCase);
  if (ranked.caseId !== (ranked.decisionCase as DecisionCase).id) {
    throw new Error(
      "Invalid RankedCase: caseId must match decisionCase.id.",
    );
  }
  assertValidSimilarityResult(ranked.similarity);
}

function assertValidRankedCaseList(value: unknown): asserts value is RankedCase[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid MemorySnapshot: rankedCases must be an array.");
  }
  for (let index = 0; index < value.length; index += 1) {
    assertValidRankedCase(value[index]);
    const ranked = value[index] as RankedCase;
    if (ranked.rank !== index + 1) {
      throw new Error(
        "Invalid MemorySnapshot: rankedCases must be sorted by rank ascending (1, 2, 3, ...).",
      );
    }
  }
}

function assertValidMemoryMetadata(
  value: unknown,
): asserts value is MemoryMetadata {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid MemoryMetadata: must be an object.");
  }
  const metadata = value as Record<string, unknown>;
  for (const key of Object.keys(metadata)) {
    const entry = metadata[key];
    if (entry === null) {
      continue;
    }
    const kind = typeof entry;
    if (kind === "string" || kind === "boolean") {
      continue;
    }
    if (kind === "number") {
      if (!Number.isFinite(entry as number)) {
        throw new Error(
          `Invalid MemoryMetadata: value for key "${key}" must be a finite number.`,
        );
      }
      continue;
    }
    throw new Error(
      `Invalid MemoryMetadata: value for key "${key}" must be string | number | boolean | null.`,
    );
  }
}

export function createMemorySnapshot(input: {
  snapshotId: string;
  targetCase?: DecisionCase | null;
  targetSignature: CaseSignature;
  rankedCases: readonly RankedCase[];
  createdAt: string;
  metadata?: MemoryMetadata;
}): MemorySnapshot {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid MemorySnapshot input: must be an object.");
  }
  if (!isNonEmptyString(input.snapshotId)) {
    throw new Error(
      "Invalid MemorySnapshot: snapshotId must be a non-empty string.",
    );
  }
  if (!isRfc3339Timestamp(input.createdAt)) {
    throw new Error(
      "Invalid MemorySnapshot: createdAt must be a valid RFC3339 timestamp.",
    );
  }
  assertValidCaseSignature(input.targetSignature);
  let targetCase: DecisionCase | null = null;
  if (input.targetCase !== undefined && input.targetCase !== null) {
    assertValidDecisionCase(input.targetCase);
    if (!deepEqual(input.targetCase.signature, input.targetSignature)) {
      throw new Error(
        "Invalid MemorySnapshot: targetCase.signature must match targetSignature.",
      );
    }
    targetCase = clone(input.targetCase);
  }
  assertValidRankedCaseList(input.rankedCases);
  const rankedCases: RankedCase[] = (input.rankedCases as RankedCase[]).map(
    (ranked) => clone(ranked),
  );
  const snapshot: MemorySnapshot = {
    snapshotId: input.snapshotId,
    targetCase,
    targetSignature: clone(input.targetSignature),
    algorithmVersion: CASE_SIMILARITY_ALGORITHM_VERSION,
    rankedCases,
    createdAt: input.createdAt,
    ...(input.metadata !== undefined ? { metadata: clone(input.metadata) } : {}),
  };
  if (snapshot.metadata !== undefined) {
    assertValidMemoryMetadata(snapshot.metadata);
  }
  return deepFreezeValue(snapshot, new WeakSet<object>());
}

function canonicalSignature(signature: CaseSignature): Record<string, unknown> {
  const evidence: Record<string, unknown> = {};
  for (const dimension of CASE_SIGNATURE_DIMENSIONS) {
    if (dimension === "risk" || dimension === "safety" || dimension === "regimeFit") {
      continue;
    }
    evidence[dimension] = signature.evidence[
      dimension as keyof CaseSignature["evidence"]
    ];
  }
  return {
    evidence,
    risk: signature.risk,
    safety: signature.safety,
    regimeFit: signature.regimeFit,
  };
}

function canonicalOutcome(
  outcome: DecisionOutcomeMetadata | undefined,
): Record<string, unknown> | undefined {
  if (outcome === undefined) {
    return undefined;
  }
  return {
    status: outcome.status,
    ...(outcome.resolvedAt !== undefined
      ? { resolvedAt: outcome.resolvedAt }
      : {}),
    ...(outcome.observationId !== undefined
      ? { observationId: outcome.observationId }
      : {}),
    ...(outcome.realizedPnlUsd !== undefined
      ? { realizedPnlUsd: outcome.realizedPnlUsd }
      : {}),
    ...(outcome.realizedPnlPercent !== undefined
      ? { realizedPnlPercent: outcome.realizedPnlPercent }
      : {}),
    ...(outcome.closeReason !== undefined
      ? { closeReason: outcome.closeReason }
      : {}),
  };
}

function canonicalDecisionCase(decisionCase: DecisionCase): Record<string, unknown> {
  return {
    id: decisionCase.id,
    thesisId: decisionCase.thesisId,
    versionId: decisionCase.versionId,
    evidenceSnapshotId: decisionCase.evidenceSnapshotId,
    strategyId: decisionCase.strategyId,
    strategyVersion: decisionCase.strategyVersion,
    asset: decisionCase.asset,
    decision: decisionCase.decision,
    signature: canonicalSignature(decisionCase.signature),
    committedAt: decisionCase.committedAt,
    observedAt: decisionCase.observedAt,
    ...(decisionCase.outcome !== undefined
      ? { outcome: canonicalOutcome(decisionCase.outcome) }
      : {}),
  };
}

function canonicalSimilarityComponent(
  component: SimilarityComponent,
): Record<string, unknown> {
  return {
    dimension: component.dimension,
    weight: component.weight,
    targetState: component.targetState,
    candidateState: component.candidateState,
    diagnostic: component.diagnostic,
    distance: component.distance,
    penalty: component.penalty,
    score: component.score,
    weightedScore: component.weightedScore,
  };
}

function canonicalSimilarity(
  similarity: CaseSimilarityResult,
): Record<string, unknown> {
  return {
    algorithmVersion: similarity.algorithmVersion,
    overallSimilarity: similarity.overallSimilarity,
    comparableSimilarity: similarity.comparableSimilarity,
    comparisonCoverage: similarity.comparisonCoverage,
    targetCompleteness: similarity.targetCompleteness,
    candidateCompleteness: similarity.candidateCompleteness,
    comparableWeight: similarity.comparableWeight,
    totalWeight: similarity.totalWeight,
    components: similarity.components.map(canonicalSimilarityComponent),
  };
}

function canonicalRankedCase(ranked: RankedCase): Record<string, unknown> {
  return {
    rank: ranked.rank,
    caseId: ranked.caseId,
    decisionCase: canonicalDecisionCase(ranked.decisionCase),
    similarity: canonicalSimilarity(ranked.similarity),
  };
}

function canonicalMetadata(metadata: MemoryMetadata): Record<string, unknown> {
  const canonical: Record<string, unknown> = {};
  for (const key of Object.keys(metadata).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))) {
    canonical[key] = metadata[key];
  }
  return canonical;
}

export function serializeMemorySnapshot(snapshot: MemorySnapshot): string {
  const rankedCases = [...snapshot.rankedCases].sort(
    (left, right) => left.rank - right.rank,
  );
  const payload: Record<string, unknown> = {
    snapshotId: snapshot.snapshotId,
    algorithmVersion: snapshot.algorithmVersion,
    createdAt: snapshot.createdAt,
    targetCase:
      snapshot.targetCase === null
        ? null
        : canonicalDecisionCase(snapshot.targetCase),
    targetSignature: canonicalSignature(snapshot.targetSignature),
    rankedCases: rankedCases.map(canonicalRankedCase),
  };
  if (snapshot.metadata !== undefined) {
    payload.metadata = canonicalMetadata(snapshot.metadata);
  }
  return JSON.stringify(payload);
}
