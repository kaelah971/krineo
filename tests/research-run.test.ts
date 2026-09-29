import { describe, expect, it, vi } from "vitest";
import { createDemoPlaybook } from "../lib/demo/governance";
import {
  createDeterministicResearchFixtureProvider,
  createLiveRYOResearchProvider,
  createSanitizedRYOReplayProvider,
  runResearch,
  type ResearchProvider,
} from "../lib/research";
import type {
  ResearchCandidateDiscovery,
  ResearchCandidateEvidence,
  ResearchEvidenceSnapshot,
  ResearchMarketContext,
  ResearchProviderPreparation,
  ResearchProviderProvenance,
  ResearchProviderStatus,
} from "../lib/research";
import { createInitialVersion, PLAYBOOK_ACTORS, type PlaybookVersion } from "../lib/playbook";
import type { RYODiscovery, RYOCallResult } from "../lib/ryo";
import { RYO_PROVIDER_STATUSES } from "../lib/ryo";
import type { DirectionalEvidenceDimension, DirectionalEvidenceState } from "../lib/evidence/types";
import { POST as runResearchRoute } from "../app/api/research/run/route";

const DIMENSIONS: readonly DirectionalEvidenceDimension[] = [
  "DIRECTIONAL_MOMENTUM",
  "TECHNICAL_CONFLUENCE",
  "RELATIVE_OPPORTUNITY",
  "MARKET_ALIGNMENT",
  "SENTIMENT_DERIVATIVES",
];

const STARTED_AT = "2026-09-28T14:00:00.000Z";

function snapshot(
  asset: string,
  states: Partial<Record<DirectionalEvidenceDimension, DirectionalEvidenceState>> = {},
  policy: Partial<Pick<ResearchEvidenceSnapshot["dm1"], "risk" | "safety" | "regimeFit">> = {},
): ResearchEvidenceSnapshot {
  const evidence = Object.fromEntries(
    DIMENSIONS.map((dimension) => [
      dimension,
      states[dimension] ?? "STRONGLY_SUPPORTIVE",
    ]),
  ) as ResearchEvidenceSnapshot["dm1"]["evidence"];
  const dm1 = {
    evidence,
    risk: policy.risk ?? "ACCEPTABLE",
    safety: policy.safety ?? "CLEAR",
    regimeFit: policy.regimeFit ?? "FIT",
  } as ResearchEvidenceSnapshot["dm1"];
  const provenance: ResearchProviderProvenance = {
    provider: "TEST_PROVIDER",
    source: "TEST_RESEARCH_FIXTURE",
    tool: "test-research",
    asOf: STARTED_AT,
  };
  return {
    asset,
    dm1,
    evidenceItems: DIMENSIONS.map((dimension) => ({
      id: `${asset.toLowerCase()}-${dimension.toLowerCase()}`,
      dimension,
      state: evidence[dimension] ?? "UNKNOWN",
      source: "test-research",
      observedAt: STARTED_AT,
      reasonCode: "INSUFFICIENT_DIRECTIONAL_EVIDENCE",
      explanation: "Structured test evidence.",
    })),
    provenance,
    providerStatus: RYO_PROVIDER_STATUSES.SUCCESS,
    normalizationNotes: { source: "test" },
  };
}

