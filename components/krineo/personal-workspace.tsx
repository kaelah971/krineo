"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CircleHelp, RotateCcw } from "lucide-react";
import { SiteHeader } from "./site-header";
import { PersonalResearchPanel } from "./personal-research";
import { useWorkspaceState } from "./workspace-state";
import {
  activePlaybook,
  createWorkspace,
  persistWorkspace,
  resetWorkspace,
  type WorkspaceState,
} from "@/lib/workspace/store";

export type PersonalRoute = "workspace" | "playbooks" | "theses" | "receipts" | "practice";

type OnboardingValues = {
  displayName: string;
  workspaceName: string;
};

export function PersonalFrame({
  active = "workspace",
  children,
}: {
  active?: PersonalRoute;
  children: ReactNode;
}) {
  return (
    <div className="app-shell personal-shell">
      <SiteHeader active={active} context="workspace" />
      {children}
      <footer className="app-footer personal-footer">
        <span>KRINEO · PERSONAL WORKSPACE</span>
        <span>SAVED IN THIS BROWSER · NO LIVE EXECUTION</span>
      </footer>
    </div>
  );
}

function Onboarding({
  error,
  onComplete,
}: {
  error: string | null;
  onComplete: (values: OnboardingValues) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("My Trading Workspace");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDisplayName = displayName.trim();
    const nextWorkspaceName = workspaceName.trim();

    if (nextDisplayName.length === 0 || nextWorkspaceName.length === 0) {
      setValidationError("Add a name for you and this workspace to continue.");
      return;
    }

    setValidationError(null);
    onComplete({ displayName: nextDisplayName, workspaceName: nextWorkspaceName });
  }

  const formError = validationError ?? error;

  return (
    <main className="personal-shell-content onboarding-content">
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="onboarding-copy">
          <p className="section-eyebrow">NEW LOCAL WORKSPACE</p>
          <h1 id="onboarding-title">Welcome to Krineo.</h1>
          <p>
            Set up a quiet home for your strategies, decisions and memory. This workspace is saved in this browser only.
          </p>
        </div>
        <form className="onboarding-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="display-name">What should we call you?</label>
            <input
              id="display-name"
              name="displayName"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setValidationError(null);
              }}
              autoComplete="name"
              maxLength={80}
              required
            />
          </div>
          <div className="field-group">
            <label htmlFor="workspace-name">Name your workspace</label>
            <input
              id="workspace-name"
              name="workspaceName"
              value={workspaceName}
              onChange={(event) => {
                setWorkspaceName(event.target.value);
                setValidationError(null);
              }}
              maxLength={100}
              required
            />
          </div>
          {formError ? <p className="form-error" role="alert">{formError}</p> : null}
          <div className="onboarding-actions">
            <button className="button button-dark" type="submit">
              Enter workspace <ArrowRight size={15} aria-hidden="true" />
            </button>
            <Link className="text-link" href="/demo">Explore Golden Demo <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <p className="local-disclosure">No remote profile is created. Your name stays in this browser.</p>
        </form>
      </section>
    </main>
  );
}

