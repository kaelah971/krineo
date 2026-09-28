import {
  DECISION_STATES,
  DIRECTIONAL_EVIDENCE_DIMENSIONS,
  DIRECTIONAL_EVIDENCE_STATES,
  REGIME_FIT_STATES,
  RISK_STATES,
  SAFETY_STATES,
  type DecisionState,
  type DirectionalEvidenceDimension,
  type DirectionalEvidenceState,
  type RegimeFitState,
  type RiskState,
  type SafetyState,
} from "../../evidence/types";
import {
  MEMORY_SUMMARY_V1_THRESHOLDS,
  MEMORY_SUMMARY_V1_VERSION,
  isCanonicalRfc3339Timestamp,
  type MemorySummaryV1,
} from "../../memory";
import {
  canonicalizeRules,
  PLAYBOOK_ACTORS,
  type PlaybookActor,
  type PlaybookVersion,
} from "../../playbook";
import {
  REASON_CODES,
  type ReasonCode,
} from "../../strategy/dm1/reason-codes";
import type { ValidatedStrategyPreflightInput } from "./types";

export type StrategyPreflightValidationCode =
  | "INVALID_INPUT"
  | "UNSUPPORTED_ENUM"
  | "INVALID_MEMORY"
  | "INVALID_PLAYBOOK";

export class StrategyPreflightValidationError extends Error {
  readonly code: StrategyPreflightValidationCode;

  constructor(code: StrategyPreflightValidationCode, message: string) {
    super(message);
    this.name = "StrategyPreflightValidationError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(
  code: StrategyPreflightValidationCode,
  message: string,
): never {
  throw new StrategyPreflightValidationError(code, message);
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    fail("INVALID_INPUT", `${label} must be an object.`);
  }
}

function assertKeys(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  label: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      fail("INVALID_INPUT", `${label} contains unsupported field "${key}".`);
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      fail("INVALID_INPUT", `${label}.${key} is required.`);
    }
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    fail("INVALID_INPUT", `${label} must be a non-empty string.`);
  }
}

function assertEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): asserts value is T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    fail("UNSUPPORTED_ENUM", `${label} has an unsupported value.`);
  }
}

function assertFiniteUnit(value: unknown, label: string): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    fail("INVALID_INPUT", `${label} must be a finite number in [0,1].`);
  }
}

function assertFiniteUnitOrNull(
  value: unknown,
  label: string,
): asserts value is number | null {
  if (value === null) return;
  assertFiniteUnit(value, label);
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    fail("INVALID_MEMORY", `${label} must be a finite non-negative integer.`);
  }
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    fail("INVALID_PLAYBOOK", `${label} must be a positive integer.`);
  }
}

function validateMarketContext(
  value: unknown,
): ValidatedStrategyPreflightInput["evidence"] & {
  readonly decision: DecisionState;
  readonly reasonCodes: readonly ReasonCode[];
  readonly coverage: number;
  readonly conflict: number | null;
} {
  assertRecord(value, "market_context");
  assertKeys(
    value,
    [
      "decision",
      "reason_codes",
      "evidence",
      "risk",
      "safety",
      "regime",
      "coverage",
      "conflict",
    ],
    [],
    "market_context",
  );

  assertEnum(
    value.decision,
    Object.values(DECISION_STATES) as readonly DecisionState[],
    "market_context.decision",
  );
  if (!Array.isArray(value.reason_codes)) {
    fail("INVALID_INPUT", "market_context.reason_codes must be an array.");
  }
  const reasonCodes: ReasonCode[] = [];
  const reasonCodeValues = Object.values(REASON_CODES) as readonly ReasonCode[];
  for (const [index, reasonCode] of value.reason_codes.entries()) {
    assertEnum(reasonCode, reasonCodeValues, `market_context.reason_codes[${index}]`);
    if (reasonCodes.includes(reasonCode)) {
      fail("INVALID_INPUT", "market_context.reason_codes must not contain duplicates.");
    }
    reasonCodes.push(reasonCode);
  }

  assertRecord(value.evidence, "market_context.evidence");
  const dimensions = Object.values(
    DIRECTIONAL_EVIDENCE_DIMENSIONS,
  ) as readonly DirectionalEvidenceDimension[];
  assertKeys(value.evidence, dimensions, [], "market_context.evidence");
  const evidence = {} as Record<
    DirectionalEvidenceDimension,
    DirectionalEvidenceState
  >;
  const evidenceStates = Object.values(
    DIRECTIONAL_EVIDENCE_STATES,
  ) as readonly DirectionalEvidenceState[];
  for (const dimension of dimensions) {
    assertEnum(
      value.evidence[dimension],
      evidenceStates,
      `market_context.evidence.${dimension}`,
    );
    evidence[dimension] = value.evidence[dimension] as DirectionalEvidenceState;
  }

  assertEnum(
    value.risk,
    Object.values(RISK_STATES) as readonly RiskState[],
    "market_context.risk",
  );
  assertEnum(
    value.safety,
    Object.values(SAFETY_STATES) as readonly SafetyState[],
    "market_context.safety",
  );
  assertEnum(
    value.regime,
    Object.values(REGIME_FIT_STATES) as readonly RegimeFitState[],
    "market_context.regime",
  );
  assertFiniteUnit(value.coverage, "market_context.coverage");
  assertFiniteUnitOrNull(value.conflict, "market_context.conflict");

  return {
    evidence: Object.freeze(evidence),
    risk: value.risk,
    safety: value.safety,
    regimeFit: value.regime,
    decision: value.decision,
    reasonCodes: Object.freeze(reasonCodes),
    coverage: value.coverage,
    conflict: value.conflict,
  };
}

