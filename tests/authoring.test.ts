import { describe, expect, it } from "vitest";
import { evaluatePreflight } from "../lib/decision";
import {
  approveDemoRule,
  buildDemoRule,
  createDemoPlaybookAuthoringState,
  describeDemoRule,
  evaluateDemoAuthoring,
  proposeDemoRule,
  rejectDemoRule,
} from "../lib/demo/authoring";
import { getDemoScenarios } from "../lib/demo/scenarios";
import type { PlaybookRule } from "../lib/playbook";

function authoredRule(effect: "CAUTION" | "WAIT" | "BLOCK") {
  const built = buildDemoRule({
    field: "decision",
    operator: "EQUALS",
    value: "LONG",
    effect,
  });
  if (built.ok !== true) throw new Error(built.message);
  return built.rule;
}

describe("demo Playbook authoring", () => {
  it("creates a pending proposal without changing active Preflight", () => {
    const scenario = getDemoScenarios()[0];
    expect(describeDemoRule(authoredRule("WAIT"))).toBe("Wait when the market decision is long.");
    const initial = createDemoPlaybookAuthoringState(scenario.originalGovernance);
    const before = evaluateDemoAuthoring(
      initial,
      scenario.originalGovernance,
      scenario.originalDecision,
      scenario.originalEvidenceSnapshot,
    );
    const proposed = proposeDemoRule(initial, authoredRule("WAIT"));

    expect(proposed.ok).toBe(true);
    if (proposed.ok !== true) return;

    const afterPending = evaluateDemoAuthoring(
      proposed.state,
      scenario.originalGovernance,
      scenario.originalDecision,
      scenario.originalEvidenceSnapshot,
    );
    expect(proposed.state.pendingProposal?.proposal.status).toBe("PENDING");
    expect(proposed.state.activeVersion.versionNumber).toBe(1);
    expect(afterPending.preflight).toEqual(before.preflight);
  });

  it("rejects a proposal without creating a version", () => {
    const scenario = getDemoScenarios()[0];
    const initial = createDemoPlaybookAuthoringState(scenario.originalGovernance);
    const proposed = proposeDemoRule(initial, authoredRule("BLOCK"));
    expect(proposed.ok).toBe(true);
    if (proposed.ok !== true) return;

    const rejected = rejectDemoRule(proposed.state);
    expect(rejected.ok).toBe(true);
    if (rejected.ok !== true) return;

    expect(rejected.state.versions).toHaveLength(1);
    expect(rejected.state.activeVersion.id).toBe(initial.activeVersion.id);
    expect(rejected.state.proposals[0]?.proposal.status).toBe("REJECTED");
    expect(rejected.state.pendingProposal).toBeNull();
  });

  it.each([
    ["CAUTION", "CAUTION"],
    ["WAIT", "WAIT"],
    ["BLOCK", "BLOCK"],
  ] as const)("approves a %s rule through M2 and changes Preflight", (effect, expected) => {
    const scenario = getDemoScenarios()[0];
    const initial = createDemoPlaybookAuthoringState(scenario.originalGovernance);
    const proposed = proposeDemoRule(initial, authoredRule(effect));
    expect(proposed.ok).toBe(true);
    if (proposed.ok !== true) return;
    const approved = approveDemoRule(proposed.state);

    expect(approved.ok).toBe(true);
    if (approved.ok !== true) return;

    const evaluated = evaluateDemoAuthoring(
      approved.state,
      scenario.originalGovernance,
      scenario.originalDecision,
      scenario.originalEvidenceSnapshot,
    );
    expect(approved.state.activeVersion.versionNumber).toBe(2);
    expect(approved.state.versions[0]).toEqual(initial.activeVersion);
    expect(approved.state.proposals[0]?.proposal.status).toBe("APPROVED");
    expect(approved.state.pendingProposal).toBeNull();
    expect(evaluated.preflight.status).toBe(expected);
    expect(evaluated.preflight.playbookEvaluation.ruleEvaluations.some(
      (entry) => entry.rule.id === authoredRule(effect).id && entry.outcome === "TRIGGERED",
    )).toBe(true);
  });

  it("keeps M2 UNKNOWN diagnostics for an approved rule", () => {
    const scenario = getDemoScenarios()[1];
    const initial = createDemoPlaybookAuthoringState(scenario.originalGovernance);
    const built = buildDemoRule({
      field: "SENTIMENT_DERIVATIVES",
      operator: "EQUALS",
      value: "SUPPORTIVE",
      effect: "BLOCK",
    });
    expect(built.ok).toBe(true);
    if (built.ok !== true) return;
    const proposed = proposeDemoRule(initial, built.rule);
    expect(proposed.ok).toBe(true);
    if (proposed.ok !== true) return;
    const approved = approveDemoRule(proposed.state);
    expect(approved.ok).toBe(true);
    if (approved.ok !== true) return;

    const evaluated = evaluateDemoAuthoring(
      approved.state,
      scenario.currentGovernance,
      scenario.currentDecision,
      scenario.currentEvidenceSnapshot,
    );
    const evaluation = evaluated.preflight.playbookEvaluation.ruleEvaluations.find(
      (entry) => entry.rule.id === built.rule.id,
    );
    expect(evaluation?.outcome).toBe("UNKNOWN");
    expect(evaluation?.diagnostics[0]?.code).toBe("CONDITION_UNKNOWN");
  });

  it("does not create a proposal for an invalid rule", () => {
    const scenario = getDemoScenarios()[0];
    const initial = createDemoPlaybookAuthoringState(scenario.originalGovernance);
    const proposed = proposeDemoRule(initial, {
      id: "invalid-empty-rule",
      effect: "WAIT",
      conditions: [],
    } as PlaybookRule);

    expect(proposed).toMatchObject({ ok: false });
    expect(initial.versions).toHaveLength(1);
    expect(initial.pendingProposal).toBeNull();
  });

  it("uses existing rule validation for invalid drafts", () => {
    expect(
      buildDemoRule({
        field: "coverage",
        operator: "GTE",
        value: "2",
        effect: "WAIT",
      }),
    ).toMatchObject({ ok: false, code: "OUT_OF_RANGE_NUMBER" });
    expect(
      buildDemoRule({
        field: "decision",
        operator: "GTE" as never,
        value: "LONG",
        effect: "WAIT",
      }),
    ).toMatchObject({ ok: false, code: "UNSUPPORTED_OPERATOR" });
  });

  it("does not change the original M4 path while checking the approved result", () => {
    const scenario = getDemoScenarios()[0];
    const initial = createDemoPlaybookAuthoringState(scenario.originalGovernance);
    const proposed = proposeDemoRule(initial, authoredRule("BLOCK"));
    expect(proposed.ok).toBe(true);
    if (proposed.ok !== true) return;
    const approved = approveDemoRule(proposed.state);
    expect(approved.ok).toBe(true);
    if (approved.ok !== true) return;

    const direct = evaluatePreflight({
      marketResult: scenario.originalDecision,
      evidence: scenario.originalEvidenceSnapshot,
      playbookVersion: approved.state.activeVersion,
      memorySnapshot: scenario.originalGovernance.memorySnapshot,
    });
    const adapted = evaluateDemoAuthoring(
      approved.state,
      scenario.originalGovernance,
      scenario.originalDecision,
      scenario.originalEvidenceSnapshot,
    ).preflight;

    expect(direct).toEqual(adapted);
  });
});
