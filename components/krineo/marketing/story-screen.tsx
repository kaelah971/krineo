import { ArrowRight } from "lucide-react";
import { marketingMemorySnapshot, marketingSnapshot } from "./fixtures";
import styles from "./landing.module.css";

export type StoryScreenVariant = "rules" | "research-decision" | "memory";

export const storyScreenDescriptions: Record<StoryScreenVariant, string> = {
  rules: "Simulated demo playbook, human approved. Abstain means WAIT and a safety veto means BLOCK. No live execution.",
  "research-decision": "Simulated directional SOL/USD demo fixture with a clean synthetic candlestick chart. LONG thesis with Preflight CAUTION. No live execution.",
  memory: "Separate changed demo fixture. Version one LONG becomes version two SHORT after invalidation. Original receipt preserved, new version appended, simulated position closed. Lesson proposal pending human approval; active rules unchanged.",
};

function RulesSummary() {
  return <>
    <h4 data-crop-key="playbook-title">Your playbook</h4>
    <p className={styles.summaryApproval} data-crop-key="human-approval" data-state-label>HUMAN APPROVED</p>
    <div className={styles.summaryRules}>
      <div data-crop-key="rule-wait"><span>ABSTAIN</span><ArrowRight aria-hidden="true" /><strong className={styles.amber} data-state-label>WAIT</strong></div>
      <div data-crop-key="rule-block"><span>Safety veto</span><ArrowRight aria-hidden="true" /><strong className={styles.red} data-state-label>BLOCK</strong></div>
    </div>
  </>;
}

function ResearchDecisionSummary() {
  return <>
    <h4 data-crop-key="instrument">SOL / USD</h4>
    <div className={styles.summaryChart} data-crop-key="chart"><CampaignCandles /></div>
    <p className={styles.summaryDecision} data-crop-key="decision"><strong className={styles.green} data-state-label>{marketingSnapshot.decision}</strong></p>
    <div className={styles.summaryGuardrails} data-crop-key="guardrails"><span>Preflight</span><strong className={styles.amber} data-state-label>{marketingSnapshot.preflight}</strong></div>
  </>;
}

function CampaignCandles() {
  const candles = marketingSnapshot.candles.filter((_, index, all) => index % 2 === 0 || index === all.length - 1);
  const low = Math.min(...candles.map(candle => candle.low));
  const high = Math.max(...candles.map(candle => candle.high));
  const y = (price: number) => 33 - ((price - low) / (high - low)) * 30;
  return <svg viewBox="0 0 120 36" className={styles.campaignCandles} aria-hidden="true">
    {candles.map((candle, index) => {
      const x = 4 + index * 8;
      const top = Math.min(y(candle.open), y(candle.close));
      return <g key={index} className={candle.close >= candle.open ? styles.candleUp : styles.candleDown}>
        <line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} />
        <rect x={x - 2} y={top} width="4" height={Math.max(1.5, Math.abs(y(candle.open) - y(candle.close)))} />
      </g>;
    })}
  </svg>;
}

function MemorySummary() {
  return <>
    <div className={styles.summaryVersions} data-crop-key="before-after"><strong className={styles.green} data-state-label>{marketingMemorySnapshot.before}</strong><ArrowRight aria-hidden="true" /><strong className={styles.red} data-state-label>{marketingMemorySnapshot.after}</strong></div>
    <p className={styles.summaryReceipt} data-crop-key="receipt">Receipt preserved</p>
    <p className={styles.summaryLesson} data-crop-key="pending-approval"><strong className={styles.amber} data-state-label>PENDING APPROVAL</strong></p>
  </>;
}

export function StoryScreen({ variant }: { variant: StoryScreenVariant }) {
  return <div className={styles.summaryScreen} data-story-screen={variant}>
    <p className={styles.summarySimulation} data-crop-key="simulation">Simulated</p>
    {variant === "rules" ? <RulesSummary /> : variant === "research-decision" ? <ResearchDecisionSummary /> : <MemorySummary />}
  </div>;
}
