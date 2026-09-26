import {
  canonicalizeRules,
  validateCondition,
  validateEvaluationContext,
  validateRule,
} from "./conditions";
import {
  CONDITION_OPERATORS,
  CONDITION_RESULTS,
  DIAGNOSTIC_CODES,
  PLAYBOOK_ACTORS,
  PLAYBOOK_EFFECTS,
  PLAYBOOK_REJECTION_CODES,
  RULE_OUTCOMES,
  type Condition,
  type ConditionEvaluation,
  type ConditionResult,
  type Diagnostic,
  type Effect,
  type EvaluateRuleResult,
  type EvaluateVersionResult,
  type EvaluationContext,
  type PlaybookRejection,
  type PlaybookRejectionCode,
  type PlaybookRule,
  type RuleEvaluation,
  type RuleOutcome,
} from "./types";

const REJECTION_CODES: ReadonlySet<string> = new Set<string>(
  Object.values(PLAYBOOK_REJECTION_CODES),
);

const RANK_BY_EFFECT: Record<Effect, number> = {
  [PLAYBOOK_EFFECTS.BLOCK]: 0,
  [PLAYBOOK_EFFECTS.WAIT]: 1,
  [PLAYBOOK_EFFECTS.CAUTION]: 2,
  [PLAYBOOK_EFFECTS.PASS]: 3,
};

function conservativeUnknownEffect(configuredEffect: Effect): Effect {
  switch (configuredEffect) {
    case PLAYBOOK_EFFECTS.BLOCK:
    case PLAYBOOK_EFFECTS.WAIT:
      return PLAYBOOK_EFFECTS.WAIT;
    case PLAYBOOK_EFFECTS.CAUTION:
      return PLAYBOOK_EFFECTS.CAUTION;
    case PLAYBOOK_EFFECTS.PASS:
      return PLAYBOOK_EFFECTS.PASS;
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        deepFreeze(item);
      }
    } else {
      for (const key of Object.keys(value)) {
        deepFreeze((value as Record<string, unknown>)[key]);
      }
    }
    Object.freeze(value);
  }
  return value;
}

function toRejection(error: unknown, fallback: PlaybookRejectionCode): PlaybookRejection {
  if (error instanceof Error) {
    const prefix = error.message.split(":")[0] as string;
    if (REJECTION_CODES.has(prefix)) {
      return deepFreeze({
        ok: false,
        code: prefix as PlaybookRejectionCode,
        message: error.message,
      });
    }
    return deepFreeze({ ok: false, code: fallback, message: error.message });
  }
  return deepFreeze({ ok: false, code: fallback, message: "Invalid input." });
}

function memoryShortKey(field: string): string {
  return field.slice("memory.".length);
}

function actualOf(field: string, context: EvaluationContext): unknown {
  switch (field) {
    case "strategyId":
      return context.strategyId;
    case "strategyVersion":
      return context.strategyVersion;
    case "decision":
      return context.decision;
    case "DIRECTIONAL_MOMENTUM":
    case "TECHNICAL_CONFLUENCE":
    case "RELATIVE_OPPORTUNITY":
    case "MARKET_ALIGNMENT":
    case "SENTIMENT_DERIVATIVES":
      return context.evidence[
        field as keyof EvaluationContext["evidence"]
      ];
    case "risk":
      return context.risk;
    case "safety":
      return context.safety;
    case "regimeFit":
      return context.regimeFit;
    case "coverage":
      return context.coverage;
    case "conflict":
      return context.conflict;
    case "reasonCode":
      return context.reasonCodes;
    case "memory.rankedCaseCount":
    case "memory.comparableCaseCount":
    case "memory.highSimilarityCaseCount": {
      const memory = context.memory as
        | Record<string, number | undefined>
        | undefined;
      const count = memory?.[memoryShortKey(field)];
      return count === undefined ? undefined : count;
    }
    default:
      return undefined;
  }
}

