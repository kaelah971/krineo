import {
  canonicalizeRules,
  approveProposal,
  createProposal,
  PLAYBOOK_ACTORS,
  rejectProposal,
  validateRule,
  type ApproveProposalSuccess,
  type ConditionOperator,
  type Playbook,
  type PlaybookRule,
  type PlaybookVersion,
  type Proposal,
} from "../playbook";
import type { CandidateEvaluation, DM1EvidenceSnapshot } from "../strategy/dm1/types";
import {
  evaluateDemoGovernanceVersion,
  DEMO_SESSION_PLAYBOOK_PROVENANCE,
  type DemoGovernanceState,
} from "./governance";

export type DemoAuthorableField =
  | "decision"
  | "regimeFit"
  | "risk"
  | "safety"
  | "DIRECTIONAL_MOMENTUM"
  | "TECHNICAL_CONFLUENCE"
  | "RELATIVE_OPPORTUNITY"
  | "MARKET_ALIGNMENT"
  | "SENTIMENT_DERIVATIVES"
  | "coverage"
  | "conflict"
  | "memory.rankedCaseCount"
  | "memory.comparableCaseCount"
  | "memory.highSimilarityCaseCount";

export type DemoAuthoringOperator = "EQUALS" | "GTE" | "LTE";
export type DemoAuthoringEffect = "CAUTION" | "WAIT" | "BLOCK";

type DemoAuthorableFieldKind = "enum" | "unit" | "count";

export interface DemoAuthorableFieldConfig {
  readonly value: DemoAuthorableField;
  readonly label: string;
  readonly kind: DemoAuthorableFieldKind;
  readonly values?: readonly string[];
  readonly operators: readonly DemoAuthoringOperator[];
  readonly defaultValue: string;
}

export const DEMO_AUTHORABLE_FIELDS: readonly DemoAuthorableFieldConfig[] = [
  {
    value: "decision",
    label: "Market decision",
    kind: "enum",
    values: ["LONG", "SHORT", "ABSTAIN"],
    operators: ["EQUALS"],
    defaultValue: "LONG",
  },
  {
    value: "regimeFit",
    label: "Market regime",
    kind: "enum",
    values: ["FIT", "DEGRADED", "BROKEN", "UNKNOWN"],
    operators: ["EQUALS"],
    defaultValue: "DEGRADED",
  },
  {
    value: "risk",
    label: "Risk",
    kind: "enum",
    values: ["ACCEPTABLE", "ELEVATED", "EXTREME", "UNKNOWN"],
    operators: ["EQUALS"],
    defaultValue: "ELEVATED",
  },
  {
    value: "safety",
    label: "Safety",
    kind: "enum",
    values: ["CLEAR", "VETO", "UNKNOWN"],
    operators: ["EQUALS"],
    defaultValue: "VETO",
  },
  {
    value: "DIRECTIONAL_MOMENTUM",
    label: "Directional momentum",
    kind: "enum",
    values: [
      "STRONGLY_SUPPORTIVE",
      "SUPPORTIVE",
      "NEUTRAL",
      "OPPOSING",
      "STRONGLY_OPPOSING",
      "UNKNOWN",
    ],
    operators: ["EQUALS"],
    defaultValue: "UNKNOWN",
  },
  {
    value: "TECHNICAL_CONFLUENCE",
    label: "Technical confluence",
    kind: "enum",
    values: [
      "STRONGLY_SUPPORTIVE",
      "SUPPORTIVE",
      "NEUTRAL",
      "OPPOSING",
      "STRONGLY_OPPOSING",
      "UNKNOWN",
    ],
    operators: ["EQUALS"],
    defaultValue: "UNKNOWN",
  },
  {
    value: "RELATIVE_OPPORTUNITY",
    label: "Relative opportunity",
    kind: "enum",
    values: [
      "STRONGLY_SUPPORTIVE",
      "SUPPORTIVE",
      "NEUTRAL",
      "OPPOSING",
      "STRONGLY_OPPOSING",
      "UNKNOWN",
    ],
    operators: ["EQUALS"],
    defaultValue: "UNKNOWN",
  },
  {
    value: "MARKET_ALIGNMENT",
    label: "Market alignment",
    kind: "enum",
    values: [
      "STRONGLY_SUPPORTIVE",
      "SUPPORTIVE",
      "NEUTRAL",
      "OPPOSING",
      "STRONGLY_OPPOSING",
      "UNKNOWN",
    ],
    operators: ["EQUALS"],
    defaultValue: "UNKNOWN",
  },
  {
    value: "SENTIMENT_DERIVATIVES",
    label: "Sentiment / derivatives",
    kind: "enum",
    values: [
      "STRONGLY_SUPPORTIVE",
      "SUPPORTIVE",
      "NEUTRAL",
      "OPPOSING",
      "STRONGLY_OPPOSING",
      "UNKNOWN",
    ],
    operators: ["EQUALS"],
    defaultValue: "UNKNOWN",
  },
  {
    value: "coverage",
    label: "Evidence coverage",
    kind: "unit",
    operators: ["GTE", "LTE"],
    defaultValue: "0.8",
  },
  {
    value: "conflict",
    label: "Evidence conflict",
    kind: "unit",
    operators: ["GTE", "LTE"],
    defaultValue: "0.2",
  },
  {
    value: "memory.rankedCaseCount",
    label: "Ranked memory cases",
    kind: "count",
    operators: ["GTE", "LTE"],
    defaultValue: "1",
  },
  {
    value: "memory.comparableCaseCount",
    label: "Comparable memory cases",
    kind: "count",
    operators: ["GTE", "LTE"],
    defaultValue: "1",
  },
  {
    value: "memory.highSimilarityCaseCount",
    label: "High-similarity memory cases",
    kind: "count",
    operators: ["GTE", "LTE"],
    defaultValue: "1",
  },
];

