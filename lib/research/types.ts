import type {
  CoverageLabel,
  ConflictLabel,
  DecisionState,
  DirectionalEvidenceDimension,
  DirectionalEvidenceState,
  EvidenceItem,
  RegimeFitState,
  RiskState,
  SafetyState,
} from "../evidence/types";
import type { DecisionIntegrationSuccess } from "../decision";
import type {
  KillSwitchAggregateResult,
  KillSwitchValidationResult,
} from "../killswitch/types";
import type {
  AutonomousSelectionResult,
  CandidateEvaluation,
  DM1EvidenceSnapshot,
} from "../strategy/dm1/types";
import type { ReasonCode, WarningCode } from "../strategy/dm1/reason-codes";
import type { MemorySnapshot } from "../memory";
import type { PlaybookVersion } from "../playbook";
import type {
  PracticeLedger,
  PracticePnl,
  PracticePosition,
} from "../practice/types";
import type {
  Thesis,
  ThesisReceipt,
  ThesisVersion,
} from "../thesis/types";
import type { RYOProviderStatus } from "../ryo/types";

export const RESEARCH_INTENTS = {
  AUTONOMOUS_DISCOVERY: "AUTONOMOUS_DISCOVERY",
  ANALYZE_ASSET: "ANALYZE_ASSET",
  COMPARE_ASSETS: "COMPARE_ASSETS",
  REFRESH_THESIS: "REFRESH_THESIS",
} as const;

export type ResearchIntent =
  (typeof RESEARCH_INTENTS)[keyof typeof RESEARCH_INTENTS];

export const RESEARCH_RUN_STAGES = {
  CREATED: "CREATED",
  MARKET_CONTEXT: "MARKET_CONTEXT",
  DISCOVERY: "DISCOVERY",
  COMPARISON: "COMPARISON",
  DEEP_RESEARCH: "DEEP_RESEARCH",
  NORMALIZING: "NORMALIZING",
  PROVISIONAL: "PROVISIONAL",
  KILLSWITCH: "KILLSWITCH",
  COMMITTED: "COMMITTED",
  ABSTAINED: "ABSTAINED",
  FAILED: "FAILED",
} as const;

export type ResearchRunStage =
  (typeof RESEARCH_RUN_STAGES)[keyof typeof RESEARCH_RUN_STAGES];

export const RESEARCH_MODES = {
  LIVE: "LIVE",
  REPLAY: "REPLAY",
} as const;

export type ResearchMode = (typeof RESEARCH_MODES)[keyof typeof RESEARCH_MODES];

export const RESEARCH_RUN_STATUSES = {
  COMMITTED: "COMMITTED",
  PROPOSED: "PROPOSED",
  ABSTAINED: "ABSTAINED",
  DEGRADED: "DEGRADED",
} as const;

export type ResearchRunStatus =
  (typeof RESEARCH_RUN_STATUSES)[keyof typeof RESEARCH_RUN_STATUSES];

export const RESEARCH_RUN_OUTCOMES = RESEARCH_RUN_STATUSES;
export type ResearchRunOutcome = ResearchRunStatus;

export const RESEARCH_REASON_CODES = {
  PROVIDER_DISCOVERY_UNAVAILABLE: "PROVIDER_DISCOVERY_UNAVAILABLE",
  MARKET_CONTEXT_UNAVAILABLE: "MARKET_CONTEXT_UNAVAILABLE",
  CANDIDATE_SCAN_UNAVAILABLE: "CANDIDATE_SCAN_UNAVAILABLE",
  NO_DIRECTIONAL_CANDIDATE: "NO_DIRECTIONAL_CANDIDATE",
  INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
  NO_CLEAR_RELATIVE_WINNER: "NO_CLEAR_RELATIVE_WINNER",
  CANDIDATE_RESEARCH_UNAVAILABLE: "CANDIDATE_RESEARCH_UNAVAILABLE",
  PREFLIGHT_WAIT: "PREFLIGHT_WAIT",
  PREFLIGHT_BLOCK: "PREFLIGHT_BLOCK",
  PREFLIGHT_REJECTED: "PREFLIGHT_REJECTED",
  KILLSWITCH_VETO: "KILLSWITCH_VETO",
  KILLSWITCH_UNKNOWN: "KILLSWITCH_UNKNOWN",
  THESIS_COMMIT_REJECTED: "THESIS_COMMIT_REJECTED",
  RECEIPT_REJECTED: "RECEIPT_REJECTED",
  PRACTICE_COMMIT_REJECTED: "PRACTICE_COMMIT_REJECTED",
  CANDIDATE_LIMIT_REACHED: "CANDIDATE_LIMIT_REACHED",
  INVALID_CANDIDATE_ASSET: "INVALID_CANDIDATE_ASSET",
} as const;

export type ResearchReasonCode =
  (typeof RESEARCH_REASON_CODES)[keyof typeof RESEARCH_REASON_CODES];

export type ResearchProviderStatus = RYOProviderStatus;

export interface ResearchProviderIdentity {
  readonly id: string;
  readonly mode: ResearchMode;
  /** A truthful source label, e.g. LIVE_RYO or REPLAY_FROM_SANITIZED_RYO_FIXTURE. */
  readonly source: string;
  readonly serverName?: string;
  readonly serverVersion?: string;
  readonly protocolVersion?: string;
}

