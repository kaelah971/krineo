import { DM1_CONFIG } from "../strategy/dm1/config";
import type { DM1Config, DecisionResult } from "../strategy/dm1/types";
import {
  DIRECTIONAL_EVIDENCE_DIMENSIONS,
  type DirectionalEvidenceDimension,
} from "../evidence/types";
import type {
  DirectionalThesisDecision,
  InvalidationConditionValue,
  InvalidationRule,
  InvalidationRuleType,
  Thesis,
  ThesisVersion,
} from "./types";
import {
  INVALIDATION_RULE_TYPE_ORDER,
  INVALIDATION_RULE_TYPES,
} from "./types";
import type { StrategyDiff } from "./diff";

export const INVALIDATION_OUTCOMES = {
  MAINTAIN: "MAINTAIN",
  WEAKEN: "WEAKEN",
  INVALIDATE: "INVALIDATE",
} as const;

export type InvalidationOutcome =
  (typeof INVALIDATION_OUTCOMES)[keyof typeof INVALIDATION_OUTCOMES];

export const INVALIDATION_EVALUATION_EFFECTS = {
  NONE: "NONE",
  WEAKEN: "WEAKEN",
  INVALIDATE: "INVALIDATE",
} as const;

export type InvalidationEvaluationEffect =
  (typeof INVALIDATION_EVALUATION_EFFECTS)[keyof typeof INVALIDATION_EVALUATION_EFFECTS];

export const INVALIDATION_RESULT_SOURCES = {
  PRECOMMITTED_RULES: "PRECOMMITTED_RULES",
} as const;

export type InvalidationResultSource =
  (typeof INVALIDATION_RESULT_SOURCES)[keyof typeof INVALIDATION_RESULT_SOURCES];

export const INVALIDATION_REASON_CODES = {
  DIRECTION_LOSS: "DIRECTION_LOSS",
  DIRECTION_REVERSAL: "DIRECTION_REVERSAL",
  REGIME_BREAK: "REGIME_BREAK",
  SAFETY_VETO: "SAFETY_VETO",
  RISK_LIMIT_BREACH: "RISK_LIMIT_BREACH",
  CRITICAL_EVIDENCE_LOSS: "CRITICAL_EVIDENCE_LOSS",
} as const;

export type InvalidationReasonCode =
  (typeof INVALIDATION_REASON_CODES)[keyof typeof INVALIDATION_REASON_CODES];

export const INVALIDATION_REJECTION_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  INVALID_INVALIDATION_RULESET: "INVALID_INVALIDATION_RULESET",
  INVALID_STRATEGY_DIFF: "INVALID_STRATEGY_DIFF",
  THESIS_ID_MISMATCH: "THESIS_ID_MISMATCH",
  ASSET_MISMATCH: "ASSET_MISMATCH",
  STRATEGY_ID_MISMATCH: "STRATEGY_ID_MISMATCH",
  STRATEGY_VERSION_MISMATCH: "STRATEGY_VERSION_MISMATCH",
  LATEST_STATE_MISMATCH: "LATEST_STATE_MISMATCH",
} as const;

export type InvalidationRejectionCode =
  (typeof INVALIDATION_REJECTION_CODES)[keyof typeof INVALIDATION_REJECTION_CODES];

export interface InvalidationRejection {
  readonly ok: false;
  readonly code: InvalidationRejectionCode;
  readonly message: string;
}

export type InvalidationSerializableValue =
  | string
  | number
  | boolean
  | null
  | readonly string[];

export interface InvalidationObservation {
  readonly field: string;
  readonly before: InvalidationSerializableValue;
  readonly after: InvalidationSerializableValue;
}

export interface InvalidationRuleEvaluation {
  readonly ruleId: string;
  readonly ruleType: InvalidationRuleType;
  readonly triggered: boolean;
  readonly effect: InvalidationEvaluationEffect;
  readonly reasonCode: InvalidationReasonCode;
  readonly observations: readonly InvalidationObservation[];
  readonly evidenceDimensions: readonly DirectionalEvidenceDimension[];
}

