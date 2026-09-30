import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { HeroMarketComposition } from "@/components/krineo/hero-market-composition";
import { SiteHeader } from "@/components/krineo/site-header";

const features = [
  ["01", "PLAYBOOK", "Your trading rules, approved.", "BookOpen"],
  ["02", "RESEARCH", "Multi-source market analysis.", "BarChart3"],
  ["03", "DECISION", "Evidence-backed decisions.", "ShieldCheck"],
  ["04", "MEMORY", "Lessons that make you sharper.", "BrainCircuit"],
] as const;

const capabilityRows = [
  ["Multi-source evidence", "A clear provenance trail from market context to decision."],
  ["Accountable decisions", "Guardrails and KillSwitch checks stay in the open."],
  ["Deterministic reasoning", "The same evidence produces the same inspectable path."],
  ["Compounding learning", "Resolved cases become context for what comes next."],
] as const;

const featureIcons = {
  BookOpen,
  BarChart3,
  ShieldCheck,
  BrainCircuit,
};

export default function Home() {
  return (
    <div className="app-shell landing-shell premium-shell">
      <SiteHeader active="home" />
      <main className="landing-main">
        <section className="landing-hero premium-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="hero-kicker"><span className="hero-kicker-mark" /> AI-ASSISTED MARKET REASONING</p>
            <h1 id="landing-title">The strategy<br />memory for <span>AI trading.</span></h1>
            <p className="landing-lede">Krineo keeps the decision, guardrails, receipts and change visible.</p>
            <div className="hero-actions">
              <Link className="button button-light" href="/workspace">Open Workspace <ArrowRight size={15} /></Link>
              <Link className="button button-outline" href="/demo">Explore Golden Demo</Link>
            </div>
            <div className="hero-proof"><Check size={13} /> Saved in this browser · no live execution</div>
          </div>

          <HeroMarketComposition />
        </section>

        <section className="landing-story" aria-labelledby="story-title">
          <div className="section-heading-row">
            <div><p className="section-eyebrow">THE KRINEO SYSTEM</p><h2 id="story-title">More than signals.<br /><span>A reasoning system with memory.</span></h2></div>
            <p>Trading intelligence is only useful when its rules, evidence and changes can be inspected after the moment.</p>
          </div>
          <div className="feature-grid">
            {features.map(([number, label, title, icon]) => {
              const Icon = featureIcons[icon];
              return <article className="feature-card" key={label}><div className="feature-card-topline"><span>{number}</span><Icon size={17} /></div><p className="feature-label">{label}</p><h3>{title}</h3></article>;
            })}
          </div>
          <div className="capability-grid">
            {capabilityRows.map(([title, text]) => <div className="capability-row" key={title}><span className="capability-mark"><Check size={13} /></span><div><strong>{title}</strong><p>{text}</p></div><ArrowRight size={15} /></div>)}
          </div>
        </section>

        <section className="metric-strip" aria-label="Krineo product metrics">
          <div><strong>352</strong><span>tests passing</span></div>
          <div><strong>5</strong><span>DM-1 dimensions</span></div>
          <div><strong>3</strong><span>deterministic replay states</span></div>
          <div><strong>0</strong><span>real-money execution</span></div>
        </section>

        <section className="landing-disclosure" aria-labelledby="disclosure-title">
          <div><p className="section-eyebrow">DISCLOSURE</p><h2 id="disclosure-title">Built for accountable market reasoning.</h2></div>
          <div className="disclosure-list"><span><FileCheck2 size={15} /> Fixture provenance stays visible.</span><span><ShieldCheck size={15} /> Missing evidence stays UNKNOWN.</span><span><Activity size={15} /> Practice is simulation only.</span></div>
          <Link className="button button-light" href="/workspace">Open Krineo Workspace <ArrowRight size={15} /></Link>
        </section>
      </main>
      <footer className="app-footer"><span>KRINEO · ACCOUNTABLE MARKET REASONING</span><span>LOCAL PRODUCT SHELL · NO LIVE EXECUTION</span></footer>
    </div>
  );
}
