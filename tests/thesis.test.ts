import { describe, expect, it } from "vitest";
import {
  appendThesisVersion,
  createThesis,
} from "../lib/thesis/build";
import {
  THESIS_REJECTION_CODES,
  THESIS_LIFECYCLE_STATES,
  type AppendThesisVersionInput,
  type Thesis,
  type ThesisVersion,
} from "../lib/thesis/types";
import {
  makeAbstainDecision,
  makeDecisionResult,
  makeExistingThesisHistory,
  makeKillSwitchAggregate,
  makeThesisCommitInput,
} from "./fixtures/thesis";

function makeAppendInput(
  thesis: Thesis,
  versions: readonly ThesisVersion[],
  overrides: Partial<AppendThesisVersionInput> = {},
): AppendThesisVersionInput {
  return {
    ...makeThesisCommitInput({
      thesisId: thesis.id,
      versionId: "version-2",
      createdAt: "2026-09-05T13:00:00.000Z",
      asset: thesis.asset,
      evidenceSnapshotId: "evidence-snapshot-2",
      decision: makeDecisionResult({ directionalScore: 80, thesisStrength: 80 }),
      killSwitch: makeKillSwitchAggregate("CLEAR"),
    }),
    thesis,
    versions,
    ...overrides,
  };
}

describe("Thesis creation and commitment eligibility", () => {
  it("creates a LONG thesis with CLEAR KillSwitch as ACTIVE version 1", () => {
    const result = createThesis(
      makeThesisCommitInput({
        killSwitch: makeKillSwitchAggregate("CLEAR"),
        killSwitchRunId: "killswitch-run-1",
      }),
    );

    expect(result).toEqual({
      ok: true,
      thesis: {
        id: "thesis-1",
        asset: "SOL",
        currentVersionId: "version-1",
        currentVersionNumber: 1,
        status: "ACTIVE",
        createdAt: "2026-09-05T12:00:00.000Z",
        updatedAt: "2026-09-05T12:00:00.000Z",
      },
      version: expect.objectContaining({
        id: "version-1",
        thesisId: "thesis-1",
        versionNumber: 1,
        decision: "LONG",
        killSwitchVerdict: "CLEAR",
        killSwitchRunId: "killswitch-run-1",
      }),
    });
  });

  it("creates a SHORT thesis with CAUTION and preserves the verdict", () => {
    const result = createThesis(
      makeThesisCommitInput({
        decision: makeDecisionResult({
          decision: "SHORT",
          provisionalDirection: "SHORT",
          directionalScore: -75,
          thesisStrength: 75,
        }),
        killSwitch: makeKillSwitchAggregate("CAUTION"),
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.thesis.status).toBe(THESIS_LIFECYCLE_STATES.ACTIVE);
      expect(result.version.decision).toBe("SHORT");
      expect(result.version.killSwitchVerdict).toBe("CAUTION");
    }
  });

  it("records ABSTAIN without requiring KillSwitch", () => {
    const result = createThesis(
      makeThesisCommitInput({ decision: makeAbstainDecision() }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.thesis.status).toBe(THESIS_LIFECYCLE_STATES.ABSTAINED);
      expect(result.version.versionNumber).toBe(1);
      expect(result.version.decision).toBe("ABSTAIN");
      expect(result.version.killSwitchVerdict).toBeUndefined();
    }
  });

  it.each(["LONG", "SHORT"] as const)(
    "rejects %s without KillSwitch",
    (decision) => {
      const result = createThesis(
        makeThesisCommitInput({
          decision: makeDecisionResult({ decision }),
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: THESIS_REJECTION_CODES.KILLSWITCH_REQUIRED,
      });
    },
  );

  it("rejects a directional thesis after KillSwitch VETO", () => {
    const result = createThesis(
      makeThesisCommitInput({
        killSwitch: makeKillSwitchAggregate("VETO"),
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      code: THESIS_REJECTION_CODES.KILLSWITCH_VETO,
    });
  });

  it("rejects a directional thesis after critical KillSwitch UNKNOWN", () => {
    const result = createThesis(
      makeThesisCommitInput({
        killSwitch: makeKillSwitchAggregate("UNKNOWN"),
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      code: THESIS_REJECTION_CODES.KILLSWITCH_UNKNOWN,
    });
  });

  it("does not mutate DecisionResult or KillSwitch input during create", () => {
    const decision = makeDecisionResult();
    const killSwitch = makeKillSwitchAggregate("CAUTION");
    const input = makeThesisCommitInput({ decision, killSwitch });
    const before = JSON.stringify(input);
    const decisionBefore = JSON.stringify(decision);
    const killSwitchBefore = JSON.stringify(killSwitch);

    createThesis(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(decision)).toBe(decisionBefore);
    expect(JSON.stringify(killSwitch)).toBe(killSwitchBefore);
  });
});

describe("Append-only ThesisVersion lifecycle", () => {
  it("appends a directional version with the next version number", () => {
    const { thesis, versions } = makeExistingThesisHistory();
    const result = appendThesisVersion(makeAppendInput(thesis, versions));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.version.versionNumber).toBe(2);
      expect(result.version.id).toBe("version-2");
      expect(result.thesis.currentVersionId).toBe("version-2");
      expect(result.thesis.currentVersionNumber).toBe(2);
      expect(result.versions.map((version) => version.versionNumber)).toEqual([1, 2]);
    }
  });

  it("keeps v1 deeply unchanged and preserves createdAt", () => {
    const { thesis, versions } = makeExistingThesisHistory();
    const originalThesis = JSON.stringify(thesis);
    const originalVersions = JSON.stringify(versions);
    const result = appendThesisVersion(makeAppendInput(thesis, versions));

    expect(result.ok).toBe(true);
    expect(JSON.stringify(thesis)).toBe(originalThesis);
    expect(JSON.stringify(versions)).toBe(originalVersions);
    if (result.ok) {
      expect(result.thesis.createdAt).toBe(thesis.createdAt);
      expect(result.thesis.updatedAt).toBe("2026-09-05T13:00:00.000Z");
      expect(JSON.stringify(result.versions[0])).toBe(JSON.stringify(versions[0]));
    }
  });

  it("allows ABSTAINED to become ACTIVE after eligible direction", () => {
    const initial = createThesis(
      makeThesisCommitInput({ decision: makeAbstainDecision() }),
    );
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;

    const result = appendThesisVersion(
      makeAppendInput(initial.thesis, [initial.version]),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.thesis.status).toBe(THESIS_LIFECYCLE_STATES.ACTIVE);
    }
  });

  it("allows ABSTAINED to remain ABSTAINED", () => {
    const initial = createThesis(
      makeThesisCommitInput({ decision: makeAbstainDecision() }),
    );
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;

    const result = appendThesisVersion(
      makeAppendInput(initial.thesis, [initial.version], {
        versionId: "version-2-abstain",
        decision: makeAbstainDecision(),
        killSwitch: undefined,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.thesis.status).toBe(THESIS_LIFECYCLE_STATES.ABSTAINED);
      expect(result.version.decision).toBe("ABSTAIN");
    }
  });

  it("allows ACTIVE to become ABSTAINED without inferring invalidation", () => {
    const { thesis, versions } = makeExistingThesisHistory();
    const result = appendThesisVersion(
      makeAppendInput(thesis, versions, {
        versionId: "version-2-abstain",
        decision: makeAbstainDecision(),
        killSwitch: undefined,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.thesis.status).toBe(THESIS_LIFECYCLE_STATES.ABSTAINED);
      expect(result.thesis.status).not.toBe(THESIS_LIFECYCLE_STATES.INVALIDATED);
    }
  });

  it("allows WEAKENED to recover to ACTIVE for an eligible direction", () => {
    const { thesis: original, versions } = makeExistingThesisHistory();
    const weakened: Thesis = {
      ...original,
      status: THESIS_LIFECYCLE_STATES.WEAKENED,
    };
    const result = appendThesisVersion(makeAppendInput(weakened, versions));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.thesis.status).toBe(THESIS_LIFECYCLE_STATES.ACTIVE);
    }
  });

  it.each([
    [THESIS_LIFECYCLE_STATES.CLOSED, THESIS_REJECTION_CODES.THESIS_CLOSED],
    [THESIS_LIFECYCLE_STATES.INVALIDATED, THESIS_REJECTION_CODES.THESIS_INVALIDATED],
  ] as const)("rejects append to %s", (status, code) => {
    const { thesis, versions } = makeExistingThesisHistory();
    const terminal: Thesis = { ...thesis, status };

    const result = appendThesisVersion(makeAppendInput(terminal, versions));

    expect(result).toMatchObject({ ok: false, code });
  });

  it("rejects an asset mismatch", () => {
    const { thesis, versions } = makeExistingThesisHistory();
    const result = appendThesisVersion(
      makeAppendInput(thesis, versions, { asset: "ETH" }),
    );

    expect(result).toMatchObject({
      ok: false,
      code: THESIS_REJECTION_CODES.ASSET_MISMATCH,
    });
  });

  it("rejects an existing version with the wrong Thesis identity or asset", () => {
    const { thesis, versions } = makeExistingThesisHistory();
    const wrongThesisVersion: ThesisVersion = {
      ...versions[0],
      thesisId: "different-thesis",
    };
    const wrongAssetVersion: ThesisVersion = {
      ...versions[0],
      asset: "ETH",
    };

    expect(
      appendThesisVersion(makeAppendInput(thesis, [wrongThesisVersion])),
    ).toMatchObject({
      ok: false,
      code: THESIS_REJECTION_CODES.INVALID_VERSION_HISTORY,
    });
    expect(
      appendThesisVersion(makeAppendInput(thesis, [wrongAssetVersion])),
    ).toMatchObject({
      ok: false,
      code: THESIS_REJECTION_CODES.INVALID_VERSION_HISTORY,
    });
  });

  it("rejects a Thesis ID mismatch", () => {
    const { thesis, versions } = makeExistingThesisHistory();
    const result = appendThesisVersion(
      makeAppendInput(thesis, versions, { thesisId: "different-thesis" }),
    );

    expect(result).toMatchObject({
      ok: false,
      code: THESIS_REJECTION_CODES.THESIS_ID_MISMATCH,
    });
  });

  it("rejects empty, duplicate, gapped, and out-of-order history", () => {
    const { thesis, versions } = makeExistingThesisHistory();

    expect(
      appendThesisVersion(makeAppendInput(thesis, [], {})),
    ).toMatchObject({ ok: false, code: THESIS_REJECTION_CODES.INVALID_VERSION_HISTORY });

    const duplicateNumber: ThesisVersion = {
      ...versions[0],
      id: "duplicate-number",
      versionNumber: 1,
    };
    expect(
      appendThesisVersion(makeAppendInput(thesis, [versions[0], duplicateNumber], {})),
    ).toMatchObject({ ok: false, code: THESIS_REJECTION_CODES.INVALID_VERSION_HISTORY });

    const gappedNumber: ThesisVersion = {
      ...versions[0],
      id: "gapped-number",
      versionNumber: 3,
    };
    expect(
      appendThesisVersion(makeAppendInput(thesis, [gappedNumber], {})),
    ).toMatchObject({ ok: false, code: THESIS_REJECTION_CODES.INVALID_VERSION_HISTORY });

    const outOfOrder: ThesisVersion = {
      ...versions[0],
      id: "out-of-order",
      versionNumber: 2,
    };
    expect(
      appendThesisVersion(makeAppendInput(thesis, [outOfOrder, versions[0]], {})),
    ).toMatchObject({ ok: false, code: THESIS_REJECTION_CODES.INVALID_VERSION_HISTORY });
  });

  it("rejects current-version pointer mismatch and duplicate version IDs", () => {
    const { thesis, versions } = makeExistingThesisHistory();
    const badPointer: Thesis = {
      ...thesis,
      currentVersionId: "wrong-version",
    };
    expect(
      appendThesisVersion(makeAppendInput(badPointer, versions, { thesisId: badPointer.id })),
    ).toMatchObject({ ok: false, code: THESIS_REJECTION_CODES.INVALID_VERSION_HISTORY });

    expect(
      appendThesisVersion(makeAppendInput(thesis, versions, { versionId: versions[0].id })),
    ).toMatchObject({ ok: false, code: THESIS_REJECTION_CODES.VERSION_ID_ALREADY_EXISTS });
  });

  it("does not mutate append inputs or nested decision and KillSwitch state", () => {
    const { thesis, versions } = makeExistingThesisHistory();
    const decision = makeDecisionResult();
    const killSwitch = makeKillSwitchAggregate("CAUTION");
    const input = makeAppendInput(thesis, versions, {
      decision,
      killSwitch,
    });
    const before = JSON.stringify(input);

    appendThesisVersion(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(thesis)).toBe(JSON.stringify(input.thesis));
    expect(JSON.stringify(versions)).toBe(JSON.stringify(input.versions));
    expect(JSON.stringify(decision)).toBe(JSON.stringify(input.decision));
    expect(JSON.stringify(killSwitch)).toBe(JSON.stringify(input.killSwitch));
  });

  it("replays identical supplied inputs deterministically", () => {
    const { thesis, versions } = makeExistingThesisHistory();
    const input = makeAppendInput(thesis, versions);

    expect(appendThesisVersion(input)).toEqual(appendThesisVersion(input));
  });

  it("returns serializable thesis and version output", () => {
    const created = createThesis(
      makeThesisCommitInput({
        killSwitch: makeKillSwitchAggregate("CLEAR"),
      }),
    );
    expect(JSON.parse(JSON.stringify(created))).toEqual(created);

    const { thesis, versions } = makeExistingThesisHistory();
    const appended = appendThesisVersion(makeAppendInput(thesis, versions));
    expect(JSON.parse(JSON.stringify(appended))).toEqual(appended);
  });
});
