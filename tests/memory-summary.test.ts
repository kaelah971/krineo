import { describe, expect, it } from "vitest";
import {
  CASE_SIMILARITY_ALGORITHM_VERSION,
  MEMORY_SUMMARY_V1_THRESHOLDS,
  MEMORY_SUMMARY_V1_VERSION,
  summarizeMemorySnapshotV1,
} from "../lib/memory";
import type { MemorySnapshot } from "../lib/memory/types";
function makeSnapshot(
  similarities: ReadonlyArray<{
    overallSimilarity: number;
    comparisonCoverage: number;
    comparableSimilarity?: number;
  }>,
  algorithmVersion: string = CASE_SIMILARITY_ALGORITHM_VERSION,
): MemorySnapshot {
  return {
    snapshotId: "summary-test-snapshot",
    targetCase: null,
    targetSignature: {} as MemorySnapshot["targetSignature"],
    algorithmVersion: algorithmVersion as MemorySnapshot["algorithmVersion"],
    rankedCases: similarities.map((similarity, index) => ({
      rank: index + 1,
      caseId: `case-${index + 1}`,
      decisionCase: {} as MemorySnapshot["rankedCases"][number]["decisionCase"],
      similarity: {
        ...similarity,
        algorithmVersion: CASE_SIMILARITY_ALGORITHM_VERSION,
      } as MemorySnapshot["rankedCases"][number]["similarity"],
    })),
    createdAt: "2026-09-26T00:00:00.000Z",
  };
}

describe("MemorySummaryV1", () => {
  it("counts ranked, comparable, and high-similarity cases using overall similarity and coverage", () => {
    const summary = summarizeMemorySnapshotV1(
      makeSnapshot([
        { overallSimilarity: 0.6, comparisonCoverage: 0.8, comparableSimilarity: 0 },
        { overallSimilarity: 0.8, comparisonCoverage: 0.8, comparableSimilarity: 0 },
        { overallSimilarity: 0.79, comparisonCoverage: 0.8, comparableSimilarity: 1 },
        { overallSimilarity: 0.9, comparisonCoverage: 0.79, comparableSimilarity: 1 },
      ]),
    );

    expect(summary).toEqual({
      summaryVersion: MEMORY_SUMMARY_V1_VERSION,
      thresholds: MEMORY_SUMMARY_V1_THRESHOLDS,
      rankedCaseCount: 4,
      comparableCaseCount: 3,
      highSimilarityCaseCount: 1,
    });
  });

  it("returns zero counts for an empty snapshot and freezes the summary and thresholds", () => {
    const summary = summarizeMemorySnapshotV1(makeSnapshot([]));

    expect(summary.rankedCaseCount).toBe(0);
    expect(summary.comparableCaseCount).toBe(0);
    expect(summary.highSimilarityCaseCount).toBe(0);
    expect(Object.isFrozen(summary)).toBe(true);
    expect(Object.isFrozen(summary.thresholds)).toBe(true);
    expect(Object.isFrozen(MEMORY_SUMMARY_V1_THRESHOLDS)).toBe(true);
  });

  it("is invariant to ranked case order and does not mutate the snapshot", () => {
    const similarities = [
      { overallSimilarity: 0.95, comparisonCoverage: 0.9 },
      { overallSimilarity: 0.6, comparisonCoverage: 0.8 },
      { overallSimilarity: 0.2, comparisonCoverage: 1 },
    ] as const;
    const first = makeSnapshot(similarities);
    const second = makeSnapshot([...similarities].reverse());
    const firstBefore = JSON.stringify(first);

    const firstSummary = summarizeMemorySnapshotV1(first);
    const secondSummary = summarizeMemorySnapshotV1(second);

    expect(secondSummary).toEqual(firstSummary);
    expect(JSON.stringify(first)).toBe(firstBefore);
  });

  it("rejects unsupported algorithms and malformed similarity metrics", () => {
    expect(() =>
      summarizeMemorySnapshotV1(makeSnapshot([], "case-similarity-v0")),
    ).toThrow(/algorithmVersion/i);
    expect(() =>
      summarizeMemorySnapshotV1(
        makeSnapshot([{ overallSimilarity: Number.NaN, comparisonCoverage: 0.8 }]),
      ),
    ).toThrow(/overallSimilarity/i);
    expect(() =>
      summarizeMemorySnapshotV1(
        ({
          algorithmVersion: CASE_SIMILARITY_ALGORITHM_VERSION,
          rankedCases: null,
        } as unknown) as MemorySnapshot,
      ),
    ).toThrow(/rankedCases/i);
  });
});
