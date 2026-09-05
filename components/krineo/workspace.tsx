"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  Menu,
} from "lucide-react";
import type { DemoScenario, DemoScenarioId } from "@/lib/demo/scenarios";
import {
  ComparisonPanel,
  DecisionPanel,
  DiffPanel,
  EvidencePanel,
  KillSwitchPanel,
  Panel,
  PracticePanel,
  ReceiptPanel,
  StatusBadge,
} from "./panels";

const reviewSteps = [
  { label: "Evidence", href: "#evidence", key: "evidence" },
  { label: "Comparison", href: "#comparison", key: "comparison" },
  { label: "Challenge", href: "#challenge", key: "challenge" },
  { label: "Decision", href: "#decision", key: "decision" },
  { label: "Receipt", href: "#receipt", key: "receipt" },
  { label: "Diff", href: "#diff", key: "diff" },
] as const;

export function KrineoWorkspace({ scenarios }: { scenarios: readonly DemoScenario[] }) {
  const [selectedId, setSelectedId] = useState<DemoScenarioId>(scenarios[0]?.id ?? "directional");
  const scenario = scenarios.find((item) => item.id === selectedId) ?? scenarios[0];

  if (scenario === undefined) {
    return <main className="empty-app">No demo fixture is available.</main>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand-lockup" href="#top" aria-label="Krineo workspace home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span className="brand-name">KRINEO</span>
          <span className="brand-beta">ALPHA</span>
        </a>
        <nav className="topnav" aria-label="Primary navigation">
          <a className="topnav-active" href="#top">Workspace</a>
          <a href="#receipt">Receipts</a>
          <a href="#practice">Practice</a>
        </nav>
        <div className="topbar-meta">
          <span className="fixture-dot" />
          <span>DEMO FIXTURE</span>
          <span className="avatar" aria-label="Demo agent">A</span>
        </div>
        <span className="mobile-menu-icon" aria-hidden="true"><Menu size={19} /></span>
      </header>

      <main id="top" className="shell-content">
        <section className="workspace-hero" aria-labelledby="workspace-title">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="live-pulse" /> KRINEO / AGENT WORKSPACE</div>
            <h1 id="workspace-title">Make the decision <em>legible.</em></h1>
            <p className="hero-lede">An evidence-first workspace for market reasoning that can be inspected, challenged, committed and revisited.</p>
            <div className="hero-actions">
              <a className="button button-dark" href="#decision">Review current decision <ArrowRight size={15} /></a>
              <a className="text-link" href="#evidence">Inspect evidence <ChevronRight size={15} /></a>
            </div>
          </div>
          <div className="hero-instrument" aria-label="Evidence receipt spine">
            <div className="instrument-header"><span>REASONING SPINE</span><span>v1.0</span></div>
            <div className="instrument-line">
              {reviewSteps.slice(0, 5).map((step, index) => (
                <div className="instrument-node" key={step.key}>
                  <span className="instrument-dot">{index < 4 ? <Check size={11} /> : <span />}</span>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
            <div className="instrument-caption">A visible chain from evidence to accountable action.</div>
          </div>
        </section>

        <section className="fixture-bar" aria-labelledby="fixture-title">
          <div className="fixture-heading">
            <div className="fixture-icon"><FlaskConical size={17} /></div>
            <div>
              <p className="section-eyebrow">FIXTURE-DRIVEN PRODUCT SHELL</p>
              <h2 id="fixture-title">Choose an intent to inspect</h2>
            </div>
          </div>
          <div className="scenario-switcher" role="tablist" aria-label="Demo scenarios">
            {scenarios.map((item) => (
              <button
                className={`scenario-tab ${item.id === scenario.id ? "scenario-tab-active" : ""}`}
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === scenario.id}
                onClick={() => setSelectedId(item.id)}
              >
                <span className="scenario-tab-number">0{scenarios.indexOf(item) + 1}</span>
                <span><strong>{item.label}</strong><small>{item.eyebrow}</small></span>
              </button>
            ))}
          </div>
        </section>

        <div className="workspace-grid">
          <aside className="left-rail" aria-label="Workspace review map">
            <div className="rail-block">
              <p className="rail-heading">REVIEW MAP</p>
              <div className="rail-spine">
                {reviewSteps.map((step, index) => {
                  const notApplicable = step.key === "diff" && scenario.strategyDiff === null;
                  return (
                    <a className={`rail-step ${notApplicable ? "rail-step-muted" : ""}`} href={step.href} key={step.key}>
                      <span className="rail-step-marker">{notApplicable ? <CircleHelp size={12} /> : index < 5 ? <Check size={12} /> : <span />}</span>
                      <span>{step.label}</span>
                      {step.key === "decision" ? <StatusBadge value={scenario.currentDecision.decision} /> : null}
                    </a>
                  );
                })}
              </div>
            </div>
            <div className="rail-callout">
              <span className="rail-callout-label">CURRENT INTENT</span>
              <strong>{scenario.request}</strong>
              <span className="rail-callout-caption">Every visible output below comes from this question.</span>
            </div>
            <div className="rail-footer"><span className="fixture-dot" /> No live data connected</div>
          </aside>

          <div className="main-column">
            <section className="request-card" aria-labelledby="request-title">
              <div className="request-card-topline"><span className="section-eyebrow">NATURAL-LANGUAGE REQUEST</span><span className="request-id">intent/{scenario.id}</span></div>
              <h2 id="request-title">{scenario.request}</h2>
              <p>{scenario.description}</p>
              <div className="request-tags"><span>Asset · {scenario.asset}</span><span>Strategy · DM-1 / 1.0.0</span><span>Snapshot · deterministic</span></div>
            </section>
            <div className="section-spine" aria-label="Current review stage">
              <span className="section-spine-line" />
              <span className="section-spine-label">INSPECTING {scenario.asset} / {scenario.currentVersion.evidenceSnapshotId}</span>
            </div>
            <DecisionPanel scenario={scenario} />
            <EvidencePanel scenario={scenario} />
            <ComparisonPanel scenario={scenario} />
            <DiffPanel scenario={scenario} />
            <ReceiptPanel scenario={scenario} />
            <PracticePanel scenario={scenario} />
          </div>

          <aside className="right-rail" aria-label="Decision controls and context">
            <KillSwitchPanel scenario={scenario} />
            <Panel eyebrow="OPEN QUESTIONS" title="Unknowns stay visible" className="side-panel unknown-panel">
              <div className="unknown-list">
                {scenario.currentEvidence.filter((item) => item.state === "UNKNOWN").length > 0 ? scenario.currentEvidence.filter((item) => item.state === "UNKNOWN").map((item) => (
                  <div className="unknown-row" key={item.id}><CircleHelp size={14} /><span>{item.dimension.replaceAll("_", " ").toLowerCase()}</span></div>
                )) : <div className="unknown-row unknown-row-clear"><Check size={14} /><span>No directional unknowns in this snapshot.</span></div>}
              </div>
              <p className="side-caption">The system separates unavailable evidence from neutral evidence before scoring.</p>
            </Panel>
            <Panel eyebrow="PROVENANCE" title="Fixture disclosure" className="side-panel provenance-panel">
              <div className="provenance-stamp"><span className="stamp-top">SIMULATED RESEARCH SNAPSHOT</span><strong>DEMO FIXTURE</strong><span>Generated locally from deterministic domain outputs.</span></div>
              <div className="provenance-list"><div><span>RYO</span><strong>Not connected</strong></div><div><span>Execution</span><strong>Not available</strong></div><div><span>Hash</span><strong>Canonical</strong></div></div>
            </Panel>
          </aside>
        </div>
      </main>

      <footer className="app-footer"><span>KRINEO · ACCOUNTABLE MARKET REASONING</span><span>DEVELOPMENT SHELL · NO LIVE EXECUTION</span></footer>
    </div>
  );
}
