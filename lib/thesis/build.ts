import {
  THESIS_LIFECYCLE_STATES,
  THESIS_REJECTION_CODES,
  type AppendThesisVersionInput,
  type AppendThesisVersionResult,
  type CreateThesisResult,
  type Thesis,
  type ThesisCommitInput,
  type ThesisRejection,
  type ThesisVersion,
} from "./types";

function rejection(
  code: ThesisRejection["code"],
  message: string,
): ThesisRejection {
  return { ok: false, code, message };
}

function validateCommitInput(
  input: ThesisCommitInput,
): ThesisRejection | null {
  if (
    input.thesisId.length === 0 ||
    input.versionId.length === 0 ||
    input.asset.length === 0 ||
    input.evidenceSnapshotId.length === 0 ||
    input.createdAt.length === 0
  ) {
    return rejection(
      THESIS_REJECTION_CODES.INVALID_COMMIT_INPUT,
      "Thesis and version identifiers, asset, evidence snapshot ID and timestamp are required.",
    );
  }

  if (
    input.decision.decision === "LONG" ||
    input.decision.decision === "SHORT"
  ) {
    if (input.killSwitch === undefined) {
      return rejection(
        THESIS_REJECTION_CODES.KILLSWITCH_REQUIRED,
        "Directional thesis commitment requires a KillSwitch aggregate result.",
      );
    }

    if (input.killSwitch.verdict === "VETO") {
      return rejection(
        THESIS_REJECTION_CODES.KILLSWITCH_VETO,
        "Directional thesis commitment was rejected by KillSwitch VETO.",
      );
    }

    if (input.killSwitch.verdict === "UNKNOWN") {
      return rejection(
        THESIS_REJECTION_CODES.KILLSWITCH_UNKNOWN,
        "Directional thesis commitment was rejected because KillSwitch is UNKNOWN.",
      );
    }
  }

  return null;
}

function toThesisVersion(
  input: ThesisCommitInput,
  versionNumber: number,
): ThesisVersion {
  const baseVersion = {
    id: input.versionId,
    thesisId: input.thesisId,
    versionNumber,
    asset: input.asset,
    statusAtCommit: statusForDecision(input.decision.decision),
    evidenceSnapshotId: input.evidenceSnapshotId,
    strategyId: input.decision.strategyId,
    strategyVersion: input.decision.strategyVersion,
    decision: input.decision.decision,
    directionalScore: input.decision.directionalScore,
    thesisStrength: input.decision.thesisStrength,
    coverage: input.decision.coverage,
    coverageLabel: input.decision.coverageLabel,
    conflict: input.decision.conflict,
    conflictLabel: input.decision.conflictLabel,
    risk: input.decision.risk,
    safety: input.decision.safety,
    regimeFit: input.decision.regimeFit,
    reasonCodes: [...input.decision.reasonCodes],
    warningCodes: [...input.decision.warningCodes],
    createdAt: input.createdAt,
  } satisfies Omit<ThesisVersion, "killSwitchVerdict" | "killSwitchRunId">;

  return {
    ...baseVersion,
    ...(input.killSwitch === undefined
      ? {}
      : { killSwitchVerdict: input.killSwitch.verdict }),
    ...(input.killSwitchRunId === undefined
      ? {}
      : { killSwitchRunId: input.killSwitchRunId }),
  };
}

function statusForDecision(
  decision: ThesisCommitInput["decision"]["decision"],
): Thesis["status"] {
  return decision === "ABSTAIN"
    ? THESIS_LIFECYCLE_STATES.ABSTAINED
    : THESIS_LIFECYCLE_STATES.ACTIVE;
}

export function createThesis(
  input: ThesisCommitInput,
): CreateThesisResult {
  const invalidInput = validateCommitInput(input);
  if (invalidInput !== null) {
    return invalidInput;
  }

  const version = toThesisVersion(input, 1);
  const thesis: Thesis = {
    id: input.thesisId,
    asset: input.asset,
    currentVersionId: version.id,
    currentVersionNumber: version.versionNumber,
    status: statusForDecision(input.decision.decision),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };

  return { ok: true, thesis, version };
}

function validateVersionHistory(
  input: AppendThesisVersionInput,
): ThesisRejection | null {
  if (input.thesisId !== input.thesis.id) {
    return rejection(
      THESIS_REJECTION_CODES.THESIS_ID_MISMATCH,
      "The commit thesis ID does not match the existing Thesis identity.",
    );
  }

  if (input.asset !== input.thesis.asset) {
    return rejection(
      THESIS_REJECTION_CODES.ASSET_MISMATCH,
      "The commit asset does not match the existing Thesis identity.",
    );
  }

  if (input.versions.length === 0) {
    return rejection(
      THESIS_REJECTION_CODES.INVALID_VERSION_HISTORY,
      "A Thesis must have at least one existing version before append.",
    );
  }

  const versionNumbers = input.versions.map((version) => version.versionNumber);
  const highestVersionNumber = Math.max(...versionNumbers);
  const versionIds = new Set<string>();

  for (let index = 0; index < input.versions.length; index += 1) {
    const version = input.versions[index];
    if (
      version.thesisId !== input.thesis.id ||
      version.asset !== input.thesis.asset ||
      version.versionNumber !== index + 1 ||
      !Number.isInteger(version.versionNumber) ||
      version.versionNumber < 1 ||
      versionIds.has(version.id)
    ) {
      return rejection(
        THESIS_REJECTION_CODES.INVALID_VERSION_HISTORY,
        "Thesis versions must share identity and asset and form a unique contiguous sequence starting at version 1.",
      );
    }
    versionIds.add(version.id);
  }

  const currentVersion = input.versions[input.versions.length - 1];
  if (
    input.thesis.currentVersionNumber !== highestVersionNumber ||
    input.thesis.currentVersionId !== currentVersion.id
  ) {
    return rejection(
      THESIS_REJECTION_CODES.INVALID_VERSION_HISTORY,
      "The Thesis current-version pointer does not match the highest existing version.",
    );
  }

  if (versionIds.has(input.versionId)) {
    return rejection(
      THESIS_REJECTION_CODES.VERSION_ID_ALREADY_EXISTS,
      "The new ThesisVersion ID already exists in the append-only history.",
    );
  }

  return null;
}

export function appendThesisVersion(
  input: AppendThesisVersionInput,
): AppendThesisVersionResult {
  const invalidInput = validateCommitInput(input);
  if (invalidInput !== null) {
    return invalidInput;
  }

  const invalidHistory = validateVersionHistory(input);
  if (invalidHistory !== null) {
    return invalidHistory;
  }

  if (input.thesis.status === THESIS_LIFECYCLE_STATES.CLOSED) {
    return rejection(
      THESIS_REJECTION_CODES.THESIS_CLOSED,
      "A closed Thesis cannot receive a new version.",
    );
  }

  if (input.thesis.status === THESIS_LIFECYCLE_STATES.INVALIDATED) {
    return rejection(
      THESIS_REJECTION_CODES.THESIS_INVALIDATED,
      "An invalidated Thesis cannot receive a new version.",
    );
  }

  const previousVersionNumber = input.versions[input.versions.length - 1].versionNumber;
  const version = toThesisVersion(input, previousVersionNumber + 1);
  const thesis: Thesis = {
    ...input.thesis,
    currentVersionId: version.id,
    currentVersionNumber: version.versionNumber,
    status: statusForDecision(input.decision.decision),
    updatedAt: input.createdAt,
  };

  return {
    ok: true,
    thesis,
    version,
    versions: [...input.versions, version],
  };
}
