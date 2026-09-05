import { describe, expect, it } from "vitest";
import { DM1_CONFIG } from "../../lib/strategy/dm1/config";
import {
  evaluateCandidate,
  evaluateDM1,
} from "../../lib/strategy/dm1/decision";
import { selectAutonomousCandidate } from "../../lib/strategy/dm1/selection";
import {
  calculateConflict,
  calculateCoverage,
  calculateDirectionalScore,
  getConflictLabel,
  getCoverageLabel,
  getDirectionalStateValue,
} from "../../lib/strategy/dm1/score";
import type { DM1Config } from "../../lib/strategy/dm1/types";
import {
  coherentBearish,
  coherentBullish,
  degradedRisk,
  exactLongThreshold,
  exactShortThreshold,
  highConflict,
  insufficientCoverage,
  justAboveShortThreshold,
  justBelowLongThreshold,
  makeCandidateEvaluation,
  makeDM1Fixture,
  missingSafety,
  moderateQualifiedConflict,
  partialOptionalEvidence,
  regimeBroken,
  regimeDegraded,
  relativeClearRunnerUp,
  relativeClearWinner,
  relativeNearTieRunnerUp,
  relativeNearTieTop,
  safetyVeto,
  unknownRisk,
  unknownVsNeutralNeutral,
  unknownVsNeutralUnknown,
  weakDirection,
} from "../fixtures/dm1";

describe("DM-1 directional values and metrics", () => {
  it("maps directional states deterministically and keeps UNKNOWN unavailable", () => {
    expect(getDirectionalStateValue("STRONGLY_SUPPORTIVE")).toBe(1);
    expect(getDirectionalStateValue("SUPPORTIVE")).toBe(0.5);
    expect(getDirectionalStateValue("NEUTRAL")).toBe(0);
    expect(getDirectionalStateValue("OPPOSING")).toBe(-0.5);
    expect(getDirectionalStateValue("STRONGLY_OPPOSING")).toBe(-1);
    expect(getDirectionalStateValue("UNKNOWN")).toBeNull();
    expect(getDirectionalStateValue(undefined)).toBeNull();
  });

  it("calculates the configured weighted directional score", () => {
    const evidence = makeDM1Fixture({
      evidence: {
        DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
        TECHNICAL_CONFLUENCE: "SUPPORTIVE",
        RELATIVE_OPPORTUNITY: "STRONGLY_SUPPORTIVE",
        MARKET_ALIGNMENT: "SUPPORTIVE",
        SENTIMENT_DERIVATIVES: "NEUTRAL",
      },
    });

    expect(calculateDirectionalScore(evidence)).toBe(67.5);
    expect(calculateCoverage(evidence)).toBe(1);
  });

  it("labels complete, partial, and degraded coverage from policy thresholds", () => {
    expect(getCoverageLabel(1)).toBe("COMPLETE");
    expect(getCoverageLabel(0.85)).toBe("PARTIAL");
    expect(getCoverageLabel(0.79)).toBe("DEGRADED");
  });

  it("calculates conflict relative to LONG and SHORT", () => {
    const evidence = makeDM1Fixture({
      evidence: {
        DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
        TECHNICAL_CONFLUENCE: "STRONGLY_OPPOSING",
        RELATIVE_OPPORTUNITY: "NEUTRAL",
        MARKET_ALIGNMENT: "NEUTRAL",
        SENTIMENT_DERIVATIVES: "NEUTRAL",
      },
    });

    expect(calculateConflict(evidence, "LONG")).toBe(20 / 50);
    expect(calculateConflict(evidence, "SHORT")).toBe(30 / 50);
    expect(calculateConflict(evidence, null)).toBeNull();
  });

  it("calculates and labels generic HIGH conflict without making it a DM-1 gate", () => {
    const conflict = calculateConflict(highConflict, "LONG");

    expect(conflict).toBeGreaterThan(0.3);
    expect(getConflictLabel(conflict)).toBe("HIGH");
  });

  it("uses inclusive conflict boundaries", () => {
    expect(getConflictLabel(0.15)).toBe("LOW");
    expect(getConflictLabel(0.3)).toBe("MODERATE");
    expect(getConflictLabel(0.3000001)).toBe("HIGH");
    expect(getConflictLabel(null)).toBeNull();
  });
});

