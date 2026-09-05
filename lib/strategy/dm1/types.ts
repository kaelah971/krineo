import type {
  CoverageLabel,
  ConflictLabel,
  DecisionState,
  DirectionalEvidenceDimension,
  DirectionalEvidenceState,
  RegimeFitState,
  RiskState,
  SafetyState,
} from "../../evidence/types";
import type { ReasonCode, WarningCode } from "./reason-codes";

export type DM1RequiredEvidence = "risk" | "safety" | "regimeFit";

export interface DM1Config {
  strategyId: string;
  name: string;
  version: string;
  directionalWeights: {
    [dimension in DirectionalEvidenceDimension]: number;
  };
  directionThreshold: number;
  minimumCoverage: number;
  completeCoverageThreshold: number;
  maximumConflict: number;
  lowConflictThreshold: number;
  minimumRelativeEdge: number;
  narrativeDirectionalWeight: number;
  requiredDirectionalDimensions: readonly DirectionalEvidenceDimension[];
  requiredEvidence: readonly DM1RequiredEvidence[];
}

export type DirectionalEvidence = Partial<
  Record<DirectionalEvidenceDimension, DirectionalEvidenceState>
>;

export interface DM1EvidenceSnapshot {
  evidence: DirectionalEvidence;
  risk: RiskState;
  safety: SafetyState;
  regimeFit: RegimeFitState;
}

export type ProvisionalDirection = Exclude<DecisionState, "ABSTAIN"> | null;

export type DM1GateName =
  | "REQUIRED_DIRECTIONAL_EVIDENCE"
  | "COVERAGE"
  | "SAFETY"
  | "RISK"
  | "REGIME_FIT";

export interface HardGateResult {
  gate: DM1GateName;
  passed: boolean;
  reasonCode?: ReasonCode;
}

export interface DecisionResult {
  strategyId: string;
  strategyVersion: string;
  decision: DecisionState;
  provisionalDirection: ProvisionalDirection;
  directionalScore: number;
  thesisStrength: number | null;
  coverage: number;
  coverageLabel: CoverageLabel;
  conflict: number | null;
  conflictLabel: ConflictLabel | null;
  risk: RiskState;
  safety: SafetyState;
  regimeFit: RegimeFitState;
  hardGateResults: readonly HardGateResult[];
  reasonCodes: readonly ReasonCode[];
  warningCodes: readonly WarningCode[];
}

export interface CandidateInput {
  asset: string;
  evidence: DM1EvidenceSnapshot;
}

export interface CandidateEvaluation extends DecisionResult {
  asset: string;
  selected: boolean;
}

export interface AutonomousSelectionResult {
  decision: DecisionState;
  selected: CandidateEvaluation | null;
  candidates: readonly CandidateEvaluation[];
  rankedCandidates: readonly CandidateEvaluation[];
  reasonCodes: readonly ReasonCode[];
  warningCodes: readonly WarningCode[];
}
