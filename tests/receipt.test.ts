import { describe, expect, it } from "vitest";
import { createThesis } from "../lib/thesis/build";
import {
  buildThesisReceipt,
  canonicalizeThesisReceipt,
  hashCanonicalReceipt,
  serializeCanonicalReceiptPayload,
} from "../lib/thesis/receipt";
import type {
  ThesisReceiptCanonicalPayload,
  ThesisReceiptInput,
  ThesisReceiptSuccess,
} from "../lib/thesis/types";
import {
  buildReceiptFixture,
  makeReceiptInput,
  makeReceiptKillSwitch,
  receiptEvidence,
  receiptRules,
  makeValidatedChallenge,
} from "./fixtures/receipt";
import {
  makeDecisionResult,
  makeKillSwitchAggregate,
  makeThesisCommitInput,
} from "./fixtures/thesis";

function build(input: ThesisReceiptInput): ThesisReceiptSuccess {
  const result = buildThesisReceipt(input);
  if (!result.ok) {
    throw new Error(`Receipt build failed: ${result.code}`);
  }
  return result;
}

describe("Thesis Receipt construction", () => {
  it("builds a LONG receipt with classified evidence and canonical fields", () => {
    const result = buildReceiptFixture();

    expect(result.receipt.decision).toBe("LONG");
    expect(result.receipt.canonicalHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.receipt.supportingEvidence.map((item) => item.id)).toEqual([
      "evidence-momentum",
      "evidence-relative",
    ]);
    expect(result.receipt.contradictingEvidence.map((item) => item.id)).toEqual([
      "evidence-technical",
    ]);
    expect(result.receipt.neutralEvidence.map((item) => item.id)).toEqual([
      "evidence-market",
    ]);
    expect(result.receipt.unknownEvidence.map((item) => item.id)).toEqual([
      "evidence-unknown",
    ]);
    expect(result.receipt.candidateRanking.map((candidate) => candidate.asset)).toEqual([
      "SOL",
      "ETH",
    ]);
    expect(result.receipt.invalidationRules.map((rule) => rule.ruleType)).toEqual([
      "DIRECTION_LOSS",
      "REGIME_BREAK",
    ]);
    expect(result.receipt.killSwitch?.verdict).toBe("CLEAR");
    expect(result.receipt.killSwitch?.challenges[0]?.challengeId).toBe("challenge-1");
  });

  it("builds a SHORT receipt and classifies negative evidence as support", () => {
    const committed = createThesis(
      makeThesisCommitInput({
        versionId: "short-version-1",
        decision: makeDecisionResult({
          decision: "SHORT",
          provisionalDirection: "SHORT",
          directionalScore: -75,
          thesisStrength: 75,
        }),
        killSwitch: makeKillSwitchAggregate("CAUTION"),
      }),
    );
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    const result = build(
      makeReceiptInput({
        receiptId: "short-receipt",
        thesis: committed.thesis,
        version: committed.version,
        killSwitch: makeReceiptKillSwitch({ verdict: "CAUTION" }),
        killSwitchRunId: undefined,
      }),
    );

    expect(result.receipt.decision).toBe("SHORT");
    expect(result.receipt.supportingEvidence.map((item) => item.id)).toEqual([
      "evidence-technical",
    ]);
    expect(result.receipt.contradictingEvidence.map((item) => item.id)).toEqual([
      "evidence-momentum",
      "evidence-relative",
    ]);
  });

  it("builds an ABSTAIN receipt without KillSwitch or invented direction", () => {
    const committed = createThesis(
      makeThesisCommitInput({
        decision: {
          ...makeDecisionResult(),
          decision: "ABSTAIN",
          provisionalDirection: null,
          thesisStrength: null,
        },
      }),
    );
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    const result = build(
      makeReceiptInput({
        receiptId: "abstain-receipt",
        thesis: committed.thesis,
        version: committed.version,
        killSwitch: undefined,
        killSwitchRunId: undefined,
      }),
    );

    expect(result.receipt.decision).toBe("ABSTAIN");
    expect(result.receipt.thesisStrength).toBeNull();
    expect(result.receipt.supportingEvidence).toEqual([]);
    expect(result.receipt.contradictingEvidence).toEqual([]);
    expect(result.receipt.availableEvidence).toHaveLength(4);
    expect(result.receipt.unknownEvidence).toHaveLength(1);
    expect(result.receipt.killSwitch).toBeNull();
  });
});

