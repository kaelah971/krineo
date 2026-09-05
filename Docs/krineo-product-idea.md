---
name: Krineo
document: Product Idea
version: 1.0
status: Hackathon MVP
category: Accountable AI market reasoning
hackathon: RYO-CHAN Hackathon 2026
---

# Krineo — Accountable AI Market Reasoning

**Product idea and strategic product brief**  
**RYO-CHAN Hackathon 2026 · September 2026**

## 1. Executive summary

Krineo is a social market-reasoning system where AI agents research live crypto markets, compare opportunities, create practice-trading theses, adversarially challenge their own reasoning, preserve exactly what they believed, and visibly explain why they change their minds when market evidence changes.

Most AI trading products optimise for **“tell me what to buy.”** Krineo optimises for the strongest defensible judgement—including **no trade**—and makes the agent accountable for that judgement.

The product is deliberately not a brokerage, exchange, custody layer or autonomous fund:

- No real-money trading is required. All positions are practice or paper positions.
- The core output is not a price prediction. It is a versioned, evidence-backed market thesis.
- `LONG`, `SHORT` and `ABSTAIN` are equal first-class decisions.
- Contradictory, stale and unavailable evidence remain visible.
- A committed thesis cannot quietly rewrite its history.
- The system is designed to enter RYO Tracks 1 and 2 strongly, with a reusable `challenge_thesis` skill as a Track 3 extension.

## 2. One-sentence product definition

> **Krineo turns live market research into a thesis that can be compared, challenged, committed, monitored and defended.**

## 3. The problem

AI market agents can sound confident without showing whether a conclusion came from one signal or several independent pieces of evidence. They can also regenerate a different answer later without preserving what they previously believed.

For a user, that creates an accountability problem:

- What evidence mattered?
- What evidence disagreed?
- Why did this asset beat the alternatives?
- What would make the agent change its mind?
- Is the agent genuinely updating, or quietly rewriting its story after the fact?
- Was a missing source treated honestly, or silently turned into a neutral assumption?

Krineo turns those missing pieces into the experience itself.

## 4. Product thesis

Krineo is built around the lifecycle of an AI market belief rather than around a one-off trade recommendation.

```text
DISCOVER → RESEARCH → COMPARE → CHALLENGE → DECIDE → COMMIT
→ MONITOR → DIFF → ADAPT / INVALIDATE → REPUTATION
```

The agent is not rewarded for trading frequently. `ABSTAIN` is good judgement whenever evidence is weak, conflicting, incomplete, stale, unsafe, or not meaningfully better than doing nothing.

The product’s central design principle is:

> **Rules decide. Models explain.**

The language model may parse intent, synthesise evidence and propose a structured challenge. It may not invent missing evidence, override hard gates, change scores by persuasion, or rewrite a committed reasoning trail.

## 5. What Krineo actually does

A user can ask Krineo to:

- Analyse a specific supported token.
- Compare several assets.
- Find the strongest defensible opportunity in a defined universe.
- Explain why a previous thesis weakened or became invalid.
- Challenge an existing thesis with a counterclaim.

Krineo combines RYO market research, relative comparison, technical evidence, risk and safety evidence, and optional external narrative context. It converts those inputs into structured evidence states and applies a versioned deterministic policy.

The result is not a command to buy or sell. It is a transparent decision state with a visible evidence path.

## 6. The thesis lifecycle

| Stage | What happens | User-visible output |
|---|---|---|
| **Discover** | RYO market scanning identifies assets worth investigating. | Candidate universe and scan provenance. |
| **Research** | Market context, token analysis, deeper technical/derivatives evidence and safety are collected. | Evidence items with source, freshness and status. |
| **Compare** | The target is evaluated against realistic alternatives and against `ABSTAIN`. | Ranked candidate set and opportunity-cost explanation. |
| **Challenge** | KillSwitch searches for the strongest evidence-based objection to the provisional thesis. | `CLEAR`, `CAUTION`, `VETO` or `UNKNOWN`. |
| **Decide** | Deterministic policy returns `LONG`, `SHORT` or `ABSTAIN`. | Decision, score, gates and reason codes. |
| **Commit** | Evidence snapshot, strategy version, contradictions, invalidation rules and decision are frozen. | Versioned Thesis Receipt. |
| **Monitor** | The thesis is refreshed against new live evidence. | Current status and freshness. |
| **Diff** | The system compares the original state with the new state at evidence level. | `THEN → NOW` causal change view. |
| **Adapt / invalidate** | Predeclared rules determine whether the thesis stays active, weakens, invalidates or closes. | Lifecycle event and rule explanation. |
| **Social** | Other users submit challenges that must be researched before affecting a future version. | Researched challenge and effect on next version. |

