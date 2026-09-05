import { describe, expect, it } from "vitest";
import type { EvidenceItem } from "../lib/evidence/types";
import {
  buildStrategyDiff,
  type StrategyDiffSnapshot,
} from "../lib/thesis/diff";
import { receiptEvidence, receiptRules } from "./fixtures/receipt";
import { makeCandidateEvaluation } from "./fixtures/dm1";
import { makeExistingThesisHistory } from "./fixtures/thesis";

function makeSnapshot(
  overrides: Partial<StrategyDiffSnapshot> = {},
): StrategyDiffSnapshot {
  const { versions } = makeExistingThesisHistory();
  return {
    version: versions[0],
    normalizerVersion: "normalizer-1.0.0",
    evidenceItems: receiptEvidence,
    candidateEvaluations: [
      makeCandidateEvaluation({ asset: "SOL", selected: true }),
      makeCandidateEvaluation({
        asset: "ETH",
        selected: false,
        thesisStrength: 65,
      }),
    ],
    invalidationRules: receiptRules,
    ...overrides,
  };
}

function cloneEvidence(
  dimension: EvidenceItem["dimension"],
  overrides: Partial<EvidenceItem> = {},
): EvidenceItem {
  const item = receiptEvidence.find((candidate) => candidate.dimension === dimension);
  if (item === undefined) {
    throw new Error(`Missing fixture evidence for ${dimension}`);
  }
  return { ...item, ...overrides };
}

function expectSuccess(input: Parameters<typeof buildStrategyDiff>[0]) {
  const result = buildStrategyDiff(input);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }
  return result.diff;
}

