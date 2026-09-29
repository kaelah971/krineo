import marketOverviewFixture from "../ryo/fixtures/live-sanitized-market-overview.json";
import scanMarketUnavailableFixture from "../ryo/fixtures/live-sanitized-scan-market-unavailable.json";
import {
  createRYOClient,
  normalizeRYOFixture,
  normalizeRYOResult,
  parseSanitizedRYOFixture,
  RYO_PROVIDER_STATUSES,
  type RYOCallFailure,
  type RYOCallResult,
  type RYOClient,
  type RYODiscovery,
  type RYOProvenance,
  type RYOProviderStatus,
  type SanitizedRYOFixture,
} from "../ryo";
import { getDemoScenarios, type DemoScenarioId } from "../demo/scenarios";
import type {
  ResearchCandidateDescriptor,
  ResearchCandidateDiscovery,
  ResearchCandidateEvidence,
  ResearchEvidenceSnapshot,
  ResearchMarketContext,
  ResearchProviderIdentity,
  ResearchProviderIssue,
  ResearchProviderProvenance,
  ResearchProviderStatus,
} from "./types";

export const MAX_RESEARCH_CANDIDATES = 3 as const;

export interface ResearchProviderPreparation {
  readonly ok: boolean;
  readonly status: ResearchProviderStatus;
  readonly warnings: readonly ResearchProviderIssue[];
  readonly failures: readonly ResearchProviderIssue[];
}

export interface ResearchProvider {
  readonly identity: ResearchProviderIdentity;
  prepare(): Promise<ResearchProviderPreparation>;
  marketContext(): Promise<ResearchMarketContext>;
  discoverCandidates(limit: number): Promise<ResearchCandidateDiscovery>;
  researchCandidate(asset: string): Promise<ResearchCandidateEvidence>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  code: string,
  message: string,
  source: string,
  status?: ResearchProviderStatus,
): ResearchProviderIssue {
  return { code, message, source, ...(status === undefined ? {} : { status }) };
}

function asPayloadData(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value) || !isRecord(value.data)) {
    return null;
  }
  return value.data;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function payloadWarnings(
  value: unknown,
  source: string,
  status?: ResearchProviderStatus,
): ResearchProviderIssue[] {
  if (!isRecord(value)) return [];
  return asStringArray(value.warnings).map((message) =>
    issue("PROVIDER_WARNING", message, source, status),
  );
}

function providerProvenance(
  provenance: RYOProvenance,
  source: string,
): ResearchProviderProvenance {
  return {
    provider: provenance.provider,
    source,
    tool: provenance.tool,
    ...(provenance.asOf === undefined ? {} : { asOf: provenance.asOf }),
    ...(provenance.serverName === undefined
      ? {}
      : { serverName: provenance.serverName }),
    ...(provenance.serverVersion === undefined
      ? {}
      : { serverVersion: provenance.serverVersion }),
    ...(provenance.protocolVersion === undefined
      ? {}
      : { protocolVersion: provenance.protocolVersion }),
  };
}

function researchSnapshotFromRYO(
  snapshot: ReturnType<typeof normalizeRYOResult>,
  source: string,
): ResearchEvidenceSnapshot {
  return {
    asset: snapshot.asset,
    dm1: snapshot.dm1,
    evidenceItems: snapshot.evidenceItems,
    provenance: providerProvenance(snapshot.provenance, source),
    providerStatus: snapshot.providerStatus,
    normalizationNotes: snapshot.normalizationNotes,
  };
}

function failureResult(
  status: Exclude<RYOProviderStatus, "SUCCESS" | "PARTIAL">,
  provenance: RYOProvenance,
  message: string,
): RYOCallFailure {
  return {
    ok: false,
    status,
    error: { code: `RYO_${status}`, message },
    provenance,
  };
}

function candidateAsset(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return /^[A-Za-z0-9._-]{1,32}$/.test(normalized) ? normalized : null;
  }
  if (!isRecord(value)) return null;

  for (const key of ["symbol", "asset", "token"]) {
    const candidate = value[key];
    if (typeof candidate === "string") {
      const normalized = candidate.trim();
      if (/^[A-Za-z0-9._-]{1,32}$/.test(normalized)) {
        return normalized;
      }
    }
  }

  return null;
}

