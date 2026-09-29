---
name: Krineo
document: Technical Architecture, Product Requirements and Build Plan
version: 1.0
status: Architecture roadmap plus current implementation map
category: Accountable AI market reasoning
hackathon: RYO-CHAN Hackathon 2026
---

# Krineo — Architecture, PRD & Build Plan

**Architecture roadmap and implementation map for the RYO-CHAN Hackathon 2026 product.**
**Architecture principle: Rules decide. Models explain.**

> **Current implementation note:** The repository now ships a bounded `runResearch()` path with LIVE and REPLAY providers, deterministic DM-1 selection, approved Playbook/Preflight, KillSwitch, optional simulated practice commit and canonical receipt output. The Golden Demo remains fixture-backed. There is no database persistence, real execution, LLM decision engine or production background scheduler in the current build.

## 1. Delivery objective

The target product is a single web application in which RYO research can be converted into structured evidence, passed through deterministic DM-1 policy, challenged, optionally committed as a versioned Thesis Receipt, and later refreshed to produce a Strategy Diff and invalidation outcome.

The current bounded loop is:

```text
Provider (LIVE or REPLAY) → candidate discovery → normalized evidence
→ up to three DM-1 evaluations → deterministic selection / ABSTAIN
→ approved Playbook → Preflight → KillSwitch
→ optional simulated practice commit → Decision Receipt
```

The application must make the full loop inspectable. A static dashboard, a chat wrapper, or a paper-trading screen without evidence provenance is not a complete Krineo submission.

## 2. Product requirements document

### 2.1 Product definition

Krineo is an accountable AI market-reasoning system. It can research crypto markets through the RYO read-only research layer when usable LIVE evidence is available, or through clearly labeled REPLAY, compare candidates and `ABSTAIN`, produce a deterministic `LONG / SHORT / ABSTAIN` decision, let KillSwitch challenge that decision, and preserve a versioned receipt that explains future changes.

### 2.2 Primary user

A technically curious crypto market participant, researcher, builder or analyst who wants an AI agent to help form a market thesis without accepting an uninspectable recommendation.

### 2.3 Secondary users

- Hackathon judges evaluating evidence, reasoning and system quality.
- Developers inspecting the adapter and reusable `strategy_preflight` skill.
- Other users who want to challenge or inspect a public Thesis Receipt.

### 2.4 Jobs to be done

**Functional job**

> Help me decide whether a market thesis is strong enough to commit, while showing the evidence, alternatives, uncertainty and conditions that could invalidate it.

**Emotional job**

> Let me feel informed and in control without pretending that uncertainty has disappeared.

**Social job**

> Give me a reasoning artifact I can share and defend, rather than a screenshot of an unexplained prediction.

### 2.5 Core user stories

- As a user, I can ask Krineo to analyse a supported token.
- As a user, I can ask Krineo to find the strongest opportunity in a defined universe.
- As a user, I can see the evidence stages while research is running.
- As a user, I can see alternatives that were considered and rejected.
- As a user, I can see `ABSTAIN` as a legitimate outcome.
- As a user, I can inspect supporting, contradicting, stale and unavailable evidence.
- As a user, I can see why KillSwitch cleared, cautioned or vetoed a thesis.
- As a user, I can commit a thesis into an append-only receipt.
- As a user, I can refresh a thesis without losing its previous version.
- As a user, I can inspect a `THEN → NOW` evidence diff.
- As a user, I can see which precommitted invalidation rule fired.
- As a user, I can submit a human challenge as a testable claim.
- As a judge, I can understand, run and evaluate the core loop quickly.
- As a developer, I can replay the same evidence snapshot and strategy version to obtain the same decision.

### 2.6 Non-goals

Krineo will not provide:

- Real-money trading.
- Wallet custody or execution.
- Exchange order placement.
- Leverage or dynamic position sizing.
- Copy trading.
- An autonomous fund.
- Profitability guarantees.
- A full charting terminal.
- Multiple production strategies during the hackathon.
- A full social network.

## 3. System architecture

The application uses one repository and one primary backend/application layer. No microservices are needed for the hackathon. External providers sit behind adapters so raw vendor schemas never leak into the core decision engine.

