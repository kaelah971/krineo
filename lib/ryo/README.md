# RYO Adapter Boundary

The RYO MCP contract was discovered live for M5 and is isolated behind the
server-side client in this directory.

- Protocol: `2024-11-05`
- Server: `ryo-chan` `1.0.0`
- Tools: `market_overview`, `scan_market`, `analyze_token`, `deep_analysis`,
  `compare_tokens`, `monitor_market_sentiment_shift`
- The live `tools/list` response exposed input schemas but no output schemas.

`client.ts` validates requests against the discovered input schemas, keeps the
credential in the server-side process, applies timeouts, and classifies raw
provider failures before Krineo sees them. Raw provider shapes remain isolated
from DM-1 types.

The sanitized captures in `fixtures/` are the only committed live responses.
The live market provider was unavailable during the M5 run: `scan_market`
returned zero candidates and the token/sentiment calls reported upstream
credit exhaustion. The normalizer therefore maps only the observed structured
`market_overview.data.regime = "neutral"` value and leaves unsupported or
missing dimensions `UNKNOWN`. No asset-level stance is fabricated.