export interface ResearchProviderProvenance {
  readonly provider: string;
  readonly source: string;
  readonly tool: string;
  readonly asOf?: string;
  readonly serverName?: string;
  readonly serverVersion?: string;
  readonly protocolVersion?: string;
}

export interface ResearchProviderIssue {
  readonly code: string;
  readonly message: string;
  readonly source: string;
  readonly status?: ResearchProviderStatus;
}

export interface ResearchMarketContext {
  readonly status: ResearchProviderStatus;
  readonly provenance: ResearchProviderProvenance;
  readonly asOf?: string;
  readonly regime: string | null;
  readonly warnings: readonly ResearchProviderIssue[];
}

export interface ResearchCandidateDescriptor {
  readonly asset: string;
  readonly providerRank: number;
}

export interface ResearchCandidateDiscovery {
  readonly status: ResearchProviderStatus;
  readonly provenance: ResearchProviderProvenance;
  readonly candidates: readonly ResearchCandidateDescriptor[];
  readonly warnings: readonly ResearchProviderIssue[];
  readonly failures: readonly ResearchProviderIssue[];
}

export type ResearchDirectionalEvidence = Readonly<
  Record<DirectionalEvidenceDimension, DirectionalEvidenceState>
>;

export interface ResearchEvidenceSnapshot {
  readonly asset: string;
  readonly dm1: DM1EvidenceSnapshot;
  readonly evidenceItems: readonly EvidenceItem[];
  readonly provenance: ResearchProviderProvenance;
  readonly providerStatus: ResearchProviderStatus;
  readonly normalizationNotes: Readonly<Record<string, string>>;
}

export interface ResearchCandidateEvidence {
  readonly asset: string;
  readonly snapshot: ResearchEvidenceSnapshot;
  readonly warnings: readonly ResearchProviderIssue[];
  readonly failures: readonly ResearchProviderIssue[];
}

export interface ResearchCandidateRun {
  readonly asset: string;
  readonly providerRank: number;
  readonly evidence: ResearchEvidenceSnapshot;
  readonly dm1: CandidateEvaluation;
  readonly providerWarnings: readonly ResearchProviderIssue[];
  readonly providerFailures: readonly ResearchProviderIssue[];
}

export interface ResearchPreflightFailure {
  readonly code: string;
  readonly message: string;
  readonly playbookCode?: string;
}

export interface ResearchDecisionProposal {
  readonly thesisId: string;
  readonly versionId: string;
  readonly evidenceSnapshotId: string;
  readonly asset: string;
  readonly decision: Exclude<DecisionState, "ABSTAIN">;
  readonly eligible: boolean;
}

export interface ResearchPracticeResult {
  readonly ledger: PracticeLedger;
  readonly position: PracticePosition;
  readonly pnl: PracticePnl | null;
}

export interface ResearchCommitResult {
  readonly thesis: Thesis;
  readonly version: ThesisVersion;
  readonly receipt: ThesisReceipt;
  readonly practice: ResearchPracticeResult;
}

export interface ResearchRun {
  readonly id: string;
  readonly intent: ResearchIntent;
  readonly mode: ResearchMode;
  readonly status: ResearchRunStatus;
  readonly outcome: ResearchRunOutcome;
  readonly currentStage: ResearchRunStage;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string;
  readonly asOf: string | null;
  readonly provider: ResearchProviderIdentity;
  readonly marketContext: ResearchMarketContext | null;
  readonly candidateDiscovery: ResearchCandidateDiscovery | null;
  readonly candidateAssetsConsidered: readonly string[];
  readonly candidates: readonly ResearchCandidateRun[];
  readonly selection: AutonomousSelectionResult;
  readonly selectedAsset: string | null;
  readonly marketDecision: DecisionState;
  readonly finalDecision: DecisionState;
  readonly reasonCodes: readonly (ResearchReasonCode | ReasonCode | WarningCode | string)[];
  readonly providerWarnings: readonly ResearchProviderIssue[];
  readonly providerFailures: readonly ResearchProviderIssue[];
  readonly preflight: DecisionIntegrationSuccess | null;
  readonly preflightFailure: ResearchPreflightFailure | null;
  readonly killSwitch: KillSwitchAggregateResult | null;
  readonly killSwitchValidation: KillSwitchValidationResult | null;
  readonly proposal: ResearchDecisionProposal | null;
  readonly commit: ResearchCommitResult | null;
  readonly practice: ResearchPracticeResult | null;
  readonly autoCommitPractice: boolean;
  readonly playbookVersionId: string;
  readonly memorySnapshotId: string | null;
}

export interface ResearchRunLegacyShape {
  readonly id: string;
  readonly intent: ResearchIntent;
  readonly status: ResearchRunStage;
  readonly currentStage?: ResearchRunStage;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ResearchRunSummary = Pick<
  ResearchRun,
  | "id"
  | "mode"
  | "status"
  | "outcome"
  | "selectedAsset"
  | "marketDecision"
  | "finalDecision"
  | "reasonCodes"
>;

export type ResearchPlaybookInput = PlaybookVersion;
export type ResearchMemoryInput = MemorySnapshot | null | undefined;

export type ResearchRiskState = RiskState;
export type ResearchSafetyState = SafetyState;
export type ResearchRegimeFitState = RegimeFitState;
export type ResearchCoverageLabel = CoverageLabel;
export type ResearchConflictLabel = ConflictLabel;