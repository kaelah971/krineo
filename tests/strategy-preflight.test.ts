import { describe, expect, it } from "vitest";
import { GET as listSkills } from "../app/api/skills/route";
import { GET as getStrategyPreflight } from "../app/api/skills/strategy_preflight/route";
import { POST as invokeStrategyPreflightRoute } from "../app/api/skills/strategy_preflight/invoke/route";
import { evaluatePreflight } from "../lib/decision";
import { evaluateDM1 } from "../lib/strategy/dm1/decision";
import { createInitialVersion } from "../lib/playbook";
import {
  executeStrategyPreflight,
  invokeStrategyPreflight,
  type StrategyPreflightArgs,
  type StrategyPreflightResult,
} from "../lib/skills/strategy-preflight";
import type { DM1EvidenceSnapshot } from "../lib/strategy/dm1/types";
import type { PlaybookRule, PlaybookVersion } from "../lib/playbook";

const TIMESTAMP = "2025-01-01T00:00:00.000Z";

function longEvidence(): DM1EvidenceSnapshot {
  return {
    evidence: {
      DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
      TECHNICAL_CONFLUENCE: "STRONGLY_SUPPORTIVE",
      RELATIVE_OPPORTUNITY: "STRONGLY_SUPPORTIVE",
      MARKET_ALIGNMENT: "STRONGLY_SUPPORTIVE",
      SENTIMENT_DERIVATIVES: "STRONGLY_SUPPORTIVE",
    },
    risk: "ACCEPTABLE",
    safety: "CLEAR",
    regimeFit: "FIT",
  };
}

function shortEvidence(): DM1EvidenceSnapshot {
  return {
    evidence: {
      DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING",
      TECHNICAL_CONFLUENCE: "STRONGLY_OPPOSING",
      RELATIVE_OPPORTUNITY: "STRONGLY_OPPOSING",
      MARKET_ALIGNMENT: "STRONGLY_OPPOSING",
      SENTIMENT_DERIVATIVES: "STRONGLY_OPPOSING",
    },
    risk: "ACCEPTABLE",
    safety: "CLEAR",
    regimeFit: "FIT",
  };
}

function abstainEvidence(): DM1EvidenceSnapshot {
  return {
    evidence: {
      DIRECTIONAL_MOMENTUM: "NEUTRAL",
      TECHNICAL_CONFLUENCE: "NEUTRAL",
      RELATIVE_OPPORTUNITY: "NEUTRAL",
      MARKET_ALIGNMENT: "NEUTRAL",
      SENTIMENT_DERIVATIVES: "NEUTRAL",
    },
    risk: "ACCEPTABLE",
    safety: "CLEAR",
    regimeFit: "FIT",
  };
}

function marketBlockEvidence(): DM1EvidenceSnapshot {
  return {
    ...longEvidence(),
    safety: "VETO",
  };
}

function unknownRuleEvidence(): DM1EvidenceSnapshot {
  return {
    ...longEvidence(),
    evidence: {
      ...longEvidence().evidence,
      SENTIMENT_DERIVATIVES: "UNKNOWN",
    },
  };
}

function makeVersion(
  rules: readonly PlaybookRule[],
  overrides?: Partial<Pick<PlaybookVersion, "id" | "playbookId" | "versionNumber">>,
): PlaybookVersion {
  const result = createInitialVersion({
    playbookId: overrides?.playbookId ?? "playbook-strategy-preflight",
    versionId: overrides?.id ?? "playbook-strategy-preflight-v1",
    strategyId: "dm-1",
    strategyVersion: "1.0.0",
    rules,
    createdAt: TIMESTAMP,
    approvedAt: TIMESTAMP,
    approvedBy: "HUMAN",
  });
  if (result.ok !== true) {
    throw new Error(result.message);
  }
  if (overrides?.versionNumber === undefined || overrides.versionNumber === 1) {
    return result.version;
  }
  return {
    ...result.version,
    versionNumber: overrides.versionNumber,
  };
}