export const DEMO_AUTHORING_EFFECTS: readonly DemoAuthoringEffect[] = [
  "CAUTION",
  "WAIT",
  "BLOCK",
];

export interface DemoRuleDraft {
  readonly field: DemoAuthorableField;
  readonly operator: DemoAuthoringOperator;
  readonly value: string;
  readonly effect: DemoAuthoringEffect;
}

export interface DemoRuleBuildSuccess {
  readonly ok: true;
  readonly rule: PlaybookRule;
}

export interface DemoRuleBuildFailure {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

export type DemoRuleBuildResult = DemoRuleBuildSuccess | DemoRuleBuildFailure;

export interface DemoAuthoredProposal {
  readonly proposal: Proposal;
  readonly rule: PlaybookRule;
}

export interface DemoPlaybookAuthoringState {
  readonly playbook: Playbook;
  readonly versions: readonly PlaybookVersion[];
  readonly activeVersion: PlaybookVersion;
  readonly proposals: readonly DemoAuthoredProposal[];
  readonly pendingProposal: DemoAuthoredProposal | null;
  readonly nextProposalSequence: number;
}

export interface DemoAuthoringTransitionSuccess {
  readonly ok: true;
  readonly state: DemoPlaybookAuthoringState;
}

export interface DemoAuthoringTransitionFailure {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

export type DemoAuthoringTransition =
  | DemoAuthoringTransitionSuccess
  | DemoAuthoringTransitionFailure;

const AUTHORING_CREATED_AT = "2026-09-05T12:04:00.000Z";
const AUTHORING_APPROVED_AT = "2026-09-05T12:05:00.000Z";
const AUTHORING_REJECTED_AT = "2026-09-05T12:05:00.000Z";

function fieldConfig(field: DemoAuthorableField): DemoAuthorableFieldConfig | undefined {
  return DEMO_AUTHORABLE_FIELDS.find((entry) => entry.value === field);
}

function humanize(value: string): string {
  return value
    .replaceAll("memory.", "")
    .replaceAll("_", " ")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function errorFrom(error: unknown, fallback: string): DemoRuleBuildFailure {
  const message = error instanceof Error ? error.message : fallback;
  const code = message.split(":")[0] || "INVALID_RULE";
  return { ok: false, code, message };
}

function numericValue(
  config: DemoAuthorableFieldConfig,
  value: string,
): number | DemoRuleBuildFailure {
  if (value.trim() === "") {
    return { ok: false, code: "INVALID_RULE", message: "A threshold is required." };
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, code: "NON_FINITE_NUMBER", message: "Threshold must be finite." };
  }
  if (config.kind === "count") {
    if (!Number.isInteger(parsed) || parsed < 0) {
      return {
        ok: false,
        code: "OUT_OF_RANGE_NUMBER",
        message: "Memory counts must be non-negative integers.",
      };
    }
    return parsed;
  }
  if (parsed < 0 || parsed > 1) {
    return {
      ok: false,
      code: "OUT_OF_RANGE_NUMBER",
      message: "Coverage and conflict thresholds must be within 0 and 1.",
    };
  }
  return parsed;
}

export function buildDemoRule(draft: DemoRuleDraft): DemoRuleBuildResult {
  const config = fieldConfig(draft.field);
  if (config === undefined) {
    return { ok: false, code: "INVALID_RULE", message: "That field is not authorable." };
  }
  if (!config.operators.includes(draft.operator)) {
    return {
      ok: false,
      code: "UNSUPPORTED_OPERATOR",
      message: `${config.label} does not support that operator.`,
    };
  }
  if (!DEMO_AUTHORING_EFFECTS.includes(draft.effect)) {
    return { ok: false, code: "INVALID_RULE", message: "Choose a supported rule effect." };
  }

  let value: string | number = draft.value;
  if (config.kind === "enum") {
    if (!config.values?.includes(draft.value)) {
      return { ok: false, code: "CONDITION_VALUE_TYPE_MISMATCH", message: "Choose a supported value." };
    }
  } else {
    const parsed = numericValue(config, draft.value);
    if (typeof parsed !== "number") return parsed;
    value = parsed;
  }

  const rule = {
    id: `authored-${slug(draft.field)}-${draft.operator.toLowerCase()}-${slug(draft.value)}-${draft.effect.toLowerCase()}`,
    effect: draft.effect,
    conditions: [{ field: draft.field, operator: draft.operator, value }],
  };

  try {
    return { ok: true, rule: validateRule(rule) };
  } catch (error) {
    return errorFrom(error, "The rule could not be validated.");
  }
}

export function getDemoAuthorableField(
  field: DemoAuthorableField,
): DemoAuthorableFieldConfig {
  return fieldConfig(field) ?? DEMO_AUTHORABLE_FIELDS[0];
}

export function describeDemoRule(rule: PlaybookRule): string {
  const conditions = rule.conditions.map((condition) => {
    const field = humanize(String(condition.field));
    const label =
      condition.field === "regimeFit"
        ? "the market regime"
        : condition.field === "decision"
          ? "the market decision"
          : field;
    const raw = condition as unknown as Record<string, unknown>;
    if (condition.operator === "GTE") {
      return `${label} is at least ${String(raw.value)}`;
    }
    if (condition.operator === "LTE") {
      return `${label} is at most ${String(raw.value)}`;
    }
    return `${label} is ${humanize(String(raw.value))}`;
  });
  const when = conditions.join(" and ");
  const effect = rule.effect === "CAUTION" ? "Caution" : rule.effect === "WAIT" ? "Wait" : "Block";
  return `${effect} when ${when}.`;
}

function transitionFailure(error: unknown, fallback: string): DemoAuthoringTransitionFailure {
  if (error instanceof Error) {
    const [code, ...rest] = error.message.split(":");
    return { ok: false, code: code || "INVALID_RULE", message: rest.join(":").trim() || error.message };
  }
  return { ok: false, code: "INVALID_RULE", message: fallback };
}

export function createDemoPlaybookAuthoringState(
  governance: DemoGovernanceState,
): DemoPlaybookAuthoringState {
  return {
    playbook: governance.playbook,
    versions: [governance.playbookVersion],
    activeVersion: governance.playbookVersion,
    proposals: [],
    pendingProposal: null,
    nextProposalSequence: 1,
  };
}

export function applyApprovedDemoProposal(
  state: DemoPlaybookAuthoringState,
  approval: ApproveProposalSuccess,
): DemoPlaybookAuthoringState {
  return {
    ...state,
    playbook: approval.playbook,
    versions: approval.versions,
    activeVersion: approval.version,
    pendingProposal: null,
  };
}

export function proposeDemoRule(
  state: DemoPlaybookAuthoringState,
  rule: PlaybookRule,
): DemoAuthoringTransition {
  if (state.pendingProposal !== null) {
    return {
      ok: false,
      code: "PROPOSAL_NOT_PENDING",
      message: "Resolve the pending proposal before creating another rule.",
    };
  }

  let nextRules: readonly PlaybookRule[];
  try {
    nextRules = canonicalizeRules([...state.activeVersion.rules, rule]);
  } catch (error) {
    return transitionFailure(error, "The authored rule could not be added to the Playbook.");
  }

  const sequence = state.nextProposalSequence;
  const proposalResult = createProposal({
    proposalId: `${state.playbook.id}-proposal-${sequence}`,
    playbookId: state.playbook.id,
    proposedVersionId: `${state.playbook.id}-v${state.activeVersion.versionNumber + 1}-proposal-${sequence}`,
    parentVersionId: state.activeVersion.id,
    parentVersionNumber: state.activeVersion.versionNumber,
    strategyId: state.activeVersion.strategyId,
    strategyVersion: state.activeVersion.strategyVersion,
    rules: nextRules,
    createdBy: PLAYBOOK_ACTORS.HUMAN,
    createdAt: AUTHORING_CREATED_AT,
  });
  if (proposalResult.ok !== true) {
    return {
      ok: false,
      code: proposalResult.code,
      message: proposalResult.message,
    };
  }

  const authoredProposal: DemoAuthoredProposal = {
    proposal: proposalResult.proposal,
    rule,
  };
  return {
    ok: true,
    state: {
      ...state,
      proposals: [...state.proposals, authoredProposal],
      pendingProposal: authoredProposal,
      nextProposalSequence: sequence + 1,
    },
  };
}

export function approveDemoRule(
  state: DemoPlaybookAuthoringState,
): DemoAuthoringTransition {
  const pending = state.pendingProposal;
  if (pending === null) {
    return { ok: false, code: "PROPOSAL_NOT_PENDING", message: "There is no pending rule to approve." };
  }

  const approved = approveProposal({
    playbook: state.playbook,
    versions: state.versions,
    proposal: pending.proposal,
    approvedAt: AUTHORING_APPROVED_AT,
    approvedBy: PLAYBOOK_ACTORS.HUMAN,
  });
  if (approved.ok !== true) {
    return { ok: false, code: approved.code, message: approved.message };
  }

  const proposals = state.proposals.map((entry) =>
    entry.proposal.id === pending.proposal.id
      ? { ...entry, proposal: approved.proposal }
      : entry,
  );
  return {
    ok: true,
    state: {
      ...state,
      playbook: approved.playbook,
      versions: approved.versions,
      activeVersion: approved.version,
      proposals,
      pendingProposal: null,
    },
  };
}

export function rejectDemoRule(
  state: DemoPlaybookAuthoringState,
): DemoAuthoringTransition {
  const pending = state.pendingProposal;
  if (pending === null) {
    return { ok: false, code: "PROPOSAL_NOT_PENDING", message: "There is no pending rule to reject." };
  }

  const rejected = rejectProposal({
    proposal: pending.proposal,
    rejectedAt: AUTHORING_REJECTED_AT,
    resolvedBy: PLAYBOOK_ACTORS.HUMAN,
    rejectionReason: "Cancelled by the human author in the demo session.",
  });
  if (rejected.ok !== true) {
    return { ok: false, code: rejected.code, message: rejected.message };
  }

  const proposals = state.proposals.map((entry) =>
    entry.proposal.id === pending.proposal.id
      ? { ...entry, proposal: rejected.proposal }
      : entry,
  );
  return {
    ok: true,
    state: {
      ...state,
      proposals,
      pendingProposal: null,
    },
  };
}

export function evaluateDemoAuthoring(
  state: DemoPlaybookAuthoringState,
  baseGovernance: DemoGovernanceState,
  marketResult: CandidateEvaluation,
  evidence: DM1EvidenceSnapshot,
): DemoGovernanceState {
  return evaluateDemoGovernanceVersion({
    base: baseGovernance,
    marketResult,
    evidence,
    playbook: state.playbook,
    playbookVersion: state.activeVersion,
    playbookProvenance:
      state.activeVersion.id === baseGovernance.playbookVersion.id
        ? baseGovernance.playbookProvenance
        : DEMO_SESSION_PLAYBOOK_PROVENANCE,
  });
}

export function authoringOperatorFor(
  field: DemoAuthorableField,
): readonly ConditionOperator[] {
  return getDemoAuthorableField(field).operators;
}