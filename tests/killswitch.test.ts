import { describe, expect, it } from "vitest";
import { evaluateCandidate } from "../lib/strategy/dm1/decision";
import { makeDM1Fixture, makeCandidateEvaluation } from "./fixtures/dm1";
import {
  makeEvidenceItem,
  makeKillSwitchInput,
} from "./fixtures/killswitch";
import {
  aggregateKillSwitchResults,
  validateKillSwitch,
} from "../lib/killswitch/validator";

describe("KillSwitch deterministic validation", () => {
  it("validates referenced evidence and preserves the supplied state", () => {
    const input = makeKillSwitchInput();
    const before = JSON.stringify(input);

    const result = validateKillSwitch(input);

    expect(result.validatedEvidenceIds).toEqual(["evidence-momentum"]);
    expect(result.missingEvidenceIds).toEqual([]);
    expect(result.verdict).toBe("CLEAR");
    expect(JSON.stringify(input)).toBe(before);
  });

  it("returns VETO for strong evidence contradicting LONG", () => {
    const result = validateKillSwitch(
      makeKillSwitchInput({
        dm1: makeDM1Fixture({
          evidence: { TECHNICAL_CONFLUENCE: "STRONGLY_OPPOSING" },
        }),
        provisional: evaluateCandidate({
          asset: "SOL",
          evidence: makeDM1Fixture({
            evidence: { TECHNICAL_CONFLUENCE: "STRONGLY_OPPOSING" },
          }),
        }),
        items: [
          makeEvidenceItem("evidence-technical", "STRONGLY_OPPOSING"),
        ],
        challenge: {
          evidenceIds: ["evidence-technical"],
        },
      }),
    );

    expect(result.verdict).toBe("VETO");
    expect(result.effect).toBe("VETO");
    expect(result.reasonCodes).toContain("DIRECTION_CONTRADICTION_FOUND");
  });

  it("returns CAUTION for a moderate directional contradiction", () => {
    const evidence = makeDM1Fixture({
      evidence: { TECHNICAL_CONFLUENCE: "OPPOSING" },
    });
    const result = validateKillSwitch(
      makeKillSwitchInput({
        dm1: evidence,
        provisional: evaluateCandidate({ asset: "SOL", evidence }),
        items: [makeEvidenceItem("evidence-technical", "OPPOSING")],
        challenge: { evidenceIds: ["evidence-technical"] },
      }),
    );

    expect(result.verdict).toBe("CAUTION");
    expect(result.effect).toBe("CAUTION");
  });

  it("returns UNKNOWN when a referenced evidence ID is unavailable", () => {
    const result = validateKillSwitch(
      makeKillSwitchInput({
        challenge: { evidenceIds: ["evidence-does-not-exist"] },
      }),
    );

    expect(result.verdict).toBe("UNKNOWN");
    expect(result.effect).toBe("NONE");
    expect(result.missingEvidenceIds).toEqual(["evidence-does-not-exist"]);
  });

  it("detects single-source fragility without changing the score", () => {
    const result = validateKillSwitch(
      makeKillSwitchInput({
        items: [
          makeEvidenceItem("evidence-momentum", "SUPPORTIVE", "same-source"),
          makeEvidenceItem("evidence-technical", "SUPPORTIVE", "same-source"),
        ],
        challenge: {
          challengeType: "SINGLE_SOURCE_FRAGILITY",
          evidenceIds: ["evidence-momentum", "evidence-technical"],
        },
      }),
    );

    expect(result.verdict).toBe("CAUTION");
    expect(result.effect).toBe("CAUTION");
    expect(result.reasonCodes).toContain("SINGLE_SOURCE_FRAGILITY_FOUND");
  });

  it("vetoes a broken regime", () => {
    const result = validateKillSwitch(
      makeKillSwitchInput({
        dm1: makeDM1Fixture({ regimeFit: "BROKEN" }),
        items: [
          { id: "evidence-regime", kind: "REGIME_FIT", state: "BROKEN", source: "regime" },
        ],
        challenge: {
          challengeType: "REGIME_CONFLICT",
          evidenceIds: ["evidence-regime"],
        },
      }),
    );

    expect(result.verdict).toBe("VETO");
    expect(result.reasonCodes).toContain("REGIME_CONFLICT_FOUND");
  });

  it("requests recomputation when a materially stronger candidate exists", () => {
    const target = makeCandidateEvaluation({ asset: "SOL", thesisStrength: 70 });
    const alternative = makeCandidateEvaluation({ asset: "ETH", thesisStrength: 80 });
    const result = validateKillSwitch(
      makeKillSwitchInput({
        provisional: target,
        comparison: {
          available: true,
          selectedCandidateId: "candidate-sol",
          candidates: [
            { id: "candidate-sol", evaluation: target },
            { id: "candidate-eth", evaluation: alternative },
          ],
        },
        challenge: {
          challengeType: "RELATIVE_OPPORTUNITY_FAILURE",
          evidenceIds: ["evidence-relative"],
          assets: ["ETH"],
        },
      }),
    );

    expect(result.verdict).toBe("CAUTION");
    expect(result.effect).toBe("RECOMPUTE");
    expect(result.reasonCodes).toContain("RELATIVE_OPPORTUNITY_FAILURE_FOUND");
  });

  it("vetoes extreme risk and safety failure", () => {
    const riskResult = validateKillSwitch(
      makeKillSwitchInput({
        dm1: makeDM1Fixture({ risk: "EXTREME" }),
        items: [
          { id: "evidence-risk", kind: "RISK", state: "EXTREME", source: "risk" },
        ],
        challenge: {
          challengeType: "RISK_INCOMPATIBILITY",
          evidenceIds: ["evidence-risk"],
        },
      }),
    );
    const safetyResult = validateKillSwitch(
      makeKillSwitchInput({
        dm1: makeDM1Fixture({ safety: "VETO" }),
        items: [
          { id: "evidence-safety", kind: "SAFETY", state: "VETO", source: "safety" },
        ],
        challenge: {
          challengeType: "SAFETY_FAILURE",
          evidenceIds: ["evidence-safety"],
        },
      }),
    );

    expect(riskResult.verdict).toBe("VETO");
    expect(safetyResult.verdict).toBe("VETO");
  });

  it("vetoes a missing required DM-1 input", () => {
    const result = validateKillSwitch(
      makeKillSwitchInput({
        dm1: makeDM1Fixture({ risk: "UNKNOWN" }),
        items: [
          { id: "evidence-risk", kind: "RISK", state: "UNKNOWN", source: "risk" },
        ],
        challenge: {
          challengeType: "MISSING_CRITICAL_EVIDENCE",
          evidenceIds: ["evidence-risk"],
        },
      }),
    );

    expect(result.verdict).toBe("VETO");
    expect(result.effect).toBe("VETO");
  });

  it("does not apply the reserved narrative challenge", () => {
    const result = validateKillSwitch(
      makeKillSwitchInput({
        challenge: {
          challengeType: "NARRATIVE_DISTORTION",
          evidenceIds: [],
        },
      }),
    );

    expect(result.verdict).toBe("UNKNOWN");
    expect(result.effect).toBe("NONE");
    expect(result.reasonCodes).toContain("UNSUPPORTED_CHALLENGE_TYPE");
  });

  it("keeps a relative challenge UNKNOWN when comparison is unavailable", () => {
    const result = validateKillSwitch(
      makeKillSwitchInput({
        comparison: {
          available: false,
          selectedCandidateId: null,
          candidates: [],
        },
        challenge: {
          challengeType: "RELATIVE_OPPORTUNITY_FAILURE",
          evidenceIds: ["evidence-relative"],
        },
      }),
    );

    expect(result.verdict).toBe("UNKNOWN");
    expect(result.reasonCodes).toContain("CHALLENGE_CANDIDATE_UNAVAILABLE");
  });
});

