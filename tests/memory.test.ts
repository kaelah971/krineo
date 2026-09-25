import { describe, expect, it } from "vitest";
import {
  CASE_SIMILARITY_ALGORITHM_VERSION,
  CASE_SIMILARITY_TOTAL_WEIGHT,
  compareCaseSimilarityV1,
  createMemorySnapshot,
  InMemoryMemoryProvider,
  rankComparableCases,
  serializeMemorySnapshot,
  toCaseSignature,
  validateCaseSignature,
  validateDecisionCase,
} from "../lib/memory";
import type { CaseSignature } from "../lib/memory/types";
import {
  makeCaseSignature,
  makeDecisionCase,
} from "./fixtures/memory";

describe("M1 Decision Memory V1", () => {
  describe("toCaseSignature and validateCaseSignature", () => {
    it("canonicalizes DM-1 evidence snapshot and maps missing dimensions to UNKNOWN", () => {
      const snapshot = {
        evidence: {
          DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE" as const,
        },
        risk: "ACCEPTABLE" as const,
        safety: "CLEAR" as const,
        regimeFit: "FIT" as const,
      };

      const signature = toCaseSignature(snapshot);

      expect(signature.evidence.DIRECTIONAL_MOMENTUM).toBe("STRONGLY_SUPPORTIVE");
      expect(signature.evidence.TECHNICAL_CONFLUENCE).toBe("UNKNOWN");
      expect(signature.evidence.RELATIVE_OPPORTUNITY).toBe("UNKNOWN");
      expect(signature.evidence.MARKET_ALIGNMENT).toBe("UNKNOWN");
      expect(signature.evidence.SENTIMENT_DERIVATIVES).toBe("UNKNOWN");
      expect(signature.risk).toBe("ACCEPTABLE");
      expect(signature.safety).toBe("CLEAR");
      expect(signature.regimeFit).toBe("FIT");
      expect(Object.isFrozen(signature)).toBe(true);
      expect(Object.isFrozen(signature.evidence)).toBe(true);
    });

    it("rejects invalid signature objects", () => {
      expect(() => validateCaseSignature(null)).toThrow();
      expect(() => validateCaseSignature("not an object")).toThrow();
      expect(() =>
        validateCaseSignature({
          evidence: {
            DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
            // missing other dimensions
          },
          risk: "ACCEPTABLE",
          safety: "CLEAR",
          regimeFit: "FIT",
        }),
      ).toThrow();
      expect(() =>
        validateCaseSignature({
          evidence: {
            DIRECTIONAL_MOMENTUM: "INVALID_STATE",
            TECHNICAL_CONFLUENCE: "SUPPORTIVE",
            RELATIVE_OPPORTUNITY: "SUPPORTIVE",
            MARKET_ALIGNMENT: "SUPPORTIVE",
            SENTIMENT_DERIVATIVES: "SUPPORTIVE",
          },
          risk: "ACCEPTABLE",
          safety: "CLEAR",
          regimeFit: "FIT",
        }),
      ).toThrow();
      // Extra evidence dimension
      expect(() =>
        validateCaseSignature({
          evidence: {
            DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
            TECHNICAL_CONFLUENCE: "SUPPORTIVE",
            RELATIVE_OPPORTUNITY: "SUPPORTIVE",
            MARKET_ALIGNMENT: "SUPPORTIVE",
            SENTIMENT_DERIVATIVES: "SUPPORTIVE",
            EXTRA_DIMENSION: "SUPPORTIVE",
          },
          risk: "ACCEPTABLE",
          safety: "CLEAR",
          regimeFit: "FIT",
        }),
      ).toThrow(/canonical directional dimensions/i);
      // 5 dimensions but one is unknown
      expect(() =>
        validateCaseSignature({
          evidence: {
            DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
            TECHNICAL_CONFLUENCE: "SUPPORTIVE",
            RELATIVE_OPPORTUNITY: "SUPPORTIVE",
            MARKET_ALIGNMENT: "SUPPORTIVE",
            UNKNOWN_DIMENSION: "SUPPORTIVE",
          },
          risk: "ACCEPTABLE",
          safety: "CLEAR",
          regimeFit: "FIT",
        }),
      ).toThrow(/unexpected evidence dimension/i);
      // Extra top-level property
      expect(() =>
        validateCaseSignature({
          evidence: {
            DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
            TECHNICAL_CONFLUENCE: "SUPPORTIVE",
            RELATIVE_OPPORTUNITY: "SUPPORTIVE",
            MARKET_ALIGNMENT: "SUPPORTIVE",
            SENTIMENT_DERIVATIVES: "SUPPORTIVE",
          },
          risk: "ACCEPTABLE",
          safety: "CLEAR",
          regimeFit: "FIT",
          extraProp: "not-allowed",
        }),
      ).toThrow(/must contain exactly evidence, risk, safety, regimeFit/i);
      // 4 top keys but one unexpected property
      expect(() =>
        validateCaseSignature({
          evidence: {
            DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
            TECHNICAL_CONFLUENCE: "SUPPORTIVE",
            RELATIVE_OPPORTUNITY: "SUPPORTIVE",
            MARKET_ALIGNMENT: "SUPPORTIVE",
            SENTIMENT_DERIVATIVES: "SUPPORTIVE",
          },
          risk: "ACCEPTABLE",
          safety: "CLEAR",
          wrongKey: "FIT",
        }),
      ).toThrow(/unexpected property 'wrongKey'/i);
    });
  });

  describe("validateDecisionCase", () => {
    it("validates a complete DecisionCase with quarantined outcome", () => {
      const validCase = makeDecisionCase({
        id: "case-valid-1",
        outcome: {
          status: "POSITIVE",
          realizedPnlUsd: 1500,
          realizedPnlPercent: 15,
          closeReason: "THESIS_TARGET_REACHED",
          resolvedAt: "2026-09-24T15:00:00.000Z",
        },
      });

      const validated = validateDecisionCase(validCase);
      expect(validated.id).toBe("case-valid-1");
      expect(validated.outcome?.status).toBe("POSITIVE");
      expect(Object.isFrozen(validated)).toBe(true);
    });

    it("rejects invalid timestamps and observedAt > committedAt", () => {
      expect(() =>
        validateDecisionCase(
          makeDecisionCase({
            committedAt: "2026-09-24T10:00:00.000Z",
            observedAt: "2026-09-24T12:00:00.000Z", // observed after committed
          }),
        ),
      ).toThrow();

      expect(() =>
        validateDecisionCase(
          makeDecisionCase({
            committedAt: "not-a-timestamp",
          }),
        ),
      ).toThrow();
    });

    it("rejects non-finite outcome numeric fields", () => {
      expect(() =>
        validateDecisionCase(
          makeDecisionCase({
            outcome: {
              status: "POSITIVE",
              realizedPnlUsd: Number.NaN,
            },
          }),
        ),
      ).toThrow();

      expect(() =>
        validateDecisionCase(
          makeDecisionCase({
            outcome: {
              status: "POSITIVE",
              realizedPnlPercent: Number.POSITIVE_INFINITY,
            },
          }),
        ),
      ).toThrow();
    });
  });

  describe("CaseSimilarityV1 scoring semantics", () => {
    it("identical structured cases compare to 1.0 with complete coverage", () => {
      const target = makeCaseSignature();
      const candidate = makeCaseSignature();

      const result = compareCaseSimilarityV1(target, candidate);

      expect(result.algorithmVersion).toBe(CASE_SIMILARITY_ALGORITHM_VERSION);
      expect(result.totalWeight).toBe(CASE_SIMILARITY_TOTAL_WEIGHT);
      expect(result.comparableWeight).toBe(130);
      expect(result.comparisonCoverage).toBe(1);
      expect(result.comparableSimilarity).toBe(1);
      expect(result.overallSimilarity).toBe(1);
      expect(result.targetCompleteness).toBe(1);
      expect(result.candidateCompleteness).toBe(1);

      for (const component of result.components) {
        expect(component.diagnostic).toBe("MATCH");
        expect(component.distance).toBe(0);
        expect(component.penalty).toBe(0);
        expect(component.score).toBe(1);
        expect(component.weightedScore).toBe(component.weight);
      }
    });

    it("opposing directional states score 0 with OPPOSING diagnostic and full penalty", () => {
      const target = makeCaseSignature({
        evidence: {
          DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE", // +1
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });
      const candidate = makeCaseSignature({
        evidence: {
          DIRECTIONAL_MOMENTUM: "OPPOSING", // -0.5 (opposite sign)
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });

      const result = compareCaseSimilarityV1(target, candidate);
      const dmComp = result.components.find(
        (c) => c.dimension === "DIRECTIONAL_MOMENTUM",
      )!;

      expect(dmComp.diagnostic).toBe("OPPOSING");
      expect(dmComp.score).toBe(0);
      expect(dmComp.distance).toBe(1);
      expect(dmComp.penalty).toBe(1);
      expect(dmComp.weightedScore).toBe(0);

      // Remaining 100 weight matched perfectly: A = 100, W = 130
      expect(result.comparableSimilarity).toBeCloseTo(100 / 130, 6);
      expect(result.overallSimilarity).toBeCloseTo(100 / 130, 6);
    });

    it("partial alignment directional states compute linear distance", () => {
      const target = makeCaseSignature({
        evidence: {
          DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE", // 1.0
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });
      const candidate = makeCaseSignature({
        evidence: {
          DIRECTIONAL_MOMENTUM: "SUPPORTIVE", // 0.5 -> diff 0.5, score 1 - 0.5/2 = 0.75
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });

      const result = compareCaseSimilarityV1(target, candidate);
      const dmComp = result.components.find(
        (c) => c.dimension === "DIRECTIONAL_MOMENTUM",
      )!;

      expect(dmComp.diagnostic).toBe("PARTIAL_ALIGNMENT");
      expect(dmComp.score).toBe(0.75);
      expect(dmComp.distance).toBe(0.25);
      expect(dmComp.penalty).toBe(0.25);
      expect(dmComp.weightedScore).toBe(30 * 0.75);
    });

    it("context dimensions: risk, safety, regimeFit follow exact state formulas", () => {
      const target = makeCaseSignature({
        risk: "ACCEPTABLE", // 1.0
        safety: "CLEAR", // 1.0
        regimeFit: "FIT", // 1.0
      });
      const candidate = makeCaseSignature({
        risk: "ELEVATED", // 0.5 -> diff 0.5 -> score 0.5
        safety: "VETO", // 0.0 -> score 0 OPPOSING
        regimeFit: "BROKEN", // 0.0 -> score 0 OPPOSING
      });

      const result = compareCaseSimilarityV1(target, candidate);
      const riskComp = result.components.find((c) => c.dimension === "risk")!;
      const safetyComp = result.components.find((c) => c.dimension === "safety")!;
      const regimeComp = result.components.find((c) => c.dimension === "regimeFit")!;

      expect(riskComp.diagnostic).toBe("PARTIAL_ALIGNMENT");
      expect(riskComp.score).toBe(0.5);

      expect(safetyComp.diagnostic).toBe("OPPOSING");
      expect(safetyComp.score).toBe(0);

      expect(regimeComp.diagnostic).toBe("OPPOSING");
      expect(regimeComp.score).toBe(0);
    });

    it("strictly distinguishes UNKNOWN from NEUTRAL", () => {
      // 1. Target UNKNOWN vs Candidate UNKNOWN
      const targetBothUnk = makeCaseSignature({
        evidence: {
          DIRECTIONAL_MOMENTUM: "UNKNOWN",
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });
      const candidateBothUnk = makeCaseSignature({
        evidence: {
          DIRECTIONAL_MOMENTUM: "UNKNOWN",
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });

      const resBothUnk = compareCaseSimilarityV1(targetBothUnk, candidateBothUnk);
      const compBothUnk = resBothUnk.components.find(
        (c) => c.dimension === "DIRECTIONAL_MOMENTUM",
      )!;
      expect(compBothUnk.diagnostic).toBe("BOTH_UNKNOWN");
      expect(compBothUnk.score).toBe(0);
      expect(compBothUnk.distance).toBe(1);
      expect(compBothUnk.penalty).toBe(1);
      expect(resBothUnk.comparableWeight).toBe(100); // 130 - 30

      // 2. Target UNKNOWN vs Candidate NEUTRAL
      const candidateNeutral = makeCaseSignature({
        evidence: {
          DIRECTIONAL_MOMENTUM: "NEUTRAL",
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });

      const resTargetUnk = compareCaseSimilarityV1(targetBothUnk, candidateNeutral);
      const compTargetUnk = resTargetUnk.components.find(
        (c) => c.dimension === "DIRECTIONAL_MOMENTUM",
      )!;
      expect(compTargetUnk.diagnostic).toBe("TARGET_UNKNOWN");
      expect(compTargetUnk.score).toBe(0);
      expect(compTargetUnk.distance).toBe(1);
      expect(resTargetUnk.comparableWeight).toBe(100);

      // 3. Target NEUTRAL vs Candidate NEUTRAL is a MATCH and included in comparable weight
      const targetNeutral = makeCaseSignature({
        evidence: {
          DIRECTIONAL_MOMENTUM: "NEUTRAL",
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });

      const resNeutralMatch = compareCaseSimilarityV1(
        targetNeutral,
        candidateNeutral,
      );
      const compNeutralMatch = resNeutralMatch.components.find(
        (c) => c.dimension === "DIRECTIONAL_MOMENTUM",
      )!;
      expect(compNeutralMatch.diagnostic).toBe("MATCH");
      expect(compNeutralMatch.score).toBe(1);
      expect(resNeutralMatch.comparableWeight).toBe(130);
    });

    it("prevents sparse/mostly-UNKNOWN cases from masquerading as high-confidence matches", () => {
      // Case A: Only DIRECTIONAL_MOMENTUM is known on both sides (and matches). All other 7 dims are UNKNOWN.
      const sparseTarget: CaseSignature = {
        evidence: {
          DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
          TECHNICAL_CONFLUENCE: "UNKNOWN",
          RELATIVE_OPPORTUNITY: "UNKNOWN",
          MARKET_ALIGNMENT: "UNKNOWN",
          SENTIMENT_DERIVATIVES: "UNKNOWN",
        },
        risk: "UNKNOWN",
        safety: "UNKNOWN",
        regimeFit: "UNKNOWN",
      };
      const sparseCandidate = { ...sparseTarget };

      const sparseRes = compareCaseSimilarityV1(sparseTarget, sparseCandidate);

      // On the single known dimension, comparableSimilarity is 1.0
      expect(sparseRes.comparableSimilarity).toBe(1.0);
      expect(sparseRes.comparableWeight).toBe(30);

      // BUT comparisonCoverage is only 30/130 (~0.2308)
      expect(sparseRes.comparisonCoverage).toBeCloseTo(30 / 130, 6);

      // And overallSimilarity is heavily dampened to 30/130 (~0.2308), NOT 1.0!
      expect(sparseRes.overallSimilarity).toBeCloseTo(30 / 130, 6);

      // Compare this to a full match Case B:
      const fullTarget = makeCaseSignature();
      const fullCandidate = makeCaseSignature();
      const fullRes = compareCaseSimilarityV1(fullTarget, fullCandidate);

      expect(fullRes.overallSimilarity).toBe(1.0);
      expect(fullRes.overallSimilarity).toBeGreaterThan(
        sparseRes.overallSimilarity * 4,
      );
    });

    it("quarantines outcome/P&L/future lifecycle data from similarity scoring", () => {
      const target = makeCaseSignature();

      const candidateA = makeDecisionCase({
        id: "candidate-a",
        signature: makeCaseSignature(),
        decision: "LONG",
        outcome: {
          status: "POSITIVE",
          realizedPnlUsd: 50_000,
          realizedPnlPercent: 125,
          closeReason: "MANUAL_CLOSE",
        },
      });

      const candidateB = makeDecisionCase({
        id: "candidate-b",
        signature: makeCaseSignature(),
        decision: "SHORT",
        outcome: {
          status: "NEGATIVE",
          realizedPnlUsd: -25_000,
          realizedPnlPercent: -50,
          closeReason: "THESIS_INVALIDATED",
        },
      });

      const resA = compareCaseSimilarityV1(target, candidateA.signature);
      const resB = compareCaseSimilarityV1(target, candidateB.signature);

      // Similarity is identical down to every component and numeric field
      expect(resA.overallSimilarity).toBe(resB.overallSimilarity);
      expect(resA.comparableSimilarity).toBe(resB.comparableSimilarity);
      expect(resA.comparisonCoverage).toBe(resB.comparisonCoverage);
      expect(resA.components).toEqual(resB.components);
    });
  });

  describe("rankComparableCases", () => {
    it("ranks cases deterministically and breaks ties with lexical caseId", () => {
      const target = makeCaseSignature();

      // Three cases:
      // case-1: identical signature (overall = 1.0)
      // case-2: identical signature (overall = 1.0) -> tie with case-1
      // case-3: one opposing dimension (overall < 1.0)
      const case1 = makeDecisionCase({
        id: "case-beta",
        signature: makeCaseSignature(),
      });
      const case2 = makeDecisionCase({
        id: "case-alpha",
        signature: makeCaseSignature(),
      });
      const case3 = makeDecisionCase({
        id: "case-gamma",
        signature: makeCaseSignature({
          evidence: {
            DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING",
            TECHNICAL_CONFLUENCE: "SUPPORTIVE",
            RELATIVE_OPPORTUNITY: "SUPPORTIVE",
            MARKET_ALIGNMENT: "SUPPORTIVE",
            SENTIMENT_DERIVATIVES: "SUPPORTIVE",
          },
        }),
      });

      const ranked = rankComparableCases(target, [case1, case2, case3]);

      expect(ranked).toHaveLength(3);
      // case-alpha beats case-beta by lexical tiebreak
      expect(ranked[0].caseId).toBe("case-alpha");
      expect(ranked[0].rank).toBe(1);
      expect(ranked[0].similarity.overallSimilarity).toBe(1);

      expect(ranked[1].caseId).toBe("case-beta");
      expect(ranked[1].rank).toBe(2);
      expect(ranked[1].similarity.overallSimilarity).toBe(1);

      expect(ranked[2].caseId).toBe("case-gamma");
      expect(ranked[2].rank).toBe(3);
      expect(ranked[2].similarity.overallSimilarity).toBeCloseTo(100 / 130, 6);
    });

    it("is completely invariant to input historical array order", () => {
      const target = makeCaseSignature();

      const c1 = makeDecisionCase({ id: "c-1" });
      const c2 = makeDecisionCase({ id: "c-2" });
      const c3 = makeDecisionCase({ id: "c-3" });
      const c4 = makeDecisionCase({
        id: "c-4",
        signature: makeCaseSignature({
          evidence: {
            DIRECTIONAL_MOMENTUM: "OPPOSING",
            TECHNICAL_CONFLUENCE: "SUPPORTIVE",
            RELATIVE_OPPORTUNITY: "SUPPORTIVE",
            MARKET_ALIGNMENT: "SUPPORTIVE",
            SENTIMENT_DERIVATIVES: "SUPPORTIVE",
          },
        }),
      });

      const perm1 = [c1, c2, c3, c4];
      const perm2 = [c4, c3, c2, c1];
      const perm3 = [c2, c4, c1, c3];

      const res1 = rankComparableCases(target, perm1);
      const res2 = rankComparableCases(target, perm2);
      const res3 = rankComparableCases(target, perm3);

      expect(res1.map((r) => r.caseId)).toEqual(["c-1", "c-2", "c-3", "c-4"]);
      expect(res2.map((r) => r.caseId)).toEqual(["c-1", "c-2", "c-3", "c-4"]);
      expect(res3.map((r) => r.caseId)).toEqual(["c-1", "c-2", "c-3", "c-4"]);
      expect(res1).toEqual(res2);
      expect(res1).toEqual(res3);
    });

    it("applies retrieval options: limit, minimumSimilarity, minimumComparisonCoverage", () => {
      const target = makeCaseSignature();

      const cFull = makeDecisionCase({ id: "c-full" });
      const cPartial = makeDecisionCase({
        id: "c-partial",
        signature: makeCaseSignature({
          evidence: {
            DIRECTIONAL_MOMENTUM: "OPPOSING",
            TECHNICAL_CONFLUENCE: "SUPPORTIVE",
            RELATIVE_OPPORTUNITY: "SUPPORTIVE",
            MARKET_ALIGNMENT: "SUPPORTIVE",
            SENTIMENT_DERIVATIVES: "SUPPORTIVE",
          },
        }),
      });

      // Filter by minimumSimilarity = 0.9 (excludes cPartial)
      const filteredSim = rankComparableCases(target, [cFull, cPartial], {
        minimumSimilarity: 0.9,
      });
      expect(filteredSim).toHaveLength(1);
      expect(filteredSim[0].caseId).toBe("c-full");

      // Limit = 1
      const limited = rankComparableCases(target, [cFull, cPartial], { limit: 1 });
      expect(limited).toHaveLength(1);
      expect(limited[0].caseId).toBe("c-full");
    });

    it("rejects duplicate candidate IDs and invalid options", () => {
      const target = makeCaseSignature();
      const duplicateCases = [
        makeDecisionCase({ id: "duplicate-id" }),
        makeDecisionCase({ id: "duplicate-id" }),
      ];

      expect(() => rankComparableCases(target, duplicateCases)).toThrow(
        /duplicate/i,
      );

      expect(() =>
        rankComparableCases(target, [makeDecisionCase({ id: "c-1" })], {
          limit: -1,
        }),
      ).toThrow();

      expect(() =>
        rankComparableCases(target, [makeDecisionCase({ id: "c-1" })], {
          limit: 0,
        }),
      ).toThrow();

      expect(() =>
        rankComparableCases(target, [makeDecisionCase({ id: "c-1" })], {
          minimumSimilarity: 1.5,
        }),
      ).toThrow();
    });

    it("does not mutate inputs", () => {
      const target = makeCaseSignature();
      const targetBefore = JSON.parse(JSON.stringify(target));
      const candidates = [
        makeDecisionCase({ id: "c-2" }),
        makeDecisionCase({ id: "c-1" }),
      ];
      const candidatesBefore = JSON.parse(JSON.stringify(candidates));

      rankComparableCases(target, candidates);

      expect(target).toEqual(targetBefore);
      expect(candidates).toEqual(candidatesBefore);
      expect(candidates[0].id).toBe("c-2"); // original array order preserved
    });
  });

  describe("MemorySnapshot and canonical serialization", () => {
    it("creates an immutable snapshot and freezes all references", () => {
      const targetSignature = makeCaseSignature();
      const candidateCase = makeDecisionCase({ id: "c-hist-1" });
      const ranked = rankComparableCases(targetSignature, [candidateCase]);

      const snapshot = createMemorySnapshot({
        snapshotId: "snapshot-101",
        targetSignature,
        rankedCases: ranked,
        createdAt: "2026-09-24T12:30:00.000Z",
        metadata: {
          source: "unit-test",
          runCount: 42,
        },
      });

      expect(snapshot.snapshotId).toBe("snapshot-101");
      expect(snapshot.algorithmVersion).toBe(CASE_SIMILARITY_ALGORITHM_VERSION);
      expect(snapshot.rankedCases).toHaveLength(1);
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.rankedCases)).toBe(true);
      expect(Object.isFrozen(snapshot.targetSignature)).toBe(true);
    });

    it("rejects mismatch between targetCase.signature and targetSignature", () => {
      const targetSignature = makeCaseSignature();
      const mismatchCase = makeDecisionCase({
        id: "target-case",
        signature: makeCaseSignature({
          risk: "EXTREME", // mismatch
        }),
      });

      expect(() =>
        createMemorySnapshot({
          snapshotId: "snapshot-mismatch",
          targetCase: mismatchCase,
          targetSignature,
          rankedCases: [],
          createdAt: "2026-09-24T12:30:00.000Z",
        }),
      ).toThrow(/signature/i);
    });

    it("serializeMemorySnapshot produces deterministic byte-for-byte identical output", () => {
      const targetSignature = makeCaseSignature();
      const candidateCase = makeDecisionCase({ id: "c-hist-1" });
      const ranked = rankComparableCases(targetSignature, [candidateCase]);

      const snapA = createMemorySnapshot({
        snapshotId: "snap-canonical",
        targetSignature,
        rankedCases: ranked,
        createdAt: "2026-09-24T12:00:00.000Z",
        metadata: {
          b: "second",
          a: "first",
        },
      });

      const snapB = createMemorySnapshot({
        snapshotId: "snap-canonical",
        targetSignature,
        rankedCases: ranked,
        createdAt: "2026-09-24T12:00:00.000Z",
        metadata: {
          a: "first",
          b: "second",
        },
      });

      const serializedA = serializeMemorySnapshot(snapA);
      const serializedB = serializeMemorySnapshot(snapB);

      expect(serializedA).toBe(serializedB);
      expect(typeof serializedA).toBe("string");
      expect(serializedA.length).toBeGreaterThan(100);
    });
    it("rejects malformed similarity result components in snapshot creation", () => {
      const targetSignature = makeCaseSignature();
      const validCase = makeDecisionCase({ id: "c-1" });
      const validRanked = rankComparableCases(targetSignature, [validCase]);

      // Clone and tamper with components (empty components array)
      const badRanked = [
        {
          ...validRanked[0],
          similarity: {
            ...validRanked[0].similarity,
            components: [], // empty components
          },
        },
      ];

      expect(() =>
        createMemorySnapshot({
          snapshotId: "snap-bad-comp",
          targetSignature,
          rankedCases: badRanked as unknown as typeof validRanked,
          createdAt: "2026-09-24T12:00:00.000Z",
        }),
      ).toThrow(/components must contain exactly 8 items/i);
    });
  });

  describe("InMemoryMemoryProvider boundary", () => {
    it("supports append-only, idempotent storeCase and conflict detection", async () => {
      const provider = new InMemoryMemoryProvider();
      const caseItem = makeDecisionCase({ id: "stored-case-1" });

      // First store
      await provider.storeCase(caseItem);
      const retrieved = await provider.getCase("stored-case-1");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe("stored-case-1");

      // Idempotent store with identical content succeeds
      await expect(provider.storeCase(caseItem)).resolves.not.toThrow();

      // Conflicting store with different content throws
      const conflictingCase = makeDecisionCase({
        id: "stored-case-1",
        asset: "ETH", // changed
      });
      await expect(provider.storeCase(conflictingCase)).rejects.toThrow(
        /already exists with different content/i,
      );
    });

    it("listCases returns cases in code-unit lexical order by id", async () => {
      const provider = new InMemoryMemoryProvider();
      await provider.storeCase(makeDecisionCase({ id: "case-3" }));
      await provider.storeCase(makeDecisionCase({ id: "case-1" }));
      await provider.storeCase(makeDecisionCase({ id: "case-2" }));

      const list = await provider.listCases();
      expect(list.map((c) => c.id)).toEqual(["case-1", "case-2", "case-3"]);
    });

    it("later additions to provider corpus do not mutate already-created snapshot", async () => {
      const provider = new InMemoryMemoryProvider();
      const c1 = makeDecisionCase({ id: "c-1" });
      await provider.storeCase(c1);

      const target = makeCaseSignature();
      const casesAtDecision = await provider.listCases();
      const ranked = rankComparableCases(target, casesAtDecision);

      const snapshot = createMemorySnapshot({
        snapshotId: "snap-frozen",
        targetSignature: target,
        rankedCases: ranked,
        createdAt: "2026-09-24T12:00:00.000Z",
      });

      await provider.storeSnapshot(snapshot);

      // Later, new cases are added to historical memory
      const c2 = makeDecisionCase({ id: "c-2" });
      const c3 = makeDecisionCase({ id: "c-3" });
      await provider.storeCase(c2);
      await provider.storeCase(c3);

      // The historical corpus now has 3 cases
      const updatedList = await provider.listCases();
      expect(updatedList).toHaveLength(3);

      // But the frozen snapshot retrieved from provider remains untouched with exactly 1 case
      const retrievedSnap = await provider.getSnapshot("snap-frozen");
      expect(retrievedSnap?.rankedCases).toHaveLength(1);
      expect(retrievedSnap?.rankedCases[0].caseId).toBe("c-1");
    });
    it("rejects duplicate (thesisId, versionId) under different case IDs", async () => {
      const provider = new InMemoryMemoryProvider();
      await provider.storeCase(
        makeDecisionCase({
          id: "case-first",
          thesisId: "thesis-shared",
          versionId: "version-1",
        }),
      );

      await expect(
        provider.storeCase(
          makeDecisionCase({
            id: "case-second",
            thesisId: "thesis-shared",
            versionId: "version-1",
          }),
        ),
      ).rejects.toThrow(/already exists under id/i);
    });

    it("rejects non-canonical UTC timestamps and timezone offsets", async () => {
      const provider = new InMemoryMemoryProvider();
      // Missing milliseconds
      await expect(
        provider.storeCase(
          makeDecisionCase({
            id: "case-bad-ts-1",
            committedAt: "2026-09-24T12:00:00Z",
          }),
        ),
      ).rejects.toThrow(/RFC3339 timestamp/i);

      // Timezone offset instead of Z
      await expect(
        provider.storeCase(
          makeDecisionCase({
            id: "case-bad-ts-2",
            committedAt: "2026-09-24T14:00:00.000+02:00",
          }),
        ),
      ).rejects.toThrow(/RFC3339 timestamp/i);
    });
  });
});
