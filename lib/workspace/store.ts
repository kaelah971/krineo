import type { DecisionState } from "../evidence/types";
import {
  createInitialVersion,
  PLAYBOOK_ACTORS,
  type Playbook,
  type PlaybookRule,
  type PlaybookVersion,
} from "../playbook";
import type {
  PracticePnl,
  PracticePosition,
} from "../practice/types";
import type {
  ResearchMode,
  ResearchRun,
  ResearchRunStatus,
} from "../research";
import type { ThesisReceipt } from "../thesis/types";

export const WORKSPACE_STORAGE_KEY = "krineo.workspace.v2";
export const LEGACY_WORKSPACE_STORAGE_KEY = "krineo.workspace.v1";

export type WorkspaceProfile = {
  readonly displayName: string;
  readonly workspaceName: string;
  readonly createdAt: string;
};

export interface WorkspacePlaybook {
  readonly id: string;
  readonly displayName: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly playbook: Playbook;
  readonly version: PlaybookVersion;
}

export interface WorkspaceResearchRun {
  readonly id: string;
  readonly mode: ResearchMode;
  readonly providerSource: string;
  readonly replayFixtureId?: string;
  readonly providerStatus: string;
  readonly providerWarnings: readonly string[];
  readonly providerFailures: readonly string[];
  readonly status: ResearchRunStatus;
  readonly outcome: ResearchRun["outcome"];
  readonly selectedAsset: string | null;
  readonly marketDecision: DecisionState;
  readonly finalDecision: DecisionState;
  readonly reasonCodes: readonly string[];
  readonly preflightStatus: string;
  readonly killSwitchVerdict: string;
  readonly createdAt: string;
  readonly playbookVersionId: string;
  readonly receiptId?: string;
  readonly receiptHash?: string;
  readonly practicePositionId?: string;
  readonly thesisId?: string;
  readonly thesisVersionId?: string;
}

export interface WorkspaceThesis {
  readonly id: string;
  readonly versionId: string;
  readonly asset: string;
  readonly decision: DecisionState;
  readonly status: "PROPOSED" | "COMMITTED";
  readonly evidenceSnapshotId: string;
  readonly createdAt: string;
  readonly sourceRunId: string;
  readonly playbookVersionId: string;
  readonly receiptId?: string;
  readonly receiptHash?: string;
}

export interface WorkspacePracticePosition {
  readonly sourceRunId: string;
  readonly position: PracticePosition;
  readonly pnl: PracticePnl | null;
}

export interface WorkspaceState {
  readonly version: 2;
  readonly profile: WorkspaceProfile;
  readonly playbooks: readonly WorkspacePlaybook[];
  readonly researchRuns: readonly WorkspaceResearchRun[];
  readonly theses: readonly WorkspaceThesis[];
  readonly receipts: readonly ThesisReceipt[];
  readonly practicePositions: readonly WorkspacePracticePosition[];
  readonly memoryLessonsAwaitingReview: readonly Record<string, unknown>[];
}

export type LocalWorkspaceProfile = WorkspaceProfile;
export type LocalWorkspaceState = WorkspaceState;

const STARTER_RULES: readonly PlaybookRule[] = [
  {
    id: "wait-on-abstain",
    effect: "WAIT",
    conditions: [
      { field: "decision", operator: "EQUALS", value: "ABSTAIN" },
    ],
  },
  {
    id: "block-on-safety-veto",
    effect: "BLOCK",
    conditions: [{ field: "safety", operator: "EQUALS", value: "VETO" }],
  },
  {
    id: "caution-on-extreme-risk",
    effect: "CAUTION",
    conditions: [{ field: "risk", operator: "EQUALS", value: "EXTREME" }],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecordArray(value: unknown): value is readonly Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

function isWorkspaceProfile(value: unknown): value is WorkspaceProfile {
  return (
    isRecord(value) &&
    isNonEmptyString(value.displayName) &&
    isNonEmptyString(value.workspaceName) &&
    isNonEmptyString(value.createdAt)
  );
}

function isWorkspacePlaybook(value: unknown): value is WorkspacePlaybook {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.displayName) || typeof value.active !== "boolean") return false;
  if (!isNonEmptyString(value.createdAt) || !isNonEmptyString(value.updatedAt) || !isRecord(value.playbook) || !isRecord(value.version)) return false;
  return isNonEmptyString(value.version.id) && isNonEmptyString(value.version.playbookId) && Array.isArray(value.version.rules) && value.version.rules.every((rule) => isRecord(rule) && isNonEmptyString(rule.id) && Array.isArray(rule.conditions) && rule.conditions.every((condition) => isRecord(condition) && isNonEmptyString(condition.field) && isNonEmptyString(condition.operator)));
}

