import { selectAutonomousCandidate } from "../strategy/dm1/selection";
import type { AutonomousSelectionResult } from "../strategy/dm1/types";
import type { EvidenceItem } from "../evidence/types";
import { createThesis } from "../thesis/build";
import { buildThesisReceipt } from "../thesis/receipt";
import type {
  InvalidationRule,
  Thesis,
  ThesisReceipt,
  ThesisVersion,
} from "../thesis/types";
import {
  buildDemoPractice,
  type DemoPracticeState,
  type DemoScenario,
  type DemoScenarioPhase,
} from "./scenarios";

export type DemoCommitBlockReason =
  | "ABSTAIN"
  | "KILLSWITCH_VETO"
  | "KILLSWITCH_UNKNOWN"
  | "THESIS_REJECTED"
  | "RECEIPT_REJECTED";

export interface DemoCommitSuccess {
  readonly ok: true;
  readonly selection: AutonomousSelectionResult;
  readonly thesis: Thesis;
  readonly version: ThesisVersion;
  readonly receipt: ThesisReceipt;
  readonly practice: DemoPracticeState;
  readonly evidence: readonly EvidenceItem[];
  readonly invalidationRules: readonly InvalidationRule[];
}

export interface DemoCommitBlocked {
  readonly ok: false;
  readonly selection: AutonomousSelectionResult;
  readonly reason: DemoCommitBlockReason;
  readonly message: string;
}

export type DemoCommitResult = DemoCommitSuccess | DemoCommitBlocked;

function blocked(
  selection: AutonomousSelectionResult,
  reason: DemoCommitBlockReason,
  message: string,
): DemoCommitBlocked {
  return { ok: false, selection, reason, message };
}

export function commitDemoScenario(
  scenario: DemoScenario,
  phase: DemoScenarioPhase = "current",
): DemoCommitResult {
  const isOriginal = phase === "original";
  const candidates = isOriginal
    ? scenario.originalCandidates
    : scenario.currentCandidates;
  const evidence = isOriginal ? scenario.originalEvidence : scenario.currentEvidence;
  const killSwitch = isOriginal
    ? scenario.originalKillSwitch
    : scenario.currentKillSwitch;
  const invalidationRules = isOriginal
    ? scenario.originalInvalidationRules
    : scenario.invalidationRules;
  const versionSnapshot = isOriginal
    ? scenario.originalVersion
    : scenario.currentVersion;
  const selection = selectAutonomousCandidate(candidates);
  const selected = selection.selected;

  if (selected === null) {
    return blocked(
      selection,
      "ABSTAIN",
      "No thesis was committed. The candidate selector found no directional winner with sufficient evidence.",
    );
  }

  if (killSwitch.verdict === "VETO") {
    return blocked(
      selection,
      "KILLSWITCH_VETO",
      "No thesis was committed. KillSwitch VETO blocks directional commitment.",
    );
  }

  if (killSwitch.verdict === "UNKNOWN") {
    return blocked(
      selection,
      "KILLSWITCH_UNKNOWN",
      "No thesis was committed. KillSwitch UNKNOWN requires more evidence before commitment.",
    );
  }

  const thesisId = `${scenario.thesis.id}-commit`;
  const created = createThesis({
    thesisId,
    versionId: `${thesisId}-v1`,
    createdAt: versionSnapshot.createdAt,
    asset: selected.asset,
    evidenceSnapshotId: versionSnapshot.evidenceSnapshotId,
    decision: selected,
    killSwitch,
    killSwitchRunId: `${scenario.id}-killswitch-commit`,
  });

  if (!created.ok) {
    return blocked(selection, "THESIS_REJECTED", created.message);
  }

  const receiptResult = buildThesisReceipt({
    thesis: created.thesis,
    version: created.version,
    receiptId: `${thesisId}-receipt-v1`,
    normalizerVersion: "fixture-normalizer-1",
    evidenceItems: evidence,
    candidateEvaluations: selection.candidates,
    killSwitch,
    killSwitchRunId: `${scenario.id}-killswitch-commit`,
    invalidationRules,
  });

  if (!receiptResult.ok) {
    return blocked(selection, "RECEIPT_REJECTED", receiptResult.message);
  }

  return {
    ok: true,
    selection,
    thesis: created.thesis,
    version: created.version,
    receipt: receiptResult.receipt,
    practice: buildDemoPractice(scenario.id, created.thesis, created.version, null),
    evidence,
    invalidationRules,
  };
}
