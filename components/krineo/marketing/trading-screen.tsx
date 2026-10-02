import { ArrowDownLeft, ArrowUpRight, BookOpen, Check, ChevronDown, ChevronLeft, Clock3, FileCheck2, Layers3, MoreHorizontal, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { marketingResearchCase, marketingSnapshot as data, usd } from "./fixtures";
import { TradingChart } from "./trading-chart";
import styles from "./landing.module.css";

export type ScreenVariant = "portfolio" | "research" | "receipt" | "playbook" | "decision" | "memory";

export const screenDescriptions: Record<ScreenVariant, string> = {
  portfolio: "Illustrative simulated portfolio. Equity $10,035.71; gain $35.71, 0.36%. SOL entry $140, mark $145; position gain 3.57%.",
  research: "Illustrative SOL research with candlestick chart at $145. LONG thesis, Preflight CAUTION and KillSwitch CLEAR. Buy and Sell are nonfunctional illustrations.",
  receipt: "Illustrative committed SOL LONG receipt, version one, with fixture provenance, guardrails and a recorded hash. No live execution.",
  playbook: "Illustrative human-approved playbook. Abstain means wait, safety veto means block, comparable memory means caution.",
  decision: "Illustrative decision review. SOL LONG thesis, Preflight CAUTION and KillSwitch CLEAR, followed by a committed fixture receipt. No live execution.",
  memory: "Illustrative version history. The original receipt is preserved, a reversal is recorded in version two, and a lesson proposal awaits human approval.",
};

export const researchStoryDescription = "Illustrative mixed-evidence SOL research at $145. Momentum is NEUTRAL, sentiment is UNKNOWN. The fixture records ABSTAIN and Preflight WAIT. Sources and the synthetic chart are labeled.";

function ScreenHeader({ title, detail }: { title: string; detail?: string }) {
  return <><div className={styles.screenHeader}><ChevronLeft /><div><strong>{title}</strong>{detail && <small>{detail}</small>}</div><MoreHorizontal /></div><div className={styles.simulationLabel}>SIMULATED · 05 SEP 2026</div></>;
}

function Tabs({ items, active = 0 }: { items: readonly string[]; active?: number }) {
  return <div className={styles.screenTabs}>{items.map((item, index) => <span className={index === active ? styles.activeTab : undefined} key={item}>{item}</span>)}</div>;
}

function State({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "amber" | "red" | "muted" }) {
  return <span className={`${styles.state} ${styles[tone]}`}>{children}</span>;
}

function Guardrails() {
  return <div className={styles.guardrails}><div><span>Preflight</span><State tone="amber">{data.preflight}</State></div><div><span>KillSwitch</span><State>{data.killSwitch}</State></div></div>;
}

function AssetRow({ symbol, name, value, detail }: { symbol: string; name: string; value: string; detail: string }) {
  return <div className={styles.assetRow}><span className={`${styles.assetIcon} ${symbol === "SOL" ? styles.solIcon : ""}`}>{symbol === "SOL" ? "≋" : symbol.slice(0, 1)}</span><div><strong>{symbol}</strong><small>{name}</small></div><div className={styles.assetValue}><strong>{value}</strong><small>{detail}</small></div></div>;
}

function PortfolioScreen() {
  return <><ScreenHeader title="Practice portfolio" detail="Illustrative equity" /><div className={styles.screenBalance}><small>Modeled portfolio value</small><strong>{usd(data.equity)}</strong><span className={styles.green}>+{usd(data.positionPnl)} <span>(+{data.portfolioReturn.toFixed(2)}%)</span></span></div><TradingChart kind="equity" /><Tabs items={["Positions", "History"]} /><AssetRow symbol="SOL" name="7.142857 SOL · Long" value={usd(data.positionValue)} detail="+$35.71 (+3.57%)" /><div className={styles.positionDetails}><span>Entry <b>$140.00</b></span><span>Mark <b>$145.00</b></span></div><div className={styles.capitalRow}><span>Unallocated practice capital</span><strong>$9,000.00</strong></div><div className={styles.screenSectionTitle}>Watchlist <MoreHorizontal /></div><AssetRow symbol="BTC" name="Bitcoin · Saved symbol" value="—" detail="Illustrative watchlist" /><AssetRow symbol="ETH" name="Ethereum · Saved symbol" value="—" detail="Illustrative watchlist" /><p className={styles.screenFootnote}>Simulated value. Never user funds.</p></>;
}

function ResearchScreen() {
  return <><ScreenHeader title="Market research" detail="Fixed illustrative snapshot" /><div className={styles.instrument}><span className={`${styles.assetIcon} ${styles.solIcon}`}>≋</span><div><strong>SOL / USD</strong><small>Solana</small></div><ChevronDown /></div><div className={styles.marketPrice}><strong>$145<span>.00</span></strong><small>Replay mark · USD</small></div><Tabs items={["15m", "1h", "4h", "1d"]} /><TradingChart /><div className={styles.researchSummary}><span>KRINEO THESIS</span><div><strong className={styles.green}>{data.decision}</strong><small>Supportive momentum.<br />Review memory caution.</small></div></div><Guardrails /><div className={styles.illustrativeControls}><small>Illustrative simulation controls</small><div><span className={styles.buy}><ArrowDownLeft /> Buy</span><span className={styles.sell}><ArrowUpRight /> Sell</span></div></div><Tabs items={["Research", "Positions"]} /></>;
}

function ResearchStoryScreen() {
  return <><ScreenHeader title="SOL / USD research" detail="Mixed-evidence demo fixture" /><div className={styles.marketPrice}><strong>$145<span>.00</span></strong><small>15m · Synthetic chart</small></div><TradingChart /><div className={styles.screenSectionTitle}>Evidence & provenance <Layers3 /></div><div className={styles.researchEvidence}><div><strong>Momentum</strong><State tone="muted">{marketingResearchCase.momentum}</State><small>Directional evidence · Demo fixture</small></div><div><strong>Sentiment</strong><State tone="amber">{marketingResearchCase.sentiment}</State><small>Unavailable in mixed-evidence fixture</small></div></div><div className={styles.researchOutcome} data-screen-key="research-outcome"><span>DECISION <State tone="amber">{marketingResearchCase.decision}</State></span><span>PREFLIGHT <State tone="amber">{marketingResearchCase.preflight}</State></span></div><p className={styles.screenFootnote}>Unknown stays unknown. No forced direction.</p></>;
}

function ReceiptScreen() {
  return <><ScreenHeader title="Decision receipt" detail="Preserved fixture record" /><div className={styles.receiptTitle}><FileCheck2 /><span>THESIS RECEIPT · V1</span></div><div className={styles.receiptDecision}><strong>SOL / USD</strong><State>LONG</State></div><div className={styles.receiptTimestamp}>05 Sep 2026 · Fixture record</div><Guardrails /><div className={styles.screenSectionTitle}>Evidence trail <Layers3 /></div><div className={styles.evidenceSpine}><div><i /><strong>Market alignment</strong><small>Supportive · Demo fixture</small></div><div><i /><strong>Directional momentum</strong><small>Supportive · Demo fixture</small></div><div><i className={styles.amberNode} /><strong>Comparable memory</strong><small>Caution · Review required</small></div></div><div className={styles.receiptSeal}><Check /><div><strong>Hash recorded</strong><small>Original version preserved</small></div></div><Tabs items={["Receipt", "Changes"]} /><p className={styles.screenFootnote}>Committed fixture · No live execution</p></>;
}

function PlaybookScreen() {
  return <><ScreenHeader title="Your playbook" detail="Rules before decisions" /><div className={styles.playbookTitle}><BookOpen /><small>DEMO PLAYBOOK · V1</small><strong>Directional strategy</strong><State><Check /> HUMAN APPROVED</State></div><Tabs items={["Rules", "Versions"]} /><div className={styles.ruleRow}><span>01</span><div><strong>Respect uncertainty</strong><small>Decision is ABSTAIN</small></div><State tone="amber">WAIT</State></div><div className={styles.ruleRow}><span>02</span><div><strong>Honor the safety veto</strong><small>Safety is VETO</small></div><State tone="red">BLOCK</State></div><div className={styles.ruleRow}><span>03</span><div><strong>Review comparable cases</strong><small>High-similarity memory ≥ 1</small></div><State tone="amber">CAUTION</State></div><div className={styles.screenNotice}><ShieldCheck /><div><strong>You approve the rules.</strong><small>Proposed changes stay pending until human approval.</small></div></div><p className={styles.screenFootnote}>Illustrative rules · No live orders</p></>;
}

function DecisionScreen() {
  return <><ScreenHeader title="Decision review" detail="Inspect before commitment" /><div className={styles.decisionHero}><small>SOL / USD · DIRECTIONAL THESIS</small><strong>LONG <ArrowUpRight /></strong><p>Supportive evidence. A comparable case requires attention.</p></div><Guardrails /><div className={styles.screenNotice}><ShieldCheck /><div><strong>Review the caution</strong><small>Similar resolved cases remain visible alongside this decision.</small></div></div><div className={styles.screenSectionTitle}>Decision path</div><div className={styles.evidenceSpine}><div><i /><strong>Research reviewed</strong><small>Source and evidence preserved</small></div><div><i className={styles.amberNode} /><strong>Guardrails inspected</strong><small>Memory caution acknowledged</small></div><div><i /><strong>Fixture committed</strong><small>Version 1 · Receipt recorded</small></div></div><div className={styles.previewAction}>Review thesis <ArrowUpRight /></div><p className={styles.screenFootnote}>Illustrative commitment · No live execution</p></>;
}

function MemoryScreen() {
  return <><ScreenHeader title="Strategy memory" detail="Keep the original. Inspect the change." /><Tabs items={["Changes", "Receipts", "Lessons"]} /><div className={styles.versionComparison}><div><small>THEN · V1</small><strong className={styles.green}>LONG</strong><span>Supportive tape</span></div><ArrowUpRight /><div><small>NOW · V2</small><strong className={styles.red}>SHORT</strong><span>Evidence reversed</span></div></div><div className={styles.screenNotice}><Clock3 /><div><strong>What changed?</strong><small>Directional reversal triggered invalidation in the changed fixture.</small></div></div><div className={styles.evidenceSpine}><div><i /><strong>Original receipt preserved</strong><small>Version 1 · Unchanged</small></div><div><i className={styles.amberNode} /><strong>New version appended</strong><small>Version 2 · Simulated position closed</small></div></div><div className={styles.lessonProposal} data-screen-key="memory-approval"><span>LESSON PROPOSAL</span><strong>Review reversal context</strong><small>Proposal pending human approval</small><State tone="amber">PENDING APPROVAL</State><p>Active rules remain unchanged.</p></div></>;
}

export function TradingScreen({ variant, story = false }: { variant: ScreenVariant; story?: boolean }) {
  const screens: Record<ScreenVariant, ReactNode> = {
    portfolio: <PortfolioScreen />,
    research: story ? <ResearchStoryScreen /> : <ResearchScreen />,
    receipt: <ReceiptScreen />,
    playbook: <PlaybookScreen />,
    decision: <DecisionScreen />,
    memory: <MemoryScreen />,
  };
  return <div className={`${styles.screenContent} ${story ? styles.storyScreen : ""}`} data-screen-variant={variant}>{screens[variant]}</div>;
}