function candidateDescriptors(
  value: unknown,
  source: string,
): {
  candidates: ResearchCandidateDescriptor[];
  warnings: ResearchProviderIssue[];
} {
  const data = asPayloadData(value);
  const rawCandidates = data?.candidates;
  if (!Array.isArray(rawCandidates)) {
    return {
      candidates: [],
      warnings: [
        issue(
          "CANDIDATE_LIST_UNAVAILABLE",
          "The provider response did not expose a structured candidates array.",
          source,
        ),
      ],
    };
  }

  const candidates: ResearchCandidateDescriptor[] = [];
  const warnings: ResearchProviderIssue[] = [];
  const seen = new Set<string>();
  for (const [index, rawCandidate] of rawCandidates.entries()) {
    const asset = candidateAsset(rawCandidate);
    if (asset === null) {
      warnings.push(
        issue(
          "INVALID_CANDIDATE_ASSET",
          `Candidate ${index + 1} did not contain a valid asset identifier.`,
          source,
        ),
      );
      continue;
    }
    if (seen.has(asset)) continue;
    seen.add(asset);
    candidates.push({ asset, providerRank: index + 1 });
  }

  return { candidates, warnings };
}

function marketContextFromRYO(
  result: RYOCallResult<unknown>,
  source: string,
): ResearchMarketContext {
  if (!result.ok) {
    return {
      status: result.status,
      provenance: providerProvenance(result.provenance, source),
      ...(result.provenance.asOf === undefined
        ? {}
        : { asOf: result.provenance.asOf }),
      regime: null,
      warnings: [
        issue(
          result.error.code,
          result.error.message,
          result.provenance.tool,
          result.status,
        ),
      ],
    };
  }

  const data = asPayloadData(result.data);
  const regime = typeof data?.regime === "string" ? data.regime : null;
  return {
    status: result.status,
    provenance: providerProvenance(result.provenance, source),
    ...(result.provenance.asOf === undefined
      ? {}
      : { asOf: result.provenance.asOf }),
    regime,
    warnings: payloadWarnings(result.data, result.provenance.tool, result.status),
  };
}

function snapshotFromFailure(
  asset: string,
  source: string,
  status: Exclude<RYOProviderStatus, "SUCCESS" | "PARTIAL">,
  tool: string,
  identity?: Pick<ResearchProviderProvenance, "serverName" | "serverVersion" | "protocolVersion">,
): ResearchEvidenceSnapshot {
  const provenance: RYOProvenance = {
    provider: "RYO",
    tool,
    ...identity,
  };
  return researchSnapshotFromRYO(
    normalizeRYOResult(
      failureResult(status, provenance, `RYO ${tool} returned ${status}.`),
      asset,
    ),
    source,
  );
}

class LiveRYOResearchProvider implements ResearchProvider {
  private discovery: RYODiscovery | null = null;
  private _identity: ResearchProviderIdentity = {
    id: "RYO",
    mode: "LIVE",
    source: "LIVE_RYO",
  };

  public constructor(private readonly client: RYOClient) {}

  public get identity(): ResearchProviderIdentity {
    return this._identity;
  }

  public async prepare(): Promise<ResearchProviderPreparation> {
    const result = await this.client.discover();
    if (!result.ok) {
      return {
        ok: false,
        status: result.status,
        warnings: [],
        failures: [
          issue(
            result.error.code,
            result.error.message,
            result.provenance.tool,
            result.status,
          ),
        ],
      };
    }

    this.discovery = result.discovery;
    this._identity = {
      id: "RYO",
      mode: "LIVE",
      source: "LIVE_RYO",
      serverName: result.discovery.serverInfo.name,
      serverVersion: result.discovery.serverInfo.version,
      protocolVersion: result.discovery.protocolVersion,
    };
    return {
      ok: true,
      status: RYO_PROVIDER_STATUSES.SUCCESS,
      warnings: [],
      failures: [],
    };
  }

