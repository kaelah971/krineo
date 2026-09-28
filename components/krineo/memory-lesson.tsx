"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleAlert, Eye, X } from "lucide-react";
import { formatLessonCondition } from "@/lib/memory/lessons";
import type { DecisionCase } from "@/lib/memory";
import type { DemoMemoryLessonState } from "@/lib/demo/memory-lessons";
import { Panel, StatusBadge } from "./panels";

interface MemoryLessonPanelProps {
  readonly state: DemoMemoryLessonState;
  readonly historicalCases: readonly DecisionCase[];
  readonly activeVersionNumber: number;
  readonly error: string | null;
  readonly onApprove: () => void;
  readonly onReject: () => void;
}

function outcomeLabel(decisionCase: DecisionCase): string {
  return decisionCase.outcome?.status ?? "NOT RECORDED";
}

function ratePercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function ratePoints(value: number): string {
  return `${Math.round(value * 100)} percentage points`;
}

export function MemoryLessonPanel({
  state,
  historicalCases,
  activeVersionNumber,
  error,
  onApprove,
  onReject,
}: MemoryLessonPanelProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const candidate = state.selectedCandidate;
  const matchingCases = candidate === null
    ? []
    : candidate.matchingCaseIds
        .map((caseId) => historicalCases.find((entry) => entry.id === caseId))
        .filter((entry): entry is DecisionCase => entry !== undefined);

  if (candidate === null) {
    return (
      <Panel
        id="memory-lesson"
        eyebrow="MEMORY LESSON"
        title="No recurring pattern yet"
        description="The conservative lesson threshold is visible even when historical cases do not support a proposal."
        className="memory-lesson-panel"
      >
        <div className="lesson-empty">
          <CircleAlert size={16} aria-hidden="true" />
          <span>{error ?? state.message ?? "No structured historical condition qualified for review."}</span>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      id="memory-lesson"
      eyebrow="MEMORY LESSON"
      title="Recurring pattern detected"
      description="This historical association may propose a guardrail. It is not a prediction or proof of profitability, and it never governs without human approval."
      className="memory-lesson-panel"
    >
      <div className="lesson-status-row">
        <div>
          <span className="metric-label">Observed condition</span>
          <strong>{formatLessonCondition(candidate.condition)}</strong>
        </div>
        <StatusBadge
          value={state.status === "DUPLICATE" ? "INFO" : state.status}
          label={
            state.status === "PENDING"
              ? "PROPOSED · NOT ACTIVE"
              : state.status === "APPROVED"
                ? "ACTIVE after human approval"
                : state.status === "REJECTED"
                  ? "DISMISSED"
                  : state.status === "DUPLICATE"
                    ? "Already represented"
                    : "REVIEW"
          }
        />
      </div>

      <div className="lesson-evidence-grid">
        <div>
          <span className="metric-label">Matching history</span>
          <strong>{candidate.adverseCount} / {candidate.matchingCaseCount} adverse</strong>
          <span className="lesson-evidence-detail">Adverse rate · {ratePercent(candidate.adverseRate)}</span>
        </div>
        <div>
          <span className="metric-label">Other resolved history</span>
          <strong>{candidate.nonMatchingAdverseCount} / {candidate.nonMatchingResolvedCaseCount} adverse</strong>
          <span className="lesson-evidence-detail">Adverse rate · {ratePercent(candidate.nonMatchingAdverseRate)}</span>
        </div>
        <div>
          <span className="metric-label">Difference</span>
          <strong>{candidate.adverseRateLift >= 0 ? "+" : ""}{ratePoints(candidate.adverseRateLift)}</strong>
          <span className="lesson-evidence-detail">Contrast threshold · +20 percentage points</span>
        </div>
      </div>
      <div className="lesson-proposed-rule">
        <span className="metric-label">Proposed rule</span>
        <strong>{candidate.proposedEffect} when {formatLessonCondition(candidate.condition)}</strong>
      </div>

      <div className="lesson-meta">
        <span>Algorithm · {candidate.algorithmVersion}</span>
        <span>Reason · {candidate.reasonCode}</span>
        {state.lesson ? <span>Provenance · {state.lesson.proposal.createdBy}</span> : null}
        {state.lesson ? <span>Proposal · {state.lesson.proposal.id}</span> : null}
      </div>

      {state.status === "PENDING" ? (
        <p className="lesson-firewall" role="status">
          Pending only. Preflight remains on Playbook v{activeVersionNumber} until a human approves this SYSTEM proposal.
        </p>
      ) : state.status === "APPROVED" ? (
        <p className="lesson-firewall lesson-firewall-approved" role="status">
          Human approved. The active Playbook is now v{activeVersionNumber}, and existing Preflight is reevaluating the approved rule.
        </p>
      ) : state.status === "REJECTED" ? (
        <p className="lesson-firewall" role="status">Dismissed by a human. No Playbook version was created.</p>
      ) : state.status === "DUPLICATE" ? (
        <p className="lesson-firewall" role="status">No proposal created because an equivalent condition/effect is already pending or active.</p>
      ) : null}

      {error ? <p className="lesson-error" role="alert">{error}</p> : null}

      <div className="lesson-actions">
        <button
          className="button lesson-review-button"
          type="button"
          aria-expanded={reviewOpen}
          aria-controls="memory-lesson-cases"
          onClick={() => setReviewOpen((open) => !open)}
        >
          <Eye size={14} aria-hidden="true" />
          {reviewOpen ? "Hide evidence" : "Review evidence"}
          <ChevronDown className={reviewOpen ? "lesson-chevron lesson-chevron-open" : "lesson-chevron"} size={14} aria-hidden="true" />
        </button>
        {state.status === "PENDING" ? (
          <>
            <button className="button button-dark" type="button" onClick={onApprove}>
              <Check size={14} aria-hidden="true" /> Add to Playbook
            </button>
            <button className="button lesson-dismiss-button" type="button" onClick={onReject}>
              <X size={14} aria-hidden="true" /> Dismiss
            </button>
          </>
        ) : null}
      </div>

      {reviewOpen ? (
        <div id="memory-lesson-cases" className="lesson-cases" aria-label="Historical cases supporting this lesson">
          <div className="lesson-cases-heading">
            <span className="metric-label">Supporting cases</span>
            <span>{matchingCases.length} of {candidate.matchingCaseCount} shown</span>
          </div>
          <ul>
            {matchingCases.map((decisionCase) => {
              const adverse = candidate.adverseCaseIds.includes(decisionCase.id);
              return (
                <li key={decisionCase.id}>
                  <div className="lesson-case-main">
                    <strong>{decisionCase.id}</strong>
                    <span>{formatLessonCondition(candidate.condition)}</span>
                  </div>
                  <div className="lesson-case-outcome">
                    <span>Historical outcome</span>
                    <StatusBadge value={outcomeLabel(decisionCase)} label={adverse ? `${outcomeLabel(decisionCase)} · adverse` : outcomeLabel(decisionCase)} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="lesson-history-note">Historical outcomes are review evidence only. They do not determine today&apos;s market decision.</p>
        </div>
      ) : null}
    </Panel>
  );
}