function isWorkspaceResearchRun(value: unknown): value is WorkspaceResearchRun {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    (value.mode === "LIVE" || value.mode === "REPLAY") &&
    isNonEmptyString(value.providerSource) &&
    isNonEmptyString(value.status) &&
    isNonEmptyString(value.outcome) &&
    Array.isArray(value.reasonCodes) && value.reasonCodes.every(isNonEmptyString) &&
    Array.isArray(value.providerWarnings) && value.providerWarnings.every(isNonEmptyString) &&
    Array.isArray(value.providerFailures) && value.providerFailures.every(isNonEmptyString) &&
    isNonEmptyString(value.preflightStatus) &&
    isNonEmptyString(value.killSwitchVerdict) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.playbookVersionId)
  );
}

function isWorkspaceThesis(value: unknown): value is WorkspaceThesis {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.versionId) &&
    isNonEmptyString(value.asset) &&
    isNonEmptyString(value.decision) &&
    (value.status === "PROPOSED" || value.status === "COMMITTED") &&
    isNonEmptyString(value.evidenceSnapshotId) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.sourceRunId) &&
    isNonEmptyString(value.playbookVersionId)
  );
}

function isWorkspaceReceipt(value: unknown): value is ThesisReceipt {
  return isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.canonicalHash) && isNonEmptyString(value.asset) && isNonEmptyString(value.createdAt);
}

function isWorkspacePracticePosition(value: unknown): value is WorkspacePracticePosition {
  if (!isRecord(value) || !isNonEmptyString(value.sourceRunId) || !isRecord(value.position)) return false;
  return isNonEmptyString(value.position.id) && isNonEmptyString(value.position.asset) && isNonEmptyString(value.position.direction) && (value.pnl === null || (isRecord(value.pnl) && typeof value.pnl.currentPrice === "number" && typeof value.pnl.pnlUsd === "number" && typeof value.pnl.pnlPercent === "number"));
}

function isWorkspaceState(value: unknown): value is WorkspaceState {
  return (
    isRecord(value) &&
    value.version === 2 &&
    isWorkspaceProfile(value.profile) &&
    Array.isArray(value.playbooks) && value.playbooks.every(isWorkspacePlaybook) &&
    Array.isArray(value.researchRuns) && value.researchRuns.every(isWorkspaceResearchRun) &&
    Array.isArray(value.theses) && value.theses.every(isWorkspaceThesis) &&
    Array.isArray(value.receipts) && value.receipts.every(isWorkspaceReceipt) &&
    Array.isArray(value.practicePositions) && value.practicePositions.every(isWorkspacePracticePosition) &&
    isRecordArray(value.memoryLessonsAwaitingReview)
  );
}

