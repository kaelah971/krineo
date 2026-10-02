"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, Trash2 } from "lucide-react";
import { StatusBadge } from "./panels";
import { useWorkspaceState } from "./workspace-state";
import { WorkspaceGate, type PersonalRoute } from "./personal-workspace";
import {
  createPlaybook,
  deletePlaybook,
  persistWorkspace,
  setActivePlaybook,
  type WorkspaceState,
} from "@/lib/workspace/store";

export function PlaybooksRoute() {
  return <WorkspaceGate active="playbooks"><PlaybooksContent /></WorkspaceGate>;
}

export function ThesesRoute() {
  return <WorkspaceGate active="theses"><ThesesContent /></WorkspaceGate>;
}

export function ReceiptsRoute() {
  return <WorkspaceGate active="receipts"><ReceiptsContent /></WorkspaceGate>;
}

export function PracticeRoute() {
  return <WorkspaceGate active="practice"><PracticeContent /></WorkspaceGate>;
}

function RouteHeader({ eyebrow, title, description, active }: { eyebrow: string; title: string; description: string; active: PersonalRoute }) {
  return (
    <section className="personal-route-header" aria-labelledby={`${active}-page-title`}>
      <div><p className="section-eyebrow">{eyebrow}</p><h1 id={`${active}-page-title`}>{title}</h1><p>{description}</p></div>
      <Link className="text-link" href="/workspace">Back to Workspace <ArrowRight size={14} /></Link>
    </section>
  );
}

function RouteContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`personal-shell-content personal-route-content ${className}`}>{children}</main>;
}

function PlaybooksContent() {
  const workspace = useWorkspaceState();
  const [name, setName] = useState("Defensible Momentum Guardrails");
  const [message, setMessage] = useState<string | null>(null);
  if (workspace === undefined || workspace === null) return null;
  const currentWorkspace = workspace;

  function create() {
    try {
      const next = createPlaybook(currentWorkspace, name);
      if (!persistWorkspace(next)) throw new Error("The Playbook could not be saved in this browser.");
      setMessage("Playbook created and stored locally.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Playbook could not be created.");
    }
  }

  function activate(id: string) {
    try {
      const next = setActivePlaybook(currentWorkspace, id);
      if (!persistWorkspace(next)) throw new Error("The active Playbook could not be saved.");
      setMessage("Active Playbook updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The active Playbook could not be updated.");
    }
  }

  function remove(id: string) {
    const result = deletePlaybook(currentWorkspace, id);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (!persistWorkspace(result.workspace)) {
      setMessage("The Playbook could not be removed from this browser.");
      return;
    }
    setMessage("Playbook removed.");
  }

  return (
    <RouteContent>
      <RouteHeader active="playbooks" eyebrow="PERSONAL GUARDRAILS" title="Playbooks" description="Define the approved rules Krineo uses to evaluate your decisions." />
      <section className="personal-route-grid">
        <article className="personal-card create-playbook-card" id="new">
          <p className="section-eyebrow">START WITH A TEMPLATE</p>
          <h2>Defensible Momentum Guardrails</h2>
          <p className="personal-card-description">A conservative starter Playbook for DM-1. It waits on abstentions, blocks safety vetoes and adds caution to extreme risk.</p>
          <label className="research-field"><span>Playbook display name</span><input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} /></label>
          <button className="button button-dark" type="button" onClick={create}>Create Playbook <ArrowRight size={15} /></button>
          {message ? <p className="route-message" aria-live="polite">{message}</p> : null}
        </article>
        <article className="personal-card">
          <div className="personal-card-header"><div><p className="section-eyebrow">APPROVAL</p><h2>Human-owned versions</h2></div><Check size={18} className="personal-check" /></div>
          <p className="personal-card-description">Every starter version is created through Krineo&apos;s Playbook constructor and approved as HUMAN. Personal research passes the active version directly to the existing pipeline.</p>
        </article>
      </section>
      <section className="personal-card personal-list-card">
        <div className="personal-card-header"><div><p className="section-eyebrow">YOUR PLAYBOOKS</p><h2>{workspace.playbooks.length} Playbook{workspace.playbooks.length === 1 ? "" : "s"}</h2></div></div>
        {workspace.playbooks.length === 0 ? <EmptyRouteState title="No Playbooks yet." description="Create the starter template above to begin a personal research flow." /> : <div className="playbook-list">{workspace.playbooks.map((playbook) => <PlaybookRow key={playbook.id} playbook={playbook} onActivate={activate} onDelete={remove} />)}</div>}
      </section>
    </RouteContent>
  );
}