  private provenance(tool: string): RYOProvenance {
    return {
      provider: "RYO",
      tool,
      ...(this.discovery === null
        ? {}
        : {
            serverName: this.discovery.serverInfo.name,
            serverVersion: this.discovery.serverInfo.version,
            protocolVersion: this.discovery.protocolVersion,
          }),
    };
  }

  private hasTool(name: string): boolean {
    return this.discovery?.tools.some((tool) => tool.name === name) ?? false;
  }

  public async marketContext(): Promise<ResearchMarketContext> {
    if (this.discovery === null) {
      return marketContextFromRYO(
        failureResult(
          RYO_PROVIDER_STATUSES.UNAVAILABLE,
          this.provenance("market_overview"),
          "RYO discovery has not completed.",
        ),
        "LIVE_RYO",
      );
    }

    const result = await this.client.callTool("market_overview", {});
    return marketContextFromRYO(result, "LIVE_RYO");
  }

  public async discoverCandidates(
    limit: number,
  ): Promise<ResearchCandidateDiscovery> {
    const provenance = providerProvenance(
      this.provenance("scan_market"),
      "LIVE_RYO",
    );
    if (this.discovery === null) {
      const failure = issue(
        "RYO_DISCOVERY_REQUIRED",
        "RYO discovery has not completed.",
        "scan_market",
        RYO_PROVIDER_STATUSES.UNAVAILABLE,
      );
      return {
        status: RYO_PROVIDER_STATUSES.UNAVAILABLE,
        provenance,
        candidates: [],
        warnings: [],
        failures: [failure],
      };
    }

    if (!this.hasTool("scan_market")) {
      const failure = issue(
        "RYO_TOOL_UNAVAILABLE",
        "The discovered RYO tool list does not include scan_market.",
        "scan_market",
        RYO_PROVIDER_STATUSES.NOT_FOUND,
      );
      return {
        status: RYO_PROVIDER_STATUSES.NOT_FOUND,
        provenance,
        candidates: [],
        warnings: [],
        failures: [failure],
      };
    }

    const result = await this.client.callTool("scan_market", {
      top_n: limit,
      filter_direction: "all",
    });
    if (!result.ok) {
      return {
        status: result.status,
        provenance: providerProvenance(result.provenance, "LIVE_RYO"),
        candidates: [],
        warnings: [],
        failures: [
          issue(
            result.error.code,
            result.error.message,
            result.provenance.tool,
            result.status,
          ),
        ],
      };
    }

    const parsed = candidateDescriptors(result.data, result.provenance.tool);
    const warnings = [
      ...payloadWarnings(result.data, result.provenance.tool, result.status),
      ...parsed.warnings,
    ];
    return {
      status: result.status,
      provenance: providerProvenance(result.provenance, "LIVE_RYO"),
      candidates: parsed.candidates.slice(0, limit),
      warnings,
      failures: [],
    };
  }

  public async researchCandidate(asset: string): Promise<ResearchCandidateEvidence> {
    const tool = this.hasTool("deep_analysis")
      ? "deep_analysis"
      : this.hasTool("analyze_token")
        ? "analyze_token"
        : null;
    if (tool === null || this.discovery === null) {
      const status = RYO_PROVIDER_STATUSES.NOT_FOUND;
      const snapshot = snapshotFromFailure(
        asset,
        "LIVE_RYO",
        status,
        "asset_research",
        this.identity,
      );
      return {
        asset,
        snapshot,
        warnings: [],
        failures: [
          issue(
            "RYO_ASSET_RESEARCH_UNAVAILABLE",
            "No discovered RYO asset-research tool is available.",
            "asset_research",
            status,
          ),
        ],
      };
    }

    const result = await this.client.callTool(tool, { symbol: asset });
    const snapshot = researchSnapshotFromRYO(
      normalizeRYOResult(result, asset),
      "LIVE_RYO",
    );
    if (!result.ok) {
      return {
        asset,
        snapshot,
        warnings: [],
        failures: [
          issue(
            result.error.code,
            result.error.message,
            result.provenance.tool,
            result.status,
          ),
        ],
      };
    }

    return {
      asset,
      snapshot,
      warnings: payloadWarnings(result.data, result.provenance.tool, result.status),
      failures: [],
    };
  }
}

