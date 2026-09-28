import { selectAutonomousCandidate } from "../strategy/dm1/selection";
import type { CandidateEvaluation } from "../strategy/dm1/types";
import { buildStrategyDiff, type StrategyDiff } from "../thesis/diff";
import {
  evaluateDM1Invalidation,
  type InvalidationEvaluation,
} from "../thesis/invalidation";
import { appendThesisVersion } from "../thesis/build";
import { buildThesisReceipt } from "../thesis/receipt";
import type {
  InvalidationRule,
  Thesis,
  ThesisReceipt,
  ThesisVersion,
} from "../thesis/types";
import type { EvidenceItem } from "../evidence/types";
import type { KillSwitchAggregateResult } from "../killswitch/types";
import {
  buildDemoPractice,
  type DemoPracticeState,
  type DemoScenario,
} from "./scenarios";
import type { DemoCommitResult } from "./commit";

export type DemoRefreshBlockReason =
  | "THESIS_REJECTED"
  | "DIFF_REJECTED"
  | "INVALIDATION_REJECTED"
  | "RECEIPT_REJECTED";

export interface DemoRefreshSuccess {
  readonly ok: true;
  readonly thesis: Thesis;
  readonly previousVersion: ThesisVersion;
  readonly version: ThesisVersion;
  readonly currentDecision: CandidateEvaluation;
  readonly currentCandidates: readonly CandidateEvaluation[];
  readonly currentEvidence: readonly EvidenceItem[];
  readonly currentKillSwitch: KillSwitchAggregateResult;
  readonly invalidationRules: readonly InvalidationRule[];
  readonly diff: StrategyDiff;
  readonly invalidation: InvalidationEvaluation | null;
  readonly receipt: ThesisReceipt;
  readonly practice: DemoPracticeState;
}

export interface DemoRefreshBlocked {
  readonly ok: false;
  readonly reason: DemoRefreshBlockReason;
  readonly message: string;
}

export type DemoRefreshResult = DemoRefreshSuccess | DemoRefreshBlocked;

function blocked(
  reason: DemoRefreshBlockReason,
  message: string,
): DemoRefreshBlocked {
  return { ok: false, reason, message };
}

export function refreshDemoScenario(
  scenario: DemoScenario,
  committed: DemoCommitResult,
): DemoRefreshResult {
  if (!committed.ok) {
    return blocked(
      "THESIS_REJECTED",
      "Refresh requires a successful explicit commit before a new version can be created.",
    );
  }

  const currentSelection = selectAutonomousCandidate(scenario.currentCandidates);
  const currentDecision = currentSelection.selected ?? scenario.currentDecision;
  const currentRules =
    currentDecision.decision === "ABSTAIN" ? [] : scenario.invalidationRules;
  const appended = appendThesisVersion({
    thesisId: committed.thesis.id,
    versionId: `${committed.thesis.id}-v2`,
    createdAt: scenario.currentVersion.createdAt,
    asset: committed.thesis.asset,
    evidenceSnapshotId: scenario.currentVersion.evidenceSnapshotId,
    decision: currentDecision,
    thesis: committed.thesis,
    versions: [committed.version],
    ...(currentDecision.decision === "ABSTAIN"
      ? {}
      : {
          killSwitch: scenario.currentKillSwitch,
          killSwitchRunId: `${scenario.id}-killswitch-refresh`,
        }),
  });

  if (!appended.ok) {
    return blocked("THESIS_REJECTED", appended.message);
  }

  const diffResult = buildStrategyDiff({
    before: {
      version: committed.version,
      normalizerVersion: "fixture-normalizer-1",
      evidenceItems: committed.evidence,
      candidateEvaluations: committed.selection.candidates,
      invalidationRules: committed.invalidationRules,
    },
    after: {
      version: appended.version,
      normalizerVersion: "fixture-normalizer-1",
      evidenceItems: scenario.currentEvidence,
      candidateEvaluations: currentSelection.candidates,
      invalidationRules: currentRules,
    },
  });

  if (!diffResult.ok) {
    return blocked("DIFF_REJECTED", diffResult.message);
  }

  const invalidationResult =
    committed.version.decision === "ABSTAIN"
      ? null
      : evaluateDM1Invalidation({
          originalVersion: committed.version,
          invalidationRules: committed.invalidationRules,
          strategyDiff: diffResult.diff,
          latestDecision: currentDecision,
          currentThesis: {
            id: appended.thesis.id,
            asset: appended.thesis.asset,
            status: appended.thesis.status,
          },
        });

  if (invalidationResult !== null && !invalidationResult.ok) {
    return blocked("INVALIDATION_REJECTED", invalidationResult.message);
  }

  const receiptResult = buildThesisReceipt({
    thesis: appended.thesis,
    version: appended.version,
    receiptId: `${committed.thesis.id}-receipt-v2`,
    normalizerVersion: "fixture-normalizer-1",
    evidenceItems: scenario.currentEvidence,
    candidateEvaluations: currentSelection.candidates,
    invalidationRules: currentRules,
    ...(currentDecision.decision === "ABSTAIN"
      ? {}
      : {
          killSwitch: scenario.currentKillSwitch,
          killSwitchRunId: `${scenario.id}-killswitch-refresh`,
        }),
  });

  if (!receiptResult.ok) {
    return blocked("RECEIPT_REJECTED", receiptResult.message);
  }

  const invalidation = invalidationResult?.evaluation ?? null;
  return {
    ok: true,
    thesis: appended.thesis,
    previousVersion: committed.version,
    version: appended.version,
    currentDecision,
    currentCandidates: currentSelection.candidates,
    currentEvidence: scenario.currentEvidence,
    currentKillSwitch: scenario.currentKillSwitch,
    invalidationRules: currentRules,
    diff: diffResult.diff,
    invalidation,
    receipt: receiptResult.receipt,
    practice: buildDemoPractice(
      scenario.id,
      appended.thesis,
      committed.version,
      invalidation,
    ),
  };
}