function validatePlaybook(value: unknown): PlaybookVersion {
  assertRecord(value, "playbook");
  assertKeys(
    value,
    [
      "id",
      "playbookId",
      "versionNumber",
      "strategyId",
      "strategyVersion",
      "rules",
      "createdAt",
      "approvedAt",
      "approvedBy",
    ],
    ["sourceProposalId", "sourceProposalCreator"],
    "playbook",
  );
  assertNonEmptyString(value.id, "playbook.id");
  assertNonEmptyString(value.playbookId, "playbook.playbookId");
  assertPositiveInteger(value.versionNumber, "playbook.versionNumber");
  assertNonEmptyString(value.strategyId, "playbook.strategyId");
  assertNonEmptyString(value.strategyVersion, "playbook.strategyVersion");
  assertNonEmptyString(value.createdAt, "playbook.createdAt");
  assertNonEmptyString(value.approvedAt, "playbook.approvedAt");
  if (!isCanonicalRfc3339Timestamp(value.createdAt) || !isCanonicalRfc3339Timestamp(value.approvedAt)) {
    fail(
      "INVALID_PLAYBOOK",
      "playbook.createdAt and playbook.approvedAt must be canonical UTC RFC3339 timestamps.",
    );
  }
  if (Date.parse(value.approvedAt) < Date.parse(value.createdAt)) {
    fail(
      "INVALID_PLAYBOOK",
      "playbook.approvedAt must be no earlier than playbook.createdAt.",
    );
  }
  if (value.approvedBy !== PLAYBOOK_ACTORS.HUMAN) {
    fail("INVALID_PLAYBOOK", "playbook.approvedBy must be HUMAN.");
  }
  if (value.sourceProposalId !== undefined) {
    assertNonEmptyString(value.sourceProposalId, "playbook.sourceProposalId");
  }
  if (value.sourceProposalCreator !== undefined) {
    assertEnum(
      value.sourceProposalCreator,
      Object.values(PLAYBOOK_ACTORS) as readonly PlaybookActor[],
      "playbook.sourceProposalCreator",
    );
  }

  let rules: PlaybookVersion["rules"];
  try {
    rules = canonicalizeRules(value.rules);
  } catch (error) {
    fail(
      "INVALID_PLAYBOOK",
      error instanceof Error ? error.message : "playbook.rules are invalid.",
    );
  }

  return Object.freeze({
    id: value.id,
    playbookId: value.playbookId,
    versionNumber: value.versionNumber,
    strategyId: value.strategyId,
    strategyVersion: value.strategyVersion,
    rules,
    createdAt: value.createdAt,
    approvedAt: value.approvedAt,
    approvedBy: PLAYBOOK_ACTORS.HUMAN,
    ...(value.sourceProposalId === undefined
      ? {}
      : { sourceProposalId: value.sourceProposalId }),
    ...(value.sourceProposalCreator === undefined
      ? {}
      : { sourceProposalCreator: value.sourceProposalCreator }),
  }) as PlaybookVersion;
}

function validateMemory(value: unknown): MemorySummaryV1 {
  assertRecord(value, "memory");
  assertKeys(
    value,
    ["rankedCaseCount", "comparableCaseCount", "highSimilarityCaseCount"],
    [],
    "memory",
  );
  assertNonNegativeInteger(value.rankedCaseCount, "memory.rankedCaseCount");
  assertNonNegativeInteger(
    value.comparableCaseCount,
    "memory.comparableCaseCount",
  );
  assertNonNegativeInteger(
    value.highSimilarityCaseCount,
    "memory.highSimilarityCaseCount",
  );
  if (value.comparableCaseCount > value.rankedCaseCount) {
    fail(
      "INVALID_MEMORY",
      "memory.comparableCaseCount cannot exceed memory.rankedCaseCount.",
    );
  }
  if (value.highSimilarityCaseCount > value.comparableCaseCount) {
    fail(
      "INVALID_MEMORY",
      "memory.highSimilarityCaseCount cannot exceed memory.comparableCaseCount.",
    );
  }
  return Object.freeze({
    summaryVersion: MEMORY_SUMMARY_V1_VERSION,
    thresholds: MEMORY_SUMMARY_V1_THRESHOLDS,
    rankedCaseCount: value.rankedCaseCount,
    comparableCaseCount: value.comparableCaseCount,
    highSimilarityCaseCount: value.highSimilarityCaseCount,
  });
}

export function validateStrategyPreflightArgs(
  value: unknown,
): ValidatedStrategyPreflightInput {
  assertRecord(value, "args");
  assertKeys(value, ["market_context", "playbook"], ["memory"], "args");
  const market = validateMarketContext(value.market_context);
  const memorySummary =
    value.memory === undefined ? null : validateMemory(value.memory);

  return {
    evidence: {
      evidence: market.evidence,
      risk: market.risk,
      safety: market.safety,
      regimeFit: market.regimeFit,
    },
    suppliedDecision: market.decision,
    suppliedReasonCodes: market.reasonCodes,
    suppliedCoverage: market.coverage,
    suppliedConflict: market.conflict,
    playbookVersion: validatePlaybook(value.playbook),
    memorySummary,
  };
}

export function isValidationError(
  error: unknown,
): error is StrategyPreflightValidationError {
  return error instanceof StrategyPreflightValidationError;
}

