import { isCanonicalRfc3339Timestamp } from "../memory/signature";
import {
  PLAYBOOK_ACTORS,
  PLAYBOOK_REJECTION_CODES,
  PROPOSAL_STATUSES,
  type ApproveProposalInput,
  type ApproveProposalResult,
  type CreateInitialVersionInput,
  type CreateInitialVersionResult,
  type CreateProposalInput,
  type CreateProposalResult,
  type Playbook,
  type PlaybookRejection,
  type PlaybookRule,
  type PlaybookVersion,
  type Proposal,
  type RejectProposalInput,
  type RejectProposalResult,
  type ValidateHistoryInput,
  type ValidateHistoryResult,
} from "./types";

import { canonicalizeRules } from "./conditions";


function rejection(
  code: PlaybookRejection["code"],
  message: string,
): PlaybookRejection {
  return { ok: false, code, message };
}

function deepClone<T>(value: T): T {
  if (Array.isArray(value)) {
    return (value as ReadonlyArray<unknown>).map((entry) =>
      deepClone(entry),
    ) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      out[key] = deepClone(source[key]);
    }
    return out as unknown as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) {
      for (const entry of value) {
        deepFreeze(entry);
      }
    } else {
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        deepFreeze(record[key]);
      }
    }
    Object.freeze(value);
  }
  return value;
}

type CanonicalRulesSuccess = {
  readonly ok: true;
  readonly rules: PlaybookRule[];
};

function validateAndCanonicalizeRules(
  rules: unknown,
): CanonicalRulesSuccess | PlaybookRejection {
  try {
    const canonical = canonicalizeRules(rules);
    return { ok: true, rules: [...canonical] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = codeFromConditionError(message);
    return rejection(code, message);
  }
}

function codeFromConditionError(message: string): PlaybookRejection["code"] {
  if (/duplicate rule id/i.test(message)) {
    return PLAYBOOK_REJECTION_CODES.DUPLICATE_RULE_ID;
  }
  if (/at least one condition|conditions/i.test(message) && /empty|at least one/i.test(message)) {
    return PLAYBOOK_REJECTION_CODES.EMPTY_RULE_CONDITIONS;
  }
  if (/duplicate condition/i.test(message)) {
    return PLAYBOOK_REJECTION_CODES.INVALID_RULE;
  }
  return PLAYBOOK_REJECTION_CODES.INVALID_RULE;
}

export function createInitialVersion(
  input: CreateInitialVersionInput,
): CreateInitialVersionResult {
  if (
    typeof input.playbookId !== "string" ||
    input.playbookId.length === 0 ||
    typeof input.versionId !== "string" ||
    input.versionId.length === 0 ||
    typeof input.strategyId !== "string" ||
    input.strategyId.length === 0 ||
    typeof input.strategyVersion !== "string" ||
    input.strategyVersion.length === 0
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_INPUT,
      "playbookId, versionId, strategyId and strategyVersion are required.",
    );
  }
  if (input.approvedBy !== PLAYBOOK_ACTORS.HUMAN) {
    const code =
      input.approvedBy === PLAYBOOK_ACTORS.SYSTEM
        ? PLAYBOOK_REJECTION_CODES.SYSTEM_NOT_AUTHORIZED
        : PLAYBOOK_REJECTION_CODES.MODEL_NOT_AUTHORIZED;
    return rejection(
      code,
      "Initial playbook versions must be approved by a human.",
    );
  }
  if (
    !isCanonicalRfc3339Timestamp(input.createdAt) ||
    !isCanonicalRfc3339Timestamp(input.approvedAt)
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_TIMESTAMP,
      "createdAt and approvedAt must be canonical UTC RFC3339 timestamps.",
    );
  }
  if (Date.parse(input.approvedAt) < Date.parse(input.createdAt)) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_TIMESTAMP_ORDER,
      "approvedAt must be no earlier than createdAt.",
    );
  }
  if (
    input.sourceProposalId !== undefined &&
    (typeof input.sourceProposalId !== "string" ||
      input.sourceProposalId.length === 0)
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_INPUT,
      "sourceProposalId, when present, must be non-empty.",
    );
  }
  const rulesResult = validateAndCanonicalizeRules(input.rules);
  if (rulesResult.ok !== true) {
    return rulesResult;
  }
  const version: PlaybookVersion = {
    id: input.versionId,
    playbookId: input.playbookId,
    versionNumber: 1,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    rules: rulesResult.rules,
    createdAt: input.createdAt,
    approvedAt: input.approvedAt,
    approvedBy: PLAYBOOK_ACTORS.HUMAN,
    ...(input.sourceProposalId === undefined
      ? {}
      : { sourceProposalId: input.sourceProposalId }),
  };
  const playbook: Playbook = {
    id: input.playbookId,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    currentVersionId: input.versionId,
    currentVersionNumber: 1,
    createdAt: input.createdAt,
    updatedAt: input.approvedAt,
  };
  deepFreeze(playbook);
  deepFreeze(version);
  return { ok: true, playbook, version };
}

