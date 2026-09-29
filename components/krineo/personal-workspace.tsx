"use client";

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CircleHelp, RotateCcw } from "lucide-react";
import { SiteHeader } from "./site-header";
import {
  clearLocalWorkspaceState,
  createLocalWorkspaceState,
  LOCAL_WORKSPACE_STORAGE_KEY,
  readLocalWorkspaceState,
  saveLocalWorkspaceState,
  type LocalWorkspaceState,
} from "@/lib/workspace/local-profile";

type OnboardingValues = {
  displayName: string;
  workspaceName: string;
};

let clientWorkspaceSnapshot: LocalWorkspaceState | null = null;
let hasReadClientWorkspaceSnapshot = false;
const workspaceSubscribers = new Set<() => void>();

function getClientWorkspaceSnapshot() {
  if (!hasReadClientWorkspaceSnapshot) {
    clientWorkspaceSnapshot = readLocalWorkspaceState();
    hasReadClientWorkspaceSnapshot = true;
  }

  return clientWorkspaceSnapshot;
}

function getServerWorkspaceSnapshot() {
  return undefined;
}

function subscribeToWorkspaceStorage(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  function handleStorageChange(event: StorageEvent) {
    if (event.key !== LOCAL_WORKSPACE_STORAGE_KEY) return;
    clientWorkspaceSnapshot = readLocalWorkspaceState();
    hasReadClientWorkspaceSnapshot = true;
    onStoreChange();
  }

  workspaceSubscribers.add(onStoreChange);
  window.addEventListener("storage", handleStorageChange);
  return () => {
    workspaceSubscribers.delete(onStoreChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function updateClientWorkspaceSnapshot(nextWorkspace: LocalWorkspaceState | null) {
  clientWorkspaceSnapshot = nextWorkspace;
  hasReadClientWorkspaceSnapshot = true;
  workspaceSubscribers.forEach((subscriber) => subscriber());
}

function PersonalFrame({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell personal-shell">
      <SiteHeader active="workspace" context="workspace" />
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

function WorkspaceDashboard({
  workspace,
  onReset,
}: {
  workspace: LocalWorkspaceState;
  onReset: () => void;
}) {
  const summary = [
    ["Playbooks", workspace.playbooks.length, "Personal guardrails"] as const,
    ["Active theses", workspace.activeTheses.length, "Current market views"] as const,
    ["Receipts", workspace.receipts.length, "Committed decisions"] as const,
    ["Practice positions", workspace.practicePositions.length, "Simulated only"] as const,
    ["Memory lessons awaiting review", workspace.memoryLessonsAwaitingReview.length, "Resolved cases"] as const,
  ];
  const greeting = getGreeting();

  return (
    <main className="personal-shell-content dashboard-content">
      <section className="personal-heading" aria-labelledby="personal-title">
        <div>
          <p className="section-eyebrow">{workspace.workspaceName}</p>
          <h1 id="personal-title">{greeting}, {workspace.displayName}.</h1>
          <p>Your strategies, decisions and memory stay together here.</p>
        </div>
        <div className="personal-heading-note">
          <span className="local-status-dot" />
          <span>LOCAL WORKSPACE</span>
        </div>
      </section>

      <section className="personal-action-strip" aria-label="Workspace actions">
        <div className="action-strip-heading">
          <p className="section-eyebrow">START HERE</p>
          <strong>Choose a next step</strong>
        </div>
        <div className="personal-actions">
          <button className="personal-action" type="button" disabled>
            <span>Create a Playbook</span>
            <small>Coming next</small>
          </button>
          <button className="personal-action" type="button" disabled>
            <span>Run Market Research</span>
            <small>Coming next</small>
          </button>
          <Link className="personal-action personal-action-link" href="/demo">
            <span>Explore Golden Demo</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="personal-summary" aria-label="Workspace summary">
        {summary.map(([label, value, note]) => (
          <div className="personal-summary-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </section>

      <section className="personal-grid" aria-label="Personal workspace areas">
        <article className="personal-card personal-card-wide research-card" id="ask-krineo">
          <div className="personal-card-header">
            <div>
              <p className="section-eyebrow">ASK KRINEO</p>
              <h2>Start with a question.</h2>
            </div>
            <span className="personal-card-status">NOT CONNECTED</span>
          </div>
          <p className="personal-card-description">
            Personal research wiring arrives in the next product slice. Nothing is sent from this screen yet.
          </p>
          <div className="research-composer" aria-describedby="research-composer-note">
            <label htmlFor="research-question">Research question</label>
            <div className="research-input-row">
              <input id="research-question" placeholder="e.g. What changed in my market view?" disabled />
              <button className="button button-dark" type="button" disabled>Ask Krineo</button>
            </div>
            <p id="research-composer-note">This empty composer does not call fixture research or a live market service.</p>
          </div>
        </article>

        <article className="personal-card" id="active-playbook">
          <div className="personal-card-header">
            <div>
              <p className="section-eyebrow">PLAYBOOK</p>
              <h2>Active Playbook</h2>
            </div>
            <span className="personal-card-index">01</span>
          </div>
          <EmptyState title="No Playbook yet." description="Define how Krineo should evaluate decisions." />
        </article>

        <article className="personal-card" id="recent-decisions">
          <div className="personal-card-header">
            <div>
              <p className="section-eyebrow">DECISIONS</p>
              <h2>Recent Decisions</h2>
            </div>
            <span className="personal-card-index">02</span>
          </div>
          <EmptyState title="No committed decisions yet." description="Your first receipt will appear here after a personal decision flow exists." />
        </article>

        <article className="personal-card" id="memory">
          <div className="personal-card-header">
            <div>
              <p className="section-eyebrow">MEMORY</p>
              <h2>Memory</h2>
            </div>
            <span className="personal-card-index">03</span>
          </div>
          <EmptyState title="Krineo has no resolved cases to compare yet." description="Memory lessons will come from your own completed decisions." />
        </article>

        <article className="personal-card" id="practice">
          <div className="personal-card-header">
            <div>
              <p className="section-eyebrow">PRACTICE</p>
              <h2>Practice</h2>
            </div>
            <span className="personal-card-index">04</span>
          </div>
          <div className="practice-empty-state">
            <strong>$10,000 simulated portfolio</strong>
            <p>No open simulated positions.</p>
            <small>Simulation only · no real-money execution</small>
          </div>
        </article>

        <article className="personal-card personal-card-wide" id="receipts">
          <div className="personal-card-header">
            <div>
              <p className="section-eyebrow">RECEIPTS</p>
              <h2>Decision Receipts</h2>
            </div>
            <span className="personal-card-index">05</span>
          </div>
          <EmptyState title="No Decision Receipts yet." description="Receipts will preserve the evidence behind your own committed decisions." />
        </article>
      </section>

      <details className="local-settings">
        <summary>Workspace settings</summary>
        <div className="local-settings-panel">
          <p>Workspace identity is saved in this browser only.</p>
          <button className="text-button" type="button" onClick={onReset}><RotateCcw size={13} aria-hidden="true" /> Reset local workspace</button>
        </div>
      </details>
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
  const workspace = useSyncExternalStore(
    subscribeToWorkspaceStorage,
    getClientWorkspaceSnapshot,
    getServerWorkspaceSnapshot,
  );
  const [storageError, setStorageError] = useState<string | null>(null);

  function handleOnboardingComplete({ displayName, workspaceName }: OnboardingValues) {
    const nextWorkspace = createLocalWorkspaceState({ displayName, workspaceName });
    if (!saveLocalWorkspaceState(nextWorkspace)) {
      setStorageError("This browser did not allow local storage. The workspace was not created.");
      return;
    }

    setStorageError(null);
    updateClientWorkspaceSnapshot(nextWorkspace);
  }

  function handleReset() {
    clearLocalWorkspaceState();
    setStorageError(null);
    updateClientWorkspaceSnapshot(null);
  }

  if (workspace === undefined) {
    return (
      <PersonalFrame>
        <main className="personal-shell-content personal-loading" aria-live="polite">
          <p className="section-eyebrow">LOCAL WORKSPACE</p>
          <p>Preparing your workspace...</p>
        </main>
      </PersonalFrame>
    );
  }

  if (workspace === null) {
    return (
      <PersonalFrame>
        <Onboarding error={storageError} onComplete={handleOnboardingComplete} />
      </PersonalFrame>
    );
  }

  return (
    <PersonalFrame>
      <WorkspaceDashboard workspace={workspace} onReset={handleReset} />
    </PersonalFrame>
  );
}