export interface InvalidationEvaluation {
  readonly thesisId: string;
  readonly thesisVersionId: string;
  readonly asset: string;
  readonly originalDecision: DirectionalThesisDecision;
  readonly outcome: InvalidationOutcome;
  readonly evaluatedRules: readonly InvalidationRuleEvaluation[];
  readonly triggeredRules: readonly InvalidationRuleEvaluation[];
  readonly untriggeredRules: readonly InvalidationRuleEvaluation[];
  readonly highestEffect: InvalidationEvaluationEffect;
  readonly reasonCodes: readonly InvalidationReasonCode[];
  readonly source: InvalidationResultSource;
}

export interface InvalidationEvaluationSuccess {
  readonly ok: true;
  readonly evaluation: InvalidationEvaluation;
}

export type InvalidationEvaluationResult =
  | InvalidationEvaluationSuccess
  | InvalidationRejection;

export interface InvalidationEvaluationInput {
  readonly originalVersion: ThesisVersion;
  readonly invalidationRules: readonly InvalidationRule[];
  readonly strategyDiff: StrategyDiff;
  readonly latestDecision: DecisionResult;
  readonly currentThesis?: Pick<Thesis, "id" | "asset" | "status">;
}

export const DM1_INVALIDATION_RULE_IDS = {
  DIRECTION_LOSS: "dm1-direction-loss",
  DIRECTION_REVERSAL: "dm1-direction-reversal",
  REGIME_BREAK: "dm1-regime-break",
  SAFETY_VETO: "dm1-safety-veto",
  CRITICAL_EVIDENCE_LOSS: "dm1-critical-evidence-loss",
  RISK_LIMIT_BREACH: "dm1-risk-limit-breach",
} as const;

function compareLexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ruleTypeRank(ruleType: string): number {
  const rank = INVALIDATION_RULE_TYPE_ORDER.indexOf(
    ruleType as (typeof INVALIDATION_RULE_TYPE_ORDER)[number],
  );
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function compareRules(left: InvalidationRule, right: InvalidationRule): number {
  const typeDifference = ruleTypeRank(left.ruleType) - ruleTypeRank(right.ruleType);
  return typeDifference === 0
    ? compareLexical(left.id, right.id)
    : typeDifference;
}

function canonicalRules(
  rules: readonly InvalidationRule[],
): readonly InvalidationRule[] {
  return [...rules].sort(compareRules);
}

function invalidationRule(
  id: string,
  ruleType: InvalidationRuleType,
  effect: InvalidationRule["effect"],
  direction: DirectionalThesisDecision,
  config: DM1Config,
  condition: InvalidationRule["condition"],
): InvalidationRule {
  return {
    id,
    ruleType,
    effect,
    condition,
    strategyId: config.strategyId,
    strategyVersion: config.version,
    direction,
  };
}

export function buildDM1InvalidationRules(
  direction: DirectionalThesisDecision,
  config: DM1Config = DM1_CONFIG,
): readonly InvalidationRule[] {
  if (direction !== "LONG" && direction !== "SHORT") {
    throw new Error("DM-1 invalidation rules require a directional thesis.");
  }

  return canonicalRules([
    invalidationRule(
      DM1_INVALIDATION_RULE_IDS.DIRECTION_LOSS,
      INVALIDATION_RULE_TYPES.DIRECTION_LOSS,
      "WEAKEN",
      direction,
      config,
      {
        field: "directionalScore",
        operator: "WITHIN_DIRECTION_THRESHOLD",
        value: config.directionThreshold,
        parameters: { direction },
      },
    ),
    invalidationRule(
      DM1_INVALIDATION_RULE_IDS.DIRECTION_REVERSAL,
      INVALIDATION_RULE_TYPES.DIRECTION_REVERSAL,
      "INVALIDATE",
      direction,
      config,
      {
        field: "directionalScore",
        operator: "OPPOSITE_DIRECTION_THRESHOLD",
        value: config.directionThreshold,
        parameters: { direction },
      },
    ),
    invalidationRule(
      DM1_INVALIDATION_RULE_IDS.REGIME_BREAK,
      INVALIDATION_RULE_TYPES.REGIME_BREAK,
      "INVALIDATE",
      direction,
      config,
      { field: "regimeFit", operator: "EQ", value: "BROKEN" },
    ),
    invalidationRule(
      DM1_INVALIDATION_RULE_IDS.SAFETY_VETO,
      INVALIDATION_RULE_TYPES.SAFETY_VETO,
      "INVALIDATE",
      direction,
      config,
      { field: "safety", operator: "EQ", value: "VETO" },
    ),
    invalidationRule(
      DM1_INVALIDATION_RULE_IDS.CRITICAL_EVIDENCE_LOSS,
      INVALIDATION_RULE_TYPES.CRITICAL_EVIDENCE_LOSS,
      "INVALIDATE",
      direction,
      config,
      {
        field: "criticalEvidence",
        operator: "ANY_DM1_REQUIRED_UNAVAILABLE",
        value: config.minimumCoverage,
        parameters: {
          requiredDimensions: [...config.requiredDirectionalDimensions],
          requiredEvidence: [...config.requiredEvidence],
        },
      },
    ),
    invalidationRule(
      DM1_INVALIDATION_RULE_IDS.RISK_LIMIT_BREACH,
      INVALIDATION_RULE_TYPES.RISK_LIMIT_BREACH,
      "INVALIDATE",
      direction,
      config,
      { field: "risk", operator: "EQ", value: "EXTREME" },
    ),
  ]);
}

function rejection(
  code: InvalidationRejectionCode,
  message: string,
): InvalidationRejection {
  return { ok: false, code, message };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isDirectionalDimension(
  value: string,
): value is DirectionalEvidenceDimension {
  return Object.values(DIRECTIONAL_EVIDENCE_DIMENSIONS).includes(
    value as DirectionalEvidenceDimension,
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function sameConditionValue(
  left: InvalidationConditionValue,
  right: InvalidationConditionValue,
): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }
  return left === right;
}

function sameRuleSemantics(left: InvalidationRule, right: InvalidationRule): boolean {
  const leftParameters = left.condition.parameters ?? {};
  const rightParameters = right.condition.parameters ?? {};
  const leftKeys = Object.keys(leftParameters).sort(compareLexical);
  const rightKeys = Object.keys(rightParameters).sort(compareLexical);

  return (
    left.id === right.id &&
    left.ruleType === right.ruleType &&
    left.effect === right.effect &&
    left.strategyId === right.strategyId &&
    left.strategyVersion === right.strategyVersion &&
    left.direction === right.direction &&
    left.condition.field === right.condition.field &&
    left.condition.operator === right.condition.operator &&
    sameConditionValue(left.condition.value, right.condition.value) &&
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        sameConditionValue(leftParameters[key], rightParameters[key]),
    )
  );
}

function validateRuleSet(
  rules: readonly InvalidationRule[],
  originalVersion: ThesisVersion,
): InvalidationRejection | null {
  const requiredTypes = new Set<InvalidationRuleType>(
    INVALIDATION_RULE_TYPE_ORDER,
  );
  const seenTypes = new Set<InvalidationRuleType>();
  const seenIds = new Set<string>();

  for (const rule of rules) {
    if (
      rule === null ||
      typeof rule !== "object" ||
      !isNonEmptyString(rule.id) ||
      seenIds.has(rule.id) ||
      !requiredTypes.has(rule.ruleType) ||
      seenTypes.has(rule.ruleType) ||
      rule.strategyId !== originalVersion.strategyId ||
      rule.strategyVersion !== originalVersion.strategyVersion ||
      rule.direction !== originalVersion.decision
    ) {
      return rejection(
        INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
        "Precommitted invalidation rules must be unique, complete DM-1 rules compatible with the committed strategy and direction.",
      );
    }

    const condition = rule.condition;
    if (
      condition === null ||
      typeof condition !== "object" ||
      !isNonEmptyString(condition.field) ||
      !isNonEmptyString(condition.operator) ||
      (typeof condition.value === "number" && !isFiniteNumber(condition.value))
    ) {
      return rejection(
        INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
        "Precommitted invalidation rules must contain structured executable conditions.",
      );
    }

    const direction = originalVersion.decision as DirectionalThesisDecision;
    const expected =
      rule.ruleType === INVALIDATION_RULE_TYPES.DIRECTION_LOSS
        ? {
            effect: "WEAKEN",
            field: "directionalScore",
            operator: "WITHIN_DIRECTION_THRESHOLD",
          }
        : rule.ruleType === INVALIDATION_RULE_TYPES.DIRECTION_REVERSAL
          ? {
              effect: "INVALIDATE",
              field: "directionalScore",
              operator: "OPPOSITE_DIRECTION_THRESHOLD",
            }
          : rule.ruleType === INVALIDATION_RULE_TYPES.REGIME_BREAK
            ? { effect: "INVALIDATE", field: "regimeFit", operator: "EQ" }
            : rule.ruleType === INVALIDATION_RULE_TYPES.SAFETY_VETO
              ? { effect: "INVALIDATE", field: "safety", operator: "EQ" }
              : rule.ruleType === INVALIDATION_RULE_TYPES.RISK_LIMIT_BREACH
                ? { effect: "INVALIDATE", field: "risk", operator: "EQ" }
                : {
                    effect: "INVALIDATE",
                    field: "criticalEvidence",
                    operator: "ANY_DM1_REQUIRED_UNAVAILABLE",
                  };

    if (
      rule.effect !== expected.effect ||
      condition.field !== expected.field ||
      condition.operator !== expected.operator
    ) {
      return rejection(
        INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
        "Precommitted invalidation rule effect or condition is incompatible with its DM-1 rule type.",
      );
    }

    if (
      (rule.ruleType === INVALIDATION_RULE_TYPES.DIRECTION_LOSS ||
        rule.ruleType === INVALIDATION_RULE_TYPES.DIRECTION_REVERSAL) &&
      (!isFiniteNumber(condition.value) || condition.value <= 0 ||
        condition.parameters?.direction !== direction)
    ) {
      return rejection(
        INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
        "Directional invalidation rules must contain a positive threshold and committed direction.",
      );
    }

    if (
      rule.ruleType === INVALIDATION_RULE_TYPES.REGIME_BREAK &&
      condition.value !== "BROKEN"
    ) {
      return rejection(
        INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
        "REGIME_BREAK must be precommitted to the BROKEN regime state.",
      );
    }
    if (
      rule.ruleType === INVALIDATION_RULE_TYPES.SAFETY_VETO &&
      condition.value !== "VETO"
    ) {
      return rejection(
        INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
        "SAFETY_VETO must be precommitted to the VETO safety state.",
      );
    }
    if (
      rule.ruleType === INVALIDATION_RULE_TYPES.RISK_LIMIT_BREACH &&
      condition.value !== "EXTREME"
    ) {
      return rejection(
        INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
        "RISK_LIMIT_BREACH must be precommitted to the EXTREME risk state.",
      );
    }

    if (rule.ruleType === INVALIDATION_RULE_TYPES.CRITICAL_EVIDENCE_LOSS) {
      const requiredDimensions = condition.parameters?.requiredDimensions;
      if (
        !isFiniteNumber(condition.value) ||
        condition.value < 0 ||
        condition.value > 1 ||
        !isStringArray(requiredDimensions) ||
        requiredDimensions.length === 0 ||
        requiredDimensions.some((dimension) => !isDirectionalDimension(dimension))
      ) {
        return rejection(
          INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
          "CRITICAL_EVIDENCE_LOSS must contain a finite coverage threshold and required directional dimensions.",
        );
      }
    }

    seenTypes.add(rule.ruleType);
    seenIds.add(rule.id);
  }

  if (seenTypes.size !== requiredTypes.size) {
    return rejection(
      INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
      "The DM-1 precommitted invalidation rule set must contain all six rule types.",
    );
  }

  return null;
}

function validateStrategyDiff(
  diff: StrategyDiff,
  originalVersion: ThesisVersion,
  rules: readonly InvalidationRule[],
  latestDecision: DecisionResult,
): InvalidationRejection | null {
  if (
    diff === null ||
    typeof diff !== "object" ||
    diff.thesisId !== originalVersion.thesisId ||
    diff.asset !== originalVersion.asset ||
    diff.strategyId !== originalVersion.strategyId ||
    diff.strategyVersion !== originalVersion.strategyVersion ||
    diff.score === null ||
    typeof diff.score !== "object" ||
    diff.thesisStrength === null ||
    typeof diff.thesisStrength !== "object" ||
    diff.coverage === null ||
    typeof diff.coverage !== "object" ||
    diff.conflict === null ||
    typeof diff.conflict !== "object" ||
    diff.decision === null ||
    typeof diff.decision !== "object" ||
    diff.risk === null ||
    typeof diff.risk !== "object" ||
    diff.safety === null ||
    typeof diff.safety !== "object" ||
    diff.regimeFit === null ||
    typeof diff.regimeFit !== "object" ||
    diff.invalidationRules === null ||
    typeof diff.invalidationRules !== "object" ||
    diff.score.before !== originalVersion.directionalScore ||
    diff.thesisStrength.before !== originalVersion.thesisStrength ||
    diff.coverage.before !== originalVersion.coverage ||
    diff.conflict.before !== originalVersion.conflict ||
    diff.decision.before !== originalVersion.decision ||
    diff.risk.before !== originalVersion.risk ||
    diff.safety.before !== originalVersion.safety ||
    diff.regimeFit.before !== originalVersion.regimeFit ||
    !Array.isArray(diff.evidenceChanges) ||
    !Array.isArray(diff.invalidationRules.before)
  ) {
    return rejection(
      INVALIDATION_REJECTION_CODES.INVALID_STRATEGY_DIFF,
      "Strategy Diff does not match the committed ThesisVersion.",
    );
  }

  const beforeRules = diff.invalidationRules.before;
  if (
    beforeRules.length !== rules.length ||
    !rules.every((rule) => {
      const beforeRule = beforeRules.find((candidate) => candidate.id === rule.id);
      return beforeRule !== undefined && sameRuleSemantics(rule, beforeRule);
    })
  ) {
    return rejection(
      INVALIDATION_REJECTION_CODES.INVALID_INVALIDATION_RULESET,
      "Supplied precommitted rules do not match the rules committed in the Strategy Diff.",
    );
  }

  if (
    latestDecision.strategyId !== originalVersion.strategyId ||
    latestDecision.strategyVersion !== originalVersion.strategyVersion ||
    diff.score.after !== latestDecision.directionalScore ||
    diff.thesisStrength.after !== latestDecision.thesisStrength ||
    diff.coverage.after !== latestDecision.coverage ||
    diff.conflict.after !== latestDecision.conflict ||
    diff.decision.after !== latestDecision.decision ||
    diff.risk.after !== latestDecision.risk ||
    diff.safety.after !== latestDecision.safety ||
    diff.regimeFit.after !== latestDecision.regimeFit
  ) {
    return rejection(
      INVALIDATION_REJECTION_CODES.LATEST_STATE_MISMATCH,
      "Latest DM-1 state does not match the after-state in the Strategy Diff.",
    );
  }

  return null;
}

function observation(
  field: string,
  before: InvalidationSerializableValue,
  after: InvalidationSerializableValue,
): InvalidationObservation {
  return { field, before, after };
}

function latestEvidenceState(
  diff: StrategyDiff,
  dimension: DirectionalEvidenceDimension,
): string | null {
  const change = diff.evidenceChanges.find(
    (candidate) => candidate.dimension === dimension,
  );
  return change?.after?.state ?? null;
}

function evaluateRule(
  rule: InvalidationRule,
  originalVersion: ThesisVersion,
  latestDecision: DecisionResult,
  diff: StrategyDiff,
): InvalidationRuleEvaluation {
  const threshold =
    typeof rule.condition.value === "number" ? rule.condition.value : null;
  const direction = originalVersion.decision as DirectionalThesisDecision;
  let triggered = false;
  let evidenceDimensions: readonly DirectionalEvidenceDimension[] = [];
  let observations: readonly InvalidationObservation[] = [];

  switch (rule.ruleType) {
    case INVALIDATION_RULE_TYPES.DIRECTION_LOSS:
      triggered =
        threshold !== null &&
        (direction === "LONG"
          ? latestDecision.directionalScore < threshold &&
            latestDecision.directionalScore > -threshold
          : latestDecision.directionalScore > -threshold &&
            latestDecision.directionalScore < threshold);
      observations = [
        observation(
          "directionalScore",
          originalVersion.directionalScore,
          latestDecision.directionalScore,
        ),
        observation("directionThreshold", threshold, threshold),
      ];
      break;
    case INVALIDATION_RULE_TYPES.DIRECTION_REVERSAL:
      triggered =
        threshold !== null &&
        (direction === "LONG"
          ? latestDecision.directionalScore <= -threshold
          : latestDecision.directionalScore >= threshold);
      observations = [
        observation(
          "directionalScore",
          originalVersion.directionalScore,
          latestDecision.directionalScore,
        ),
        observation("directionThreshold", threshold, threshold),
      ];
      break;
    case INVALIDATION_RULE_TYPES.REGIME_BREAK:
      triggered = latestDecision.regimeFit === "BROKEN";
      observations = [
        observation("regimeFit", originalVersion.regimeFit, latestDecision.regimeFit),
      ];
      break;
    case INVALIDATION_RULE_TYPES.SAFETY_VETO:
      triggered = latestDecision.safety === "VETO";
      observations = [
        observation("safety", originalVersion.safety, latestDecision.safety),
      ];
      break;
    case INVALIDATION_RULE_TYPES.RISK_LIMIT_BREACH:
      triggered = latestDecision.risk === "EXTREME";
      observations = [
        observation("risk", originalVersion.risk, latestDecision.risk),
      ];
      break;
    case INVALIDATION_RULE_TYPES.CRITICAL_EVIDENCE_LOSS: {
      const configuredDimensions = rule.condition.parameters?.requiredDimensions;
      const requiredDimensions = isStringArray(configuredDimensions)
        ? configuredDimensions.filter(isDirectionalDimension)
        : [];
      const unknownDimensions = requiredDimensions.filter((dimension) => {
        const state = latestEvidenceState(diff, dimension);
        return state === null || state === "UNKNOWN";
      });
      const coverageThreshold = threshold;
      triggered =
        (coverageThreshold !== null &&
          latestDecision.coverage < coverageThreshold) ||
        unknownDimensions.length > 0 ||
        latestDecision.safety === "UNKNOWN" ||
        latestDecision.risk === "UNKNOWN" ||
        latestDecision.regimeFit === "UNKNOWN";
      evidenceDimensions = unknownDimensions;
      observations = [
        observation("coverage", diff.coverage.before, latestDecision.coverage),
        observation(
          "minimumCoverage",
          coverageThreshold,
          coverageThreshold,
        ),
        observation("requiredDimensions", [], unknownDimensions),
        observation("safety", originalVersion.safety, latestDecision.safety),
        observation("risk", originalVersion.risk, latestDecision.risk),
        observation(
          "regimeFit",
          originalVersion.regimeFit,
          latestDecision.regimeFit,
        ),
      ];
      break;
    }
  }

  return {
    ruleId: rule.id,
    ruleType: rule.ruleType,
    triggered,
    effect: triggered
      ? rule.effect === "WEAKEN"
        ? INVALIDATION_EVALUATION_EFFECTS.WEAKEN
        : INVALIDATION_EVALUATION_EFFECTS.INVALIDATE
      : INVALIDATION_EVALUATION_EFFECTS.NONE,
    reasonCode:
      rule.ruleType === INVALIDATION_RULE_TYPES.DIRECTION_LOSS
        ? INVALIDATION_REASON_CODES.DIRECTION_LOSS
        : rule.ruleType === INVALIDATION_RULE_TYPES.DIRECTION_REVERSAL
          ? INVALIDATION_REASON_CODES.DIRECTION_REVERSAL
          : rule.ruleType === INVALIDATION_RULE_TYPES.REGIME_BREAK
            ? INVALIDATION_REASON_CODES.REGIME_BREAK
            : rule.ruleType === INVALIDATION_RULE_TYPES.SAFETY_VETO
              ? INVALIDATION_REASON_CODES.SAFETY_VETO
              : rule.ruleType === INVALIDATION_RULE_TYPES.RISK_LIMIT_BREACH
                ? INVALIDATION_REASON_CODES.RISK_LIMIT_BREACH
                : INVALIDATION_REASON_CODES.CRITICAL_EVIDENCE_LOSS,
    observations,
    evidenceDimensions,
  };
}

function validateLatestDecision(
  latestDecision: DecisionResult,
): InvalidationRejection | null {
  if (
    latestDecision === null ||
    typeof latestDecision !== "object" ||
    !isNonEmptyString(latestDecision.strategyId) ||
    !isNonEmptyString(latestDecision.strategyVersion) ||
    (latestDecision.decision !== "LONG" &&
      latestDecision.decision !== "SHORT" &&
      latestDecision.decision !== "ABSTAIN") ||
    !isFiniteNumber(latestDecision.directionalScore) ||
    !(latestDecision.thesisStrength === null ||
      isFiniteNumber(latestDecision.thesisStrength)) ||
    !isFiniteNumber(latestDecision.coverage) ||
    !(latestDecision.conflict === null || isFiniteNumber(latestDecision.conflict)) ||
    !["ACCEPTABLE", "ELEVATED", "EXTREME", "UNKNOWN"].includes(
      latestDecision.risk,
    ) ||
    !["CLEAR", "VETO", "UNKNOWN"].includes(latestDecision.safety) ||
    !["FIT", "DEGRADED", "BROKEN", "UNKNOWN"].includes(
      latestDecision.regimeFit,
    )
  ) {
    return rejection(
      INVALIDATION_REJECTION_CODES.LATEST_STATE_MISMATCH,
      "Latest DM-1 state is malformed or contains non-finite metrics.",
    );
  }

  return null;
}

export function evaluateDM1Invalidation(
  input: InvalidationEvaluationInput,
): InvalidationEvaluationResult {
  if (input === null || typeof input !== "object") {
    return rejection(
      INVALIDATION_REJECTION_CODES.INVALID_INPUT,
      "Invalidation evaluation requires a committed version, rules, diff and latest decision.",
    );
  }

  if (
    !Array.isArray(input.invalidationRules) ||
    input.strategyDiff === null ||
    typeof input.strategyDiff !== "object" ||
    input.latestDecision === null ||
    typeof input.latestDecision !== "object"
  ) {
    return rejection(
      INVALIDATION_REJECTION_CODES.INVALID_INPUT,
      "Invalidation evaluation requires a committed version, rules, diff and latest decision.",
    );
  }

  const originalDecision = input.originalVersion?.decision;
  if (originalDecision !== "LONG" && originalDecision !== "SHORT") {
    return rejection(
      INVALIDATION_REJECTION_CODES.NOT_APPLICABLE,
      "ABSTAIN does not have a directional thesis to invalidate.",
    );
  }

  if (
    input.currentThesis !== undefined &&
    (input.currentThesis.id !== input.originalVersion.thesisId ||
      input.currentThesis.asset !== input.originalVersion.asset)
  ) {
    return rejection(
      INVALIDATION_REJECTION_CODES.THESIS_ID_MISMATCH,
      "Current Thesis identity does not match the committed ThesisVersion.",
    );
  }

  const currentStatus =
    input.currentThesis?.status ?? input.originalVersion.statusAtCommit;
  if (
    currentStatus === "INVALIDATED" ||
    currentStatus === "CLOSED" ||
    currentStatus === "ABSTAINED"
  ) {
    return rejection(
      INVALIDATION_REJECTION_CODES.NOT_APPLICABLE,
      "Terminal or abstained theses cannot receive a new invalidation recommendation.",
    );
  }

  if (currentStatus !== "ACTIVE" && currentStatus !== "WEAKENED") {
    return rejection(
      INVALIDATION_REJECTION_CODES.NOT_APPLICABLE,
      "Invalidation evaluation applies only to active or weakened theses.",
    );
  }

  const ruleRejection = validateRuleSet(
    input.invalidationRules,
    input.originalVersion,
  );
  if (ruleRejection !== null) {
    return ruleRejection;
  }

  const latestDecisionRejection = validateLatestDecision(input.latestDecision);
  if (latestDecisionRejection !== null) {
    return latestDecisionRejection;
  }

  const diffRejection = validateStrategyDiff(
    input.strategyDiff,
    input.originalVersion,
    input.invalidationRules,
    input.latestDecision,
  );
  if (diffRejection !== null) {
    return diffRejection;
  }

  const evaluatedRules = canonicalRules(input.invalidationRules).map((rule) =>
    evaluateRule(rule, input.originalVersion, input.latestDecision, input.strategyDiff),
  );
  const triggeredRules = evaluatedRules.filter((rule) => rule.triggered);
  const untriggeredRules = evaluatedRules.filter((rule) => !rule.triggered);
  const highestEffect = triggeredRules.some(
    (rule) => rule.effect === INVALIDATION_EVALUATION_EFFECTS.INVALIDATE,
  )
    ? INVALIDATION_EVALUATION_EFFECTS.INVALIDATE
    : triggeredRules.some(
        (rule) => rule.effect === INVALIDATION_EVALUATION_EFFECTS.WEAKEN,
      )
      ? INVALIDATION_EVALUATION_EFFECTS.WEAKEN
      : INVALIDATION_EVALUATION_EFFECTS.NONE;
  const outcome =
    highestEffect === INVALIDATION_EVALUATION_EFFECTS.INVALIDATE
      ? INVALIDATION_OUTCOMES.INVALIDATE
      : highestEffect === INVALIDATION_EVALUATION_EFFECTS.WEAKEN
        ? INVALIDATION_OUTCOMES.WEAKEN
        : INVALIDATION_OUTCOMES.MAINTAIN;

  return {
    ok: true,
    evaluation: {
      thesisId: input.originalVersion.thesisId,
      thesisVersionId: input.originalVersion.id,
      asset: input.originalVersion.asset,
      originalDecision,
      outcome,
      evaluatedRules,
      triggeredRules,
      untriggeredRules,
      highestEffect,
      reasonCodes: [...new Set(triggeredRules.map((rule) => rule.reasonCode))],
      source: INVALIDATION_RESULT_SOURCES.PRECOMMITTED_RULES,
    },
  };
}