export function createLiveRYOResearchProvider(
  client: RYOClient = createRYOClient(),
): ResearchProvider {
  return new LiveRYOResearchProvider(client);
}

class SanitizedRYOReplayProvider implements ResearchProvider {
  public readonly identity: ResearchProviderIdentity;
  private readonly market: SanitizedRYOFixture;
  private readonly scan: SanitizedRYOFixture;

  public constructor() {
    this.market = parseSanitizedRYOFixture(marketOverviewFixture);
    this.scan = parseSanitizedRYOFixture(scanMarketUnavailableFixture);
    this.identity = {
      id: "RYO",
      mode: "REPLAY",
      source: "REPLAY_FROM_SANITIZED_RYO_FIXTURE",
      serverName: this.market.provenance.serverName,
      serverVersion: this.market.provenance.serverVersion,
      protocolVersion: this.market.provenance.protocolVersion,
    };
  }

  public async prepare(): Promise<ResearchProviderPreparation> {
    return {
      ok: true,
      status: RYO_PROVIDER_STATUSES.SUCCESS,
      warnings: [],
      failures: [],
    };
  }

  public async marketContext(): Promise<ResearchMarketContext> {
    const snapshot = normalizeRYOFixture(this.market, "__MARKET_CONTEXT__");
    return {
      status: snapshot.providerStatus,
      provenance: providerProvenance(
        snapshot.provenance,
        "REPLAY_FROM_SANITIZED_RYO_FIXTURE",
      ),
      asOf: snapshot.provenance.asOf,
      regime: snapshot.dm1.evidence.MARKET_ALIGNMENT ?? null,
      warnings: payloadWarnings(
        this.market.raw,
        this.market.provenance.tool,
        snapshot.providerStatus,
      ),
    };
  }

  public async discoverCandidates(
    limit: number,
  ): Promise<ResearchCandidateDiscovery> {
    const snapshot = normalizeRYOFixture(this.scan, "__SCAN_CONTEXT__");
    const parsed = candidateDescriptors(
      this.scan.raw,
      this.scan.provenance.tool,
    );
    const providerWarnings = [
      ...payloadWarnings(this.scan.raw, this.scan.provenance.tool, snapshot.providerStatus),
      ...parsed.warnings,
    ];
    const unavailable = snapshot.providerStatus !== RYO_PROVIDER_STATUSES.SUCCESS &&
      snapshot.providerStatus !== RYO_PROVIDER_STATUSES.PARTIAL;
    return {
      status: snapshot.providerStatus,
      provenance: providerProvenance(
        snapshot.provenance,
        "REPLAY_FROM_SANITIZED_RYO_FIXTURE",
      ),
      candidates: parsed.candidates.slice(0, limit),
      warnings: providerWarnings,
      failures: unavailable
        ? [
            issue(
              "REPLAY_PROVIDER_UNAVAILABLE",
              "The sanitized scan fixture records an unavailable candidate scan.",
              this.scan.provenance.tool,
              snapshot.providerStatus,
            ),
          ]
        : [],
    };
  }

  public async researchCandidate(asset: string): Promise<ResearchCandidateEvidence> {
    const snapshot = researchSnapshotFromRYO(
      normalizeRYOFixture(this.market, asset),
      "REPLAY_FROM_SANITIZED_RYO_FIXTURE",
    );
    return {
      asset,
      snapshot,
      warnings: [
        issue(
          "REPLAY_ASSET_EVIDENCE_UNAVAILABLE",
          "The sanitized RYO captures contain market context but no asset-level research result.",
          this.market.provenance.tool,
          snapshot.providerStatus,
        ),
      ],
      failures: [],
    };
  }
}

export function createSanitizedRYOReplayProvider(): ResearchProvider {
  return new SanitizedRYOReplayProvider();
}

