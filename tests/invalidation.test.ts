import { describe, expect, it } from "vitest";
import type { DecisionState, EvidenceItem } from "../lib/evidence/types";
import type { DecisionResult } from "../lib/strategy/dm1/types";
import {
  buildStrategyDiff,
  type StrategyDiffSnapshot,
} from "../lib/thesis/diff";
import {
  buildDM1InvalidationRules,
  DM1_INVALIDATION_RULE_IDS,
  evaluateDM1Invalidation,
  INVALIDATION_EVALUATION_EFFECTS,
  INVALIDATION_OUTCOMES,
  INVALIDATION_REJECTION_CODES,
  type InvalidationEvaluationInput,
} from "../lib/thesis/invalidation";
import type {
  InvalidationRule,
  ThesisLifecycleState,
  ThesisVersion,
} from "../lib/thesis/types";
import { INVALIDATION_RULE_TYPES } from "../lib/thesis/types";
import { receiptEvidence } from "./fixtures/receipt";
import { makeCandidateEvaluation } from "./fixtures/dm1";
import { makeExistingThesisHistory, makeDecisionResult } from "./fixtures/thesis";

interface FixtureOverrides {
  readonly direction?: DecisionState;
  readonly latest?: Partial<DecisionResult>;
  readonly beforeEvidenceItems?: readonly EvidenceItem[];
  readonly evidenceItems?: readonly EvidenceItem[];
  readonly currentStatus?: ThesisLifecycleState;
  readonly rules?: readonly InvalidationRule[];
}

function makeInvalidationFixture(
  overrides: FixtureOverrides = {},
): InvalidationEvaluationInput {
  const { thesis, versions } = makeExistingThesisHistory();
  const direction = overrides.direction ?? "LONG";
  const originalVersion: ThesisVersion = {
    ...versions[0],
    decision: direction,
    directionalScore: direction === "LONG" ? 70 : -70,
    thesisStrength: 70,
    statusAtCommit: direction === "LONG" || direction === "SHORT" ? "ACTIVE" : "ABSTAINED",
    reasonCodes: [],
    warningCodes: [],
  };
  const directional = direction === "LONG" || direction === "SHORT";
  const defaultLatest = makeDecisionResult({
    decision: directional ? direction : "ABSTAIN",
    provisionalDirection: directional ? direction : null,
    directionalScore: originalVersion.directionalScore,
    thesisStrength: originalVersion.thesisStrength,
    coverage: originalVersion.coverage,
    conflict: originalVersion.conflict,
    risk: originalVersion.risk,
    safety: originalVersion.safety,
    regimeFit: originalVersion.regimeFit,
  });
  const latestDecision: DecisionResult = {
    ...defaultLatest,
    ...overrides.latest,
  };
  const rules =
    overrides.rules ??
    (direction === "LONG" || direction === "SHORT"
      ? buildDM1InvalidationRules(direction)
      : []);
  const beforeSnapshot: StrategyDiffSnapshot = {
    version: originalVersion,
    normalizerVersion: "normalizer-1.0.0",
    evidenceItems: overrides.beforeEvidenceItems ?? receiptEvidence,
    candidateEvaluations: [
      makeCandidateEvaluation({ asset: "SOL", selected: true }),
      makeCandidateEvaluation({ asset: "ETH", selected: false, thesisStrength: 65 }),
    ],
    invalidationRules: rules,
  };
  const afterVersion: ThesisVersion = {
    ...originalVersion,
    id: "version-2",
    versionNumber: 2,
    evidenceSnapshotId: "evidence-snapshot-2",
    createdAt: "2026-09-05T13:00:00.000Z",
    decision: latestDecision.decision,
    directionalScore: latestDecision.directionalScore,
    thesisStrength: latestDecision.thesisStrength,
    coverage: latestDecision.coverage,
    coverageLabel: latestDecision.coverageLabel,
    conflict: latestDecision.conflict,
    conflictLabel: latestDecision.conflictLabel,
    risk: latestDecision.risk,
    safety: latestDecision.safety,
    regimeFit: latestDecision.regimeFit,
    reasonCodes: [...latestDecision.reasonCodes],
    warningCodes: [...latestDecision.warningCodes],
  };
  const afterSnapshot: StrategyDiffSnapshot = {
    ...beforeSnapshot,
    version: afterVersion,
    evidenceItems: overrides.evidenceItems ?? receiptEvidence,
  };
  const diffResult = buildStrategyDiff({
    before: beforeSnapshot,
    after: afterSnapshot,
  });
  if (!diffResult.ok) {
    throw new Error(`${diffResult.code}: ${diffResult.message}`);
  }

  return {
    originalVersion,
    invalidationRules: rules,
    strategyDiff: diffResult.diff,
    latestDecision,
    currentThesis: {
      id: thesis.id,
      asset: thesis.asset,
      status: overrides.currentStatus ?? "ACTIVE",
    },
  };
}