export function createProposal(
  input: CreateProposalInput,
): CreateProposalResult {
  if (
    typeof input.proposalId !== "string" ||
    input.proposalId.length === 0 ||
    typeof input.playbookId !== "string" ||
    input.playbookId.length === 0 ||
    typeof input.proposedVersionId !== "string" ||
    input.proposedVersionId.length === 0 ||
    typeof input.parentVersionId !== "string" ||
    input.parentVersionId.length === 0 ||
    typeof input.strategyId !== "string" ||
    input.strategyId.length === 0 ||
    typeof input.strategyVersion !== "string" ||
    input.strategyVersion.length === 0
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_INPUT,
      "proposalId, playbookId, proposedVersionId, parentVersionId, strategyId and strategyVersion are required.",
    );
  }
  if (
    typeof input.parentVersionNumber !== "number" ||
    !Number.isInteger(input.parentVersionNumber) ||
    input.parentVersionNumber < 1
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_INPUT,
      "parentVersionNumber must be a positive integer.",
    );
  }
  if (
    input.createdBy !== PLAYBOOK_ACTORS.HUMAN &&
    input.createdBy !== PLAYBOOK_ACTORS.SYSTEM &&
    input.createdBy !== PLAYBOOK_ACTORS.MODEL
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_INPUT,
      "createdBy must be HUMAN, SYSTEM, or MODEL.",
    );
  }
  if (!isCanonicalRfc3339Timestamp(input.createdAt)) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_TIMESTAMP,
      "createdAt must be a canonical UTC RFC3339 timestamp.",
    );
  }
  const rulesResult = validateAndCanonicalizeRules(input.rules);
  if (rulesResult.ok !== true) {
    return rulesResult;
  }
  const proposal: Proposal = {
    id: input.proposalId,
    playbookId: input.playbookId,
    proposedVersionId: input.proposedVersionId,
    parentVersionId: input.parentVersionId,
    parentVersionNumber: input.parentVersionNumber,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    rules: rulesResult.rules,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    status: PROPOSAL_STATUSES.PENDING,
  };
  deepFreeze(proposal);
  return { ok: true, proposal };
}