describe("Strategy Diff", () => {
  it("is invariant to input ordering and ignores snapshot metadata-only changes", () => {
    const before = makeSnapshot();
    const beforeVersion = before.version;
    const after = makeSnapshot({
      version: {
        ...beforeVersion,
        id: "version-2",
        versionNumber: 2,
        evidenceSnapshotId: "evidence-snapshot-2",
        createdAt: "2026-09-05T13:00:00.000Z",
      },
      evidenceItems: [...before.evidenceItems].reverse(),
      candidateEvaluations: [...before.candidateEvaluations].reverse(),
      invalidationRules: [...before.invalidationRules].reverse(),
    });
    const beforeSerialized = JSON.stringify(before);
    const afterSerialized = JSON.stringify(after);

    const diff = expectSuccess({ before, after });

    expect(diff.hasMeaningfulChange).toBe(false);
    expect(diff.evidenceChanges.every((change) => !change.changed)).toBe(true);
    expect(diff.candidateRanking.changed).toBe(false);
    expect(diff.invalidationRules.changed).toBe(false);
    expect(JSON.stringify(before)).toBe(beforeSerialized);
    expect(JSON.stringify(after)).toBe(afterSerialized);
  });

  it("reports evidence state transitions, additions and removals in canonical order", () => {
    const before = makeSnapshot({
      evidenceItems: [
        cloneEvidence("DIRECTIONAL_MOMENTUM"),
        cloneEvidence("RELATIVE_OPPORTUNITY"),
        cloneEvidence("MARKET_ALIGNMENT"),
        cloneEvidence("SENTIMENT_DERIVATIVES"),
      ],
    });
    const after = makeSnapshot({
      evidenceItems: [
        cloneEvidence("DIRECTIONAL_MOMENTUM", { state: "UNKNOWN" }),
        cloneEvidence("SENTIMENT_DERIVATIVES", { state: "SUPPORTIVE" }),
        cloneEvidence("TECHNICAL_CONFLUENCE", { state: "SUPPORTIVE" }),
      ],
    });

    const diff = expectSuccess({ before, after });

    expect(diff.evidenceChanges.map((change) => change.dimension)).toEqual([
      "DIRECTIONAL_MOMENTUM",
      "TECHNICAL_CONFLUENCE",
      "RELATIVE_OPPORTUNITY",
      "MARKET_ALIGNMENT",
      "SENTIMENT_DERIVATIVES",
    ]);
    expect(diff.evidenceChanges.map((change) => change.kind)).toEqual([
      "BECAME_UNKNOWN",
      "ADDED",
      "REMOVED",
      "REMOVED",
      "BECAME_AVAILABLE",
    ]);
    expect(diff.newlyMissingEvidence.map((change) => change.dimension)).toEqual([
      "DIRECTIONAL_MOMENTUM",
      "RELATIVE_OPPORTUNITY",
      "MARKET_ALIGNMENT",
    ]);
    expect(diff.newlyAvailableEvidence.map((change) => change.dimension)).toEqual([
      "TECHNICAL_CONFLUENCE",
      "SENTIMENT_DERIVATIVES",
    ]);
    expect(diff.hasMeaningfulChange).toBe(true);
  });

  it("returns numeric deltas and leaves delta null when one side is null", () => {
    const before = makeSnapshot();
    const after = makeSnapshot({
      version: {
        ...before.version,
        thesisStrength: 60,
        coverage: 0.8,
        conflict: 0.2,
        directionalScore: 60,
      },
    });

    const diff = expectSuccess({ before, after });

    expect(diff.score).toEqual({ before: 70, after: 60, changed: true, delta: -10 });
    expect(diff.thesisStrength.delta).toBe(-10);
    expect(diff.coverage.delta).toBe(-0.19999999999999996);
    expect(diff.conflict).toEqual({ before: 0.1, after: 0.2, changed: true, delta: 0.1 });

    const nullAfter = makeSnapshot({
      version: { ...before.version, conflict: null },
    });
    expect(expectSuccess({ before, after: nullAfter }).conflict.delta).toBeNull();
  });

  it("reports provenance changes but ignores observation timestamp-only changes", () => {
    const before = makeSnapshot();
    const after = makeSnapshot({
      version: {
        ...before.version,
        id: "version-2",
        versionNumber: 2,
        evidenceSnapshotId: "evidence-snapshot-2",
        createdAt: "2026-09-05T13:00:00.000Z",
      },
      evidenceItems: before.evidenceItems.map((item) =>
        item.dimension === "TECHNICAL_CONFLUENCE"
          ? { ...item, source: "technical-source-2" }
          : { ...item, observedAt: "2026-09-05T13:30:00.000Z" },
      ),
    });

    const diff = expectSuccess({ before, after });
    const technical = diff.evidenceChanges.find(
      (change) => change.dimension === "TECHNICAL_CONFLUENCE",
    );
    const momentum = diff.evidenceChanges.find(
      (change) => change.dimension === "DIRECTIONAL_MOMENTUM",
    );

    expect(technical?.kind).toBe("PROVENANCE_CHANGED");
    expect(technical?.changed).toBe(true);
    expect(momentum?.kind).toBe("UNCHANGED");
    expect(momentum?.changed).toBe(false);
    expect(diff.provenanceChanges.map((change) => change.dimension)).toEqual([
      "DIRECTIONAL_MOMENTUM",
      "TECHNICAL_CONFLUENCE",
      "RELATIVE_OPPORTUNITY",
      "MARKET_ALIGNMENT",
      "SENTIMENT_DERIVATIVES",
    ]);
    expect(diff.hasMeaningfulChange).toBe(true);
  });

  it("reports deterministic candidate rank, selection and content changes", () => {
    const before = makeSnapshot();
    const after = makeSnapshot({
      candidateEvaluations: [
        makeCandidateEvaluation({
          asset: "ETH",
          selected: true,
          thesisStrength: 80,
        }),
        makeCandidateEvaluation({
          asset: "ADA",
          selected: false,
          thesisStrength: null,
          decision: "ABSTAIN",
        }),
        makeCandidateEvaluation({
          asset: "SOL",
          selected: false,
          thesisStrength: 60,
        }),
      ],
    });

    const diff = expectSuccess({ before, after });

    expect(diff.candidateRanking.before).toEqual([
      { asset: "SOL", rank: 1, selected: true },
      { asset: "ETH", rank: 2, selected: false },
    ]);
    expect(diff.candidateRanking.after).toEqual([
      { asset: "ETH", rank: 1, selected: true },
      { asset: "SOL", rank: 2, selected: false },
      { asset: "ADA", rank: 3, selected: false },
    ]);
    expect(diff.candidateRanking.changes.map((change) => change.asset)).toEqual([
      "ADA",
      "ETH",
      "SOL",
    ]);
    expect(diff.candidateRanking.changes.every((change) => change.changed)).toBe(true);
  });

  it("diffs invalidation rule semantics without treating description-only wording as logical change", () => {
    const before = makeSnapshot();
    const after = makeSnapshot({
      invalidationRules: [
        { ...receiptRules[0], description: "Reworded regime requirement." },
        {
          ...receiptRules[1],
          condition: { ...receiptRules[1].condition, value: 50 },
        },
      ],
    });

    const diff = expectSuccess({ before, after });
    expect(diff.invalidationRules.changes).toHaveLength(2);
    expect(diff.invalidationRules.changes[0].kind).toBe("CHANGED");
    expect(diff.invalidationRules.changes[1].kind).toBe("UNCHANGED");
    expect(diff.invalidationRules.changed).toBe(true);
  });

  it.each([
    ["ASSET_MISMATCH", (snapshot: StrategyDiffSnapshot) => ({
      ...snapshot,
      version: { ...snapshot.version, asset: "ETH" },
    })],
    ["STRATEGY_VERSION_MISMATCH", (snapshot: StrategyDiffSnapshot) => ({
      ...snapshot,
      version: { ...snapshot.version, strategyVersion: "2.0.0" },
    })],
    ["NORMALIZER_VERSION_MISMATCH", (snapshot: StrategyDiffSnapshot) => ({
      ...snapshot,
      normalizerVersion: "normalizer-2.0.0",
    })],
  ] as const)("rejects %s comparisons", (code, mutateAfter) => {
    const before = makeSnapshot();
    const result = buildStrategyDiff({ before, after: mutateAfter(before) });
    expect(result).toMatchObject({ ok: false, code });
  });

  it("rejects ambiguous evidence and candidate identities", () => {
    const snapshot = makeSnapshot();
    const duplicateEvidence = {
      ...snapshot,
      evidenceItems: [
        ...snapshot.evidenceItems,
        cloneEvidence("DIRECTIONAL_MOMENTUM", { id: "momentum-2" }),
      ],
    };
    const duplicateCandidate = {
      ...snapshot,
      candidateEvaluations: [
        ...snapshot.candidateEvaluations,
        makeCandidateEvaluation({ asset: "SOL" }),
      ],
    };

    expect(buildStrategyDiff({ before: snapshot, after: duplicateEvidence })).toMatchObject({
      ok: false,
      code: "DUPLICATE_EVIDENCE_DIMENSION",
    });
    expect(buildStrategyDiff({ before: snapshot, after: duplicateCandidate })).toMatchObject({
      ok: false,
      code: "DUPLICATE_CANDIDATE_ASSET",
    });
  });
});
