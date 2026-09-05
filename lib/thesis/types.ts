import type {
  CoverageLabel,
  ConflictLabel,
  DecisionState,
  DirectionalEvidenceDimension,
  DirectionalEvidenceState,
  RegimeFitState,
  RiskState,
  SafetyState,
} from "../evidence/types";
import type { EvidenceItem } from "../evidence/types";
import type {
  KillSwitchAggregateResult,
  KillSwitchEffect,
  KillSwitchReasonCode,
  KillSwitchSeverity,
  KillSwitchVerdict,
} from "../killswitch/types";
import type {
  CandidateEvaluation,
  DecisionResult,
} from "../strategy/dm1/types";
import type { ReasonCode, WarningCode } from "../strategy/dm1/reason-codes";

export const THESIS_LIFECYCLE_STATES = {
  ACTIVE: "ACTIVE",
  WEAKENED: "WEAKENED",
  INVALIDATED: "INVALIDATED",
  CLOSED: "CLOSED",
  ABSTAINED: "ABSTAINED",
} as const;

export type ThesisLifecycleState =
  (typeof THESIS_LIFECYCLE_STATES)[keyof typeof THESIS_LIFECYCLE_STATES];

export interface Thesis {
  readonly id: string;
  readonly asset: string;
  readonly currentVersionId: string;
  readonly currentVersionNumber: number;
  readonly status: ThesisLifecycleState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ThesisVersion {
  readonly id: string;
  readonly thesisId: string;
  readonly versionNumber: number;
  readonly asset: string;
  // Historical receipts must use this snapshot, not mutable Thesis.status.
  readonly statusAtCommit: ThesisLifecycleState;
  readonly evidenceSnapshotId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly decision: DecisionState;
  readonly directionalScore: number;
  readonly thesisStrength: number | null;
  readonly coverage: number;
  readonly coverageLabel: CoverageLabel;
  readonly conflict: number | null;
  readonly conflictLabel: ConflictLabel | null;
  readonly risk: RiskState;
  readonly safety: SafetyState;
  readonly regimeFit: RegimeFitState;
  readonly reasonCodes: readonly ReasonCode[];
  readonly warningCodes: readonly WarningCode[];
  readonly killSwitchVerdict?: KillSwitchVerdict;
  readonly killSwitchRunId?: string;
  readonly createdAt: string;
}

export interface ThesisCommitInput {
  readonly thesisId: string;
  readonly versionId: string;
  readonly createdAt: string;
  readonly asset: string;
  readonly evidenceSnapshotId: string;
  readonly decision: DecisionResult;
  readonly killSwitch?: KillSwitchAggregateResult;
  readonly killSwitchRunId?: string;
}

export interface AppendThesisVersionInput extends ThesisCommitInput {
  readonly thesis: Thesis;
  readonly versions: readonly ThesisVersion[];
}

export const THESIS_REJECTION_CODES = {
  KILLSWITCH_REQUIRED: "KILLSWITCH_REQUIRED",
  KILLSWITCH_VETO: "KILLSWITCH_VETO",
  KILLSWITCH_UNKNOWN: "KILLSWITCH_UNKNOWN",
  THESIS_CLOSED: "THESIS_CLOSED",
  THESIS_INVALIDATED: "THESIS_INVALIDATED",
  ASSET_MISMATCH: "ASSET_MISMATCH",
  THESIS_ID_MISMATCH: "THESIS_ID_MISMATCH",
  INVALID_VERSION_HISTORY: "INVALID_VERSION_HISTORY",
  VERSION_ID_ALREADY_EXISTS: "VERSION_ID_ALREADY_EXISTS",
  INVALID_COMMIT_INPUT: "INVALID_COMMIT_INPUT",
} as const;

export type ThesisRejectionCode =
  (typeof THESIS_REJECTION_CODES)[keyof typeof THESIS_REJECTION_CODES];

export interface ThesisRejection {
  readonly ok: false;
  readonly code: ThesisRejectionCode;
  readonly message: string;
}

export interface CreateThesisSuccess {
  readonly ok: true;
  readonly thesis: Thesis;
  readonly version: ThesisVersion;
}

export type CreateThesisResult = CreateThesisSuccess | ThesisRejection;

export interface AppendThesisVersionSuccess {
  readonly ok: true;
  readonly thesis: Thesis;
  readonly version: ThesisVersion;
  readonly versions: readonly ThesisVersion[];
}

export type AppendThesisVersionResult =
  | AppendThesisVersionSuccess
  | ThesisRejection;

export const RECEIPT_SCHEMA_VERSION = "1.0.0";

export const RECEIPT_MODES = {
  CURRENT: "CURRENT",
  HISTORICAL: "HISTORICAL",
} as const;

export type ReceiptMode = (typeof RECEIPT_MODES)[keyof typeof RECEIPT_MODES];

export const INVALIDATION_RULE_TYPES = {
  DIRECTION_LOSS: "DIRECTION_LOSS",
  DIRECTION_REVERSAL: "DIRECTION_REVERSAL",
  REGIME_BREAK: "REGIME_BREAK",
  SAFETY_VETO: "SAFETY_VETO",
  CRITICAL_EVIDENCE_LOSS: "CRITICAL_EVIDENCE_LOSS",
  RISK_LIMIT_BREACH: "RISK_LIMIT_BREACH",
} as const;

export type InvalidationRuleType =
  (typeof INVALIDATION_RULE_TYPES)[keyof typeof INVALIDATION_RULE_TYPES];

export const INVALIDATION_RULE_TYPE_ORDER = [
  INVALIDATION_RULE_TYPES.DIRECTION_LOSS,
  INVALIDATION_RULE_TYPES.DIRECTION_REVERSAL,
  INVALIDATION_RULE_TYPES.REGIME_BREAK,
  INVALIDATION_RULE_TYPES.SAFETY_VETO,
  INVALIDATION_RULE_TYPES.CRITICAL_EVIDENCE_LOSS,
  INVALIDATION_RULE_TYPES.RISK_LIMIT_BREACH,
] as const satisfies readonly InvalidationRuleType[];

export const INVALIDATION_RULE_EFFECTS = {
  WEAKEN: "WEAKEN",
  INVALIDATE: "INVALIDATE",
  CLOSE: "CLOSE",
} as const;

export type InvalidationRuleEffect =
  (typeof INVALIDATION_RULE_EFFECTS)[keyof typeof INVALIDATION_RULE_EFFECTS];

export type DirectionalThesisDecision = Exclude<DecisionState, "ABSTAIN">;

export type InvalidationConditionValue =
  | string
  | number
  | boolean
  | null
  | readonly string[];

export interface InvalidationCondition {
  readonly field: string;
  readonly operator: string;
  readonly value: InvalidationConditionValue;
  readonly parameters?: Readonly<
    Record<string, InvalidationConditionValue>
  >;
}

export interface InvalidationRule {
  readonly id: string;
  readonly ruleType: InvalidationRuleType;
  readonly effect: InvalidationRuleEffect;
  readonly condition: InvalidationCondition;
  readonly strategyId?: string;
  readonly strategyVersion?: string;
  readonly direction?: DirectionalThesisDecision;
  readonly description?: string;
}

export interface ReceiptEvidenceSummary {
  readonly id: string;
  readonly dimension: DirectionalEvidenceDimension;
  readonly state: DirectionalEvidenceState;
  readonly source: string;
  readonly observedAt: string;
  readonly reasonCode: ReasonCode;
}

export interface ReceiptCandidateSummary {
  readonly rank: number;
  readonly asset: string;
  readonly decision: DecisionState;
  readonly directionalScore: number;
  readonly thesisStrength: number | null;
  readonly coverage: number;
  readonly coverageLabel: CoverageLabel;
  readonly conflict: number | null;
  readonly conflictLabel: ConflictLabel | null;
  readonly risk: RiskState;
  readonly safety: SafetyState;
  readonly regimeFit: RegimeFitState;
  readonly selected: boolean;
  readonly reasonCodes: readonly ReasonCode[];
  readonly warningCodes: readonly WarningCode[];
}

export interface ReceiptChallengeSummary {
  readonly challengeId: string;
  readonly challengeType: string;
  readonly verdict: KillSwitchVerdict;
  readonly severity: KillSwitchSeverity;
  readonly effect: KillSwitchEffect;
  readonly validatedEvidenceIds: readonly string[];
  readonly reasonCodes: readonly KillSwitchReasonCode[];
}

export interface ReceiptKillSwitchState {
  readonly verdict: KillSwitchVerdict;
  readonly runId?: string;
  readonly reasonCodes: readonly KillSwitchReasonCode[];
  readonly challenges: readonly ReceiptChallengeSummary[];
}

export interface ThesisReceiptCanonicalPayload {
  readonly receiptSchemaVersion: string;
  readonly thesisId: string;
  readonly thesisVersionId: string;
  readonly versionNumber: number;
  readonly asset: string;
  readonly statusAtCommit: ThesisLifecycleState;
  readonly decision: DecisionState;
  readonly directionalScore: number;
  readonly thesisStrength: number | null;
  readonly coverage: number;
  readonly coverageLabel: CoverageLabel;
  readonly conflict: number | null;
  readonly conflictLabel: ConflictLabel | null;
  readonly risk: RiskState;
  readonly safety: SafetyState;
  readonly regimeFit: RegimeFitState;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly normalizerVersion: string;
  readonly evidenceSnapshotId: string;
  readonly supportingEvidence: readonly ReceiptEvidenceSummary[];
  readonly contradictingEvidence: readonly ReceiptEvidenceSummary[];
  readonly neutralEvidence: readonly ReceiptEvidenceSummary[];
  readonly availableEvidence: readonly ReceiptEvidenceSummary[];
  readonly unknownEvidence: readonly ReceiptEvidenceSummary[];
  readonly candidateRanking: readonly ReceiptCandidateSummary[];
  readonly killSwitch: ReceiptKillSwitchState | null;
  readonly invalidationRules: readonly InvalidationRule[];
  readonly reasonCodes: readonly ReasonCode[];
  readonly warningCodes: readonly WarningCode[];
  readonly createdAt: string;
}

export interface ThesisReceipt extends ThesisReceiptCanonicalPayload {
  // Artifact identity is public but intentionally excluded from the hash.
  readonly id: string;
  readonly canonicalHash: string;
}

export interface ThesisReceiptInput {
  readonly thesis: Thesis;
  readonly version: ThesisVersion;
  readonly receiptId: string;
  readonly normalizerVersion: string;
  readonly evidenceItems: readonly EvidenceItem[];
  readonly candidateEvaluations: readonly CandidateEvaluation[];
  readonly killSwitch?: KillSwitchAggregateResult;
  readonly killSwitchRunId?: string;
  readonly invalidationRules: readonly InvalidationRule[];
  readonly receiptMode?: ReceiptMode;
  readonly explanation?: string;
}

export const THESIS_RECEIPT_REJECTION_CODES = {
  INVALID_RECEIPT_INPUT: "INVALID_RECEIPT_INPUT",
  THESIS_ID_MISMATCH: "THESIS_ID_MISMATCH",
  ASSET_MISMATCH: "ASSET_MISMATCH",
  VERSION_NOT_CURRENT: "VERSION_NOT_CURRENT",
  INVALID_VERSION: "INVALID_VERSION",
  KILLSWITCH_MISMATCH: "KILLSWITCH_MISMATCH",
  KILLSWITCH_MISSING: "KILLSWITCH_MISSING",
  INVALID_NUMERIC_STATE: "INVALID_NUMERIC_STATE",
  INVALID_EVIDENCE: "INVALID_EVIDENCE",
  INVALID_CANDIDATE_RANKING: "INVALID_CANDIDATE_RANKING",
  INVALID_INVALIDATION_RULE: "INVALID_INVALIDATION_RULE",
} as const;

export type ThesisReceiptRejectionCode =
  (typeof THESIS_RECEIPT_REJECTION_CODES)[keyof typeof THESIS_RECEIPT_REJECTION_CODES];

export interface ThesisReceiptRejection {
  readonly ok: false;
  readonly code: ThesisReceiptRejectionCode;
  readonly message: string;
}

export interface ThesisReceiptSuccess {
  readonly ok: true;
  readonly receipt: ThesisReceipt;
  readonly canonicalPayload: ThesisReceiptCanonicalPayload;
  readonly canonicalSerialized: string;
}

export type ThesisReceiptResult =
  | ThesisReceiptSuccess
  | ThesisReceiptRejection;
