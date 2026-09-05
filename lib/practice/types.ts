import type { DecisionState } from "../evidence/types";

export const PRACTICE_POSITION_STATUSES = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;

export type PracticePositionStatus =
  (typeof PRACTICE_POSITION_STATUSES)[keyof typeof PRACTICE_POSITION_STATUSES];

export interface PracticePosition {
  id: string;
  asset: string;
  direction: Exclude<DecisionState, "ABSTAIN">;
  notional: number;
  entryPrice: number;
  entryAt: string;
  exitPrice?: number;
  exitAt?: string;
  status: PracticePositionStatus;
  closeReason?: string;
}