| Layer | Responsibilities |
|---|---|
| **Frontend** | Agent workspace, opportunity comparison, provisional thesis, KillSwitch, receipt, dashboard, diff and challenge UI. |
| **Application core** | Intent routing, research orchestration, normalisation, DM-1 evaluation, KillSwitch validation, thesis versioning, refresh, diff and invalidation. |
| **RYO adapter** | MCP/REST calls, raw response persistence, typed failure normalisation and provenance. |
| **Narrative adapter** | Optional Tavily/news research; never required to manufacture a directional trade. |
| **AI provider** | Intent parsing, explanation generation and structured challenge proposal only. No hard-rule override. |
| **Database** | Roadmap-only persistence for research stages, raw/normalised evidence, thesis versions, receipts and practice positions; the current build returns immutable in-memory run results. |

### 3.1 Data-flow rule

```text
Raw provider response
→ provenance envelope
→ normalised evidence
→ candidate evaluation
→ deterministic policy
→ validated challenge effect
→ receipt / lifecycle event
→ model explanation
```

The LLM must never be the hidden decision engine.

## 4. Recommended stack

- Next.js and TypeScript in one repository.
- PostgreSQL through a managed provider already familiar to the builder; avoid infrastructure novelty.
- One AI provider behind a small abstraction.
- RYO behind a server-side gateway/adapter.
- Optional Tavily/news provider behind its own adapter.
- SHA-256 over canonical structured receipt state.
- No wallet, chain-execution or separate Python service unless the official Track 3 contract requires it.
- A test runner capable of fast unit tests for the pure strategy and replay fixtures.

## 5. Repository structure

Keep product intelligence in domain libraries rather than React components.

```text
app/
  api/
    research/
    theses/
    practice/
    system/
  workspace/
  theses/
  receipts/
components/
  evidence/
  research/
  thesis/
  killswitch/
  diff/
lib/
  ryo/
    client.ts
    raw-types.ts
    adapter.ts
    provenance.ts
  evidence/
    types.ts
    normalize.ts
    coverage.ts
    conflict.ts
  strategy/
    dm1/
      config.ts
      score.ts
      gates.ts
      decision.ts
      reason-codes.ts
  research/
    orchestrator.ts
    discovery.ts
    comparison.ts
    persistence.ts
  killswitch/
    checks.ts
    challenge-schema.ts
    validator.ts
  thesis/
    build.ts
    receipt.ts
    invalidation.ts
    diff.ts
  practice/
    portfolio.ts
    positions.ts
  ai/
    provider.ts
    explanations.ts
    challenge-normalizer.ts
  db/
    schema.ts
    queries.ts
    migrations/
tests/
  strategy/
  normalizer/
  replay/
  integration/
```

## 6. RYO adapter boundary

The rest of the application must never depend directly on RYO raw response shapes. The current server-side adapter uses only the tools discovered from the live MCP boundary:

- `market_overview`
- `scan_market`
- `analyze_token`
- `deep_analysis`
- `compare_tokens`
- `monitor_market_sentiment_shift`

`check_safety` and `supported_tokens` are not currently discovered live tools and are not assumed by the implementation. The adapter validates discovered input schemas and preserves missing output fields as `UNKNOWN` rather than guessing mappings.

### 6.1 Provenance envelope

Every call returns a provenance envelope with status, data or `null`, request and completion timestamps, source/tool identity and diagnostics.

```ts
export type ProviderStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'INVALID_RESPONSE';

export interface ProvenanceEnvelope<T> {
  status: ProviderStatus;
  data: T | null;
  provider: 'ryo' | 'narrative';
  tool: string;
  requestedAt: string;
  completedAt: string;
  staleAt?: string;
  diagnostics?: string[];
}
```

A missing or unavailable value must remain distinguishable from a neutral value.

### 6.2 Published-tool versus live-tool boundary

Public RYO material may contain historical or inconsistent tool enumerations. The current repository treats authenticated MCP discovery as authoritative. The latest live list contains six tools: `market_overview`, `scan_market`, `analyze_token`, `deep_analysis`, `compare_tokens` and `monitor_market_sentiment_shift`. Public-only names are not presented as live capabilities.

