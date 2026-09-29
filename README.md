# Krineo

## Decide with receipts.

**The strategy memory and decision guardrail for AI-assisted trading.**

> **Rules decide. Models explain.**

Krineo is infrastructure for AI-assisted trading decisions, not a real-money trading system. It runs a bounded market-research cycle, turns provider evidence into deterministic policy inputs, selects or abstains, applies approved guardrails, and can record an optional simulated practice decision.

The canonical market decision is rule-driven. Any future model may explain or synthesize the structured result; it does not override DM-1, Preflight, KillSwitch, receipt, or practice-ledger policy.

> **Current repository truth:** Track 1 research orchestration, the Track 2 Golden Demo, and the Track 3 `strategy_preflight` skill are implemented. The Golden Demo is fixture-backed. The live RYO boundary authenticates and discovers tools, but current upstream asset-level availability is degraded.

## What Krineo does

Krineo makes a market belief inspectable:

```text
PROVIDER
  → CANDIDATE DISCOVERY
  → EVIDENCE NORMALIZATION
  → DM-1 EVALUATION
  → DETERMINISTIC SELECTION / ABSTAIN
  → APPROVED PLAYBOOK
  → PREFLIGHT
  → KILLSWITCH
  → OPTIONAL SIMULATED PRACTICE COMMIT
  → CANONICAL DECISION RECEIPT
```

Track 1 is autonomous research and decision reasoning only. It is not autonomous trading:

- No real-money trading.
- No wallet custody or exchange execution.
- `autoCommitPractice` defaults to `false` and changes simulation only when explicitly enabled.
- No funds or real assets move.
- No profitability, prediction, alpha, or financial-advice claim is made.
- `ABSTAIN` is a valid autonomous outcome.

Missing or unavailable provider evidence remains `UNKNOWN`. Krineo never fabricates candidates or fills missing data with neutral assumptions.

## Tracks

### Track 1 — Autonomous Agents

`runResearch()` owns one bounded application research run. A `ResearchProvider` can use LIVE RYO data or a clearly labeled REPLAY source. Up to three candidates are researched through the same normalization and DM-1 path. `selectAutonomousCandidate()` makes the deterministic selection or abstains. The approved Playbook, Preflight, and deterministic KillSwitch gate any optional simulated practice commit. A canonical Decision Receipt records committed structured state.

Application entry point:

```text
POST /api/research/run
```

The run result includes provider provenance, candidate evidence, DM-1 results, selection, Preflight, KillSwitch, structured reasons, and optional Thesis/Receipt/Practice results.

### Track 2 — Dashboard & Interface

The Golden Demo makes four concepts visible:

```text
NOW → RULES → MEMORY → CHANGE
```

It includes Decision Memory, CaseSimilarityV1, Memory Lessons v1.1, governed Playbook Authoring, human approval, explicit commit and refresh, canonical Receipts, Strategy Diff, invalidation, and simulated practice lifecycle.

The Golden Demo is explicitly fixture-backed. Its provenance is `DEMO RESEARCH SNAPSHOT`; it is not live RYO data.

### Track 3 — New Skill

The shipped skill is `strategy_preflight`:

```text
GET  /api/skills/
GET  /api/skills/strategy_preflight
POST /api/skills/strategy_preflight/invoke
```

The caller supplies validated normalized market context and an approved Playbook. The deterministic skill returns `FIT`, `CAUTION`, `WAIT`, or `BLOCK`. It is read-only, has no trade-execution path, and has no Sibyl runtime dependency.

`challenge_thesis` is roadmap language, not a shipped Track 3 contract.

## LIVE versus REPLAY

### LIVE

LIVE mode uses the configured server-side RYO MCP provider. The adapter performs runtime discovery, calls only discovered tools, normalizes observed provider results, and preserves typed provider failures.

Live RYO availability depends on upstream health. The latest verified state is:

- MCP authentication: successful.
- MCP discovery: successful.
- `market_overview`: `PARTIAL`.
- `scan_market`: `UNAVAILABLE`.
- Usable live asset candidates: none currently available.
- Overall provider state: `DEGRADED`.

A degraded LIVE run truthfully returns a degraded/abstaining result. It does not switch to fixtures and call them live.

### REPLAY

REPLAY mode uses either sanitized observed RYO responses or a deterministic Krineo research fixture. Replay exists for tests, reproducibility, and demo reliability during provider outages.

Replay provenance is explicit:

- `REPLAY_FROM_SANITIZED_RYO_FIXTURE` for committed sanitized RYO captures.
- `DETERMINISTIC_RESEARCH_FIXTURE` for existing Krineo demo evidence.

Neither label means LIVE RYO.

## RYO integration

The current live MCP-discovered tools are:

- `market_overview`
- `scan_market`
- `analyze_token`
- `deep_analysis`
- `compare_tokens`
- `monitor_market_sentiment_shift`

`check_safety` and `supported_tokens` are not part of the current discovered live tool list and are not assumed by the adapter.

