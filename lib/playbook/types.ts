import type {
  ConflictLabel,
  CoverageLabel,
  DecisionState,
  DirectionalEvidenceDimension,
  DirectionalEvidenceState,
  RegimeFitState,
  RiskState,
  SafetyState,
} from "../evidence/types";
import type { ReasonCode } from "../strategy/dm1/reason-codes";

export const PLAYBOOK_ACTORS = {
  HUMAN: "HUMAN",
  SYSTEM: "SYSTEM",
  MODEL: "MODEL",
} as const;
export type PlaybookActor =
  (typeof PLAYBOOK_ACTORS)[keyof typeof PLAYBOOK_ACTORS];
export const PROPOSAL_STATUSES = { PENDING: "PENDING", APPROVED: "APPROVED", REJECTED: "REJECTED" } as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[keyof typeof PROPOSAL_STATUSES];
export const PLAYBOOK_EFFECTS = { PASS: "PASS", CAUTION: "CAUTION", WAIT: "WAIT", BLOCK: "BLOCK" } as const;
export type Effect = (typeof PLAYBOOK_EFFECTS)[keyof typeof PLAYBOOK_EFFECTS];
export const EFFECT_PRECEDENCE = [PLAYBOOK_EFFECTS.BLOCK, PLAYBOOK_EFFECTS.WAIT, PLAYBOOK_EFFECTS.CAUTION, PLAYBOOK_EFFECTS.PASS] as const satisfies readonly Effect[];
export const CONDITION_OPERATORS = { EQUALS: "EQUALS", NOT_EQUALS: "NOT_EQUALS", IN: "IN", GTE: "GTE", LTE: "LTE" } as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[keyof typeof CONDITION_OPERATORS];
export const CONDITION_RESULTS = { MATCH: "MATCH", NO_MATCH: "NO_MATCH", UNKNOWN: "UNKNOWN" } as const;
export type ConditionResult = (typeof CONDITION_RESULTS)[keyof typeof CONDITION_RESULTS];
export const RULE_OUTCOMES = { TRIGGERED: "TRIGGERED", NOT_TRIGGERED: "NOT_TRIGGERED", UNKNOWN: "UNKNOWN" } as const;
export type RuleOutcome = (typeof RULE_OUTCOMES)[keyof typeof RULE_OUTCOMES];

export const PLAYBOOK_REJECTION_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_PLAYBOOK: "INVALID_PLAYBOOK",
  INVALID_VERSION: "INVALID_VERSION",
  INVALID_RULE: "INVALID_RULE",
  INVALID_CONDITION: "INVALID_CONDITION",
  INVALID_CONTEXT: "INVALID_CONTEXT",
  UNKNOWN_CONDITION_FIELD: "UNKNOWN_CONDITION_FIELD",
  UNKNOWN_DIRECTIONAL_DIMENSION: "UNKNOWN_DIRECTIONAL_DIMENSION",
  UNSUPPORTED_OPERATOR: "UNSUPPORTED_OPERATOR",
  CONDITION_VALUE_TYPE_MISMATCH: "CONDITION_VALUE_TYPE_MISMATCH",
  EMPTY_IN_SET: "EMPTY_IN_SET",
  DUPLICATE_IN_SET_VALUE: "DUPLICATE_IN_SET_VALUE",
  NON_FINITE_NUMBER: "NON_FINITE_NUMBER",
  OUT_OF_RANGE_NUMBER: "OUT_OF_RANGE_NUMBER",
  DUPLICATE_RULE_ID: "DUPLICATE_RULE_ID",
  DUPLICATE_CONDITION: "DUPLICATE_CONDITION",
  EMPTY_RULE_CONDITIONS: "EMPTY_RULE_CONDITIONS",
  INVALID_HISTORY: "INVALID_HISTORY",
  VERSION_ID_ALREADY_EXISTS: "VERSION_ID_ALREADY_EXISTS",
  STALE_PARENT: "STALE_PARENT",
  PROPOSAL_NOT_PENDING: "PROPOSAL_NOT_PENDING",
  MODEL_NOT_AUTHORIZED: "MODEL_NOT_AUTHORIZED",
  SYSTEM_NOT_AUTHORIZED: "SYSTEM_NOT_AUTHORIZED",
  INVALID_TIMESTAMP: "INVALID_TIMESTAMP",
  INVALID_TIMESTAMP_ORDER: "INVALID_TIMESTAMP_ORDER",
} as const;

export type PlaybookRejectionCode =
  (typeof PLAYBOOK_REJECTION_CODES)[keyof typeof PLAYBOOK_REJECTION_CODES];