function triStateEquals(actual: string, expected: string): ConditionResult {
  if (actual === expected) {
    return CONDITION_RESULTS.MATCH;
  }
  if (actual === "UNKNOWN") {
    return CONDITION_RESULTS.UNKNOWN;
  }
  return CONDITION_RESULTS.NO_MATCH;
}

function triStateNotEquals(actual: string, expected: string): ConditionResult {
  if (actual === "UNKNOWN" || expected === "UNKNOWN") {
    return CONDITION_RESULTS.UNKNOWN;
  }
  if (actual === expected) {
    return CONDITION_RESULTS.NO_MATCH;
  }
  return CONDITION_RESULTS.MATCH;
}

function triStateIn(actual: string, expected: readonly string[]): ConditionResult {
  if ((expected as readonly string[]).includes(actual)) {
    return CONDITION_RESULTS.MATCH;
  }
  if (actual === "UNKNOWN") {
    return CONDITION_RESULTS.UNKNOWN;
  }
  return CONDITION_RESULTS.NO_MATCH;
}

function numericEquals(actual: number | null | undefined, expected: number): ConditionResult {
  if (actual === null || actual === undefined) {
    return CONDITION_RESULTS.UNKNOWN;
  }
  return actual === expected
    ? CONDITION_RESULTS.MATCH
    : CONDITION_RESULTS.NO_MATCH;
}

function numericNotEquals(
  actual: number | null | undefined,
  expected: number,
): ConditionResult {
  if (actual === null || actual === undefined) {
    return CONDITION_RESULTS.UNKNOWN;
  }
  return actual !== expected
    ? CONDITION_RESULTS.MATCH
    : CONDITION_RESULTS.NO_MATCH;
}

function numericIn(
  actual: number | null | undefined,
  expected: readonly number[],
): ConditionResult {
  if (actual === null || actual === undefined) {
    return CONDITION_RESULTS.UNKNOWN;
  }
  return (expected as readonly number[]).includes(actual)
    ? CONDITION_RESULTS.MATCH
    : CONDITION_RESULTS.NO_MATCH;
}

function diagnosticFor(result: ConditionResult, message: string): Diagnostic {
  if (result === CONDITION_RESULTS.MATCH) {
    return { code: DIAGNOSTIC_CODES.CONDITION_MATCH, message };
  }
  if (result === CONDITION_RESULTS.NO_MATCH) {
    return { code: DIAGNOSTIC_CODES.CONDITION_NO_MATCH, message };
  }
  return { code: DIAGNOSTIC_CODES.CONDITION_UNKNOWN, message };
}

function describeExpected(condition: Condition): string {
  const raw = condition as unknown as Record<string, unknown>;
  if (raw["operator"] === CONDITION_OPERATORS.IN) {
    return JSON.stringify(raw["values"]);
  }
  return JSON.stringify(raw["value"]);
}

function describeObserved(observed: unknown): string {
  return JSON.stringify(observed === undefined ? null : observed);
}