class DeterministicResearchFixtureProvider implements ResearchProvider {
  public readonly identity: ResearchProviderIdentity = {
    id: "KRINEO_DEMO",
    mode: "REPLAY",
    source: "DETERMINISTIC_RESEARCH_FIXTURE",
  };
  private readonly scenario;

  public constructor(scenarioId: DemoScenarioId) {
    const scenario = getDemoScenarios().find((item) => item.id === scenarioId);
    if (scenario === undefined) {
      throw new Error(`Unsupported deterministic research fixture: ${scenarioId}.`);
    }
    this.scenario = scenario;
  }

  public async prepare(): Promise<ResearchProviderPreparation> {
    return {
      ok: true,
      status: RYO_PROVIDER_STATUSES.SUCCESS,
      warnings: [
        issue(
          "DETERMINISTIC_RESEARCH_FIXTURE",
          "This replay uses Krineo demo evidence, not captured live RYO data.",
          "demo-research",
          RYO_PROVIDER_STATUSES.SUCCESS,
        ),
      ],
      failures: [],
    };
  }

  public async marketContext(): Promise<ResearchMarketContext> {
    return {
      status: RYO_PROVIDER_STATUSES.SUCCESS,
      provenance: {
        provider: "KRINEO_DEMO",
        source: "DETERMINISTIC_RESEARCH_FIXTURE",
        tool: "demo-research",
      },
      regime: null,
      warnings: [],
    };
  }

  public async discoverCandidates(
    limit: number,
  ): Promise<ResearchCandidateDiscovery> {
    return {
      status: RYO_PROVIDER_STATUSES.SUCCESS,
      provenance: {
        provider: "KRINEO_DEMO",
        source: "DETERMINISTIC_RESEARCH_FIXTURE",
        tool: "demo-candidate-discovery",
      },
      candidates: limit > 0
        ? [{ asset: this.scenario.asset, providerRank: 1 }]
        : [],
      warnings: [],
      failures: [],
    };
  }

  public async researchCandidate(asset: string): Promise<ResearchCandidateEvidence> {
    if (asset !== this.scenario.asset) {
      const unknown: ResearchEvidenceSnapshot = {
        asset,
        dm1: {
          evidence: {
            DIRECTIONAL_MOMENTUM: "UNKNOWN",
            TECHNICAL_CONFLUENCE: "UNKNOWN",
            RELATIVE_OPPORTUNITY: "UNKNOWN",
            MARKET_ALIGNMENT: "UNKNOWN",
            SENTIMENT_DERIVATIVES: "UNKNOWN",
          },
          risk: "UNKNOWN",
          safety: "UNKNOWN",
          regimeFit: "UNKNOWN",
        },
        evidenceItems: [],
        provenance: {
          provider: "KRINEO_DEMO",
          source: "DETERMINISTIC_RESEARCH_FIXTURE",
          tool: "demo-research",
        },
        providerStatus: RYO_PROVIDER_STATUSES.NOT_FOUND,
        normalizationNotes: {
          evidence: "No deterministic fixture evidence exists for this asset.",
        },
      };
      return {
        asset,
        snapshot: unknown,
        warnings: [],
        failures: [
          issue(
            "DEMO_ASSET_UNAVAILABLE",
            "The deterministic research fixture does not contain this asset.",
            "demo-research",
            RYO_PROVIDER_STATUSES.NOT_FOUND,
          ),
        ],
      };
    }

    return {
      asset,
      snapshot: {
        asset,
        dm1: this.scenario.originalEvidenceSnapshot,
        evidenceItems: this.scenario.originalEvidence,
        provenance: {
          provider: "KRINEO_DEMO",
          source: "DETERMINISTIC_RESEARCH_FIXTURE",
          tool: "demo-research",
        },
        providerStatus: RYO_PROVIDER_STATUSES.SUCCESS,
        normalizationNotes: {
          evidence: "Existing Krineo deterministic demo evidence; not captured RYO data.",
        },
      },
      warnings: [],
      failures: [],
    };
  }
}

export function createDeterministicResearchFixtureProvider(
  scenarioId: DemoScenarioId = "directional",
): ResearchProvider {
  return new DeterministicResearchFixtureProvider(scenarioId);
}