export interface PlaybookRejection {
  readonly ok: false;
  readonly code: PlaybookRejectionCode;
  readonly message: string;
}

export interface ConditionScalarByField {
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly decision: DecisionState;
  readonly DIRECTIONAL_MOMENTUM: DirectionalEvidenceState;
  readonly TECHNICAL_CONFLUENCE: DirectionalEvidenceState;
  readonly RELATIVE_OPPORTUNITY: DirectionalEvidenceState;
  readonly MARKET_ALIGNMENT: DirectionalEvidenceState;
  readonly SENTIMENT_DERIVATIVES: DirectionalEvidenceState;
  readonly risk: RiskState;
  readonly safety: SafetyState;
  readonly regimeFit: RegimeFitState;
  readonly coverage: number;
  readonly conflict: number;
  readonly reasonCode: ReasonCode;
  readonly "memory.rankedCaseCount": number;
  readonly "memory.comparableCaseCount": number;
  readonly "memory.highSimilarityCaseCount": number;
}

export type ConditionField = keyof ConditionScalarByField;

export const CONDITION_FIELD_ORDER: readonly ConditionField[] = [
  "strategyId",
  "strategyVersion",
  "decision",
  "DIRECTIONAL_MOMENTUM",
  "TECHNICAL_CONFLUENCE",
  "RELATIVE_OPPORTUNITY",
  "MARKET_ALIGNMENT",
  "SENTIMENT_DERIVATIVES",
  "risk",
  "safety",
  "regimeFit",
  "coverage",
  "conflict",
  "reasonCode",
  "memory.rankedCaseCount",
  "memory.comparableCaseCount",
  "memory.highSimilarityCaseCount",
];

export type NumericConditionField =
  | "coverage"
  | "conflict"
  | "memory.rankedCaseCount"
  | "memory.comparableCaseCount"
  | "memory.highSimilarityCaseCount";

export const NUMERIC_CONDITION_FIELDS: readonly NumericConditionField[] = [
  "coverage",
  "conflict",
  "memory.rankedCaseCount",
  "memory.comparableCaseCount",
  "memory.highSimilarityCaseCount",
];

export const CONDITION_OPERATOR_ORDER: readonly ConditionOperator[] = [
  CONDITION_OPERATORS.EQUALS,
  CONDITION_OPERATORS.NOT_EQUALS,
  CONDITION_OPERATORS.IN,
  CONDITION_OPERATORS.GTE,
  CONDITION_OPERATORS.LTE,
];

export type EqualityConditionOperator =
  | typeof CONDITION_OPERATORS.EQUALS
  | typeof CONDITION_OPERATORS.NOT_EQUALS;

export type EqualityCondition = {
  [F in ConditionField]: {
    readonly field: F;
    readonly operator: EqualityConditionOperator;
    readonly value: ConditionScalarByField[F];
  };
}[ConditionField];

export type InCondition = {
  [F in ConditionField]: {
    readonly field: F;
    readonly operator: typeof CONDITION_OPERATORS.IN;
    readonly values: readonly ConditionScalarByField[F][];
  };
}[ConditionField];

export type NumericComparisonCondition = {
  [F in NumericConditionField]: {
    readonly field: F;
    readonly operator:
      | typeof CONDITION_OPERATORS.GTE
      | typeof CONDITION_OPERATORS.LTE;
    readonly value: number;
  };
}[NumericConditionField];

export type Condition =
  | EqualityCondition
  | InCondition
  | NumericComparisonCondition;

export interface PlaybookRule {
  readonly id: string;
  readonly effect: Effect;
  readonly conditions: readonly Condition[];
}

export interface MemoryDerivedCounts {
  readonly rankedCaseCount?: number;
  readonly comparableCaseCount?: number;
  readonly highSimilarityCaseCount?: number;
}

export interface EvaluationContext {
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly decision: DecisionState;
  readonly evidence: Record<
    DirectionalEvidenceDimension,
    DirectionalEvidenceState
  >;
  readonly risk: RiskState;
  readonly safety: SafetyState;
  readonly regimeFit: RegimeFitState;
  readonly coverage: number | null;
  readonly coverageLabel: CoverageLabel;
  readonly conflict: number | null;
  readonly conflictLabel: ConflictLabel;
  readonly reasonCodes: readonly ReasonCode[];
  readonly memory?: MemoryDerivedCounts;
}

