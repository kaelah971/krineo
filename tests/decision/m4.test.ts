import { describe, expect, it } from "vitest";
import {
  CASE_SIMILARITY_ALGORITHM_VERSION,
  createMemorySnapshot,
  toCaseSignature,
} from "../../lib/memory";
import {
  DECISION_INTEGRATION_REJECTION_CODES,
  REASON_CODE_EFFECTS,
  buildEvaluationContext,
  classifyReasonCode,
  evaluatePreflight,
} from "../../lib/decision";
import type { PlaybookRule, PlaybookVersion } from "../../lib/playbook";
import { evaluateDM1 } from "../../lib/strategy/dm1/decision";
import { REASON_CODES } from "../../lib/strategy/dm1/reason-codes";
import type { DM1EvidenceSnapshot } from "../../lib/strategy/dm1/types";
import { makeDM1Fixture, coherentBullish, degradedRisk, safetyVeto } from "../fixtures/dm1";

function version(
  strategyId: string,
  strategyVersion: string,
  rules: readonly PlaybookRule[] = [],
): PlaybookVersion {
  return {
    id: "playbook-version-1",
    playbookId: "playbook-1",
    versionNumber: 1,
    strategyId,
    strategyVersion,
    rules,
    createdAt: "2026-09-26T00:00:00.000Z",
    approvedAt: "2026-09-26T00:01:00.000Z",
    approvedBy: "HUMAN",
  };
}

function evaluate(evidence: DM1EvidenceSnapshot = coherentBullish, rules: readonly PlaybookRule[] = []) {
  const marketResult = evaluateDM1(evidence);
  return evaluatePreflight({
    marketResult,
    evidence,
    playbookVersion: version(marketResult.strategyId, marketResult.strategyVersion, rules),
  });
}

function expectSuccess(value: ReturnType<typeof evaluatePreflight>) {
  expect(value.ok).toBe(true);
  if (value.ok !== true) throw new Error(value.message);
  return value;
}

