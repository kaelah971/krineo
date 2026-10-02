import type { ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  CircleHelp,
  FileCheck2,
  GitCompareArrows,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { selectAutonomousCandidate } from "@/lib/strategy/dm1/selection";
import { describeDemoRule } from "@/lib/demo/authoring";
import type { DemoCommitResult } from "@/lib/demo/commit";
import type { DemoRefreshResult } from "@/lib/demo/refresh";
import type {
  DemoPracticeState,
  DemoScenario,
} from "@/lib/demo/scenarios";
import type { ThesisReceipt } from "@/lib/thesis/types";

const DIMENSION_LABELS: Record<string, string> = {
  DIRECTIONAL_MOMENTUM: "Directional momentum",
  TECHNICAL_CONFLUENCE: "Technical confluence",
  RELATIVE_OPPORTUNITY: "Relative opportunity",
  MARKET_ALIGNMENT: "Market alignment",
  SENTIMENT_DERIVATIVES: "Sentiment + derivatives",
};

function humanize(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function toneFor(value: string): "positive" | "negative" | "caution" | "info" | "unknown" | "neutral" {
  if (["LONG", "CLEAR", "ACTIVE", "COMMITTED", "MAINTAIN", "KEEP_OPEN", "SUPPORTIVE", "STRONGLY_SUPPORTIVE", "COMPLETE", "TRIGGERED"].includes(value)) {
    return "positive";
  }
  if (["SHORT", "VETO", "BLOCKED", "BLOCK", "INVALIDATE", "CLOSED", "CLOSE", "OPPOSING", "STRONGLY_OPPOSING"].includes(value)) {
    return "negative";
  }
  if (["CAUTION", "WAIT", "WEAKEN", "ELEVATED", "DEGRADED", "NEUTRAL", "PARTIAL"].includes(value)) {
    return "caution";
  }
  if (["INFO", "FIT"].includes(value)) {
    return "info";
  }
  if (["ELIGIBLE"].includes(value)) {
    return "positive";
  }
  if (["UNKNOWN", "ABSTAIN", "NOT_TRIGGERED"].includes(value)) {
    return "unknown";
  }
  return "neutral";
}

function formatScore(value: number | null): string {
  return value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(0)}`;
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(0)}%`;
}

function formatPnl(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;
}

function truncateHash(value: string): string {
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export function StatusBadge({ value, label = humanize(value) }: { value: string; label?: string }) {
  return <span className={`status-badge status-${toneFor(value)}`}>{label}</span>;
}

export function Panel({
  id,
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`panel ${className}`}>
      <div className="panel-header">
        <div>
          <p className="section-eyebrow">{eyebrow}</p>
          <h2 className="panel-title">{title}</h2>
          {description ? <p className="panel-description">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function DecisionPanel({ scenario }: { scenario: DemoScenario }) {
  const decision = scenario.currentDecision;
  const isAbstain = decision.decision === "ABSTAIN";
  return (
    <Panel
      id="decision"
      eyebrow="DECISION RECORD"
      title={isAbstain ? "No direction committed" : `${decision.decision} thesis ready`}
      description={
        isAbstain
          ? "The system kept the decision reversible because the required directional evidence did not clear the policy gates."
          : "The current candidate has a complete evidence record and an explicit policy outcome."
      }
      className="decision-panel"
    >
      <div className="decision-layout">
        <div className={`decision-mark decision-mark-${toneFor(decision.decision)}`} aria-hidden="true">
          {isAbstain ? <CircleHelp size={30} strokeWidth={1.6} /> : decision.decision === "LONG" ? <ArrowUpRight size={34} strokeWidth={1.7} /> : <ArrowDownRight size={34} strokeWidth={1.7} />}
        </div>
        <div className="decision-copy">
          <div className="decision-line">
            <span className="decision-asset">{decision.asset} / DM-1</span>
            <StatusBadge value={decision.decision} label={decision.decision === "ABSTAIN" ? "ABSTAIN" : `${decision.decision} · eligible`} />
          </div>
          <p className="decision-statement">
            {isAbstain
              ? "No clear directional winner. Preserve optionality."
              : `${decision.asset} clears the directional threshold with ${decision.coverageLabel.toLowerCase()} coverage.`}
          </p>
          <div className="decision-reasons" aria-label="Decision reasons">
            {decision.reasonCodes.slice(0, 4).map((reason) => (
              <span key={reason} className="reason-chip">{humanize(reason)}</span>
            ))}
          </div>
        </div>
        <div className="decision-metric-stack">
          <Metric label="Directional score" value={formatScore(decision.directionalScore)} />
          <Metric label="Thesis strength" value={formatScore(decision.thesisStrength)} />
          <Metric label="Coverage" value={formatPercent(decision.coverage)} />
        </div>
      </div>
      <div className="gate-row" aria-label="Policy gates">
        {decision.hardGateResults.map((gate) => (
          <div key={gate.gate} className={`gate-item ${gate.passed ? "gate-passed" : "gate-failed"}`}>
            {gate.passed ? <Check size={13} /> : <CircleAlert size={13} />}
            <span>{humanize(gate.gate)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function dimensionNames(
  dimensions: readonly string[],
): string {
  return dimensions.length === 0
    ? "None"
    : dimensions.map((dimension) => DIMENSION_LABELS[dimension] ?? humanize(dimension)).join(" · ");
}

export function DecisionContextPanel({ scenario }: { scenario: DemoScenario }) {
  const governance = scenario.currentGovernance;
  const preflight = governance.preflight;
  const topCase = governance.memorySnapshot.rankedCases[0] ?? null;
  const matchedDimensions = topCase?.similarity.components
    .filter((component) => component.diagnostic === "MATCH")
    .map((component) => component.dimension) ?? [];
  const differentDimensions = topCase?.similarity.components
    .filter((component) => ["PARTIAL_ALIGNMENT", "OPPOSING"].includes(component.diagnostic))
    .map((component) => component.dimension) ?? [];
  const unknownDimensions = topCase?.similarity.components
    .filter((component) => ["TARGET_UNKNOWN", "CANDIDATE_UNKNOWN", "BOTH_UNKNOWN"].includes(component.diagnostic))
    .map((component) => component.dimension) ?? [];

  return (
    <Panel
      id="context"
      eyebrow="DECISION CONTEXT"
      title="NOW / RULES / MEMORY"
      description="The current market judgement, approved guardrails and deterministic historical context stay visible in one decision record."
      className="decision-context-panel"
    >
      <div className="context-grid">
        <div className="context-block">
          <div className="context-heading">
            <span className="context-index">01</span>
            <div>
              <span className="section-eyebrow">NOW</span>
              <h3>What Krineo thinks</h3>
            </div>
          </div>
          <div className="context-primary">
            <strong>{preflight.marketDecision}</strong>
            <StatusBadge value={preflight.status} label={`Preflight · ${preflight.status}`} />
          </div>
          <div className="context-stat-grid">
            <Metric label="Asset" value={scenario.asset} accent />
            <Metric label="Score" value={formatScore(preflight.marketResult.directionalScore)} />
            <Metric label="Coverage" value={formatPercent(preflight.marketResult.coverage)} />
          </div>
          <p className="context-note">
            Market decision and rule eligibility are separate outputs. Effective direction: {preflight.effectiveDecision}.
          </p>
        </div>

        <div className="context-block">
          <div className="context-heading">
            <span className="context-index">02</span>
            <div>
              <span className="section-eyebrow">RULES</span>
              <h3>Active rules</h3>
            </div>
          </div>
          <div className="context-primary">
            <strong>Approved Playbook v{governance.playbookVersion.versionNumber}</strong>
            <StatusBadge value={preflight.playbookEffect} label={`Active · ${preflight.playbookEffect}`} />
          </div>
          <span className="context-id">
            {governance.playbookProvenance} · {governance.playbookVersion.id} · v{governance.playbookVersion.versionNumber}
            {governance.playbookVersion.sourceProposalId ? ` · ${governance.playbookVersion.sourceProposalId}` : ""}
          </span>
          <div className="context-rule-list">
            {preflight.playbookEvaluation.ruleEvaluations.map((evaluation) => (
              <div className="context-rule" key={evaluation.rule.id}>
                <div className="context-rule-topline">
                  <strong>{evaluation.rule.id}</strong>
                  <StatusBadge value={evaluation.outcome} label={`${evaluation.outcome} · ${evaluation.rule.effect}`} />
                </div>
                <span className="context-rule-summary">{describeDemoRule(evaluation.rule)}</span>
                <span>{evaluation.diagnostics[0]?.message ?? "No rule diagnostic was emitted."}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="context-block">
          <div className="context-heading">
            <span className="context-index">03</span>
            <div>
              <span className="section-eyebrow">MEMORY</span>
              <h3>Have we seen this before?</h3>
            </div>
          </div>
          <div className="context-primary">
            <strong>{governance.memorySummary.comparableCaseCount} comparable cases</strong>
            <StatusBadge value="INFO" label="Deterministic memory" />
          </div>
          <span className="context-id">{governance.memoryProvenance} · {governance.memorySummary.summaryVersion} · {governance.memorySnapshot.snapshotId}</span>
          <div className="context-stat-grid context-memory-stats">
            <Metric label="Ranked" value={`${governance.memorySummary.rankedCaseCount}`} />
            <Metric label="Comparable" value={`${governance.memorySummary.comparableCaseCount}`} />
            <Metric label="High similarity" value={`${governance.memorySummary.highSimilarityCaseCount}`} />
          </div>
          {topCase ? (
            <div className="context-case">
              <div className="context-rule-topline">
                <strong>Top case · {topCase.caseId}</strong>
                <StatusBadge value="MATCH" label={formatPercent(topCase.similarity.overallSimilarity)} />
              </div>
              <div className="context-case-metrics">
                <span>Coverage {formatPercent(topCase.similarity.comparisonCoverage)}</span>
                <span>Comparable {formatPercent(topCase.similarity.comparableSimilarity)}</span>
              </div>
              <p><strong>Matched:</strong> {dimensionNames(matchedDimensions)}</p>
              <p><strong>Different:</strong> {dimensionNames(differentDimensions)}</p>
              {unknownDimensions.length > 0 ? <p><strong>Unknown:</strong> {dimensionNames(unknownDimensions)}</p> : null}
              <div className="context-history">
                <span>Historical outcome · {topCase.decisionCase.outcome?.status ?? "NOT RECORDED"}</span>
                <small>Context only. It does not determine today&apos;s decision.</small>
              </div>
            </div>
          ) : (
            <div className="empty-state context-empty">Memory snapshot exists, but no historical cases were ranked.</div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`metric ${accent ? "metric-accent" : ""}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </div>
  );
}

export function EvidencePanel({ scenario }: { scenario: DemoScenario }) {
  return (
    <Panel
      id="evidence"
      eyebrow="STRUCTURED INSPECTION"
      title="Evidence record"
      description="Five directional dimensions, ordered as the strategy sees them. Each row preserves its source and observation identity."
    >
      <div className="evidence-list">
        {scenario.currentEvidence.map((item) => (
          <div className="evidence-row" key={item.id}>
            <div className={`evidence-icon evidence-icon-${toneFor(item.state)}`} aria-hidden="true">
              {item.state === "UNKNOWN" ? <CircleHelp size={15} /> : <Check size={15} />}
            </div>
            <div className="evidence-main">
              <div className="evidence-title-line">
                <strong>{DIMENSION_LABELS[item.dimension] ?? humanize(item.dimension)}</strong>
                <StatusBadge value={item.state} />
              </div>
              <p>{item.explanation}</p>
              <span className="evidence-source">{item.source} · observed 12:00 UTC</span>
            </div>
            <div className={`evidence-signal signal-${toneFor(item.state)}`} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ))}
      </div>
      <div className="evidence-footnote">
        <CircleHelp size={14} />
        <span>Unknown is a first-class state. It is never silently promoted to neutral.</span>
      </div>
    </Panel>
  );
}

export function ComparisonPanel({ scenario }: { scenario: DemoScenario }) {
  const candidates = selectAutonomousCandidate(scenario.currentCandidates).rankedCandidates;
  return (
    <Panel
      id="comparison"
      eyebrow="OPPORTUNITY SET"
      title="Compare before committing"
      description="Relative opportunity is explicit. The selected candidate is shown beside the strongest available alternatives."
    >
      <div className="comparison-table" role="table" aria-label="Opportunity comparison">
        <div className="comparison-head" role="row">
          <span>Rank / asset</span>
          <span>Decision</span>
          <span>Strength</span>
          <span>Coverage</span>
        </div>
        {candidates.map((candidate, index) => (
          <div className={`comparison-row ${candidate.selected ? "comparison-selected" : ""}`} role="row" key={candidate.asset}>
            <div className="candidate-name">
              <span className="candidate-rank">0{index + 1}</span>
              <strong>{candidate.asset}</strong>
              {candidate.selected ? <span className="selected-dot">Selected</span> : null}
            </div>
            <StatusBadge value={candidate.decision} />
            <strong className="table-number">{formatScore(candidate.thesisStrength)}</strong>
            <span className="table-muted">{formatPercent(candidate.coverage)}</span>
          </div>
        ))}
      </div>
      <div className="comparison-note">
        <Waypoints size={15} />
        <span>Candidate ranking is part of the receipt, not an invisible model preference.</span>
      </div>
    </Panel>
  );
}

export function CommitPanel({
  scenario,
  result,
  error,
  pending,
  onCommit,
}: {
  scenario: DemoScenario;
  result: DemoCommitResult | null;
  error: string | null;
  pending: boolean;
  onCommit: () => void;
}) {
  const pendingStatus =
    scenario.currentDecision.decision === "ABSTAIN"
      ? "ABSTAIN"
      : scenario.currentKillSwitch.verdict;
  const status =
    result === null
      ? pendingStatus
      : result.ok
        ? "COMMITTED"
        : result.reason === "ABSTAIN"
          ? "ABSTAIN"
          : result.reason === "KILLSWITCH_VETO"
            ? "VETO"
            : result.reason === "KILLSWITCH_UNKNOWN"
              ? "UNKNOWN"
              : "BLOCKED";

  return (
    <Panel
      id="commit"
      eyebrow="COMMIT GATE"
      title={result?.ok ? "Thesis committed" : "Commit the inspected record"}
      description="Commit is a deliberate boundary: candidate selection and KillSwitch results must clear before a receipt is written."
      className="side-panel commit-panel"
    >
      <div className="commit-status">
        <div>
          <span className="metric-label">Selected outcome</span>
          <strong>{result?.ok ? `${result.version.decision} · v${result.version.versionNumber}` : scenario.currentDecision.decision}</strong>
        </div>
        <StatusBadge value={status} />
      </div>
      {result === null ? (
        <>
          <p className="diagnostic-copy">
            {pending
              ? "Writing the deterministic commitment and receipt on the fixture boundary."
              : scenario.currentDecision.decision === "ABSTAIN"
                ? "Run the commitment check to record that uncertainty remains uncommitted."
                : "The fixture is ready to write a deterministic Decision Receipt after this explicit action."}
          </p>
          <button
            className="button button-dark commit-button"
            type="button"
            onClick={onCommit}
            disabled={pending}
            aria-busy={pending}
          >
            {pending
              ? "Writing receipt…"
              : scenario.currentDecision.decision === "ABSTAIN"
                ? "Run commitment check"
                : "Commit selected thesis"}
            <Check size={15} aria-hidden="true" />
          </button>
          {error ? <p className="intent-error" role="alert">{error}</p> : null}
        </>
      ) : result.ok ? (
        <div className="commit-result commit-success" role="status" aria-live="polite">
          <strong>Receipt written</strong>
          <span>{result.receipt.id} · canonical hash recorded below.</span>
        </div>
      ) : (
        <div className="commit-result commit-blocked" role="alert">
          <strong>Not committed</strong>
          <span>{result.message}</span>
        </div>
      )}
    </Panel>
  );
}

export function RefreshPanel({
  result,
  previousReceipt,
  error,
  pending,
  canRefresh,
  onRefresh,
}: {
  result: DemoRefreshResult | null;
  previousReceipt: ThesisReceipt | null;
  error: string | null;
  pending: boolean;
  canRefresh: boolean;
  onRefresh: () => void;
}) {
  return (
    <Panel
      id="refresh"
      eyebrow="REFRESH / HISTORY"
      title={result?.ok ? "Version history extended" : "Refresh the evidence"}
      description="Append a new snapshot without rewriting the committed version, then evaluate its precommitted consequence."
      className="side-panel refresh-panel"
    >
      {result === null ? (
        canRefresh ? (
          <>
            <p className="diagnostic-copy">The committed v1 is preserved. Refresh the deterministic fixture to append v2 and run the strategy diff.</p>
            <button
              className="button button-dark refresh-button"
              type="button"
              onClick={onRefresh}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? "Appending v2…" : "Refresh evidence"}
              <RefreshCw size={15} aria-hidden="true" />
            </button>
            {error ? <p className="intent-error" role="alert">{error}</p> : null}
          </>
        ) : (
          <div className="empty-state refresh-empty" role="status">
            <CircleHelp size={18} aria-hidden="true" />
            <span>Commit v1 before refreshing the evidence history.</span>
          </div>
        )
      ) : result.ok ? (
        <div className="refresh-result" role="status" aria-live="polite">
          <div className="refresh-version">
            <span className="metric-label">Append-only history</span>
            <strong>v{result.previousVersion.versionNumber} → v{result.version.versionNumber}</strong>
          </div>
          <div className="refresh-outcome">
            <StatusBadge value={result.invalidation?.outcome ?? "MAINTAIN"} />
            <span>{result.invalidation?.triggeredRules.length ? "Precommitted rule triggered." : "Precommitted rules maintained the thesis."}</span>
          </div>
          <span className="refresh-receipt">Latest: {result.receipt.id} · v2 receipt available for inspection.</span>
          <span className="refresh-history-receipt">Historical v1 preserved: {previousReceipt?.id ?? result.previousVersion.id}</span>
        </div>
      ) : (
        <div className="commit-result commit-blocked" role="alert">
          <strong>Refresh rejected</strong>
          <span>{result.message}</span>
        </div>
      )}
    </Panel>
  );
}

export function KillSwitchPanel({ scenario }: { scenario: DemoScenario }) {
  const verdict = scenario.currentKillSwitch.verdict;
  const validation = scenario.currentKillSwitchValidation;
  return (
    <Panel
      id="challenge"
      eyebrow="CHALLENGE"
      title="KillSwitch review"
      description="A structured contradiction is evaluated against the same evidence used for the decision."
      className="side-panel"
    >
      <div className="challenge-claim">
        <span className="challenge-label">DETERMINISTIC CHALLENGE</span>
        <p>“{validation.challengeType === "DIRECTION_CONTRADICTION" ? "Can the directional record contradict the provisional thesis?" : humanize(validation.challengeType)}”</p>
      </div>
      <div className={`verdict-box verdict-${toneFor(verdict)}`}>
        <div>
          <span className="metric-label">Aggregate verdict</span>
          <strong>{verdict}</strong>
        </div>
        <ShieldCheck size={23} />
      </div>
      <div className="challenge-details">
        <div><span>Effect</span><StatusBadge value={scenario.currentKillSwitch.effect} /></div>
        <div><span>Severity</span><StatusBadge value={scenario.currentKillSwitch.severity} /></div>
        <div><span>Reason</span><strong>{humanize(validation.reasonCodes[0] ?? "NO_REASON")}</strong></div>
      </div>
      <p className="diagnostic-copy">{validation.diagnostics[0] ?? "No diagnostic was emitted."}</p>
      <div className="proof-line"><LockKeyhole size={13} /> Deterministic P1.3 validator</div>
    </Panel>
  );
}

export function DiffPanel({
  scenario,
  practice,
}: {
  scenario: DemoScenario;
  practice: DemoPracticeState | null;
}) {
  const diff = scenario.strategyDiff;
  if (diff === null) {
    return (
      <Panel
        id="diff"
        eyebrow="CHANGE / STRATEGY DIFF"
        title="What changed"
        description="The ABSTAIN record has no directional thesis to invalidate or compare across versions."
        className="diff-panel"
      >
        <div className="empty-state"><CircleHelp size={20} /><span>Diff is intentionally not applicable.</span></div>
      </Panel>
    );
  }

  const changes = diff.evidenceChanges.filter((change) => change.changed);
  return (
    <Panel
      id="diff"
      eyebrow="CHANGE / STRATEGY DIFF"
      title={`What changed · v${diff.version.before} → v${diff.version.after}`}
      description="A compact explanation of what changed, what it means, and which precommitted rule evaluated it."
      className="diff-panel"
    >
      <div className="diff-summary">
        <div className="diff-direction">
          <span className="diff-old">{diff.decision.before}</span>
          <GitCompareArrows size={17} />
          <span className="diff-new">{diff.decision.after}</span>
        </div>
        <div className="diff-metrics">
          <Metric label="Score" value={`${formatScore(diff.score.before)} → ${formatScore(diff.score.after)}`} />
          <Metric label="Coverage" value={`${formatPercent(diff.coverage.before)} → ${formatPercent(diff.coverage.after)}`} />
          <Metric label="Lifecycle" value={`${diff.lifecycleStatus.before} → ${diff.lifecycleStatus.after}`} />
        </div>
      </div>
      <div className="change-list">
        {changes.slice(0, 5).map((change) => (
          <div className="change-row" key={change.dimension}>
            <span className={`change-dot change-dot-${change.kind === "STATE_CHANGED" ? "strong" : "soft"}`} />
            <div>
              <strong>{DIMENSION_LABELS[change.dimension] ?? humanize(change.dimension)}</strong>
              <span>{change.kind === "STATE_CHANGED" ? `${humanize(change.before?.state ?? "UNKNOWN")} → ${humanize(change.after?.state ?? "UNKNOWN")}` : "Source or observation refreshed"}</span>
            </div>
            <span className="change-kind">{humanize(change.kind)}</span>
          </div>
        ))}
      </div>
      {scenario.invalidation ? (
        <InvalidationChain scenario={scenario} practice={practice} />
      ) : null}
    </Panel>
  );
}

function InvalidationChain({
  scenario,
  practice,
}: {
  scenario: DemoScenario;
  practice: DemoPracticeState | null;
}) {
  const invalidation = scenario.invalidation;
  if (invalidation === null) return null;
  return (
    <div className="invalidation-chain">
      <div className="chain-heading">
        <span className="section-eyebrow">PRECOMMITTED INVALIDATION</span>
        <StatusBadge value={invalidation.outcome} />
      </div>
      <div className="chain-track">
        <div className="chain-node chain-node-complete"><Check size={13} /><span>Evidence changed</span></div>
        <div className="chain-connector" />
        <div className={`chain-node ${invalidation.triggeredRules.length > 0 ? "chain-node-triggered" : "chain-node-complete"}`}><CircleAlert size={13} /><span>{invalidation.triggeredRules.length > 0 ? "Rule triggered" : "Rules clear"}</span></div>
        <div className="chain-connector" />
        <div className="chain-node chain-node-final"><Waypoints size={13} /><span>{practice === null ? "Practice pending commit" : `Practice ${practice.action?.action === "CLOSE" ? "closed" : "kept open"}`}</span></div>
      </div>
      <p className="diagnostic-copy">{invalidation.triggeredRules.length > 0 ? `${invalidation.triggeredRules[0].ruleType.replaceAll("_", " ")} fired from the precommitted rule set.` : "No invalidation rule was triggered by this refresh."}</p>
    </div>
  );
}

export function ReceiptPanel({ receipt }: { receipt: ThesisReceipt | null }) {
  if (receipt === null) {
    return (
      <Panel
        id="receipt"
        eyebrow="APPEND-ONLY PROOF"
        title="Decision Receipt pending"
        description="The canonical record appears only after an explicit commitment clears candidate selection and KillSwitch review."
        className="receipt-panel"
      >
        <div className="receipt-pending" role="status" aria-live="polite">
          <CircleHelp size={20} aria-hidden="true" />
          <div>
            <strong>Commit the inspected thesis first</strong>
            <span>No receipt is written while the workspace is still in review.</span>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      id="receipt"
      eyebrow="APPEND-ONLY PROOF"
      title="Decision Receipt"
      description="The committed version is a compact, canonical record of the evidence, policy result, alternatives and challenge."
      className="receipt-panel"
    >
      <div className="receipt-topline">
        <div className="receipt-id"><FileCheck2 size={17} /><span>{receipt.id}</span></div>
        <span className="receipt-schema">schema {receipt.receiptSchemaVersion}</span>
      </div>
      <div className="receipt-grid">
        <Metric label="Asset" value={receipt.asset} accent />
        <Metric label="Version" value={`v${receipt.versionNumber}`} />
        <Metric label="Evidence" value={`${receipt.supportingEvidence.length + receipt.contradictingEvidence.length + receipt.neutralEvidence.length + receipt.unknownEvidence.length} records`} />
        <Metric label="Challenge" value={receipt.killSwitch?.verdict ?? "N/A"} />
      </div>
      <div className="hash-block">
        <div><span className="metric-label">Canonical hash</span><strong>{truncateHash(receipt.canonicalHash)}</strong></div>
        <span className="hash-note">recomputed from canonical payload</span>
      </div>
      <div className="receipt-meta">
        <span>strategy {receipt.strategyId} / {receipt.strategyVersion}</span>
        <span>snapshot {receipt.evidenceSnapshotId}</span>
        <span>created 12:08 UTC</span>
      </div>
    </Panel>
  );
}

export function PracticePanel({
  practice,
}: {
  practice: DemoPracticeState | null;
}) {
  const position = practice?.position ?? null;
  const action = practice?.action ?? null;
  return (
    <Panel
      id="practice"
      eyebrow="SIMULATED PRACTICE"
      title="Track the consequence"
      description="A bounded, non-custodial ledger shows what the decision would imply without executing anything."
      className="practice-panel"
    >
      <div className="practice-policy"><span>$10,000 simulated balance</span><span>$1,000 default notional</span><span>policy 1.0.0</span></div>
      {position === null ? (
        <div className="empty-state practice-empty"><CircleHelp size={20} /><div><strong>No position opened</strong><span>{practice === null ? "Commit an eligible directional thesis to open a simulated position." : "ABSTAIN has no directional practice position."}</span></div></div>
      ) : (
        <div className="practice-position">
          <div className="position-header">
            <div><span className="metric-label">{position.asset} / practice position</span><strong>{position.direction} · ${position.notionalUsd.toLocaleString()}</strong></div>
            <StatusBadge value={position.status} />
          </div>
          <div className="position-metrics">
            <Metric label="Entry" value={`$${position.entryPrice.toFixed(2)}`} />
            <Metric label="Current" value={practice === null ? "—" : `$${practice.currentPrice.toFixed(2)}`} />
            <Metric label="P&L" value={formatPnl(practice?.pnl?.pnlUsd ?? position.realizedPnlUsd ?? null)} accent />
            <Metric label="Return" value={practice?.pnl ? `${practice.pnl.pnlPercent >= 0 ? "+" : ""}${practice.pnl.pnlPercent.toFixed(2)}%` : `${position.realizedPnlPercent && position.realizedPnlPercent >= 0 ? "+" : ""}${position.realizedPnlPercent?.toFixed(2) ?? "—"}%`} />
          </div>
          <div className={`practice-action practice-action-${action?.action.toLowerCase() ?? "none"}`}>
            {action?.action === "CLOSE" ? <CircleAlert size={15} /> : <Check size={15} />}
            <span>{action?.action === "CLOSE" ? `Closed by ${humanize(action.recommendedCloseReason ?? "THESIS_INVALIDATED")}` : "Keep open · invalidation rules maintained"}</span>
          </div>
        </div>
      )}
      <div className="practice-disclaimer"><Sparkles size={14} /><span>Fixture only. No wallet, order, or external execution path exists.</span></div>
    </Panel>
  );
}