function providerWith(
  assets: readonly string[],
  evidenceByAsset: Readonly<Record<string, ResearchEvidenceSnapshot>>,
  options: {
    readonly discoveryStatus?: ResearchProviderStatus;
    readonly preparation?: Partial<ResearchProviderPreparation>;
    readonly researchFailures?: Readonly<Record<string, boolean>>;
  } = {},
): ResearchProvider & { researched: string[]; requestedLimit: number | null } {
  const researched: string[] = [];
  let requestedLimit: number | null = null;
  const identity = {
    id: "TEST_PROVIDER",
    mode: "REPLAY" as const,
    source: "TEST_RESEARCH_FIXTURE",
  };
  return {
    identity,
    researched,
    get requestedLimit() {
      return requestedLimit;
    },
    async prepare() {
      return {
        ok: true,
        status: RYO_PROVIDER_STATUSES.SUCCESS,
        warnings: [],
        failures: [],
        ...options.preparation,
      };
    },
    async marketContext(): Promise<ResearchMarketContext> {
      return {
        status: RYO_PROVIDER_STATUSES.SUCCESS,
        provenance: {
          provider: "TEST_PROVIDER",
          source: "TEST_RESEARCH_FIXTURE",
          tool: "market_overview",
          asOf: STARTED_AT,
        },
        asOf: STARTED_AT,
        regime: "fit",
        warnings: [],
      };
    },
    async discoverCandidates(limit: number): Promise<ResearchCandidateDiscovery> {
      requestedLimit = limit;
      return {
        status: options.discoveryStatus ?? RYO_PROVIDER_STATUSES.SUCCESS,
        provenance: {
          provider: "TEST_PROVIDER",
          source: "TEST_RESEARCH_FIXTURE",
          tool: "scan_market",
          asOf: STARTED_AT,
        },
        candidates: assets.map((asset, index) => ({ asset, providerRank: index + 1 })),
        warnings: [],
        failures: options.discoveryStatus === RYO_PROVIDER_STATUSES.UNAVAILABLE
          ? [{
              code: "TEST_SCAN_UNAVAILABLE",
              message: "The test provider scan is unavailable.",
              source: "scan_market",
              status: RYO_PROVIDER_STATUSES.UNAVAILABLE,
            }]
          : [],
      };
    },
    async researchCandidate(asset: string): Promise<ResearchCandidateEvidence> {
      researched.push(asset);
      const evidence = evidenceByAsset[asset] ?? snapshot(asset, {
        DIRECTIONAL_MOMENTUM: "UNKNOWN",
        TECHNICAL_CONFLUENCE: "UNKNOWN",
        RELATIVE_OPPORTUNITY: "UNKNOWN",
        MARKET_ALIGNMENT: "UNKNOWN",
        SENTIMENT_DERIVATIVES: "UNKNOWN",
      }, { risk: "UNKNOWN", safety: "UNKNOWN", regimeFit: "UNKNOWN" });
      const failed = options.researchFailures?.[asset] === true;
      return {
        asset,
        snapshot: failed
          ? { ...evidence, providerStatus: RYO_PROVIDER_STATUSES.UNAVAILABLE }
          : evidence,
        warnings: [],
        failures: failed
          ? [{
              code: "TEST_RESEARCH_UNAVAILABLE",
              message: "The test provider candidate research is unavailable.",
              source: `candidate:${asset}`,
              status: RYO_PROVIDER_STATUSES.UNAVAILABLE,
            }]
          : [],
      };
    },
  };
}

function playbookWithEffect(effect: "WAIT" | "BLOCK"): PlaybookVersion {
  const result = createInitialVersion({
    playbookId: `test-playbook-${effect.toLowerCase()}`,
    versionId: `test-playbook-${effect.toLowerCase()}-v1`,
    strategyId: "dm-1",
    strategyVersion: "1.0.0",
    rules: [
      {
        id: `test-${effect.toLowerCase()}-long`,
        effect,
        conditions: [{ field: "decision", operator: "EQUALS", value: "LONG" }],
      },
    ],
    createdAt: STARTED_AT,
    approvedAt: STARTED_AT,
    approvedBy: PLAYBOOK_ACTORS.HUMAN,
  });
  if (!result.ok) throw new Error(result.message);
  return result.version;
}

function demoPlaybook(): PlaybookVersion {
  return createDemoPlaybook().version;
}

async function runWith(
  provider: ResearchProvider,
  options: Partial<Parameters<typeof runResearch>[0]> = {},
) {
  return runResearch({
    provider,
    playbookVersion: demoPlaybook(),
    runId: "test-research-run",
    startedAt: STARTED_AT,
    ...options,
  });
}

