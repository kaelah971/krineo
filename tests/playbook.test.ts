import { describe, expect, it } from "vitest";
import {
  approveProposal,
  createInitialVersion,
  createProposal,
  evaluateRule,
  evaluateVersion,
  rejectProposal,
  validateHistory,
} from "../lib/playbook";
import type {
  Condition,
  EvaluationContext,
  PlaybookActor,
  PlaybookRule,
  PlaybookVersion,
  Proposal,
} from "../lib/playbook/types";
import {
  makeBlockSafetyRule,
  makeEvaluationContext,
  makePassRule,
} from "./fixtures/playbook";

const T0 = "2026-09-25T10:00:00.000Z";
const T1 = "2026-09-25T11:00:00.000Z";
const T2 = "2026-09-25T12:00:00.000Z";

function seedV1(rules: readonly PlaybookRule[] = [makePassRule()]) {
  const res = createInitialVersion({
    playbookId: "pb-1",
    strategyId: "dm-1",
    strategyVersion: "1.0.0",
    versionId: "v-1",
    rules,
    createdAt: T0,
    approvedAt: T0,
    approvedBy: "HUMAN",
  });
  if (res.ok !== true) throw new Error(`seed failed: ${res.message}`);
  return res;
}

function cond(
  field: string,
  operator: string,
  value: unknown,
): Condition {
  return { field, operator, value } as unknown as Condition;
}

function unkCtx(): EvaluationContext {
  return makeEvaluationContext({
    evidence: {
      DIRECTIONAL_MOMENTUM: "UNKNOWN",
      TECHNICAL_CONFLUENCE: "SUPPORTIVE",
      RELATIVE_OPPORTUNITY: "SUPPORTIVE",
      MARKET_ALIGNMENT: "SUPPORTIVE",
      SENTIMENT_DERIVATIVES: "SUPPORTIVE",
    },
  });
}

interface SeedPlaybook {
  readonly id: string;
  readonly currentVersionId: string;
  readonly currentVersionNumber: number;
}

function proposalInput(
  seed: { playbook: SeedPlaybook },
  overrides?: {
    proposalId?: string;
    proposedVersionId?: string;
    rules?: readonly PlaybookRule[];
    createdBy?: PlaybookActor;
  },
) {
  return {
    proposalId: overrides?.proposalId ?? "p-1",
    playbookId: "pb-1",
    proposedVersionId: overrides?.proposedVersionId ?? "v-2",
    parentVersionId: "v-1",
    parentVersionNumber: 1,
    strategyId: "dm-1",
    strategyVersion: "1.0.0",
    rules: overrides?.rules ?? [makeBlockSafetyRule()],
    createdBy: overrides?.createdBy ?? "HUMAN",
    createdAt: T1,
  } as const;
}

