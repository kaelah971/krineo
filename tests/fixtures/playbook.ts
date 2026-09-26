import type {
  Condition,
  EvaluationContext,
  PlaybookRule,
} from "../../lib/playbook/types";

export function makePassRule(
  overrides?: Partial<PlaybookRule>,
): PlaybookRule {
  return {
    id: overrides?.id ?? "rule-pass",
    effect: overrides?.effect ?? "PASS",
    conditions: overrides?.conditions ?? [
      { field: "decision", operator: "EQUALS", value: "LONG" } as Condition,
    ],
  };
}

export function makeBlockSafetyRule(
  overrides?: Partial<PlaybookRule>,
): PlaybookRule {
  return {
    id: overrides?.id ?? "rule-block-safety",
    effect: overrides?.effect ?? "BLOCK",
    conditions: overrides?.conditions ?? [
      { field: "safety", operator: "EQUALS", value: "VETO" } as Condition,
    ],
  };
}

export function makeEvaluationContext(
  overrides?: Partial<EvaluationContext>,
): EvaluationContext {
  const has = (key: keyof EvaluationContext): boolean =>
    overrides !== undefined &&
    Object.prototype.hasOwnProperty.call(overrides, key);
  return {
    strategyId: overrides?.strategyId ?? "dm-1",
    strategyVersion: overrides?.strategyVersion ?? "1.0.0",
    decision: overrides?.decision ?? "LONG",
    evidence: {
      DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
      TECHNICAL_CONFLUENCE: "SUPPORTIVE",
      RELATIVE_OPPORTUNITY: "SUPPORTIVE",
      MARKET_ALIGNMENT: "SUPPORTIVE",
      SENTIMENT_DERIVATIVES: "SUPPORTIVE",
      ...(overrides?.evidence ?? {}),
    },
    risk: overrides?.risk ?? "ACCEPTABLE",
    safety: overrides?.safety ?? "CLEAR",
    regimeFit: overrides?.regimeFit ?? "FIT",
    coverage: has("coverage")
      ? (overrides as EvaluationContext).coverage
      : 0.9,
    coverageLabel: overrides?.coverageLabel ?? "PARTIAL",
    conflict: has("conflict")
      ? (overrides as EvaluationContext).conflict
      : 0.1,
    conflictLabel: overrides?.conflictLabel ?? "LOW",
    reasonCodes: overrides?.reasonCodes ?? [],
    ...(has("memory")
      ? { memory: (overrides as EvaluationContext).memory }
      : {}),
  };
}
