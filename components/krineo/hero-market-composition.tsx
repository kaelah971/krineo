import { MoreHorizontal } from "lucide-react";

const marketSeries = [
  151, 148, 150, 146, 143, 145, 141, 139, 142, 138, 135, 137,
  133, 130, 132, 128, 131, 127, 129, 124, 121, 124, 119, 116,
  118, 113, 111, 115, 108, 105, 109, 101, 98, 102, 91, 47,
];

const bars = [48, 72, 38, 84, 59, 96, 68];
const watchlist = [
  { asset: "SOL", decision: "LONG", state: "CAUTION", tone: "positive" },
  { asset: "ETH", decision: "ABSTAIN", state: "WAIT", tone: "neutral" },
  { asset: "BTC", decision: "SHORT", state: "CAUTION", tone: "negative" },
] as const;

function getMarketPoints() {
  return marketSeries.map((y, index) => `${24 + index * (531 / (marketSeries.length - 1))},${y}`).join(" ");
}

function getSparklinePoints() {
  return "0,38 8,35 16,37 24,28 32,31 40,23 48,26 56,17 64,20 72,12 80,15 88,7";
}

export function HeroMarketComposition() {
  const marketPoints = getMarketPoints();
  const lastPoint = marketPoints.split(" ").at(-1)?.split(",") ?? ["555", "47"];

  return (
    <div className="hero-market-composition" aria-label="Illustrative Krineo market product preview">
      <article className="hero-support-card hero-portfolio-card">
        <div className="hero-card-eyebrow"><span className="hero-status-dot hero-status-dot-blue" /> SIMULATED VALUE</div>
        <div className="hero-portfolio-value">$10,000.00</div>
        <div className="hero-card-subline"><span>Practice capital</span><strong>+2.8%</strong></div>
        <svg className="hero-sparkline" viewBox="0 0 88 42" role="img" aria-label="Illustrative positive practice capital sparkline">
          <polyline points={getSparklinePoints()} />
        </svg>
        <span className="hero-card-footnote">DEMO SNAPSHOT · NOT USER FUNDS</span>
      </article>

      <article className="hero-market-panel">
        <div className="hero-panel-windowbar">
          <div className="hero-window-dots"><span /><span /><span /></div>
          <span>KRINEO / MARKET RESEARCH</span>
          <span className="hero-panel-timestamp">18:42:07 UTC</span>
          <button type="button" className="hero-icon-button" aria-label="Market panel options"><MoreHorizontal size={15} /></button>
        </div>

        <div className="hero-market-header">
          <div className="hero-asset-mark">S</div>
          <div className="hero-market-name"><strong>SOL / USD</strong><span>DETERMINISTIC REPLAY · ILLUSTRATIVE SNAPSHOT</span></div>
          <span className="hero-replay-pill"><span /> REPLAY</span>
        </div>

        <div className="hero-price-row">
          <div><strong>$147.28</strong><span>REPLAY SNAPSHOT</span></div>
          <strong className="hero-price-change">+2.6%</strong>
          <div className="hero-price-meta"><span>24H HIGH <b>$151.90</b></span><span>24H LOW <b>$141.02</b></span></div>
        </div>

        <div className="hero-chart-block">
          <div className="hero-chart-heading"><span>MARKET EVIDENCE</span><span>15M · 36 DATA POINTS</span></div>
          <svg className="hero-market-chart" viewBox="0 0 600 220" role="img" aria-label="Illustrative SOL replay price chart with a late upward move">
            <g className="hero-chart-grid">
              <line x1="24" y1="42" x2="555" y2="42" />
              <line x1="24" y1="86" x2="555" y2="86" />
              <line x1="24" y1="130" x2="555" y2="130" />
              <line x1="24" y1="174" x2="555" y2="174" />
              <line x1="156" y1="20" x2="156" y2="184" />
              <line x1="288" y1="20" x2="288" y2="184" />
              <line x1="420" y1="20" x2="420" y2="184" />
            </g>
            <g className="hero-chart-axis-labels">
              <text x="565" y="45">152</text><text x="565" y="89">148</text><text x="565" y="133">144</text><text x="565" y="177">140</text>
              <text x="24" y="207">09:00</text><text x="190" y="207">12:00</text><text x="356" y="207">15:00</text><text x="500" y="207">18:00</text>
            </g>
            <polygon className="hero-chart-area" points={`24,184 ${marketPoints} 555,184`} />
            <polyline className="hero-chart-line" points={marketPoints} />
            <line className="hero-chart-crosshair" x1={lastPoint[0]} y1="20" x2={lastPoint[0]} y2="184" />
            <circle className="hero-chart-current" cx={lastPoint[0]} cy={lastPoint[1]} r="4" />
          </svg>
        </div>

        <div className="hero-decision-panel">
          <div className="hero-decision-heading"><span>KRINEO DECISION</span><small>REPLAY SNAPSHOT</small></div>
          <div className="hero-decision-main"><strong>LONG</strong><span>Evidence supports a guarded directional thesis.</span></div>
          <div className="hero-decision-context"><span><b>Preflight</b><em className="hero-tone-caution">CAUTION</em></span><span><b>KillSwitch</b><em className="hero-tone-positive">CLEAR</em></span><span><b>Coverage</b><em>100%</em></span></div>
        </div>

        <div className="hero-metric-strip">
          <div><span>PREFLIGHT</span><strong className="hero-tone-caution">CAUTION</strong></div>
          <div><span>KILLSWITCH</span><strong className="hero-tone-positive">CLEAR</strong></div>
          <div><span>DECISION</span><strong>LONG</strong></div>
          <div><span>RECEIPT</span><strong>READY</strong></div>
        </div>
      </article>

      <article className="hero-support-card hero-activity-card">
        <div className="hero-support-heading"><div><span className="hero-card-eyebrow">RESEARCH ACTIVITY</span><strong>Last 7 runs</strong></div><span className="hero-card-tag">DEMO</span></div>
        <div className="hero-bar-chart" aria-label="Illustrative research activity for the last seven runs">
          {bars.map((height, index) => <div className="hero-bar-column" key={`${height}-${index}`}><span style={{ height: `${height}%` }} /><small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small></div>)}
        </div>
        <div className="hero-activity-summary"><span><b>3</b> actionable</span><span><b>4</b> abstained</span></div>
        <span className="hero-card-footnote">FIXTURE ACTIVITY · NOT PRODUCTION ANALYTICS</span>
      </article>

      <article className="hero-support-card hero-risk-card">
        <div className="hero-card-eyebrow"><span className="hero-status-dot hero-status-dot-amber" /> PREFLIGHT</div>
        <strong className="hero-risk-state">CAUTION</strong>
        <span className="hero-card-subline">1 guardrail requires attention</span>
        <div className="hero-risk-divider" />
        <div className="hero-risk-killswitch"><span>KILLSWITCH</span><strong>● CLEAR</strong></div>
        <span className="hero-card-footnote">FIXTURE STATE</span>
      </article>

      <article className="hero-support-card hero-watch-card">
        <div className="hero-support-heading"><div><span className="hero-card-eyebrow">MARKET WATCH</span><strong>Asset / rules</strong></div><span className="hero-card-tag">DEMO SNAPSHOT</span></div>
        <div className="hero-watch-list">
          {watchlist.map((item) => <div className="hero-watch-row" key={item.asset}><span className="hero-watch-asset"><i>{item.asset.slice(0, 1)}</i><b>{item.asset}</b></span><span className={`hero-watch-decision hero-watch-${item.tone}`}>{item.decision}</span><small>{item.state}</small></div>)}
        </div>
        <span className="hero-card-footnote">3 ASSETS REVIEWED · ILLUSTRATIVE</span>
      </article>
    </div>
  );
}
