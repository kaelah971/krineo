import type { ReasonCode } from "../strategy/dm1/reason-codes";

export const DIRECTIONAL_EVIDENCE_DIMENSIONS = {
  DIRECTIONAL_MOMENTUM: "DIRECTIONAL_MOMENTUM",
  TECHNICAL_CONFLUENCE: "TECHNICAL_CONFLUENCE",
  RELATIVE_OPPORTUNITY: "RELATIVE_OPPORTUNITY",
  MARKET_ALIGNMENT: "MARKET_ALIGNMENT",
  SENTIMENT_DERIVATIVES: "SENTIMENT_DERIVATIVES",
} as const;

export type DirectionalEvidenceDimension =
  (typeof DIRECTIONAL_EVIDENCE_DIMENSIONS)[keyof typeof DIRECTIONAL_EVIDENCE_DIMENSIONS];

export const DIRECTIONAL_EVIDENCE_STATES = {
  STRONGLY_SUPPORTIVE: "STRONGLY_SUPPORTIVE",
  SUPPORTIVE: "SUPPORTIVE",
  NEUTRAL: "NEUTRAL",
  OPPOSING: "OPPOSING",
  STRONGLY_OPPOSING: "STRONGLY_OPPOSING",
  UNKNOWN: "UNKNOWN",
} as const;

export type DirectionalEvidenceState =
  (typeof DIRECTIONAL_EVIDENCE_STATES)[keyof typeof DIRECTIONAL_EVIDENCE_STATES];

export const RISK_STATES = {
  ACCEPTABLE: "ACCEPTABLE",
  ELEVATED: "ELEVATED",
  EXTREME: "EXTREME",
  UNKNOWN: "UNKNOWN",
} as const;

export type RiskState = (typeof RISK_STATES)[keyof typeof RISK_STATES];

export const SAFETY_STATES = {
  CLEAR: "CLEAR",
  VETO: "VETO",
  UNKNOWN: "UNKNOWN",
} as const;

export type SafetyState = (typeof SAFETY_STATES)[keyof typeof SAFETY_STATES];

export const REGIME_FIT_STATES = {
  FIT: "FIT",
  DEGRADED: "DEGRADED",
  BROKEN: "BROKEN",
  UNKNOWN: "UNKNOWN",
} as const;

export type RegimeFitState =
  (typeof REGIME_FIT_STATES)[keyof typeof REGIME_FIT_STATES];

export const DECISION_STATES = {
  LONG: "LONG",
  SHORT: "SHORT",
  ABSTAIN: "ABSTAIN",
} as const;

export type DecisionState =
  (typeof DECISION_STATES)[keyof typeof DECISION_STATES];

export const COVERAGE_LABELS = {
  COMPLETE: "COMPLETE",
  PARTIAL: "PARTIAL",
  DEGRADED: "DEGRADED",
} as const;

export type CoverageLabel =
  (typeof COVERAGE_LABELS)[keyof typeof COVERAGE_LABELS];

export const CONFLICT_LABELS = {
  LOW: "LOW",
  MODERATE: "MODERATE",
  HIGH: "HIGH",
} as const;

export type ConflictLabel =
  (typeof CONFLICT_LABELS)[keyof typeof CONFLICT_LABELS];

export interface EvidenceItem {
  id: string;
  dimension: DirectionalEvidenceDimension;
  state: DirectionalEvidenceState;
  source: string;
  observedAt: string;
  reasonCode: ReasonCode;
  explanation: string;
  rawReference?: string;
}