export interface Playbook {
  readonly id: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly currentVersionId: string;
  readonly currentVersionNumber: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlaybookVersion {
  readonly id: string;
  readonly playbookId: string;
  readonly versionNumber: number;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly rules: readonly PlaybookRule[];
  readonly createdAt: string;
  readonly approvedAt: string;
  readonly approvedBy: typeof PLAYBOOK_ACTORS.HUMAN;
  readonly sourceProposalId?: string;
  readonly sourceProposalCreator?: PlaybookActor;
}

export interface Proposal {
  readonly id: string;
  readonly playbookId: string;
  readonly proposedVersionId: string;
  readonly parentVersionId: string;
  readonly parentVersionNumber: number;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly rules: readonly PlaybookRule[];
  readonly createdBy: PlaybookActor;
  readonly createdAt: string;
  readonly status: ProposalStatus;
  readonly resolvedAt?: string;
  readonly resolvedBy?: PlaybookActor;
  readonly rejectionReason?: string;
}

export interface CreateInitialVersionInput {
  readonly playbookId: string;
  readonly versionId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly rules: readonly PlaybookRule[];
  readonly createdAt: string;
  readonly approvedAt: string;
  readonly approvedBy: PlaybookActor;
  readonly sourceProposalId?: string;
}

export interface CreateInitialVersionSuccess {
  readonly ok: true;
  readonly playbook: Playbook;
  readonly version: PlaybookVersion;
}

export type CreateInitialVersionResult =
  | CreateInitialVersionSuccess
  | PlaybookRejection;

export interface CreateProposalInput {
  readonly proposalId: string;
  readonly playbookId: string;
  readonly proposedVersionId: string;
  readonly parentVersionId: string;
  readonly parentVersionNumber: number;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly rules: readonly PlaybookRule[];
  readonly createdBy: PlaybookActor;
  readonly createdAt: string;
}

export interface CreateProposalSuccess {
  readonly ok: true;
  readonly proposal: Proposal;
}

export type CreateProposalResult = CreateProposalSuccess | PlaybookRejection;

export interface ApproveProposalInput {
  readonly playbook: Playbook;
  readonly versions: readonly PlaybookVersion[];
  readonly proposal: Proposal;
  readonly approvedAt: string;
  readonly approvedBy: PlaybookActor;
}

export interface ApproveProposalSuccess {
  readonly ok: true;
  readonly playbook: Playbook;
  readonly version: PlaybookVersion;
  readonly proposal: Proposal;
  readonly versions: readonly PlaybookVersion[];
}

export type ApproveProposalResult = ApproveProposalSuccess | PlaybookRejection;

export interface RejectProposalInput {
  readonly proposal: Proposal;
  readonly rejectedAt: string;
  readonly resolvedBy: PlaybookActor;
  readonly rejectionReason: string;
}

export interface RejectProposalSuccess {
  readonly ok: true;
  readonly proposal: Proposal;
}

export type RejectProposalResult = RejectProposalSuccess | PlaybookRejection;

export interface ValidateHistoryInput {
  readonly playbook: Playbook;
  readonly versions: readonly PlaybookVersion[];
  readonly proposals?: readonly Proposal[];
}

export interface ValidateHistorySuccess {
  readonly ok: true;
}

export type ValidateHistoryResult = ValidateHistorySuccess | PlaybookRejection;

export const DIAGNOSTIC_CODES = {
  CONDITION_MATCH: "CONDITION_MATCH",
  CONDITION_NO_MATCH: "CONDITION_NO_MATCH",
  CONDITION_UNKNOWN: "CONDITION_UNKNOWN",
} as const;

export type DiagnosticCode =
  (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES];

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly message: string;
}

export type Diagnostics = readonly Diagnostic[];

export type ConditionObservedValue =
  | string
  | number
  | readonly string[]
  | readonly number[]
  | null;

export interface ConditionEvaluation {
  readonly condition: Condition;
  readonly result: ConditionResult;
  readonly observedValue: ConditionObservedValue;
  readonly diagnostics: Diagnostics;
}

export interface RuleEvaluation {
  readonly rule: PlaybookRule;
  readonly outcome: RuleOutcome;
  readonly appliedEffect: Effect | null;
  readonly conditionEvaluations: readonly ConditionEvaluation[];
  readonly diagnostics: Diagnostics;
}

export interface RuleEvaluationSuccess {
  readonly ok: true;
  readonly evaluation: RuleEvaluation;
}

export type EvaluateRuleResult = RuleEvaluationSuccess | PlaybookRejection;

export interface VersionEvaluation {
  readonly versionId: string;
  readonly aggregateEffect: Effect;
  readonly ruleEvaluations: readonly RuleEvaluation[];
  readonly diagnostics: Diagnostics;
}

export interface VersionEvaluationSuccess {
  readonly ok: true;
  readonly evaluation: VersionEvaluation;
}

export type EvaluateVersionResult =
  | VersionEvaluationSuccess
  | PlaybookRejection;