function expectEvaluation(input: InvalidationEvaluationInput) {
  const result = evaluateDM1Invalidation(input);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }
  return result.evaluation;
}

function ruleEvaluation(
  input: InvalidationEvaluationInput,
  ruleType: (typeof INVALIDATION_RULE_TYPES)[keyof typeof INVALIDATION_RULE_TYPES],
) {
  return expectEvaluation(input).evaluatedRules.find(
    (rule) => rule.ruleType === ruleType,
  );
}

describe("DM-1 invalidation", () => {
  it("builds all six precommitted rules from DM1_CONFIG in canonical order", () => {
    const rules = buildDM1InvalidationRules("LONG");

    expect(rules.map((rule) => rule.ruleType)).toEqual([
      "DIRECTION_LOSS",
      "DIRECTION_REVERSAL",
      "REGIME_BREAK",
      "SAFETY_VETO",
      "CRITICAL_EVIDENCE_LOSS",
      "RISK_LIMIT_BREACH",
    ]);
    expect(rules.every((rule) => rule.strategyId === "dm-1")).toBe(true);
    expect(rules.every((rule) => rule.strategyVersion === "1.0.0")).toBe(true);
    expect(rules.every((rule) => rule.direction === "LONG")).toBe(true);
    expect(rules.find((rule) => rule.ruleType === "DIRECTION_LOSS")?.condition).toEqual({
      field: "directionalScore",
      operator: "WITHIN_DIRECTION_THRESHOLD",
      value: 60,
      parameters: { direction: "LONG" },
    });
    expect(
      rules.find((rule) => rule.ruleType === "CRITICAL_EVIDENCE_LOSS")?.condition,
    ).toEqual({
      field: "criticalEvidence",
      operator: "ANY_DM1_REQUIRED_UNAVAILABLE",
      value: 0.8,
      parameters: {
        requiredDimensions: [
          "DIRECTIONAL_MOMENTUM",
          "RELATIVE_OPPORTUNITY",
          "MARKET_ALIGNMENT",
        ],
        requiredEvidence: ["risk", "safety", "regimeFit"],
      },
    });
  });

  it.each([
    ["LONG", 70],
    ["SHORT", -70],
  ] as const)("maintains an unchanged %s thesis above its direction threshold", (direction, score) => {
    const evaluation = expectEvaluation(
      makeInvalidationFixture({
        direction,
        latest: {
          decision: direction,
          provisionalDirection: direction,
          directionalScore: score,
          thesisStrength: 70,
        },
      }),
    );

    expect(evaluation.outcome).toBe(INVALIDATION_OUTCOMES.MAINTAIN);
    expect(evaluation.triggeredRules).toHaveLength(0);
    expect(evaluation.highestEffect).toBe(INVALIDATION_EVALUATION_EFFECTS.NONE);
  });

  it.each([
    ["LONG", 51],
    ["SHORT", -50],
  ] as const)("fires DIRECTION_LOSS for %s without reversal", (direction, score) => {
    const input = makeInvalidationFixture({
      direction,
      latest: {
        decision: "ABSTAIN",
        provisionalDirection: null,
        directionalScore: score,
        thesisStrength: null,
      },
    });
    const evaluation = expectEvaluation(input);

    expect(evaluation.outcome).toBe(INVALIDATION_OUTCOMES.WEAKEN);
    expect(ruleEvaluation(input, INVALIDATION_RULE_TYPES.DIRECTION_LOSS)?.triggered).toBe(true);
    expect(ruleEvaluation(input, INVALIDATION_RULE_TYPES.DIRECTION_REVERSAL)?.triggered).toBe(false);
  });

  it.each([
    ["LONG", -60],
    ["SHORT", 60],
  ] as const)("fires DIRECTION_REVERSAL at the opposite threshold for %s", (direction, score) => {
    const input = makeInvalidationFixture({
      direction,
      latest: {
        decision: direction === "LONG" ? "SHORT" : "LONG",
        provisionalDirection: direction === "LONG" ? "SHORT" : "LONG",
        directionalScore: score,
        thesisStrength: 60,
      },
    });
    const evaluation = expectEvaluation(input);

    expect(evaluation.outcome).toBe(INVALIDATION_OUTCOMES.INVALIDATE);
    expect(ruleEvaluation(input, INVALIDATION_RULE_TYPES.DIRECTION_REVERSAL)?.triggered).toBe(true);
    expect(ruleEvaluation(input, INVALIDATION_RULE_TYPES.DIRECTION_LOSS)?.triggered).toBe(false);
  });

  it("evaluates all hard invalidation rules and aggregates INVALIDATE over WEAKEN", () => {
    const input = makeInvalidationFixture({
      latest: {
        decision: "ABSTAIN",
        provisionalDirection: null,
        directionalScore: 45,
        thesisStrength: null,
        safety: "VETO",
      },
    });
    const evaluation = expectEvaluation(input);

    expect(evaluation.outcome).toBe(INVALIDATION_OUTCOMES.INVALIDATE);
    expect(evaluation.triggeredRules.map((rule) => rule.ruleType)).toEqual([
      "DIRECTION_LOSS",
      "SAFETY_VETO",
    ]);
    expect(evaluation.reasonCodes).toEqual(["DIRECTION_LOSS", "SAFETY_VETO"]);
  });

  it.each([
    ["REGIME_BREAK", { regimeFit: "BROKEN" as const }],
    ["SAFETY_VETO", { safety: "VETO" as const }],
    ["RISK_LIMIT_BREACH", { risk: "EXTREME" as const }],
  ] as const)("fires %s for its hard state", (ruleType, latest) => {
    const input = makeInvalidationFixture({ latest });
    const evaluation = expectEvaluation(input);

    expect(evaluation.outcome).toBe(INVALIDATION_OUTCOMES.INVALIDATE);
    expect(ruleEvaluation(input, ruleType)?.triggered).toBe(true);
  });

  it.each([
    ["REGIME_BREAK", { regimeFit: "DEGRADED" as const }],
    ["RISK_LIMIT_BREACH", { risk: "ELEVATED" as const }],
  ] as const)("does not turn %s context into an independent trigger", (ruleType, latest) => {
    const input = makeInvalidationFixture({ latest });
    const evaluation = expectEvaluation(input);

    expect(evaluation.outcome).toBe(INVALIDATION_OUTCOMES.MAINTAIN);
    expect(ruleEvaluation(input, ruleType)?.triggered).toBe(false);
  });

  it.each([
    ["safety", { safety: "UNKNOWN" as const }],
    ["risk", { risk: "UNKNOWN" as const }],
    ["regime", { regimeFit: "UNKNOWN" as const }],
  ] as const)("fires CRITICAL_EVIDENCE_LOSS for unknown %s evidence", (_label, latest) => {
    const input = makeInvalidationFixture({ latest });
    const evaluation = expectEvaluation(input);

    expect(evaluation.outcome).toBe(INVALIDATION_OUTCOMES.INVALIDATE);
    expect(ruleEvaluation(input, INVALIDATION_RULE_TYPES.CRITICAL_EVIDENCE_LOSS)?.triggered).toBe(true);
  });

  it("fires CRITICAL_EVIDENCE_LOSS when coverage falls below the precommitted minimum", () => {
    const input = makeInvalidationFixture({
      latest: {
        decision: "ABSTAIN",
        provisionalDirection: null,
        directionalScore: 55,
        thesisStrength: null,
        coverage: 0.79,
      },
    });

    expect(expectEvaluation(input).outcome).toBe(INVALIDATION_OUTCOMES.INVALIDATE);
    expect(ruleEvaluation(input, INVALIDATION_RULE_TYPES.CRITICAL_EVIDENCE_LOSS)?.triggered).toBe(true);
  });

  it("fires CRITICAL_EVIDENCE_LOSS when a required directional dimension becomes UNKNOWN", () => {
    const evidenceItems = receiptEvidence.map((item) =>
      item.dimension === "MARKET_ALIGNMENT"
        ? { ...item, state: "UNKNOWN" as const }
        : item,
    );
    const input = makeInvalidationFixture({
      evidenceItems,
      latest: {
        decision: "ABSTAIN",
        provisionalDirection: null,
        directionalScore: 55,
        thesisStrength: null,
        coverage: 0.85,
      },
    });
    const evaluation = expectEvaluation(input);

    expect(evaluation.outcome).toBe(INVALIDATION_OUTCOMES.INVALIDATE);
    expect(
      ruleEvaluation(input, INVALIDATION_RULE_TYPES.CRITICAL_EVIDENCE_LOSS)?.evidenceDimensions,
    ).toEqual(["MARKET_ALIGNMENT"]);
  });

  it("does not invalidate for optional sentiment loss, conflict or Thesis Strength alone", () => {
    const beforeEvidenceItems = receiptEvidence.map((item) =>
      item.dimension === "SENTIMENT_DERIVATIVES"
        ? { ...item, state: "SUPPORTIVE" as const }
        : item,
    );
    const input = makeInvalidationFixture({
      beforeEvidenceItems,
      latest: {
        decision: "LONG",
        provisionalDirection: "LONG",
        directionalScore: 70,
        thesisStrength: 59,
        coverage: 1,
        conflict: 0.29,
      },
    });
    const evaluation = expectEvaluation(input);

    expect(evaluation.outcome).toBe(INVALIDATION_OUTCOMES.MAINTAIN);
    expect(evaluation.triggeredRules).toHaveLength(0);
  });

  it("does not invent a Thesis Strength floor when directional score and gates remain valid", () => {
    const input = makeInvalidationFixture({
      latest: {
        decision: "LONG",
        provisionalDirection: "LONG",
        directionalScore: 70,
        thesisStrength: 59,
        coverage: 1,
        conflict: 0.1,
      },
    });

    expect(expectEvaluation(input).outcome).toBe(INVALIDATION_OUTCOMES.MAINTAIN);
  });

  it("maintains a valid unchanged market state even when the diff has no meaningful change", () => {
    const input = makeInvalidationFixture();

    expect(input.strategyDiff.hasMeaningfulChange).toBe(false);
    expect(expectEvaluation(input).outcome).toBe(INVALIDATION_OUTCOMES.MAINTAIN);
  });

  it.each([
    ["ABSTAIN", { direction: "LONG" as const, currentStatus: "ABSTAINED" as const }],
    ["INVALIDATED", { currentStatus: "INVALIDATED" as const }],
    ["CLOSED", { currentStatus: "CLOSED" as const }],
  ] as const)("returns NOT_APPLICABLE for %s", (_label, overrides) => {
    const input =
      _label === "ABSTAIN"
        ? makeInvalidationFixture({
            ...overrides,
            direction: "ABSTAIN",
          })
        : makeInvalidationFixture(overrides);
    const result = evaluateDM1Invalidation(input);

    expect(result).toMatchObject({
      ok: false,
      code: INVALIDATION_REJECTION_CODES.NOT_APPLICABLE,
    });
  });

  it("rejects malformed, incomplete and incompatible precommitted rules without generating replacements", () => {
    const validInput = makeInvalidationFixture();
    const malformedRules = validInput.invalidationRules.map((rule) =>
      rule.ruleType === INVALIDATION_RULE_TYPES.DIRECTION_LOSS
        ? { ...rule, effect: "INVALIDATE" as const }
        : rule,
    );
    const incompleteRules = validInput.invalidationRules.filter(
      (rule) => rule.ruleType !== INVALIDATION_RULE_TYPES.RISK_LIMIT_BREACH,
    );
    const incompatibleRules = validInput.invalidationRules.map((rule) =>
      rule.ruleType === INVALIDATION_RULE_TYPES.DIRECTION_LOSS
        ? { ...rule, strategyVersion: "2.0.0" }
        : rule,
    );

    expect(evaluateDM1Invalidation({ ...validInput, invalidationRules: malformedRules })).toMatchObject({
      ok: false,
      code: INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
    });
    expect(evaluateDM1Invalidation({ ...validInput, invalidationRules: incompleteRules })).toMatchObject({
      ok: false,
      code: INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
    });
    expect(evaluateDM1Invalidation({ ...validInput, invalidationRules: incompatibleRules })).toMatchObject({
      ok: false,
      code: INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
    });
  });

  it("canonicalizes rule input order and remains deterministic and immutable", () => {
    const input = makeInvalidationFixture({
      latest: {
        decision: "ABSTAIN",
        provisionalDirection: null,
        directionalScore: 45,
        thesisStrength: null,
      },
    });
    const reversed = {
      ...input,
      invalidationRules: [...input.invalidationRules].reverse(),
    };
    const inputBefore = JSON.stringify(input);
    const first = expectEvaluation(input);
    const second = expectEvaluation(reversed);

    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(inputBefore);
    expect(JSON.stringify(first)).not.toContain("undefined");
    expect(() => JSON.stringify(first)).not.toThrow();
    expect(first.evaluatedRules.map((rule) => rule.ruleType)).toEqual([
      "DIRECTION_LOSS",
      "DIRECTION_REVERSAL",
      "REGIME_BREAK",
      "SAFETY_VETO",
      "CRITICAL_EVIDENCE_LOSS",
      "RISK_LIMIT_BREACH",
    ]);
  });

  it("uses stable rule IDs for the generated precommitment", () => {
    const rules = buildDM1InvalidationRules("SHORT");

    expect(rules.map((rule) => rule.id)).toEqual([
      DM1_INVALIDATION_RULE_IDS.DIRECTION_LOSS,
      DM1_INVALIDATION_RULE_IDS.DIRECTION_REVERSAL,
      DM1_INVALIDATION_RULE_IDS.REGIME_BREAK,
      DM1_INVALIDATION_RULE_IDS.SAFETY_VETO,
      DM1_INVALIDATION_RULE_IDS.CRITICAL_EVIDENCE_LOSS,
      DM1_INVALIDATION_RULE_IDS.RISK_LIMIT_BREACH,
    ]);
  });
});
