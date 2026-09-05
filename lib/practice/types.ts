import type { DecisionState } from "../evidence/types";
import type { InvalidationOutcome } from "../thesis/invalidation";

export const PRACTICE_POLICY = {
  version: "1.0.0",
  startingBalanceUsd: 10_000,
  defaultPositionNotionalUsd: 1_000,
} as const;

export const PRACTICE_PORTFOLIO_DEFAULTS = {
  startingBalanceUsd: PRACTICE_POLICY.startingBalanceUsd,
  defaultPositionNotionalUsd: PRACTICE_POLICY.defaultPositionNotionalUsd,
} as const;

export interface PracticePortfolio {
  readonly id: string;
  readonly startingBalanceUsd: number;
  readonly defaultPositionNotionalUsd: number;
  readonly createdAt: string;
  readonly policyVersion: string;
}

export interface CreatePracticePortfolioInput {
  readonly id: string;
  readonly createdAt: string;
  readonly startingBalanceUsd?: number;
  readonly defaultPositionNotionalUsd?: number;
}

export const PRACTICE_POSITION_STATUSES = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;

export type PracticePositionStatus =
  (typeof PRACTICE_POSITION_STATUSES)[keyof typeof PRACTICE_POSITION_STATUSES];

export const PRACTICE_CLOSE_REASONS = {
  THESIS_WEAKENED: "THESIS_WEAKENED",
  THESIS_INVALIDATED: "THESIS_INVALIDATED",
  MANUAL_CLOSE: "MANUAL_CLOSE",
  PRACTICE_HORIZON_EXPIRED: "PRACTICE_HORIZON_EXPIRED",
} as const;

export type PracticeCloseReason =
  (typeof PRACTICE_CLOSE_REASONS)[keyof typeof PRACTICE_CLOSE_REASONS];

export interface PracticePosition {
  readonly id: string;
  readonly portfolioId: string;
  readonly thesisId: string;
  readonly thesisVersionId: string;
  readonly asset: string;
  readonly direction: Exclude<DecisionState, "ABSTAIN">;
  readonly notionalUsd: number;
  readonly entryPrice: number;
  readonly entryTime: string;
  readonly trackedQuantity: number;
  readonly status: PracticePositionStatus;
  readonly exitPrice?: number;
  readonly exitTime?: string;
  readonly closeReason?: PracticeCloseReason;
  readonly realizedPnlUsd?: number;
  readonly realizedPnlPercent?: number;
}

export interface PracticeLedger {
  readonly portfolio: PracticePortfolio;
  readonly positions: readonly PracticePosition[];
}

export interface PracticePnl {
  readonly currentPrice: number;
  readonly pnlUsd: number;
  readonly pnlPercent: number;
}

export interface PracticePositionAction {
  readonly outcome: InvalidationOutcome;
  readonly action: "KEEP_OPEN" | "CLOSE";
  readonly recommendedCloseReason?: PracticeCloseReason;
}