describe("KillSwitch verdict aggregation", () => {
  it("uses VETO before critical UNKNOWN and CAUTION", () => {
    const caution = validateKillSwitch(
      makeKillSwitchInput({
        items: [
          makeEvidenceItem("evidence-momentum", "SUPPORTIVE", "same-source"),
          makeEvidenceItem("evidence-technical", "SUPPORTIVE", "same-source"),
        ],
        challenge: {
          challengeType: "SINGLE_SOURCE_FRAGILITY",
          evidenceIds: ["evidence-momentum", "evidence-technical"],
        },
      }),
    );
    const unknown = validateKillSwitch(
      makeKillSwitchInput({ challenge: { evidenceIds: ["missing"] } }),
    );
    const veto = validateKillSwitch(
      makeKillSwitchInput({
        dm1: makeDM1Fixture({ safety: "VETO" }),
        items: [
          { id: "evidence-safety", kind: "SAFETY", state: "VETO", source: "safety" },
        ],
        challenge: {
          challengeType: "SAFETY_FAILURE",
          evidenceIds: ["evidence-safety"],
        },
      }),
    );

    const aggregate = aggregateKillSwitchResults([caution, unknown, veto]);

    expect(aggregate.verdict).toBe("VETO");
    expect(aggregate.effect).toBe("VETO");
    expect(aggregate.results).toHaveLength(3);
  });

  it("lets a recompute caution survive without upgrading to veto", () => {
    const recompute = validateKillSwitch(
      makeKillSwitchInput({
        provisional: makeCandidateEvaluation({ asset: "SOL", thesisStrength: 70 }),
        comparison: {
          available: true,
          selectedCandidateId: "candidate-sol",
          candidates: [
            {
              id: "candidate-sol",
              evaluation: makeCandidateEvaluation({ asset: "SOL", thesisStrength: 70 }),
            },
            {
              id: "candidate-eth",
              evaluation: makeCandidateEvaluation({ asset: "ETH", thesisStrength: 80 }),
            },
          ],
        },
        challenge: {
          challengeType: "RELATIVE_OPPORTUNITY_FAILURE",
          evidenceIds: ["evidence-relative"],
          assets: ["ETH"],
        },
      }),
    );
    const unsupported = validateKillSwitch(
      makeKillSwitchInput({
        challenge: {
          challengeType: "NARRATIVE_DISTORTION",
          evidenceIds: [],
        },
      }),
    );

    const aggregate = aggregateKillSwitchResults([recompute, unsupported]);

    expect(aggregate.verdict).toBe("CAUTION");
    expect(aggregate.effect).toBe("RECOMPUTE");
  });
});
