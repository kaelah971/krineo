import type {
  DecisionState,
  DirectionalEvidenceState,
  RegimeFitState,
  RiskState,
  SafetyState,
} from "../evidence/types";
import {
  CONDITION_FIELD_ORDER,
  CONDITION_OPERATORS,
  CONDITION_OPERATOR_ORDER,
  NUMERIC_CONDITION_FIELDS,
  PLAYBOOK_EFFECTS,
  type Condition,
  type ConditionField,
  type ConditionOperator,
  type EvaluationContext,
  type PlaybookRule,
} from "./types";

export function compareLexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const DECISION_VALUES: readonly DecisionState[] = ["LONG", "SHORT", "ABSTAIN"];

const DIRECTIONAL_STATE_VALUES: readonly DirectionalEvidenceState[] = [
  "STRONGLY_SUPPORTIVE",
  "SUPPORTIVE",
  "NEUTRAL",
  "OPPOSING",
  "STRONGLY_OPPOSING",
  "UNKNOWN",
];

const RISK_STATE_VALUES: readonly RiskState[] = [
  "ACCEPTABLE",
  "ELEVATED",
  "EXTREME",
  "UNKNOWN",
];

const SAFETY_STATE_VALUES: readonly SafetyState[] = ["CLEAR", "VETO", "UNKNOWN"];

const REGIME_FIT_STATE_VALUES: readonly RegimeFitState[] = [
  "FIT",
  "DEGRADED",
  "BROKEN",
  "UNKNOWN",
];

const COVERAGE_LABEL_VALUES: readonly string[] = [
  "COMPLETE",
  "PARTIAL",
  "DEGRADED",
];

const CONFLICT_LABEL_VALUES: readonly string[] = ["LOW", "MODERATE", "HIGH"];

const EFFECT_VALUES: readonly string[] = Object.values(PLAYBOOK_EFFECTS);

const OPERATOR_VALUES: readonly string[] = Object.values(CONDITION_OPERATORS);

const KNOWN_FIELDS: ReadonlySet<string> = new Set<string>(
  CONDITION_FIELD_ORDER as readonly string[],
);

const NUMERIC_FIELDS: ReadonlySet<string> = new Set<string>(
  NUMERIC_CONDITION_FIELDS as readonly string[],
);

const DIRECTIONAL_DIMENSIONS: readonly string[] = [
  "DIRECTIONAL_MOMENTUM",
  "TECHNICAL_CONFLUENCE",
  "RELATIVE_OPPORTUNITY",
  "MARKET_ALIGNMENT",
  "SENTIMENT_DERIVATIVES",
];

const MEMORY_FIELDS: readonly string[] = [
  "rankedCaseCount",
  "comparableCaseCount",
  "highSimilarityCaseCount",
];

const EVIDENCE_DIMENSIONS: readonly string[] = DIRECTIONAL_DIMENSIONS;