function makeRule(
  id: string,
  effect: PlaybookRule["effect"],
  condition: PlaybookRule["conditions"][number],
): PlaybookRule {
  return { id, effect, conditions: [condition] };
}

function makeArgs(
  evidence: DM1EvidenceSnapshot,
  rules: readonly PlaybookRule[],
  memory?: StrategyPreflightArgs["memory"],
): StrategyPreflightArgs {
  const market = evaluateDM1(evidence);
  return {
    market_context: {
      decision: market.decision,
      reason_codes: market.reasonCodes,
      evidence: evidence.evidence as unknown as StrategyPreflightArgs["market_context"]["evidence"],
      risk: evidence.risk,
      safety: evidence.safety,
      regime: evidence.regimeFit,
      coverage: market.coverage,
      conflict: market.conflict,
    },
    playbook: makeVersion(rules),
    ...(memory === undefined ? {} : { memory }),
  };
}

function successResult(args: StrategyPreflightArgs): StrategyPreflightResult {
  const execution = executeStrategyPreflight(args);
  expect(execution.ok).toBe(true);
  if (execution.ok !== true) {
    throw new Error(execution.failure.message);
  }
  return execution.result;
}

describe("strategy_preflight skill", () => {
  it("returns FIT for valid LONG + PASS", () => {
    const result = successResult(
      makeArgs(longEvidence(), [
        makeRule("pass-long", "PASS", {
          field: "decision",
          operator: "EQUALS",
          value: "LONG",
        }),
      ]),
    );

    expect(result.preflight_status).toBe("FIT");
    expect(result.original_market_decision).toBe("LONG");
    expect(result.effective_decision).toBe("LONG");
    expect(result.playbook_aggregate_effect).toBe("PASS");
    expect(result.winning_source).toBe("BOTH");
    expect(result.triggered_rules.map((rule) => rule.rule_id)).toEqual([
      "pass-long",
    ]);
  });

  it("returns CAUTION for valid SHORT + CAUTION", () => {
    const result = successResult(
      makeArgs(shortEvidence(), [
        makeRule("caution-short", "CAUTION", {
          field: "decision",
          operator: "EQUALS",
          value: "SHORT",
        }),
      ]),
    );

    expect(result.preflight_status).toBe("CAUTION");
    expect(result.original_market_decision).toBe("SHORT");
    expect(result.effective_decision).toBe("SHORT");
    expect(result.playbook_aggregate_effect).toBe("CAUTION");
    expect(result.winning_source).toBe("PLAYBOOK");
  });

  it.each([
    ["WAIT", "WAIT"],
    ["BLOCK", "BLOCK"],
  ] as const)("preserves a Playbook %s effect", (effect, expectedStatus) => {
    const result = successResult(
      makeArgs(longEvidence(), [
        makeRule(`rule-${effect.toLowerCase()}`, effect, {
          field: "decision",
          operator: "EQUALS",
          value: "LONG",
        }),
      ]),
    );

    expect(result.preflight_status).toBe(expectedStatus);
    expect(result.playbook_aggregate_effect).toBe(effect);
  });

  it("does not let market ABSTAIN become FIT", () => {
    const result = successResult(
      makeArgs(abstainEvidence(), [
        makeRule("pass-abstain", "PASS", {
          field: "decision",
          operator: "EQUALS",
          value: "ABSTAIN",
        }),
      ]),
    );

    expect(result.original_market_decision).toBe("ABSTAIN");
    expect(result.preflight_status).toBe("WAIT");
    expect(result.effective_decision).toBe("ABSTAIN");
    expect(result.market_effect).toBe("WAIT");
  });

  it("does not weaken a hard market block with a passing Playbook", () => {
    const result = successResult(
      makeArgs(marketBlockEvidence(), [
        makeRule("pass-abstain", "PASS", {
          field: "decision",
          operator: "EQUALS",
          value: "ABSTAIN",
        }),
      ]),
    );

    expect(result.original_market_decision).toBe("ABSTAIN");
    expect(result.market_effect).toBe("BLOCK");
    expect(result.playbook_aggregate_effect).toBe("PASS");
    expect(result.preflight_status).toBe("BLOCK");
    expect(result.winning_source).toBe("MARKET");
  });

  it("preserves M2 UNKNOWN rule behavior and diagnostics", () => {
    const result = successResult(
      makeArgs(unknownRuleEvidence(), [
        makeRule("unknown-block", "BLOCK", {
          field: "SENTIMENT_DERIVATIVES",
          operator: "EQUALS",
          value: "SUPPORTIVE",
        }),
      ]),
    );

    expect(result.preflight_status).toBe("WAIT");
    expect(result.playbook_aggregate_effect).toBe("WAIT");
    expect(result.unknown_rules.map((rule) => rule.rule_id)).toEqual([
      "unknown-block",
    ]);
    expect(
      result.condition_diagnostics.find(
        (diagnostic) => diagnostic.rule_id === "unknown-block",
      ),
    ).toMatchObject({ result: "UNKNOWN", observed_value: "UNKNOWN" });
  });

  it("uses optional memory only through approved rule conditions", () => {
    const rules = [
      makeRule("memory-block", "BLOCK", {
        field: "memory.highSimilarityCaseCount",
        operator: "GTE",
        value: 2,
      }),
    ];
    const withoutMemory = successResult(makeArgs(longEvidence(), rules));
    const withZeroMemory = successResult(
      makeArgs(longEvidence(), rules, {
        rankedCaseCount: 0,
        comparableCaseCount: 0,
        highSimilarityCaseCount: 0,
      }),
    );
    const withHighSimilarityMemory = successResult(
      makeArgs(longEvidence(), rules, {
        rankedCaseCount: 3,
        comparableCaseCount: 2,
        highSimilarityCaseCount: 2,
      }),
    );

    expect(withoutMemory.preflight_status).toBe("WAIT");
    expect(withZeroMemory.preflight_status).toBe("FIT");
    expect(withHighSimilarityMemory.preflight_status).toBe("BLOCK");
  });

  it("keeps omitted memory distinct from zero historical cases", () => {
    const rules = [
      makeRule("pass-long", "PASS", {
        field: "decision",
        operator: "EQUALS",
        value: "LONG",
      }),
    ];
    const omitted = successResult(makeArgs(longEvidence(), rules));
    const empty = successResult(
      makeArgs(longEvidence(), rules, {
        rankedCaseCount: 0,
        comparableCaseCount: 0,
        highSimilarityCaseCount: 0,
      }),
    );

    expect(omitted.memory_summary_used).toBeNull();
    expect(empty.memory_summary_used).toMatchObject({
      rankedCaseCount: 0,
      comparableCaseCount: 0,
      highSimilarityCaseCount: 0,
    });
  });

  it("rejects hidden historical outcome or P&L input", () => {
    const args = makeArgs(longEvidence(), []);
    const withPnl = {
      ...args,
      pnl: { realizedPnlUsd: 10 },
    } as unknown;
    const withOutcome = {
      ...args,
      memory: {
        rankedCaseCount: 0,
        comparableCaseCount: 0,
        highSimilarityCaseCount: 0,
        historicalOutcome: "POSITIVE",
      },
    } as unknown;

    expect(executeStrategyPreflight(withPnl)).toMatchObject({
      ok: false,
      failure: { error_code: "INVALID_INPUT" },
    });
    expect(executeStrategyPreflight(withOutcome)).toMatchObject({
      ok: false,
      failure: { error_code: "INVALID_INPUT" },
    });
  });

  it("rejects malformed enums, memory counts and Playbook conditions", () => {
    const args = makeArgs(longEvidence(), []);
    const malformedEnum = {
      ...args,
      market_context: { ...args.market_context, risk: "LOW" },
    } as unknown;
    const malformedMemory = {
      ...args,
      memory: {
        rankedCaseCount: 1,
        comparableCaseCount: 2,
        highSimilarityCaseCount: 0,
      },
    } as unknown;
    const validArgs = makeArgs(longEvidence(), []);
    const malformedPlaybook = {
      ...validArgs,
      playbook: {
        ...validArgs.playbook,
        rules: [
          {
            id: "bad-condition",
            effect: "PASS",
            conditions: [
              { field: "risk", operator: "GTE", value: "ACCEPTABLE" },
            ],
          },
        ],
      },
    } as unknown;

    expect(executeStrategyPreflight(malformedEnum)).toMatchObject({
      ok: false,
      failure: { error_code: "UNSUPPORTED_ENUM" },
    });
    expect(executeStrategyPreflight(malformedMemory)).toMatchObject({
      ok: false,
      failure: { error_code: "INVALID_MEMORY" },
    });
    expect(executeStrategyPreflight(malformedPlaybook)).toMatchObject({
      ok: false,
      failure: { error_code: "INVALID_PLAYBOOK" },
    });
  });

  it("is deterministic, read-only and delegates to the existing M4 result", () => {
    const args = makeArgs(longEvidence(), [
      makeRule("pass-long", "PASS", {
        field: "decision",
        operator: "EQUALS",
        value: "LONG",
      }),
    ]);
    const before = JSON.stringify(args);
    const first = successResult(args);
    const second = successResult(args);
    const market = evaluateDM1(longEvidence());
    const direct = evaluatePreflight({
      marketResult: market,
      evidence: longEvidence(),
      playbookVersion: args.playbook,
    });

    expect(JSON.stringify(args)).toBe(before);
    expect(first).toEqual(second);
    expect(direct.ok).toBe(true);
    if (direct.ok === true) {
      expect(first.preflight_status).toBe(direct.status);
      expect(first.playbook_aggregate_effect).toBe(
        direct.playbookEffect,
      );
      expect(first.condition_diagnostics.length).toBe(
        direct.playbookEvaluation.ruleEvaluations[0]?.conditionEvaluations.length,
      );
    }
    expect(first.preflight_algorithm).toEqual({
      name: "evaluatePreflight",
      version: "decision-integration-v1",
    });
  });

  it("exposes list, detail and invoke routes with the Track 3 envelope", async () => {
    const listResponse = listSkills();
    const list = (await listResponse.json()) as {
      skills: readonly { name: string; read_only: boolean }[];
    };
    expect(list.skills.map((skill) => skill.name)).toContain(
      "strategy_preflight",
    );
    expect(
      list.skills.find((skill) => skill.name === "strategy_preflight")?.read_only,
    ).toBe(true);

    const detailResponse = getStrategyPreflight();
    const detail = (await detailResponse.json()) as {
      name: string;
      input_schema: Record<string, unknown>;
      read_only: boolean;
    };
    expect(detail.name).toBe("strategy_preflight");
    expect(detail.input_schema).toHaveProperty("properties.market_context");
    expect(detail.read_only).toBe(true);

    const args = makeArgs(longEvidence(), []);
    const invokeResponse = invokeStrategyPreflight({
      name: "strategy_preflight",
      args,
      conversation_id: "test-conversation",
    }, 0);
    expect(invokeResponse).toMatchObject({
      name: "strategy_preflight",
      status: "success",
      xp: 0,
      guard_decision: "ALLOW",
    });
    expect(invokeResponse.result).toMatchObject({ preflight_status: "FIT" });

    const routeResponse = await invokeStrategyPreflightRoute(
      new Request("http://localhost/api/skills/strategy_preflight/invoke", {
        method: "POST",
        body: JSON.stringify({
          name: "strategy_preflight",
          args,
          conversation_id: "route-test",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(routeResponse.status).toBe(200);
    expect(await routeResponse.json()).toMatchObject({
      name: "strategy_preflight",
      status: "success",
    });
  });

  it("returns structured failures instead of a false positive", () => {
    const response = invokeStrategyPreflight({
      name: "strategy_preflight",
      args: {},
      conversation_id: "failure-test",
    }, 0);

    expect(response).toMatchObject({
      name: "strategy_preflight",
      status: "error",
      guard_decision: "BLOCK",
      result: { error_code: "INVALID_INPUT" },
    });
  });
});