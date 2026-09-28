import { describe, expect, it } from "vitest";
import {
  compareCaseSimilarityV1,
  rankComparableCases,
  type CaseSignature,
  type DecisionCase,
} from "../lib/memory";
import {
  detectLessonCandidates,
} from "../lib/memory/lessons";
import {
  approveProposal,
  createProposal,
  PLAYBOOK_ACTORS,
} from "../lib/playbook";
import {
  applyApprovedDemoProposal,
  createDemoPlaybookAuthoringState,
  evaluateDemoAuthoring,
} from "../lib/demo/authoring";
import {
  approveDemoMemoryLesson,
  createDemoMemoryLessonState,
  rejectDemoMemoryLesson,
} from "../lib/demo/memory-lessons";
import { getDemoScenarios } from "../lib/demo/scenarios";
import { makeCaseSignature, makeDecisionCase } from "./fixtures/memory";

const unknownEvidence = {
  DIRECTIONAL_MOMENTUM: "UNKNOWN" as const,
  TECHNICAL_CONFLUENCE: "UNKNOWN" as const,
  RELATIVE_OPPORTUNITY: "UNKNOWN" as const,
  MARKET_ALIGNMENT: "UNKNOWN" as const,
  SENTIMENT_DERIVATIVES: "UNKNOWN" as const,
};

function regimeSignature(regimeFit: "FIT" | "DEGRADED" | "BROKEN" | "UNKNOWN"): CaseSignature {
  return makeCaseSignature({
    evidence: unknownEvidence,
    risk: "UNKNOWN",
    safety: "UNKNOWN",
    regimeFit,
  });
}

function regimeCase(
  id: string,
  status: "POSITIVE" | "NEGATIVE" | "FLAT" | "INVALIDATED" | "UNKNOWN" | "PENDING",
  regimeFit: "FIT" | "DEGRADED" | "BROKEN" | "UNKNOWN" = "DEGRADED",
  decision: DecisionCase["decision"] = id.endsWith("a") ? "LONG" : id.endsWith("b") ? "SHORT" : "ABSTAIN",
): DecisionCase {
  return makeDecisionCase({
    id,
    decision,
    signature: regimeSignature(regimeFit),
    outcome: { status },
  });
}

function policyCase(
  id: string,
  status: "POSITIVE" | "NEGATIVE" | "FLAT" | "INVALIDATED",
  overrides: Partial<Omit<CaseSignature, "evidence">> & {
    readonly evidence?: Partial<CaseSignature["evidence"]>;
  },
): DecisionCase {
  return makeDecisionCase({
    id,
    signature: makeCaseSignature({
      evidence: { ...unknownEvidence, ...(overrides.evidence ?? {}) },
      risk: overrides.risk ?? "UNKNOWN",
      safety: overrides.safety ?? "UNKNOWN",
      regimeFit: overrides.regimeFit ?? "UNKNOWN",
    }),
    outcome: { status },
  });
}

function candidateFor(
  cases: readonly DecisionCase[],
  field: "regimeFit" | "risk" | "DIRECTIONAL_MOMENTUM" = "regimeFit",
) {
  const candidate = detectLessonCandidates(cases).find(
    (entry) => entry.condition.field === field,
  );
  if (candidate === undefined) throw new Error(`No ${field} lesson candidate.`);
  return candidate;
}

function demoLessonState(scenario = getDemoScenarios()[0]) {
  const governance = scenario.originalGovernance;
  return createDemoMemoryLessonState({
    governance,
    proposalIdPrefix: "test-memory-lesson-proposal",
    proposedVersionIdPrefix: "test-memory-lesson-version",
    createdAt: "2026-09-05T12:03:00.000Z",
  });
}

