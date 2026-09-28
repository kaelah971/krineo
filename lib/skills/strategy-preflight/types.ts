import type {
  DecisionState,
  DirectionalEvidenceDimension,
  DirectionalEvidenceState,
  RegimeFitState,
  RiskState,
  SafetyState,
} from "../../evidence/types";
import type { MemorySummaryV1 } from "../../memory";
import type {
  Condition,
  ConditionResult,
  Effect,
  PlaybookVersion,
  RuleOutcome,
} from "../../playbook";
import type {
  DecisionSource,
  DecisionStatus,
} from "../../decision";
import type { ReasonCode } from "../../strategy/dm1/reason-codes";

export const STRATEGY_PREFLIGHT_NAME = "strategy_preflight" as const;
export const STRATEGY_PREFLIGHT_ALGORITHM = "evaluatePreflight" as const;

export type SkillCallStatus = "success" | "error";
export type SkillGuardDecision = "ALLOW" | "BLOCK";

export interface StrategyPreflightMarketContextInput {
  readonly decision: DecisionState;
  readonly reason_codes: readonly ReasonCode[];
  readonly evidence: Readonly<
    Record<DirectionalEvidenceDimension, DirectionalEvidenceState>
  >;
  readonly risk: RiskState;
  readonly safety: SafetyState;
  /** Public input name for the domain's DM-1 regimeFit state. */
  readonly regime: RegimeFitState;
  readonly coverage: number;
  readonly conflict: number | null;
}

export interface StrategyPreflightMemoryInput {
  readonly rankedCaseCount: number;
  readonly comparableCaseCount: number;
  readonly highSimilarityCaseCount: number;
}

export interface StrategyPreflightArgs {
  readonly market_context: StrategyPreflightMarketContextInput;
  readonly playbook: PlaybookVersion;
  readonly memory?: StrategyPreflightMemoryInput;
}

export interface StrategyPreflightRuleSummary {
  readonly rule_id: string;
  readonly effect: Effect;
  readonly outcome: RuleOutcome;
  readonly applied_effect: Effect | null;
}

export interface StrategyPreflightConditionDiagnostic {
  readonly rule_id: string;
  readonly condition: Condition;
  readonly result: ConditionResult;
  readonly observed_value: string | number | readonly string[] | readonly number[] | null;
  readonly diagnostics: readonly {
    readonly code: string;
    readonly message: string;
  }[];
}

export interface StrategyPreflightResult {
  readonly preflight_status: DecisionStatus;
  readonly original_market_decision: DecisionState;
  readonly effective_decision: DecisionState;
  readonly market_effect: Effect;
  readonly playbook_aggregate_effect: Effect;
  readonly winning_source: DecisionSource;
  readonly triggered_rules: readonly StrategyPreflightRuleSummary[];
  readonly unknown_rules: readonly StrategyPreflightRuleSummary[];
  readonly condition_diagnostics: readonly StrategyPreflightConditionDiagnostic[];
  readonly market_reason_codes: readonly ReasonCode[];
  readonly memory_summary_used: MemorySummaryV1 | null;
  readonly strategy_provenance: {
    readonly strategy_id: string;
    readonly strategy_version: string;
  };
  readonly playbook_provenance: {
    readonly playbook_id: string;
    readonly version_id: string;
    readonly version_number: number;
    readonly strategy_id: string;
    readonly strategy_version: string;
  };
  readonly preflight_algorithm: {
    readonly name: typeof STRATEGY_PREFLIGHT_ALGORITHM;
    readonly version: string;
  };
}

export interface StrategyPreflightFailure {
  readonly error_code: string;
  readonly message: string;
  readonly playbook_code?: string;
}

export interface SkillCallRequest {
  readonly name: string;
  readonly args: unknown;
  /** Correlation identifier; it does not affect deterministic evaluation. */
  readonly conversation_id: string;
}

export interface SkillCallResponse {
  readonly name: typeof STRATEGY_PREFLIGHT_NAME;
  readonly status: SkillCallStatus;
  readonly result: StrategyPreflightResult | StrategyPreflightFailure;
  readonly latency_ms: number;
  readonly xp: number;
  readonly guard_decision: SkillGuardDecision;
}

export interface StrategyPreflightDefinition {
  readonly name: typeof STRATEGY_PREFLIGHT_NAME;
  readonly description: string;
  readonly input_schema: Readonly<Record<string, unknown>>;
  readonly read_only: true;
}

export interface ValidatedStrategyPreflightInput {
  readonly evidence: {
    readonly evidence: Readonly<
      Record<DirectionalEvidenceDimension, DirectionalEvidenceState>
    >;
    readonly risk: RiskState;
    readonly safety: SafetyState;
    readonly regimeFit: RegimeFitState;
  };
  readonly suppliedDecision: DecisionState;
  readonly suppliedReasonCodes: readonly ReasonCode[];
  readonly suppliedCoverage: number;
  readonly suppliedConflict: number | null;
  readonly playbookVersion: PlaybookVersion;
  readonly memorySummary: MemorySummaryV1 | null;
}

export interface StrategyPreflightExecutionSuccess {
  readonly ok: true;
  readonly result: StrategyPreflightResult;
}

export interface StrategyPreflightExecutionFailure {
  readonly ok: false;
  readonly failure: StrategyPreflightFailure;
}

export type StrategyPreflightExecution =
  | StrategyPreflightExecutionSuccess
  | StrategyPreflightExecutionFailure;