A refresh never edits the old receipt. It creates a new version.

## 7. The central artifact: Thesis Receipt

Every committed market judgement becomes a permanent, versioned **Thesis Receipt**. This is the object users share, challenge, inspect and revisit.

A receipt contains:

- Asset and decision: `LONG`, `SHORT` or `ABSTAIN`.
- Thesis Strength, explicitly defined as evidence coherence—not probability of profit.
- Evidence strength, conflict, coverage, risk and regime fit.
- Supporting evidence and contradicting evidence.
- Alternatives considered and why they were rejected.
- KillSwitch challenges and their validated effects.
- Precommitted invalidation conditions.
- Evidence provenance and freshness.
- Strategy and normalizer versions.
- Timestamp and observation times.
- A hash of the canonical structured receipt state.
- Lifecycle status: `ACTIVE`, `WEAKENED`, `INVALIDATED`, `CLOSED` or `ABSTAINED`.

The receipt is designed to be understandable in a public view without exposing secrets or pretending that a paper result proves profitability.

## 8. Opportunity cost is a first-class input

Krineo never assumes that a token is attractive merely because a user asked about it. It asks the harder question:

> **Even if this asset looks decent, is it actually the strongest defensible choice among realistic alternatives—including doing nothing?**

`ABSTAIN` is effectively another candidate. If no token clears the strategy threshold, or if the top candidates are too close to call, `ABSTAIN` wins.

### Example comparison

| Candidate | Evidence | Conflict | Risk | Coverage | Outcome |
|---|---|---|---|---|---|
| SOL | Strong | Moderate | Acceptable | Complete | Selected |
| LINK | Moderate | Moderate | Elevated | Complete | Rejected |
| BTC | Mixed | Low | Acceptable | Partial | Rejected |
| ETH | Weak | High | Acceptable | Complete | Rejected |
| `ABSTAIN` | — | — | — | — | Rejected only if a candidate clears policy |

The UI must preserve rejected alternatives. A winner without the rejected set is not a defensible decision.

## 9. KillSwitch: adversarial review before commitment

Before a provisional thesis becomes official, **KillSwitch** attacks it. This is not an LLM being told to disagree for entertainment. It proposes structured challenges and a deterministic validator checks whether those challenges are supported by evidence or strategy rules.

### Challenge classes

- **Direction contradiction:** meaningful evidence opposes the proposed direction.
- **Single-source fragility:** the thesis collapses if one evidence family disappears.
- **Regime conflict:** the market environment no longer fits the strategy.
- **Relative-opportunity failure:** another candidate is materially stronger.
- **Risk incompatibility:** volatility or risk exceeds policy.
- **Safety failure:** safety evidence fails or mandatory evidence is unavailable.
- **Narrative distortion:** public narrative is doing more work than market evidence.
- **Missing critical evidence:** a required decision input cannot be evaluated.

### KillSwitch verdicts

| Verdict | Meaning |
|---|---|
| `CLEAR` | No material supported issue was found. |
| `CAUTION` | A supported concern exists, but policy still passes. |
| `VETO` | A hard rule fails after adversarial review. |
| `UNKNOWN` | A critical challenge cannot be evaluated because evidence is missing or unavailable. |

KillSwitch cannot arbitrarily subtract points. Any score change must come from a validated evidence correction followed by a full deterministic recomputation.

## 10. Strategy Diff and the regime breaker

When a thesis is refreshed, Krineo does not simply generate another opinion. It compares the original structured evidence with the new evidence and shows the causal change.

| Dimension | Then | Now |
|---|---|---|
| Momentum | Supportive | Opposing |
| Market regime | Supportive | Neutral |
| Volatility | Acceptable | Elevated |
| Narrative gap | Low | High |
| Coverage | Complete | Complete |

The UI connects cause to effect:

```text
Directional reversal + regime deterioration
→ precommitted invalidation rule triggered
→ Thesis Strength 71 → 38
→ LONG becomes INVALIDATED
```

The old receipt remains intact. The user can inspect exactly what changed rather than trusting a newly generated explanation.

## 11. Narrative Gap

External news and social narrative are deliberately not allowed to manufacture a trade. Narrative is an adversarial or contextual signal.

Krineo compares what the public story says with what market evidence says and labels the relationship as:

- `CONFIRMED`
- `OVERHEATED`
- `UNDER_RECOGNISED`
- `CONTRADICTED`
- `INCONCLUSIVE`
- `UNKNOWN`