function PlaybookRow({ playbook, onActivate, onDelete }: { playbook: WorkspaceState["playbooks"][number]; onActivate: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <article className={`playbook-row ${playbook.active ? "playbook-row-active" : ""}`}>
      <div className="playbook-row-heading"><div><strong>{playbook.displayName}</strong><span>{playbook.active ? "ACTIVE" : "INACTIVE"} · v{playbook.version.versionNumber} · {playbook.version.approvedBy}</span></div><span className="personal-card-index">{playbook.version.rules.length} RULES</span></div>
      <ul className="rule-list">{playbook.version.rules.map((rule) => <li key={rule.id}><span>{rule.effect}</span><code>{rule.conditions.map((condition) => `${condition.field} ${condition.operator}`).join(" · ")}</code></li>)}</ul>
      <div className="playbook-row-actions">{!playbook.active ? <button className="text-button" type="button" onClick={() => onActivate(playbook.id)}>Set active</button> : <span className="active-label"><Check size={13} /> Active Playbook</span>}<button className="text-button danger-button" type="button" onClick={() => onDelete(playbook.id)}><Trash2 size={13} /> Delete</button></div>
    </article>
  );
}

function ThesesContent() {
  const workspace = useWorkspaceState();
  if (workspace === undefined || workspace === null) return null;
  const currentWorkspace = workspace;
  return <RouteContent><RouteHeader active="theses" eyebrow="PERSONAL HISTORY" title="Theses" description="Proposals and committed versions derived from your own research runs." /><section className="personal-card personal-list-card">{currentWorkspace.theses.length === 0 ? <EmptyRouteState title="No personal theses yet." description="Run research with an active Playbook to create an eligible proposal." /> : <div className="record-grid">{currentWorkspace.theses.map((thesis) => <article className="record-card" key={thesis.versionId}><div className="record-card-topline"><StatusBadge value={thesis.status} label={thesis.status} /><small>{new Date(thesis.createdAt).toLocaleString()}</small></div><h2>{thesis.asset} · {thesis.decision}</h2><p>Thesis {thesis.id}</p><code>Version {thesis.versionId}</code>{thesis.receiptHash ? <small className="record-hash">Receipt {thesis.receiptHash}</small> : null}</article>)}</div>}</section></RouteContent>;
}

function ReceiptsContent() {
  const workspace = useWorkspaceState();
  if (workspace === undefined || workspace === null) return null;
  const currentWorkspace = workspace;
  return <RouteContent><RouteHeader active="receipts" eyebrow="CANONICAL ARTIFACTS" title="Receipts" description="Canonical Decision Receipts returned by committed personal research." /><section className="personal-card personal-list-card">{currentWorkspace.receipts.length === 0 ? <EmptyRouteState title="No Decision Receipts yet." description="Receipts are stored only when the existing research pipeline returns a committed result." /> : <div className="receipt-list">{currentWorkspace.receipts.map((receipt) => <details className="receipt-record" key={receipt.id}><summary><span><strong>{receipt.asset} · {receipt.decision}</strong><small>{new Date(receipt.createdAt).toLocaleString()} · v{receipt.versionNumber}</small></span><code>{receipt.canonicalHash}</code></summary><div className="receipt-detail"><p>Thesis version: {receipt.thesisVersionId}</p><p>Evidence snapshot: {receipt.evidenceSnapshotId}</p><p>No blockchain anchoring is claimed. This is the canonical artifact returned by Krineo.</p></div></details>)}</div>}</section></RouteContent>;
}

function PracticeContent() {
  const workspace = useWorkspaceState();
  if (workspace === undefined || workspace === null) return null;
  const currentWorkspace = workspace;
  return <RouteContent><RouteHeader active="practice" eyebrow="SIMULATED LEDGER" title="Practice" description="Review locally stored simulated positions. No real-money execution is connected." /><section className="practice-banner"><strong>SIMULATION ONLY</strong><span>$10,000 starting portfolio policy · no wallet or exchange</span></section><section className="personal-card personal-list-card">{currentWorkspace.practicePositions.length === 0 ? <EmptyRouteState title="No simulated positions yet." description="Choose the explicit research + simulated practice option after an eligible result." /> : <div className="record-grid">{currentWorkspace.practicePositions.map(({ position, pnl }) => <article className="record-card" key={position.id}><div className="record-card-topline"><StatusBadge value={position.status} label={position.status} /><small>{new Date(position.entryTime).toLocaleString()}</small></div><h2>{position.asset} · {position.direction}</h2><p>Entry {position.entryPrice} · Notional ${position.notionalUsd}</p>{pnl ? <p className={pnl.pnlUsd >= 0 ? "pnl-positive" : "pnl-negative"}>Current {pnl.currentPrice} · P&amp;L {pnl.pnlUsd >= 0 ? "+" : ""}{pnl.pnlUsd.toFixed(2)} USD ({pnl.pnlPercent.toFixed(2)}%)</p> : <p>Current price not supplied.</p>}<small>Simulation only</small></article>)}</div>}</section></RouteContent>;
}

function EmptyRouteState({ title, description }: { title: string; description: string }) {
  return <div className="route-empty-state"><span className="personal-empty-icon"><ArrowRight size={15} /></span><div><strong>{title}</strong><p>{description}</p></div></div>;
}
