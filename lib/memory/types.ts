import type {
  DecisionState,
  DirectionalEvidenceDimension,
  DirectionalEvidenceState,
  RegimeFitState,
  RiskState,
  SafetyState,
} from "../evidence/types";

export const CASE_SIMILARITY_ALGORITHM_VERSION = "case-similarity-v1" as const;
export type CaseSimilarityAlgorithmVersion =
  typeof CASE_SIMILARITY_ALGORITHM_VERSION;

export const CASE_SIGNATURE_DIMENSIONS = [
  "DIRECTIONAL_MOMENTUM",
  "TECHNICAL_CONFLUENCE",
  "RELATIVE_OPPORTUNITY",
  "MARKET_ALIGNMENT",
  "SENTIMENT_DERIVATIVES",
  "risk",
  "safety",
  "regimeFit",
] as const;

export type CaseSignatureDimension = (typeof CASE_SIGNATURE_DIMENSIONS)[number];

export const CASE_SIMILARITY_WEIGHTS = {
  DIRECTIONAL_MOMENTUM: 30,
  TECHNICAL_CONFLUENCE: 20,
  RELATIVE_OPPORTUNITY: 20,
  MARKET_ALIGNMENT: 15,
  SENTIMENT_DERIVATIVES: 15,
  risk: 10,
  safety: 10,
  regimeFit: 10,
} as const satisfies Record<CaseSignatureDimension, number>;

export const CASE_SIMILARITY_TOTAL_WEIGHT = 130 as const;

export interface CaseSignature {
  /**
   * All five directional dimensions are required.
   * Missing DM-1 evidence is canonicalized to UNKNOWN.
   */
  readonly evidence: Readonly<
    Record<DirectionalEvidenceDimension, DirectionalEvidenceState>
  >;
  readonly risk: RiskState;
  readonly safety: SafetyState;
  readonly regimeFit: RegimeFitState;
}

/**
 * Outcome status is historical context only.
 * It is strictly quarantined from similarity calculation.
 */
export type DecisionOutcomeStatus =
  | "PENDING"
  | "POSITIVE"
  | "NEGATIVE"
  | "FLAT"
  | "INVALIDATED"
  | "UNKNOWN";

export interface DecisionOutcomeMetadata {
  readonly status: DecisionOutcomeStatus;
  readonly resolvedAt?: string;
  readonly observationId?: string;
  readonly realizedPnlUsd?: number;
  readonly realizedPnlPercent?: number;
  readonly closeReason?: string;
}

export interface DecisionCase {
  readonly id: string;
  readonly thesisId: string;
  readonly versionId: string;
  readonly evidenceSnapshotId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly asset: string;
  readonly decision: DecisionState;
  readonly signature: CaseSignature;
  /** UTC RFC3339 timestamp at which this ThesisVersion was committed. */
  readonly committedAt: string;
  /** UTC RFC3339 timestamp of the market evidence represented by signature. */
  readonly observedAt: string;
  /** Quarantined historical metadata; never read by similarity or ranking. */
  readonly outcome?: DecisionOutcomeMetadata;
}

export type CaseState =
  | DirectionalEvidenceState
  | RiskState
  | SafetyState
  | RegimeFitState;

export type SimilarityDiagnosticCode =
  | "MATCH"
  | "OPPOSING"
  | "PARTIAL_ALIGNMENT"
  | "TARGET_UNKNOWN"
  | "CANDIDATE_UNKNOWN"
  | "BOTH_UNKNOWN";

export interface SimilarityComponent {
  readonly dimension: CaseSignatureDimension;
  readonly weight: number;
  readonly targetState: CaseState;
  readonly candidateState: CaseState;
  readonly diagnostic: SimilarityDiagnosticCode;
  /** 0..1; UNKNOWN pairs have distance 1 and receive no comparable weight. */
  readonly distance: number;
  /** 0..1; UNKNOWN-vs-known and UNKNOWN-vs-UNKNOWN both have penalty 1. */
  readonly penalty: number;
  /** 0..1; unknown pairs score 0. */
  readonly score: number;
  readonly weightedScore: number;
}

export interface CaseSimilarityResult {
  readonly algorithmVersion: CaseSimilarityAlgorithmVersion;
  readonly overallSimilarity: number;
  /** Similarity among dimensions known on both sides; 0 if none are comparable. */
  readonly comparableSimilarity: number;
  /** Sum of weights where target and candidate are both known, divided by 130. */
  readonly comparisonCoverage: number;
  /** Known target weight divided by 130. */
  readonly targetCompleteness: number;
  /** Known candidate weight divided by 130. */
  readonly candidateCompleteness: number;
  readonly comparableWeight: number;
  readonly totalWeight: number;
  readonly components: readonly SimilarityComponent[];
}

export interface RankedCase {
  readonly rank: number;
  readonly caseId: string;
  readonly decisionCase: DecisionCase;
  readonly similarity: CaseSimilarityResult;
}

export interface RetrievalOptions {
  /** Positive integer. Omitted means return every eligible case. */
  readonly limit?: number;
  /** Inclusive [0, 1] post-score filter. Omitted means 0. */
  readonly minimumSimilarity?: number;
  /** Inclusive [0, 1] post-score filter. Omitted means 0. */
  readonly minimumComparisonCoverage?: number;
}

export interface MemoryMetadata {
  readonly [key: string]: string | number | boolean | null;
}

export interface MemorySnapshot {
  readonly snapshotId: string;
  /** null when target is an uncommitted/candidate signature. */
  readonly targetCase: DecisionCase | null;
  readonly targetSignature: CaseSignature;
  readonly algorithmVersion: CaseSimilarityAlgorithmVersion;
  readonly rankedCases: readonly RankedCase[];
  readonly createdAt: string;
  readonly metadata?: MemoryMetadata;
}

export interface MemoryProvider {
  storeCase(decisionCase: DecisionCase): Promise<void>;
  getCase(caseId: string): Promise<DecisionCase | null>;
  listCases(): Promise<readonly DecisionCase[]>;
  storeSnapshot(snapshot: MemorySnapshot): Promise<void>;
  getSnapshot(snapshotId: string): Promise<MemorySnapshot | null>;
}