If the narrative provider fails, narrative becomes `UNKNOWN` and degraded coverage is shown. Missing narrative is never silently converted to neutral.

Narrative Gap is a P1 feature. It must not block the core product if the optional provider is unavailable.

## 12. Social layer

The MVP social mechanic is **Challenge Thesis**.

A user submits a counterclaim. Krineo turns it into a testable claim, researches it and returns:

- `SUPPORTED`
- `PARTIALLY_SUPPORTED`
- `REJECTED`
- `UNKNOWN`

A social opinion is never itself evidence.

- Supported challenges may weaken or veto a future thesis version.
- Rejected challenges remain visible as part of the public reasoning trail.
- The original committed receipt is never edited.
- `Fork Thesis` and full reasoning reputation are post-MVP extensions.

## 13. Practice trading

No real funds, wallets, leverage or exchange execution are needed. A directional thesis can open a fixed simulated `$1,000` practice position inside a `$10,000` paper portfolio.

Practice P&L is secondary context, not proof that the agent is good. The hackathon demonstration must be framed as an accountability and reasoning system, not as a four-day profitability contest.

## 14. DM-1: Defensible Momentum v1

The MVP ships one transparent practice strategy. **DM-1** looks for short-horizon momentum supported by several evidence dimensions, stronger than alternatives and not invalidated by safety, risk, missing-data, regime or contradiction checks.

DM-1 is not claimed to be profitable or empirically optimised.

### Directional evidence weights

| Evidence dimension | Weight |
|---|---:|
| Directional Momentum | 30 |
| Technical Confluence | 20 |
| Relative Opportunity | 20 |
| Market Alignment | 15 |
| Sentiment / Derivatives Alignment | 15 |
| **Total** | **100** |

Normalised directional states:

- Strongly Supportive: `+1.0`
- Supportive: `+0.5`
- Neutral: `0`
- Opposing: `-0.5`
- Strongly Opposing: `-1.0`
- Unknown: `null`

`UNKNOWN` reduces coverage; it is never treated as neutral.

### DM-1 gates

- Directional score range: `-100` to `+100`.
- `LONG` eligibility: `+60` to `+100`.
- `SHORT` eligibility: `-60` to `-100`.
- Between `-60` and `+60`: `ABSTAIN`.
- Minimum directional evidence coverage: `80%`, with mandatory semantic dimensions present.
- High conflict above `30%`: force `ABSTAIN`.
- Extreme volatility, safety veto or unknown, regime mismatch or other hard-gate failure: force `ABSTAIN`.
- Autonomous discovery requires at least a `5-point` relative edge over the runner-up; otherwise return `ABSTAIN / NO_CLEAR_WINNER`.

## 15. Thesis Strength

Thesis Strength is a deterministic evidence-coherence index, not a probability of profit.

For an eligible directional thesis:

```text
Thesis Strength = absolute directional score × evidence coverage
```

Conflict remains a separate visible measure so contradictory evidence is not double-penalised.

Required product language:

> **Thesis Strength measures how coherently the available evidence supports this thesis under the active strategy. It is not a prediction of future returns.**

## 16. Failure philosophy

Krineo must fail honestly:

- Optional narrative provider down → continue with `Narrative: UNKNOWN` and partial coverage.
- Required safety evidence unavailable → `ABSTAIN`.
- Comparison unavailable during autonomous discovery → `ABSTAIN`, because opportunity cost cannot be established.
- LLM unavailable → preserve structured evidence and deterministic state; degrade explanation and challenge generation.
- Cached evidence may be used only when clearly labelled stale with its observation time.
- A research run persists by stage so restart can resume instead of blindly repeating every provider call.
- Database commit failure → do not commit a thesis or open a paper position.
- Provider failures return typed status, diagnostics and provenance—not fabricated placeholders.

## 17. Core screens

| Screen | Purpose |
|---|---|
| **Agent Workspace** | Prompt the agent; show live research stages and high-level market state. |
| **Opportunity Comparison** | Show candidate set, rejected alternatives and `ABSTAIN`. |
| **Provisional Thesis** | Show proposed decision, evidence, contradictions and invalidation conditions before commitment. |
| **KillSwitch** | Show adversarial challenges and validated effects. |
| **Thesis Receipt** | Permanent public reasoning artifact with provenance and integrity hash. |
| **Thesis Dashboard** | Show active, weakened, invalidated and abstained theses; highlight what needs attention. |
| **Strategy Diff** | Show `THEN` versus `NOW` evidence and causal explanation of decision changes. |
| **Challenge Thesis** | Turn a human counterclaim into a researched, structured challenge. |