export function approveProposal(
  input: ApproveProposalInput,
): ApproveProposalResult {
  if (input.approvedBy !== PLAYBOOK_ACTORS.HUMAN) {
    const code =
      input.approvedBy === PLAYBOOK_ACTORS.SYSTEM
        ? PLAYBOOK_REJECTION_CODES.SYSTEM_NOT_AUTHORIZED
        : PLAYBOOK_REJECTION_CODES.MODEL_NOT_AUTHORIZED;
    return rejection(
      code,
      "Proposals must be approved by a human.",
    );
  }
  if (input.proposal.status !== PROPOSAL_STATUSES.PENDING) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.PROPOSAL_NOT_PENDING,
      "Only pending proposals can be approved.",
    );
  }
  if (!Array.isArray(input.versions) || input.versions.length === 0) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
      "Versions history must be non-empty.",
    );
  }
  const historyCheck = validateHistory({
    playbook: input.playbook,
    versions: input.versions,
  });
  if (historyCheck.ok !== true) {
    return historyCheck;
  }
  if (input.proposal.playbookId !== input.playbook.id) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_PLAYBOOK,
      "Proposal does not belong to the playbook.",
    );
  }
  const sorted = [...input.versions].sort(
    (a, b) => a.versionNumber - b.versionNumber,
  );
  const latest = sorted[sorted.length - 1] as PlaybookVersion;
  if (
    input.proposal.parentVersionId !== input.playbook.currentVersionId ||
    input.proposal.parentVersionNumber !==
      input.playbook.currentVersionNumber ||
    input.proposal.parentVersionId !== latest.id ||
    input.proposal.parentVersionNumber !== latest.versionNumber
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.STALE_PARENT,
      "Proposal parent does not match the playbook current version.",
    );
  }
  if (
    !isCanonicalRfc3339Timestamp(input.approvedAt) ||
    Date.parse(input.approvedAt) < Date.parse(input.proposal.createdAt)
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_TIMESTAMP_ORDER,
      "approvedAt must be canonical and no earlier than the proposal creation time.",
    );
  }
  if (
    input.versions.some(
      (version) => version.id === input.proposal.proposedVersionId,
    )
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.VERSION_ID_ALREADY_EXISTS,
      "The proposed version id already exists.",
    );
  }
  const versionNumber = latest.versionNumber + 1;
  const version: PlaybookVersion = {
    id: input.proposal.proposedVersionId,
    playbookId: input.playbook.id,
    versionNumber,
    strategyId: input.proposal.strategyId,
    strategyVersion: input.proposal.strategyVersion,
    rules: deepClone(input.proposal.rules),
    createdAt: input.approvedAt,
    approvedAt: input.approvedAt,
    approvedBy: PLAYBOOK_ACTORS.HUMAN,
    sourceProposalId: input.proposal.id,
    sourceProposalCreator: input.proposal.createdBy,
  };
  const playbook: Playbook = {
    id: input.playbook.id,
    strategyId: input.proposal.strategyId,
    strategyVersion: input.proposal.strategyVersion,
    currentVersionId: version.id,
    currentVersionNumber: versionNumber,
    createdAt: input.playbook.createdAt,
    updatedAt: input.approvedAt,
  };
  const proposal: Proposal = {
    id: input.proposal.id,
    playbookId: input.proposal.playbookId,
    proposedVersionId: input.proposal.proposedVersionId,
    parentVersionId: input.proposal.parentVersionId,
    parentVersionNumber: input.proposal.parentVersionNumber,
    strategyId: input.proposal.strategyId,
    strategyVersion: input.proposal.strategyVersion,
    rules: deepClone(input.proposal.rules),
    createdBy: input.proposal.createdBy,
    createdAt: input.proposal.createdAt,
    status: PROPOSAL_STATUSES.APPROVED,
    resolvedAt: input.approvedAt,
    resolvedBy: PLAYBOOK_ACTORS.HUMAN,
  };
  const versions: PlaybookVersion[] = [
    ...sorted.map((entry) => deepClone(entry)),
    version,
  ].sort((a, b) => a.versionNumber - b.versionNumber);
  deepFreeze(playbook);
  deepFreeze(version);
  deepFreeze(proposal);
  deepFreeze(versions);
  return { ok: true, playbook, version, proposal, versions };
}