describe("Thesis Receipt canonicalization and hashing", () => {
  it("produces the same canonical payload and hash for identical logical state", () => {
    const first = build(makeReceiptInput());
    const second = build(makeReceiptInput());

    expect(second.canonicalPayload).toEqual(first.canonicalPayload);
    expect(second.canonicalSerialized).toBe(first.canonicalSerialized);
    expect(second.receipt.canonicalHash).toBe(first.receipt.canonicalHash);
  });

  it("keeps receipt IDs public but excludes them from logical hash state", () => {
    const first = build(makeReceiptInput({ receiptId: "receipt-1" }));
    const second = build(makeReceiptInput({ receiptId: "receipt-2" }));

    expect(first.receipt.id).toBe("receipt-1");
    expect(second.receipt.id).toBe("receipt-2");
    expect(first.receipt.id).not.toBe(second.receipt.id);
    expect(second.canonicalPayload).toEqual(first.canonicalPayload);
    expect(second.receipt.canonicalHash).toBe(first.receipt.canonicalHash);
  });

  it("canonicalizes evidence regardless of input ordering", () => {
    const first = build(makeReceiptInput());
    const second = build(
      makeReceiptInput({ evidenceItems: [...receiptEvidence].reverse() }),
    );

    expect(second.canonicalSerialized).toBe(first.canonicalSerialized);
    expect(second.receipt.canonicalHash).toBe(first.receipt.canonicalHash);
  });

  it("canonicalizes candidate ordering using deterministic DM-1 tie-break rules", () => {
    const input = makeReceiptInput();
    const first = build(input);
    const second = build({
      ...input,
      candidateEvaluations: [...input.candidateEvaluations].reverse(),
    });

    expect(second.receipt.candidateRanking).toEqual(first.receipt.candidateRanking);
    expect(second.receipt.canonicalHash).toBe(first.receipt.canonicalHash);
  });

  it("canonicalizes KillSwitch challenge ordering", () => {
    const firstChallenge = makeValidatedChallenge({
      challengeId: "challenge-1",
      challengeType: "DIRECTION_CONTRADICTION",
    });
    const secondChallenge = makeValidatedChallenge({
      challengeId: "challenge-2",
      challengeType: "SINGLE_SOURCE_FRAGILITY",
      validatedEvidenceIds: ["evidence-momentum"],
      reasonCodes: ["SINGLE_SOURCE_FRAGILITY_FOUND"],
    });
    const first = build(
      makeReceiptInput({
        killSwitch: makeReceiptKillSwitch({
          results: [firstChallenge, secondChallenge],
        }),
      }),
    );
    const second = build(
      makeReceiptInput({
        killSwitch: makeReceiptKillSwitch({
          results: [secondChallenge, firstChallenge],
        }),
      }),
    );

    expect(second.receipt.killSwitch?.challenges).toEqual(
      first.receipt.killSwitch?.challenges,
    );
    expect(second.receipt.canonicalHash).toBe(first.receipt.canonicalHash);
  });

  it("canonicalizes invalidation rule ordering", () => {
    const first = build(makeReceiptInput());
    const second = build(
      makeReceiptInput({ invalidationRules: [...receiptRules].reverse() }),
    );

    expect(second.receipt.invalidationRules).toEqual(first.receipt.invalidationRules);
    expect(second.receipt.canonicalHash).toBe(first.receipt.canonicalHash);
  });

  it("ignores object property insertion order", () => {
    const result = buildReceiptFixture();
    const reorderedReceipt = {
      canonicalHash: result.receipt.canonicalHash,
      createdAt: result.receipt.createdAt,
      warningCodes: result.receipt.warningCodes,
      reasonCodes: result.receipt.reasonCodes,
      invalidationRules: result.receipt.invalidationRules,
      killSwitch: result.receipt.killSwitch,
      candidateRanking: result.receipt.candidateRanking,
      unknownEvidence: result.receipt.unknownEvidence,
      availableEvidence: result.receipt.availableEvidence,
      neutralEvidence: result.receipt.neutralEvidence,
      contradictingEvidence: result.receipt.contradictingEvidence,
      supportingEvidence: result.receipt.supportingEvidence,
      evidenceSnapshotId: result.receipt.evidenceSnapshotId,
      normalizerVersion: result.receipt.normalizerVersion,
      strategyVersion: result.receipt.strategyVersion,
      strategyId: result.receipt.strategyId,
      regimeFit: result.receipt.regimeFit,
      safety: result.receipt.safety,
      risk: result.receipt.risk,
      conflictLabel: result.receipt.conflictLabel,
      conflict: result.receipt.conflict,
      coverageLabel: result.receipt.coverageLabel,
      coverage: result.receipt.coverage,
      thesisStrength: result.receipt.thesisStrength,
      directionalScore: result.receipt.directionalScore,
      decision: result.receipt.decision,
      statusAtCommit: result.receipt.statusAtCommit,
      asset: result.receipt.asset,
      versionNumber: result.receipt.versionNumber,
      thesisVersionId: result.receipt.thesisVersionId,
      thesisId: result.receipt.thesisId,
      id: result.receipt.id,
      receiptSchemaVersion: result.receipt.receiptSchemaVersion,
    };

    expect(
      canonicalizeThesisReceipt(reorderedReceipt as typeof result.receipt),
    ).toBe(result.canonicalSerialized);
  });

  it.each([
    ["decision", (input: ThesisReceiptInput) => ({
      ...input,
      version: { ...input.version, decision: "SHORT" as const },
    })],
    ["directional score", (input: ThesisReceiptInput) => ({
      ...input,
      version: { ...input.version, directionalScore: 99 },
    })],
    ["evidence state", (input: ThesisReceiptInput) => ({
      ...input,
      evidenceItems: input.evidenceItems.map((item) =>
        item.id === "evidence-momentum"
          ? { ...item, state: "SUPPORTIVE" as const }
          : item,
      ),
    })],
    ["evidence snapshot ID", (input: ThesisReceiptInput) => ({
      ...input,
      version: { ...input.version, evidenceSnapshotId: "snapshot-2" },
    })],
    ["strategy version", (input: ThesisReceiptInput) => ({
      ...input,
      version: { ...input.version, strategyVersion: "1.0.1" },
    })],
    ["normalizer version", (input: ThesisReceiptInput) => ({
      ...input,
      normalizerVersion: "normalizer-2.0.0",
    })],
    ["invalidation rule", (input: ThesisReceiptInput) => ({
      ...input,
      invalidationRules: input.invalidationRules.map((rule) =>
        rule.id === "rule-regime" ? { ...rule, effect: "CLOSE" as const } : rule,
      ),
    })],
  ] as const)("changes the hash when %s changes", (_label, change) => {
    const first = build(makeReceiptInput());
    const second = build(change(makeReceiptInput()));

    expect(second.receipt.canonicalHash).not.toBe(first.receipt.canonicalHash);
  });

  it.each([
    ["thesis ID", (input: ThesisReceiptInput) => ({
      ...input,
      version: { ...input.version, thesisId: "different-thesis" },
      thesis: { ...input.thesis, id: "different-thesis" },
    })],
    ["thesis version ID", (input: ThesisReceiptInput) => ({
      ...input,
      version: { ...input.version, id: "version-2" },
      thesis: {
        ...input.thesis,
        currentVersionId: "version-2",
      },
    })],
  ] as const)("changes the hash when %s changes", (_label, change) => {
    const first = build(makeReceiptInput());
    const second = build(change(makeReceiptInput()));

    expect(second.receipt.canonicalHash).not.toBe(first.receipt.canonicalHash);
  });

  it("changes the hash when the receipt schema version changes", () => {
    const result = buildReceiptFixture();
    const changedPayload = {
      ...result.canonicalPayload,
      receiptSchemaVersion: "1.0.1",
    };

    expect(
      hashCanonicalReceipt(serializeCanonicalReceiptPayload(changedPayload)),
    ).not.toBe(result.receipt.canonicalHash);
  });

  it("changes the hash when a validated KillSwitch effect changes", () => {
    const first = build(
      makeReceiptInput({
        killSwitch: makeReceiptKillSwitch({
          results: [makeValidatedChallenge({ effect: "CAUTION" })],
        }),
      }),
    );
    const second = build(
      makeReceiptInput({
        killSwitch: makeReceiptKillSwitch({
          results: [makeValidatedChallenge({ effect: "NONE" })],
        }),
      }),
    );

    expect(second.receipt.canonicalHash).not.toBe(first.receipt.canonicalHash);
  });

  it("does not hash supplied generated explanation text", () => {
    const first = build(makeReceiptInput({ explanation: "First explanation." }));
    const second = build(makeReceiptInput({ explanation: "Different prose." }));

    expect(second.receipt.canonicalHash).toBe(first.receipt.canonicalHash);
    expect(second.canonicalSerialized).not.toContain("explanation");
  });
});

