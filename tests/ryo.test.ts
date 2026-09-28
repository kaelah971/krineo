import { describe, expect, it, vi } from "vitest";
import toolsFixture from "../lib/ryo/fixtures/live-sanitized-tools-list.json";
import marketFixture from "../lib/ryo/fixtures/live-sanitized-market-overview.json";
import rateLimitedFixture from "../lib/ryo/fixtures/live-sanitized-monitor-rate-limited.json";
import {
  RYO_PROVIDER_STATUSES,
  classifyRYOProviderPayload,
  createRYOClient,
  normalizeRYOFixture,
  normalizeRYOResult,
  parseSanitizedRYOFixture,
} from "../lib/ryo";
import type { RYOProvenance } from "../lib/ryo";
import { evaluateDM1 } from "../lib/strategy/dm1/decision";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyAcceptedResponse(): Response {
  return new Response("", { status: 202 });
}

function initializeResponse(): Response {
  return jsonResponse({
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "ryo-chan", version: "1.0.0" },
    },
  });
}

function toolsResponse(): Response {
  const parsed = parseSanitizedRYOFixture(toolsFixture);
  return jsonResponse(parsed.raw);
}

function toolResponse(payload: unknown, isError = false): Response {
  return jsonResponse({
    jsonrpc: "2.0",
    id: 4,
    result: {
      content: [
        {
          type: "text",
          text: typeof payload === "string" ? payload : JSON.stringify(payload),
        },
      ],
      isError,
    },
  });
}

function fetchSequence(responses: Response[]): typeof fetch {
  const implementation = vi.fn(async () => responses.shift() ?? jsonResponse({}));
  return implementation as unknown as typeof fetch;
}

const testProvenance: RYOProvenance = {
  provider: "RYO",
  serverName: "ryo-chan",
  serverVersion: "1.0.0",
  protocolVersion: "2024-11-05",
  tool: "deep_analysis",
};