describe("DM-1 decision engine", () => {
  it("returns LONG for coherent bullish evidence", () => {
    const result = evaluateDM1(coherentBullish);

    expect(result.decision).toBe("LONG");
    expect(result.directionalScore).toBe(100);
    expect(result.coverage).toBe(1);
    expect(result.coverageLabel).toBe("COMPLETE");
    expect(result.conflict).toBe(0);
    expect(result.conflictLabel).toBe("LOW");
    expect(result.thesisStrength).toBe(100);
    expect(result.strategyId).toBe("dm-1");
    expect(result.strategyVersion).toBe("1.0.0");
  });

  it("returns SHORT for coherent bearish evidence", () => {
    const result = evaluateDM1(coherentBearish);

    expect(result.decision).toBe("SHORT");
    expect(result.directionalScore).toBe(-100);
    expect(result.thesisStrength).toBe(100);
  });

  it("abstains for weak direction", () => {
    const result = evaluateDM1(weakDirection);

    expect(result.decision).toBe("ABSTAIN");
    expect(result.thesisStrength).toBeNull();
    expect(result.reasonCodes).toContain("INSUFFICIENT_DIRECTIONAL_EVIDENCE");
    expect(result.conflict).toBeNull();
  });

  it("returns structured hard-gate results", () => {
    const result = evaluateDM1(missingSafety);
    const safetyGate = result.hardGateResults.find(
      (gate) => gate.gate === "SAFETY",
    );

    expect(safetyGate).toEqual({
      gate: "SAFETY",
      passed: false,
      reasonCode: "SAFETY_EVIDENCE_UNAVAILABLE",
    });
  });

  it("abstains for safety UNKNOWN", () => {
    const result = evaluateDM1(missingSafety);

    expect(result.decision).toBe("ABSTAIN");
    expect(result.reasonCodes).toContain("SAFETY_EVIDENCE_UNAVAILABLE");
  });

  it("abstains for a safety VETO", () => {
    const result = evaluateDM1(safetyVeto);

    expect(result.decision).toBe("ABSTAIN");
    expect(result.reasonCodes).toContain("SAFETY_VETO");
  });

  it("abstains for extreme volatility", () => {
    const result = evaluateDM1(
      makeDM1Fixture({ risk: "EXTREME" }),
    );

    expect(result.decision).toBe("ABSTAIN");
    expect(result.reasonCodes).toContain("EXTREME_VOLATILITY");
  });

  it("abstains when required risk is UNKNOWN", () => {
    const result = evaluateDM1(unknownRisk);

    expect(result.decision).toBe("ABSTAIN");
    expect(result.reasonCodes).toContain("REQUIRED_RISK_UNKNOWN");
  });

  it("allows optional evidence to be UNKNOWN when coverage remains sufficient", () => {
    const result = evaluateDM1(partialOptionalEvidence);

    expect(result.decision).toBe("LONG");
    expect(result.coverage).toBe(0.85);
    expect(result.coverageLabel).toBe("PARTIAL");
    expect(result.thesisStrength).toBe(72.25);
  });

  it("abstains when coverage is below 80 percent", () => {
    const result = evaluateDM1(insufficientCoverage);

    expect(result.decision).toBe("ABSTAIN");
    expect(result.coverage).toBe(0.65);
    expect(result.reasonCodes).toContain("INSUFFICIENT_COVERAGE");
  });

  it("abstains when a required directional dimension is UNKNOWN", () => {
    const result = evaluateDM1(
      makeDM1Fixture({
        evidence: { RELATIVE_OPPORTUNITY: "UNKNOWN" },
      }),
    );

    expect(result.coverage).toBe(0.8);
    expect(result.decision).toBe("ABSTAIN");
    expect(result.reasonCodes).toContain("REQUIRED_EVIDENCE_UNAVAILABLE");
  });

  it("abstains for a broken regime", () => {
    const result = evaluateDM1(regimeBroken);

    expect(result.decision).toBe("ABSTAIN");
    expect(result.reasonCodes).toContain("REGIME_MISMATCH");
  });

  it("abstains when regime fit is UNKNOWN", () => {
    const result = evaluateDM1(
      makeDM1Fixture({ regimeFit: "UNKNOWN" }),
    );

    expect(result.decision).toBe("ABSTAIN");
    expect(result.reasonCodes).toContain("REGIME_UNKNOWN");
  });

  it("allows a degraded regime with an explicit warning", () => {
    const result = evaluateDM1(regimeDegraded);

    expect(result.decision).toBe("LONG");
    expect(result.warningCodes).toContain("DEGRADED_REGIME_FIT");
  });

  it("exposes an elevated-risk warning without making it a veto", () => {
    const result = evaluateDM1(degradedRisk);

    expect(result.decision).toBe("LONG");
    expect(result.warningCodes).toContain("ELEVATED_RISK");
  });

  it("keeps UNKNOWN distinct from NEUTRAL", () => {
    const unknownResult = evaluateDM1(unknownVsNeutralUnknown);
    const neutralResult = evaluateDM1(unknownVsNeutralNeutral);

    expect(unknownResult.directionalScore).toBe(neutralResult.directionalScore);
    expect(unknownResult.coverage).toBe(0.85);
    expect(neutralResult.coverage).toBe(1);
    expect(unknownResult.thesisStrength).toBe(72.25);
    expect(neutralResult.thesisStrength).toBe(85);
  });

  it("accepts the exact positive threshold", () => {
    const result = evaluateDM1(exactLongThreshold);

    expect(result.directionalScore).toBe(60);
    expect(result.decision).toBe("LONG");
  });

  it("accepts the exact negative threshold", () => {
    const result = evaluateDM1(exactShortThreshold);

    expect(result.directionalScore).toBe(-60);
    expect(result.decision).toBe("SHORT");
  });

  it("abstains just below the positive threshold", () => {
    const result = evaluateDM1(justBelowLongThreshold);

    expect(result.directionalScore).toBe(57.5);
    expect(result.decision).toBe("ABSTAIN");
  });

  it("abstains just above the negative threshold", () => {
    const result = evaluateDM1(justAboveShortThreshold);

    expect(result.directionalScore).toBe(-57.5);
    expect(result.decision).toBe("ABSTAIN");
  });

  it("surfaces MODERATE conflict on a qualifying DM-1 thesis without vetoing it", () => {
    const result = evaluateDM1(moderateQualifiedConflict);

    expect(result.directionalScore).toBe(60);
    expect(result.conflict).toBeCloseTo(0.2);
    expect(result.conflictLabel).toBe("MODERATE");
    expect(result.decision).toBe("LONG");
    expect(result.warningCodes).toContain("MODERATE_EVIDENCE_CONFLICT");
    expect(result.hardGateResults.every((gate) => gate.passed)).toBe(true);
  });

  it("keeps the exact 30 percent boundary out of HIGH conflict", () => {
    expect(getConflictLabel(0.3)).toBe("MODERATE");
    expect(getConflictLabel(0.3000001)).toBe("HIGH");
  });

  it("does not use HIGH conflict as an independent DM-1 veto", () => {
    const loweredThresholdConfig: DM1Config = {
      ...DM1_CONFIG,
      directionThreshold: 5,
    };
    const result = evaluateDM1(highConflict, loweredThresholdConfig);

    expect(result.conflictLabel).toBe("HIGH");
    expect(result.decision).toBe("LONG");
    expect(result.reasonCodes).not.toContain("HIGH_EVIDENCE_CONFLICT");
  });

  it("derives thresholds and weights from the supplied config", () => {
    const stricterConfig: DM1Config = {
      ...DM1_CONFIG,
      directionThreshold: 65,
    };
    const result = evaluateDM1(exactLongThreshold, stricterConfig);

    expect(result.directionalScore).toBe(60);
    expect(result.decision).toBe("ABSTAIN");
    expect(JSON.stringify(DM1_CONFIG)).toContain('"directionThreshold":60');
  });

  it("returns a fully serializable result", () => {
    const result = evaluateDM1(coherentBullish);

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("replays the same evidence and policy deterministically", () => {
    const first = evaluateDM1(partialOptionalEvidence, DM1_CONFIG);
    const second = evaluateDM1(partialOptionalEvidence, DM1_CONFIG);

    expect(second).toEqual(first);
  });
});

describe("DM-1 autonomous candidate selection", () => {
  it("selects a clear winner by Thesis Strength", () => {
    const winner = evaluateCandidate({
      asset: "WINNER",
      evidence: relativeClearWinner,
    });
    const runnerUp = evaluateCandidate({
      asset: "RUNNER-UP",
      evidence: relativeClearRunnerUp,
    });
    const result = selectAutonomousCandidate([runnerUp, winner]);

    expect(result.decision).toBe("LONG");
    expect(result.selected?.asset).toBe("WINNER");
    expect(result.candidates.find((candidate) => candidate.asset === "WINNER")?.selected).toBe(true);
    expect(result.rankedCandidates[0]?.asset).toBe("WINNER");
  });

  it("selects a winner when the relative edge is exactly five points", () => {
    const top = makeCandidateEvaluation({
      asset: "FIVE-POINT-WINNER",
      thesisStrength: 75,
    });
    const runnerUp = makeCandidateEvaluation({
      asset: "FIVE-POINT-RUNNER",
      thesisStrength: 70,
    });
    const result = selectAutonomousCandidate([runnerUp, top]);

    expect(result.selected?.asset).toBe("FIVE-POINT-WINNER");
  });

  it("returns ABSTAIN when the top two are within the relative edge", () => {
    const top = evaluateCandidate({
      asset: "TOP",
      evidence: relativeNearTieTop,
    });
    const runnerUp = evaluateCandidate({
      asset: "NEAR-TIE",
      evidence: relativeNearTieRunnerUp,
    });
    const result = selectAutonomousCandidate([top, runnerUp]);

    expect(result.decision).toBe("ABSTAIN");
    expect(result.selected).toBeNull();
    expect(result.reasonCodes).toContain("NO_CLEAR_RELATIVE_WINNER");
  });

  it("returns ABSTAIN for an edge below five points", () => {
    const top = makeCandidateEvaluation({
      asset: "TOP-4-999",
      thesisStrength: 75,
    });
    const runnerUp = makeCandidateEvaluation({
      asset: "RUNNER-4-999",
      thesisStrength: 70.001,
    });
    const result = selectAutonomousCandidate([top, runnerUp]);

    expect(result.decision).toBe("ABSTAIN");
    expect(result.reasonCodes).toContain("NO_CLEAR_RELATIVE_WINNER");
  });

  it("always abstains for equal Thesis Strength with multiple candidates", () => {
    const first = makeCandidateEvaluation({ asset: "EQUAL-FIRST" });
    const second = makeCandidateEvaluation({ asset: "EQUAL-SECOND" });
    const result = selectAutonomousCandidate([first, second]);

    expect(result.decision).toBe("ABSTAIN");
    expect(result.selected).toBeNull();
    expect(result.reasonCodes).toContain("NO_CLEAR_RELATIVE_WINNER");
  });

  it("ranks tied candidates canonically regardless of input order", () => {
    const sol = makeCandidateEvaluation({ asset: "SOL" });
    const eth = makeCandidateEvaluation({ asset: "ETH" });
    const firstOrder = selectAutonomousCandidate([sol, eth]);
    const secondOrder = selectAutonomousCandidate([eth, sol]);

    expect(firstOrder.rankedCandidates.map((candidate) => candidate.asset)).toEqual([
      "ETH",
      "SOL",
    ]);
    expect(secondOrder.rankedCandidates.map((candidate) => candidate.asset)).toEqual([
      "ETH",
      "SOL",
    ]);
    expect(firstOrder.decision).toBe("ABSTAIN");
    expect(secondOrder.decision).toBe("ABSTAIN");
    expect(firstOrder.reasonCodes).toEqual(secondOrder.reasonCodes);
    expect(firstOrder.rankedCandidates).toEqual(secondOrder.rankedCandidates);
  });

  it("selects the strongest direction without preferring LONG", () => {
    const longCandidate = evaluateCandidate({
      asset: "LONG-CANDIDATE",
      evidence: exactLongThreshold,
    });
    const shortCandidate = evaluateCandidate({
      asset: "SHORT-CANDIDATE",
      evidence: coherentBearish,
    });
    const result = selectAutonomousCandidate([longCandidate, shortCandidate]);

    expect(result.decision).toBe("SHORT");
    expect(result.selected?.asset).toBe("SHORT-CANDIDATE");
  });

  it("uses lower conflict as the first tie-break", () => {
    const higherConflict = makeCandidateEvaluation({
      asset: "HIGHER-CONFLICT",
      conflict: 0.2,
      conflictLabel: "MODERATE",
    });
    const lowerConflict = makeCandidateEvaluation({
      asset: "LOWER-CONFLICT",
      conflict: 0.1,
    });
    const result = selectAutonomousCandidate([higherConflict, lowerConflict]);

    expect(result.rankedCandidates[0]?.asset).toBe("LOWER-CONFLICT");
    expect(result.selected).toBeNull();
    expect(result.reasonCodes).toContain("NO_CLEAR_RELATIVE_WINNER");
  });

  it("uses higher coverage as the second tie-break", () => {
    const lowerCoverage = makeCandidateEvaluation({
      asset: "LOWER-COVERAGE",
      coverage: 0.8,
      coverageLabel: "PARTIAL",
    });
    const higherCoverage = makeCandidateEvaluation({
      asset: "HIGHER-COVERAGE",
      coverage: 0.9,
      coverageLabel: "PARTIAL",
    });
    const result = selectAutonomousCandidate([lowerCoverage, higherCoverage]);

    expect(result.rankedCandidates[0]?.asset).toBe("HIGHER-COVERAGE");
    expect(result.selected).toBeNull();
    expect(result.reasonCodes).toContain("NO_CLEAR_RELATIVE_WINNER");
  });

  it("returns ABSTAIN when no candidate is eligible", () => {
    const abstained = evaluateCandidate({
      asset: "UNSAFE",
      evidence: safetyVeto,
    });
    const result = selectAutonomousCandidate([abstained]);

    expect(result.decision).toBe("ABSTAIN");
    expect(result.selected).toBeNull();
  });
});
