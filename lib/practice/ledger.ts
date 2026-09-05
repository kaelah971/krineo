import type { Thesis, ThesisVersion } from "../thesis/types";
import {
  PRACTICE_CLOSE_REASONS,
  PRACTICE_PORTFOLIO_DEFAULTS,
  PRACTICE_POLICY,
  PRACTICE_POSITION_STATUSES,
  type CreatePracticePortfolioInput,
  type PracticeCloseReason,
  type PracticeLedger,
  type PracticePnl,
  type PracticePosition,
  type PracticePositionAction,
  type PracticePortfolio,
} from "./types";
import type { InvalidationOutcome } from "../thesis/invalidation";

export const PRACTICE_POSITION_ACTIONS = {
  KEEP_OPEN: "KEEP_OPEN",
  CLOSE: "CLOSE",
} as const;

export const PRACTICE_REJECTION_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_PORTFOLIO: "INVALID_PORTFOLIO",
  INVALID_POSITION: "INVALID_POSITION",
  INVALID_THESIS: "INVALID_THESIS",
  THESIS_ID_MISMATCH: "THESIS_ID_MISMATCH",
  ASSET_MISMATCH: "ASSET_MISMATCH",
  VERSION_ID_MISMATCH: "VERSION_ID_MISMATCH",
  ABSTAIN_HAS_NO_POSITION: "ABSTAIN_HAS_NO_POSITION",
  THESIS_NOT_OPENABLE: "THESIS_NOT_OPENABLE",
  INVALID_PRICE: "INVALID_PRICE",
  INVALID_NOTIONAL: "INVALID_NOTIONAL",
  POSITION_ID_ALREADY_EXISTS: "POSITION_ID_ALREADY_EXISTS",
  POSITION_ALREADY_OPEN: "POSITION_ALREADY_OPEN",
  POSITION_ALREADY_CLOSED: "POSITION_ALREADY_CLOSED",
  PORTFOLIO_ID_MISMATCH: "PORTFOLIO_ID_MISMATCH",
  POSITION_NOT_FOUND: "POSITION_NOT_FOUND",
  INVALID_CLOSE_REASON: "INVALID_CLOSE_REASON",
} as const;

export type PracticeRejectionCode =
  (typeof PRACTICE_REJECTION_CODES)[keyof typeof PRACTICE_REJECTION_CODES];

export interface PracticeRejection {
  readonly ok: false;
  readonly code: PracticeRejectionCode;
  readonly message: string;
}

export interface PracticeSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export type PracticeResult<T> = PracticeSuccess<T> | PracticeRejection;

export interface OpenPracticePositionInput {
  readonly portfolio: PracticePortfolio;
  readonly existingPositions: readonly PracticePosition[];
  readonly thesis: Thesis;
  readonly thesisVersion: ThesisVersion;
  readonly positionId: string;
  readonly entryPrice: number;
  readonly entryTime: string;
  readonly notionalUsd?: number;
}

export interface ClosePracticePositionInput {
  readonly position: PracticePosition;
  readonly exitPrice: number;
  readonly exitTime: string;
  readonly closeReason: PracticeCloseReason;
}

export interface RecordPracticePositionInput {
  readonly ledger: PracticeLedger;
  readonly position: PracticePosition;
}

export interface ReplacePracticePositionInput {
  readonly ledger: PracticeLedger;
  readonly position: PracticePosition;
}

function rejection(
  code: PracticeRejectionCode,
  message: string,
): PracticeRejection {
  return { ok: false, code, message };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function compareLexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function comparePositions(
  left: PracticePosition,
  right: PracticePosition,
): number {
  if (left.entryTime !== right.entryTime) {
    return compareLexical(left.entryTime, right.entryTime);
  }
  return compareLexical(left.id, right.id);
}

function validatePortfolio(
  portfolio: PracticePortfolio,
): PracticeRejection | null {
  if (
    portfolio === null ||
    typeof portfolio !== "object" ||
    !isNonEmptyString(portfolio.id) ||
    !isNonEmptyString(portfolio.createdAt) ||
    !isNonEmptyString(portfolio.policyVersion) ||
    !isFinitePositiveNumber(portfolio.startingBalanceUsd) ||
    !isFinitePositiveNumber(portfolio.defaultPositionNotionalUsd)
  ) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_PORTFOLIO,
      "Practice portfolios require positive finite balances, a policy version, an ID and a creation timestamp.",
    );
  }
  return null;
}