describe("M4 decision integration", () => {
  it("classifies each current reason exactly once", () => {
    const codes = Object.values(REASON_CODES);
    expect(Object.keys(REASON_CODE_EFFECTS).sort()).toEqual([...codes].sort());
    expect(codes.every((code) => classifyReasonCode(code) === REASON_CODE_EFFECTS[code])).toBe(true);
    expect(classifyReasonCode(REASON_CODES.EXTREME_VOLATILITY)).toBe("BLOCK");
    expect(classifyReasonCode(REASON_CODES.REGIME_MISMATCH)).toBe("BLOCK");
    expect(classifyReasonCode(REASON_CODES.SAFETY_VETO)).toBe("BLOCK");
  });

  it("keeps warnings from restricting an otherwise directional market result", () => {
    const result = expectSuccess(evaluate(degradedRisk));
    expect(result.marketDecision).toBe("LONG");
    expect(result.marketEffect).toBe("PASS");
    expect(result.status).toBe("FIT");
  });

  it("combines playbook precedence and never promotes ABSTAIN", () => {
    const caution = expectSuccess(
      evaluate(coherentBullish, [
        { id: "caution", effect: "CAUTION", conditions: [{ field: "decision", operator: "EQUALS", value: "LONG" }] },
      ]),
    );
    expect(caution.effect).toBe("CAUTION");
    expect(caution.effectiveDecision).toBe("LONG");

    const abstainMarket = expectSuccess(evaluate(makeDM1Fixture({ evidence: {
      DIRECTIONAL_MOMENTUM: "UNKNOWN",
      TECHNICAL_CONFLUENCE: "UNKNOWN",
      RELATIVE_OPPORTUNITY: "UNKNOWN",
      MARKET_ALIGNMENT: "UNKNOWN",
      SENTIMENT_DERIVATIVES: "UNKNOWN",
    } })));
    expect(abstainMarket.marketDecision).toBe("ABSTAIN");
    expect(abstainMarket.playbookEffect).toBe("PASS");
    expect(abstainMarket.effectiveDecision).toBe("ABSTAIN");

    const suppressed = expectSuccess(
      evaluate(coherentBullish, [
        { id: "wait", effect: "WAIT", conditions: [{ field: "decision", operator: "EQUALS", value: "LONG" }] },
      ]),
    );
    expect(suppressed.effectiveDecision).toBe("ABSTAIN");
    expect(suppressed.winningSource).toBe("PLAYBOOK");
  });

  it("summarizes memory, preserves unknown evidence, and reports availability", () => {
    const evidence = makeDM1Fixture({ evidence: { SENTIMENT_DERIVATIVES: "UNKNOWN" } });
    const marketResult = evaluateDM1(evidence);
    const summarySnapshot = createMemorySnapshot({
      snapshotId: "memory-1",
      targetSignature: toCaseSignature(evidence),
      rankedCases: [],
      createdAt: "2026-09-26T00:00:00.000Z",
    });
    const result = expectSuccess(
      evaluatePreflight({
        marketResult,
        evidence,
        playbookVersion: version(marketResult.strategyId, marketResult.strategyVersion),
        memorySnapshot: summarySnapshot,
      }),
    );
    expect(result.memorySummary?.rankedCaseCount).toBe(0);
    expect(result.diagnostics.some((entry) => entry.code === "MEMORY_AVAILABLE")).toBe(true);

    const context = buildEvaluationContext({ marketResult, evidence, memorySummary: null });
    expect(context.evidence.SENTIMENT_DERIVATIVES).toBe("UNKNOWN");
    expect(context.conflict).toBe(marketResult.conflict);
    expect("memory" in context).toBe(false);
  });

  it("rejects mismatches and invalid memory targets without faking success", () => {
    const evidence = coherentBullish;
    const marketResult = evaluateDM1(evidence);
    const badMarket = { ...marketResult, coverage: marketResult.coverage - 0.1 };
    const mismatch = evaluatePreflight({
      marketResult: badMarket,
      evidence,
      playbookVersion: version(marketResult.strategyId, marketResult.strategyVersion),
    });
    expect(mismatch).toMatchObject({ ok: false, code: DECISION_INTEGRATION_REJECTION_CODES.EVIDENCE_RESULT_MISMATCH });

    const badSnapshot = createMemorySnapshot({
      snapshotId: "memory-2",
      targetSignature: toCaseSignature(safetyVeto),
      rankedCases: [],
      createdAt: "2026-09-26T00:00:00.000Z",
    });
    const invalidMemory = evaluatePreflight({
      marketResult,
      evidence,
      playbookVersion: version(marketResult.strategyId, marketResult.strategyVersion),
      memorySnapshot: badSnapshot,
    });
    expect(invalidMemory).toMatchObject({ ok: false, code: DECISION_INTEGRATION_REJECTION_CODES.INVALID_MEMORY_TARGET_SIGNATURE });
  });

  it("is immutable and invariant to supplied reason and rule order", () => {
    const marketResult = evaluateDM1(coherentBullish);
    const versionValue = version(marketResult.strategyId, marketResult.strategyVersion, [
      { id: "b", effect: "PASS", conditions: [{ field: "decision", operator: "EQUALS", value: "LONG" }] },
      { id: "a", effect: "PASS", conditions: [{ field: "decision", operator: "EQUALS", value: "LONG" }] },
    ]);
    const input = { marketResult, evidence: coherentBullish, playbookVersion: versionValue };
    const before = JSON.stringify(input);
    const result = expectSuccess(evaluatePreflight(input));
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.marketResult)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);

    const reordered = evaluatePreflight({
      marketResult: {
        ...marketResult,
        reasonCodes: [...marketResult.reasonCodes].reverse(),
        warningCodes: [...marketResult.warningCodes].reverse(),
        hardGateResults: [...marketResult.hardGateResults].reverse(),
      },
      evidence: coherentBullish,
      playbookVersion: versionValue,
    });
    expect(reordered).toEqual(result);
  });

  it("retains block and wait market effects", () => {
    const result = expectSuccess(evaluate(safetyVeto));
    expect(result.marketDecision).toBe("ABSTAIN");
    expect(result.marketEffect).toBe("BLOCK");
    expect(result.effectiveDecision).toBe("ABSTAIN");
  });

  it("does not import or call Sibyl", () => {
    expect(() => evaluate(coherentBullish)).not.toThrow();
    expect(CASE_SIMILARITY_ALGORITHM_VERSION).toBe("case-similarity-v1");
  });
});
