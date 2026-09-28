# Krineo

## Decide with receipts.

**Accountable AI market reasoning.**

Krineo is a market-reasoning system where agents research crypto markets, compare opportunities, create practice-trading theses, adversarially challenge their reasoning, preserve what they believed, and visibly explain why they change their minds when evidence changes. It is designed to make market judgement inspectable rather than to present confidence or short-term P&L as proof.

> **Rules decide. Models explain.**

> **Current submission state:** the deterministic Krineo reasoning stack and fixture-driven workspace are implemented. The private RYO MCP credential has not been supplied, so the upstream RYO research adapter is not connected yet.

## Why Krineo

Most AI market agents can produce confident answers, but users cannot easily inspect:

- What evidence caused the decision.
- What evidence contradicted it.
- What alternatives were rejected.
- What would make the agent change its mind.
- Whether a later explanation rewrote the original reasoning.

Krineo addresses accountable reasoning rather than pretending to be a profit machine. Its central product is a versioned market thesis with a visible evidence path, a challenge result, an integrity fingerprint, and a causal explanation when the thesis changes.

The interaction principle is:

```text
ASK NATURALLY → INSPECT STRUCTURALLY → ACT EXPLICITLY
```

## What Krineo Does

Krineo models the lifecycle of a market belief:

```text
DISCOVER → RESEARCH → COMPARE → CHALLENGE → DECIDE → COMMIT
→ MONITOR → DIFF → ADAPT / INVALIDATE
```

The current offline implementation demonstrates:

- `LONG`, `SHORT` and `ABSTAIN` as first-class decision states.
- Opportunity comparison with visible alternatives.
- DM-1, the deterministic Defensible Momentum v1 policy.
- KillSwitch adversarial validation before commitment.
- Append-only Thesis and ThesisVersion domain behavior.
- Canonical Thesis Receipts with a SHA-256 integrity fingerprint.
- Strategy Diff for evidence-level `THEN → NOW` comparison.
- Precommitted invalidation rules.
- Fixed-size simulated practice positions and pure P&L calculations.

The product shell makes the complete loop visible in one workspace rather than hiding the decision behind a single generated paragraph.

## The Core Demo Loop

The repository includes three deterministic product scenarios:

1. Ask naturally: “Is SOL still the clearest long opportunity in the current regime?”
2. Compare SOL against alternative candidates and the possibility of abstaining.
3. Inspect structured evidence, coverage, conflict, risk, safety and regime fit.
4. Run a KillSwitch challenge against the same evidence record.
5. Commit the current decision into a canonical Thesis Receipt.
6. Refresh the evidence snapshot.
7. Inspect Strategy Diff to see what changed.
8. Evaluate precommitted rules and map the result to `MAINTAIN`, `WEAKEN` or `INVALIDATE`.
9. Keep the simulated practice position open, or close it when the invalidation outcome requires that action.

The other scenarios make two important states explicit:

- **Intentional ABSTAIN:** insufficient or mixed evidence does not become a forced direction and does not open a practice position.
- **Thesis changed:** a directional reversal produces a visible diff, fires the precommitted reversal rule and closes the simulated position.

## What Makes It Different

1. `ABSTAIN` is first-class. Refusing to form a thesis can be the correct policy result.
2. Evidence and contradictions are visible instead of being compressed into confidence language.
3. Opportunity cost is explicit through candidate comparison and rejected alternatives.
4. KillSwitch adversarially challenges a thesis before commitment.
5. Thesis Receipts preserve what the system believed at commitment time.
6. Strategy Diff shows `THEN → NOW` instead of replacing history with a new explanation.
7. Invalidation is based on precommitted rules, not retrospective prose.
8. Practice P&L is context, not proof of strategy quality.

Krineo does not claim profitability, accurate prediction, financial advice or autonomous execution.

## Architecture

The implemented deterministic path is organized around domain boundaries:

```text
Intent Layer
    ↓
Research Boundary
    ↓
Normalized Evidence
    ↓
DM-1 Decision Engine
    ↓
KillSwitch
    ↓
Thesis Lifecycle
    ↓
Canonical Thesis Receipt
    ↓
Simulated Practice Position
```

On refresh:

```text
New Evidence
    ↓
DM-1
    ↓
Strategy Diff
    ↓
Precommitted Invalidation Rules
    ↓
MAINTAIN / WEAKEN / INVALIDATE
```

The separation is intentional:

- **Research** supplies source material and provenance. The external adapter boundary is not connected in this baseline.
- **Normalized evidence** gives the decision engine stable semantic states such as supportive, opposing, neutral and unknown.
- **Deterministic decision rules** calculate score, coverage, conflict, gates, reason codes and decision state without an LLM call.
- **Model explanation** is a future explanation/proposal layer. It cannot override policy, invent evidence or rewrite a receipt; no AI provider integration is claimed in the current repository.
- **Presentation** renders the structured domain outputs in the Krineo workspace. The UI does not own the decision rules.

The relevant implementation areas are:

```text
lib/strategy/dm1/   deterministic decision policy
lib/killswitch/     structured challenge validation
lib/thesis/         lifecycle, receipt, diff and invalidation
lib/practice/       simulated portfolio and position ledger
lib/demo/           deterministic product scenarios
components/krineo/  fixture-driven workspace presentation
tests/              domain and scenario verification
```

## RYO Integration

