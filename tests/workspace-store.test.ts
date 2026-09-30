import { beforeEach, describe, expect, it } from "vitest";
import type { ResearchRun } from "../lib/research";
import {
  LEGACY_WORKSPACE_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  createPlaybook,
  createWorkspace,
  ingestResearchResult,
  loadWorkspace,
  persistWorkspace,
  resetWorkspace,
  setActivePlaybook,
  type WorkspaceState,
} from "../lib/workspace/store";

const storage = new Map<string, string>();
const fakeWindow = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

function workspace(): WorkspaceState {
  return createWorkspace({
    displayName: "Alex",
    workspaceName: "Research Desk",
    createdAt: "2026-09-01T12:00:00.000Z",
  });
}

function researchResult(overrides: Record<string, unknown> = {}): ResearchRun {
  return {
    id: "run-1",
    intent: "AUTONOMOUS_DISCOVERY",
    mode: "REPLAY",
    status: "PROPOSED",
    outcome: "PROPOSED",
    currentStage: "PROVISIONAL",
    createdAt: "2026-09-01T12:01:00.000Z",
    updatedAt: "2026-09-01T12:01:00.000Z",
    startedAt: "2026-09-01T12:01:00.000Z",
    asOf: null,
    provider: { id: "fixture", mode: "REPLAY", source: "DETERMINISTIC_RESEARCH_FIXTURE" },
    marketContext: null,
    candidateDiscovery: null,
    candidateAssetsConsidered: ["SOL"],
    candidates: [],
    selection: {} as ResearchRun["selection"],
    selectedAsset: "SOL",
    marketDecision: "LONG",
    finalDecision: "LONG",
    reasonCodes: ["PREFLIGHT_WAIT"],
    providerWarnings: [],
    providerFailures: [],
    preflight: { status: "FIT" } as ResearchRun["preflight"],
    preflightFailure: null,
    killSwitch: { verdict: "CLEAR" } as ResearchRun["killSwitch"],
    killSwitchValidation: null,
    proposal: {
      thesisId: "thesis-1",
      versionId: "version-1",
      evidenceSnapshotId: "evidence-1",
      asset: "SOL",
      decision: "LONG",
      eligible: true,
    },
    commit: null,
    practice: null,
    autoCommitPractice: false,
    playbookVersionId: "playbook-version-1",
    memorySnapshotId: null,
    ...overrides,
  } as ResearchRun;
}

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  resetWorkspace();
});

describe("workspace store", () => {
  it("migrates the previous v1 profile safely", () => {
    storage.set(LEGACY_WORKSPACE_STORAGE_KEY, JSON.stringify({
      version: 1,
      displayName: "Alex",
      workspaceName: "Old Desk",
      createdAt: "2026-09-01T12:00:00.000Z",
      onboardingComplete: true,
      playbooks: [],
      activeTheses: [],
      receipts: [],
      practicePositions: [],
      memoryLessonsAwaitingReview: [],
    }));

    const migrated = loadWorkspace();

    expect(migrated?.version).toBe(2);
    expect(migrated?.profile.workspaceName).toBe("Old Desk");
    expect(storage.has(WORKSPACE_STORAGE_KEY)).toBe(true);
  });

  it("creates a human-approved starter Playbook and selects the first one", () => {
    const first = createPlaybook(workspace(), "Defensible Momentum Guardrails");
    const second = createPlaybook(first, "Second Guardrails");

    expect(first.playbooks).toHaveLength(1);
    expect(first.playbooks[0]?.active).toBe(true);
    expect(first.playbooks[0]?.version.approvedBy).toBe("HUMAN");
    expect(first.playbooks[0]?.version.rules.length).toBeGreaterThan(0);
    expect(second.playbooks.filter((item) => item.active)).toHaveLength(1);

    const selected = setActivePlaybook(second, second.playbooks[1]!.id);
    expect(selected.playbooks[1]?.active).toBe(true);
    expect(selected.playbooks[0]?.active).toBe(false);
  });

  it("ingests a proposed replay with explicit provenance", () => {
    const result = researchResult();
    const next = ingestResearchResult(workspace(), result, {
      replayFixtureId: "DETERMINISTIC_DIRECTIONAL",
    });

    expect(next.researchRuns).toHaveLength(1);
    expect(next.researchRuns[0]?.replayFixtureId).toBe("DETERMINISTIC_DIRECTIONAL");
    expect(next.researchRuns[0]?.providerSource).toBe("DETERMINISTIC_RESEARCH_FIXTURE");
    expect(next.theses[0]?.status).toBe("PROPOSED");
    expect(next.receipts).toHaveLength(0);
    expect(next.practicePositions).toHaveLength(0);
  });

  it("stores committed receipt and practice artifacts without fabricating either", () => {
    const result = researchResult({
      id: "run-committed",
      status: "COMMITTED",
      outcome: "COMMITTED",
      currentStage: "COMMITTED",
      autoCommitPractice: true,
      commit: {
        thesis: { id: "thesis-2", asset: "SOL" },
        version: { id: "version-2", asset: "SOL", decision: "LONG", evidenceSnapshotId: "evidence-2", createdAt: "2026-09-01T12:01:00.000Z" },
        receipt: { id: "receipt-2", canonicalHash: "sha256:real" },
        practice: { position: { id: "position-2", asset: "SOL", direction: "LONG" }, pnl: null },
      },
    });

    const next = ingestResearchResult(workspace(), result);

    expect(next.theses[0]?.status).toBe("COMMITTED");
    expect(next.receipts[0]?.canonicalHash).toBe("sha256:real");
    expect(next.practicePositions[0]?.position.id).toBe("position-2");
    expect(next.researchRuns[0]?.receiptHash).toBe("sha256:real");
  });

  it("preserves degraded LIVE outcomes and ignores duplicate run ingestion", () => {
    const result = researchResult({
      id: "live-degraded",
      mode: "LIVE",
      status: "DEGRADED",
      outcome: "DEGRADED",
      currentStage: "FAILED",
      provider: { id: "live", mode: "LIVE", source: "LIVE_RYO" },
      providerFailures: [{ message: "RYO unavailable" }],
      selectedAsset: null,
      marketDecision: "ABSTAIN",
      finalDecision: "ABSTAIN",
      proposal: null,
      preflight: null,
      killSwitch: null,
    });

    const first = ingestResearchResult(workspace(), result);
    const duplicate = ingestResearchResult(first, result);

    expect(first.researchRuns[0]?.status).toBe("DEGRADED");
    expect(first.researchRuns[0]?.providerFailures).toEqual(["RYO unavailable"]);
    expect(first.researchRuns).toHaveLength(1);
    expect(duplicate).toBe(first);
  });

  it("persists and resets the local workspace", () => {
    const state = createPlaybook(workspace(), "Personal Rules");
    expect(persistWorkspace(state)).toBe(true);
    expect(loadWorkspace()?.playbooks).toHaveLength(1);

    resetWorkspace();

    expect(loadWorkspace()).toBeNull();
    expect(storage.has(WORKSPACE_STORAGE_KEY)).toBe(false);
  });
});
