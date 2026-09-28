import {
  approveProposal,
  canonicalizeRules,
  createProposal,
  PLAYBOOK_ACTORS,
  rejectProposal,
  validateRule,
  type ApproveProposalSuccess,
  type PlaybookRule,
  type Proposal,
  type RejectProposalSuccess,
} from "../playbook";
import {
  detectLessonCandidates,
  lessonCandidateToRule,
  type LessonCandidate,
} from "../memory/lessons";
import type { DemoGovernanceState } from "./governance";
import type { DemoPlaybookAuthoringState } from "./authoring";

export type DemoMemoryLessonStatus =
  | "NONE"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "DUPLICATE";

export interface DemoMemoryLessonProposal {
  readonly candidate: LessonCandidate;
  readonly rule: PlaybookRule;
  readonly proposal: Proposal;
}

export interface DemoMemoryLessonState {
  readonly candidates: readonly LessonCandidate[];
  readonly selectedCandidate: LessonCandidate | null;
  readonly lesson: DemoMemoryLessonProposal | null;
  readonly status: DemoMemoryLessonStatus;
  readonly message: string | null;
}

export interface CreateDemoMemoryLessonStateInput {
  readonly governance: DemoGovernanceState;
  readonly proposalIdPrefix: string;
  readonly proposedVersionIdPrefix: string;
  readonly createdAt: string;
  readonly pendingProposals?: readonly Proposal[];
}

export interface DemoMemoryLessonTransitionFailure {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

export interface DemoMemoryLessonApprovalSuccess {
  readonly ok: true;
  readonly state: DemoMemoryLessonState;
  readonly approval: ApproveProposalSuccess;
}

export interface DemoMemoryLessonRejectionSuccess {
  readonly ok: true;
  readonly state: DemoMemoryLessonState;
  readonly rejection: RejectProposalSuccess;
}

function failure(
  code: string,
  message: string,
): DemoMemoryLessonTransitionFailure {
  return { ok: false, code, message };
}

function equivalentRule(left: PlaybookRule, right: PlaybookRule): boolean {
  try {
    const canonicalLeft = validateRule(left);
    const canonicalRight = validateRule(right);
    return (
      canonicalLeft.effect === canonicalRight.effect &&
      JSON.stringify(canonicalLeft.conditions) ===
        JSON.stringify(canonicalRight.conditions)
    );
  } catch {
    return false;
  }
}

function containsEquivalentRule(
  rules: readonly PlaybookRule[],
  target: PlaybookRule,
): boolean {
  return rules.some((rule) => equivalentRule(rule, target));
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function baseState(
  candidates: readonly LessonCandidate[],
  selectedCandidate: LessonCandidate | null,
  lesson: DemoMemoryLessonProposal | null,
  status: DemoMemoryLessonStatus,
  message: string | null,
): DemoMemoryLessonState {
  return { candidates, selectedCandidate, lesson, status, message };
}

/**
 * Creates one inert SYSTEM proposal from the strongest deterministic lesson.
 * The caller supplies all proposal identity and time values; this function has
 * no persistence and never changes the active Playbook.
 */
export function createDemoMemoryLessonState(
  input: CreateDemoMemoryLessonStateInput,
): DemoMemoryLessonState {
  const candidates = detectLessonCandidates(input.governance.historicalCases);
  if (candidates.length === 0) {
    return baseState(candidates, null, null, "NONE", null);
  }

  const pendingProposals = (input.pendingProposals ?? []).filter(
    (proposal) => proposal.status === "PENDING",
  );
  const pendingRules = pendingProposals.flatMap((proposal) => proposal.rules);
  const selectedCandidate = candidates.find((candidate) => {
    const candidateRule = lessonCandidateToRule(candidate);
    return (
      !containsEquivalentRule(input.governance.playbookVersion.rules, candidateRule) &&
      !containsEquivalentRule(pendingRules, candidateRule)
    );
  }) ?? null;
  if (selectedCandidate === null) {
    return baseState(
      candidates,
      candidates[0] ?? null,
      null,
      "DUPLICATE",
      "This lesson is already represented by the active Playbook or a pending proposal.",
    );
  }

  const rule = lessonCandidateToRule(selectedCandidate);

  const conditionSlug = `${slug(selectedCandidate.condition.field)}-${slug(selectedCandidate.condition.value)}`;
  let rules: readonly PlaybookRule[];
  try {
    rules = canonicalizeRules([
      ...input.governance.playbookVersion.rules,
      rule,
    ]);
  } catch (error) {
    return baseState(
      candidates,
      selectedCandidate,
      null,
      "NONE",
      error instanceof Error ? error.message : "The lesson rule could not be validated.",
    );
  }

  const proposalResult = createProposal({
    proposalId: `${input.proposalIdPrefix}-${conditionSlug}`,
    playbookId: input.governance.playbook.id,
    proposedVersionId: `${input.proposedVersionIdPrefix}-v${input.governance.playbookVersion.versionNumber + 1}-${conditionSlug}`,
    parentVersionId: input.governance.playbookVersion.id,
    parentVersionNumber: input.governance.playbookVersion.versionNumber,
    strategyId: input.governance.playbookVersion.strategyId,
    strategyVersion: input.governance.playbookVersion.strategyVersion,
    rules,
    createdBy: PLAYBOOK_ACTORS.SYSTEM,
    createdAt: input.createdAt,
  });
  if (proposalResult.ok !== true) {
    return baseState(
      candidates,
      selectedCandidate,
      null,
      "NONE",
      proposalResult.message,
    );
  }

  return baseState(
    candidates,
    selectedCandidate,
    { candidate: selectedCandidate, rule, proposal: proposalResult.proposal },
    "PENDING",
    null,
  );
}

export function approveDemoMemoryLesson(
  state: DemoMemoryLessonState,
  authoring: DemoPlaybookAuthoringState,
  approvedAt: string,
): DemoMemoryLessonApprovalSuccess | DemoMemoryLessonTransitionFailure {
  if (state.lesson === null || state.status !== "PENDING") {
    return failure("PROPOSAL_NOT_PENDING", "There is no pending memory lesson to approve.");
  }

  const approval = approveProposal({
    playbook: authoring.playbook,
    versions: authoring.versions,
    proposal: state.lesson.proposal,
    approvedAt,
    approvedBy: PLAYBOOK_ACTORS.HUMAN,
  });
  if (approval.ok !== true) {
    return failure(approval.code, approval.message);
  }

  return {
    ok: true,
    state: {
      ...state,
      lesson: { ...state.lesson, proposal: approval.proposal },
      status: "APPROVED",
      message: null,
    },
    approval,
  };
}

export function rejectDemoMemoryLesson(
  state: DemoMemoryLessonState,
  rejectedAt: string,
): DemoMemoryLessonRejectionSuccess | DemoMemoryLessonTransitionFailure {
  if (state.lesson === null || state.status !== "PENDING") {
    return failure("PROPOSAL_NOT_PENDING", "There is no pending memory lesson to dismiss.");
  }

  const rejection = rejectProposal({
    proposal: state.lesson.proposal,
    rejectedAt,
    resolvedBy: PLAYBOOK_ACTORS.HUMAN,
    rejectionReason: "Dismissed by the human reviewer in the demo session.",
  });
  if (rejection.ok !== true) {
    return failure(rejection.code, rejection.message);
  }

  return {
    ok: true,
    state: {
      ...state,
      lesson: { ...state.lesson, proposal: rejection.proposal },
      status: "REJECTED",
      message: null,
    },
    rejection,
  };
}
