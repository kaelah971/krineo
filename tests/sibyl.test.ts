import { describe, expect, it } from "vitest";
import {
  makeDecisionCase,
  makeCaseSignature,
} from "./fixtures/memory";
import {
  createMemorySnapshot,
  rankComparableCases,
} from "../lib/memory";
import {
  createInitialVersion,
  createProposal,
  approveProposal,
} from "../lib/playbook";
import {
  DefaultSibylMemoryBridge,
  InMemorySibylMockTransport,
  canonicalJsonStringify,
  containsSecret,
  toDecisionCaseEntity,
  toDecisionCommittedEvent,
  toMemorySnapshotEntity,
  toPlaybookVersionEntity,
  toProposalCreatedEvent,
  toProposalResolvedEvent,
  toSnapshotCreatedEvent,
  validateJsonValue,
  SIBYL_BODY_SCHEMA_VERSIONS,
  SIBYL_EVENT_KINDS,
  SIBYL_REQUIRED_TOOLS,
} from "../lib/sibyl";
import { StdioSibylMcpTransport } from "../lib/sibyl/stdio-transport";

describe("M3 Sibyl Memory Bridge V1", () => {
  describe("Krineo -> Sibyl Mappings", () => {
    it("maps DecisionCase deterministically with allowlisted body", () => {
      const caseItem = makeDecisionCase({
        id: "case-mapped-1",
        asset: "SOL",
        decision: "LONG",
        outcome: {
          status: "POSITIVE",
          realizedPnlUsd: 10_000, // Should be omitted from mirror!
          realizedPnlPercent: 50, // Should be omitted from mirror!
          closeReason: "manual close reason", // Should be omitted from mirror!
          resolvedAt: "2026-09-26T12:00:00.000Z",
          observationId: "obs-1",
        },
      });

      const entity = toDecisionCaseEntity(caseItem);

      expect(entity.category).toBe("decision_case");
      expect(entity.name).toBe("case-mapped-1");
      expect(entity.body.schemaVersion).toBe(SIBYL_BODY_SCHEMA_VERSIONS.DECISION_CASE);
      expect(entity.body.asset).toBe("SOL");
      expect(entity.body.decision).toBe("LONG");
      expect(Object.isFrozen(entity)).toBe(true);
      expect(Object.isFrozen(entity.body)).toBe(true);

      // Verify that PnL and free-form closeReason are quarantined/omitted from mirrored entity!
      const outcome = entity.body.outcome as Record<string, unknown> | undefined;
      expect(outcome?.status).toBe("POSITIVE");
      expect(outcome?.resolvedAt).toBe("2026-09-26T12:00:00.000Z");
      expect(outcome?.observationId).toBe("obs-1");
      expect(outcome?.realizedPnlUsd).toBeUndefined();
      expect(outcome?.realizedPnlPercent).toBeUndefined();
      expect(outcome?.closeReason).toBeUndefined();
    });

    it("maps MemorySnapshot deterministically with allowlisted body", () => {
      const targetSignature = makeCaseSignature();
      const c1 = makeDecisionCase({ id: "c-1" });
      const ranked = rankComparableCases(targetSignature, [c1]);
      const snapshot = createMemorySnapshot({
        snapshotId: "snap-m3-1",
        targetSignature,
        rankedCases: ranked,
        createdAt: "2026-09-26T10:00:00.000Z",
      });

      const entity = toMemorySnapshotEntity(snapshot);

      expect(entity.category).toBe("memory_snapshot");
      expect(entity.name).toBe("snap-m3-1");
      expect(entity.body.schemaVersion).toBe(SIBYL_BODY_SCHEMA_VERSIONS.MEMORY_SNAPSHOT);
      expect(entity.body.snapshotId).toBe("snap-m3-1");
      expect(Array.isArray(entity.body.rankedCases)).toBe(true);
      expect((entity.body.rankedCases as unknown[]).length).toBe(1);
      expect(Object.isFrozen(entity)).toBe(true);
    });

    it("maps PlaybookVersion deterministically with allowlisted body", () => {
      const initRes = createInitialVersion({
        playbookId: "pb-m3",
        strategyId: "dm-1",
        strategyVersion: "1.0.0",
        versionId: "v-1",
        rules: [
          {
            id: "r-1",
            effect: "BLOCK",
            conditions: [
              { field: "safety", operator: "EQUALS", value: "VETO" } as unknown as import("../lib/playbook/types").Condition,
            ],
          },
        ],
        createdAt: "2026-09-26T10:00:00.000Z",
        approvedAt: "2026-09-26T10:00:00.000Z",
        approvedBy: "HUMAN",
      });
      if (initRes.ok !== true) throw new Error("init failed");

      const entity = toPlaybookVersionEntity(initRes.version);

      expect(entity.category).toBe("playbook_version");
      expect(entity.name).toBe("pb-m3:v1");
      expect(entity.body.schemaVersion).toBe(SIBYL_BODY_SCHEMA_VERSIONS.PLAYBOOK_VERSION);
      expect(entity.body.playbookId).toBe("pb-m3");
      expect(entity.body.versionNumber).toBe(1);
      expect(entity.body.approvedBy).toBe("HUMAN");
      expect(Object.isFrozen(entity)).toBe(true);
    });

    it("maps journal events for decisions, snapshots, proposals", () => {
      const caseItem = makeDecisionCase({ id: "case-evt-1" });
      const decEvt = toDecisionCommittedEvent(caseItem);
      expect(decEvt.kind).toBe(SIBYL_EVENT_KINDS.DECISION_COMMITTED);
      expect(decEvt.category).toBe("decision_case");
      expect(decEvt.name).toBe("case-evt-1");

      const snapshot = createMemorySnapshot({
        snapshotId: "snap-evt-1",
        targetSignature: makeCaseSignature(),
        rankedCases: [],
        createdAt: "2026-09-26T10:00:00.000Z",
      });
      const snapEvt = toSnapshotCreatedEvent(snapshot);
      expect(snapEvt.kind).toBe(SIBYL_EVENT_KINDS.SNAPSHOT_CREATED);
      expect(snapEvt.category).toBe("memory_snapshot");

      const initRes = createInitialVersion({
        playbookId: "pb-evt",
        strategyId: "dm-1",
        strategyVersion: "1.0.0",
        versionId: "v-1",
        rules: [],
        createdAt: "2026-09-26T10:00:00.000Z",
        approvedAt: "2026-09-26T10:00:00.000Z",
        approvedBy: "HUMAN",
      });
      if (initRes.ok !== true) throw new Error("init failed");
      const propRes = createProposal({
        proposalId: "p-evt-1",
        playbookId: "pb-evt",
        proposedVersionId: "v-2",
        parentVersionId: "v-1",
        parentVersionNumber: 1,
        strategyId: "dm-1",
        strategyVersion: "1.0.0",
        rules: [],
        createdBy: "SYSTEM",
        createdAt: "2026-09-26T11:00:00.000Z",
      });
      if (propRes.ok !== true) throw new Error("proposal failed");

      const propCreatedEvt = toProposalCreatedEvent(propRes.proposal);
      expect(propCreatedEvt.kind).toBe(SIBYL_EVENT_KINDS.PROPOSAL_CREATED);
      expect(propCreatedEvt.name).toBe("p-evt-1");
      expect(propCreatedEvt.body.createdBy).toBe("SYSTEM");

      const apprRes = approveProposal({
        playbook: initRes.playbook,
        versions: [initRes.version],
        proposal: propRes.proposal,
        approvedAt: "2026-09-26T12:00:00.000Z",
        approvedBy: "HUMAN",
      });
      if (apprRes.ok !== true) throw new Error("approve failed");

      const propResolvedEvt = toProposalResolvedEvent(apprRes.proposal);
      expect(propResolvedEvt.kind).toBe(SIBYL_EVENT_KINDS.PROPOSAL_RESOLVED);
      expect(propResolvedEvt.body.status).toBe("APPROVED");
      expect(propResolvedEvt.body.resolvedBy).toBe("HUMAN");
    });
  });

  describe("Sanitization & Secret Guarding", () => {
    it("detects secret patterns and rejects sensitive payloads", () => {
      expect(containsSecret("standard market commentary")).toBe(false);
      expect(containsSecret("session_token=secret123")).toBe(true);
      expect(containsSecret("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
      expect(containsSecret("Bearer my-token-12345")).toBe(true);
      expect(containsSecret("api_key_live_xyz")).toBe(true);

      expect(() => {
        validateJsonValue({
          safe: "value",
          secret: "password123",
        });
      }).toThrow(/sensitive|secret/i);
    });

    it("canonicalJsonStringify sorts keys deterministically", () => {
      const obj1 = { b: 2, a: 1, c: { z: 26, y: 25 } };
      const obj2 = { a: 1, c: { y: 25, z: 26 }, b: 2 };
      expect(canonicalJsonStringify(obj1)).toBe(canonicalJsonStringify(obj2));
    });
  });

  describe("Bridge Operations with Mock Transport", () => {
    it("performs remember, recall, search, list, forget, state, event", async () => {
      const transport = new InMemorySibylMockTransport();
      const bridge = new DefaultSibylMemoryBridge(transport);

      // 1. Remember entity
      const rem = await bridge.rememberEntity({
        category: "notes",
        name: "note-1",
        body: { text: "momentum signal confirmed" },
      });
      expect(rem.status).toBe("SUCCESS");
      if (rem.status === "SUCCESS") {
        expect(rem.value.category).toBe("notes");
        expect(rem.value.name).toBe("note-1");
      }

      // 2. Recall entity
      const rec = await bridge.recallEntity({ category: "notes", name: "note-1" });
      expect(rec.status).toBe("SUCCESS");
      if (rec.status === "SUCCESS") {
        expect(rec.value.category).toBe("notes");
        expect(rec.value.name).toBe("note-1");
        expect((rec.value.body as { text: string }).text).toBe("momentum signal confirmed");
      }

      // 3. Search
      const searchRes = await bridge.search({ query: "momentum" });
      expect(searchRes.status).toBe("SUCCESS");
      if (searchRes.status === "SUCCESS") {
        expect(searchRes.value.count).toBe(1);
        expect(searchRes.value.results[0].name).toBe("note-1");
      }

      // 4. List
      const listRes = await bridge.list({ category: "notes" });
      expect(listRes.status).toBe("SUCCESS");
      if (listRes.status === "SUCCESS") {
        expect(listRes.value.count).toBe(1);
      }

      // 5. State
      const setSt = await bridge.setState({ key: "active_focus", body: { asset: "SOL" } });
      expect(setSt.status).toBe("SUCCESS");
      const getSt = await bridge.getState({ key: "active_focus" });
      expect(getSt.status).toBe("SUCCESS");
      if (getSt.status === "SUCCESS") {
        expect((getSt.value.body as { asset: string }).asset).toBe("SOL");
      }

      // 6. Record Event
      const evtRes = await bridge.recordEvent({
        kind: "decision_committed",
        body: { caseId: "case-1", asset: "SOL" },
      });
      expect(evtRes.status).toBe("SUCCESS");

      // 7. Forget
      const forgetRes = await bridge.forget({ category: "notes", name: "note-1" });
      expect(forgetRes.status).toBe("SUCCESS");

      // Recalling archived entity yields NOT_FOUND
      const recAfterForget = await bridge.recallEntity({ category: "notes", name: "note-1" });
      expect(recAfterForget.status).toBe("NOT_FOUND");
    });
  it("coalesces concurrent first operations behind one transport startup", async () => {
    const transport = new InMemorySibylMockTransport();
    const bridge = new DefaultSibylMemoryBridge(transport);

    const [first, second] = await Promise.all([
      bridge.rememberEntity({ category: "notes", name: "first", body: { value: 1 } }),
      bridge.rememberEntity({ category: "notes", name: "second", body: { value: 2 } }),
    ]);

    expect(first.status).toBe("SUCCESS");
    expect(second.status).toBe("SUCCESS");
    expect(transport.calls.filter((call) => call.name === "memory_remember")).toHaveLength(2);
  });

  });

  describe("Immutable Mirror Protocol & Conflict Safety", () => {
    it("first mirror write creates entity (outcome: CREATED)", async () => {
      const transport = new InMemorySibylMockTransport();
      const bridge = new DefaultSibylMemoryBridge(transport);

      const caseItem = makeDecisionCase({ id: "case-mirror-1", asset: "SOL" });
      const res = await bridge.mirrorDecisionCase(caseItem);

      expect(res.status).toBe("SUCCESS");
      if (res.status === "SUCCESS") {
        expect(res.value.outcome).toBe("CREATED");
        expect(res.value.entity.category).toBe("decision_case");
        expect(res.value.entity.name).toBe("case-mirror-1");
      }
    });

    it("identical second mirror write is idempotent (outcome: UNCHANGED)", async () => {
      const transport = new InMemorySibylMockTransport();
      const bridge = new DefaultSibylMemoryBridge(transport);

      const caseItem = makeDecisionCase({ id: "case-mirror-2", asset: "BTC" });
      const res1 = await bridge.mirrorDecisionCase(caseItem);
      expect(res1.status).toBe("SUCCESS");
      if (res1.status === "SUCCESS") expect(res1.value.outcome).toBe("CREATED");

      // Second write with identical content
      const res2 = await bridge.mirrorDecisionCase(caseItem);
      expect(res2.status).toBe("SUCCESS");
      if (res2.status === "SUCCESS") {
        expect(res2.value.outcome).toBe("UNCHANGED");
        expect(res2.value.entity.name).toBe("case-mirror-2");
      }
    });

    it("conflicting second mirror write returns CONFLICT and does NOT overwrite", async () => {
      const transport = new InMemorySibylMockTransport();
      const bridge = new DefaultSibylMemoryBridge(transport);

      const caseItemOriginal = makeDecisionCase({ id: "case-mirror-conflict", asset: "ETH" });
      const res1 = await bridge.mirrorDecisionCase(caseItemOriginal);
      expect(res1.status).toBe("SUCCESS");

      const callsBefore = transport.calls.length;

      // Conflicting write: same ID, different asset/content!
      const caseItemMutated = makeDecisionCase({ id: "case-mirror-conflict", asset: "AVAX" });
      const res2 = await bridge.mirrorDecisionCase(caseItemMutated);

      expect(res2.status).toBe("CONFLICT");
      if (res2.status === "CONFLICT") {
        expect(res2.entity.category).toBe("decision_case");
        expect(res2.entity.name).toBe("case-mirror-conflict");
        expect(res2.diagnostic.code).toBe("CONFLICT");
      }

      // Verify that memory_remember was NOT called during the conflicting second write!
      const callsAfter = transport.calls.slice(callsBefore);
      const rememberCalls = callsAfter.filter((c) => c.name === "memory_remember");
      expect(rememberCalls).toHaveLength(0);

      // Verify original entity in Sibyl was NOT overwritten!
      const recallOriginal = await bridge.recallEntity({ category: "decision_case", name: "case-mirror-conflict" });
      expect(recallOriginal.status).toBe("SUCCESS");
      if (recallOriginal.status === "SUCCESS") {
        expect((recallOriginal.value.body as { asset: string }).asset).toBe("ETH");
      }
    });
  });

  describe("Error Classifications & Degraded Mode", () => {
    it("distinguishes NOT_FOUND from provider failure", async () => {
      const transport = new InMemorySibylMockTransport();
      const bridge = new DefaultSibylMemoryBridge(transport);

      const res = await bridge.recallEntity({ category: "unknown_cat", name: "non_existent" });
      expect(res.status).toBe("NOT_FOUND");
    });

    it("handles CAP_EXCEEDED explicitly", async () => {
      const transport = new InMemorySibylMockTransport({
        requestFailure: { memory_remember: "CAP_EXCEEDED" },
      });
      const bridge = new DefaultSibylMemoryBridge(transport);

      const res = await bridge.rememberEntity({ category: "c", name: "n", body: { a: 1 } });
      expect(res.status).toBe("CAP_EXCEEDED");
      if (res.status === "CAP_EXCEEDED") {
        expect(res.diagnostic.code).toBe("CAP_EXCEEDED");
      }
    });

    it("handles TIMEOUT explicitly", async () => {
      const transport = new InMemorySibylMockTransport({
        requestFailure: { memory_search: "TIMEOUT" },
      });
      const bridge = new DefaultSibylMemoryBridge(transport);

      const res = await bridge.search({ query: "test" });
      expect(res.status).toBe("TIMEOUT");
      if (res.status === "TIMEOUT") {
        expect(res.diagnostic.code).toBe("TIMEOUT");
      }
    });

    it("handles malformed provider response as INVALID_RESPONSE", async () => {
      const transport = new InMemorySibylMockTransport({
        handlers: {
          memory_search: () => ({ invalid: "shape", results: "not-an-array" }),
        },
      });
      const bridge = new DefaultSibylMemoryBridge(transport);

      const res = await bridge.search({ query: "test" });
      expect(res.status).toBe("INVALID_RESPONSE");
    });

    it("missing required MCP tool in handshake yields HANDSHAKE_FAILED / UNAVAILABLE", async () => {
      const incompleteTools = SIBYL_REQUIRED_TOOLS.slice(1).map((name) => ({ name })); // Missing memory_remember!
      const transport = new InMemorySibylMockTransport({
        tools: incompleteTools,
      });
      const bridge = new DefaultSibylMemoryBridge(transport);

      const res = await bridge.rememberEntity({ category: "c", name: "n", body: {} });
      expect(res.status).toBe("UNAVAILABLE");
      const status = bridge.getStatus();
      expect(status.available).toBe(false);
      expect(status.phase).toBe("DEGRADED");
    });

    it("transport startup failure marks bridge DEGRADED", async () => {
      const transport = new InMemorySibylMockTransport({
        startupFailure: "PROCESS_START_FAILED",
      });
      const bridge = new DefaultSibylMemoryBridge(transport);

      const res = await bridge.recallEntity({ category: "c", name: "n" });
      expect(res.status).toBe("UNAVAILABLE");
      expect(bridge.getStatus().phase).toBe("DEGRADED");
    });
  });

  describe("Authority & Separation Boundaries", () => {
    it("Sibyl search is textual recall and never modifies DM-1 or Playbook", async () => {
      const transport = new InMemorySibylMockTransport();
      const bridge = new DefaultSibylMemoryBridge(transport);

      await bridge.rememberEntity({
        category: "research_notes",
        name: "bullish_note",
        body: { text: "Huge breakout momentum" },
      });

      const searchResult = await bridge.search({ query: "breakout" });
      expect(searchResult.status).toBe("SUCCESS");

      // Verify searchResult is a text recall envelope; it has no CaseSimilarityV1 metrics
      if (searchResult.status === "SUCCESS") {
        expect(searchResult.value.query).toBe("breakout");
        expect(searchResult.value.count).toBe(1);
        const hit = searchResult.value.results[0];
        expect((hit as unknown as { overallSimilarity?: unknown }).overallSimilarity).toBeUndefined();
      }
    });

    it("StdioSibylMcpTransport forbids shell execution", () => {
      expect(() => {
        new StdioSibylMcpTransport({ shell: true as unknown as false });
      }).toThrow(/shell execution is forbidden/i);
    });
  });
});