export function evaluateCondition(
  condition: Condition,
  context: EvaluationContext,
): ConditionEvaluation {
  const validCondition = validateCondition(condition);
  const validContext = validateEvaluationContext(context);
  const raw = validCondition as unknown as {
    readonly field: string;
    readonly operator: string;
    readonly value?: unknown;
    readonly values?: readonly unknown[];
  };
  const actual = actualOf(raw.field, validContext);

  let result: ConditionResult = CONDITION_RESULTS.UNKNOWN;
  let observed: ConditionEvaluation["observedValue"] = null;

  if (raw.field === "reasonCode") {
    const present = validContext.reasonCodes as readonly string[];
    observed = deepFreeze([...present]) as ConditionEvaluation["observedValue"];
    if (raw.operator === CONDITION_OPERATORS.EQUALS) {
      result = present.includes(raw.value as string)
        ? CONDITION_RESULTS.MATCH
        : CONDITION_RESULTS.NO_MATCH;
    } else if (raw.operator === CONDITION_OPERATORS.NOT_EQUALS) {
      result = present.includes(raw.value as string)
        ? CONDITION_RESULTS.NO_MATCH
        : CONDITION_RESULTS.MATCH;
    } else {
      const wanted = raw.values as readonly string[];
      result = wanted.some((entry) => present.includes(entry))
        ? CONDITION_RESULTS.MATCH
        : CONDITION_RESULTS.NO_MATCH;
    }
  } else if (
    raw.field === "coverage" ||
    raw.field === "conflict" ||
    raw.field === "memory.rankedCaseCount" ||
    raw.field === "memory.comparableCaseCount" ||
    raw.field === "memory.highSimilarityCaseCount"
  ) {
    const numeric = actual as number | null | undefined;
    observed = numeric === undefined || numeric === null ? null : numeric;
    if (raw.operator === CONDITION_OPERATORS.EQUALS) {
      result = numericEquals(numeric, raw.value as number);
    } else if (raw.operator === CONDITION_OPERATORS.NOT_EQUALS) {
      result = numericNotEquals(numeric, raw.value as number);
    } else if (raw.operator === CONDITION_OPERATORS.IN) {
      result = numericIn(numeric, raw.values as readonly number[]);
    } else if (raw.operator === CONDITION_OPERATORS.GTE) {
      result =
        numeric === null || numeric === undefined
          ? CONDITION_RESULTS.UNKNOWN
          : numeric >= (raw.value as number)
            ? CONDITION_RESULTS.MATCH
            : CONDITION_RESULTS.NO_MATCH;
    } else {
      result =
        numeric === null || numeric === undefined
          ? CONDITION_RESULTS.UNKNOWN
          : numeric <= (raw.value as number)
            ? CONDITION_RESULTS.MATCH
            : CONDITION_RESULTS.NO_MATCH;
    }
  } else {
    const actualString = actual as string;
    observed = actualString;
    if (raw.operator === CONDITION_OPERATORS.EQUALS) {
      result = triStateEquals(actualString, raw.value as string);
    } else if (raw.operator === CONDITION_OPERATORS.NOT_EQUALS) {
      result = triStateNotEquals(actualString, raw.value as string);
    } else {
      result = triStateIn(actualString, raw.values as readonly string[]);
    }
  }

  const message =
    `Field "${raw.field}" ${raw.operator} ${describeExpected(validCondition)} ` +
    `observed ${describeObserved(observed)} => ${result}.`;
  return deepFreeze({
    condition: validCondition,
    result,
    observedValue: observed,
    diagnostics: [diagnosticFor(result, message)],
  });
}

export function evaluateRule(
  rule: unknown,
  context: unknown,
): EvaluateRuleResult {
  let validRule: PlaybookRule | undefined;
  let validContext: EvaluationContext | undefined;
  try {
    validRule = validateRule(rule);
    validContext = validateEvaluationContext(context);
  } catch (error) {
    return toRejection(error, PLAYBOOK_REJECTION_CODES.INVALID_RULE);
  }
  const ruleOut = validRule as PlaybookRule;
  const ctxOut = validContext as EvaluationContext;
  const conditionEvaluations: ConditionEvaluation[] = ruleOut.conditions.map(
    (condition) => evaluateCondition(condition, ctxOut),
  );
  let outcome: RuleOutcome = RULE_OUTCOMES.TRIGGERED;
  if (
    conditionEvaluations.some(
      (entry) => entry.result === CONDITION_RESULTS.NO_MATCH,
    )
  ) {
    outcome = RULE_OUTCOMES.NOT_TRIGGERED;
  } else if (
    conditionEvaluations.some(
      (entry) => entry.result === CONDITION_RESULTS.UNKNOWN,
    )
  ) {
    outcome = RULE_OUTCOMES.UNKNOWN;
  }
  const evaluation: RuleEvaluation = {
    rule: ruleOut,
    outcome,
    appliedEffect: outcome === RULE_OUTCOMES.TRIGGERED ? ruleOut.effect : null,
    conditionEvaluations,
    diagnostics: conditionEvaluations.flatMap((entry) => [...entry.diagnostics]),
  };
  return deepFreeze({ ok: true as const, evaluation });
}

