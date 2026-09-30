"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import type { ResearchRun } from "@/lib/research";
import {
  activePlaybook,
  ingestResearchResult,
  persistWorkspace,
} from "@/lib/workspace/store";
import { requestPersonalResearch, type PersonalResearchRequest } from "@/lib/workspace/research-client";
import { useWorkspaceState } from "./workspace-state";

const replayFixtures = [
  ["DETERMINISTIC_DIRECTIONAL", "Directional"],
  ["DETERMINISTIC_ABSTAIN", "Abstain"],
  ["DETERMINISTIC_CHANGED", "Changed"],
] as const;

type ResearchMode = "LIVE" | "REPLAY";

export function PersonalResearchPanel() {
  const workspace = useWorkspaceState();
  const [mode, setMode] = useState<ResearchMode>("LIVE");
  const [replayFixtureId, setReplayFixtureId] = useState<PersonalResearchRequest["replayFixtureId"]>("DETERMINISTIC_DIRECTIONAL");
  const [playbookId, setPlaybookId] = useState("");
  const [commitPractice, setCommitPractice] = useState(false);
  const [entryPrice, setEntryPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [result, setResult] = useState<ResearchRun | null>(null);
  const [resultReplayFixtureId, setResultReplayFixtureId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (workspace === undefined || workspace === null) return null;
  const currentWorkspace = workspace;

  const selectedPlaybook = currentWorkspace.playbooks.find((item) => item.id === playbookId && item.active) ?? activePlaybook(currentWorkspace);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedPlaybook === null || !selectedPlaybook.active) {
      setError("Create and select an active personal Playbook before running research.");
      return;
    }

    const numericEntryPrice = entryPrice.length > 0 ? Number(entryPrice) : undefined;
    const numericCurrentPrice = currentPrice.length > 0 ? Number(currentPrice) : undefined;
    if (commitPractice && (numericEntryPrice === undefined || !Number.isFinite(numericEntryPrice) || numericEntryPrice <= 0)) {
      setError("A positive simulated entry price is required when committing practice.");
      return;
    }
    if (numericCurrentPrice !== undefined && (!Number.isFinite(numericCurrentPrice) || numericCurrentPrice <= 0)) {
      setError("The simulated current price must be positive when supplied.");
      return;
    }

    const input: PersonalResearchRequest = {
      mode,
      runId: createRunId(),
      startedAt: new Date().toISOString(),
      autoCommitPractice: commitPractice,
      playbookVersion: selectedPlaybook.version,
      ...(numericEntryPrice === undefined ? {} : { practiceEntryPrice: numericEntryPrice }),
      ...(numericCurrentPrice === undefined ? {} : { practiceCurrentPrice: numericCurrentPrice }),
      ...(mode === "REPLAY" && replayFixtureId === undefined ? {} : mode === "REPLAY" ? { replayFixtureId } : {}),
    };

    setPending(true);
    setError(null);
    try {
      const nextResult = await requestPersonalResearch(input);
      const nextWorkspace = ingestResearchResult(
        currentWorkspace,
        nextResult,
        mode === "REPLAY" ? { replayFixtureId } : undefined,
      );
      if (!persistWorkspace(nextWorkspace)) {
        throw new Error("The research result could not be saved in this browser.");
      }
      setResult(nextResult);
      setResultReplayFixtureId(mode === "REPLAY" ? replayFixtureId : undefined);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Research could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="personal-card-header">
        <div>
          <p className="section-eyebrow">ASK KRINEO</p>
          <h2>Run autonomous market research</h2>
        </div>
        <span className="personal-card-status">PERSONAL PIPELINE</span>
      </div>
      <p className="personal-card-description">
        Choose a Playbook and an explicit research source. Krineo evaluates the result against your approved guardrails; missing data stays UNKNOWN.
      </p>

      <form className="research-panel-form" onSubmit={handleSubmit}>
        <div className="research-control-grid">
          <label className="research-field">
            <span>Active Playbook</span>
            <select value={selectedPlaybook?.id ?? ""} onChange={(event) => setPlaybookId(event.target.value)}>
              <option value="">Select a Playbook</option>
              {workspace.playbooks.filter((playbook) => playbook.active).map((playbook) => <option value={playbook.id} key={playbook.id}>{playbook.displayName} · Active</option>)}
            </select>
          </label>
          <label className="research-field">
            <span>Replay fixture</span>
            <select value={replayFixtureId ?? ""} onChange={(event) => setReplayFixtureId(event.target.value as PersonalResearchRequest["replayFixtureId"])} disabled={mode !== "REPLAY"}>
              {replayFixtures.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="research-choice-fieldset">
          <legend>Research mode</legend>
          <div className="research-choice-grid">
            <label className={`research-choice ${mode === "LIVE" ? "research-choice-active" : ""}`}>
              <input type="radio" name="research-mode" value="LIVE" checked={mode === "LIVE"} onChange={() => setMode("LIVE")} />
              <span><strong>LIVE RYO</strong><small>Provider availability may be degraded. No fixture fallback.</small></span>
            </label>
            <label className={`research-choice ${mode === "REPLAY" ? "research-choice-active" : ""}`}>
              <input type="radio" name="research-mode" value="REPLAY" checked={mode === "REPLAY"} onChange={() => setMode("REPLAY")} />
              <span><strong>REPLAY / DETERMINISTIC</strong><small>Explicit fixture replay with visible provenance.</small></span>
            </label>
          </div>
        </fieldset>

        <fieldset className="research-choice-fieldset">
          <legend>After research</legend>
          <div className="research-commit-choice">
            <label><input type="radio" name="research-action" checked={!commitPractice} onChange={() => setCommitPractice(false)} /> Research only</label>
            <label><input type="radio" name="research-action" checked={commitPractice} onChange={() => setCommitPractice(true)} /> Research + commit eligible simulated practice decision</label>
          </div>
        </fieldset>

        {commitPractice ? (
          <div className="practice-input-grid">
            <label className="research-field"><span>Simulated entry price</span><input type="number" min="0.000001" step="any" value={entryPrice} onChange={(event) => setEntryPrice(event.target.value)} placeholder="Required" /></label>
            <label className="research-field"><span>Current price <em>optional</em></span><input type="number" min="0.000001" step="any" value={currentPrice} onChange={(event) => setCurrentPrice(event.target.value)} placeholder="Optional" /></label>
          </div>
        ) : null}

        <div className="research-form-footer">
          <p>Simulation only. No wallet, funds, exchange or live execution is involved.</p>
          <button className="button button-dark" type="submit" disabled={pending || selectedPlaybook === null || !selectedPlaybook.active}>
            {pending ? <><LoaderCircle size={15} className="spin-icon" aria-hidden="true" /> Running research</> : <>Run research <ArrowRight size={15} aria-hidden="true" /></>}
          </button>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>

      {result ? <ResearchResult result={result} replayFixtureId={resultReplayFixtureId} /> : null}
    </>
  );
}

function ResearchResult({ result, replayFixtureId }: { result: ResearchRun; replayFixtureId?: string }) {
  const preflight = result.preflight?.status ?? result.preflightFailure?.code ?? "UNKNOWN";
  const killSwitch = result.killSwitch?.verdict ?? result.killSwitchValidation?.verdict ?? "UNKNOWN";
  const providerStatus = result.marketContext?.status ?? result.candidateDiscovery?.status ?? "UNKNOWN";
  const degraded = result.status === "DEGRADED" || result.providerFailures.length > 0 || (providerStatus !== "SUCCESS" && providerStatus !== "PARTIAL" && providerStatus !== "UNKNOWN");
  const provider = result.mode === "REPLAY"
    ? `REPLAY · ${replayFixtureId ?? result.provider.source}`
    : result.provider.source;

  return (
    <section className="research-result" aria-live="polite" aria-labelledby="research-result-title">
      <div className="research-result-header">
        <div><p className="section-eyebrow">LATEST RESULT</p><h3 id="research-result-title">Research completed</h3></div>
        <span className={`result-status result-status-${result.status.toLowerCase()}`}>{result.status}</span>
      </div>
      {degraded ? <div className="research-degraded"><strong>Provider status is degraded.</strong><span>Unavailable evidence remains UNKNOWN; no silent fixture fallback was used.</span></div> : null}
      <dl className="research-result-grid">
        <ResultMetric label="Provider" value={provider} />
        <ResultMetric label="Selected asset" value={result.selectedAsset ?? "NONE"} />
        <ResultMetric label="Market decision" value={result.marketDecision} />
        <ResultMetric label="Preflight" value={preflight} />
        <ResultMetric label="KillSwitch" value={killSwitch} />
        <ResultMetric label="Final decision" value={result.finalDecision} />
      </dl>
      <div className="research-reasons"><span>REASONS</span>{result.reasonCodes.length > 0 ? result.reasonCodes.map((reason) => <strong key={reason}>{formatCode(reason)}</strong>) : <strong>None recorded</strong>}</div>
      {result.proposal?.eligible ? <p className="research-proposal"><Check size={14} aria-hidden="true" /> Eligible thesis proposal{result.commit === null ? " · not committed" : ""}</p> : null}
      {result.commit ? (
        <div className="research-commit-result">
          <strong>Committed thesis: {result.commit.thesis.id} · version {result.commit.version.id} · {result.commit.version.asset} · {result.commit.version.decision}</strong>
          <span>Receipt hash <code>{result.commit.receipt.canonicalHash}</code></span>
          <span>Practice position {result.commit.practice.position.status.toLowerCase()} · simulation only</span>
        </div>
      ) : null}
    </section>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function formatCode(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function createRunId() {
  const cryptoApi = globalThis.crypto;
  return typeof cryptoApi?.randomUUID === "function"
    ? `personal-research-${cryptoApi.randomUUID()}`
    : `personal-research-${Date.now()}`;
}
