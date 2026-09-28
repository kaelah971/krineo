"use client";

import { useState, type FormEvent } from "react";
import { Check, CircleAlert, FilePlus2, X } from "lucide-react";
import {
  DEMO_AUTHORABLE_FIELDS,
  DEMO_AUTHORING_EFFECTS,
  buildDemoRule,
  describeDemoRule,
  getDemoAuthorableField,
  type DemoAuthorableField,
  type DemoAuthoringEffect,
  type DemoAuthoringOperator,
  type DemoPlaybookAuthoringState,
} from "@/lib/demo/authoring";
import type { PlaybookRule } from "@/lib/playbook";
import { Panel, StatusBadge } from "./panels";

interface PlaybookAuthoringPanelProps {
  readonly state: DemoPlaybookAuthoringState;
  readonly error: string | null;
  readonly blocked?: boolean;
  readonly onPropose: (rule: PlaybookRule) => void;
  readonly onApprove: () => void;
  readonly onReject: () => void;
}

function humanize(value: string): string {
  return value
    .replaceAll("memory.", "")
    .replaceAll("_", " ")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function PlaybookAuthoringPanel({
  state,
  error,
  blocked = false,
  onPropose,
  onApprove,
  onReject,
}: PlaybookAuthoringPanelProps) {
  const [field, setField] = useState<DemoAuthorableField>("decision");
  const [operator, setOperator] = useState<DemoAuthoringOperator>("EQUALS");
  const [value, setValue] = useState("LONG");
  const [effect, setEffect] = useState<DemoAuthoringEffect>("WAIT");
  const [formError, setFormError] = useState<string | null>(null);
  const config = getDemoAuthorableField(field);
  const preview = buildDemoRule({ field, operator, value, effect });
  const latestProposal = state.proposals[state.proposals.length - 1] ?? null;
  const composerBlocked = blocked || state.pendingProposal !== null;

  function handleFieldChange(nextField: DemoAuthorableField) {
    const nextConfig = getDemoAuthorableField(nextField);
    setField(nextField);
    setOperator(nextConfig.operators[0] ?? "EQUALS");
    setValue(nextConfig.defaultValue);
    setFormError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview.ok !== true) {
      setFormError(preview.message);
      return;
    }
    setFormError(null);
    onPropose(preview.rule);
  }

  return (
    <Panel
      eyebrow="PLAYBOOK AUTHORING"
      title="Write the guardrail"
      description="Compose one structured rule from the existing M2 vocabulary. This fixture session never auto-approves or persists changes."
      className="side-panel authoring-panel"
    >
      <div className="authoring-version">
        <div>
          <span className="metric-label">Active Playbook</span>
          <strong>v{state.activeVersion.versionNumber}</strong>
        </div>
        <span className="authoring-session">SESSION ONLY</span>
      </div>

      <form className="authoring-form" onSubmit={handleSubmit}>
        <fieldset disabled={composerBlocked}>
          <legend className="sr-only">Compose a Playbook rule</legend>
          <div className="authoring-field">
            <label htmlFor="playbook-rule-field">WHEN · field</label>
            <select
              id="playbook-rule-field"
              value={field}
              onChange={(event) => handleFieldChange(event.target.value as DemoAuthorableField)}
            >
              {DEMO_AUTHORABLE_FIELDS.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </div>
          <div className="authoring-row">
            <div className="authoring-field">
              <label htmlFor="playbook-rule-operator">operator</label>
              <select
                id="playbook-rule-operator"
                value={operator}
                onChange={(event) => setOperator(event.target.value as DemoAuthoringOperator)}
              >
                {config.operators.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </div>
            <div className="authoring-field">
              <label htmlFor="playbook-rule-value">value</label>
              {config.kind === "enum" ? (
                <select id="playbook-rule-value" value={value} onChange={(event) => setValue(event.target.value)}>
                  {config.values?.map((entry) => (
                    <option key={entry} value={entry}>{humanize(entry)}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="playbook-rule-value"
                  type="number"
                  min="0"
                  max={config.kind === "unit" ? "1" : undefined}
                  step={config.kind === "unit" ? "0.05" : "1"}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  aria-describedby="playbook-rule-value-help"
                />
              )}
            </div>
          </div>
          <div className="authoring-field">
            <label htmlFor="playbook-rule-effect">THEN · effect</label>
            <select id="playbook-rule-effect" value={effect} onChange={(event) => setEffect(event.target.value as DemoAuthoringEffect)}>
              {DEMO_AUTHORING_EFFECTS.map((entry) => (
                <option key={entry} value={entry}>{entry}</option>
              ))}
            </select>
          </div>
          <span className="authoring-help" id="playbook-rule-value-help">
            Numeric thresholds stay within the existing M2 range. Unknown remains an explicit state.
          </span>
        </fieldset>

        <div className="authoring-preview" aria-live="polite">
          <span className="metric-label">Deterministic preview</span>
          <strong>{preview.ok ? describeDemoRule(preview.rule) : "Complete a valid rule to preview it."}</strong>
        </div>
        {formError ? <p className="authoring-error" role="alert">{formError}</p> : null}
        {error ? <p className="authoring-error" role="alert">{error}</p> : null}
        {blocked ? <p className="authoring-blocked" role="status">Resolve the pending Memory Lesson proposal before writing another rule.</p> : null}
        <button className="button button-dark authoring-propose" type="submit" disabled={composerBlocked}>
          <FilePlus2 size={15} aria-hidden="true" />
          Propose rule
        </button>
      </form>

      {state.pendingProposal ? (
        <div className="authoring-proposal" aria-live="polite">
          <div className="authoring-proposal-topline">
            <span className="section-eyebrow">PROPOSED RULE</span>
            <StatusBadge value="PENDING" />
          </div>
          <strong>{describeDemoRule(state.pendingProposal.rule)}</strong>
          <span>Proposal {state.pendingProposal.proposal.id} · Approval would create Playbook v{state.activeVersion.versionNumber + 1}. The active v{state.activeVersion.versionNumber} remains in force until then.</span>
          <div className="authoring-actions">
            <button className="button button-dark" type="button" onClick={onApprove}>
              <Check size={14} aria-hidden="true" /> APPROVE RULE
            </button>
            <button className="button authoring-reject" type="button" onClick={onReject}>
              <X size={14} aria-hidden="true" /> Reject
            </button>
          </div>
        </div>
      ) : latestProposal ? (
        <div className="authoring-last" aria-live="polite">
          <div className="authoring-proposal-topline">
            <span className="section-eyebrow">LAST PROPOSAL</span>
            <StatusBadge value={latestProposal.proposal.status} />
          </div>
          <strong>{describeDemoRule(latestProposal.rule)}</strong>
          <span>Proposal {latestProposal.proposal.id} · {latestProposal.proposal.status === "APPROVED" ? `Introduced in v${state.activeVersion.versionNumber}.` : latestProposal.proposal.rejectionReason ?? "No active version was changed."}</span>
        </div>
      ) : (
        <div className="authoring-empty"><CircleAlert size={14} aria-hidden="true" /><span>New rules stay proposed until you approve them.</span></div>
      )}
    </Panel>
  );
}