describe("M5 RYO live boundary", () => {
  it("parses the recorded live capability fixture without changing provider shape", () => {
    const fixture = parseSanitizedRYOFixture(toolsFixture);
    const raw = fixture.raw as {
      result: { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> };
    };

    expect(fixture.fixtureMarker).toBe("LIVE_SANITIZED_RYO_FIXTURE");
    expect(raw.result.tools.map((tool) => tool.name)).toEqual([
      "market_overview",
      "scan_market",
      "analyze_token",
      "deep_analysis",
      "compare_tokens",
      "monitor_market_sentiment_shift",
    ]);
    expect(raw.result.tools[2]?.inputSchema).toMatchObject({
      required: ["symbol"],
      additionalProperties: false,
    });
    expect(raw.result.tools[4]?.inputSchema).toMatchObject({
      properties: {
        intent: { enum: ["swing", "hold", "spot"] },
      },
    });
  });

  it("normalizes only observed structured evidence and keeps nulls unavailable", () => {
    const fixture = parseSanitizedRYOFixture(marketFixture);
    const snapshot = normalizeRYOFixture(fixture, "FIXTURE-ASSET");

    expect(snapshot.providerStatus).toBe(RYO_PROVIDER_STATUSES.PARTIAL);
    expect(snapshot.provenance.tool).toBe("market_overview");
    expect(snapshot.provenance.asOf).toBe("2026-09-28T13:25:01Z");
    expect(snapshot.dm1.evidence).toEqual({
      DIRECTIONAL_MOMENTUM: "UNKNOWN",
      TECHNICAL_CONFLUENCE: "UNKNOWN",
      RELATIVE_OPPORTUNITY: "UNKNOWN",
      MARKET_ALIGNMENT: "NEUTRAL",
      SENTIMENT_DERIVATIVES: "UNKNOWN",
    });
    expect(snapshot.dm1.risk).toBe("UNKNOWN");
    expect(snapshot.dm1.safety).toBe("UNKNOWN");
    expect(snapshot.dm1.regimeFit).toBe("UNKNOWN");
    expect(
      (fixture.raw.data as { sentiment: { fear_greed_index: unknown } }).sentiment
        .fear_greed_index,
    ).toBeNull();
  });

  it("preserves provenance and does not mutate the recorded fixture", () => {
    const input = structuredClone(marketFixture);
    const before = JSON.stringify(input);

    const snapshot = normalizeRYOFixture(input, "FIXTURE-ASSET");

    expect(JSON.stringify(input)).toBe(before);
    expect(snapshot.evidenceItems).toHaveLength(5);
    expect(snapshot.evidenceItems[0]).toMatchObject({
      source: "RYO/market_overview",
      observedAt: "2026-09-28T13:25:01Z",
    });
    expect(snapshot.evidenceItems[3]?.rawReference).toBe(
      "RYO.market_overview.data.regime",
    );
  });

  it("represents provider credit exhaustion as RATE_LIMITED and not success", () => {
    const fixture = parseSanitizedRYOFixture(rateLimitedFixture);

    expect(classifyRYOProviderPayload(fixture.raw)).toBe(
      RYO_PROVIDER_STATUSES.RATE_LIMITED,
    );
    expect(normalizeRYOFixture(fixture, "FIXTURE-ASSET").providerStatus).toBe(
      RYO_PROVIDER_STATUSES.RATE_LIMITED,
    );
  });

  it("replays fixture normalization through unchanged DM-1 deterministically", () => {
    const firstSnapshot = normalizeRYOFixture(marketFixture, "FIXTURE-ASSET");
    const secondSnapshot = normalizeRYOFixture(marketFixture, "FIXTURE-ASSET");
    const firstDecision = evaluateDM1(firstSnapshot.dm1);
    const secondDecision = evaluateDM1(secondSnapshot.dm1);

    expect(secondSnapshot).toEqual(firstSnapshot);
    expect(secondDecision).toEqual(firstDecision);
    expect(firstDecision.decision).toBe("ABSTAIN");
    expect(firstDecision.directionalScore).toBe(0);
    expect(firstDecision.coverage).toBe(0.15);
    expect(firstDecision.reasonCodes).toContain("REQUIRED_EVIDENCE_UNAVAILABLE");
    expect(firstDecision.reasonCodes).toContain("INSUFFICIENT_COVERAGE");
  });

  it("keeps a failed provider result out of DM-1 as fabricated evidence", () => {
    const result = normalizeRYOResult(
      {
        ok: false,
        status: RYO_PROVIDER_STATUSES.TIMEOUT,
        error: { code: "RYO_TIMEOUT", message: "RYO research timed out." },
        provenance: testProvenance,
      },
      "FIXTURE-ASSET",
    );

    expect(result.dm1.evidence).toEqual({
      DIRECTIONAL_MOMENTUM: "UNKNOWN",
      TECHNICAL_CONFLUENCE: "UNKNOWN",
      RELATIVE_OPPORTUNITY: "UNKNOWN",
      MARKET_ALIGNMENT: "UNKNOWN",
      SENTIMENT_DERIVATIVES: "UNKNOWN",
    });
    expect(evaluateDM1(result.dm1).decision).toBe("ABSTAIN");
  });

  it("discovers live capabilities, validates arguments, and calls a discovered tool", async () => {
    const responses = [
      initializeResponse(),
      emptyAcceptedResponse(),
      toolsResponse(),
      toolResponse({
        schema_version: "1.0",
        tool: "deep_analysis",
        status: "partial",
        data_mode: "live",
        as_of: "2026-09-28T13:30:00Z",
        request: { symbol: "SOL", include_perp: true },
        data: { market: null },
      }),
    ];
    const fetchMock = vi.fn(
      async (...request: Parameters<typeof fetch>) => {
        void request;
        return responses.shift() ?? jsonResponse({});
      },
    );
    const fetchImpl = fetchMock as unknown as typeof fetch;
    const client = createRYOClient({
      endpoint: "https://ryo.example.test/mcp",
      key: "test-only-key",
      fetchImpl,
    });

    const discovery = await client.discover();
    expect(discovery.ok).toBe(true);
    if (!discovery.ok) throw new Error(discovery.error.message);
    expect(discovery.discovery.protocolVersion).toBe("2024-11-05");
    expect(discovery.discovery.serverInfo).toEqual({
      name: "ryo-chan",
      version: "1.0.0",
    });

    const result = await client.callTool("deep_analysis", {
      symbol: "SOL",
      include_perp: true,
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(RYO_PROVIDER_STATUSES.PARTIAL);
    expect(result.provenance.tool).toBe("deep_analysis");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const requestHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(requestHeaders.Authorization.startsWith("Bearer ")).toBe(true);
  });

  it("rejects arguments not accepted by the live schema before transport", async () => {
    const fetchImpl = fetchSequence([
      initializeResponse(),
      emptyAcceptedResponse(),
      toolsResponse(),
    ]);
    const client = createRYOClient({
      endpoint: "https://ryo.example.test/mcp",
      key: "test-only-key",
      fetchImpl,
    });
    await client.discover();

    const result = await client.callTool("monitor_market_sentiment_shift", {
      time_window: "30d",
    });

    expect(result).toMatchObject({
      ok: false,
      status: RYO_PROVIDER_STATUSES.ERROR,
      error: { code: "RYO_INVALID_REQUEST" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("classifies unauthorized, timeout, rate-limit, and malformed responses explicitly", async () => {
    const unauthorized = createRYOClient({
      endpoint: "https://ryo.example.test/mcp",
      key: "test-only-key",
      fetchImpl: fetchSequence([jsonResponse({ detail: "Unauthorized" }, 401)]),
    });
    expect((await unauthorized.discover()).status).toBe(
      RYO_PROVIDER_STATUSES.UNAUTHORIZED,
    );

    const timeout = createRYOClient({
      endpoint: "https://ryo.example.test/mcp",
      key: "test-only-key",
      fetchImpl: vi.fn(async () => {
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      }) as unknown as typeof fetch,
    });
    expect((await timeout.discover()).status).toBe(
      RYO_PROVIDER_STATUSES.TIMEOUT,
    );

    const rateLimited = createRYOClient({
      endpoint: "https://ryo.example.test/mcp",
      key: "test-only-key",
      fetchImpl: fetchSequence([
        initializeResponse(),
        emptyAcceptedResponse(),
        toolsResponse(),
        toolResponse((parseSanitizedRYOFixture(rateLimitedFixture)).raw),
      ]),
    });
    await rateLimited.discover();
    expect(
      (await rateLimited.callTool("monitor_market_sentiment_shift", { time_window: "7d" })).status,
    ).toBe(RYO_PROVIDER_STATUSES.RATE_LIMITED);

    const malformed = createRYOClient({
      endpoint: "https://ryo.example.test/mcp",
      key: "test-only-key",
      fetchImpl: fetchSequence([jsonResponse("not-json")]),
    });
    expect((await malformed.discover()).status).toBe(
      RYO_PROVIDER_STATUSES.INVALID_RESPONSE,
    );
  });

  it("never records credential or authorization material in sanitized fixtures", () => {
    const serialized = JSON.stringify({ toolsFixture, marketFixture, rateLimitedFixture });

    expect(serialized).not.toContain("RYO_MCP_KEY");
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("Bearer ");
    expect(() =>
      parseSanitizedRYOFixture({
        ...marketFixture,
        raw: { ...marketFixture.raw, authorization: "secret" },
      }),
    ).toThrow("prohibited credential field");
  });
});