function validatePrice(price: number): PracticeRejection | null {
  return isFinitePositiveNumber(price)
    ? null
    : rejection(
        PRACTICE_REJECTION_CODES.INVALID_PRICE,
        "Practice prices must be finite numbers greater than zero.",
      );
}

function validatePosition(
  position: PracticePosition,
): PracticeRejection | null {
  if (
    position === null ||
    typeof position !== "object" ||
    !isNonEmptyString(position.id) ||
    !isNonEmptyString(position.portfolioId) ||
    !isNonEmptyString(position.thesisId) ||
    !isNonEmptyString(position.thesisVersionId) ||
    !isNonEmptyString(position.asset) ||
    (position.direction !== "LONG" && position.direction !== "SHORT") ||
    !isFinitePositiveNumber(position.notionalUsd) ||
    validatePrice(position.entryPrice) !== null ||
    !isNonEmptyString(position.entryTime) ||
    !isFinitePositiveNumber(position.trackedQuantity) ||
    (position.status !== PRACTICE_POSITION_STATUSES.OPEN &&
      position.status !== PRACTICE_POSITION_STATUSES.CLOSED)
  ) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_POSITION,
      "Practice positions require valid identity, direction, positive prices, notional, quantity and status fields.",
    );
  }

  if (position.status === PRACTICE_POSITION_STATUSES.CLOSED) {
    if (
      position.exitPrice === undefined ||
      validatePrice(position.exitPrice) !== null ||
      !isNonEmptyString(position.exitTime) ||
      !isPracticeCloseReason(position.closeReason) ||
      !isFiniteNumber(position.realizedPnlUsd) ||
      !isFiniteNumber(position.realizedPnlPercent)
    ) {
      return rejection(
        PRACTICE_REJECTION_CODES.INVALID_POSITION,
        "Closed practice positions must contain valid exit and realized P&L fields.",
      );
    }
  }

  return null;
}

function isPracticeCloseReason(value: unknown): value is PracticeCloseReason {
  return (
    value === PRACTICE_CLOSE_REASONS.THESIS_WEAKENED ||
    value === PRACTICE_CLOSE_REASONS.THESIS_INVALIDATED ||
    value === PRACTICE_CLOSE_REASONS.MANUAL_CLOSE ||
    value === PRACTICE_CLOSE_REASONS.PRACTICE_HORIZON_EXPIRED
  );
}

function validateThesisCommitment(
  thesis: Thesis,
  thesisVersion: ThesisVersion,
): PracticeRejection | null {
  if (
    thesis === null ||
    typeof thesis !== "object" ||
    !isNonEmptyString(thesis.id) ||
    !isNonEmptyString(thesis.asset) ||
    thesisVersion === null ||
    typeof thesisVersion !== "object" ||
    !isNonEmptyString(thesisVersion.id) ||
    !isNonEmptyString(thesisVersion.thesisId) ||
    !isNonEmptyString(thesisVersion.asset)
  ) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_THESIS,
      "A practice position requires a valid Thesis and committed ThesisVersion identity.",
    );
  }

  if (thesis.id !== thesisVersion.thesisId) {
    return rejection(
      PRACTICE_REJECTION_CODES.THESIS_ID_MISMATCH,
      "Thesis identity does not match the committed ThesisVersion.",
    );
  }
  if (thesis.asset !== thesisVersion.asset) {
    return rejection(
      PRACTICE_REJECTION_CODES.ASSET_MISMATCH,
      "Thesis asset does not match the committed ThesisVersion.",
    );
  }
  if (thesisVersion.decision === "ABSTAIN") {
    return rejection(
      PRACTICE_REJECTION_CODES.ABSTAIN_HAS_NO_POSITION,
      "ABSTAIN has no directional practice position.",
    );
  }
  if (
    thesisVersion.decision !== "LONG" &&
    thesisVersion.decision !== "SHORT"
  ) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_THESIS,
      "A committed ThesisVersion must contain a LONG or SHORT decision.",
    );
  }
  if (thesisVersion.statusAtCommit !== "ACTIVE") {
    return rejection(
      PRACTICE_REJECTION_CODES.THESIS_NOT_OPENABLE,
      "Only an ACTIVE directional ThesisVersion can open a practice position.",
    );
  }

  return null;
}