describe("Thesis Receipt validation and integrity", () => {
  it("rejects Thesis identity mismatch and asset mismatch", () => {
    const input = makeReceiptInput();

    expect(
      buildThesisReceipt({
        ...input,
        thesis: { ...input.thesis, id: "different-thesis" },
      }),
    ).toMatchObject({ ok: false, code: "THESIS_ID_MISMATCH" });
    expect(
      buildThesisReceipt({
        ...input,
        thesis: { ...input.thesis, asset: "ETH" },
      }),
    ).toMatchObject({ ok: false, code: "ASSET_MISMATCH" });
  });

  it("rejects a non-current version unless historical mode is explicit", () => {
    const input = makeReceiptInput();
    const historicalVersion = { ...input.version, id: "version-0" };

    expect(
      buildThesisReceipt({ ...input, version: historicalVersion }),
    ).toMatchObject({ ok: false, code: "VERSION_NOT_CURRENT" });
    expect(
      build(
        makeReceiptInput({
          version: historicalVersion,
          receiptMode: "HISTORICAL",
        }),
      ).receipt.thesisVersionId,
    ).toBe("version-0");
  });

  it("uses immutable statusAtCommit instead of mutable Thesis.status", () => {
    const input = makeReceiptInput();
    const first = build(input);
    const second = build({
      ...input,
      thesis: { ...input.thesis, status: "INVALIDATED" },
    });

    expect(first.receipt.statusAtCommit).toBe("ACTIVE");
    expect(second.receipt.statusAtCommit).toBe("ACTIVE");
    expect(second.receipt.canonicalHash).toBe(first.receipt.canonicalHash);
  });

  it("keeps historical receipt status at commit when current Thesis status changes", () => {
    const input = makeReceiptInput({
      receiptMode: "HISTORICAL",
      thesis: {
        ...makeReceiptInput().thesis,
        currentVersionId: "version-2",
        currentVersionNumber: 2,
        status: "INVALIDATED",
      },
    });
    const result = build(input);

    expect(result.receipt.statusAtCommit).toBe("ACTIVE");
    expect(result.receipt.canonicalHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not mutate receipt inputs or nested state", () => {
    const input = makeReceiptInput();
    const before = JSON.stringify(input);

    buildThesisReceipt(input);

    expect(JSON.stringify(input)).toBe(before);
  });

  it("contains only serializable canonical state", () => {
    const result = buildReceiptFixture();
    const parsed = JSON.parse(result.canonicalSerialized) as Record<string, unknown>;

    expect(parsed).toEqual(result.canonicalPayload);
    expect(result.canonicalSerialized).not.toContain("undefined");
    expect(result.canonicalSerialized).not.toContain("function");
    expect(result.receipt.canonicalHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches the fixed canonical hash vector", () => {
    const payload: ThesisReceiptCanonicalPayload = {
      receiptSchemaVersion: "1.0.0",
      thesisId: "vector-thesis",
      thesisVersionId: "vector-version",
      versionNumber: 1,
      asset: "SOL",
      statusAtCommit: "ACTIVE",
      decision: "LONG",
      directionalScore: 60,
      thesisStrength: 60,
      coverage: 1,
      coverageLabel: "COMPLETE",
      conflict: 0,
      conflictLabel: "LOW",
      risk: "ACCEPTABLE",
      safety: "CLEAR",
      regimeFit: "FIT",
      strategyId: "dm-1",
      strategyVersion: "1.0.0",
      normalizerVersion: "normalizer-1",
      evidenceSnapshotId: "snapshot-1",
      supportingEvidence: [],
      contradictingEvidence: [],
      neutralEvidence: [],
      availableEvidence: [],
      unknownEvidence: [],
      candidateRanking: [],
      killSwitch: null,
      invalidationRules: [],
      reasonCodes: [],
      warningCodes: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const canonicalString = serializeCanonicalReceiptPayload(payload);

    expect(canonicalString).toBe(
      '{"receiptSchemaVersion":"1.0.0","thesisId":"vector-thesis","thesisVersionId":"vector-version","versionNumber":1,"asset":"SOL","statusAtCommit":"ACTIVE","decision":"LONG","directionalScore":60,"thesisStrength":60,"coverage":1,"coverageLabel":"COMPLETE","conflict":0,"conflictLabel":"LOW","risk":"ACCEPTABLE","safety":"CLEAR","regimeFit":"FIT","strategyId":"dm-1","strategyVersion":"1.0.0","normalizerVersion":"normalizer-1","evidenceSnapshotId":"snapshot-1","supportingEvidence":[],"contradictingEvidence":[],"neutralEvidence":[],"availableEvidence":[],"unknownEvidence":[],"candidateRanking":[],"killSwitch":null,"invalidationRules":[],"reasonCodes":[],"warningCodes":[],"createdAt":"2026-01-01T00:00:00.000Z"}',
    );
    expect(hashCanonicalReceipt(canonicalString)).toBe(
      "e90bef7681293af22c27196f163d2f5376dfe0cf7f8b51ef5e7f2e7cf1e8e68f",
    );
  });
});
