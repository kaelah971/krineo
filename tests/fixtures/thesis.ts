import type { DecisionResult } from "../../lib/strategy/dm1/types";
import {
  type KillSwitchAggregateResult,
} from "../../lib/killswitch/types";
import {
  createThesis,
} from "../../lib/thesis/build";
import type {
  Thesis,
  ThesisCommitInput,
  ThesisVersion,
} from "../../lib/thesis/types";
import { makeCandidateEvaluation } from "./dm1";

export function makeDecisionResult(
  overrides: Partial<DecisionResult> = {},
): DecisionResult {
  return {
    ...makeCandidateEvaluation(),
    ...overrides,
  };
}

export function makeAbstainDecision(): DecisionResult {
  return makeDecisionResult({
    decision: "ABSTAIN",
    provisionalDirection: null,
    thesisStrength: null,
  });
}

export function makeKillSwitchAggregate(
  verdict: KillSwitchAggregateResult["verdict"],
): KillSwitchAggregateResult {
  return {
    verdict,
    severity:
      verdict === "CLEAR"
        ? "NONE"
        : verdict === "CAUTION"
          ? "HIGH"
          : "CRITICAL",
    effect:
      verdict === "VETO"
        ? "VETO"
        : verdict === "CAUTION"
          ? "CAUTION"
          : "NONE",
    results: [],
    reasonCodes: [],
    diagnostics: [],
  };
}

export function makeThesisCommitInput(
  overrides: Partial<ThesisCommitInput> = {},
): ThesisCommitInput {
  return {
    thesisId: "thesis-1",
    versionId: "version-1",
    createdAt: "2026-09-05T12:00:00.000Z",
    asset: "SOL",
    evidenceSnapshotId: "evidence-snapshot-1",
    decision: makeDecisionResult(),
    ...overrides,
  };
}

export function makeExistingThesisHistory(): {
  thesis: Thesis;
  versions: ThesisVersion[];
} {
  const result = createThesis(
    makeThesisCommitInput({
      killSwitch: makeKillSwitchAggregate("CLEAR"),
      killSwitchRunId: "killswitch-run-1",
    }),
  );

  if (!result.ok) {
    throw new Error(`Fixture setup failed: ${result.code}`);
  }

  return { thesis: result.thesis, versions: [result.version] };
}