function practicePnlValues(
  position: PracticePosition,
  currentPrice: number,
): PracticePnl {
  const pnlUsd =
    position.direction === "LONG"
      ? position.trackedQuantity * (currentPrice - position.entryPrice)
      : position.trackedQuantity * (position.entryPrice - currentPrice);
  return {
    currentPrice,
    pnlUsd,
    pnlPercent: (pnlUsd / position.notionalUsd) * 100,
  };
}

export function createPracticePortfolio(
  input: CreatePracticePortfolioInput,
): PracticeResult<PracticePortfolio> {
  if (
    input === null ||
    typeof input !== "object" ||
    !isNonEmptyString(input.id) ||
    !isNonEmptyString(input.createdAt)
  ) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_INPUT,
      "Practice portfolio creation requires a caller-supplied ID and timestamp.",
    );
  }

  const startingBalanceUsd =
    input.startingBalanceUsd ?? PRACTICE_PORTFOLIO_DEFAULTS.startingBalanceUsd;
  const defaultPositionNotionalUsd =
    input.defaultPositionNotionalUsd ??
    PRACTICE_PORTFOLIO_DEFAULTS.defaultPositionNotionalUsd;
  if (!isFinitePositiveNumber(startingBalanceUsd)) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_PORTFOLIO,
      "Starting simulated balance must be a finite number greater than zero.",
    );
  }
  if (!isFinitePositiveNumber(defaultPositionNotionalUsd)) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_NOTIONAL,
      "Default practice position notional must be a finite number greater than zero.",
    );
  }

  return {
    ok: true,
    value: {
      id: input.id,
      startingBalanceUsd,
      defaultPositionNotionalUsd,
      createdAt: input.createdAt,
      policyVersion: PRACTICE_POLICY.version,
    },
  };
}

export function sortPracticePositions(
  positions: readonly PracticePosition[],
): readonly PracticePosition[] {
  return [...positions].sort(comparePositions);
}

export function createPracticeLedger(
  portfolio: PracticePortfolio,
  positions: readonly PracticePosition[] = [],
): PracticeResult<PracticeLedger> {
  const portfolioRejection = validatePortfolio(portfolio);
  if (portfolioRejection !== null) {
    return portfolioRejection;
  }
  if (!Array.isArray(positions)) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_INPUT,
      "Practice ledger positions must be an array.",
    );
  }

  const ids = new Set<string>();
  const thesisIds = new Set<string>();
  for (const position of positions) {
    const positionRejection = validatePosition(position);
    if (positionRejection !== null) {
      return positionRejection;
    }
    if (position.portfolioId !== portfolio.id) {
      return rejection(
        PRACTICE_REJECTION_CODES.PORTFOLIO_ID_MISMATCH,
        "Every practice position in a ledger must belong to its portfolio.",
      );
    }
    if (ids.has(position.id)) {
      return rejection(
        PRACTICE_REJECTION_CODES.POSITION_ID_ALREADY_EXISTS,
        "Practice position IDs must be unique in a ledger.",
      );
    }
    if (position.status === PRACTICE_POSITION_STATUSES.OPEN) {
      if (thesisIds.has(position.thesisId)) {
        return rejection(
          PRACTICE_REJECTION_CODES.POSITION_ALREADY_OPEN,
          "A thesis may have at most one open practice position.",
        );
      }
      thesisIds.add(position.thesisId);
    }
    ids.add(position.id);
  }

  return {
    ok: true,
    value: {
      portfolio,
      positions: sortPracticePositions(positions),
    },
  };
}

