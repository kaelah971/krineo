import {
  evaluatePreflight,
  M4_DECISION_INTEGRATION_V1_VERSION,
  type DecisionIntegrationSuccess,
} from "../../decision";
import { evaluateDM1 } from "../../strategy/dm1/decision";
import { RULE_OUTCOMES, type RuleEvaluation } from "../../playbook";
import type { DecisionResult } from "../../strategy/dm1/types";
import {
  STRATEGY_PREFLIGHT_ALGORITHM,
  STRATEGY_PREFLIGHT_NAME,
  type SkillCallRequest,
  type SkillCallResponse,
  type StrategyPreflightConditionDiagnostic,
  type StrategyPreflightExecution,
  type StrategyPreflightFailure,
  type StrategyPreflightResult,
  type StrategyPreflightRuleSummary,
} from "./types";
import {
  isValidationError,
  validateStrategyPreflightArgs,
} from "./validation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function failure(
  errorCode: string,
  message: string,
  playbookCode?: string,
): StrategyPreflightExecution {
  const result: StrategyPreflightFailure = {
    error_code: errorCode,
    message,
    ...(playbookCode === undefined ? {} : { playbook_code: playbookCode }),
  };
  return { ok: false, failure: result };
}

function sameReasonCodes(
  supplied: readonly string[],
  canonical: readonly string[],
): boolean {
  if (supplied.length !== canonical.length) return false;
  const left = [...supplied].sort();
  const right = [...canonical].sort();
  return left.every((value, index) => value === right[index]);
}

function marketContextMatches(
  supplied: ReturnType<typeof validateStrategyPreflightArgs>,
  canonical: DecisionResult,
): boolean {
  return (
    supplied.suppliedDecision === canonical.decision &&
    sameReasonCodes(supplied.suppliedReasonCodes, canonical.reasonCodes) &&
    supplied.suppliedCoverage === canonical.coverage &&
    supplied.suppliedConflict === canonical.conflict
  );
}

function ruleSummary(entry: RuleEvaluation): StrategyPreflightRuleSummary {
  return {
    rule_id: entry.rule.id,
    effect: entry.rule.effect,
    outcome: entry.outcome,
    applied_effect: entry.appliedEffect,
  };
}

function conditionDiagnostics(
  evaluations: readonly RuleEvaluation[],
): readonly StrategyPreflightConditionDiagnostic[] {
  return evaluations.flatMap((entry) =>
    entry.conditionEvaluations.map((evaluation) => ({
      rule_id: entry.rule.id,
      condition: evaluation.condition,
      result: evaluation.result,
      observed_value: evaluation.observedValue,
      diagnostics: evaluation.diagnostics,
    })),
  );
}

function resultFrom(
  integration: DecisionIntegrationSuccess,
  playbookVersion: ReturnType<typeof validateStrategyPreflightArgs>["playbookVersion"],
): StrategyPreflightResult {
  const evaluations = integration.playbookEvaluation.ruleEvaluations;
  const triggeredRules = evaluations
    .filter((entry) => entry.outcome === RULE_OUTCOMES.TRIGGERED)
    .map(ruleSummary);
  const unknownRules = evaluations
    .filter((entry) => entry.outcome === RULE_OUTCOMES.UNKNOWN)
    .map(ruleSummary);

  return {
    preflight_status: integration.status,
    original_market_decision: integration.marketDecision,
    effective_decision: integration.effectiveDecision,
    market_effect: integration.marketEffect,
    playbook_aggregate_effect: integration.playbookEffect,
    winning_source: integration.winningSource,
    triggered_rules: triggeredRules,
    unknown_rules: unknownRules,
    condition_diagnostics: conditionDiagnostics(evaluations),
    market_reason_codes: [...integration.marketResult.reasonCodes],
    memory_summary_used: integration.memorySummary,
    strategy_provenance: {
      strategy_id: integration.strategyId,
      strategy_version: integration.strategyVersion,
    },
    playbook_provenance: {
      playbook_id: playbookVersion.playbookId,
      version_id: integration.playbookVersionId,
      version_number: playbookVersion.versionNumber,
      strategy_id: playbookVersion.strategyId,
      strategy_version: playbookVersion.strategyVersion,
    },
    preflight_algorithm: {
      name: STRATEGY_PREFLIGHT_ALGORITHM,
      version: M4_DECISION_INTEGRATION_V1_VERSION,
    },
  };
}

/**
 * Validates a public args object, then delegates the actual decision to the
 * existing DM-1 and M4 implementations. No policy is evaluated in this
 * adapter.
 */
