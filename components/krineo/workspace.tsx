"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  Search,
} from "lucide-react";
import { requestDemoCommit, requestDemoRefresh } from "@/lib/demo/client";
import {
  applyApprovedDemoProposal,
  approveDemoRule,
  createDemoPlaybookAuthoringState,
  evaluateDemoAuthoring,
  proposeDemoRule,
  rejectDemoRule,
  type DemoPlaybookAuthoringState,
} from "@/lib/demo/authoring";
import {
  approveDemoMemoryLesson,
  createDemoMemoryLessonState,
  rejectDemoMemoryLesson,
  type DemoMemoryLessonState,
} from "@/lib/demo/memory-lessons";
import type { PlaybookRule } from "@/lib/playbook";
import type { DemoCommitResult } from "@/lib/demo/commit";
import type { DemoRefreshResult } from "@/lib/demo/refresh";
import { resolveDemoIntent } from "@/lib/demo/intent";
import type {
  DemoScenario,
  DemoScenarioId,
  DemoScenarioPhase,
} from "@/lib/demo/scenarios";
import {
  CommitPanel,
  ComparisonPanel,
  DecisionContextPanel,
  DecisionPanel,
  DiffPanel,
  EvidencePanel,
  KillSwitchPanel,
  Panel,
  PracticePanel,
  ReceiptPanel,
  RefreshPanel,
  StatusBadge,
} from "./panels";
import { GoldenOverview } from "./golden-overview";
import { MemoryLessonPanel } from "./memory-lesson";
import { PlaybookAuthoringPanel } from "./playbook-authoring";
import { SiteHeader } from "./site-header";

const reviewSteps = [
  { label: "Evidence", href: "#evidence", key: "evidence" },
  { label: "Comparison", href: "#comparison", key: "comparison" },
  { label: "Challenge", href: "#challenge", key: "challenge" },
  { label: "Decision", href: "#decision", key: "decision" },
  { label: "Receipt", href: "#receipt", key: "receipt" },
  { label: "Change", href: "#diff", key: "diff" },
] as const;

function scenarioAtPhase(
  scenario: DemoScenario,
  phase: DemoScenarioPhase,
): DemoScenario {
  if (phase === "current") return scenario;

  const thesis = {
    ...scenario.thesis,
    currentVersionId: scenario.originalVersion.id,
    currentVersionNumber: scenario.originalVersion.versionNumber,
    status: scenario.originalVersion.statusAtCommit,
    updatedAt: scenario.originalVersion.createdAt,
  };

  return {
    ...scenario,
    thesis,
    currentVersion: scenario.originalVersion,
    currentDecision: scenario.originalDecision,
    currentCandidates: scenario.originalCandidates,
    currentEvidenceSnapshot: scenario.originalEvidenceSnapshot,
    currentGovernance: scenario.originalGovernance,
    currentEvidence: scenario.originalEvidence,
    currentKillSwitch: scenario.originalKillSwitch,
    currentKillSwitchValidation: scenario.originalKillSwitchValidation,
    strategyDiff: null,
    invalidation: null,
    invalidationRules: scenario.originalInvalidationRules,
    practice: scenario.originalPractice,
  };
}

