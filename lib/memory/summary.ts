import { CASE_SIMILARITY_ALGORITHM_VERSION } from "./types";
import type { MemorySnapshot } from "./types";

export const MEMORY_SUMMARY_V1_VERSION = "memory-summary-v1" as const;

export interface MemorySummaryThresholds {
  readonly minimumComparisonCoverage: number;
  readonly minimumComparableOverallSimilarity: number;
  readonly minimumHighSimilarityOverallSimilarity: number;
}

export const MEMORY_SUMMARY_V1_THRESHOLDS: MemorySummaryThresholds = Object.freeze({
  minimumComparisonCoverage: 0.8,
  minimumComparableOverallSimilarity: 0.6,
  minimumHighSimilarityOverallSimilarity: 0.8,
});

export interface MemorySummaryV1 {
  readonly summaryVersion: typeof MEMORY_SUMMARY_V1_VERSION;
  readonly thresholds: MemorySummaryThresholds;
  readonly rankedCaseCount: number;
  readonly comparableCaseCount: number;
  readonly highSimilarityCaseCount: number;
}

function assertValidSnapshotInput(snapshot: unknown): asserts snapshot is MemorySnapshot {
  if (
    snapshot === null ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot)
  ) {
    throw new Error("Invalid MemorySummary input: snapshot must be an object.");
  }
  const snapshotRecord = snapshot as Record<string, unknown>;
  if (snapshotRecord.algorithmVersion !== CASE_SIMILARITY_ALGORITHM_VERSION) {
    throw new Error(
      `Invalid MemorySummary input: snapshot.algorithmVersion must be "${CASE_SIMILARITY_ALGORITHM_VERSION}".`,
    );
  }
  if (!Array.isArray(snapshotRecord.rankedCases)) {
    throw new Error(
      "Invalid MemorySummary input: snapshot.rankedCases must be an array.",
    );
  }
  for (let index = 0; index < snapshotRecord.rankedCases.length; index += 1) {
    const rankedCase = snapshotRecord.rankedCases[index];
    if (
      rankedCase === null ||
      typeof rankedCase !== "object" ||
      Array.isArray(rankedCase)
    ) {
      throw new Error(
        `Invalid MemorySummary input: rankedCases[${index}] must be an object.`,
      );
    }
    const similarity = (rankedCase as Record<string, unknown>).similarity;
    if (
      similarity === null ||
      typeof similarity !== "object" ||
      Array.isArray(similarity)
    ) {
      throw new Error(
        `Invalid MemorySummary input: rankedCases[${index}].similarity must be an object.`,
      );
    }
    const similarityRecord = similarity as Record<string, unknown>;
    for (const field of ["overallSimilarity", "comparisonCoverage"] as const) {
      const value = similarityRecord[field];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1
      ) {
        throw new Error(
          `Invalid MemorySummary input: rankedCases[${index}].similarity.${field} must be a finite number in [0, 1].`,
        );
      }
    }
  }
}

export function summarizeMemorySnapshotV1(
  snapshot: MemorySnapshot,
): MemorySummaryV1 {
  assertValidSnapshotInput(snapshot);

  let comparableCaseCount = 0;
  let highSimilarityCaseCount = 0;

  for (const rankedCase of snapshot.rankedCases) {
    const { overallSimilarity, comparisonCoverage } = rankedCase.similarity;
    if (
      overallSimilarity >=
        MEMORY_SUMMARY_V1_THRESHOLDS.minimumComparableOverallSimilarity &&
      comparisonCoverage >= MEMORY_SUMMARY_V1_THRESHOLDS.minimumComparisonCoverage
    ) {
      comparableCaseCount += 1;
    }
    if (
      overallSimilarity >=
        MEMORY_SUMMARY_V1_THRESHOLDS.minimumHighSimilarityOverallSimilarity &&
      comparisonCoverage >= MEMORY_SUMMARY_V1_THRESHOLDS.minimumComparisonCoverage
    ) {
      highSimilarityCaseCount += 1;
    }
  }

  return Object.freeze({
    summaryVersion: MEMORY_SUMMARY_V1_VERSION,
    thresholds: MEMORY_SUMMARY_V1_THRESHOLDS,
    rankedCaseCount: snapshot.rankedCases.length,
    comparableCaseCount,
    highSimilarityCaseCount,
  });
}