export function rejectProposal(
  input: RejectProposalInput,
): RejectProposalResult {
  if (input.resolvedBy !== PLAYBOOK_ACTORS.HUMAN) {
    const code =
      input.resolvedBy === PLAYBOOK_ACTORS.SYSTEM
        ? PLAYBOOK_REJECTION_CODES.SYSTEM_NOT_AUTHORIZED
        : PLAYBOOK_REJECTION_CODES.MODEL_NOT_AUTHORIZED;
    return rejection(
      code,
      "Proposals must be rejected by a human.",
    );
  }
  if (input.proposal.status !== PROPOSAL_STATUSES.PENDING) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.PROPOSAL_NOT_PENDING,
      "Only pending proposals can be rejected.",
    );
  }
  if (
    !isCanonicalRfc3339Timestamp(input.rejectedAt) ||
    Date.parse(input.rejectedAt) < Date.parse(input.proposal.createdAt)
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_TIMESTAMP_ORDER,
      "rejectedAt must be canonical and no earlier than the proposal creation time.",
    );
  }
  if (
    typeof input.rejectionReason !== "string" ||
    input.rejectionReason.length === 0
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_INPUT,
      "A rejection reason is required.",
    );
  }
  const proposal: Proposal = {
    id: input.proposal.id,
    playbookId: input.proposal.playbookId,
    proposedVersionId: input.proposal.proposedVersionId,
    parentVersionId: input.proposal.parentVersionId,
    parentVersionNumber: input.proposal.parentVersionNumber,
    strategyId: input.proposal.strategyId,
    strategyVersion: input.proposal.strategyVersion,
    rules: deepClone(input.proposal.rules),
    createdBy: input.proposal.createdBy,
    createdAt: input.proposal.createdAt,
    status: PROPOSAL_STATUSES.REJECTED,
    resolvedAt: input.rejectedAt,
    resolvedBy: PLAYBOOK_ACTORS.HUMAN,
    rejectionReason: input.rejectionReason,
  };
  deepFreeze(proposal);
  return { ok: true, proposal };
}