describe("Track 1 autonomous research run v1", () => {
  it("uses the same orchestration path for deterministic replay and preserves truthful provenance", async () => {
    const result = await runResearch({
      provider: createDeterministicResearchFixtureProvider("directional"),
      playbookVersion: createDemoPlaybook().version,
      memorySnapshot: null,
      runId: "replay-directional",
      startedAt: STARTED_AT,
    });

    expect(result.mode).toBe("REPLAY");
    expect(result.provider.source).toBe("DETERMINISTIC_RESEARCH_FIXTURE");
    expect(result.candidates[0]?.evidence.provenance.source).toBe(
      "DETERMINISTIC_RESEARCH_FIXTURE",
    );
    expect(result.candidates[0]?.dm1.decision).toBe("LONG");
    expect(result.status).toBe("PROPOSED");
    expect(result.commit).toBeNull();
  });

  it("bounds candidate research at three and delegates final ranking to the existing selector", async () => {
    const provider = providerWith(
      ["ALPHA", "BETA", "GAMMA", "DELTA"],
      {
        ALPHA: snapshot("ALPHA"),
        BETA: snapshot("BETA", {
          DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
          TECHNICAL_CONFLUENCE: "STRONGLY_SUPPORTIVE",
          RELATIVE_OPPORTUNITY: "STRONGLY_SUPPORTIVE",
          MARKET_ALIGNMENT: "SUPPORTIVE",
          SENTIMENT_DERIVATIVES: "SUPPORTIVE",
        }),
        GAMMA: snapshot("GAMMA", {
          DIRECTIONAL_MOMENTUM: "NEUTRAL",
          TECHNICAL_CONFLUENCE: "NEUTRAL",
          RELATIVE_OPPORTUNITY: "NEUTRAL",
          MARKET_ALIGNMENT: "NEUTRAL",
          SENTIMENT_DERIVATIVES: "NEUTRAL",
        }),
        DELTA: snapshot("DELTA"),
      },
    );

    const result = await runWith(provider);

    expect(provider.requestedLimit).toBe(3);
    expect(provider.researched).toEqual(["ALPHA", "BETA", "GAMMA"]);
    expect(result.candidateAssetsConsidered).toEqual(["ALPHA", "BETA", "GAMMA"]);
    expect(result.selection.selected?.asset).toBe("ALPHA");
    expect(result.selection.rankedCandidates.map((candidate) => candidate.asset)).toEqual([
      "ALPHA",
      "BETA",
    ]);
    expect(result.reasonCodes).toContain("CANDIDATE_LIMIT_REACHED");
  });

  it("makes ranking independent of provider input order", async () => {
    const evidence = {
      ALPHA: snapshot("ALPHA"),
      BETA: snapshot("BETA", {
        DIRECTIONAL_MOMENTUM: "STRONGLY_SUPPORTIVE",
        TECHNICAL_CONFLUENCE: "STRONGLY_SUPPORTIVE",
        RELATIVE_OPPORTUNITY: "STRONGLY_SUPPORTIVE",
        MARKET_ALIGNMENT: "SUPPORTIVE",
        SENTIMENT_DERIVATIVES: "SUPPORTIVE",
      }),
      GAMMA: snapshot("GAMMA", {
        DIRECTIONAL_MOMENTUM: "NEUTRAL",
        TECHNICAL_CONFLUENCE: "NEUTRAL",
        RELATIVE_OPPORTUNITY: "NEUTRAL",
        MARKET_ALIGNMENT: "NEUTRAL",
        SENTIMENT_DERIVATIVES: "NEUTRAL",
      }),
    };
    const first = await runWith(providerWith(["ALPHA", "BETA", "GAMMA"], evidence));
    const second = await runWith(providerWith(["GAMMA", "ALPHA", "BETA"], evidence));

    expect(second.selection.selected?.asset).toBe(first.selection.selected?.asset);
    expect(second.selection.rankedCandidates.map((candidate) => candidate.asset)).toEqual(
      first.selection.rankedCandidates.map((candidate) => candidate.asset),
    );
  });

  it("abstains when there is no clear winner or insufficient evidence", async () => {
    const tied = await runWith(
      providerWith(["ALPHA", "BETA"], {
        ALPHA: snapshot("ALPHA"),
        BETA: snapshot("BETA"),
      }),
    );
    const insufficient = await runWith(
      providerWith(["UNKNOWN"], {
        UNKNOWN: snapshot("UNKNOWN", {
          DIRECTIONAL_MOMENTUM: "UNKNOWN",
          TECHNICAL_CONFLUENCE: "UNKNOWN",
          RELATIVE_OPPORTUNITY: "UNKNOWN",
          MARKET_ALIGNMENT: "UNKNOWN",
          SENTIMENT_DERIVATIVES: "UNKNOWN",
        }, { risk: "UNKNOWN", safety: "UNKNOWN", regimeFit: "UNKNOWN" }),
      }),
    );

    expect(tied.status).toBe("ABSTAINED");
    expect(tied.finalDecision).toBe("ABSTAIN");
    expect(tied.reasonCodes).toContain("NO_CLEAR_RELATIVE_WINNER");
    expect(insufficient.status).toBe("ABSTAINED");
    expect(insufficient.reasonCodes).toContain("INSUFFICIENT_EVIDENCE");
    expect(insufficient.commit).toBeNull();
  });

  it("returns an explicit degraded outcome when discovery or scan is unavailable", async () => {
    const unavailable = await runWith(
      providerWith([], {}, {
        preparation: {
          ok: false,
          status: RYO_PROVIDER_STATUSES.UNAVAILABLE,
          failures: [{
            code: "TEST_DISCOVERY_UNAVAILABLE",
            message: "The test provider is unavailable.",
            source: "prepare",
            status: RYO_PROVIDER_STATUSES.UNAVAILABLE,
          }],
        },
      }),
    );
    const scanUnavailable = await runWith(
      providerWith(["SOL"], { SOL: snapshot("SOL") }, {
        discoveryStatus: RYO_PROVIDER_STATUSES.UNAVAILABLE,
      }),
    );

    expect(unavailable.status).toBe("DEGRADED");
    expect(unavailable.finalDecision).toBe("ABSTAIN");
    expect(unavailable.candidateAssetsConsidered).toEqual([]);
    expect(scanUnavailable.status).toBe("DEGRADED");
    expect(scanUnavailable.candidates).toEqual([]);
    expect(scanUnavailable.reasonCodes).toContain("CANDIDATE_SCAN_UNAVAILABLE");
  });

  it.each(["WAIT", "BLOCK"] as const)(
    "preflight %s prevents simulated practice commitment",
    async (effect) => {
      const result = await runWith(
        providerWith(["SOL"], { SOL: snapshot("SOL") }),
        {
          playbookVersion: playbookWithEffect(effect),
          autoCommitPractice: true,
          practiceEntryPrice: 100,
        },
      );

      expect(result.status).toBe("ABSTAINED");
      expect(result.preflight?.status).toBe(effect);
      expect(result.finalDecision).toBe("ABSTAIN");
      expect(result.commit).toBeNull();
      expect(result.practice).toBeNull();
    },
  );

  it("keeps KillSwitch authoritative when a strong contradiction vetoes the candidate", async () => {
    const result = await runWith(
      providerWith(["SOL"], {
        SOL: snapshot("SOL", {
          SENTIMENT_DERIVATIVES: "STRONGLY_OPPOSING",
        }),
      }, { researchFailures: {} }),
      { autoCommitPractice: true, practiceEntryPrice: 100 },
    );

    expect(result.marketDecision).toBe("LONG");
    expect(result.killSwitch?.verdict).toBe("VETO");
    expect(result.finalDecision).toBe("ABSTAIN");
    expect(result.commit).toBeNull();
    expect(result.practice).toBeNull();
  });

  it("defaults to proposal-only behavior and optionally commits through thesis, receipt, and practice domains", async () => {
    const proposed = await runWith(
      providerWith(["SOL"], { SOL: snapshot("SOL") }),
    );
    const committed = await runWith(
      providerWith(["SOL"], { SOL: snapshot("SOL") }),
      {
        autoCommitPractice: true,
        practiceEntryPrice: 100,
        practiceCurrentPrice: 105,
      },
    );

    expect(proposed.autoCommitPractice).toBe(false);
    expect(proposed.commit).toBeNull();
    expect(proposed.practice).toBeNull();
    expect(committed.status).toBe("COMMITTED");
    expect(committed.commit?.receipt.canonicalHash).toBeTruthy();
    expect(committed.commit?.practice.position.direction).toBe("LONG");
    expect(committed.commit?.practice.pnl?.currentPrice).toBe(105);
  });

  it("replays identical inputs to identical semantic output", async () => {
    const first = await runResearch({
      provider: createDeterministicResearchFixtureProvider("directional"),
      playbookVersion: createDemoPlaybook().version,
      runId: "repeatable-replay",
      startedAt: STARTED_AT,
    });
    const second = await runResearch({
      provider: createDeterministicResearchFixtureProvider("directional"),
      playbookVersion: createDemoPlaybook().version,
      runId: "repeatable-replay",
      startedAt: STARTED_AT,
    });

    expect(second).toEqual(first);
    expect(second.commit).toBeNull();
  });

  it("replays the captured RYO outage without fabricating candidates", async () => {
    const result = await runResearch({
      provider: createSanitizedRYOReplayProvider(),
      playbookVersion: createDemoPlaybook().version,
      runId: "sanitized-ryo-outage",
      startedAt: STARTED_AT,
    });

    expect(result.provider.source).toBe("REPLAY_FROM_SANITIZED_RYO_FIXTURE");
    expect(result.marketContext?.status).toBe("PARTIAL");
    expect(result.candidateDiscovery?.status).toBe("UNAVAILABLE");
    expect(result.candidateAssetsConsidered).toEqual([]);
    expect(result.status).toBe("DEGRADED");
    expect(result.finalDecision).toBe("ABSTAIN");
  });

  it("exposes a strict replay application entry point", async () => {
    const response = await runResearchRoute(
      new Request("http://localhost/api/research/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "REPLAY",
          replayFixtureId: "DETERMINISTIC_DIRECTIONAL",
          runId: "api-replay",
          startedAt: STARTED_AT,
        }),
      }),
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.mode).toBe("REPLAY");
    expect(result.provider.source).toBe("DETERMINISTIC_RESEARCH_FIXTURE");
    expect(result.autoCommitPractice).toBe(false);
  });

  it("rejects unsupported application-run fields before orchestration", async () => {
    const response = await runResearchRoute(
      new Request("http://localhost/api/research/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "REPLAY", filesystemPath: "./fixtures" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringContaining("unsupported field"),
    });
  });

  it("represents a degraded live RYO boundary honestly", async () => {
    const discovery: RYODiscovery = {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "ryo-chan", version: "1.0.0" },
      capabilities: {},
      tools: [
        {
          name: "market_overview",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "scan_market",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    };
    const client = {
      discover: vi.fn(async () => ({
        ok: true as const,
        status: RYO_PROVIDER_STATUSES.SUCCESS,
        discovery,
        provenance: {
          provider: "RYO" as const,
          tool: "tools/list",
          serverName: "ryo-chan",
          serverVersion: "1.0.0",
          protocolVersion: "2024-11-05",
        },
      })),
      callTool: vi.fn(async (name: string): Promise<RYOCallResult<unknown>> => {
        const provenance = {
          provider: "RYO" as const,
          tool: name,
          serverName: "ryo-chan",
          serverVersion: "1.0.0",
          protocolVersion: "2024-11-05",
        };
        if (name === "market_overview") {
          return {
            ok: true,
            status: RYO_PROVIDER_STATUSES.PARTIAL,
            data: {
              schema_version: "1.0",
              tool: name,
              status: "partial",
              as_of: STARTED_AT,
              data: { regime: "neutral" },
            },
            raw: {},
            provenance,
          };
        }
        return {
          ok: false,
          status: RYO_PROVIDER_STATUSES.UNAVAILABLE,
          error: { code: "RYO_UNAVAILABLE", message: "Provider data unavailable." },
          provenance,
        };
      }),
    };

    const result = await runResearch({
      provider: createLiveRYOResearchProvider(client as never),
      playbookVersion: createDemoPlaybook().version,
      runId: "live-degraded",
      startedAt: STARTED_AT,
    });

    expect(result.mode).toBe("LIVE");
    expect(result.provider.source).toBe("LIVE_RYO");
    expect(result.status).toBe("DEGRADED");
    expect(result.finalDecision).toBe("ABSTAIN");
    expect(result.candidates).toEqual([]);
    expect(result.providerFailures.some((failure) => failure.status === "UNAVAILABLE")).toBe(true);
  });
});