describe("Memory Lessons v1.1", () => {
  it("requires three matching resolved cases and two adverse outcomes", () => {
    expect(detectLessonCandidates([
      regimeCase("case-a", "NEGATIVE"),
      regimeCase("case-b", "INVALIDATED"),
      regimeCase("case-d", "POSITIVE", "FIT"),
      regimeCase("case-e", "POSITIVE", "FIT"),
    ])).toHaveLength(0);

    expect(detectLessonCandidates([
      regimeCase("case-a", "NEGATIVE"),
      regimeCase("case-b", "POSITIVE"),
      regimeCase("case-c", "FLAT"),
      regimeCase("case-d", "POSITIVE", "FIT"),
      regimeCase("case-e", "POSITIVE", "FIT"),
    ])).toHaveLength(0);

    const candidate = candidateFor([
      regimeCase("case-a", "NEGATIVE"),
      regimeCase("case-b", "INVALIDATED"),
      regimeCase("case-c", "POSITIVE"),
      regimeCase("case-d", "POSITIVE", "FIT"),
      regimeCase("case-e", "POSITIVE", "FIT"),
    ]);
    expect(candidate.matchingCaseCount).toBe(3);
    expect(candidate.adverseCount).toBe(2);
    expect(candidate.adverseRate).toBeCloseTo(2 / 3, 8);
    expect(candidate.nonMatchingResolvedCaseCount).toBe(2);
    expect(candidate.nonMatchingAdverseCount).toBe(0);
    expect(candidate.nonMatchingAdverseRate).toBe(0);
    expect(candidate.adverseRateLift).toBeCloseTo(2 / 3, 8);
    expect(candidate.proposedEffect).toBe("WAIT");
  });

  it("only learns explicitly allowlisted restrictive states", () => {
    expect(detectLessonCandidates([
      regimeCase("fit-a", "NEGATIVE", "FIT"),
      regimeCase("fit-b", "INVALIDATED", "FIT"),
      regimeCase("fit-c", "NEGATIVE", "FIT"),
      regimeCase("fit-d", "POSITIVE", "DEGRADED"),
      regimeCase("fit-e", "POSITIVE", "DEGRADED"),
    ])).toHaveLength(0);

    expect(detectLessonCandidates([
      policyCase("clear-a", "NEGATIVE", { safety: "CLEAR" }),
      policyCase("clear-b", "INVALIDATED", { safety: "CLEAR" }),
      policyCase("clear-c", "NEGATIVE", { safety: "CLEAR" }),
      policyCase("clear-d", "POSITIVE", { safety: "VETO" }),
      policyCase("clear-e", "POSITIVE", { safety: "VETO" }),
    ])).toHaveLength(0);

    expect(detectLessonCandidates([
      policyCase("acceptable-a", "NEGATIVE", { risk: "ACCEPTABLE" }),
      policyCase("acceptable-b", "INVALIDATED", { risk: "ACCEPTABLE" }),
      policyCase("acceptable-c", "NEGATIVE", { risk: "ACCEPTABLE" }),
      policyCase("acceptable-d", "POSITIVE", { risk: "ELEVATED" }),
      policyCase("acceptable-e", "POSITIVE", { risk: "ELEVATED" }),
    ])).toHaveLength(0);

    expect(detectLessonCandidates([
      policyCase("supportive-a", "NEGATIVE", { evidence: { DIRECTIONAL_MOMENTUM: "SUPPORTIVE" } }),
      policyCase("supportive-b", "INVALIDATED", { evidence: { DIRECTIONAL_MOMENTUM: "SUPPORTIVE" } }),
      policyCase("supportive-c", "NEGATIVE", { evidence: { DIRECTIONAL_MOMENTUM: "SUPPORTIVE" } }),
      policyCase("supportive-d", "POSITIVE", { evidence: { DIRECTIONAL_MOMENTUM: "OPPOSING" } }),
      policyCase("supportive-e", "POSITIVE", { evidence: { DIRECTIONAL_MOMENTUM: "OPPOSING" } }),
    ])).toHaveLength(0);
  });

  it("requires a resolved comparison cohort and meaningful adverse-rate lift", () => {
    expect(detectLessonCandidates([
      regimeCase("cohort-a", "NEGATIVE"),
      regimeCase("cohort-b", "INVALIDATED"),
      regimeCase("cohort-c", "POSITIVE"),
      regimeCase("cohort-d", "POSITIVE", "FIT"),
    ])).toHaveLength(0);

    expect(detectLessonCandidates([
      regimeCase("lift-a", "NEGATIVE"),
      regimeCase("lift-b", "INVALIDATED"),
      regimeCase("lift-c", "POSITIVE"),
      regimeCase("lift-d", "NEGATIVE", "FIT"),
      regimeCase("lift-e", "POSITIVE", "FIT"),
    ])).toHaveLength(0);

    expect(detectLessonCandidates([
      regimeCase("common-a", "NEGATIVE"),
      regimeCase("common-b", "INVALIDATED"),
      regimeCase("common-c", "NEGATIVE"),
      regimeCase("common-d", "NEGATIVE", "FIT"),
      regimeCase("common-e", "INVALIDATED", "FIT"),
      regimeCase("common-f", "NEGATIVE", "FIT"),
    ])).toHaveLength(0);

    const exactThresholdCases = [
      regimeCase("exact-a", "NEGATIVE"),
      regimeCase("exact-b", "INVALIDATED"),
      regimeCase("exact-c", "NEGATIVE"),
      regimeCase("exact-d", "NEGATIVE", "FIT"),
      regimeCase("exact-e", "INVALIDATED", "FIT"),
      regimeCase("exact-f", "NEGATIVE", "FIT"),
      regimeCase("exact-g", "NEGATIVE", "FIT"),
      regimeCase("exact-h", "POSITIVE", "FIT"),
    ];
    const exactThreshold = candidateFor(exactThresholdCases);
    expect(exactThreshold.adverseRateLift).toBeCloseTo(0.2, 8);
  });

  it("qualifies elevated-risk and opposing-state patterns with contrast", () => {
    const elevated = [
      policyCase("risk-a", "NEGATIVE", { risk: "ELEVATED" }),
      policyCase("risk-b", "INVALIDATED", { risk: "ELEVATED" }),
      policyCase("risk-c", "POSITIVE", { risk: "ELEVATED" }),
      policyCase("risk-d", "POSITIVE", { risk: "ACCEPTABLE" }),
      policyCase("risk-e", "POSITIVE", { risk: "ACCEPTABLE" }),
    ];
    const opposing = [
      policyCase("opposing-a", "NEGATIVE", { evidence: { DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING" } }),
      policyCase("opposing-b", "INVALIDATED", { evidence: { DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING" } }),
      policyCase("opposing-c", "POSITIVE", { evidence: { DIRECTIONAL_MOMENTUM: "STRONGLY_OPPOSING" } }),
      policyCase("opposing-d", "POSITIVE", { evidence: { DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE" } }),
      policyCase("opposing-e", "POSITIVE", { evidence: { DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE" } }),
    ];
    expect(candidateFor(elevated, "risk").condition).toEqual({ field: "risk", value: "ELEVATED" });
    expect(candidateFor(opposing, "DIRECTIONAL_MOMENTUM").condition).toEqual({
      field: "DIRECTIONAL_MOMENTUM",
      value: "STRONGLY_OPPOSING",
    });
  });

  it("is input-order independent and canonically orders case IDs", () => {
    const cases = [
      regimeCase("case-c", "POSITIVE"),
      regimeCase("case-a", "NEGATIVE"),
      regimeCase("case-b", "INVALIDATED"),
      regimeCase("case-d", "POSITIVE", "FIT"),
      regimeCase("case-e", "POSITIVE", "FIT"),
    ];
    expect(detectLessonCandidates(cases)).toEqual(
      detectLessonCandidates([...cases].reverse()),
    );
    expect(candidateFor(cases).matchingCaseIds).toEqual([
      "case-a",
      "case-b",
      "case-c",
    ]);
    expect(candidateFor(cases).adverseCaseIds).toEqual(["case-a", "case-b"]);
  });

  it("excludes UNKNOWN conditions instead of treating them as a match", () => {
    const candidates = detectLessonCandidates([
      regimeCase("case-a", "NEGATIVE", "UNKNOWN"),
      regimeCase("case-b", "INVALIDATED", "UNKNOWN"),
      regimeCase("case-c", "POSITIVE", "UNKNOWN"),
    ]);
    expect(candidates.some((candidate) => candidate.condition.value === "UNKNOWN")).toBe(false);
    expect(candidates).toHaveLength(0);
  });

  it("uses lifecycle outcome status, not P&L, for adverse classification", () => {
    const cases = [
      regimeCase("case-a", "NEGATIVE"),
      regimeCase("case-b", "INVALIDATED"),
      regimeCase("case-c", "POSITIVE"),
      regimeCase("case-d", "POSITIVE", "FIT"),
      regimeCase("case-e", "POSITIVE", "FIT"),
    ];
    const withPnl: DecisionCase[] = cases.map((entry, index) => ({
      ...entry,
      outcome: {
        status: entry.outcome?.status ?? "UNKNOWN",
        realizedPnlUsd: index === 0 ? 1000 : -1000,
        realizedPnlPercent: index === 0 ? 99 : -99,
      },
    }));
    expect(detectLessonCandidates(withPnl)).toEqual(detectLessonCandidates(cases));
    expect(candidateFor(cases).reasonCode).toBe("REPEATED_INVALIDATION_OUTCOMES");

    const weakerOnly = [
      regimeCase("case-a", "NEGATIVE"),
      regimeCase("case-b", "NEGATIVE"),
      regimeCase("case-c", "POSITIVE"),
      regimeCase("case-d", "POSITIVE", "FIT"),
      regimeCase("case-e", "POSITIVE", "FIT"),
    ];
    expect(candidateFor(weakerOnly).proposedEffect).toBe("CAUTION");
  });

  it("keeps historical outcomes out of CaseSimilarityV1", () => {
    const original = regimeCase("case-a", "POSITIVE");
    const altered = {
      ...original,
      outcome: { status: "INVALIDATED" as const, realizedPnlUsd: -5000 },
    };
    expect(compareCaseSimilarityV1(original.signature, altered.signature)).toEqual(
      compareCaseSimilarityV1(original.signature, original.signature),
    );
    expect(
      rankComparableCases(original.signature, [original]).map((entry) => entry.similarity),
    ).toEqual(
      rankComparableCases(original.signature, [altered]).map((entry) => entry.similarity),
    );
  });

  it("ranks candidates by adverse-rate lift before other strength fields", () => {
    const cases = [
      policyCase("degraded-a", "NEGATIVE", { regimeFit: "DEGRADED" }),
      policyCase("degraded-b", "INVALIDATED", { regimeFit: "DEGRADED" }),
      policyCase("degraded-c", "NEGATIVE", { regimeFit: "DEGRADED" }),
      policyCase("elevated-a", "NEGATIVE", { risk: "ELEVATED", regimeFit: "FIT" }),
      policyCase("elevated-b", "INVALIDATED", { risk: "ELEVATED", regimeFit: "FIT" }),
      policyCase("elevated-c", "POSITIVE", { risk: "ELEVATED", regimeFit: "FIT" }),
      policyCase("healthy-a", "POSITIVE", { risk: "ACCEPTABLE", regimeFit: "FIT" }),
      policyCase("healthy-b", "POSITIVE", { risk: "ACCEPTABLE", regimeFit: "FIT" }),
      policyCase("healthy-c", "POSITIVE", { risk: "ACCEPTABLE", regimeFit: "FIT" }),
      policyCase("healthy-d", "POSITIVE", { risk: "ACCEPTABLE", regimeFit: "FIT" }),
    ];
    const candidates = detectLessonCandidates(cases);
    expect(candidates[0]?.condition).toEqual({ field: "regimeFit", value: "DEGRADED" });
    expect(candidates[1]?.condition).toEqual({ field: "risk", value: "ELEVATED" });
    expect(candidates[0]?.adverseRateLift).toBeGreaterThan(candidates[1]?.adverseRateLift ?? 0);
  });

  it("creates a SYSTEM proposal that is inactive until human approval", () => {
    const scenario = getDemoScenarios()[0];
    expect(demoLessonState().selectedCandidate?.condition).toEqual({
      field: "DIRECTIONAL_MOMENTUM",
      value: "STRONGLY_OPPOSING",
    });
    expect(demoLessonState().selectedCandidate).toMatchObject({
      matchingCaseCount: 3,
      adverseCount: 3,
      nonMatchingResolvedCaseCount: 2,
      nonMatchingAdverseCount: 1,
      adverseRateLift: 0.5,
    });
    const authoring = createDemoPlaybookAuthoringState(scenario.currentGovernance);
    const lesson = demoLessonState();
    expect(lesson.status).toBe("PENDING");
    expect(lesson.lesson?.proposal.createdBy).toBe(PLAYBOOK_ACTORS.SYSTEM);
    expect(lesson.lesson?.proposal.status).toBe("PENDING");
    expect(lesson.lesson?.rule.effect).toBe("WAIT");

    const before = evaluateDemoAuthoring(
      authoring,
      scenario.currentGovernance,
      scenario.currentDecision,
      scenario.currentEvidenceSnapshot,
    ).preflight;
    expect(before.status).toBe("CAUTION");
  });

  it("suppresses equivalent active and pending lesson rules", () => {
    const scenario = getDemoScenarios()[0];
    const initial = demoLessonState();
    if (initial.lesson === null || initial.selectedCandidate === null) return;
    const activeWithLesson = {
      ...scenario.currentGovernance,
      playbookVersion: {
        ...scenario.currentGovernance.playbookVersion,
        rules: [...scenario.currentGovernance.playbookVersion.rules, initial.lesson.rule],
      },
    };
    expect(createDemoMemoryLessonState({
      governance: activeWithLesson,
      proposalIdPrefix: "duplicate-active",
      proposedVersionIdPrefix: "duplicate-active-version",
      createdAt: "2026-09-05T12:03:00.000Z",
    }).status).toBe("DUPLICATE");

    const pending = createProposal({
      proposalId: "duplicate-pending",
      playbookId: scenario.currentGovernance.playbook.id,
      proposedVersionId: "duplicate-pending-version",
      parentVersionId: scenario.currentGovernance.playbookVersion.id,
      parentVersionNumber: 1,
      strategyId: "dm-1",
      strategyVersion: "1.0.0",
      rules: [...scenario.currentGovernance.playbookVersion.rules, initial.lesson.rule],
      createdBy: PLAYBOOK_ACTORS.SYSTEM,
      createdAt: "2026-09-05T12:03:00.000Z",
    });
    expect(pending.ok).toBe(true);
    if (pending.ok !== true) return;
    expect(createDemoMemoryLessonState({
      governance: scenario.currentGovernance,
      proposalIdPrefix: "duplicate-pending",
      proposedVersionIdPrefix: "duplicate-pending-version",
      createdAt: "2026-09-05T12:03:00.000Z",
      pendingProposals: [pending.proposal],
    }).status).toBe("DUPLICATE");
  });

  it("rejects a SYSTEM self-approval, rejects without a version, and approves through HUMAN", () => {
    const scenario = getDemoScenarios()[0];
    const authoring = createDemoPlaybookAuthoringState(scenario.currentGovernance);
    const lesson = demoLessonState();
    if (lesson.lesson === null) return;
    const systemAttempt = approveProposal({
      playbook: authoring.playbook,
      versions: authoring.versions,
      proposal: lesson.lesson.proposal,
      approvedAt: "2026-09-05T12:05:00.000Z",
      approvedBy: PLAYBOOK_ACTORS.SYSTEM,
    });
    expect(systemAttempt).toMatchObject({ ok: false, code: "SYSTEM_NOT_AUTHORIZED" });

    const rejected = rejectDemoMemoryLesson(lesson, "2026-09-05T12:05:00.000Z");
    expect(rejected.ok).toBe(true);
    if (rejected.ok !== true) return;
    expect(rejected.state.status).toBe("REJECTED");
    expect(rejected.state.lesson?.proposal.status).toBe("REJECTED");
    expect(authoring.versions).toHaveLength(1);
    expect(rejectDemoMemoryLesson(rejected.state, "2026-09-05T12:05:00.000Z")).toMatchObject({
      ok: false,
      code: "PROPOSAL_NOT_PENDING",
    });

    const approved = approveDemoMemoryLesson(
      lesson,
      authoring,
      "2026-09-05T12:05:00.000Z",
    );
    expect(approved.ok).toBe(true);
    if (approved.ok !== true) return;
    expect(approved.approval.proposal.createdBy).toBe(PLAYBOOK_ACTORS.SYSTEM);
    expect(approved.approval.proposal.resolvedBy).toBe(PLAYBOOK_ACTORS.HUMAN);
    expect(approved.approval.version.versionNumber).toBe(2);
    expect(approved.approval.versions[0]).toEqual(authoring.activeVersion);
  });

  it("makes the existing Preflight react only after lesson approval", () => {
    const scenario = getDemoScenarios()[2];
    const authoring = createDemoPlaybookAuthoringState(scenario.originalGovernance);
    const lesson = demoLessonState(scenario);
    if (lesson.lesson === null) return;
    const before = evaluateDemoAuthoring(
      authoring,
      scenario.currentGovernance,
      scenario.currentDecision,
      scenario.currentEvidenceSnapshot,
    ).preflight;
    const approved = approveDemoMemoryLesson(
      lesson,
      authoring,
      "2026-09-05T12:05:00.000Z",
    );
    expect(approved.ok).toBe(true);
    if (approved.ok !== true) return;
    const advanced = applyApprovedDemoProposal(authoring, approved.approval);
    const after = evaluateDemoAuthoring(
      advanced,
      scenario.currentGovernance,
      scenario.currentDecision,
      scenario.currentEvidenceSnapshot,
    ).preflight;

    expect(before.status).toBe("CAUTION");
    expect(after.status).toBe("WAIT");
    expect(after.effectiveDecision).toBe("ABSTAIN");
    expect(advanced.activeVersion.versionNumber).toBe(2);
    expect(advanced.activeVersion.sourceProposalId).toBe(lesson.lesson.proposal.id);
    expect(Object.isFrozen(advanced.activeVersion)).toBe(true);
    expect(authoring.activeVersion.versionNumber).toBe(1);
  });
});
