import { describe, expect, it } from "vitest";
import { marketingMemorySnapshot, marketingResearchCase, marketingSnapshot } from "../components/krineo/marketing/fixtures";
import { getDemoScenarios } from "../lib/demo/scenarios";
import { PRACTICE_POLICY } from "../lib/practice/types";

describe("marketing simulation snapshot", () => {
  it("keeps the compact memory preview consistent with the separate changed fixture", () => {
    const fixture = getDemoScenarios().find(scenario => scenario.id === "changed")!;
    expect(marketingMemorySnapshot.before).toBe(fixture.originalDecision.decision);
    expect(marketingMemorySnapshot.after).toBe(fixture.currentDecision.decision);
    expect(marketingMemorySnapshot.before).not.toBe(marketingMemorySnapshot.after);
    expect(marketingMemorySnapshot.scenario).toBe(fixture.id);
  });
  it("keeps the mixed-evidence story consistent with the abstain fixture", () => {
    const fixture = getDemoScenarios()[1];
    expect(marketingResearchCase.decision).toBe(fixture.currentDecision.decision);
    expect(marketingResearchCase.preflight).toBe(fixture.currentGovernance.preflight.status);
    expect(marketingResearchCase.momentum).toBe(fixture.currentEvidenceSnapshot.evidence.DIRECTIONAL_MOMENTUM);
    expect(marketingResearchCase.sentiment).toBe(fixture.currentEvidenceSnapshot.evidence.SENTIMENT_DERIVATIVES);
  });
  it("keeps the illustrated portfolio arithmetic consistent", () => {
    const data = marketingSnapshot;
    expect(data.startingCapital).toBe(PRACTICE_POLICY.startingBalanceUsd);
    expect(data.notional).toBe(PRACTICE_POLICY.defaultPositionNotionalUsd);
    expect(data.quantity * data.entryPrice).toBeCloseTo(data.notional, 8);
    expect(data.positionValue).toBeCloseTo(data.quantity * data.markPrice, 8);
    expect(data.positionPnl).toBeCloseTo(data.positionValue - data.notional, 8);
    expect(data.equity).toBeCloseTo(data.unallocatedCapital + data.positionValue, 8);
    expect(data.positionReturn).toBeCloseTo(3.57142857, 6);
    expect(data.portfolioReturn).toBeCloseTo(0.357142857, 6);
  });

  it("depicts the guardrails from the same directional demo fixture", () => {
    const fixture = getDemoScenarios()[0];
    expect(marketingSnapshot.decision).toBe(fixture.currentDecision.decision);
    expect(marketingSnapshot.preflight).toBe(fixture.currentGovernance.preflight.status);
    expect(marketingSnapshot.killSwitch).toBe(fixture.currentKillSwitch.verdict);
    expect(marketingSnapshot.fixtureDate).toBe("2026-09-05");
  });

  it("has valid deterministic candles ending at the displayed mark", () => {
    const { candles, markPrice } = marketingSnapshot;
    expect(candles.length).toBeGreaterThanOrEqual(24);
    for (const candle of candles) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close));
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close));
      expect(candle.low).toBeGreaterThan(0);
      expect(candle.volume).toBeGreaterThan(0);
    }
    expect(candles.at(-1)?.close).toBe(markPrice);
    expect(candles.some((candle) => candle.close < candle.open)).toBe(true);
    expect(candles.some((candle) => candle.close > candle.open)).toBe(true);
    expect(marketingSnapshot.equityHistory.at(-1)).toBe(marketingSnapshot.equity);
  });
});