Official source: [RYO-CHAN Hackathon 2026](https://ryobuild.com/hackathon)

## 7. Raw versus normalised evidence

Persist both layers:

```text
RAW PROVIDER RESPONSE → NORMALISED EVIDENCE → DECISION
```

If a mapping bug is discovered, the original evidence remains available for replay and audit. Raw provider responses must be sanitised before persistence and must never contain credentials.

## 8. Core data model

| Entity | Purpose |
|---|---|
| `ResearchRun` | Immutable bounded orchestration result; durable persistence and restart recovery remain roadmap work. |
| `RawToolResult` | Exact sanitised provider response plus provenance. |
| `EvidenceSnapshot` | One coherent evidence state used for a decision. |
| `EvidenceItem` | Normalised dimension, stance, source, reason code and observation time. |
| `CandidateSet` | Assets considered during Opportunity Cost. |
| `CandidateEvaluation` | Per-candidate directional, risk, coverage and conflict outcome. |
| `StrategyVersion` | DM-1 parameters and immutable version identifier. |
| `Thesis` | Lifecycle identity and current status. |
| `ThesisVersion` | Append-only decision/evidence version. |
| `KillSwitchRun` | Challenges, validation and outcome. |
| `InvalidationRule` | Precommitted condition and rule code. |
| `InvalidationEvent` | Later firing of a precommitted condition. |
| `Receipt` | Canonical structured state plus hash. |
| `PracticePosition` | Fixed-size simulated position. |
| `SocialChallenge` | Human counterclaim, normalised claim, research result and effect. |

### 8.1 Thesis versioning

Separate `Thesis` identity from `ThesisVersion`. A refresh never overwrites an old decision. Each version stores:

- Evidence snapshot identity.
- Strategy version.
- Decision and direction.
- Directional score.
- Thesis Strength.
- Coverage and conflict.
- Risk and regime fit.
- Explanation.
- Receipt hash.
- Creation timestamp.

## 9. Research state machine

The roadmap state machine is:

```text
CREATED → MARKET_CONTEXT → DISCOVERY → COMPARISON
→ DEEP_RESEARCH → NORMALISING → PROVISIONAL → KILLSWITCH
→ COMMITTED / ABSTAINED
```

Current v1 executes one bounded request and returns an immutable `ResearchRun` result. It does not persist stages, resume after restart, or schedule background work. Those are roadmap concerns, not current product claims.

## 10. Autonomous research funnel

The shipped Track 1 v1 is deliberately bounded:

| Step | Action |
|---:|---|
| 1 | Use a LIVE RYO provider or an explicitly labeled REPLAY provider. |
| 2 | Fetch market context and preserve partial/unavailable status. |
| 3 | Discover and consider at most three provider candidates. |
| 4 | Research each candidate through the provider abstraction and normalize observed evidence. |
| 5 | Run DM-1 for every candidate. |
| 6 | Use `selectAutonomousCandidate()` for deterministic ranking, relative margin and `ABSTAIN`. |
| 7 | Apply the supplied approved Playbook through Preflight. |
| 8 | Run the deterministic KillSwitch before any simulated commitment. |
| 9 | Optionally create a simulated practice position and canonical Decision Receipt. |

No LLM chooses the market decision. Missing provider evidence remains `UNKNOWN`; a degraded LIVE provider produces an honest degraded/abstaining result rather than a fixture fallback.

## 11. User-directed research

For a request such as “Should I LONG SOL?”, SOL remains the primary target, but the system still discovers alternatives and performs relative comparison. It returns the DM-1 judgement for SOL and may note that another asset currently ranks more strongly.

If comparison is unavailable, Krineo cannot establish opportunity cost and must not manufacture a relative conclusion.

## 12. DM-1 decision engine

The engine must be a pure deterministic function:

```text
EvidenceSnapshot + CandidateEvaluations + DM1Policy → DecisionResult
```

There is no LLM call inside it.

| Policy | V1 value |
|---|---:|
| Direction threshold | `±60` |
| Minimum coverage | `80%` |
| Maximum conflict | `30%` |
| Minimum relative edge | `5 points` |
| Momentum weight | `30` |
| Technical confluence | `20` |
| Relative opportunity | `20` |
| Market alignment | `15` |
| Sentiment / derivatives | `15` |
| Narrative directional weight | `0` |

Narrative may contextualise or challenge a thesis in v1; it does not directly add directional points.

Hard vetoes include safety failure or unknown, insufficient required evidence, high conflict, extreme volatility, required risk unknown, regime mismatch and critical KillSwitch unknown. All are versioned policy parameters, not claims of empirically optimised profitability.

## 13. Coverage, conflict and Thesis Strength

- **Coverage** = available directional weight / total directional weight.
- `UNKNOWN` lowers coverage and is never treated as neutral.
- **Conflict** = opposing weighted evidence / supporting plus opposing weighted evidence, viewed from the proposed thesis direction.
- **Thesis Strength** = absolute directional score × coverage for an eligible directional thesis.
- Conflict remains separately visible and can hard-veto above policy threshold.
- Risk and safety remain separate from directional scoring.

## 14. Deterministic reason codes

Suggested reason codes:

```text
STRONG_DIRECTIONAL_MOMENTUM
TECHNICAL_CONFLUENCE_SUPPORTIVE
RELATIVE_OPPORTUNITY_WINNER
MARKET_ALIGNMENT_SUPPORTIVE
INSUFFICIENT_DIRECTIONAL_EVIDENCE
HIGH_EVIDENCE_CONFLICT
INSUFFICIENT_COVERAGE
REQUIRED_EVIDENCE_UNAVAILABLE
EXTREME_VOLATILITY
REGIME_MISMATCH
SAFETY_VETO
SAFETY_EVIDENCE_UNAVAILABLE
NO_CLEAR_RELATIVE_WINNER
NARRATIVE_OVERHEATING
FRAGILE_EVIDENCE_BASE
```

## 15. KillSwitch design

KillSwitch has two layers:

1. An LLM challenge generator proposes a structured claim referencing evidence IDs.
2. A deterministic validator checks whether those IDs and states support the claim and whether DM-1 classifies it as no effect, caution/evidence correction or hard veto.

```ts
export type KillSwitchVerdict = 'CLEAR' | 'CAUTION' | 'VETO' | 'UNKNOWN';

export interface StructuredChallenge {
  claim: string;
  evidenceIds: string[];
  challengeType:
    | 'DIRECTION_CONTRADICTION'
    | 'SINGLE_SOURCE_FRAGILITY'
    | 'REGIME_CONFLICT'
    | 'RELATIVE_OPPORTUNITY_FAILURE'
    | 'RISK_INCOMPATIBILITY'
    | 'SAFETY_FAILURE'
    | 'NARRATIVE_DISTORTION'
    | 'MISSING_CRITICAL_EVIDENCE';
}
```

The validator may trigger a complete deterministic recomputation. It may not mutate scores directly.

## 16. Invalidation engine

- Direction loss: a `LONG` falls below `+60`, or a `SHORT` rises above `-60` → `WEAKENED`; the paper position may close.
- Direction reversal: `LONG` reaches `≤ -60`, or `SHORT` reaches `≥ +60` → `INVALIDATED`.
- Hard-gate failure on refresh → `INVALIDATED`.
- Another asset becoming better does not automatically invalidate an existing thesis; flag `OPPORTUNITY_COST_DIVERGENCE`.
- Every invalidation event stores the rule code, old evidence references, new evidence references and result.

## 17. Strategy Diff

A pure comparison function takes Snapshot A and Snapshot B and returns:

- Dimension changes.
- Newly missing evidence.
- Newly available evidence.
- Score before and after.
- Decision before and after.
- Triggered invalidation rules.
- Candidate ranking changes.
- Provenance changes.

The LLM only explains that object in natural language. It does not determine what changed.

## 18. Receipt integrity

Canonicalise and SHA-256 hash structured state containing:

- Thesis and version IDs.
- Asset and decision.
- Strategy and normaliser versions.
- Evidence snapshot hashes.
- Candidate ranking.
- Score, coverage and conflict.
- KillSwitch outcome.
- Invalidation rules.
- Timestamp.

Do not hash arbitrary generated prose. Wording changes must not alter the logical decision receipt.

## 19. Practice position

Fixed simulated portfolio:

- Total paper portfolio: `$10,000`.
- Notional per directional thesis: `$1,000`.
- No leverage.
- No exchange or wallet execution.

Store:

- Asset.
- Direction.
- Notional.
- Entry price and time.
- Optional exit price and time.
- Status.
- Close reason.

P&L is contextual only.

## 20. API surface

Current application surfaces:

```text
POST /api/research/run
GET  /api/skills/
GET  /api/skills/strategy_preflight
POST /api/skills/strategy_preflight/invoke
```

Internal deterministic demo surfaces:

```text
POST /api/demo/commit
POST /api/demo/refresh
```

The current research endpoint returns one bounded run result. Durable run polling, thesis CRUD routes, database persistence and background scheduling remain roadmap items. This is not a public trading API.

## 21. Failure policy

The following is the target failure policy. Current v1 applies it within one bounded in-memory run; database persistence, restart recovery and optional narrative providers are roadmap concerns.

| Failure | Behaviour |
|---|---|
| Narrative/news unavailable | Continue; `Narrative: UNKNOWN`; coverage may become partial. |
| Optional sentiment missing | Continue only if coverage remains `≥80%` and required dimensions exist. |
| Safety unavailable | `ABSTAIN`. |
| Comparison unavailable during autonomous discovery | `ABSTAIN`; opportunity cost cannot be established. |
| AI unavailable | No AI provider is required by current v1; keep deterministic state and structured reasons. |
| Database commit failure | Roadmap persistence must not commit a thesis or open a practice position. |
| Cached provider result | If a future cache is used, show an explicit stale timestamp and status. |
| Provider rate limit or timeout | Return typed failure and diagnostics in the run result; never substitute placeholder data. |

## 22. Frontend requirements

- Agent Workspace with visible research stages.
- Opportunity Comparison with rejected candidates and `ABSTAIN`.
- Provisional Thesis with `Why`, `What worries us`, `Invalidation` and `Alternatives`.
- KillSwitch challenge interface.
- Permanent Thesis Receipt.
- Active Thesis Dashboard with `Needs Attention`.
- Strategy Diff `THEN vs NOW`.
- `strategy_preflight` developer surface and structured invocation.
- Evidence freshness and status visible everywhere.
- Keyboard-reachable flows.
- Visible focus states.
- Semantic headings and buttons.
- No state communicated by colour alone.
- Clear simulated-position labelling.
- No decorative chart wall that hides the decision path.

## 23. Product acceptance criteria

- A LIVE RYO run can produce structured evidence when the provider returns usable data; a REPLAY run is labeled and reproducible, and degraded LIVE data never becomes fabricated evidence.
- The same evidence snapshot plus the same strategy version produces the same deterministic decision.
- A missing mandatory source can never be interpreted as neutral.
- `ABSTAIN` is returned for weak direction, high conflict, insufficient coverage, safety failure or unknown, extreme risk or regime mismatch.
- Autonomous discovery preserves rejected alternatives and requires a clear relative winner.
- KillSwitch cannot directly edit a score or bypass policy.
- Committed thesis versions are append-only.
- Refresh creates a new evidence snapshot and new thesis version.
- Strategy Diff identifies exact evidence-state changes and fired invalidation rules.
- Practice positions are clearly simulated and never call a trading or execution API.
- Production cannot silently use test fixtures as live data.
- No real API keys or team tokens are committed; `.env.example` contains only `RYO_MCP_KEY=` and `RYO_MCP_URL=` names.
- Stale, partial, rate-limited and unavailable states remain visible.

## 24. Testing plan

| Fixture / test | Expected result |
|---|---|
| Coherent bullish evidence | `LONG` |
| Coherent bearish evidence | `SHORT` |
| Weak evidence | `ABSTAIN` |
| High conflict | `ABSTAIN` |
| Missing safety | `ABSTAIN` |
| Partial optional evidence with coverage `≥80%` | Directional decision still possible |
| Relative tie under 5 points | `ABSTAIN / NO_CLEAR_RELATIVE_WINNER` |
| Regime mismatch | `ABSTAIN` |
| Same snapshot plus same strategy version replay | Identical deterministic output |
| Unsupported KillSwitch challenge | No score change |
| KillSwitch evidence correction | Full decision recomputation |
| Refresh | Old version remains; new version appended |
| Identical canonical receipt state | Stable hash |
| Provider timeout | Typed failure; no fabricated evidence |
| Database commit failure | No receipt and no practice position |

## 25. Development fixtures and demo integrity

Fixtures are used for deterministic tests and the labeled REPLAY/demo paths. The current UI labels fixture provenance and does not present it as LIVE RYO data. Any future production deployment must keep fixture/replay mode explicit and must not silently substitute it for a degraded LIVE provider.

## 26. Environment variables

Current server-only RYO configuration:

```text
RYO_MCP_KEY=
RYO_MCP_URL=
```

Both names are placeholders only. Never create `NEXT_PUBLIC_RYO_MCP_KEY`, expose either value to client components, or place credentials in screenshots, logs or the repository. AI providers, databases and public deployment variables are roadmap/deployment concerns and are not current product dependencies.

## 27. Build order

This is the historical implementation roadmap. Current v1 is fixture-backed in the UI, has a bounded LIVE/REPLAY research path, and does not include database persistence, restart recovery, background scheduling or real execution.

| Phase | Scope | Exit condition |
|---|---|---|
| **P0 Foundation** | App, core types, DM-1 config, test runner. | Build passes; tests execute. Database persistence remains roadmap-only. |
| **P1 Decision Engine** | Score, coverage, conflict, gates, relative winner and `ABSTAIN` using fixtures. | All deterministic scenarios pass. |
| **P2 RYO Adapter** | Discovered-tool wrappers, sanitization and typed failures. | Authentication/discovery work; current provider health is explicit. |
| **P3 Normaliser** | Map observed RYO fields into semantic evidence. | Missing/unobserved fields remain `UNKNOWN`; current asset-level availability is externally degraded. |
| **P4 Orchestrator** | Bounded LIVE/REPLAY context, scan, candidate research, DM-1, selection, Preflight, KillSwitch and optional simulated commit. | `runResearch()` returns an inspectable autonomous research result. |
| **P5 Thesis + KillSwitch** | Provisional decision, explanation, structured challenge and validation. | Usable LIVE or labeled REPLAY run produces final `LONG / SHORT / ABSTAIN` when gates allow. |
| **P6 Receipt** | Versioning, canonical JSON, hash and simulated practice position. | Canonical receipt and simulated position are returned; database reload is roadmap-only. |
| **P7 Refresh / Diff** | Fresh evidence, v2, diff and invalidation. | Deterministic demo preserves old/new versions with causal diff. |
| **P8 Core UI** | Fixture-backed workspace, comparison, KillSwitch, receipt, dashboard and diff. | Complete deterministic demo loop is usable. |
| **P9 Narrative** | Optional Tavily integration and degraded behaviour. | Narrative Gap works without becoming required. |
| **P10 Track 3** | `strategy_preflight` definition and invocation surface. | Reusable deterministic skill validates independently; official external registration remains subject to the submission contract. |
| **P11 Social Challenge** | Human challenge flow. | Challenge can research and create a future version. |
| **P12 Reliability** | Restart, idempotency, accessibility, secrets audit and demo polish. | Submission-ready. |

## 28. Four-day schedule

The schedule below is an execution model for the supplied hackathon window. Confirm all final dates and terms in the official submission portal.

| Date | Priority | End state |
|---|---|---|
| **Sep 4** | Foundation, DM-1 deterministic engine and exact RYO schema inspection. | Structured fixture evidence reliably produces decisions. |
| **Sep 5** | RYO adapter, normaliser, research orchestrator and KillSwitch. | One complete real-data run commits a thesis. |
| **Sep 6** | Receipt, practice position, refresh, Strategy Diff, invalidation and core UI. | Killer demo loop works. |
| **Sep 7** | Narrative Gap, Track 3 skill, human challenge if time, failure UX, hashing, accessibility and polish. | Backup demo recorded. |
| **Sep 8** | No major features: bugs, README, `.env.example`, form PDF, repo cleanup, video, X post, secrets audit and early submission. | Submission package is clean. |

The official page lists the submission deadline as **September 8, 2026 at 23:59 JST**, equivalent to **15:59 WAT**.

## 29. Cut order

If time slips, cut in this order:

1. Fork Thesis.
2. Public social feed.
3. On-chain receipt anchoring.
4. Human Challenge UI.
5. Narrative Gap.

Do not cut:

- Opportunity Cost.
- `ABSTAIN`.
- KillSwitch.
- Thesis Receipt.
- Refresh.
- Strategy Diff.
- Invalidation.
- Usable LIVE RYO evidence when the provider supplies it, with labeled REPLAY for deterministic demo/test reliability.
- Failure awareness.

## 30. RYO-CHAN judging alignment

The official hackathon page describes a score composed of common criteria plus a track-specific rubric.

### Common criteria — 40 points

- Combining sources — 20 points.
- Coping with failure — 20 points.

### Track 1 — Autonomous Agents — 60 points

- Real thinking — 25 points.
- Cause and effect — 20 points.
- Repeatability — 10 points.
- Advanced execution — 5 points.

### Track 2 — Dashboards & Interfaces — 60 points

- Easy to read — 25 points.
- Sorted by importance — 25 points.
- Works for everyone — 10 points.

### Track 3 — New Skills — 60 points

The shipped Krineo skill is `strategy_preflight`: a deterministic, read-only guardrail evaluation over caller-supplied normalized market context and an approved Playbook. Any `challenge_thesis` concept in earlier planning is ROADMAP/HISTORICAL, not the current shipped contract.

- Fills a gap — 25 points.
- Follows the specification — 15 points.
- Could we use it — 20 points.

### What Krineo must make obvious

- A visible path from evidence to conclusion.
- A product a judge can understand, run and evaluate quickly.
- A clear user and a decision worth improving.
- Original work that uses RYO as a foundation rather than as a logo.
- Honest recovery when a provider is rate-limited, restarted or unavailable.

### What Krineo must not optimise for

- API-call volume.
- A wall of charts without an argument.
- Short-term P&L.
- Fabricated or placeholder data presented as real.

## 31. Submission checklist

The official page says a complete submission includes:

- All final source code pushed to the main branch of the private repository.
- An `.env.example` template containing required environment-variable names but no secrets.
- The completed Project Submission Form PDF committed to the repository.
- A demo video showing the finished project and key features, attached or linked.
- A public X post about the BUIDL, tagging `@ryodigital`, showing what was built and why it matters, linking the project or demo, with the post URL added to the submission before judging.

Additional integrity rules:

- Committing a real API key or team token is a disqualification.
- Presenting fabricated or placeholder data as real is a disqualification.
- Existing libraries and starter templates are allowed when disclosed in the README; project code must be written during the event.
- RYO research tools are read-only. Practice trades and strategy state live on the builder’s side.
- A BUIDL may enter more than one track, and a team may submit more than one BUIDL. Each entered track is judged independently.

## 32. Definition of done

Krineo is done for the hackathon when:

- A user asks the agent to find or analyse an opportunity.
- LIVE RYO evidence is gathered with visible provenance and status when available; REPLAY is labeled and degraded evidence is not fabricated.
- Multiple candidates are compared.
- The system returns a deterministic `LONG`, `SHORT` or `ABSTAIN`.
- KillSwitch challenges the provisional thesis.
- A permanent receipt preserves evidence, contradictions, policy and invalidation rules.
- A simulated practice position is optionally opened.
- Refresh retrieves new evidence and creates a new version.
- Strategy Diff explains what changed and why it mattered.
- A precommitted invalidation rule can weaken or invalidate the thesis.
- Old and new versions remain inspectable.
- Missing or degraded evidence is never silently fabricated.
- The repository, README, demo video, form PDF, `.env.example` and X post satisfy the submission requirements.

## 33. Remaining external dependency

The remaining external dependencies are upstream RYO asset-level availability and any official external Track 3 registration/submission requirements. The current MCP input contract is discovered at runtime and the shipped `strategy_preflight` route is independently validated. Output fields not observed from RYO remain unmapped and therefore `UNKNOWN`.

If provider availability improves, follow-up work should concentrate in `lib/ryo` and the raw-to-normalised evidence mapper. The core Krineo policy should remain stable.

## 34. Source boundary

This Markdown document is an editable Krineo replacement created from the user-supplied `ryo_architecture_prd_build_plan.pdf` and the official hackathon page inspected during this task.

Official source: [RYO-CHAN Hackathon 2026](https://ryobuild.com/hackathon)

The original PDF remains unchanged. No secrets, API keys, tokens, passwords, wallet credentials or private keys are included here.