function fail(code: string, message: string): never {
  throw new Error(`${code}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      out[key] = deepClone((value as Record<string, unknown>)[key]);
    }
    return out as T;
  }
  return value;
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

function assertKnownField(field: unknown): asserts field is ConditionField {
  if (typeof field !== "string" || !KNOWN_FIELDS.has(field)) {
    if (typeof field === "string" && /^[A-Z_]+$/.test(field)) {
      fail(
        "UNKNOWN_DIRECTIONAL_DIMENSION",
        `Unknown directional dimension "${field}".`,
      );
    }
    fail(
      "UNKNOWN_CONDITION_FIELD",
      `Unknown condition field ${JSON.stringify(field)}.`,
    );
  }
}

function assertKnownOperator(
  operator: unknown,
): asserts operator is ConditionOperator {
  if (typeof operator !== "string" || !OPERATOR_VALUES.includes(operator)) {
    fail(
      "UNSUPPORTED_OPERATOR",
      `Unknown condition operator ${JSON.stringify(operator)}.`,
    );
  }
}

function assertOperatorAllowed(
  field: ConditionField,
  operator: ConditionOperator,
): void {
  if (NUMERIC_FIELDS.has(field)) {
    return;
  }
  if (
    operator === CONDITION_OPERATORS.GTE ||
    operator === CONDITION_OPERATORS.LTE
  ) {
    fail(
      "UNSUPPORTED_OPERATOR",
      `Operator "${operator}" is not supported for field "${field}".`,
    );
  }
}

function assertNonEmptyString(value: unknown, what: string): void {
  if (typeof value !== "string" || value.length === 0) {
    fail(
      "CONDITION_VALUE_TYPE_MISMATCH",
      `${what} must be a non-empty string, got ${JSON.stringify(value)}.`,
    );
  }
}

function assertCoverageValue(value: unknown, what: string): void {
  if (typeof value !== "number") {
    fail(
      "CONDITION_VALUE_TYPE_MISMATCH",
      `${what} must be a number, got ${JSON.stringify(value)}.`,
    );
  }
  if (!Number.isFinite(value)) {
    fail("NON_FINITE_NUMBER", `${what} must be finite, got ${value}.`);
  }
  if (value < 0 || value > 1) {
    fail(
      "OUT_OF_RANGE_NUMBER",
      `${what} must be within [0,1], got ${value}.`,
    );
  }
}

function assertMemoryValue(value: unknown, what: string): void {
  if (typeof value !== "number") {
    fail(
      "CONDITION_VALUE_TYPE_MISMATCH",
      `${what} must be a number, got ${JSON.stringify(value)}.`,
    );
  }
  if (!Number.isFinite(value)) {
    fail("NON_FINITE_NUMBER", `${what} must be finite, got ${value}.`);
  }
  if (value < 0) {
    fail(
      "OUT_OF_RANGE_NUMBER",
      `${what} must be a non-negative integer, got ${value}.`,
    );
  }
  if (!Number.isInteger(value)) {
    fail(
      "CONDITION_VALUE_TYPE_MISMATCH",
      `${what} must be an integer, got ${value}.`,
    );
  }
}

function assertFieldScalar(field: ConditionField, value: unknown): void {
  const what = `Value for field "${field}"`;
  switch (field) {
    case "strategyId":
    case "strategyVersion":
      assertNonEmptyString(value, what);
      return;
    case "decision":
      if (
        typeof value !== "string" ||
        !(DECISION_VALUES as readonly string[]).includes(value)
      ) {
        fail(
          "CONDITION_VALUE_TYPE_MISMATCH",
          `${what} must be one of LONG|SHORT|ABSTAIN, got ${JSON.stringify(value)}.`,
        );
      }
      return;
    case "DIRECTIONAL_MOMENTUM":
    case "TECHNICAL_CONFLUENCE":
    case "RELATIVE_OPPORTUNITY":
    case "MARKET_ALIGNMENT":
    case "SENTIMENT_DERIVATIVES":
      if (
        typeof value !== "string" ||
        !(DIRECTIONAL_STATE_VALUES as readonly string[]).includes(value)
      ) {
        fail(
          "CONDITION_VALUE_TYPE_MISMATCH",
          `${what} must be a directional evidence state, got ${JSON.stringify(value)}.`,
        );
      }
      return;
    case "risk":
      if (
        typeof value !== "string" ||
        !(RISK_STATE_VALUES as readonly string[]).includes(value)
      ) {
        fail(
          "CONDITION_VALUE_TYPE_MISMATCH",
          `${what} must be a risk state, got ${JSON.stringify(value)}.`,
        );
      }
      return;
    case "safety":
      if (
        typeof value !== "string" ||
        !(SAFETY_STATE_VALUES as readonly string[]).includes(value)
      ) {
        fail(
          "CONDITION_VALUE_TYPE_MISMATCH",
          `${what} must be a safety state, got ${JSON.stringify(value)}.`,
        );
      }
      return;
    case "regimeFit":
      if (
        typeof value !== "string" ||
        !(REGIME_FIT_STATE_VALUES as readonly string[]).includes(value)
      ) {
        fail(
          "CONDITION_VALUE_TYPE_MISMATCH",
          `${what} must be a regime-fit state, got ${JSON.stringify(value)}.`,
        );
      }
      return;
    case "coverage":
    case "conflict":
      assertCoverageValue(value, what);
      return;
    case "reasonCode":
      assertNonEmptyString(value, what);
      return;
    case "memory.rankedCaseCount":
    case "memory.comparableCaseCount":
    case "memory.highSimilarityCaseCount":
      assertMemoryValue(value, what);
      return;
    default: {
      const exhaustive: never = field;
      fail("UNKNOWN_CONDITION_FIELD", `Unhandled field "${exhaustive}".`);
    }
  }
}

function hasDuplicates(values: readonly unknown[]): boolean {
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      if (values[i] === values[j]) {
        return true;
      }
    }
  }
  return false;
}

interface ParsedCondition {
  readonly field: ConditionField;
  readonly operator: ConditionOperator;
  readonly value?: unknown;
  readonly values?: readonly unknown[];
}

function parseCondition(cond: unknown): ParsedCondition {
  if (!isRecord(cond)) {
    fail("INVALID_CONDITION", "Condition must be an object.");
  }
  assertKnownField(cond["field"]);
  assertKnownOperator(cond["operator"]);
  const field = cond["field"];
  const operator = cond["operator"];
  assertOperatorAllowed(field, operator);
  const keys = Object.keys(cond);
  if (operator === CONDITION_OPERATORS.IN) {
    if (
      keys.length !== 3 ||
      !keys.includes("field") ||
      !keys.includes("operator") ||
      !keys.includes("values")
    ) {
      fail(
        "INVALID_CONDITION",
        `IN condition on field "${field}" must have exactly {field, operator, values}.`,
      );
    }
    const values = cond["values"];
    if (!Array.isArray(values)) {
      fail(
        "CONDITION_VALUE_TYPE_MISMATCH",
        `IN values for field "${field}" must be an array.`,
      );
    }
    if (values.length === 0) {
      fail("EMPTY_IN_SET", `IN values for field "${field}" must be non-empty.`);
    }
    for (const entry of values) {
      assertFieldScalar(field, entry);
    }
    if (hasDuplicates(values)) {
      fail(
        "DUPLICATE_IN_SET_VALUE",
        `IN values for field "${field}" must not contain duplicates.`,
      );
    }
    return { field, operator, values: [...values] };
  }
  if (
    keys.length !== 3 ||
    !keys.includes("field") ||
    !keys.includes("operator") ||
    !keys.includes("value")
  ) {
    fail(
      "INVALID_CONDITION",
      `Condition on field "${field}" must have exactly {field, operator, value}.`,
    );
  }
  assertFieldScalar(field, cond["value"]);
  return { field, operator, value: cond["value"] };
}

export function validateCondition(cond: unknown): Condition {
  const parsed = parseCondition(cond);
  if (parsed.operator === CONDITION_OPERATORS.IN) {
    return deepFreeze({
      field: parsed.field,
      operator: parsed.operator,
      values: [...(parsed.values as readonly unknown[])],
    } as unknown as Condition);
  }
  return deepFreeze({
    field: parsed.field,
    operator: parsed.operator,
    value: deepClone(parsed.value),
  } as unknown as Condition);
}

function sortInValues(values: readonly unknown[]): unknown[] {
  const copy = [...values];
  if (copy.every((entry) => typeof entry === "number")) {
    copy.sort((a, b) => (a as number) - (b as number));
    return copy;
  }
  copy.sort((a, b) => compareLexical(String(a), String(b)));
  return copy;
}

export function canonicalizeCondition(cond: unknown): Condition {
  const valid = validateCondition(cond) as unknown as Record<string, unknown>;
  if (Array.isArray(valid["values"])) {
    return deepFreeze({
      field: valid["field"],
      operator: valid["operator"],
      values: sortInValues(valid["values"] as readonly unknown[]),
    } as unknown as Condition);
  }
  return valid as unknown as Condition;
}

export function conditionKey(cond: unknown): string {
  const canonical = canonicalizeCondition(cond) as unknown as Record<
    string,
    unknown
  >;
  const payload =
    canonical["operator"] === CONDITION_OPERATORS.IN
      ? JSON.stringify(canonical["values"])
      : JSON.stringify(canonical["value"]);
  return `${canonical["field"] as string}|${canonical["operator"] as string}|${payload}`;
}

function conditionPayload(condition: Condition): unknown {
  const raw = condition as unknown as Record<string, unknown>;
  return raw["operator"] === CONDITION_OPERATORS.IN
    ? raw["values"]
    : raw["value"];
}

function comparePayloads(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === "string" && typeof right === "string") {
    return compareLexical(left, right);
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return left.length < right.length ? -1 : 1;
    }
    for (let i = 0; i < left.length; i += 1) {
      const order = comparePayloads(left[i], right[i]);
      if (order !== 0) {
        return order;
      }
    }
    return 0;
  }
  return compareLexical(JSON.stringify(left), JSON.stringify(right));
}

function compareConditions(left: Condition, right: Condition): number {
  const fieldOrder =
    (CONDITION_FIELD_ORDER as readonly string[]).indexOf(left.field) -
    (CONDITION_FIELD_ORDER as readonly string[]).indexOf(right.field);
  if (fieldOrder !== 0) {
    return fieldOrder < 0 ? -1 : 1;
  }
  const operatorOrder =
    (CONDITION_OPERATOR_ORDER as readonly string[]).indexOf(left.operator) -
    (CONDITION_OPERATOR_ORDER as readonly string[]).indexOf(right.operator);
  if (operatorOrder !== 0) {
    return operatorOrder < 0 ? -1 : 1;
  }
  return comparePayloads(conditionPayload(left), conditionPayload(right));
}

export function validateRule(rule: unknown): PlaybookRule {
  if (!isRecord(rule)) {
    fail("INVALID_RULE", "Rule must be an object.");
  }
  if (typeof rule["id"] !== "string" || rule["id"].length === 0) {
    fail("INVALID_RULE", "Rule id must be a non-empty string.");
  }
  if (typeof rule["effect"] !== "string" || !EFFECT_VALUES.includes(rule["effect"])) {
    fail(
      "INVALID_RULE",
      `Rule effect must be one of PASS|CAUTION|WAIT|BLOCK, got ${JSON.stringify(rule["effect"])}.`,
    );
  }
  const keys = Object.keys(rule);
  if (
    keys.length !== 3 ||
    !keys.includes("id") ||
    !keys.includes("effect") ||
    !keys.includes("conditions")
  ) {
    fail("INVALID_RULE", "Rule must have exactly {id, effect, conditions}.");
  }
  if (!Array.isArray(rule["conditions"]) || rule["conditions"].length === 0) {
    fail("EMPTY_RULE_CONDITIONS", "Rule must contain at least one condition.");
  }
  const conditions = (rule["conditions"] as unknown[]).map((entry) =>
    canonicalizeCondition(entry),
  );
  const seen = new Set<string>();
  for (const condition of conditions) {
    const key = conditionKey(condition);
    if (seen.has(key)) {
      fail("DUPLICATE_CONDITION", `Duplicate condition ${key}.`);
    }
    seen.add(key);
  }
  conditions.sort(compareConditions);
  return deepFreeze({
    id: rule["id"],
    effect: rule["effect"],
    conditions,
  } as unknown as PlaybookRule);
}

export function canonicalizeRules(rules: unknown): readonly PlaybookRule[] {
  if (!Array.isArray(rules)) {
    fail("INVALID_RULE", "Rules must be an array.");
  }
  const canonical = (rules as unknown[]).map((entry) => validateRule(entry));
  const seen = new Set<string>();
  for (const rule of canonical) {
    if (seen.has(rule.id)) {
      fail("DUPLICATE_RULE_ID", `Duplicate rule id "${rule.id}".`);
    }
    seen.add(rule.id);
  }
  canonical.sort((left, right) => compareLexical(left.id, right.id));
  return deepFreeze(canonical);
}

function assertContextString(value: unknown, what: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    fail("INVALID_CONTEXT", `${what} must be a non-empty string.`);
  }
}

function assertContextNumberOrNull(
  value: unknown,
  what: string,
): asserts value is number | null {
  if (value === null) {
    return;
  }
  if (typeof value !== "number") {
    fail("INVALID_CONTEXT", `${what} must be a number or null.`);
  }
  if (!Number.isFinite(value)) {
    fail("INVALID_CONTEXT", `${what} must be finite or null.`);
  }
  if (value < 0 || value > 1) {
    fail("INVALID_CONTEXT", `${what} must be within [0,1] or null.`);
  }
}

function assertMemoryCounts(value: unknown): asserts value is Record<string, number> {
  if (!isRecord(value)) {
    fail("INVALID_CONTEXT", "Context memory must be an object when present.");
  }
  for (const key of Object.keys(value)) {
    if (!MEMORY_FIELDS.includes(key)) {
      fail("INVALID_CONTEXT", `Unknown memory field "${key}".`);
    }
    const count = value[key];
    if (
      typeof count !== "number" ||
      !Number.isFinite(count) ||
      !Number.isInteger(count) ||
      count < 0
    ) {
      fail(
        "INVALID_CONTEXT",
        `Memory field "${key}" must be a finite non-negative integer.`,
      );
    }
  }
}

export function validateEvaluationContext(ctx: unknown): EvaluationContext {
  if (!isRecord(ctx)) {
    fail("INVALID_CONTEXT", "Evaluation context must be an object.");
  }
  assertContextString(ctx["strategyId"], "Context strategyId");
  assertContextString(ctx["strategyVersion"], "Context strategyVersion");
  if (
    typeof ctx["decision"] !== "string" ||
    !(DECISION_VALUES as readonly string[]).includes(ctx["decision"])
  ) {
    fail("INVALID_CONTEXT", "Context decision must be one of LONG|SHORT|ABSTAIN.");
  }
  if (!isRecord(ctx["evidence"])) {
    fail("INVALID_CONTEXT", "Context evidence must be an object.");
  }
  const evidenceKeys = Object.keys(ctx["evidence"]);
  if (
    evidenceKeys.length !== EVIDENCE_DIMENSIONS.length ||
    !EVIDENCE_DIMENSIONS.every((dim) => evidenceKeys.includes(dim))
  ) {
    fail(
      "INVALID_CONTEXT",
      "Context evidence must contain exactly the five directional dimensions.",
    );
  }
  for (const dim of EVIDENCE_DIMENSIONS) {
    const state = (ctx["evidence"] as Record<string, unknown>)[dim];
    if (
      typeof state !== "string" ||
      !(DIRECTIONAL_STATE_VALUES as readonly string[]).includes(state)
    ) {
      fail("INVALID_CONTEXT", `Evidence dimension "${dim}" has an invalid state.`);
    }
  }
  if (
    typeof ctx["risk"] !== "string" ||
    !(RISK_STATE_VALUES as readonly string[]).includes(ctx["risk"])
  ) {
    fail("INVALID_CONTEXT", "Context risk must be a valid risk state.");
  }
  if (
    typeof ctx["safety"] !== "string" ||
    !(SAFETY_STATE_VALUES as readonly string[]).includes(ctx["safety"])
  ) {
    fail("INVALID_CONTEXT", "Context safety must be a valid safety state.");
  }
  if (
    typeof ctx["regimeFit"] !== "string" ||
    !(REGIME_FIT_STATE_VALUES as readonly string[]).includes(ctx["regimeFit"])
  ) {
    fail("INVALID_CONTEXT", "Context regimeFit must be a valid regime-fit state.");
  }
  assertContextNumberOrNull(ctx["coverage"], "Context coverage");
  if (
    typeof ctx["coverageLabel"] !== "string" ||
    !COVERAGE_LABEL_VALUES.includes(ctx["coverageLabel"])
  ) {
    fail("INVALID_CONTEXT", "Context coverageLabel is invalid.");
  }
  assertContextNumberOrNull(ctx["conflict"], "Context conflict");
  if (
    ctx["conflictLabel"] !== null &&
    (typeof ctx["conflictLabel"] !== "string" ||
      !CONFLICT_LABEL_VALUES.includes(ctx["conflictLabel"]))
  ) {
    fail("INVALID_CONTEXT", "Context conflictLabel is invalid.");
  }
  if (!Array.isArray(ctx["reasonCodes"])) {
    fail("INVALID_CONTEXT", "Context reasonCodes must be an array.");
  }
  for (const code of ctx["reasonCodes"] as unknown[]) {
    if (typeof code !== "string" || code.length === 0) {
      fail("INVALID_CONTEXT", "Context reasonCodes must be non-empty strings.");
    }
  }
  const out: Record<string, unknown> = {
    strategyId: ctx["strategyId"],
    strategyVersion: ctx["strategyVersion"],
    decision: ctx["decision"],
    evidence: {
      DIRECTIONAL_MOMENTUM: (ctx["evidence"] as Record<string, unknown>)[
        "DIRECTIONAL_MOMENTUM"
      ],
      TECHNICAL_CONFLUENCE: (ctx["evidence"] as Record<string, unknown>)[
        "TECHNICAL_CONFLUENCE"
      ],
      RELATIVE_OPPORTUNITY: (ctx["evidence"] as Record<string, unknown>)[
        "RELATIVE_OPPORTUNITY"
      ],
      MARKET_ALIGNMENT: (ctx["evidence"] as Record<string, unknown>)[
        "MARKET_ALIGNMENT"
      ],
      SENTIMENT_DERIVATIVES: (ctx["evidence"] as Record<string, unknown>)[
        "SENTIMENT_DERIVATIVES"
      ],
    },
    risk: ctx["risk"],
    safety: ctx["safety"],
    regimeFit: ctx["regimeFit"],
    coverage: ctx["coverage"],
    coverageLabel: ctx["coverageLabel"],
    conflict: ctx["conflict"],
    conflictLabel: ctx["conflictLabel"],
    reasonCodes: [...(ctx["reasonCodes"] as unknown[])],
  };
  if (ctx["memory"] !== undefined) {
    assertMemoryCounts(ctx["memory"]);
    const memory: Record<string, unknown> = {};
    for (const key of MEMORY_FIELDS) {
      const count = (ctx["memory"] as Record<string, unknown>)[key];
      if (count !== undefined) {
        memory[key] = count;
      }
    }
    out["memory"] = memory;
  }
  return deepFreeze(out as unknown as EvaluationContext);
}

