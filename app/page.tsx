import Link from "next/link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/krineo/site-header";

const workflow = [
  ["PLAYBOOK", "Approved trading guardrails"],
  ["PREFLIGHT", "Evaluate a market decision against those rules"],
  ["MEMORY", "Compare the current setup to prior resolved cases"],
  ["CHANGE", "Preserve what changed through versions and receipts"],
] as const;

const surfaces = [
  ["Workspace", "Inspect fixture-backed decisions, guardrails, receipts and change.", "/workspace", "Active"],
  ["Theses", "Versioned market views and their decision history.", null, "Coming next"],
  ["Receipts", "Canonical evidence records for accountable review.", null, "Coming next"],
  ["Practice", "Simulated drills from prior cases and rule changes.", null, "Coming next"],
] as const;

export default function Home() {
  return (
    <div className="app-shell landing-shell">
      <SiteHeader active="home" />
      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="hero-kicker"><span className="fixture-dot" /> ACCOUNTABLE AI TRADING</p>
            <h1 id="landing-title">The strategy memory for AI trading.</h1>
            <p className="landing-lede">Your AI-assisted trading workflow shouldn&apos;t forget its own rules. Krineo keeps decisions, guardrails, receipts and change visible.</p>
            <div className="hero-actions">
              <Link className="button button-dark" href="/workspace">Open Workspace <ArrowRight size={15} /></Link>
              <a className="text-link" href="#workflow">See how it works <ChevronRight size={15} /></a>
            </div>
          </div>
          <div className="landing-preview" aria-label="Krineo product preview">
            <div className="preview-topline"><span>DETERMINISTIC PREFLIGHT</span><span>fixture-backed</span></div>
            <div className="preview-decision"><span>DECISION</span><strong>ELIGIBLE WITH GUARDRAILS</strong></div>
            <div className="preview-grid">
              <div><span>Rules checked</span><strong>12</strong></div>
              <div><span>Unknowns</span><strong>Visible</strong></div>
              <div><span>Receipt</span><strong>Canonical</strong></div>
            </div>
            <div className="preview-spine">
              {workflow.map(([label], index) => <span key={label}><Check size={11} />{index + 1}. {label}</span>)}
            </div>
          </div>
        </section>

        <section className="landing-section value-section" aria-labelledby="value-title">
          <p className="section-eyebrow">WHY KRINEO</p>
          <h2 id="value-title">Agents can research markets. Accountability needs memory.</h2>
          <div className="value-grid">
            <p>AI agents can gather evidence and form market views quickly.</p>
            <p>Rules, exceptions and historical context can disappear between decisions.</p>
            <p>Krineo makes the reasoning, guardrails and changes inspectable before action.</p>
          </div>
        </section>

        <section className="landing-section" id="workflow" aria-labelledby="workflow-title">
          <p className="section-eyebrow">WORKFLOW</p>
          <h2 id="workflow-title">From approved rules to durable change.</h2>
          <div className="workflow-grid">
            {workflow.map(([label, text], index) => (
              <article className="workflow-card" key={label}>
                <span>0{index + 1}</span>
                <h3>{label}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section" aria-labelledby="surfaces-title">
          <p className="section-eyebrow">PRODUCT SURFACES</p>
          <h2 id="surfaces-title">One active surface now. More accountability views next.</h2>
          <div className="surface-grid">
            {surfaces.map(([title, text, href, status]) => (
              <article className="surface-card" key={title}>
                <div className="surface-card-topline"><h3>{title}</h3><span>{status}</span></div>
                <p>{text}</p>
                {href ? <Link className="text-link" href={href}>Open surface <ArrowRight size={14} /></Link> : <small>Coming next</small>}
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section trust-section" aria-labelledby="trust-title">
          <p className="section-eyebrow">TRUST & DISCLOSURE</p>
          <h2 id="trust-title">A visible demo, not execution infrastructure.</h2>
          <ul>
            <li>Deterministic decision system</li>
            <li>Simulated practice only</li>
            <li>No real-money execution</li>
            <li>Demo data is fixture-backed where applicable</li>
            <li>Missing evidence stays UNKNOWN</li>
          </ul>
        </section>

        <section className="final-cta" aria-labelledby="final-cta-title">
          <p className="section-eyebrow">OPEN THE GOLDEN DEMO</p>
          <h2 id="final-cta-title">Inspect the workspace with decisions, receipts and change intact.</h2>
          <Link className="button button-dark" href="/workspace">Open Krineo Workspace <ArrowRight size={15} /></Link>
        </section>
      </main>
      <footer className="app-footer"><span>KRINEO · ACCOUNTABLE MARKET REASONING</span><span>DEVELOPMENT SHELL · NO LIVE EXECUTION</span></footer>
    </div>
  );
}