export function executeStrategyPreflight(
  rawArgs: unknown,
): StrategyPreflightExecution {
  let validated: ReturnType<typeof validateStrategyPreflightArgs>;
  try {
    validated = validateStrategyPreflightArgs(rawArgs);
  } catch (error) {
    if (isValidationError(error)) {
      return failure(error.code, error.message);
    }
    return failure("INVALID_INPUT", "strategy_preflight input is invalid.");
  }

  let canonicalMarket: DecisionResult;
  try {
    canonicalMarket = evaluateDM1(validated.evidence);
  } catch (error) {
    return failure(
      "INTERNAL_EVALUATION_FAILURE",
      error instanceof Error
        ? error.message
        : "DM-1 evaluation failed unexpectedly.",
    );
  }

  if (!marketContextMatches(validated, canonicalMarket)) {
    return failure(
      "MARKET_CONTEXT_MISMATCH",
      "market_context decision, reason_codes, coverage or conflict do not match canonical DM-1 evaluation.",
    );
  }

  try {
    const integration = evaluatePreflight({
      marketResult: canonicalMarket,
      evidence: validated.evidence,
      playbookVersion: validated.playbookVersion,
      memorySummary: validated.memorySummary,
    });
    if (integration.ok !== true) {
      return failure(
        integration.code,
        integration.message,
        integration.playbookCode,
      );
    }
    return {
      ok: true,
      result: resultFrom(integration, validated.playbookVersion),
    };
  } catch (error) {
    return failure(
      "INTERNAL_EVALUATION_FAILURE",
      error instanceof Error
        ? error.message
        : "Preflight evaluation failed unexpectedly.",
    );
  }
}

function latencySince(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

export function createStrategyPreflightErrorResponse(
  errorCode: string,
  message: string,
  startedAt = Date.now(),
  playbookCode?: string,
): SkillCallResponse {
  return {
    name: STRATEGY_PREFLIGHT_NAME,
    status: "error",
    result: {
      error_code: errorCode,
      message,
      ...(playbookCode === undefined ? {} : { playbook_code: playbookCode }),
    },
    latency_ms: latencySince(startedAt),
    xp: 0,
    guard_decision: "BLOCK",
  };
}

function httpRequestError(
  rawRequest: unknown,
): { code: string; message: string } | null {
  if (!isRecord(rawRequest)) {
    return {
      code: "INVALID_REQUEST",
      message: "Skill call request must be an object.",
    };
  }
  const allowed = new Set(["name", "args", "conversation_id"]);
  const unsupported = Object.keys(rawRequest).find((key) => !allowed.has(key));
  if (unsupported !== undefined) {
    return {
      code: "INVALID_REQUEST",
      message: `Skill call request contains unsupported field "${unsupported}".`,
    };
  }
  if (rawRequest.name !== STRATEGY_PREFLIGHT_NAME) {
    return {
      code: "INVALID_REQUEST",
      message: `Skill call request name must be "${STRATEGY_PREFLIGHT_NAME}".`,
    };
  }
  if (!Object.prototype.hasOwnProperty.call(rawRequest, "args")) {
    return {
      code: "INVALID_REQUEST",
      message: "Skill call request.args is required.",
    };
  }
  if (
    typeof rawRequest.conversation_id !== "string" ||
    rawRequest.conversation_id.length === 0
  ) {
    return {
      code: "INVALID_REQUEST",
      message: "Skill call request.conversation_id must be a non-empty string.",
    };
  }
  return null;
}

function guardDecisionFor(status: StrategyPreflightResult["preflight_status"]): "ALLOW" | "BLOCK" {
  return status === "FIT" || status === "CAUTION" ? "ALLOW" : "BLOCK";
}

export function invokeStrategyPreflight(
  rawRequest: unknown,
  startedAt = Date.now(),
): SkillCallResponse {
  const requestError = httpRequestError(rawRequest);
  if (requestError !== null) {
    return createStrategyPreflightErrorResponse(
      requestError.code,
      requestError.message,
      startedAt,
    );
  }

  const request = rawRequest as SkillCallRequest;
  const execution = executeStrategyPreflight(request.args);
  if (execution.ok !== true) {
    return createStrategyPreflightErrorResponse(
      execution.failure.error_code,
      execution.failure.message,
      startedAt,
      execution.failure.playbook_code,
    );
  }

  return {
    name: STRATEGY_PREFLIGHT_NAME,
    status: "success",
    result: execution.result,
    latency_ms: latencySince(startedAt),
    xp: 0,
    guard_decision: guardDecisionFor(execution.result.preflight_status),
  };
}

export function responseHttpStatus(response: SkillCallResponse): number {
  if (response.status === "success") return 200;
  const result = response.result as StrategyPreflightFailure;
  return result.error_code === "INTERNAL_EVALUATION_FAILURE" ? 500 : 400;
}
