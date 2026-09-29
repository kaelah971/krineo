export const LOCAL_WORKSPACE_STORAGE_KEY = "krineo.workspace.v1";

export type LocalWorkspaceProfile = {
  version: 1;
  displayName: string;
  workspaceName: string;
  createdAt: string;
  onboardingComplete: boolean;
};

type LocalWorkspaceCollection = readonly Record<string, unknown>[];

export type LocalWorkspaceState = LocalWorkspaceProfile & {
  playbooks: LocalWorkspaceCollection;
  activeTheses: LocalWorkspaceCollection;
  receipts: LocalWorkspaceCollection;
  practicePositions: LocalWorkspaceCollection;
  memoryLessonsAwaitingReview: LocalWorkspaceCollection;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCollection(value: unknown): value is LocalWorkspaceCollection {
  return Array.isArray(value) && value.every(isRecord);
}

function isStoredWorkspace(value: unknown): value is LocalWorkspaceState {
  if (!isRecord(value)) return false;

  return (
    value.version === 1 &&
    typeof value.displayName === "string" &&
    value.displayName.trim().length > 0 &&
    typeof value.workspaceName === "string" &&
    value.workspaceName.trim().length > 0 &&
    typeof value.createdAt === "string" &&
    value.createdAt.trim().length > 0 &&
    value.onboardingComplete === true &&
    isCollection(value.playbooks) &&
    isCollection(value.activeTheses) &&
    isCollection(value.receipts) &&
    isCollection(value.practicePositions) &&
    isCollection(value.memoryLessonsAwaitingReview)
  );
}

export function createLocalWorkspaceState({
  displayName,
  workspaceName,
}: Pick<LocalWorkspaceProfile, "displayName" | "workspaceName">): LocalWorkspaceState {
  return {
    version: 1,
    displayName,
    workspaceName,
    createdAt: new Date().toISOString(),
    onboardingComplete: true,
    playbooks: [],
    activeTheses: [],
    receipts: [],
    practicePositions: [],
    memoryLessonsAwaitingReview: [],
  };
}

export function readLocalWorkspaceState(): LocalWorkspaceState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LOCAL_WORKSPACE_STORAGE_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    return isStoredWorkspace(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLocalWorkspaceState(state: LocalWorkspaceState): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(LOCAL_WORKSPACE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalWorkspaceState(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(LOCAL_WORKSPACE_STORAGE_KEY);
  } catch {
    // A blocked browser storage area should not break the workspace shell.
  }
}
