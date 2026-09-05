import { describe, expect, it } from "vitest";
import { createThesis } from "../lib/thesis/build";
import { makeDecisionResult, makeKillSwitchAggregate, makeThesisCommitInput } from "./fixtures/thesis";
import {
  calculatePracticePnl,
  closePracticePosition,
  createPracticeLedger,
  createPracticePortfolio,
  mapInvalidationOutcomeToPracticeAction,
  openPracticePosition,
  recordPracticePosition,
  replacePracticePosition,
  type OpenPracticePositionInput,
  type PracticeResult,
} from "../lib/practice/ledger";
import {
  PRACTICE_CLOSE_REASONS,
  PRACTICE_POSITION_STATUSES,
  type PracticePosition,
  type PracticePortfolio,
} from "../lib/practice/types";
import type { Thesis, ThesisVersion } from "../lib/thesis/types";

function expectSuccess<T>(result: PracticeResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }
  return result.value;
}

function makePortfolio(
  overrides: Partial<Parameters<typeof createPracticePortfolio>[0]> = {},
): PracticePortfolio {
  return expectSuccess(
    createPracticePortfolio({
      id: "portfolio-1",
      createdAt: "2026-09-05T12:00:00.000Z",
      ...overrides,
    }),
  );
}

function makeCommittedThesis(
  direction: "LONG" | "SHORT" | "ABSTAIN" = "LONG",
): { thesis: Thesis; version: ThesisVersion } {
  const decision = makeDecisionResult(
    direction === "LONG"
      ? {
          decision: "LONG",
          provisionalDirection: "LONG",
          directionalScore: 70,
          thesisStrength: 70,
        }
      : direction === "SHORT"
        ? {
            decision: "SHORT",
            provisionalDirection: "SHORT",
            directionalScore: -70,
            thesisStrength: 70,
          }
        : {
            decision: "ABSTAIN",
            provisionalDirection: null,
            directionalScore: 0,
            thesisStrength: null,
          },
  );
  const result = createThesis(
    makeThesisCommitInput({
      thesisId: `thesis-${direction.toLowerCase()}`,
      versionId: `version-${direction.toLowerCase()}`,
      decision,
      ...(direction === "LONG" || direction === "SHORT"
        ? { killSwitch: makeKillSwitchAggregate("CLEAR") }
        : {}),
    }),
  );
  if (!result.ok) {
    throw new Error(`${result.code}: ${result.message}`);
  }
  return { thesis: result.thesis, version: result.version };
}

function makeOpenInput(
  overrides: Partial<OpenPracticePositionInput> = {},
): OpenPracticePositionInput {
  const committed = makeCommittedThesis();
  return {
    portfolio: makePortfolio(),
    existingPositions: [],
    thesis: committed.thesis,
    thesisVersion: committed.version,
    positionId: "position-1",
    entryPrice: 200,
    entryTime: "2026-09-05T12:01:00.000Z",
    ...overrides,
  };
}

function makeOpenPosition(
  overrides: Partial<OpenPracticePositionInput> = {},
): PracticePosition {
  return expectSuccess(openPracticePosition(makeOpenInput(overrides)));
}