export function validateHistory(
  input: ValidateHistoryInput,
): ValidateHistoryResult {
  if (!Array.isArray(input.versions) || input.versions.length === 0) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
      "Versions history must be non-empty.",
    );
  }
  if (
    typeof input.playbook.currentVersionId !== "string" ||
    input.playbook.currentVersionId.length === 0 ||
    typeof input.playbook.currentVersionNumber !== "number" ||
    !Number.isInteger(input.playbook.currentVersionNumber) ||
    input.playbook.currentVersionNumber < 1
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
      "Playbook current version pointer must be a positive integer version with a non-empty id.",
    );
  }
  const sorted = [...input.versions].sort(
    (a, b) => a.versionNumber - b.versionNumber,
  );
  const seen: Record<string, true> = {};
  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index] as PlaybookVersion;
    if (typeof entry.id !== "string" || entry.id.length === 0) {
      return rejection(
        PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
        "Version ids must be unique and non-empty.",
      );
    }
    if (seen[entry.id] === true) {
      return rejection(
        PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
        "Version ids must be unique and non-empty.",
      );
    }
    seen[entry.id] = true;
    if (entry.versionNumber !== index + 1) {
      return rejection(
        PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
        "Version numbers must be exactly contiguous from 1..N.",
      );
    }
    if (entry.playbookId !== input.playbook.id) {
      return rejection(
        PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
        "Every version must belong to the playbook.",
      );
    }
    if (
      typeof entry.strategyId !== "string" ||
      entry.strategyId.length === 0 ||
      typeof entry.strategyVersion !== "string" ||
      entry.strategyVersion.length === 0
    ) {
      return rejection(
        PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
        "Every version requires a strategy id and version.",
      );
    }
    if (
      !isCanonicalRfc3339Timestamp(entry.createdAt) ||
      !isCanonicalRfc3339Timestamp(entry.approvedAt) ||
      Date.parse(entry.approvedAt) < Date.parse(entry.createdAt)
    ) {
      return rejection(
        PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
        "Every version requires canonical timestamps with approvedAt no earlier than createdAt.",
      );
    }
    if (entry.approvedBy !== PLAYBOOK_ACTORS.HUMAN) {
      return rejection(
        PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
        "Every version must be human-approved.",
      );
    }
    if (
      entry.sourceProposalId !== undefined &&
      (typeof entry.sourceProposalId !== "string" ||
        entry.sourceProposalId.length === 0)
    ) {
      return rejection(
        PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
        "sourceProposalId, when present, must be non-empty.",
      );
    }
    if (
      entry.sourceProposalCreator !== undefined &&
      entry.sourceProposalCreator !== PLAYBOOK_ACTORS.HUMAN &&
      entry.sourceProposalCreator !== PLAYBOOK_ACTORS.SYSTEM &&
      entry.sourceProposalCreator !== PLAYBOOK_ACTORS.MODEL
    ) {
      return rejection(
        PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
        "sourceProposalCreator, when present, must be HUMAN, SYSTEM, or MODEL.",
      );
    }
    const rulesResult = validateAndCanonicalizeRules(entry.rules);
    if (rulesResult.ok !== true) {
      return rejection(
        PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
        rulesResult.message,
      );
    }
  }
  const last = sorted[sorted.length - 1] as PlaybookVersion;
  if (
    input.playbook.currentVersionId !== last.id ||
    input.playbook.currentVersionNumber !== last.versionNumber
  ) {
    return rejection(
      PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
      "Playbook current version must equal the latest history entry.",
    );
  }
  if (input.proposals !== undefined) {
    if (!Array.isArray(input.proposals)) {
      return rejection(
        PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
        "Proposals must be an array when present.",
      );
    }
    const byId: Record<string, PlaybookVersion> = {};
    const byNumber: Record<number, PlaybookVersion> = {};
    for (const entry of sorted) {
      byId[entry.id] = entry;
      byNumber[entry.versionNumber] = entry;
    }
    for (const entry of input.proposals) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        Array.isArray(entry)
      ) {
        return rejection(
          PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
          "Each proposal must be an object.",
        );
      }
      if (
        typeof entry.id !== "string" ||
        entry.id.length === 0 ||
        typeof entry.proposedVersionId !== "string" ||
        entry.proposedVersionId.length === 0 ||
        typeof entry.parentVersionId !== "string" ||
        entry.parentVersionId.length === 0
      ) {
        return rejection(
          PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
          "Each proposal requires non-empty ids.",
        );
      }
      if (entry.playbookId !== input.playbook.id) {
        return rejection(
          PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
          "Every proposal must belong to the playbook.",
        );
      }
      const parent = byId[entry.parentVersionId];
      if (
        parent === undefined ||
        parent.versionNumber !== entry.parentVersionNumber
      ) {
        return rejection(
          PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
          "Every proposal parent must reference a known history version.",
        );
      }
      if (
        entry.createdBy !== PLAYBOOK_ACTORS.HUMAN &&
        entry.createdBy !== PLAYBOOK_ACTORS.SYSTEM &&
        entry.createdBy !== PLAYBOOK_ACTORS.MODEL
      ) {
        return rejection(
          PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
          "Every proposal requires a known creator (HUMAN, SYSTEM, or MODEL).",
        );
      }
      if (!isCanonicalRfc3339Timestamp(entry.createdAt)) {
        return rejection(
          PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
          "Every proposal requires a canonical creation timestamp.",
        );
      }
      if (
        entry.status !== PROPOSAL_STATUSES.PENDING &&
        entry.status !== PROPOSAL_STATUSES.APPROVED &&
        entry.status !== PROPOSAL_STATUSES.REJECTED
      ) {
        return rejection(
          PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
          "Every proposal requires a known status.",
        );
      }
      if (entry.status === PROPOSAL_STATUSES.PENDING) {
        if (
          entry.resolvedAt !== undefined ||
          entry.resolvedBy !== undefined ||
          entry.rejectionReason !== undefined
        ) {
          return rejection(
            PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
            "Pending proposals must not have resolution fields.",
          );
        }
      } else {
        if (entry.resolvedBy !== PLAYBOOK_ACTORS.HUMAN) {
          return rejection(
            PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
            "Resolved proposals must be resolved by a human.",
          );
        }
        if (
          !isCanonicalRfc3339Timestamp(entry.resolvedAt) ||
          Date.parse(entry.resolvedAt) < Date.parse(entry.createdAt)
        ) {
          return rejection(
            PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
            "Resolved proposals require a canonical resolution timestamp no earlier than creation.",
          );
        }
        if (entry.status === PROPOSAL_STATUSES.REJECTED) {
          if (
            typeof entry.rejectionReason !== "string" ||
            entry.rejectionReason.length === 0
          ) {
            return rejection(
              PLAYBOOK_REJECTION_CODES.INVALID_HISTORY,
              "Rejected proposals require a rejection reason.",
            );
          }
        }
      }
    }
  }
  return { ok: true };
}