export function openPracticePosition(
  input: OpenPracticePositionInput,
): PracticeResult<PracticePosition> {
  if (
    input === null ||
    typeof input !== "object" ||
    !isNonEmptyString(input.positionId) ||
    !isNonEmptyString(input.entryTime) ||
    !Array.isArray(input.existingPositions)
  ) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_INPUT,
      "Opening a practice position requires a caller-supplied ID, timestamp and position history.",
    );
  }

  const portfolioRejection = validatePortfolio(input.portfolio);
  if (portfolioRejection !== null) {
    return portfolioRejection;
  }
  const thesisRejection = validateThesisCommitment(
    input.thesis,
    input.thesisVersion,
  );
  if (thesisRejection !== null) {
    return thesisRejection;
  }
  const entryPriceRejection = validatePrice(input.entryPrice);
  if (entryPriceRejection !== null) {
    return entryPriceRejection;
  }

  const notionalUsd =
    input.notionalUsd ?? input.portfolio.defaultPositionNotionalUsd;
  if (!isFinitePositiveNumber(notionalUsd)) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_NOTIONAL,
      "Practice position notional must be a finite number greater than zero.",
    );
  }

  for (const existingPosition of input.existingPositions) {
    const existingRejection = validatePosition(existingPosition);
    if (existingRejection !== null) {
      return existingRejection;
    }
    if (existingPosition.id === input.positionId) {
      return rejection(
        PRACTICE_REJECTION_CODES.POSITION_ID_ALREADY_EXISTS,
        "Practice position IDs must be unique.",
      );
    }
    if (
      existingPosition.status === PRACTICE_POSITION_STATUSES.OPEN &&
      existingPosition.thesisId === input.thesisVersion.thesisId
    ) {
      return rejection(
        PRACTICE_REJECTION_CODES.POSITION_ALREADY_OPEN,
        "A thesis may have at most one open practice position.",
      );
    }
  }

  return {
    ok: true,
    value: {
      id: input.positionId,
      portfolioId: input.portfolio.id,
      thesisId: input.thesisVersion.thesisId,
      thesisVersionId: input.thesisVersion.id,
      asset: input.thesisVersion.asset,
      direction: input.thesisVersion.decision as "LONG" | "SHORT",
      notionalUsd,
      entryPrice: input.entryPrice,
      entryTime: input.entryTime,
      trackedQuantity: notionalUsd / input.entryPrice,
      status: PRACTICE_POSITION_STATUSES.OPEN,
    },
  };
}

export function calculatePracticePnl(
  position: PracticePosition,
  currentPrice: number,
): PracticeResult<PracticePnl> {
  const positionRejection = validatePosition(position);
  if (positionRejection !== null) {
    return positionRejection;
  }
  if (position.status === PRACTICE_POSITION_STATUSES.CLOSED) {
    return rejection(
      PRACTICE_REJECTION_CODES.POSITION_ALREADY_CLOSED,
      "Unrealized P&L cannot be calculated for a closed practice position.",
    );
  }
  const priceRejection = validatePrice(currentPrice);
  if (priceRejection !== null) {
    return priceRejection;
  }
  return { ok: true, value: practicePnlValues(position, currentPrice) };
}

export const calculateUnrealizedPnl = calculatePracticePnl;

export function closePracticePosition(
  input: ClosePracticePositionInput,
): PracticeResult<PracticePosition> {
  if (input === null || typeof input !== "object") {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_INPUT,
      "Closing a practice position requires a position, exit price, exit time and close reason.",
    );
  }
  const positionRejection = validatePosition(input.position);
  if (positionRejection !== null) {
    return positionRejection;
  }
  if (input.position.status === PRACTICE_POSITION_STATUSES.CLOSED) {
    return rejection(
      PRACTICE_REJECTION_CODES.POSITION_ALREADY_CLOSED,
      "A closed practice position cannot be closed again.",
    );
  }
  if (!isNonEmptyString(input.exitTime)) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_INPUT,
      "Practice position exit time must be a caller-supplied non-empty string.",
    );
  }
  if (!isPracticeCloseReason(input.closeReason)) {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_CLOSE_REASON,
      "Practice position close reason is not supported.",
    );
  }
  const priceRejection = validatePrice(input.exitPrice);
  if (priceRejection !== null) {
    return priceRejection;
  }

  const realizedPnl = practicePnlValues(input.position, input.exitPrice);
  return {
    ok: true,
    value: {
      ...input.position,
      status: PRACTICE_POSITION_STATUSES.CLOSED,
      exitPrice: input.exitPrice,
      exitTime: input.exitTime,
      closeReason: input.closeReason,
      realizedPnlUsd: realizedPnl.pnlUsd,
      realizedPnlPercent: realizedPnl.pnlPercent,
    },
  };
}

