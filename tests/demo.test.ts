import { describe, expect, it } from "vitest";
import { getDemoScenarios } from "../lib/demo/scenarios";

describe("demo scenario composition", () => {
  it("exposes the three intended product lifecycle states", () => {
    const scenarios = getDemoScenarios();

    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      "directional",
      "abstain",
      "changed",
    ]);
    expect(scenarios[0].currentDecision.decision).toBe("LONG");
    expect(scenarios[1].currentDecision.decision).toBe("ABSTAIN");
    expect(scenarios[2].currentDecision.decision).toBe("SHORT");
  });

  it("keeps the directional fixture open when invalidation maintains the thesis", () => {
    const scenario = getDemoScenarios()[0];

    expect(scenario.currentKillSwitch.verdict).toBe("CLEAR");
    expect(scenario.strategyDiff?.hasMeaningfulChange).toBe(true);
    expect(scenario.invalidation?.outcome).toBe("MAINTAIN");
    expect(scenario.practice.action?.action).toBe("KEEP_OPEN");
    expect(scenario.practice.position?.status).toBe("OPEN");
  });

  it("preserves an intentional abstain without creating a practice position", () => {
    const scenario = getDemoScenarios()[1];

    expect(scenario.receipt.killSwitch).toBeNull();
    expect(scenario.strategyDiff).toBeNull();
    expect(scenario.invalidation).toBeNull();
    expect(scenario.practice.position).toBeNull();
    expect(scenario.practice.action).toBeNull();
  });

  it("closes the simulated position when a directional reversal triggers invalidation", () => {
    const scenario = getDemoScenarios()[2];

    expect(scenario.strategyDiff?.decision).toEqual({
      before: "LONG",
      after: "SHORT",
      changed: true,
    });
    expect(scenario.invalidation?.outcome).toBe("INVALIDATE");
    expect(scenario.invalidation?.triggeredRules.map((rule) => rule.ruleType)).toContain(
      "DIRECTION_REVERSAL",
    );
    expect(scenario.practice.action?.recommendedCloseReason).toBe("THESIS_INVALIDATED");
    expect(scenario.practice.position?.status).toBe("CLOSED");
    expect(scenario.practice.position?.realizedPnlUsd).toBeCloseTo(-100, 8);
  });

  it("is deterministic across repeated server fixture construction", () => {
    const first = getDemoScenarios();
    const second = getDemoScenarios();

    expect(first.map((scenario) => scenario.receipt.canonicalHash)).toEqual(
      second.map((scenario) => scenario.receipt.canonicalHash),
    );
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
