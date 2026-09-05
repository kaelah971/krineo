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
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import type { DemoScenario } from "@/lib/demo/scenarios";

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
  if (["LONG", "CLEAR", "ACTIVE", "MAINTAIN", "KEEP_OPEN", "SUPPORTIVE", "STRONGLY_SUPPORTIVE", "COMPLETE"].includes(value)) {
    return "positive";
  }
  if (["SHORT", "VETO", "INVALIDATE", "CLOSED", "CLOSE", "OPPOSING", "STRONGLY_OPPOSING"].includes(value)) {
    return "negative";
  }
  if (["CAUTION", "WEAKEN", "ELEVATED", "DEGRADED", "NEUTRAL", "PARTIAL"].includes(value)) {
    return "caution";
  }
  if (["INFO", "FIT", "ELIGIBLE"].includes(value)) {
    return "info";
  }
  if (["UNKNOWN", "ABSTAIN", "DEGRADED"].includes(value)) {
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
  const candidates = scenario.receipt.candidateRanking;
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
        {candidates.map((candidate) => (
          <div className={`comparison-row ${candidate.selected ? "comparison-selected" : ""}`} role="row" key={candidate.asset}>
            <div className="candidate-name">
              <span className="candidate-rank">0{candidate.rank}</span>
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
        <span className="challenge-label">MODEL CHALLENGE</span>
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

export function DiffPanel({ scenario }: { scenario: DemoScenario }) {
  const diff = scenario.strategyDiff;
  if (diff === null) {
    return (
      <Panel
        id="diff"
        eyebrow="STRATEGY DIFF"
        title="No directional diff"
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
      eyebrow="VERSION REVIEW"
      title={`Strategy Diff · v${diff.version.before} → v${diff.version.after}`}
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
      {scenario.invalidation ? <InvalidationChain scenario={scenario} /> : null}
    </Panel>
  );
}

function InvalidationChain({ scenario }: { scenario: DemoScenario }) {
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
        <div className="chain-node chain-node-final"><Waypoints size={13} /><span>Practice {scenario.practice.action?.action === "CLOSE" ? "closed" : "kept open"}</span></div>
      </div>
      <p className="diagnostic-copy">{invalidation.triggeredRules.length > 0 ? `${invalidation.triggeredRules[0].ruleType.replaceAll("_", " ")} fired from the precommitted rule set.` : "No invalidation rule was triggered by this refresh."}</p>
    </div>
  );
}

export function ReceiptPanel({ scenario }: { scenario: DemoScenario }) {
  const receipt = scenario.receipt;
  return (
    <Panel
      id="receipt"
      eyebrow="APPEND-ONLY PROOF"
      title="Thesis Receipt"
      description="The current version is a compact, canonical record of the evidence, policy result, alternatives and challenge."
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

export function PracticePanel({ scenario }: { scenario: DemoScenario }) {
  const practice = scenario.practice;
  const position = practice.position;
  const action = practice.action;
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
        <div className="empty-state practice-empty"><CircleHelp size={20} /><div><strong>No position opened</strong><span>ABSTAIN has no directional practice position.</span></div></div>
      ) : (
        <div className="practice-position">
          <div className="position-header">
            <div><span className="metric-label">{position.asset} / practice position</span><strong>{position.direction} · ${position.notionalUsd.toLocaleString()}</strong></div>
            <StatusBadge value={position.status} />
          </div>
          <div className="position-metrics">
            <Metric label="Entry" value={`$${position.entryPrice.toFixed(2)}`} />
            <Metric label="Current" value={`$${practice.currentPrice.toFixed(2)}`} />
            <Metric label="P&L" value={formatPnl(practice.pnl?.pnlUsd ?? position.realizedPnlUsd ?? null)} accent />
            <Metric label="Return" value={practice.pnl ? `${practice.pnl.pnlPercent >= 0 ? "+" : ""}${practice.pnl.pnlPercent.toFixed(2)}%` : `${position.realizedPnlPercent && position.realizedPnlPercent >= 0 ? "+" : ""}${position.realizedPnlPercent?.toFixed(2) ?? "—"}%`} />
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