export function WorkspaceGate({
  active = "workspace",
  children,
}: {
  active?: PersonalRoute;
  children: ReactNode;
}) {
  const workspace = useWorkspaceState();
  const [storageError, setStorageError] = useState<string | null>(null);

  function handleOnboardingComplete({ displayName, workspaceName }: OnboardingValues) {
    const nextWorkspace = createWorkspace({
      displayName,
      workspaceName,
      createdAt: new Date().toISOString(),
    });
    if (!persistWorkspace(nextWorkspace)) {
      setStorageError("This browser did not allow local storage. The workspace was not created.");
      return;
    }
    setStorageError(null);
  }

  if (workspace === undefined) {
    return (
      <PersonalFrame active={active}>
        <main className="personal-shell-content personal-loading" aria-live="polite">
          <p className="section-eyebrow">LOCAL WORKSPACE</p>
          <p>Preparing your workspace...</p>
        </main>
      </PersonalFrame>
    );
  }

  if (workspace === null) {
    return (
      <PersonalFrame active={active}>
        <Onboarding error={storageError} onComplete={handleOnboardingComplete} />
      </PersonalFrame>
    );
  }

  return <PersonalFrame active={active}>{children}</PersonalFrame>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="personal-empty">
      <span className="personal-empty-icon" aria-hidden="true"><CircleHelp size={15} /></span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

function ResearchSummaryRow({ run }: { run: WorkspaceState["researchRuns"][number] }) {
  const source = run.mode === "REPLAY"
    ? `REPLAY · ${run.replayFixtureId ?? run.providerSource}`
    : run.providerSource;
  return (
    <li className="research-summary-row">
      <div>
        <strong>{run.selectedAsset ?? "No asset selected"}</strong>
        <span>{source} · {new Date(run.createdAt).toLocaleString()}</span>
      </div>
      <div className="research-summary-result">
        <strong>{run.finalDecision}</strong>
        <span>{run.status}</span>
      </div>
    </li>
  );
}

function WorkspaceDashboard() {
  const workspace = useWorkspaceState();
  if (workspace === undefined || workspace === null) return null;

  const playbook = activePlaybook(workspace);
  const summary = [
    ["Playbooks", workspace.playbooks.length, "Personal guardrails"],
    ["Active theses", workspace.theses.length, "From real runs"],
    ["Receipts", workspace.receipts.length, "Canonical artifacts"],
    ["Practice positions", workspace.practicePositions.length, "Simulation only"],
    ["Research runs", workspace.researchRuns.length, "Personal history"],
  ] as const;
  const recentRuns = workspace.researchRuns.slice(0, 3);
  const recentTheses = workspace.theses.slice(0, 3);
  const recentReceipts = workspace.receipts.slice(0, 3);
  const recentPractice = workspace.practicePositions.slice(0, 3);

  return (
    <main className="personal-shell-content dashboard-content">
      <section className="personal-heading" aria-labelledby="personal-title">
        <div>
          <p className="section-eyebrow">{workspace.profile.workspaceName}</p>
          <h1 id="personal-title">{getGreeting()}, {workspace.profile.displayName}.</h1>
          <p>Your strategies, decisions and memory stay together here.</p>
        </div>
        <div className="personal-heading-note"><span className="local-status-dot" /><span>LOCAL WORKSPACE</span></div>
      </section>

      <section className="personal-action-strip" aria-label="Workspace actions">
        <div className="action-strip-heading"><p className="section-eyebrow">START HERE</p><strong>Choose a next step</strong></div>
        <div className="personal-actions">
          <Link className="personal-action personal-action-link" href="/playbooks#new"><span>Create a Playbook</span><ArrowRight size={15} aria-hidden="true" /></Link>
          <a className="personal-action personal-action-link" href="#run-research"><span>Run Market Research</span><ArrowRight size={15} aria-hidden="true" /></a>
          <Link className="personal-action personal-action-link" href="/demo"><span>Explore Golden Demo</span><ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="personal-summary" aria-label="Workspace summary">
        {summary.map(([label, value, note]) => <div className="personal-summary-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}
      </section>

      <section className="personal-grid" aria-label="Personal workspace areas">
        <div className="personal-card personal-card-wide research-card" id="run-research"><PersonalResearchPanel /></div>

        <article className="personal-card" id="active-playbook">
          <div className="personal-card-header"><div><p className="section-eyebrow">PLAYBOOK</p><h2>Active Playbook</h2></div><span className="personal-card-index">01</span></div>
          {playbook ? (
            <div className="active-playbook-detail"><strong>{playbook.displayName}</strong><span>v{playbook.version.versionNumber} · {playbook.version.rules.length} guardrails · HUMAN APPROVED</span><Link className="text-link" href="/playbooks">Manage Playbooks <ArrowRight size={14} /></Link></div>
          ) : <EmptyState title="No Playbook yet." description="Define how Krineo should evaluate decisions." />}
        </article>

        <article className="personal-card" id="memory">
          <div className="personal-card-header"><div><p className="section-eyebrow">MEMORY</p><h2>Memory</h2></div><span className="personal-card-index">02</span></div>
          <EmptyState title="No personal lessons yet." description="Personal Memory Lessons will appear as resolved cases accumulate." />
        </article>

        <article className="personal-card personal-card-wide" id="recent-research">
          <div className="personal-card-header"><div><p className="section-eyebrow">RESEARCH</p><h2>Recent Research</h2></div><Link className="text-link" href="#run-research">Run again <ArrowRight size={14} /></Link></div>
          {recentRuns.length > 0 ? <ul className="research-summary-list">{recentRuns.map((run) => <ResearchSummaryRow key={run.id} run={run} />)}</ul> : <EmptyState title="No personal research yet." description="Run an explicit LIVE or deterministic REPLAY research request above." />}
        </article>

        <article className="personal-card" id="active-theses">
          <div className="personal-card-header"><div><p className="section-eyebrow">THESES</p><h2>Active Theses</h2></div><Link className="text-link" href="/theses">View all <ArrowRight size={14} /></Link></div>
          {recentTheses.length > 0 ? <ul className="compact-record-list">{recentTheses.map((thesis) => <li key={thesis.versionId}><strong>{thesis.asset} · {thesis.decision}</strong><span>{thesis.status} · v{thesis.versionId.slice(-8)}</span></li>)}</ul> : <EmptyState title="No personal theses yet." description="Eligible proposals and committed versions will appear here." />}
        </article>

        <article className="personal-card" id="receipts">
          <div className="personal-card-header"><div><p className="section-eyebrow">RECEIPTS</p><h2>Receipts</h2></div><Link className="text-link" href="/receipts">View all <ArrowRight size={14} /></Link></div>
          {recentReceipts.length > 0 ? <ul className="compact-record-list">{recentReceipts.map((receipt) => <li key={receipt.id}><strong>{receipt.asset} · {receipt.decision}</strong><span>{receipt.canonicalHash.slice(0, 18)}…</span></li>)}</ul> : <EmptyState title="No Decision Receipts yet." description="Canonical receipts appear only after an eligible simulated decision is committed." />}
        </article>

        <article className="personal-card" id="practice">
          <div className="personal-card-header"><div><p className="section-eyebrow">PRACTICE</p><h2>Practice</h2></div><Link className="text-link" href="/practice">View all <ArrowRight size={14} /></Link></div>
          {recentPractice.length > 0 ? <ul className="compact-record-list">{recentPractice.map(({ position, pnl }) => <li key={position.id}><strong>{position.asset} · {position.direction}</strong><span>{pnl === null ? position.status : `${pnl.pnlUsd >= 0 ? "+" : ""}${pnl.pnlUsd.toFixed(2)} USD`}</span></li>)}</ul> : <div className="practice-empty-state"><strong>$10,000 simulated portfolio</strong><p>No open simulated positions.</p><small>SIMULATION ONLY · NO REAL-MONEY EXECUTION</small></div>}
        </article>
      </section>

      <details className="local-settings"><summary>Workspace settings</summary><div className="local-settings-panel"><p>Workspace identity and personal records are saved in this browser only.</p><button className="text-button" type="button" onClick={resetWorkspace}><RotateCcw size={13} aria-hidden="true" /> Reset local workspace</button></div></details>
    </main>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function PersonalWorkspace() {
  return <WorkspaceGate><WorkspaceDashboard /></WorkspaceGate>;
}