function parseStoredValue(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function legacyCollection(value: unknown): readonly Record<string, unknown>[] {
  return isRecordArray(value) ? value : [];
}

export function createWorkspace(profile: WorkspaceProfile): WorkspaceState {
  return {
    version: 2,
    profile,
    playbooks: [],
    researchRuns: [],
    theses: [],
    receipts: [],
    practicePositions: [],
    memoryLessonsAwaitingReview: [],
  };
}

function migrateLegacyWorkspace(value: unknown): WorkspaceState | null {
  if (!isRecord(value) || value.version !== 1 || value.onboardingComplete !== true) {
    return null;
  }
  if (
    !isNonEmptyString(value.displayName) ||
    !isNonEmptyString(value.workspaceName) ||
    !isNonEmptyString(value.createdAt)
  ) {
    return null;
  }

  const migrated = createWorkspace({
    displayName: value.displayName,
    workspaceName: value.workspaceName,
    createdAt: value.createdAt,
  });

  return {
    ...migrated,
    memoryLessonsAwaitingReview: legacyCollection(value.memoryLessonsAwaitingReview),
  };
}

function readStorage(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    return parseStoredValue(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: WorkspaceState): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadWorkspace(): WorkspaceState | null {
  const current = readStorage(WORKSPACE_STORAGE_KEY);
  if (isWorkspaceState(current)) return current;

  const legacy = migrateLegacyWorkspace(readStorage(LEGACY_WORKSPACE_STORAGE_KEY));
  if (legacy !== null) {
    writeStorage(WORKSPACE_STORAGE_KEY, legacy);
    return legacy;
  }

  return null;
}

export function saveWorkspace(workspace: WorkspaceState): boolean {
  return writeStorage(WORKSPACE_STORAGE_KEY, workspace);
}

function identifier(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return `${prefix}-${cryptoApi.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPersonalPlaybook(
  displayName: string,
  createdAt = new Date().toISOString(),
): WorkspacePlaybook {
  const normalizedName = displayName.trim();
  if (normalizedName.length === 0) {
    throw new Error("A Playbook name is required.");
  }

  const playbookId = identifier("playbook");
  const versionId = identifier("playbook-version");
  const result = createInitialVersion({
    playbookId,
    versionId,
    strategyId: "dm-1",
    strategyVersion: "1.0.0",
    rules: STARTER_RULES,
    createdAt,
    approvedAt: createdAt,
    approvedBy: PLAYBOOK_ACTORS.HUMAN,
  });
  if (!result.ok) {
    throw new Error(result.message);
  }

  return {
    id: result.playbook.id,
    displayName: normalizedName,
    active: false,
    createdAt,
    updatedAt: createdAt,
    playbook: result.playbook,
    version: result.version,
  };
}

export function createPlaybook(
  workspace: WorkspaceState,
  displayName: string,
  createdAt = new Date().toISOString(),
): WorkspaceState {
  const created = createPersonalPlaybook(displayName, createdAt);
  const firstPlaybook = workspace.playbooks.length === 0;
  const playbook = { ...created, active: firstPlaybook };
  return {
    ...workspace,
    playbooks: [
      ...workspace.playbooks.map((item) => ({ ...item, active: firstPlaybook ? false : item.active })),
      playbook,
    ],
  };
}

export function setActivePlaybook(
  workspace: WorkspaceState,
  playbookId: string,
): WorkspaceState {
  if (!workspace.playbooks.some((item) => item.id === playbookId)) {
    throw new Error("The selected Playbook does not exist in this workspace.");
  }
  return {
    ...workspace,
    playbooks: workspace.playbooks.map((item) => ({
      ...item,
      active: item.id === playbookId,
    })),
  };
}

export function activePlaybook(
  workspace: WorkspaceState | null,
): WorkspacePlaybook | null {
  return workspace?.playbooks.find((item) => item.active) ?? null;
}

export function deletePlaybook(
  workspace: WorkspaceState,
  playbookId: string,
): { ok: true; workspace: WorkspaceState } | { ok: false; message: string } {
  const target = workspace.playbooks.find((item) => item.id === playbookId);
  if (target === undefined) return { ok: false, message: "The Playbook was not found." };

  const referencedVersionIds = new Set(
    workspace.researchRuns.map((run) => run.playbookVersionId),
  );
  if (referencedVersionIds.has(target.version.id)) {
    return {
      ok: false,
      message: "This Playbook has research history and cannot be deleted.",
    };
  }

  const remaining = workspace.playbooks.filter((item) => item.id !== playbookId);
  const nextPlaybooks = target.active && remaining.length > 0
    ? remaining.map((item, index) => ({ ...item, active: index === 0 }))
    : remaining;
  return { ok: true, workspace: { ...workspace, playbooks: nextPlaybooks } };
}

function providerStatus(result: ResearchRun): string {
  return (
    result.marketContext?.status ??
    result.candidateDiscovery?.status ??
    (result.status === "DEGRADED" ? "UNAVAILABLE" : "UNKNOWN")
  );
}

function thesisFromResult(result: ResearchRun): WorkspaceThesis | null {
  const commit = result.commit;
  const proposal = result.proposal;
  if (commit === null && (proposal === null || proposal.eligible !== true)) {
    return null;
  }

  const source = commit === null
    ? {
        id: proposal!.thesisId,
        versionId: proposal!.versionId,
        asset: proposal!.asset,
        decision: proposal!.decision,
        evidenceSnapshotId: proposal!.evidenceSnapshotId,
        createdAt: result.createdAt,
      }
    : {
        id: commit.thesis.id,
        versionId: commit.version.id,
        asset: commit.version.asset,
        decision: commit.version.decision,
        evidenceSnapshotId: commit.version.evidenceSnapshotId,
        createdAt: commit.version.createdAt,
      };

  return {
    ...source,
    status: commit === null ? "PROPOSED" : "COMMITTED",
    sourceRunId: result.id,
    playbookVersionId: result.playbookVersionId,
    ...(commit === null
      ? {}
      : { receiptId: commit.receipt.id, receiptHash: commit.receipt.canonicalHash }),
  };
}

export function ingestResearchResult(
  workspace: WorkspaceState,
  result: ResearchRun,
  options: { readonly replayFixtureId?: string } = {},
): WorkspaceState {
  if (workspace.researchRuns.some((run) => run.id === result.id)) {
    return workspace;
  }

  const receipt = result.commit?.receipt ?? null;
  const practice = result.commit?.practice ?? result.practice;
  const thesis = thesisFromResult(result);
  const summary: WorkspaceResearchRun = {
    id: result.id,
    mode: result.mode,
    providerSource: result.provider.source,
    ...(options.replayFixtureId === undefined
      ? {}
      : { replayFixtureId: options.replayFixtureId }),
    providerStatus: providerStatus(result),
    providerWarnings: result.providerWarnings.map((issue) => issue.message),
    providerFailures: result.providerFailures.map((issue) => issue.message),
    status: result.status,
    outcome: result.outcome,
    selectedAsset: result.selectedAsset,
    marketDecision: result.marketDecision,
    finalDecision: result.finalDecision,
    reasonCodes: [...result.reasonCodes],
    preflightStatus: result.preflight?.status ?? result.preflightFailure?.code ?? "UNKNOWN",
    killSwitchVerdict: result.killSwitch?.verdict ?? result.killSwitchValidation?.verdict ?? "UNKNOWN",
    createdAt: result.createdAt,
    playbookVersionId: result.playbookVersionId,
    ...(receipt === null ? {} : { receiptId: receipt.id, receiptHash: receipt.canonicalHash }),
    ...(practice === null ? {} : { practicePositionId: practice.position.id }),
    ...(thesis === null ? {} : { thesisId: thesis.id, thesisVersionId: thesis.versionId }),
  };

  const receipts = receipt !== null && !workspace.receipts.some((item) => item.id === receipt.id)
    ? [receipt, ...workspace.receipts]
    : workspace.receipts;
  const practicePositions = practice !== null && !workspace.practicePositions.some((item) => item.position.id === practice.position.id)
    ? [{ sourceRunId: result.id, position: practice.position, pnl: practice.pnl }, ...workspace.practicePositions]
    : workspace.practicePositions;
  const theses = thesis !== null && !workspace.theses.some((item) => item.versionId === thesis.versionId)
    ? [thesis, ...workspace.theses]
    : workspace.theses;

  return {
    ...workspace,
    researchRuns: [summary, ...workspace.researchRuns],
    theses,
    receipts,
    practicePositions,
  };
}

export function resetWorkspace(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_WORKSPACE_STORAGE_KEY);
  } catch {
    // Storage can be blocked by the browser; the in-memory view still resets.
  }
  updateClientSnapshot(null);
}

let clientSnapshot: WorkspaceState | null = null;
let hasClientSnapshot = false;
const subscribers = new Set<() => void>();

export function getWorkspaceSnapshot(): WorkspaceState | null {
  if (typeof window === "undefined") return null;
  if (!hasClientSnapshot) {
    clientSnapshot = loadWorkspace();
    hasClientSnapshot = true;
  }
  return clientSnapshot;
}

export function getServerWorkspaceSnapshot(): undefined {
  return undefined;
}

export function subscribeWorkspace(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  subscribers.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== WORKSPACE_STORAGE_KEY && event.key !== LEGACY_WORKSPACE_STORAGE_KEY) return;
    clientSnapshot = loadWorkspace();
    hasClientSnapshot = true;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    subscribers.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function updateClientSnapshot(next: WorkspaceState | null): void {
  clientSnapshot = next;
  hasClientSnapshot = true;
  subscribers.forEach((subscriber) => subscriber());
}

export function persistWorkspace(workspace: WorkspaceState): boolean {
  const saved = saveWorkspace(workspace);
  if (saved) updateClientSnapshot(workspace);
  return saved;
}
