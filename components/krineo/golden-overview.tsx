"use client";

import { ArrowRight, Check, CircleAlert, GitBranch, ShieldCheck } from "lucide-react";
import type { DemoCommitResult } from "@/lib/demo/commit";
import type { DemoMemoryLessonState } from "@/lib/demo/memory-lessons";
import type { DemoRefreshResult } from "@/lib/demo/refresh";
import type { DemoScenario } from "@/lib/demo/scenarios";
import { StatusBadge } from "./panels";

interface GoldenOverviewProps {
  readonly scenario: DemoScenario;
  readonly lessonState: DemoMemoryLessonState;
  readonly activeVersionNumber: number;
  readonly commitResult: DemoCommitResult | null;
  readonly refreshResult: DemoRefreshResult | null;
}

function preflightReason(scenario: DemoScenario): string {
  const preflight = scenario.currentGovernance.preflight;
  if (preflight.status === "FIT") {
    return `${preflight.marketDecision} is the market view and the approved Playbook has no active guardrail.`;
  }
  if (preflight.status === "CAUTION") {
    return `${preflight.marketDecision} is the market view, but the approved Playbook is applying caution.`;
  }
  if (preflight.status === "WAIT") {
    return `${preflight.marketDecision} is the market view, but the approved Playbook requires a wait.`;
  }
  return `${preflight.marketDecision} is the market view, but the approved Playbook blocks eligibility.`;
}

function lessonStage(state: DemoMemoryLessonState): string {
  if (state.status === "PENDING") return "Review lesson";
  if (state.status === "APPROVED") return "Rule active";
  if (state.status === "REJECTED") return "Dismissed";
  if (state.status === "DUPLICATE") return "Already covered";
  return "No lesson";
}

export function GoldenOverview({
  scenario,
  lessonState,
  activeVersionNumber,
  commitResult,
  refreshResult,
}: GoldenOverviewProps) {
  const preflight = scenario.currentGovernance.preflight;
  const committed = commitResult?.ok === true;
  const refreshed = refreshResult?.ok === true;
  const preflightChanged = refreshed && scenario.originalGovernance.preflight.status !== preflight.status;
  const preflightDetail = preflightChanged
    ? `${scenario.originalGovernance.preflight.status} → ${preflight.status} after refresh`
    : `Approved Playbook v${activeVersionNumber} · ${preflight.playbookEffect}`;

  return (
    <section id="golden-demo" className="golden-overview" aria-labelledby="golden-overview-title">
      <div className="golden-overview-header">
        <div>
          <p className="section-eyebrow">KRINEO / GOLDEN DEMO</p>
          <h2 id="golden-overview-title">The strategy memory and decision guardrail for AI trading.</h2>
          <p>Your AI-assisted trading workflow shouldn&apos;t forget its own rules.</p>
        </div>
        <div className="golden-provenance">
          <span className="fixture-dot" />
          <span>DEMO RESEARCH SNAPSHOT</span>
        </div>
      </div>

      <div className="golden-model" aria-label="Product model">
        <span>PLAYBOOK</span><ArrowRight size={13} aria-hidden="true" /><span>PREFLIGHT</span><ArrowRight size={13} aria-hidden="true" /><span>MEMORY</span><ArrowRight size={13} aria-hidden="true" /><span>WATCH / CHANGE</span>
      </div>

      <div className="golden-now-grid">
        <div className="golden-now-card golden-market-card">
          <span className="metric-label">Market view</span>
          <strong>{preflight.marketDecision}</strong>
          <span>DM-1 evidence · {scenario.asset}</span>
        </div>
        <div className="golden-flow-arrow" aria-hidden="true"><ArrowRight size={20} /></div>
        <div className="golden-now-card golden-preflight-card" aria-live="polite">
          <div className="golden-card-topline">
            <span className="metric-label">Strategy Preflight</span>
            <StatusBadge value={preflight.status} />
          </div>
          <strong>{preflight.status}</strong>
          <span>{preflightDetail}</span>
        </div>
      </div>
      <p className="golden-reason"><ShieldCheck size={15} aria-hidden="true" /> {preflightReason(scenario)}</p>

      <nav className="golden-concepts" aria-label="Golden demo concepts">
        <a href="#context"><span>01</span><strong>NOW</strong><small>Market view</small></a>
        <a href="#context"><span>02</span><strong>RULES</strong><small>Approved guardrails</small></a>
        <a href="#memory-lesson"><span>03</span><strong>MEMORY</strong><small>{lessonStage(lessonState)}</small></a>
        <a href="#diff"><span>04</span><strong>CHANGE</strong><small>{refreshed ? "Diff available" : "Refresh later"}</small></a>
      </nav>

      <div className="golden-journey" aria-label="Golden demo journey">
        <div className="golden-journey-step golden-journey-current"><span>01</span><div><strong>Inspect</strong><small>NOW / RULES / MEMORY</small></div><Check size={14} aria-hidden="true" /></div>
        <div className="golden-journey-line" />
        <div className={`golden-journey-step ${lessonState.status === "APPROVED" ? "golden-journey-complete" : ""}`}><span>02</span><div><strong>{lessonStage(lessonState)}</strong><small>Human approval required</small></div>{lessonState.status === "APPROVED" ? <Check size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}</div>
        <div className="golden-journey-line" />
        <div className={`golden-journey-step ${committed ? "golden-journey-complete" : ""}`}><span>03</span><div><strong>{committed ? "Committed" : "Commit"}</strong><small>Decision Receipt</small></div>{committed ? <Check size={14} aria-hidden="true" /> : <GitBranch size={14} aria-hidden="true" />}</div>
        <div className="golden-journey-line" />
        <div className={`golden-journey-step ${refreshed ? "golden-journey-complete" : ""}`}><span>04</span><div><strong>{refreshed ? "Changed" : "Change"}</strong><small>Strategy Diff</small></div>{refreshed ? <Check size={14} aria-hidden="true" /> : <GitBranch size={14} aria-hidden="true" />}</div>
      </div>
    </section>
  );
}
