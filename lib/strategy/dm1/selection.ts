import { DM1_CONFIG } from "./config";
import type {
  AutonomousSelectionResult,
  CandidateEvaluation,
  DM1Config,
} from "./types";
import { REASON_CODES } from "./reason-codes";

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function markedCandidates(
  candidates: readonly CandidateEvaluation[],
  selectedAsset: string | null,
): CandidateEvaluation[] {
  return candidates.map((candidate) => ({
    ...candidate,
    selected: selectedAsset !== null && candidate.asset === selectedAsset,
  }));
}

export function selectAutonomousCandidate(
  candidates: readonly CandidateEvaluation[],
  config: DM1Config = DM1_CONFIG,
): AutonomousSelectionResult {
  const eligible = candidates.filter(
    (candidate) =>
      candidate.decision !== "ABSTAIN" && candidate.thesisStrength !== null,
  );
  const ranked = [...eligible].sort((left, right) => {
      const strengthDifference =
        (right.thesisStrength ?? -Infinity) -
        (left.thesisStrength ?? -Infinity);
      if (strengthDifference !== 0) {
        return strengthDifference;
      }

      const conflictDifference =
        (left.conflict ?? Infinity) - (right.conflict ?? Infinity);
      if (conflictDifference !== 0) {
        return conflictDifference;
      }

      const coverageDifference = right.coverage - left.coverage;
      if (coverageDifference !== 0) {
        return coverageDifference;
      }

      // Use code-unit ordering for canonical state, not locale-sensitive sorting.
      return left.asset < right.asset ? -1 : left.asset > right.asset ? 1 : 0;
    });

  if (ranked.length === 0) {
    return {
      decision: "ABSTAIN",
      selected: null,
      candidates: markedCandidates(candidates, null),
      rankedCandidates: [],
      reasonCodes: [REASON_CODES.INSUFFICIENT_DIRECTIONAL_EVIDENCE],
      warningCodes: unique(candidates.flatMap((candidate) => candidate.warningCodes)),
    };
  }

  const top = ranked[0];
  const runnerUp = ranked[1];
  const strengthEdge =
    runnerUp === undefined
      ? Infinity
      : (top.thesisStrength ?? -Infinity) -
        (runnerUp.thesisStrength ?? -Infinity);

  if (
    runnerUp !== undefined &&
    strengthEdge < config.minimumRelativeEdge
  ) {
    return {
      decision: "ABSTAIN",
      selected: null,
      candidates: markedCandidates(candidates, null),
      rankedCandidates: markedCandidates(ranked, null),
      reasonCodes: [REASON_CODES.NO_CLEAR_RELATIVE_WINNER],
      warningCodes: unique([
        ...top.warningCodes,
        ...runnerUp.warningCodes,
      ]),
    };
  }

  const selected = top;
  return {
    decision: selected.decision,
    selected: { ...selected, selected: true },
    candidates: markedCandidates(candidates, selected.asset),
    rankedCandidates: markedCandidates(ranked, selected.asset),
    reasonCodes: selected.reasonCodes,
    warningCodes: selected.warningCodes,
  };
}
