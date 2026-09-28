import { describe, expect, it } from "vitest";
import {
  createMemorySnapshot,
  rankComparableCases,
} from "../lib/memory";
import {
  createInitialVersion,
  createProposal,
  PLAYBOOK_ACTORS,
} from "../lib/playbook";
import { evaluatePreflight } from "../lib/decision";
import { commitDemoScenario } from "../lib/demo/commit";
import {
  applyApprovedDemoProposal,
  createDemoPlaybookAuthoringState,
  evaluateDemoAuthoring,
} from "../lib/demo/authoring";
import {
  approveDemoMemoryLesson,
  createDemoMemoryLessonState,
} from "../lib/demo/memory-lessons";
import { refreshDemoScenario } from "../lib/demo/refresh";
import { resolveDemoIntent } from "../lib/demo/intent";
import { getDemoScenarios } from "../lib/demo/scenarios";

describe("demo scenario composition", () => {
  it("exposes the three intended product lifecycle states", () => {
    const scenarios = getDemoScenarios();

    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      "directional",
      "abstain",
      "changed",
    ]);
    expect(scenarios[0].currentDecision.decision).toBe("LONG");
    expect(scenarios[1].currentDecision.decision).toBe("ABSTAIN");
    expect(scenarios[2].currentDecision.decision).toBe("SHORT");
  });

  it("commits the selected candidate through a v1 Thesis Receipt", () => {
    const result = commitDemoScenario(getDemoScenarios()[0]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.selection.selected?.asset).toBe("SOL");
    expect(result.selection.candidates.find((candidate) => candidate.asset === "SOL")?.selected).toBe(true);
    expect(result.version.versionNumber).toBe(1);
    expect(result.version.decision).toBe("LONG");
    expect(result.receipt.versionNumber).toBe(1);
    expect(result.receipt.killSwitch?.verdict).toBe("CLEAR");
    expect(result.practice.position?.thesisVersionId).toBe(result.version.id);
  });

  it("does not expose a practice position before explicit commit", () => {
    const scenario = getDemoScenarios()[0];

    expect(scenario.originalPractice).toBeNull();
    expect(scenario.practice).toBeNull();
  });

  it("keeps repeated deterministic commits at one committed version", () => {
    const scenario = getDemoScenarios()[0];
    const first = commitDemoScenario(scenario, "original");
    const second = commitDemoScenario(scenario, "original");

    expect(first).toEqual(second);
    expect(first.ok && second.ok ? first.version.id : null).toBe(
      "thesis-directional-commit-v1",
    );
  });

  it("appends v2 from the committed v1 and maps a reversal to invalidation", () => {
    const scenario = getDemoScenarios()[2];
    const committed = commitDemoScenario(scenario, "original");

    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    const committedReceipt = committed.receipt;
    const committedVersion = committed.version;
    const refreshed = refreshDemoScenario(scenario, committed);

    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;

    expect(refreshed.previousVersion).toEqual(committedVersion);
    expect(refreshed.version.versionNumber).toBe(2);
    expect(refreshed.receipt.versionNumber).toBe(2);
    expect(refreshed.receipt.id).toContain("receipt-v2");
    expect(committed.receipt).toEqual(committedReceipt);
    expect(refreshed.practice.position?.thesisVersionId).toBe(committed.version.id);
    expect(refreshed.previousVersion.decision).toBe("LONG");
    expect(refreshed.version.decision).toBe("SHORT");
    expect(refreshed.diff.decision).toEqual({
      before: "LONG",
      after: "SHORT",
      changed: true,
    });
    expect(refreshed.invalidation?.outcome).toBe("INVALIDATE");
    expect(refreshed.practice.action?.action).toBe("CLOSE");
    expect(refreshed.practice.position?.status).toBe("CLOSED");
    expect(refreshed.receipt.versionNumber).toBe(2);
    expect(committed.version.versionNumber).toBe(1);
  });

  it("rejects refresh when no explicit commit succeeded", () => {
    const scenario = getDemoScenarios()[1];
    const blocked = commitDemoScenario(scenario, "original");
    const refreshed = refreshDemoScenario(scenario, blocked);

    expect(blocked).toMatchObject({ ok: false, reason: "ABSTAIN" });
    expect(refreshed).toMatchObject({
      ok: false,
      reason: "THESIS_REJECTED",
    });
  });

  it("does not commit abstain, veto or unknown outcomes", () => {
    const scenarios = getDemoScenarios();
    const abstain = commitDemoScenario(scenarios[1]);
    const veto = commitDemoScenario({
      ...scenarios[0],
      currentKillSwitch: { ...scenarios[0].currentKillSwitch, verdict: "VETO" },
    });
    const unknown = commitDemoScenario({
      ...scenarios[0],
      currentKillSwitch: { ...scenarios[0].currentKillSwitch, verdict: "UNKNOWN" },
    });

    expect(abstain).toMatchObject({ ok: false, reason: "ABSTAIN" });
    expect(veto).toMatchObject({ ok: false, reason: "KILLSWITCH_VETO" });
    expect(unknown).toMatchObject({ ok: false, reason: "KILLSWITCH_UNKNOWN" });
  });

  it("keeps the directional fixture open after committed invalidation maintains the thesis", () => {
    const scenario = getDemoScenarios()[0];
    const committed = commitDemoScenario(scenario, "original");

    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(scenario.currentKillSwitch.verdict).toBe("CLEAR");
    expect(scenario.strategyDiff?.hasMeaningfulChange).toBe(true);
    expect(scenario.invalidation?.outcome).toBe("MAINTAIN");
    expect(committed.practice.action?.action).toBe("KEEP_OPEN");
    expect(committed.practice.position?.status).toBe("OPEN");
  });

  it("preserves an intentional abstain without creating a practice position", () => {
    const scenario = getDemoScenarios()[1];

    expect(scenario.receipt.killSwitch).toBeNull();
    expect(scenario.strategyDiff).toBeNull();
    expect(scenario.invalidation).toBeNull();
    expect(scenario.practice).toBeNull();
  });

  it("closes the simulated position when a directional reversal triggers invalidation", () => {
    const scenario = getDemoScenarios()[2];
    const committed = commitDemoScenario(scenario, "original");

    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    const refreshed = refreshDemoScenario(scenario, committed);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;

    expect(scenario.strategyDiff?.decision).toEqual({
      before: "LONG",
      after: "SHORT",
      changed: true,
    });
    expect(scenario.invalidation?.outcome).toBe("INVALIDATE");
    expect(scenario.invalidation?.triggeredRules.map((rule) => rule.ruleType)).toContain(
      "DIRECTION_REVERSAL",
    );
    expect(refreshed.practice.action?.recommendedCloseReason).toBe("THESIS_INVALIDATED");
    expect(refreshed.practice.position?.status).toBe("CLOSED");
    expect(refreshed.practice.position?.realizedPnlUsd).toBeCloseTo(-100, 8);
  });

  it("resolves supported natural-language intents to visible fixture states", () => {
    const scenarios = getDemoScenarios();

    expect(resolveDemoIntent("analyze SOL", scenarios)).toBe("directional");
    expect(resolveDemoIntent("the evidence is mixed, should we abstain?", scenarios)).toBe("abstain");
    expect(resolveDemoIntent("the thesis reversed; close the loop", scenarios)).toBe("changed");
    expect(resolveDemoIntent("an unsupported BTC request", scenarios)).toBeNull();
    expect(resolveDemoIntent("", scenarios)).toBeNull();
  });

  it("wires fixture DM-1 through MemorySnapshot, Playbook and Preflight", () => {
    const scenario = getDemoScenarios()[0];
    const governance = scenario.currentGovernance;
    const strong = governance.memorySnapshot.rankedCases[0];
    const moderate = governance.memorySnapshot.rankedCases[1];
    const cautionRule = governance.preflight.playbookEvaluation.ruleEvaluations.find(
      (entry) => entry.rule.id === "caution-on-high-similarity-memory",
    );

    expect(governance.memorySnapshot.algorithmVersion).toBe("case-similarity-v1");
    expect(governance.memorySnapshot.rankedCases).toHaveLength(5);
    expect(governance.memorySummary).toMatchObject({
      summaryVersion: "memory-summary-v1",
      rankedCaseCount: 5,
      comparableCaseCount: 2,
      highSimilarityCaseCount: 2,
    });
    expect(strong?.caseId).toBe("directional-history-strong");
    expect(strong?.similarity.overallSimilarity).toBe(1);
    expect(strong?.similarity.comparisonCoverage).toBe(1);
    expect(strong?.similarity.components.every((component) => component.diagnostic === "MATCH")).toBe(true);
    expect(moderate?.similarity.overallSimilarity).toBeCloseTo(0.8365384615, 8);
    expect(cautionRule?.outcome).toBe("TRIGGERED");
    expect(governance.preflight.marketDecision).toBe("LONG");
    expect(governance.preflight.status).toBe("CAUTION");
    expect(governance.preflight.effectiveDecision).toBe("LONG");
  });

  it("keeps historical outcomes out of similarity and Preflight", () => {
    const scenario = getDemoScenarios()[0];
    const governance = scenario.currentGovernance;
    const alteredCases = governance.historicalCases.map((entry) => ({
      ...entry,
      outcome: { status: "NEGATIVE" as const, observationId: "outcome-only-change" },
    }));
    const reranked = rankComparableCases(governance.targetSignature, alteredCases);
    const alteredSnapshot = createMemorySnapshot({
      snapshotId: governance.memorySnapshot.snapshotId,
      targetSignature: governance.targetSignature,
      rankedCases: reranked,
      createdAt: governance.memorySnapshot.createdAt,
      metadata: governance.memorySnapshot.metadata,
    });
    const alteredPreflight = evaluatePreflight({
      marketResult: scenario.currentDecision,
      evidence: scenario.currentEvidenceSnapshot,
      playbookVersion: governance.playbookVersion,
      memorySnapshot: alteredSnapshot,
    });

    expect(reranked.map((entry) => entry.similarity)).toEqual(
      governance.memorySnapshot.rankedCases.map((entry) => entry.similarity),
    );
    expect(alteredPreflight).toEqual(governance.preflight);
  });

  it("keeps pending proposals out and lets an approved Playbook change Preflight", () => {
    const scenario = getDemoScenarios()[0];
    const governance = scenario.currentGovernance;
    const pending = createProposal({
      proposalId: "demo-pending-proposal",
      playbookId: governance.playbook.id,
      proposedVersionId: "demo-pending-version",
      parentVersionId: governance.playbook.currentVersionId,
      parentVersionNumber: governance.playbook.currentVersionNumber,
      strategyId: "dm-1",
      strategyVersion: "1.0.0",
      rules: [{
        id: "pending-block",
        effect: "BLOCK",
        conditions: [{ field: "decision", operator: "EQUALS", value: "LONG" }],
      }],
      createdBy: PLAYBOOK_ACTORS.MODEL,
      createdAt: "2026-09-05T12:02:00.000Z",
    });
    expect(pending.ok).toBe(true);
    const pendingPreflight = evaluatePreflight({
      marketResult: scenario.currentDecision,
      evidence: scenario.currentEvidenceSnapshot,
      playbookVersion: governance.playbookVersion,
      memorySnapshot: governance.memorySnapshot,
    });
    expect(pendingPreflight).toEqual(governance.preflight);

    const approved = createInitialVersion({
      playbookId: "approved-demo-block",
      versionId: "approved-demo-block-v1",
      strategyId: "dm-1",
      strategyVersion: "1.0.0",
      rules: [{
        id: "approved-block",
        effect: "BLOCK",
        conditions: [{ field: "decision", operator: "EQUALS", value: "LONG" }],
      }],
      createdAt: "2026-09-05T12:02:00.000Z",
      approvedAt: "2026-09-05T12:03:00.000Z",
      approvedBy: PLAYBOOK_ACTORS.HUMAN,
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;

    const changedPreflight = evaluatePreflight({
      marketResult: scenario.currentDecision,
      evidence: scenario.currentEvidenceSnapshot,
      playbookVersion: approved.version,
      memorySnapshot: governance.memorySnapshot,
    });
    expect(changedPreflight).toMatchObject({
      ok: true,
      status: "BLOCK",
      effect: "BLOCK",
      effectiveDecision: "ABSTAIN",
    });
  });

  it("distinguishes missing memory from an empty MemorySnapshot", () => {
    const scenario = getDemoScenarios()[0];
    const governance = scenario.currentGovernance;
    const withoutMemory = evaluatePreflight({
      marketResult: scenario.currentDecision,
      evidence: scenario.currentEvidenceSnapshot,
      playbookVersion: governance.playbookVersion,
    });
    const emptySnapshot = createMemorySnapshot({
      snapshotId: "demo-empty-memory",
      targetSignature: governance.targetSignature,
      rankedCases: [],
      createdAt: "2026-09-05T12:01:00.000Z",
    });
    const withEmptyMemory = evaluatePreflight({
      marketResult: scenario.currentDecision,
      evidence: scenario.currentEvidenceSnapshot,
      playbookVersion: governance.playbookVersion,
      memorySnapshot: emptySnapshot,
    });

    expect(withoutMemory).toMatchObject({ ok: true, status: "CAUTION" });
    expect(withEmptyMemory).toMatchObject({
      ok: true,
      status: "FIT",
      memorySummary: {
        rankedCaseCount: 0,
        comparableCaseCount: 0,
        highSimilarityCaseCount: 0,
      },
    });
    if (withoutMemory.ok && withEmptyMemory.ok) {
      const missingRule = withoutMemory.playbookEvaluation.ruleEvaluations.find(
        (entry) => entry.rule.id === "caution-on-high-similarity-memory",
      );
      const emptyRule = withEmptyMemory.playbookEvaluation.ruleEvaluations.find(
        (entry) => entry.rule.id === "caution-on-high-similarity-memory",
      );
      expect(missingRule?.outcome).toBe("UNKNOWN");
      expect(emptyRule?.outcome).toBe("NOT_TRIGGERED");
    }
  });

  it("exposes structured NOW/RULES/MEMORY state without live-provider claims", () => {
    const scenario = getDemoScenarios()[0];

    expect(scenario.currentGovernance).toMatchObject({
      playbookProvenance: "DEMO PLAYBOOK",
      memoryProvenance: "DETERMINISTIC DECISION MEMORY",
      preflight: {
        marketDecision: "LONG",
        status: "CAUTION",
      },
    });
    expect(scenario.currentGovernance.preflight.playbookEvaluation.ruleEvaluations.length).toBe(3);
    expect(scenario.currentGovernance.memorySnapshot.rankedCases[0]?.similarity.components.length).toBe(8);
    expect(JSON.stringify(scenario)).not.toContain("LIVE RYO");
    expect(JSON.stringify(scenario)).not.toContain("Sibyl");
  });

  it("supports the canonical golden journey from lesson review to changed receipt", () => {
    const scenario = getDemoScenarios()[2];
    const authoring = createDemoPlaybookAuthoringState(scenario.originalGovernance);
    const lesson = createDemoMemoryLessonState({
      governance: scenario.originalGovernance,
      proposalIdPrefix: "golden-memory-lesson-proposal",
      proposedVersionIdPrefix: "golden-memory-lesson-version",
      createdAt: "2026-09-05T12:03:00.000Z",
    });

    expect(lesson.status).toBe("PENDING");
    expect(lesson.lesson?.proposal.status).toBe("PENDING");
    expect(scenario.originalPractice).toBeNull();

    const initial = evaluateDemoAuthoring(
      authoring,
      scenario.originalGovernance,
      scenario.originalDecision,
      scenario.originalEvidenceSnapshot,
    );
    expect(initial.preflight).toMatchObject({
      marketDecision: "LONG",
      status: "CAUTION",
    });

    const approved = approveDemoMemoryLesson(
      lesson,
      authoring,
      "2026-09-05T12:05:00.000Z",
    );
    expect(approved.ok).toBe(true);
    if (approved.ok !== true) return;
    const advanced = applyApprovedDemoProposal(authoring, approved.approval);
    expect(advanced.activeVersion.versionNumber).toBe(2);
    expect(advanced.activeVersion.sourceProposalId).toBe(lesson.lesson?.proposal.id);

    const afterApproval = evaluateDemoAuthoring(
      advanced,
      scenario.originalGovernance,
      scenario.originalDecision,
      scenario.originalEvidenceSnapshot,
    );
    expect(afterApproval.preflight.status).toBe("CAUTION");

    const committed = commitDemoScenario(scenario, "original");
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.receipt.versionNumber).toBe(1);
    expect(committed.practice.position).not.toBeNull();

    const refreshed = refreshDemoScenario(scenario, committed);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(refreshed.previousVersion).toEqual(committed.version);
    expect(refreshed.receipt.versionNumber).toBe(2);
    expect(refreshed.receipt.id).not.toBe(committed.receipt.id);
    expect(refreshed.diff.decision).toEqual({ before: "LONG", after: "SHORT", changed: true });
    expect(refreshed.invalidation?.outcome).toBe("INVALIDATE");
    expect(refreshed.practice.action?.action).toBe("CLOSE");

    const afterRefresh = evaluateDemoAuthoring(
      advanced,
      scenario.currentGovernance,
      scenario.currentDecision,
      scenario.currentEvidenceSnapshot,
    );
    expect(afterRefresh.preflight).toMatchObject({
      marketDecision: "SHORT",
      status: "WAIT",
      effectiveDecision: "ABSTAIN",
    });
    expect(JSON.stringify(scenario)).not.toContain("LIVE RYO");
    expect(scenario.currentGovernance.playbookProvenance).toBe("DEMO PLAYBOOK");
    expect(scenario.currentGovernance.memoryProvenance).toBe("DETERMINISTIC DECISION MEMORY");
  });

  it("is deterministic across repeated server fixture construction", () => {
    const first = getDemoScenarios();
    const second = getDemoScenarios();

    expect(first.map((scenario) => scenario.receipt.canonicalHash)).toEqual(
      second.map((scenario) => scenario.receipt.canonicalHash),
    );
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