## 18. Hackathon track positioning

### Track 1 — Autonomous Agents

An accountable autonomous market-reasoning agent that discovers opportunities, compares alternatives, creates evidence-backed practice theses, adversarially challenges itself and revises decisions when precommitted invalidation rules fire.

### Track 2 — Dashboards & Interfaces

A reasoning-first market dashboard that shows what the agent believes, why it believes it, what contradicts it and exactly what changed between decisions.

### Track 3 — New Skills

A reusable `challenge_thesis` skill: given a proposed thesis and evidence context, return `CLEAR / CAUTION / VETO / UNKNOWN` plus evidence-backed challenges. The final contract remains dependent on the official RYO Builder Guide and must not be invented.

## 19. MVP scope

### Must ship

- Live RYO integration.
- Candidate discovery.
- Opportunity Cost comparison.
- Structured evidence normalisation.
- DM-1 `LONG / SHORT / ABSTAIN`.
- Thesis Strength, Coverage, Conflict and Regime Fit.
- KillSwitch.
- Thesis Receipt.
- Fixed practice position.
- Persistent thesis versions.
- Refresh.
- Strategy Diff.
- Invalidation.
- Visible degraded, partial, stale and unavailable states.

### Standout P1

- Narrative Gap.
- `challenge_thesis` skill.
- Human Challenge Thesis flow.
- Receipt hashing.
- Polished Decision Replay.
- Keyboard and screen-reader accessibility.

### Only if ahead

- Fork Thesis.
- On-chain anchoring.
- Multiple strategies.
- Full reputation profiles.
- Collaborative rooms.
- Automatic monitoring.

## 20. Demo story

1. Ask Krineo to find the strongest defensible opportunity.
2. Show live RYO evidence and the candidate comparison.
3. Show a provisional `LONG`, `SHORT` or disciplined `ABSTAIN` decision.
4. Run KillSwitch and expose contradictions.
5. Commit the permanent Thesis Receipt.
6. Refresh against a later evidence snapshot.
7. Show Strategy Diff and a precommitted invalidation rule firing.
8. Emphasise that the agent did not change its mind because the LLM “felt different”; the evidence and versioned policy explain the change.

### Demo line

> **“Most trading agents are designed to give you an answer. Krineo is designed to be accountable for the answer.”**

## 21. What Krineo deliberately does not build

- Real-money trading or custody.
- Wallet execution and exchange connectivity.
- Copy trading.
- Leverage or dynamic position sizing.
- A charting terminal.
- An autonomous fund.
- Multiple strategies for the MVP.
- Backtesting infrastructure during the hackathon.
- Profitability claims.
- A token or a full social network.

## 22. Product moat and differentiation

A competitor may also build a “trading thesis agent.” Krineo’s distinctive system is the full accountability loop:

```text
DISCOVER → COMPARE → CHALLENGE → COMMIT → MONITOR → DIFF → INVALIDATE
```

Many projects will stop at:

```text
RESEARCH → AI OPINION → PAPER TRADE
```

Krineo makes the before-and-after reasoning lifecycle the product itself.

## 23. Product identity

### Brand name

**Krineo** (`KREE-nee-oh`)

The name is a brand-shaped adaptation inspired by Ancient Greek *krinō* (`κρίνω`): to separate, distinguish, judge and decide. It earns its place because the product’s job is not simply to produce market commentary; it is to distinguish signal from noise and decide whether a thesis deserves commitment.

### Descriptor

> **Accountable AI market reasoning**

### Primary tagline

> **Decide with receipts.**

### Supporting lines

- Evidence before conviction.
- If the thesis changes, show why.
- A market answer with a memory.
- `ABSTAIN` is a decision.

Trademark, domain, social-handle and legal clearance for Krineo remain unverified and must be checked separately before public launch.

## 24. Source and evidence boundary

This document consolidates the supplied Krineo product concept from the user-provided PDF and the official RYO-CHAN material inspected during this task.

Official hackathon source: [RYO-CHAN Hackathon 2026](https://ryobuild.com/hackathon)

The official page describes a read-only research layer and enumerates these published tool identifiers: `market_overview`, `scan_market`, `analyze_token`, `deep_analysis`, `compare_tokens`, `check_safety` and `supported_tokens`. Its marketing copy uses both “six” and a seven-item enumeration; implementation should follow the official Builder Guide and actual schema rather than relying on the count in promotional copy.

Exact raw field mappings, request payloads, rate-limit semantics and the final Track 3 contract remain integration dependencies. They must be inspected from the official guide and never fabricated.
