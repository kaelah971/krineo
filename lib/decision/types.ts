import type {
  DirectionalEvidenceState,
  DecisionState,
} from "../evidence/types";
import type { MemorySnapshot, MemorySummaryV1 } from "../memory";
import type {
  Effect,
  EvaluationContext,
  PlaybookRejection,
  PlaybookVersion,
  VersionEvaluation,
} from "../playbook";
import type { DM1EvidenceSnapshot, DecisionResult } from "../strategy/dm1/types";
import type { ReasonCode } from "../strategy/dm1/reason-codes";

export const DECISION_INTEGRATION_V1_VERSION = "decision-integration-v1" as const;
export const M4_DECISION_INTEGRATION_V1_VERSION =
  DECISION_INTEGRATION_V1_VERSION;

export type DecisionIntegrationVersion =
  typeof DECISION_INTEGRATION_V1_VERSION;

export const DECISION_STATUSES = {
  FIT: "FIT",
  CAUTION: "CAUTION",
  WAIT: "WAIT",
  BLOCK: "BLOCK",
} as const;

export type DecisionStatus =
  (typeof DECISION_STATUSES)[keyof typeof DECISION_STATUSES];

export const DECISION_SOURCES = {
  MARKET: "MARKET",
  PLAYBOOK: "PLAYBOOK",
  BOTH: "BOTH",
} as const;

export type DecisionSource =
  (typeof DECISION_SOURCES)[keyof typeof DECISION_SOURCES];

export const DECISION_DIAGNOSTIC_SOURCES = {
  MARKET: "MARKET",
  MEMORY: "MEMORY",
  PLAYBOOK: "PLAYBOOK",
  DECISION: "DECISION",
} as const;

export type DecisionDiagnosticSource =
  (typeof DECISION_DIAGNOSTIC_SOURCES)[keyof typeof DECISION_DIAGNOSTIC_SOURCES];

export interface DecisionDiagnostic {
  readonly source: DecisionDiagnosticSource;
  readonly code: string;
  readonly message: string;
  readonly reasonCode?: ReasonCode;
  readonly effect?: Effect;
  readonly ruleId?: string;
  readonly outcome?: string;
  readonly rankedCaseCount?: number;
  readonly comparableCaseCount?: number;
  readonly highSimilarityCaseCount?: number;
  readonly marketEffect?: Effect;
  readonly playbookEffect?: Effect;
  readonly winningSource?: DecisionSource;
  readonly effectiveDecision?: DecisionState;
  readonly status?: DecisionStatus;
}

export interface DecisionIntegrationInput {
  readonly marketResult: DecisionResult;
  readonly evidence: DM1EvidenceSnapshot;
  readonly playbookVersion: PlaybookVersion;
  readonly memorySnapshot?: MemorySnapshot | null;
  /** A precomputed summary is accepted for callers that already crossed the memory boundary. */
  readonly memorySummary?: MemorySummaryV1 | null;
}

export interface DecisionIntegrationSuccess {
  readonly ok: true;
  readonly contractVersion: DecisionIntegrationVersion;
  readonly status: DecisionStatus;
  readonly effect: Effect;
  readonly marketDecision: DecisionState;
  readonly effectiveDecision: DecisionState;
  readonly marketEffect: Effect;
  readonly playbookEffect: Effect;
  readonly winningSource: DecisionSource;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly playbookVersionId: string;
  readonly marketResult: DecisionResult;
  readonly playbookEvaluation: VersionEvaluation;
  readonly memorySummary: MemorySummaryV1 | null;
  readonly diagnostics: readonly DecisionDiagnostic[];
}

export const DECISION_INTEGRATION_REJECTION_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  STRATEGY_MISMATCH: "STRATEGY_MISMATCH",
  EVIDENCE_RESULT_MISMATCH: "EVIDENCE_RESULT_MISMATCH",
  INVALID_MEMORY_TARGET_SIGNATURE: "INVALID_MEMORY_TARGET_SIGNATURE",
  PLAYBOOK_EVALUATION_REJECTED: "PLAYBOOK_EVALUATION_REJECTED",
} as const;

export type DecisionIntegrationRejectionCode =
  (typeof DECISION_INTEGRATION_REJECTION_CODES)[keyof typeof DECISION_INTEGRATION_REJECTION_CODES];

export interface DecisionIntegrationRejection {
  readonly ok: false;
  readonly code: DecisionIntegrationRejectionCode;
  readonly message: string;
  readonly playbookCode: PlaybookRejection["code"] | undefined;
}

export type DecisionIntegrationResult =
  | DecisionIntegrationSuccess
  | DecisionIntegrationRejection;

export interface BuiltEvaluationContext {
  readonly context: EvaluationContext;
  readonly memorySummary: MemorySummaryV1 | null;
}

export type CanonicalDirectionalEvidence = Readonly<
  Record<
    "DIRECTIONAL_MOMENTUM" |
      "TECHNICAL_CONFLUENCE" |
      "RELATIVE_OPPORTUNITY" |
      "MARKET_ALIGNMENT" |
      "SENTIMENT_DERIVATIVES",
    DirectionalEvidenceState
  >
>;

export interface DecisionContextInput {
  readonly marketResult: DecisionResult;
  readonly evidence: DM1EvidenceSnapshot;
  readonly memorySummary?: MemorySummaryV1 | null;
}