describe("practice ledger", () => {
  it("creates the default $10,000 simulated portfolio with a $1,000 policy", () => {
    const portfolio = makePortfolio();

    expect(portfolio).toEqual({
      id: "portfolio-1",
      startingBalanceUsd: 10_000,
      defaultPositionNotionalUsd: 1_000,
      createdAt: "2026-09-05T12:00:00.000Z",
      policyVersion: "1.0.0",
    });
  });

  it.each([
    ["LONG", 200, 5],
    ["SHORT", 250, 4],
  ] as const)("opens a fixed-notional %s position from a committed ThesisVersion", (direction, entryPrice, quantity) => {
    const committed = makeCommittedThesis(direction);
    const position = makeOpenPosition({
      thesis: committed.thesis,
      thesisVersion: committed.version,
      entryPrice,
    });

    expect(position.direction).toBe(direction);
    expect(position.notionalUsd).toBe(1_000);
    expect(position.trackedQuantity).toBe(quantity);
    expect(position.thesisId).toBe(committed.thesis.id);
    expect(position.thesisVersionId).toBe(committed.version.id);
    expect(position.status).toBe(PRACTICE_POSITION_STATUSES.OPEN);
  });

  it("refuses to open a position from ABSTAIN", () => {
    const committed = makeCommittedThesis("ABSTAIN");
    const result = openPracticePosition(
      makeOpenInput({ thesis: committed.thesis, thesisVersion: committed.version }),
    );

    expect(result).toMatchObject({ ok: false, code: "ABSTAIN_HAS_NO_POSITION" });
  });

  it("rejects Thesis identity, asset and non-active committed-version mismatches", () => {
    const committed = makeCommittedThesis();
    expect(
      openPracticePosition(
        makeOpenInput({
          thesis: { ...committed.thesis, id: "other-thesis" },
          thesisVersion: committed.version,
        }),
      ),
    ).toMatchObject({ ok: false, code: "THESIS_ID_MISMATCH" });
    expect(
      openPracticePosition(
        makeOpenInput({
          thesis: { ...committed.thesis, asset: "ETH" },
          thesisVersion: committed.version,
        }),
      ),
    ).toMatchObject({ ok: false, code: "ASSET_MISMATCH" });
    expect(
      openPracticePosition(
        makeOpenInput({
          thesis: committed.thesis,
          thesisVersion: { ...committed.version, statusAtCommit: "WEAKENED" },
        }),
      ),
    ).toMatchObject({ ok: false, code: "THESIS_NOT_OPENABLE" });
  });

  it.each([
    ["LONG", 200, 220, 100, 10],
    ["LONG", 200, 180, -100, -10],
    ["SHORT", 200, 180, 100, 10],
    ["SHORT", 200, 220, -100, -10],
    ["LONG", 200, 200, 0, 0],
  ] as const)("calculates %s paper P&L without rounding", (direction, entryPrice, currentPrice, pnlUsd, pnlPercent) => {
    const committed = makeCommittedThesis(direction);
    const position = makeOpenPosition({
      thesis: committed.thesis,
      thesisVersion: committed.version,
      entryPrice,
    });
    const pnl = expectSuccess(calculatePracticePnl(position, currentPrice));

    expect(pnl).toEqual({ currentPrice, pnlUsd, pnlPercent });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid entry price %s",
    (entryPrice) => {
      const result = openPracticePosition(makeOpenInput({ entryPrice }));
      expect(result).toMatchObject({ ok: false, code: "INVALID_PRICE" });
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, "220"])(
    "rejects invalid current price %s",
    (currentPrice) => {
      const position = makeOpenPosition();
      const result = calculatePracticePnl(position, currentPrice as number);
      expect(result).toMatchObject({ ok: false, code: "INVALID_PRICE" });
    },
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, "1000"])(
    "rejects invalid position notional %s",
    (notionalUsd) => {
      const result = openPracticePosition(
        makeOpenInput({ notionalUsd: notionalUsd as number }),
      );
      expect(result).toMatchObject({ ok: false, code: "INVALID_NOTIONAL" });
    },
  );

  it("refuses a second open position for the same Thesis identity", () => {
    const first = makeOpenPosition();
    const result = openPracticePosition(
      makeOpenInput({
        existingPositions: [first],
        positionId: "position-2",
      }),
    );

    expect(result).toMatchObject({ ok: false, code: "POSITION_ALREADY_OPEN" });
  });

  it("closes a LONG position and freezes realized P&L without mutating the OPEN input", () => {
    const position = makeOpenPosition();
    const before = JSON.stringify(position);
    const closed = expectSuccess(
      closePracticePosition({
        position,
        exitPrice: 220,
        exitTime: "2026-09-05T13:00:00.000Z",
        closeReason: PRACTICE_CLOSE_REASONS.THESIS_WEAKENED,
      }),
    );

    expect(closed.status).toBe(PRACTICE_POSITION_STATUSES.CLOSED);
    expect(closed.realizedPnlUsd).toBe(100);
    expect(closed.realizedPnlPercent).toBe(10);
    expect(closed.closeReason).toBe(PRACTICE_CLOSE_REASONS.THESIS_WEAKENED);
    expect(JSON.stringify(position)).toBe(before);
    expect(position.status).toBe(PRACTICE_POSITION_STATUSES.OPEN);
  });

  it("closes a SHORT position with deterministic realized P&L", () => {
    const committed = makeCommittedThesis("SHORT");
    const position = makeOpenPosition({
      thesis: committed.thesis,
      thesisVersion: committed.version,
    });
    const closed = expectSuccess(
      closePracticePosition({
        position,
        exitPrice: 180,
        exitTime: "2026-09-05T13:00:00.000Z",
        closeReason: PRACTICE_CLOSE_REASONS.THESIS_INVALIDATED,
      }),
    );

    expect(closed.realizedPnlUsd).toBe(100);
    expect(closed.realizedPnlPercent).toBe(10);
  });

  it("refuses to close a CLOSED position twice", () => {
    const position = makeOpenPosition();
    const closed = expectSuccess(
      closePracticePosition({
        position,
        exitPrice: 220,
        exitTime: "2026-09-05T13:00:00.000Z",
        closeReason: PRACTICE_CLOSE_REASONS.MANUAL_CLOSE,
      }),
    );
    const result = closePracticePosition({
      position: closed,
      exitPrice: 230,
      exitTime: "2026-09-05T14:00:00.000Z",
      closeReason: PRACTICE_CLOSE_REASONS.MANUAL_CLOSE,
    });

    expect(result).toMatchObject({ ok: false, code: "POSITION_ALREADY_CLOSED" });
  });

  it("maps invalidation outcomes to position intent without closing or opening anything", () => {
    expect(mapInvalidationOutcomeToPracticeAction("MAINTAIN")).toEqual({
      outcome: "MAINTAIN",
      action: "KEEP_OPEN",
    });
    expect(mapInvalidationOutcomeToPracticeAction("WEAKEN")).toEqual({
      outcome: "WEAKEN",
      action: "CLOSE",
      recommendedCloseReason: "THESIS_WEAKENED",
    });
    expect(mapInvalidationOutcomeToPracticeAction("INVALIDATE")).toEqual({
      outcome: "INVALIDATE",
      action: "CLOSE",
      recommendedCloseReason: "THESIS_INVALIDATED",
    });
  });

  it("preserves a complete deterministic ledger history and collection ordering", () => {
    const portfolio = makePortfolio();
    const first = makeOpenPosition({
      portfolio,
      positionId: "position-b",
      entryTime: "2026-09-05T12:02:00.000Z",
    });
    const secondCommitted = makeCommittedThesis("SHORT");
    const second = makeOpenPosition({
      portfolio,
      positionId: "position-a",
      entryTime: "2026-09-05T12:01:00.000Z",
      thesis: secondCommitted.thesis,
      thesisVersion: secondCommitted.version,
    });
    const ledger = expectSuccess(createPracticeLedger(portfolio));
    const withFirst = expectSuccess(recordPracticePosition({ ledger, position: first }));
    const withBoth = expectSuccess(recordPracticePosition({ ledger: withFirst, position: second }));
    const closedFirst = expectSuccess(
      closePracticePosition({
        position: first,
        exitPrice: 220,
        exitTime: "2026-09-05T13:00:00.000Z",
        closeReason: PRACTICE_CLOSE_REASONS.MANUAL_CLOSE,
      }),
    );
    const finalLedger = expectSuccess(
      replacePracticePosition({ ledger: withBoth, position: closedFirst }),
    );

    expect(finalLedger.positions.map((position) => position.id)).toEqual([
      "position-a",
      "position-b",
    ]);
    expect(finalLedger.positions).toHaveLength(2);
    expect(finalLedger.positions.find((position) => position.id === "position-b")?.status).toBe(
      PRACTICE_POSITION_STATUSES.CLOSED,
    );
  });

  it("returns deeply equal serializable results for identical inputs and introduces no execution fields", () => {
    const input = makeOpenInput();
    const first = openPracticePosition(input);
    const second = openPracticePosition(input);

    expect(second).toEqual(first);
    const position = expectSuccess(first);
    expect(() => JSON.stringify(position)).not.toThrow();
    expect(position).not.toHaveProperty("walletAddress");
    expect(position).not.toHaveProperty("transactionHash");
    expect(position).not.toHaveProperty("exchangeOrderId");
  });
});