export function recordPracticePosition(
  input: RecordPracticePositionInput,
): PracticeResult<PracticeLedger> {
  if (input === null || typeof input !== "object") {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_INPUT,
      "Recording a practice position requires a ledger and position.",
    );
  }
  const ledgerRejection = createPracticeLedger(
    input.ledger.portfolio,
    input.ledger.positions,
  );
  if (!ledgerRejection.ok) {
    return ledgerRejection;
  }
  const positionRejection = validatePosition(input.position);
  if (positionRejection !== null) {
    return positionRejection;
  }
  if (input.position.portfolioId !== input.ledger.portfolio.id) {
    return rejection(
      PRACTICE_REJECTION_CODES.PORTFOLIO_ID_MISMATCH,
      "The recorded practice position must belong to the ledger portfolio.",
    );
  }
  if (input.ledger.positions.some((position) => position.id === input.position.id)) {
    return rejection(
      PRACTICE_REJECTION_CODES.POSITION_ID_ALREADY_EXISTS,
      "Practice position IDs must be unique in a ledger.",
    );
  }
  if (
    input.position.status === PRACTICE_POSITION_STATUSES.OPEN &&
    input.ledger.positions.some(
      (position) =>
        position.status === PRACTICE_POSITION_STATUSES.OPEN &&
        position.thesisId === input.position.thesisId,
    )
  ) {
    return rejection(
      PRACTICE_REJECTION_CODES.POSITION_ALREADY_OPEN,
      "A thesis may have at most one open practice position.",
    );
  }

  return {
    ok: true,
    value: {
      portfolio: input.ledger.portfolio,
      positions: sortPracticePositions([
        ...input.ledger.positions,
        input.position,
      ]),
    },
  };
}

export function replacePracticePosition(
  input: ReplacePracticePositionInput,
): PracticeResult<PracticeLedger> {
  if (input === null || typeof input !== "object") {
    return rejection(
      PRACTICE_REJECTION_CODES.INVALID_INPUT,
      "Replacing a practice position requires a ledger and position.",
    );
  }
  const ledgerRejection = createPracticeLedger(
    input.ledger.portfolio,
    input.ledger.positions,
  );
  if (!ledgerRejection.ok) {
    return ledgerRejection;
  }
  const positionRejection = validatePosition(input.position);
  if (positionRejection !== null) {
    return positionRejection;
  }
  if (input.position.portfolioId !== input.ledger.portfolio.id) {
    return rejection(
      PRACTICE_REJECTION_CODES.PORTFOLIO_ID_MISMATCH,
      "The replacement practice position must belong to the ledger portfolio.",
    );
  }
  const positionIndex = input.ledger.positions.findIndex(
    (position) => position.id === input.position.id,
  );
  if (positionIndex === -1) {
    return rejection(
      PRACTICE_REJECTION_CODES.POSITION_NOT_FOUND,
      "The practice position to replace was not found in the ledger.",
    );
  }
  if (
    input.position.status === PRACTICE_POSITION_STATUSES.OPEN &&
    input.ledger.positions.some(
      (position) =>
        position.id !== input.position.id &&
        position.status === PRACTICE_POSITION_STATUSES.OPEN &&
        position.thesisId === input.position.thesisId,
    )
  ) {
    return rejection(
      PRACTICE_REJECTION_CODES.POSITION_ALREADY_OPEN,
      "A thesis may have at most one open practice position.",
    );
  }

  const positions = [...input.ledger.positions];
  positions[positionIndex] = input.position;
  return {
    ok: true,
    value: {
      portfolio: input.ledger.portfolio,
      positions: sortPracticePositions(positions),
    },
  };
}

export function mapInvalidationOutcomeToPracticeAction(
  outcome: InvalidationOutcome,
): PracticePositionAction {
  switch (outcome) {
    case "MAINTAIN":
      return { outcome, action: PRACTICE_POSITION_ACTIONS.KEEP_OPEN };
    case "WEAKEN":
      return {
        outcome,
        action: PRACTICE_POSITION_ACTIONS.CLOSE,
        recommendedCloseReason: PRACTICE_CLOSE_REASONS.THESIS_WEAKENED,
      };
    case "INVALIDATE":
      return {
        outcome,
        action: PRACTICE_POSITION_ACTIONS.CLOSE,
        recommendedCloseReason: PRACTICE_CLOSE_REASONS.THESIS_INVALIDATED,
      };
  }
}

export const mapInvalidationToPracticeAction =
  mapInvalidationOutcomeToPracticeAction;
