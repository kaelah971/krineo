---
name: Krineo
document: Technical Architecture, Product Requirements and Build Plan
version: 1.0
status: Hackathon MVP source of truth
category: Accountable AI market reasoning
hackathon: RYO-CHAN Hackathon 2026
---

# Krineo — Architecture, PRD & Build Plan

**Implementation source of truth for the RYO-CHAN Hackathon 2026 product.**  
**Architecture principle: Rules decide. Models explain.**

## 1. Delivery objective

Ship a single web application in which real RYO research is converted into structured evidence, passed through the deterministic DM-1 policy, adversarially challenged, committed as a versioned Thesis Receipt, and later refreshed to produce a Strategy Diff and invalidation outcome.

The smallest complete loop is:

```text
User intent → durable research run → live RYO evidence
→ normalised evidence → candidate comparison → DM-1 decision
→ KillSwitch → Thesis Receipt → refresh → Strategy Diff
```

The application must make the full loop inspectable. A static dashboard, a chat wrapper, or a paper-trading screen without evidence provenance is not a complete Krineo submission.

## 2. Product requirements document

### 2.1 Product definition

Krineo is an accountable AI market-reasoning system. It researches live crypto markets through the RYO read-only research layer, compares candidates and `ABSTAIN`, produces a deterministic `LONG / SHORT / ABSTAIN` decision, lets KillSwitch challenge that decision, and preserves a versioned receipt that explains future changes.

### 2.2 Primary user

A technically curious crypto market participant, researcher, builder or analyst who wants an AI agent to help form a market thesis without accepting an uninspectable recommendation.

### 2.3 Secondary users

- Hackathon judges evaluating evidence, reasoning and system quality.
- Developers inspecting the adapter and reusable `challenge_thesis` skill.
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
| **Database** | Durable research stages, raw/normalised evidence, candidate sets, thesis versions, receipts, challenges and paper positions. |

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

The rest of the application must never depend directly on RYO raw response shapes. The gateway exposes conceptual methods for:

- `supported_tokens`
- `market_overview`
- `scan_market`
- `analyze_token`
- `deep_analysis`
- `compare_tokens`
- `check_safety`

Exact arguments and raw response interfaces are populated from the official Builder Guide when available.

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

### 6.2 Published-tool ambiguity

The official RYO-CHAN page describes a “six read-only research tools” surface while enumerating seven identifiers, including `supported_tokens`. The implementation must follow the official Builder Guide and actual API/MCP schema. Do not create guessed fields to make the count fit.

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
| `ResearchRun` | Durable orchestration state and restart recovery. |
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

```text
CREATED → MARKET_CONTEXT → DISCOVERY → COMPARISON
→ DEEP_RESEARCH → NORMALISING → PROVISIONAL → KILLSWITCH
→ COMMITTED / ABSTAINED
```

Every completed stage is persisted. A restart resumes from the last durable stage. External stage operations use idempotency keys derived from:

```text
researchRunId + stage + asset
```

Completed work must not be blindly repeated.

## 10. Autonomous research funnel

| Step | Action |
|---:|---|
| 1 | Validate supported token universe. |
| 2 | Fetch market overview. |
| 3 | Scan market and shortlist approximately eight candidates. |
| 4 | Compare approximately four candidates. |
| 5 | Run token analysis for shortlisted candidates. |
| 6 | Run deep analysis for approximately two finalists. |
| 7 | Run required safety checks. |
| 8 | Normalise evidence and evaluate DM-1. |
| 9 | Select a winner only if it clears absolute and relative policy; otherwise return `ABSTAIN`. |

The numbers are orchestration defaults, not a claim that more API calls score better. The RYO judging page explicitly values a visible path from evidence to conclusion over API-call volume.

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

```text
POST /api/research              create durable run and return runId
GET  /api/research/:id          progress and state
POST /api/theses/:id/commit     commit provisional thesis
GET  /api/theses                list thesis identities and current state
GET  /api/theses/:id            inspect current thesis and versions
POST /api/theses/:id/refresh    create a new evidence snapshot/version
GET  /api/theses/:id/diff       return structured Strategy Diff
POST /api/theses/:id/challenges submit human challenge
GET  /api/practice              list simulated positions
GET  /api/system/status         provider and application health
```

The browser must never hold a monolithic 45-second request while every provider runs. `POST /api/research` returns immediately. The UI polls or subscribes to the durable research run and renders stage progress.

## 21. Failure policy

