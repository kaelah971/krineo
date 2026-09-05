import type { ReasonCode } from "../strategy/dm1/reason-codes";
import type {
  DirectionalEvidenceDimension,
  DirectionalEvidenceState,
  RegimeFitState,
  RiskState,
  SafetyState,
} from "../evidence/types";
import type {
  CandidateEvaluation,
  DM1EvidenceSnapshot,
} from "../strategy/dm1/types";

export const KILL_SWITCH_VERDICTS = {
  CLEAR: "CLEAR",
  CAUTION: "CAUTION",
  VETO: "VETO",
  UNKNOWN: "UNKNOWN",
} as const;

export type KillSwitchVerdict =
  (typeof KILL_SWITCH_VERDICTS)[keyof typeof KILL_SWITCH_VERDICTS];

export const KILL_SWITCH_CHALLENGE_TYPES = {
  DIRECTION_CONTRADICTION: "DIRECTION_CONTRADICTION",
  SINGLE_SOURCE_FRAGILITY: "SINGLE_SOURCE_FRAGILITY",
  REGIME_CONFLICT: "REGIME_CONFLICT",
  RELATIVE_OPPORTUNITY_FAILURE: "RELATIVE_OPPORTUNITY_FAILURE",
  RISK_INCOMPATIBILITY: "RISK_INCOMPATIBILITY",
  SAFETY_FAILURE: "SAFETY_FAILURE",
  NARRATIVE_DISTORTION: "NARRATIVE_DISTORTION",
  MISSING_CRITICAL_EVIDENCE: "MISSING_CRITICAL_EVIDENCE",
} as const;

export type KillSwitchChallengeType =
  (typeof KILL_SWITCH_CHALLENGE_TYPES)[keyof typeof KILL_SWITCH_CHALLENGE_TYPES];

export const KILL_SWITCH_EFFECTS = {
  NONE: "NONE",
  CAUTION: "CAUTION",
  RECOMPUTE: "RECOMPUTE",
  VETO: "VETO",
} as const;

export type KillSwitchEffect =
  (typeof KILL_SWITCH_EFFECTS)[keyof typeof KILL_SWITCH_EFFECTS];

export const KILL_SWITCH_SEVERITIES = {
  NONE: "NONE",
  LOW: "LOW",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type KillSwitchSeverity =
  (typeof KILL_SWITCH_SEVERITIES)[keyof typeof KILL_SWITCH_SEVERITIES];

export const KILL_SWITCH_CREATORS = {
  MODEL: "MODEL",
  HUMAN: "HUMAN",
} as const;

export type KillSwitchCreator =
  (typeof KILL_SWITCH_CREATORS)[keyof typeof KILL_SWITCH_CREATORS];

export const KILL_SWITCH_EVIDENCE_KINDS = {
  DIRECTIONAL: "DIRECTIONAL",
  RISK: "RISK",
  SAFETY: "SAFETY",
  REGIME_FIT: "REGIME_FIT",
} as const;

export type KillSwitchEvidenceKind =
  (typeof KILL_SWITCH_EVIDENCE_KINDS)[keyof typeof KILL_SWITCH_EVIDENCE_KINDS];

export type KillSwitchReasonCode =
  | "CHALLENGE_SUPPORTED"
  | "CHALLENGE_NOT_SUPPORTED"
  | "CHALLENGE_EVIDENCE_UNAVAILABLE"
  | "CHALLENGE_EVIDENCE_UNKNOWN"
  | "CHALLENGE_CANDIDATE_UNAVAILABLE"
  | "UNSUPPORTED_CHALLENGE_TYPE"
  | "DIRECTION_CONTRADICTION_FOUND"
  | "SINGLE_SOURCE_FRAGILITY_FOUND"
  | "REGIME_CONFLICT_FOUND"
  | "RELATIVE_OPPORTUNITY_FAILURE_FOUND"
  | "RISK_INCOMPATIBLE"
  | "SAFETY_FAILURE_FOUND"
  | "MISSING_CRITICAL_EVIDENCE"
  | "RECOMPUTATION_REQUIRED";

export type KillSwitchEvidenceState =
  | DirectionalEvidenceState
  | RiskState
  | SafetyState
  | RegimeFitState;

export interface StructuredChallenge {
  id: string;
  challengeType: KillSwitchChallengeType;
  claim: string;
  evidenceIds: readonly string[];
  candidateIds?: readonly string[];
  assets?: readonly string[];
  createdBy: KillSwitchCreator;
}

export type KillSwitchEvidenceItem =
  | {
      id: string;
      kind: "DIRECTIONAL";
      dimension: DirectionalEvidenceDimension;
      state: DirectionalEvidenceState;
      source: string;
      candidateAsset?: string;
    }
  | {
      id: string;
      kind: "RISK";
      state: RiskState;
      source: string;
      candidateAsset?: string;
    }
  | {
      id: string;
      kind: "SAFETY";
      state: SafetyState;
      source: string;
      candidateAsset?: string;
    }
  | {
      id: string;
      kind: "REGIME_FIT";
      state: RegimeFitState;
      source: string;
      candidateAsset?: string;
    };

export interface KillSwitchEvidenceSnapshot {
  dm1: DM1EvidenceSnapshot;
  items: readonly KillSwitchEvidenceItem[];
}

export type EvidenceSnapshot = KillSwitchEvidenceSnapshot;

export interface KillSwitchComparisonCandidate {
  id: string;
  evaluation: CandidateEvaluation;
}

export interface KillSwitchComparisonState {
  available: boolean;
  selectedCandidateId: string | null;
  candidates: readonly KillSwitchComparisonCandidate[];
}

export interface KillSwitchDecisionState {
  provisional: CandidateEvaluation;
  final: CandidateEvaluation | null;
}

export interface KillSwitchValidationInput {
  decision: KillSwitchDecisionState;
  evidence: KillSwitchEvidenceSnapshot;
  comparison: KillSwitchComparisonState;
  challenge: StructuredChallenge;
}

export interface KillSwitchValidationResult {
  challengeId: string;
  challengeType: string;
  verdict: KillSwitchVerdict;
  severity: KillSwitchSeverity;
  effect: KillSwitchEffect;
  validatedEvidenceIds: readonly string[];
  missingEvidenceIds: readonly string[];
  validatedCandidateIds: readonly string[];
  reasonCodes: readonly KillSwitchReasonCode[];
  diagnostics: readonly string[];
}

export interface KillSwitchAggregateResult {
  verdict: KillSwitchVerdict;
  severity: KillSwitchSeverity;
  effect: KillSwitchEffect;
  results: readonly KillSwitchValidationResult[];
  reasonCodes: readonly KillSwitchReasonCode[];
  diagnostics: readonly string[];
}

export interface KillSwitchAssessment {
  verdict: KillSwitchVerdict;
  reasonCodes: readonly ReasonCode[];
}