export function KrineoWorkspace({ scenarios }: { scenarios: readonly DemoScenario[] }) {
  const canonicalScenario = scenarios.find((item) => item.id === "changed") ?? scenarios[0];
  const [selectedId, setSelectedId] = useState<DemoScenarioId>(canonicalScenario?.id ?? "directional");
  const [intent, setIntent] = useState(canonicalScenario?.request ?? "");
  const [intentError, setIntentError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<DemoCommitResult | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitPending, setCommitPending] = useState(false);
  const [refreshResult, setRefreshResult] = useState<DemoRefreshResult | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshPending, setRefreshPending] = useState(false);
  const [phase, setPhase] = useState<DemoScenarioPhase>("original");
  const [authoringState, setAuthoringState] = useState<DemoPlaybookAuthoringState | null>(() => {
    return canonicalScenario === undefined
      ? null
      : createDemoPlaybookAuthoringState(
          scenarioAtPhase(canonicalScenario, "original").currentGovernance,
        );
  });
  const [authoringError, setAuthoringError] = useState<string | null>(null);
  const [memoryLessonError, setMemoryLessonError] = useState<string | null>(null);
  const [memoryLessonState, setMemoryLessonState] = useState<DemoMemoryLessonState | null>(() => {
    return canonicalScenario === undefined
      ? null
      : createDemoMemoryLessonState({
          governance: scenarioAtPhase(canonicalScenario, "original").currentGovernance,
          proposalIdPrefix: "demo-memory-lesson-proposal",
          proposedVersionIdPrefix: "demo-memory-lesson-version",
          createdAt: "2026-09-05T12:03:00.000Z",
        });
  });
  const baseScenario = scenarios.find((item) => item.id === selectedId);
  const initialScenario = baseScenario === undefined
    ? scenarios[0]
    : scenarioAtPhase(baseScenario, phase);
  const scenarioBeforeAuthoring =
    refreshResult?.ok && baseScenario !== undefined && phase === "current"
      ? {
          ...scenarioAtPhase(baseScenario, "current"),
          thesis: refreshResult.thesis,
          currentVersion: refreshResult.version,
          currentDecision: refreshResult.currentDecision,
          currentCandidates: refreshResult.currentCandidates,
          currentEvidence: refreshResult.currentEvidence,
          currentKillSwitch: refreshResult.currentKillSwitch,
          invalidationRules: refreshResult.invalidationRules,
          strategyDiff: refreshResult.diff,
          invalidation: refreshResult.invalidation,
          practice: refreshResult.practice,
        }
      : initialScenario;
  const evaluatedAuthoring =
    authoringState !== null && scenarioBeforeAuthoring !== undefined
      ? evaluateDemoAuthoring(
          authoringState,
          scenarioBeforeAuthoring.currentGovernance,
          scenarioBeforeAuthoring.currentDecision,
          scenarioBeforeAuthoring.currentEvidenceSnapshot,
        )
      : null;
  const scenario =
    evaluatedAuthoring !== null && scenarioBeforeAuthoring !== undefined
      ? { ...scenarioBeforeAuthoring, currentGovernance: evaluatedAuthoring }
      : scenarioBeforeAuthoring;
  const displayedReceipt =
    refreshResult?.ok === true
      ? refreshResult.receipt
      : commitResult?.ok === true
        ? commitResult.receipt
        : null;
  const displayedPractice =
    refreshResult?.ok === true
      ? refreshResult.practice
      : commitResult?.ok === true
        ? commitResult.practice
        : null;

  function handleScenarioSelect(id: DemoScenarioId) {
    setSelectedId(id);
    const nextScenario = scenarios.find((item) => item.id === id);
    setIntent(nextScenario?.request ?? "");
    setIntentError(null);
    setCommitResult(null);
    setCommitError(null);
    setCommitPending(false);
    setRefreshResult(null);
    setRefreshError(null);
    setRefreshPending(false);
    setAuthoringError(null);
    setMemoryLessonError(null);
    setPhase("original");
    setAuthoringState(
      nextScenario === undefined
        ? null
        : createDemoPlaybookAuthoringState(
            scenarioAtPhase(nextScenario, "original").currentGovernance,
          ),
    );
    setMemoryLessonState(
      nextScenario === undefined
        ? null
        : createDemoMemoryLessonState({
            governance: scenarioAtPhase(nextScenario, "original").currentGovernance,
            proposalIdPrefix: "demo-memory-lesson-proposal",
            proposedVersionIdPrefix: "demo-memory-lesson-version",
            createdAt: "2026-09-05T12:03:00.000Z",
          }),
    );
  }

  function handleIntentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resolvedId = resolveDemoIntent(intent, scenarios);

    if (resolvedId === null) {
      setIntentError(
        "This offline workspace supports SOL intents and the three demo states. Try a suggested question or choose a scenario below.",
      );
      return;
    }

    setSelectedId(resolvedId);
    setIntentError(null);
    setCommitResult(null);
    setCommitError(null);
    setCommitPending(false);
    setRefreshResult(null);
    setRefreshError(null);
    setRefreshPending(false);
    setAuthoringError(null);
    setMemoryLessonError(null);
    setPhase("original");
    const nextScenario = scenarios.find((item) => item.id === resolvedId);
    setAuthoringState(
      nextScenario === undefined
        ? null
        : createDemoPlaybookAuthoringState(
            scenarioAtPhase(nextScenario, "original").currentGovernance,
          ),
    );
    setMemoryLessonState(
      nextScenario === undefined
        ? null
        : createDemoMemoryLessonState({
            governance: scenarioAtPhase(nextScenario, "original").currentGovernance,
            proposalIdPrefix: "demo-memory-lesson-proposal",
            proposedVersionIdPrefix: "demo-memory-lesson-version",
            createdAt: "2026-09-05T12:03:00.000Z",
          }),
    );
  }

  async function handleCommit() {
    if (commitResult?.ok === true || commitPending) return;

    setCommitPending(true);
    setCommitError(null);

    try {
      setPhase("original");
      setRefreshResult(null);
      setRefreshError(null);
      setCommitResult(await requestDemoCommit(scenario.id, "original"));
    } catch (error) {
      setCommitError(
        error instanceof Error
          ? error.message
          : "The offline commitment check could not be completed.",
      );
    } finally {
      setCommitPending(false);
    }
  }

  async function handleRefresh() {
    if (
      !commitResult?.ok ||
      phase !== "original" ||
      refreshResult?.ok === true ||
      refreshPending
    ) {
      return;
    }

    setRefreshPending(true);
    setRefreshError(null);

    try {
      const result = await requestDemoRefresh(scenario.id, commitResult.version.id);
      setRefreshResult(result);
      if (result.ok) {
        setPhase("current");
      }
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : "The offline evidence refresh could not be completed.",
      );
    } finally {
      setRefreshPending(false);
    }
  }

  function handleProposeRule(rule: PlaybookRule) {
    if (authoringState === null) return;
    if (memoryLessonState?.status === "PENDING") {
      setAuthoringError("Resolve the pending Memory Lesson proposal before creating another Playbook proposal.");
      return;
    }
    const result = proposeDemoRule(authoringState, rule);
    if (result.ok !== true) {
      setAuthoringError(result.message);
      return;
    }
    setAuthoringError(null);
    setAuthoringState(result.state);
  }

  function handleApproveRule() {
    if (authoringState === null) return;
    const result = approveDemoRule(authoringState);
    if (result.ok !== true) {
      setAuthoringError(result.message);
      return;
    }
    setAuthoringError(null);
    setAuthoringState(result.state);
  }

  function handleRejectRule() {
    if (authoringState === null) return;
    const result = rejectDemoRule(authoringState);
    if (result.ok !== true) {
      setAuthoringError(result.message);
      return;
    }
    setAuthoringError(null);
    setAuthoringState(result.state);
  }

  function handleApproveMemoryLesson() {
    if (memoryLessonState === null || authoringState === null) return;
    const result = approveDemoMemoryLesson(
      memoryLessonState,
      authoringState,
      "2026-09-05T12:05:00.000Z",
    );
    if (result.ok !== true) {
      setMemoryLessonError(result.message);
      return;
    }
    setMemoryLessonError(null);
    setMemoryLessonState(result.state);
    setAuthoringState(applyApprovedDemoProposal(authoringState, result.approval));
  }

  function handleRejectMemoryLesson() {
    if (memoryLessonState === null) return;
    const result = rejectDemoMemoryLesson(
      memoryLessonState,
      "2026-09-05T12:05:00.000Z",
    );
    if (result.ok !== true) {
      setMemoryLessonError(result.message);
      return;
    }
    setMemoryLessonError(null);
    setMemoryLessonState(result.state);
  }

  if (scenario === undefined || authoringState === null || memoryLessonState === null) {
    return <main className="empty-app">No demo fixture is available.</main>;
  }

  return (
    <div className="app-shell">
      <SiteHeader active="demo" context="demo" />

      <main id="top" className="shell-content">
        <section className="workspace-hero" aria-labelledby="workspace-title">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="fixture-dot" /> GOLDEN DEMO / DETERMINISTIC FIXTURE</div>
            <h1 id="workspace-title">See Krineo <em>in action.</em></h1>
            <p className="hero-lede">A deterministic walkthrough of the full decision flow using a preloaded market case. This is a fixed demo fixture, not live trading.</p>
            <div className="hero-actions">
              <a className="button button-dark" href="#golden-demo">Start demo <ArrowRight size={15} /></a>
              <a className="text-link" href="#evidence">Learn how it works <ChevronRight size={15} /></a>
            </div>
          </div>
          <div className="hero-instrument" aria-label="Deterministic result preview">
            <div className="instrument-header"><span>DETERMINISTIC RESULT</span><span>{scenario.asset} / FIXTURE</span></div>
            <div className="instrument-preview-grid">
              <div><span>SELECTED ASSET</span><strong>{scenario.asset}</strong><small>Evidence path</small></div>
              <div><span>DECISION</span><strong>{scenario.currentDecision.decision}</strong><small>Guardrails applied</small></div>
            </div>
            <div className="instrument-chart" aria-hidden="true"><svg viewBox="0 0 420 70"><path d="M0 55 C35 52 46 42 75 47 S116 58 146 39 S193 28 222 37 S263 51 291 26 S340 20 363 29 S390 21 420 12" /></svg></div>
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

        <GoldenOverview
          scenario={scenario}
          lessonState={memoryLessonState}
          activeVersionNumber={authoringState.activeVersion.versionNumber}
          commitResult={commitResult}
          refreshResult={refreshResult}
        />

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
                onClick={() => handleScenarioSelect(item.id)}
              >
                <span className="scenario-tab-number">0{scenarios.indexOf(item) + 1}</span>
                <span><strong>{item.label}</strong><small>{item.eyebrow}</small></span>
              </button>
            ))}
          </div>
        </section>

        <section className="intent-launcher" aria-labelledby="intent-launcher-title">
          <div className="intent-launcher-copy">
            <p className="section-eyebrow">NATURAL-LANGUAGE INTENT</p>
            <h2 id="intent-launcher-title">Start with the question, not the ticker.</h2>
            <p>
              Ask the fixture-backed workspace to inspect a supported SOL market question. The selected intent updates the evidence path below.
            </p>
          </div>
          <form className="intent-form" onSubmit={handleIntentSubmit}>
            <label className="sr-only" htmlFor="intent-input">Market question</label>
            <div className="intent-input-wrap">
              <Search size={16} aria-hidden="true" />
              <input
                id="intent-input"
                value={intent}
                onChange={(event) => {
                  setIntent(event.target.value);
                  setIntentError(null);
                }}
                placeholder="e.g. Is SOL still the clearest long opportunity?"
                aria-describedby={intentError ? "intent-help intent-error" : "intent-help"}
                aria-invalid={intentError ? true : undefined}
              />
            </div>
            <button className="button button-dark" type="submit">
              Inspect intent <ArrowRight size={15} aria-hidden="true" />
            </button>
          </form>
          <div className="intent-meta">
            <span id="intent-help">Offline fixture mode · no live market request is made.</span>
            <span aria-live="polite">Showing: {scenario.label}</span>
          </div>
          {intentError ? <p className="intent-error" id="intent-error" role="alert">{intentError}</p> : null}
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
            <DecisionContextPanel scenario={scenario} />
            <MemoryLessonPanel
              state={memoryLessonState}
              historicalCases={scenario.originalGovernance.historicalCases}
              activeVersionNumber={authoringState.activeVersion.versionNumber}
              error={memoryLessonError}
              onApprove={handleApproveMemoryLesson}
              onReject={handleRejectMemoryLesson}
            />
            <EvidencePanel scenario={scenario} />
            <ComparisonPanel scenario={scenario} />
            <DiffPanel scenario={scenario} practice={displayedPractice} />
            <ReceiptPanel receipt={displayedReceipt} />
            <PracticePanel practice={displayedPractice} />
          </div>

          <aside className="right-rail" aria-label="Decision controls and context">
            <CommitPanel
              scenario={scenario}
              result={commitResult}
              error={commitError}
              pending={commitPending}
              onCommit={handleCommit}
            />
            <RefreshPanel
              result={refreshResult}
              previousReceipt={commitResult?.ok === true ? commitResult.receipt : null}
              error={refreshError}
              pending={refreshPending}
              canRefresh={commitResult?.ok === true && phase === "original"}
              onRefresh={handleRefresh}
            />
            <PlaybookAuthoringPanel
              state={authoringState}
              error={authoringError}
              onPropose={handleProposeRule}
              onApprove={handleApproveRule}
              onReject={handleRejectRule}
              blocked={memoryLessonState.status === "PENDING"}
            />
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
              <div className="provenance-stamp"><span className="stamp-top">DEMO RESEARCH SNAPSHOT</span><strong>FIXTURE-BACKED</strong><span>Deterministic evidence only. This is not live RYO market data.</span></div>
              <div className="provenance-list"><div><span>Evidence</span><strong>Fixture-backed</strong></div><div><span>RYO data</span><strong>Not used</strong></div><div><span>Receipt</span><strong>Canonical</strong></div></div>
              <div className="provenance-developer">
                <span className="stamp-top">DEVELOPER</span>
                <a href="/api/skills/strategy_preflight">strategy_preflight skill <ArrowRight size={12} aria-hidden="true" /></a>
                <small>GET /api/skills/strategy_preflight</small>
              </div>
            </Panel>
          </aside>
        </div>
      </main>

      <footer className="app-footer"><span>KRINEO · ACCOUNTABLE MARKET REASONING</span><span>DEVELOPMENT SHELL · NO LIVE EXECUTION</span></footer>
    </div>
  );
}
