# RYO Adapter Boundary

Krineo's RYO MCP client is a server-side provider boundary. The application can run it in `LIVE` mode when the configured endpoint and credential are available, or use an explicitly labeled `REPLAY` provider without contacting RYO.

## Current discovered capability

The latest authenticated MCP discovery returned:

- Protocol: `2024-11-05`
- Server: `ryo-chan` `1.0.0`
- Tools:
  - `market_overview`
  - `scan_market`
  - `analyze_token`
  - `deep_analysis`
  - `compare_tokens`
  - `monitor_market_sentiment_shift`

The discovered response exposed input schemas but no output schemas. The adapter therefore does not assume tools such as `check_safety` or `supported_tokens` are live capabilities.

`client.ts` validates calls against the discovered input schemas, keeps authorization in the server-side process, applies timeouts, sanitizes provider payloads, and classifies typed failures before Krineo sees them. Raw provider shapes remain outside DM-1 types.

## Current provider health

The latest read-only health check established MCP authentication and discovery, but the provider is currently externally degraded:

- `market_overview`: `PARTIAL`
- `scan_market`: `UNAVAILABLE`
- Usable live asset-level candidates: none
- Overall state: `DEGRADED`

A LIVE research run preserves this state and returns a structured degraded/abstaining result. It never silently substitutes fixtures or fabricates candidates.

The normalizer maps only observed structured provider fields. Unsupported or missing dimensions remain `UNKNOWN`. No asset-level stance is asserted when the provider has not supplied enough evidence.

## Replay provenance

Committed sanitized captures are marked `LIVE_SANITIZED_RYO_FIXTURE` and are replayed as:

```text
REPLAY_FROM_SANITIZED_RYO_FIXTURE
```

The deterministic Krineo demo provider uses existing demo evidence and is labeled:

```text
DETERMINISTIC_RESEARCH_FIXTURE
```

Neither source is presented as current LIVE RYO evidence. No credentials, authorization headers, bearer tokens, or private provider responses are committed.