| Failure | Behaviour |
|---|---|
| Narrative/news unavailable | Continue; `Narrative: UNKNOWN`; coverage may become partial. |
| Optional sentiment missing | Continue only if coverage remains `≥80%` and required dimensions exist. |
| Safety unavailable | `ABSTAIN`. |
| Comparison unavailable during autonomous discovery | `ABSTAIN`; opportunity cost cannot be established. |
| AI unavailable | Keep deterministic state; degrade explanation and challenge generation. |
| Database commit failure | Do not commit thesis or open paper position. |
| Cached provider result | Show only with explicit stale timestamp and status. |
| Provider rate limit or timeout | Persist typed failure and diagnostics; never substitute placeholder data. |

## 22. Frontend requirements

- Agent Workspace with visible research stages.
- Opportunity Comparison with rejected candidates and `ABSTAIN`.
- Provisional Thesis with `Why`, `What worries us`, `Invalidation` and `Alternatives`.
- KillSwitch challenge interface.
- Permanent Thesis Receipt.
- Active Thesis Dashboard with `Needs Attention`.
- Strategy Diff `THEN vs NOW`.
- Challenge Thesis UI if P1 time allows.
- Evidence freshness and status visible everywhere.
- Keyboard-reachable flows.
- Visible focus states.
- Semantic headings and buttons.
- No state communicated by colour alone.
- Clear simulated-position labelling.
- No decorative chart wall that hides the decision path.

## 23. Product acceptance criteria

- A real RYO-backed run can produce structured evidence without fabricated fields.
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
- No real API keys or team tokens are committed; `.env.example` contains names only.
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

Fixtures are allowed only for tests and development and must be clearly separated from production. Add an environment guard that makes fixture mode unavailable in production.

The demo must label live, stale, partial and unavailable evidence accurately. Placeholder data must never be passed off as real.

## 26. Environment variables

Expected categories:

```text
RYO_BASE_URL=[set from official guide]
RYO_AUTH=[set from official guide; server-side only]
AI_PROVIDER_KEY=[server-side secret]
TAVILY_API_KEY=[optional server-side secret]
DATABASE_URL=[managed database connection]
PUBLIC_APP_URL=[public application URL]
```

The exact RYO variable names remain intentionally unspecified until the official contract is supplied. Do not commit real values. Do not place secrets in client bundles, screenshots, logs or the repository.

## 27. Build order

| Phase | Scope | Exit condition |
|---|---|---|
| **P0 Foundation** | App, database, core types, DM-1 config, test runner. | Build passes; tests execute. |
| **P1 Decision Engine** | Score, coverage, conflict, gates, relative winner and `ABSTAIN` using fixtures. | All deterministic scenarios pass. |
| **P2 RYO Adapter** | Official tool wrappers, raw persistence and typed failures. | Required live calls work and persist. |
| **P3 Normaliser** | Map raw RYO fields into semantic evidence. | One live asset snapshot enters DM-1. |
| **P4 Orchestrator** | Context, scan, shortlist, compare, deep research, safety and persistence. | Prompt produces an autonomous candidate set. |
| **P5 Thesis + KillSwitch** | Provisional decision, explanation, structured challenge and validation. | Real-data run produces final `LONG / SHORT / ABSTAIN`. |
| **P6 Receipt** | Versioning, canonical JSON, hash and practice position. | Permanent receipt reloads from the database. |
| **P7 Refresh / Diff** | Fresh evidence, v2, diff and invalidation. | Old/new versions survive with causal diff. |
| **P8 Core UI** | Agent, comparison, KillSwitch, receipt, dashboard and diff. | Complete demo loop is usable. |
| **P9 Narrative** | Optional Tavily integration and degraded behaviour. | Narrative Gap works without becoming required. |
| **P10 Track 3** | `challenge_thesis` against the official RYO skill specification. | Reusable skill validates independently. |
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
- Real RYO evidence.
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
- Real RYO evidence is gathered with visible provenance and status.
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

The major unresolved integration detail is the exact field-level RYO Builder Guide and tool contract. Public material verifies the published research surface, read-only behaviour and failure-provenance expectations, but exact request payloads, response fields, rate-limit semantics and the Track 3 specification must be mapped from the official guide rather than guessed.

Once supplied, implementation work should concentrate in `lib/ryo` and the raw-to-normalised evidence mapper. The core Krineo policy should remain stable.

## 34. Source boundary

This Markdown document is an editable Krineo replacement created from the user-supplied `ryo_architecture_prd_build_plan.pdf` and the official hackathon page inspected during this task.

Official source: [RYO-CHAN Hackathon 2026](https://ryobuild.com/hackathon)

The original PDF remains unchanged. No secrets, API keys, tokens, passwords, wallet credentials or private keys are included here.