The RYO adapter lives in [`lib/ryo/`](lib/ryo/). It validates discovered input schemas, keeps authorization server-side, applies timeouts, classifies failures, and keeps raw provider shapes outside the deterministic decision engine. See [`lib/ryo/README.md`](lib/ryo/README.md) for the current boundary and health disclosure.

```text
RYO supplies research evidence and provider status.
Krineo supplies deterministic judgement, guardrails, accountability and lifecycle reasoning.
```

## Decision Memory and Playbook governance

The current memory loop is conservative and human-governed:

```text
Decision Memory
  → structural comparison
  → Memory Lesson candidate
  → SYSTEM RuleProposal
  → PENDING / inert
  → explicit HUMAN approval
  → immutable Playbook v+1
  → Preflight reevaluation
```

Memory can propose. Memory cannot govern until the user approves.

Memory Lessons v1.1 uses:

- An allowlist of restrictive states.
- A contrast-cohort requirement.
- Historical association, not causal proof.
- No statistical-significance claim.
- No P&L-based learning.

This is deterministic decision memory, not autonomous self-learning. The approved Playbook remains the authority for current behavior.

## DM-1 and ABSTAIN

DM-1, Defensible Momentum v1, evaluates:

- Directional momentum.
- Technical confluence.
- Relative opportunity.
- Market alignment.
- Sentiment and derivatives.

Coverage, conflict, risk, safety, regime fit, and hard gates remain explicit. Unknown evidence reduces coverage and can force `ABSTAIN`.

`ABSTAIN` is first-class when evidence is insufficient, unavailable, conflicting, unsafe, outside the regime, or lacks a clear relative winner. It does not open a directional practice position.

## Receipts and simulated practice

A committed Decision Receipt contains the canonical structured decision state, evidence provenance, candidate ranking, KillSwitch result, policy versions, invalidation rules, and SHA-256 integrity hash.

The hash proves integrity of the canonical receipt state. It does not prove correctness, profitability, blockchain settlement, or future performance.

Practice positions are simulated only:

- Default `$10,000` simulated portfolio.
- Default `$1,000` directional notional.
- No leverage, wallets, exchanges, or execution.
- P&L is context, not proof of strategy quality.

## Sibyl

The repository contains a Sibyl bridge and transport implementation. The current product and Golden Demo do not require a live Sibyl runtime. Krineo's deterministic Decision Memory remains authoritative, and no production database persistence is implied by the bridge or by the demo.

## API surfaces

Current application routes:

```text
POST /api/research/run
GET  /api/skills/
GET  /api/skills/strategy_preflight
POST /api/skills/strategy_preflight/invoke
```

Internal/demo routes:

```text
POST /api/demo/commit
POST /api/demo/refresh
```

These demo routes operate on deterministic scenarios and are not a public trading API.

## Implemented versus roadmap

Implemented in this repository:

- Bounded LIVE/REPLAY research orchestration.
- Deterministic DM-1, candidate selection, Preflight, KillSwitch, Thesis, Receipt, and simulated Practice domains.
- Decision Memory, CaseSimilarityV1, Memory Lessons v1.1, governed Playbook Authoring, and Golden Demo.
- `strategy_preflight` skill discovery and invocation.
- Typed RYO provider failures and explicit fixture/replay provenance.

Roadmap only:

- Continuous background monitoring or scheduling.
- Production database persistence and restart recovery.
- Real-money execution, wallets, or exchanges.
- LLM multi-agent debate.
- Automatic rule approval or automatic Playbook mutation.
- A live production Sibyl runtime.
- On-chain receipt anchoring.

## Tech stack

- Next.js `16.3.4` App Router.
- React `19.2.8`.
- TypeScript 5.
- Tailwind CSS `4.1.17`.
- Vitest `3.2.7`.
- Lucide React.

## Testing and verification

The current verified suite contains **344 tests across 19 test files**. It covers deterministic policy, memory, Playbook governance, Preflight, KillSwitch, thesis lifecycle, receipts, practice, RYO boundaries, Track 3, Golden Demo behavior, and Track 1 research orchestration.

No coverage percentage is published.

```bash
npm test
npm run type-check
npm run lint
npm run build
```

The build script uses `next build --webpack`.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment and secret hygiene

Copy `.env.example` to a server-side local environment only:

```text
RYO_MCP_KEY=
RYO_MCP_URL=
```

Both variables are server-only. Never create `NEXT_PUBLIC_RYO_MCP_KEY`, expose either value to client components, commit `.env` files, place credentials in screenshots or logs, or send secrets through the browser.

When live RYO is unavailable, use the explicitly labeled REPLAY modes. Do not present replay or deterministic fixture evidence as live provider data.

## Submission disclosure

Krineo is read-only research and simulated practice positioning. It is not financial advice, a broker, an exchange, a custody layer, a real-money trading system, or an autonomous execution product.