Krineo is designed to use RYO as the read-only market research layer.

The currently known/public tool surface includes:

- `market_overview`
- `scan_market`
- `analyze_token`
- `deep_analysis`
- `compare_tokens`
- `check_safety`
- `supported_tokens`

The private RYO MCP key has not been supplied. The repository therefore contains no RYO client, endpoint implementation, guessed request schema or guessed response-field mapping. The RYO boundary is documented in [`lib/ryo/README.md`](lib/ryo/README.md), and adapter work is intentionally deferred until runtime discovery is possible with the private MCP credentials.

The intended boundary is simple:

```text
RYO supplies research evidence.
Krineo supplies judgement, challenge, commitment, accountability and lifecycle reasoning.
```

When integration begins, the credential must remain server-side. It must never be exposed through a `NEXT_PUBLIC_*` variable or a client bundle.

## Current Demo Status

The current demo scenarios use deterministic simulated research fixtures. They are explicitly labelled as development fixtures and are **not**:

- Live RYO data.
- Real-time prices.
- Real trading.
- Real execution.

The upstream research values are fixtures until RYO is connected. The Krineo reasoning stack consuming those values is real implementation: decision evaluation, challenge validation, append-only lifecycle behavior, canonical receipt hashing, diffing, invalidation and simulated practice accounting are covered by tests.

## DM-1: Defensible Momentum v1

DM-1 combines five directional evidence dimensions:

- Directional momentum.
- Technical confluence.
- Relative opportunity.
- Market alignment.
- Sentiment and derivatives.

The policy also applies minimum evidence coverage, required evidence, safety, risk and regime-fit gates. Unknown evidence reduces coverage; it is not silently treated as neutral. Narrative has no directional score contribution in the current strategy policy.

**Thesis Strength is an evidence-coherence measure under the active strategy.** It is not a probability, a return forecast or a profitability claim.

DM-1 is a transparent policy for the product demo, not a claim that the strategy predicts profitable outcomes.

## ABSTAIN Is a Decision

Krineo can refuse to form a directional thesis when:

- Evidence is insufficient.
- Required evidence is unavailable.
- A hard gate fails.
- Evidence conflict is too high.
- No candidate has a sufficiently clear relative edge.

This is intentional behavior. `ABSTAIN` preserves uncertainty, avoids manufacturing a trade and has no directional practice position.

## Thesis Receipt

Each committed reasoning state can produce a canonical Thesis Receipt containing:

- Decision and asset.
- Evidence state, provenance and observation time.
- Supporting, contradicting, neutral and unknown evidence.
- Candidate ranking and alternatives.
- KillSwitch outcome.
- Precommitted invalidation conditions.
- Strategy and normalizer versions.
- Timestamp and lifecycle state.
- SHA-256 integrity fingerprint of the canonical structured payload.

The hash proves integrity of the canonical structured receipt state. It does **not** prove correctness, profitability, blockchain settlement or future performance. A refresh creates a new version; it does not edit the old receipt.

## Practice Positions

Practice positions are simulated only:

- Default `$10,000` practice portfolio.
- Default `$1,000` directional position notional.
- No leverage.
- No wallets.
- No exchange execution.
- No funds moved.

Practice P&L is context, not proof of strategy quality.

## Hackathon Qualification

> **Read-only research and simulated practice positions. Not financial advice. Thesis Strength measures evidence coherence under the active strategy; it is not a prediction of future returns.**

> **Development demo currently uses deterministic research fixtures until the private RYO MCP integration is connected.**

## Tech Stack

The current repository uses:

- Next.js `16.3.4` with the App Router.
- React `19.2.8`.
- TypeScript 5.
- Tailwind CSS `4.1.17`.
- Vitest `3.2.7`.
- Lucide React for interface icons.

The current baseline has no database, API routes, wallet integration, exchange integration or live provider adapter.

## Testing and Reliability

The deterministic suite currently verifies **182 tests** covering:

- DM-1 scoring, coverage, conflict, gates and reason codes.
- KillSwitch challenge validation and aggregate verdicts.
- Thesis lifecycle and append-only version behavior.
- Receipt canonicalization and SHA-256 stability.
- Strategy Diff and provenance/state changes.
- Precommitted invalidation outcomes.
- Simulated practice ledger and P&L.
- Directional, ABSTAIN and thesis-change demo scenarios.

This repository does not currently publish a coverage percentage; no coverage claim is made here.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the verification suite:

```bash
npm test
npm run lint
npm run type-check
npm run build
```

The build script uses `next build --webpack`.

## Environment and Secret Hygiene

Copy `.env.example` to a local environment file only when integration work is authorized. The template contains the variable name but no secret value:

```text
RYO_MCP_KEY=
```

The private credential is server-side only. Do not create `NEXT_PUBLIC_RYO_MCP_KEY`, commit `.env` files, place credentials in screenshots or logs, or pass secrets into client components.

## Scope Boundary

This submission-readiness baseline intentionally does not add:

- RYO integration before private credential/runtime schema discovery.
- Fake RYO responses or guessed RYO schemas.
- API routes, database persistence or wallet/exchange behavior.
- New strategies or product features.
- Narrative Gap, social features or Track 3 skill work.

Krineo’s submission story is the accountable reasoning loop: research boundary, structured evidence, deterministic judgement, adversarial challenge, durable receipt and visible change.