describe("M2.1 Governed Playbook V1", () => {
  describe("versioning", () => {
    it("creates initial version deterministically and freezes", () => {
      const res = seedV1();
      expect(res.playbook.currentVersionId).toBe("v-1");
      expect(res.playbook.currentVersionNumber).toBe(1);
      expect(res.version.versionNumber).toBe(1);
      expect(Object.isFrozen(res.playbook)).toBe(true);
      expect(Object.isFrozen(res.version)).toBe(true);
      expect(Object.isFrozen(res.version.rules)).toBe(true);
    });

    it("MODEL cannot bootstrap initial version", () => {
      const res = createInitialVersion({
        playbookId: "pb-1",
        strategyId: "dm-1",
        strategyVersion: "1.0.0",
        versionId: "v-1",
        rules: [makePassRule()],
        createdAt: T0,
        approvedAt: T0,
        approvedBy: "MODEL" as unknown as "HUMAN",
      });
      expect(res.ok).toBe(false);
      if (res.ok === false) expect(res.code).toBe("MODEL_NOT_AUTHORIZED");
    });

    it("SYSTEM cannot bootstrap initial version", () => {
      const res = createInitialVersion({
        playbookId: "pb-1",
        strategyId: "dm-1",
        strategyVersion: "1.0.0",
        versionId: "v-1",
        rules: [makePassRule()],
        createdAt: T0,
        approvedAt: T0,
        approvedBy: "SYSTEM" as unknown as "HUMAN",
      });
      expect(res.ok).toBe(false);
      if (res.ok === false) expect(res.code).toBe("SYSTEM_NOT_AUTHORIZED");
    });

    it("adding a rule creates a new immutable version; old unchanged", () => {
      const seed = seedV1();
      const before = JSON.stringify(seed.version);
      const prop = createProposal(
        proposalInput(seed, {
          rules: [makePassRule(), makeBlockSafetyRule()],
        }),
      );
      if (prop.ok !== true) throw new Error("prop failed");
      const appr = approveProposal({
        playbook: seed.playbook,
        versions: [seed.version],
        proposal: prop.proposal,
        approvedAt: T2,
        approvedBy: "HUMAN",
      });
      if (appr.ok !== true) throw new Error("appr failed");
      expect(appr.version.versionNumber).toBe(2);
      expect(appr.playbook.currentVersionId).toBe("v-2");
      expect(JSON.stringify(seed.version)).toBe(before);
      expect(appr.versions).toHaveLength(2);
    });

    it("stale proposal approval rejects", () => {
      const seed = seedV1();
      const prop = createProposal(
        proposalInput(seed, { proposalId: "p-1", proposedVersionId: "v-2" }),
      );
      if (prop.ok !== true) throw new Error("proposal failed");
      const prop2 = createProposal(
        proposalInput(seed, {
          proposalId: "p-2",
          proposedVersionId: "v-2b",
          rules: [makePassRule({ id: "rule-other" })],
        }),
      );
      if (prop2.ok !== true) throw new Error("proposal2 failed");
      const appr2 = approveProposal({
        playbook: seed.playbook,
        versions: [seed.version],
        proposal: prop2.proposal,
        approvedAt: T2,
        approvedBy: "HUMAN",
      });
      if (appr2.ok !== true) throw new Error("approve2 failed");
      const stale = approveProposal({
        playbook: appr2.playbook,
        versions: appr2.versions,
        proposal: prop.proposal,
        approvedAt: T2,
        approvedBy: "HUMAN",
      });
      expect(stale.ok).toBe(false);
      if (stale.ok === false) expect(stale.code).toBe("STALE_PARENT");
    });

    it("duplicate rule ids reject and canonical ordering is deterministic", () => {
      const dup = createInitialVersion({
        playbookId: "pb-1",
        strategyId: "dm-1",
        strategyVersion: "1.0.0",
        versionId: "v-1",
        rules: [makePassRule({ id: "same" }), makePassRule({ id: "same" })],
        createdAt: T0,
        approvedAt: T0,
        approvedBy: "HUMAN",
      });
      expect(dup.ok).toBe(false);
      const a = seedV1([makePassRule({ id: "b" }), makePassRule({ id: "a" })]);
      expect(a.version.rules.map((r) => r.id)).toEqual(["a", "b"]);
    });

    it("validateHistory accepts well-formed history and rejects bad pointer", () => {
      const seed = seedV1();
      const ok = validateHistory({
        playbook: seed.playbook,
        versions: [seed.version],
      });
      expect(ok.ok).toBe(true);
      const bad = validateHistory({
        playbook: { ...seed.playbook, currentVersionNumber: 5 },
        versions: [seed.version],
      });
      expect(bad.ok).toBe(false);
    });

    it("approveProposal rejects a corrupted versions array", () => {
      const seed = seedV1();
      const prop = createProposal(proposalInput(seed));
      if (prop.ok !== true) throw new Error("proposal failed");
      const evil: PlaybookVersion = {
        ...seed.version,
        rules: [makeBlockSafetyRule({ id: "evil" })],
      };
      const corrupted = approveProposal({
        playbook: seed.playbook,
        versions: [seed.version, evil],
        proposal: prop.proposal,
        approvedAt: "2026-09-25T12:00:00.000Z",
        approvedBy: "HUMAN",
      });
      expect(corrupted.ok).toBe(false);
      if (corrupted.ok === false) expect(corrupted.code).toBe("INVALID_HISTORY");
    });
    it("validateHistory validates proposals and rejects non-human resolvedBy", () => {
      const seed = seedV1();
      const validProp: Proposal = {
        id: "prop-1",
        playbookId: seed.playbook.id,
        proposedVersionId: "v-2",
        parentVersionId: "v-1",
        parentVersionNumber: 1,
        strategyId: "dm-1",
        strategyVersion: "1.0.0",
        rules: [makePassRule()],
        createdBy: "SYSTEM",
        createdAt: T1,
        status: "APPROVED",
        resolvedAt: T2,
        resolvedBy: "HUMAN",
      };
      const ok = validateHistory({
        playbook: seed.playbook,
        versions: [seed.version],
        proposals: [validProp],
      });
      expect(ok.ok).toBe(true);

      // Non-human SYSTEM resolvedBy on approved proposal
      const badSys = validateHistory({
        playbook: seed.playbook,
        versions: [seed.version],
        proposals: [{ ...validProp, resolvedBy: "SYSTEM" as unknown as "HUMAN" }],
      });
      expect(badSys.ok).toBe(false);
      if (badSys.ok === false) expect(badSys.code).toBe("INVALID_HISTORY");

      // Non-human MODEL resolvedBy on approved proposal
      const badModel = validateHistory({
        playbook: seed.playbook,
        versions: [seed.version],
        proposals: [{ ...validProp, resolvedBy: "MODEL" as unknown as "HUMAN" }],
      });
      expect(badModel.ok).toBe(false);
      if (badModel.ok === false) expect(badModel.code).toBe("INVALID_HISTORY");

      // Missing resolvedBy on approved proposal
      const badUndef = validateHistory({
        playbook: seed.playbook,
        versions: [seed.version],
        proposals: [{ ...validProp, resolvedBy: undefined as unknown as "HUMAN" }],
      });
      expect(badUndef.ok).toBe(false);
      if (badUndef.ok === false) expect(badUndef.code).toBe("INVALID_HISTORY");

      // Rejected proposal with MODEL resolvedBy
      const badRejModel = validateHistory({
        playbook: seed.playbook,
        versions: [seed.version],
        proposals: [
          {
            ...validProp,
            status: "REJECTED",
            rejectionReason: "reason",
            resolvedBy: "MODEL" as unknown as "HUMAN",
          },
        ],
      });
      expect(badRejModel.ok).toBe(false);
      if (badRejModel.ok === false) expect(badRejModel.code).toBe("INVALID_HISTORY");

      // Pending proposal with extraneous resolvedBy
      const badPendingWithResolved = validateHistory({
        playbook: seed.playbook,
        versions: [seed.version],
        proposals: [
          {
            ...validProp,
            status: "PENDING",
            resolvedAt: undefined,
            resolvedBy: "HUMAN",
          },
        ],
      });
      expect(badPendingWithResolved.ok).toBe(false);
      if (badPendingWithResolved.ok === false) {
        expect(badPendingWithResolved.code).toBe("INVALID_HISTORY");
      }
    });
  });

  describe("proposals and provenance (HUMAN, SYSTEM, MODEL)", () => {
    it("PENDING proposal has zero policy effect", () => {
      const seed = seedV1([makePassRule()]);
      const prop = createProposal(
        proposalInput(seed, { proposalId: "p-9", createdBy: "MODEL" }),
      );
      expect(prop.ok).toBe(true);
      const ctx = makeEvaluationContext({ safety: "VETO" });
      const ev = evaluateVersion(seed.version, ctx);
      if (ev.ok !== true) throw new Error("eval failed");
      expect(ev.evaluation.aggregateEffect).toBe("PASS");
    });

    it("SYSTEM proposal can be created and has zero policy effect while pending", () => {
      const seed = seedV1([makePassRule()]);
      const prop = createProposal(
        proposalInput(seed, {
          proposalId: "p-sys",
          proposedVersionId: "v-sys",
          createdBy: "SYSTEM",
          rules: [makeBlockSafetyRule()],
        }),
      );
      expect(prop.ok).toBe(true);
      if (prop.ok !== true) throw new Error("sys prop failed");
      expect(prop.proposal.createdBy).toBe("SYSTEM");
      expect(prop.proposal.status).toBe("PENDING");

      // Zero active policy effect
      const ctx = makeEvaluationContext({ safety: "VETO" });
      const ev = evaluateVersion(seed.version, ctx);
      if (ev.ok !== true) throw new Error("eval failed");
      expect(ev.evaluation.aggregateEffect).toBe("PASS");
    });

    it("HUMAN can approve a SYSTEM proposal into an immutable PlaybookVersion preserving provenance", () => {
      const seed = seedV1([makePassRule()]);
      const prop = createProposal(
        proposalInput(seed, {
          proposalId: "p-sys-approved",
          proposedVersionId: "v-2",
          createdBy: "SYSTEM",
          rules: [makePassRule(), makeBlockSafetyRule()],
        }),
      );
      if (prop.ok !== true) throw new Error("sys prop failed");

      const appr = approveProposal({
        playbook: seed.playbook,
        versions: [seed.version],
        proposal: prop.proposal,
        approvedAt: T2,
        approvedBy: "HUMAN",
      });
      expect(appr.ok).toBe(true);
      if (appr.ok !== true) throw new Error("appr failed");

      // Provenance remains distinguishable after resolution
      expect(appr.proposal.status).toBe("APPROVED");
      expect(appr.proposal.createdBy).toBe("SYSTEM");
      expect(appr.version.sourceProposalId).toBe("p-sys-approved");
      expect(appr.version.sourceProposalCreator).toBe("SYSTEM");
      expect(appr.version.approvedBy).toBe("HUMAN");
    });

    it("SYSTEM and MODEL cannot approve proposals", () => {
      const seed = seedV1();
      const propSys = createProposal(
        proposalInput(seed, { proposalId: "p-sys", createdBy: "SYSTEM" }),
      );
      if (propSys.ok !== true) throw new Error("sys prop failed");

      // SYSTEM cannot approve
      const sysAppr = approveProposal({
        playbook: seed.playbook,
        versions: [seed.version],
        proposal: propSys.proposal,
        approvedAt: T2,
        approvedBy: "SYSTEM" as unknown as "HUMAN",
      });
      expect(sysAppr.ok).toBe(false);
      if (sysAppr.ok === false) expect(sysAppr.code).toBe("SYSTEM_NOT_AUTHORIZED");

      // MODEL cannot approve
      const modelAppr = approveProposal({
        playbook: seed.playbook,
        versions: [seed.version],
        proposal: propSys.proposal,
        approvedAt: T2,
        approvedBy: "MODEL" as unknown as "HUMAN",
      });
      expect(modelAppr.ok).toBe(false);
      if (modelAppr.ok === false) expect(modelAppr.code).toBe("MODEL_NOT_AUTHORIZED");
    });

    it("SYSTEM and MODEL cannot reject proposals, but HUMAN can reject SYSTEM proposal", () => {
      const seed = seedV1();
      const propSys = createProposal(
        proposalInput(seed, { proposalId: "p-sys-rej", createdBy: "SYSTEM" }),
      );
      if (propSys.ok !== true) throw new Error("sys prop failed");

      // SYSTEM cannot reject
      const sysRej = rejectProposal({
        proposal: propSys.proposal,
        rejectedAt: T2,
        resolvedBy: "SYSTEM" as unknown as "HUMAN",
        rejectionReason: "system cancel",
      });
      expect(sysRej.ok).toBe(false);
      if (sysRej.ok === false) expect(sysRej.code).toBe("SYSTEM_NOT_AUTHORIZED");

      // MODEL cannot reject
      const modelRej = rejectProposal({
        proposal: propSys.proposal,
        rejectedAt: T2,
        resolvedBy: "MODEL" as unknown as "HUMAN",
        rejectionReason: "model cancel",
      });
      expect(modelRej.ok).toBe(false);
      if (modelRej.ok === false) expect(modelRej.code).toBe("MODEL_NOT_AUTHORIZED");

      // HUMAN can reject
      const humanRej = rejectProposal({
        proposal: propSys.proposal,
        rejectedAt: T2,
        resolvedBy: "HUMAN",
        rejectionReason: "human decided against it",
      });
      expect(humanRej.ok).toBe(true);
      if (humanRej.ok !== true) throw new Error("rej failed");
      expect(humanRej.proposal.status).toBe("REJECTED");
      expect(humanRej.proposal.createdBy).toBe("SYSTEM");
    });

    it("reject mutates nothing; no repeat resolution", () => {
      const seed = seedV1();
      const prop = createProposal(proposalInput(seed));
      if (prop.ok !== true) throw new Error("p failed");
      const rej = rejectProposal({
        proposal: prop.proposal,
        rejectedAt: T2,
        resolvedBy: "HUMAN",
        rejectionReason: "not now",
      });
      if (rej.ok !== true) throw new Error("rej failed");
      expect(rej.proposal.status).toBe("REJECTED");
      const again = rejectProposal({
        proposal: rej.proposal,
        rejectedAt: T2,
        resolvedBy: "HUMAN",
        rejectionReason: "again",
      });
      expect(again.ok).toBe(false);
      const apprAfterReject = approveProposal({
        playbook: seed.playbook,
        versions: [seed.version],
        proposal: rej.proposal,
        approvedAt: T2,
        approvedBy: "HUMAN",
      });
      expect(apprAfterReject.ok).toBe(false);
    });
  });

  describe("rule conditions", () => {
    it("canonical states evaluate; UNKNOWN distinct from NEUTRAL", () => {
      const rule: PlaybookRule = {
        id: "r-unk",
        effect: "BLOCK",
        conditions: [cond("DIRECTIONAL_MOMENTUM", "EQUALS", "UNKNOWN")],
      };
      const ctxUnk = makeEvaluationContext({
        evidence: {
          DIRECTIONAL_MOMENTUM: "UNKNOWN",
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });
      const hit = evaluateRule(rule, ctxUnk);
      if (hit.ok !== true) throw new Error("hit failed");
      expect(hit.evaluation.outcome).toBe("TRIGGERED");
      const ctxNeu = makeEvaluationContext({
        evidence: {
          DIRECTIONAL_MOMENTUM: "NEUTRAL",
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });
      const miss = evaluateRule(rule, ctxNeu);
      if (miss.ok !== true) throw new Error("miss failed");
      expect(miss.evaluation.outcome).toBe("NOT_TRIGGERED");
    });

    it("NOT_EQUALS with any UNKNOWN operand is UNKNOWN", () => {
      const rule: PlaybookRule = {
        id: "r-ne-unk",
        effect: "BLOCK",
        conditions: [cond("DIRECTIONAL_MOMENTUM", "NOT_EQUALS", "UNKNOWN")],
      };
      const unk = evaluateRule(rule, unkCtx());
      if (unk.ok !== true) throw new Error("unk failed");
      expect(unk.evaluation.outcome).toBe("UNKNOWN");
      expect(unk.evaluation.appliedEffect).toBeNull();
      const knownCtx = makeEvaluationContext();
      const knownVsUnkExpected = evaluateRule(rule, knownCtx);
      if (knownVsUnkExpected.ok !== true) throw new Error("known failed");
      expect(knownVsUnkExpected.evaluation.outcome).toBe("UNKNOWN");
    });

    it("malformed operator/value and non-finite numbers reject", () => {
      const badOp = evaluateRule(
        {
          id: "r",
          effect: "BLOCK",
          conditions: [cond("coverage", "CONTAINS", 0.5)],
        } as unknown as PlaybookRule,
        makeEvaluationContext(),
      );
      expect(badOp.ok).toBe(false);
      const badVal = evaluateRule(
        {
          id: "r",
          effect: "BLOCK",
          conditions: [cond("coverage", "GTE", Number.NaN)],
        } as unknown as PlaybookRule,
        makeEvaluationContext(),
      );
      expect(badVal.ok).toBe(false);
      const badRule = evaluateRule(
        { nonsense: true } as unknown as PlaybookRule,
        makeEvaluationContext(),
      );
      expect(badRule.ok).toBe(false);
    });

    it("required unknown inputs produce UNKNOWN; no string->number coercion", () => {
      const rule: PlaybookRule = {
        id: "r-cov",
        effect: "BLOCK",
        conditions: [cond("coverage", "GTE", 0.8)],
      };
      const ctx: EvaluationContext = makeEvaluationContext({ coverage: null });
      const res = evaluateRule(rule, ctx);
      if (res.ok !== true) throw new Error("res failed");
      expect(res.evaluation.outcome).toBe("UNKNOWN");
      expect(res.evaluation.appliedEffect).toBeNull();
      const coerced = evaluateRule(
        rule,
        {
          ...makeEvaluationContext(),
          coverage: "0.9",
        } as unknown as EvaluationContext,
      );
      expect(coerced.ok).toBe(false);
    });
  });

  describe("unknown aggregation safety (M2.1)", () => {
    function versionWith(rules: PlaybookRule[]): PlaybookVersion {
      const s = seedV1(rules);
      return s.version;
    }

    // Rule helpers for aggregation testing:
    // Rule triggering on decision === "LONG" (default context has decision: "LONG")
    const triggerCautionRule: PlaybookRule = {
      id: "r-trig-caution",
      effect: "CAUTION",
      conditions: [cond("decision", "EQUALS", "LONG")],
    };
    const triggerPassRule: PlaybookRule = {
      id: "r-trig-pass",
      effect: "PASS",
      conditions: [cond("decision", "EQUALS", "LONG")],
    };
    const triggerWaitRule: PlaybookRule = {
      id: "r-trig-wait",
      effect: "WAIT",
      conditions: [cond("decision", "EQUALS", "LONG")],
    };
    const triggerBlockRule: PlaybookRule = {
      id: "r-trig-block",
      effect: "BLOCK",
      conditions: [cond("decision", "EQUALS", "LONG")],
    };

    // Rule evaluating to UNKNOWN on coverage === null
    const unknownBlockRule: PlaybookRule = {
      id: "r-unk-block",
      effect: "BLOCK",
      conditions: [cond("coverage", "GTE", 0.8)],
    };
    const unknownWaitRule: PlaybookRule = {
      id: "r-unk-wait",
      effect: "WAIT",
      conditions: [cond("coverage", "GTE", 0.8)],
    };
    const unknownCautionRule: PlaybookRule = {
      id: "r-unk-caution",
      effect: "CAUTION",
      conditions: [cond("coverage", "GTE", 0.8)],
    };
    const unknownPassRule: PlaybookRule = {
      id: "r-unk-pass",
      effect: "PASS",
      conditions: [cond("coverage", "GTE", 0.8)],
    };

    const nullCoverageCtx = makeEvaluationContext({ coverage: null });

    // 1. triggered CAUTION + unknown BLOCK => WAIT
    it("1. triggered CAUTION + unknown BLOCK => WAIT", () => {
      const version = versionWith([triggerCautionRule, unknownBlockRule]);
      const res = evaluateVersion(version, nullCoverageCtx);
      if (res.ok !== true) throw new Error("eval failed");
      expect(res.evaluation.aggregateEffect).toBe("WAIT");
    });

    // 2. triggered CAUTION + unknown WAIT => WAIT
    it("2. triggered CAUTION + unknown WAIT => WAIT", () => {
      const version = versionWith([triggerCautionRule, unknownWaitRule]);
      const res = evaluateVersion(version, nullCoverageCtx);
      if (res.ok !== true) throw new Error("eval failed");
      expect(res.evaluation.aggregateEffect).toBe("WAIT");
    });

    // 3. triggered PASS + unknown BLOCK => WAIT
    it("3. triggered PASS + unknown BLOCK => WAIT", () => {
      const version = versionWith([triggerPassRule, unknownBlockRule]);
      const res = evaluateVersion(version, nullCoverageCtx);
      if (res.ok !== true) throw new Error("eval failed");
      expect(res.evaluation.aggregateEffect).toBe("WAIT");
    });

    // 4. triggered WAIT + unknown BLOCK => WAIT
    it("4. triggered WAIT + unknown BLOCK => WAIT", () => {
      const version = versionWith([triggerWaitRule, unknownBlockRule]);
      const res = evaluateVersion(version, nullCoverageCtx);
      if (res.ok !== true) throw new Error("eval failed");
      expect(res.evaluation.aggregateEffect).toBe("WAIT");
    });

    // 5. triggered BLOCK + any UNKNOWN => BLOCK
    it("5. triggered BLOCK + any UNKNOWN => BLOCK", () => {
      const versionBlockAndUnkBlock = versionWith([
        triggerBlockRule,
        unknownBlockRule,
      ]);
      const res1 = evaluateVersion(versionBlockAndUnkBlock, nullCoverageCtx);
      if (res1.ok !== true) throw new Error("eval failed");
      expect(res1.evaluation.aggregateEffect).toBe("BLOCK");

      const versionBlockAndUnkWait = versionWith([
        triggerBlockRule,
        unknownWaitRule,
      ]);
      const res2 = evaluateVersion(versionBlockAndUnkWait, nullCoverageCtx);
      if (res2.ok !== true) throw new Error("eval failed");
      expect(res2.evaluation.aggregateEffect).toBe("BLOCK");

      const versionBlockAndUnkCaution = versionWith([
        triggerBlockRule,
        unknownCautionRule,
      ]);
      const res3 = evaluateVersion(versionBlockAndUnkCaution, nullCoverageCtx);
      if (res3.ok !== true) throw new Error("eval failed");
      expect(res3.evaluation.aggregateEffect).toBe("BLOCK");

      const versionBlockAndUnkPass = versionWith([
        triggerBlockRule,
        unknownPassRule,
      ]);
      const res4 = evaluateVersion(versionBlockAndUnkPass, nullCoverageCtx);
      if (res4.ok !== true) throw new Error("eval failed");
      expect(res4.evaluation.aggregateEffect).toBe("BLOCK");
    });

    // 6. triggered PASS + unknown CAUTION => CAUTION
    it("6. triggered PASS + unknown CAUTION => CAUTION", () => {
      const version = versionWith([triggerPassRule, unknownCautionRule]);
      const res = evaluateVersion(version, nullCoverageCtx);
      if (res.ok !== true) throw new Error("eval failed");
      expect(res.evaluation.aggregateEffect).toBe("CAUTION");
    });

    // 7. unknown PASS alone does not create an unnecessary restriction
    it("7. unknown PASS alone does not create an unnecessary restriction", () => {
      const version = versionWith([unknownPassRule]);
      const res = evaluateVersion(version, nullCoverageCtx);
      if (res.ok !== true) throw new Error("eval failed");
      expect(res.evaluation.aggregateEffect).toBe("PASS");
    });

    // 8. rule input order cannot alter aggregate result
    it("8. rule input order cannot alter aggregate result", () => {
      const rA = triggerCautionRule;
      const rB = unknownBlockRule;
      const rC = unknownCautionRule;

      const vABC = versionWith([rA, rB, rC]);
      const vCBA = versionWith([rC, rB, rA]);
      const vBAC = versionWith([rB, rA, rC]);

      const resABC = evaluateVersion(vABC, nullCoverageCtx);
      const resCBA = evaluateVersion(vCBA, nullCoverageCtx);
      const resBAC = evaluateVersion(vBAC, nullCoverageCtx);

      if (resABC.ok !== true || resCBA.ok !== true || resBAC.ok !== true) {
        throw new Error("eval failed");
      }
      expect(resABC.evaluation.aggregateEffect).toBe("WAIT");
      expect(resCBA.evaluation.aggregateEffect).toBe("WAIT");
      expect(resBAC.evaluation.aggregateEffect).toBe("WAIT");
      expect(resABC.evaluation.aggregateEffect).toBe(
        resCBA.evaluation.aggregateEffect,
      );
      expect(resABC.evaluation.aggregateEffect).toBe(
        resBAC.evaluation.aggregateEffect,
      );
    });

    // 9. diagnostics preserve UNKNOWN status
    it("9. diagnostics preserve UNKNOWN status", () => {
      const version = versionWith([triggerCautionRule, unknownBlockRule]);
      const res = evaluateVersion(version, nullCoverageCtx);
      if (res.ok !== true) throw new Error("eval failed");

      const trigEval = res.evaluation.ruleEvaluations.find(
        (r) => r.rule.id === triggerCautionRule.id,
      );
      const unkEval = res.evaluation.ruleEvaluations.find(
        (r) => r.rule.id === unknownBlockRule.id,
      );

      expect(trigEval?.outcome).toBe("TRIGGERED");
      expect(trigEval?.appliedEffect).toBe("CAUTION");

      expect(unkEval?.outcome).toBe("UNKNOWN");
      expect(unkEval?.appliedEffect).toBeNull();
      expect(
        unkEval?.conditionEvaluations.some(
          (c) => c.result === "UNKNOWN",
        ),
      ).toBe(true);
    });

    // 10. existing UNKNOWN-vs-NEUTRAL behavior remains unchanged
    it("10. existing UNKNOWN-vs-NEUTRAL behavior remains unchanged", () => {
      const ruleUnk: PlaybookRule = {
        id: "r-expect-unk",
        effect: "WAIT",
        conditions: [cond("DIRECTIONAL_MOMENTUM", "EQUALS", "UNKNOWN")],
      };
      const ruleNeu: PlaybookRule = {
        id: "r-expect-neu",
        effect: "WAIT",
        conditions: [cond("DIRECTIONAL_MOMENTUM", "EQUALS", "NEUTRAL")],
      };

      const ctxUnk = makeEvaluationContext({
        evidence: {
          DIRECTIONAL_MOMENTUM: "UNKNOWN",
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });

      const ctxNeu = makeEvaluationContext({
        evidence: {
          DIRECTIONAL_MOMENTUM: "NEUTRAL",
          TECHNICAL_CONFLUENCE: "SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        },
      });

      // Actual UNKNOWN against expected UNKNOWN matches
      const ev1 = evaluateRule(ruleUnk, ctxUnk);
      if (ev1.ok !== true) throw new Error("ev1");
      expect(ev1.evaluation.outcome).toBe("TRIGGERED");

      // Actual UNKNOWN against expected NEUTRAL is UNKNOWN
      const ev2 = evaluateRule(ruleNeu, ctxUnk);
      if (ev2.ok !== true) throw new Error("ev2");
      expect(ev2.evaluation.outcome).toBe("UNKNOWN");

      // Actual NEUTRAL against expected UNKNOWN is NOT_TRIGGERED
      const ev3 = evaluateRule(ruleUnk, ctxNeu);
      if (ev3.ok !== true) throw new Error("ev3");
      expect(ev3.evaluation.outcome).toBe("NOT_TRIGGERED");

      // Actual NEUTRAL against expected NEUTRAL is TRIGGERED
      const ev4 = evaluateRule(ruleNeu, ctxNeu);
      if (ev4.ok !== true) throw new Error("ev4");
      expect(ev4.evaluation.outcome).toBe("TRIGGERED");
    });
  });

  describe("memory/policy separation", () => {
    function versionWith(rules: PlaybookRule[]): PlaybookVersion {
      const s = seedV1(rules);
      return s.version;
    }

    it("only explicit memory context counts; missing memory => WAIT not BLOCK", () => {
      const version = versionWith([
        {
          id: "m-block",
          effect: "BLOCK",
          conditions: [cond("memory.highSimilarityCaseCount", "GTE", 3)],
        } as unknown as PlaybookRule,
      ]);
      const withoutMemory = evaluateVersion(version, makeEvaluationContext());
      if (withoutMemory.ok !== true) throw new Error("eval1");
      expect(withoutMemory.evaluation.aggregateEffect).toBe("WAIT");
      const withMemory = evaluateVersion(
        version,
        makeEvaluationContext({ memory: { highSimilarityCaseCount: 5 } }),
      );
      if (withMemory.ok !== true) throw new Error("eval2");
      expect(withMemory.evaluation.aggregateEffect).toBe("BLOCK");
    });

    it("memory-derived proposal has no effect until approval", () => {
      const seed = seedV1([makePassRule()]);
      const prop = createProposal(
        proposalInput(seed, {
          proposalId: "p-mem",
          createdBy: "MODEL",
          rules: [
            {
              id: "m-block",
              effect: "BLOCK",
              conditions: [cond("memory.highSimilarityCaseCount", "GTE", 1)],
            } as unknown as PlaybookRule,
          ],
        }),
      );
      expect(prop.ok).toBe(true);
      const before = evaluateVersion(
        seed.version,
        makeEvaluationContext({ memory: { highSimilarityCaseCount: 9 } }),
      );
      if (before.ok !== true) throw new Error("before failed");
      expect(before.evaluation.aggregateEffect).toBe("PASS");
    });
  });
});