function assertVersionShape(version: unknown): asserts version is {
  readonly id: string;
  readonly playbookId: string;
  readonly versionNumber: number;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly rules: readonly unknown[];
  readonly createdAt: string;
  readonly approvedAt: string;
  readonly approvedBy: string;
} {
  if (version === null || typeof version !== "object" || Array.isArray(version)) {
    throw new Error("INVALID_VERSION: Version must be an object.");
  }
  const record = version as Record<string, unknown>;
  if (typeof record["id"] !== "string" || record["id"].length === 0) {
    throw new Error("INVALID_VERSION: Version id must be a non-empty string.");
  }
  if (
    typeof record["playbookId"] !== "string" ||
    record["playbookId"].length === 0
  ) {
    throw new Error("INVALID_VERSION: Version playbookId must be a non-empty string.");
  }
  if (
    typeof record["versionNumber"] !== "number" ||
    !Number.isInteger(record["versionNumber"]) ||
    record["versionNumber"] < 1
  ) {
    throw new Error("INVALID_VERSION: Version versionNumber must be a positive integer.");
  }
  if (
    typeof record["strategyId"] !== "string" ||
    record["strategyId"].length === 0 ||
    typeof record["strategyVersion"] !== "string" ||
    record["strategyVersion"].length === 0
  ) {
    throw new Error("INVALID_VERSION: Version requires strategyId and strategyVersion.");
  }
  if (record["approvedBy"] !== PLAYBOOK_ACTORS.HUMAN) {
    throw new Error("INVALID_VERSION: Version must be human-approved.");
  }
  if (
    typeof record["createdAt"] !== "string" ||
    record["createdAt"].length === 0 ||
    typeof record["approvedAt"] !== "string" ||
    record["approvedAt"].length === 0
  ) {
    throw new Error("INVALID_VERSION: Version requires createdAt and approvedAt.");
  }
  if (!Array.isArray(record["rules"])) {
    throw new Error("INVALID_RULE: Version rules must be an array.");
  }
}

export function evaluateVersion(
  version: unknown,
  context: unknown,
): EvaluateVersionResult {
  let versionId = "";
  let ruleEvaluations: RuleEvaluation[] = [];
  let aggregateEffect: Effect = PLAYBOOK_EFFECTS.PASS;
  try {
    assertVersionShape(version);
    versionId = version.id;
    const validContext = validateEvaluationContext(context);
    const rules = canonicalizeRules(version.rules);
    const evaluations: RuleEvaluation[] = [];
    for (const rule of rules) {
      const outcome = evaluateRule(rule, validContext);
      if (outcome.ok !== true) {
        const failure = outcome as PlaybookRejection;
        throw new Error(`${failure.code}: ${failure.message}`);
      }
      evaluations.push(outcome.evaluation);
    }
    ruleEvaluations = evaluations;
  } catch (error) {
    return toRejection(error, PLAYBOOK_REJECTION_CODES.INVALID_VERSION);
  }
  let aggregate: Effect = PLAYBOOK_EFFECTS.PASS;
  for (const entry of ruleEvaluations) {
    if (entry.outcome === RULE_OUTCOMES.TRIGGERED && entry.appliedEffect !== null) {
      if (RANK_BY_EFFECT[entry.appliedEffect] < RANK_BY_EFFECT[aggregate]) {
        aggregate = entry.appliedEffect;
      }
    } else if (entry.outcome === RULE_OUTCOMES.UNKNOWN) {
      const conservative = conservativeUnknownEffect(entry.rule.effect);
      if (RANK_BY_EFFECT[conservative] < RANK_BY_EFFECT[aggregate]) {
        aggregate = conservative;
      }
    }
  }
  aggregateEffect = aggregate;
  return deepFreeze({
    ok: true as const,
    evaluation: {
      versionId,
      aggregateEffect,
      ruleEvaluations,
      diagnostics: ruleEvaluations.flatMap((entry) => [...entry.diagnostics]),
    },
  });
}
