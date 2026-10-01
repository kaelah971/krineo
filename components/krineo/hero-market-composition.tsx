import { MoreHorizontal } from "lucide-react";

const candleSeries = [
  { open: 143.2, high: 144.1, low: 142.6, close: 143.7, volume: 38 },
  { open: 143.7, high: 144.6, low: 143.1, close: 144.3, volume: 44 },
  { open: 144.3, high: 145.1, low: 143.6, close: 143.9, volume: 58 },
  { open: 143.9, high: 144.5, low: 142.9, close: 143.1, volume: 52 },
  { open: 143.1, high: 143.8, low: 141.8, close: 142.4, volume: 68 },
  { open: 142.4, high: 143.2, low: 141.7, close: 142.9, volume: 34 },
  { open: 142.9, high: 143.9, low: 142.4, close: 143.6, volume: 40 },
  { open: 143.6, high: 144.2, low: 142.8, close: 143.0, volume: 45 },
  { open: 143.0, high: 143.7, low: 141.8, close: 142.1, volume: 61 },
  { open: 142.1, high: 143.1, low: 141.6, close: 142.8, volume: 46 },
  { open: 142.8, high: 143.9, low: 142.2, close: 143.5, volume: 41 },
  { open: 143.5, high: 144.6, low: 143.0, close: 144.2, volume: 50 },
  { open: 144.2, high: 144.9, low: 143.1, close: 143.6, volume: 63 },
  { open: 143.6, high: 144.0, low: 142.7, close: 143.2, volume: 48 },
  { open: 143.2, high: 144.4, low: 142.8, close: 144.1, volume: 55 },
  { open: 144.1, high: 145.2, low: 143.6, close: 144.8, volume: 42 },
  { open: 144.8, high: 145.4, low: 144.0, close: 144.3, volume: 47 },
  { open: 144.3, high: 145.0, low: 143.5, close: 144.7, volume: 40 },
  { open: 144.7, high: 145.9, low: 144.2, close: 145.5, volume: 52 },
  { open: 145.5, high: 146.0, low: 144.7, close: 145.0, volume: 58 },
  { open: 145.0, high: 146.3, low: 144.8, close: 145.9, volume: 51 },
  { open: 145.9, high: 146.8, low: 145.2, close: 146.5, volume: 63 },
  { open: 146.5, high: 147.1, low: 145.8, close: 146.0, volume: 70 },
  { open: 146.0, high: 146.8, low: 145.3, close: 146.6, volume: 48 },
  { open: 146.6, high: 147.5, low: 146.1, close: 147.1, volume: 64 },
  { open: 147.1, high: 147.6, low: 146.3, close: 146.8, volume: 57 },
  { open: 146.8, high: 147.9, low: 146.4, close: 147.2, volume: 74 },
  { open: 147.2, high: 148.3, low: 146.7, close: 147.28, volume: 91 },
] as const;

const bars = [48, 72, 38, 84, 59, 96, 68];
const watchlist = [
  { asset: "SOL", decision: "LONG", state: "CAUTION", tone: "positive" },
  { asset: "ETH", decision: "ABSTAIN", state: "WAIT", tone: "neutral" },
  { asset: "BTC", decision: "SHORT", state: "CAUTION", tone: "negative" },
] as const;

const chart = { left: 25, right: 552, top: 18, bottom: 165, volumeTop: 188, volumeBottom: 232 };
const priceMin = 139;
const priceMax = 152;
const candleStep = (chart.right - chart.left) / (candleSeries.length - 1);

function priceY(value: number) {
  return chart.top + ((priceMax - value) / (priceMax - priceMin)) * (chart.bottom - chart.top);
}

function candleX(index: number) {
  return chart.left + index * candleStep;
}

function volumeHeight(value: number) {
  return 9 + (value / 100) * 35;
}

function getSparklinePoints() {
  return "0,38 8,35 16,37 24,28 32,31 40,23 48,26 56,17 64,20 72,12 80,15 88,7";
}

export function HeroMarketComposition() {
  const currentCandle = candleSeries[candleSeries.length - 1];
  const currentY = priceY(currentCandle.close);
  const currentX = candleX(candleSeries.length - 1);

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
          <div className="hero-chart-heading"><span>MARKET EVIDENCE · 15M</span><span>28 CANDLES · VOLUME</span></div>
          <svg className="hero-market-chart" viewBox="0 0 600 270" role="img" aria-label="Illustrative SOL replay candlestick chart with volume bars and an upward directional bias">
            <g className="hero-chart-grid">
              {[30, 64, 98, 132, 165].map((y) => <line key={`h-${y}`} x1={chart.left} y1={y} x2={chart.right} y2={y} />)}
              {[157, 289, 421].map((x) => <line key={`v-${x}`} x1={x} y1={chart.top} x2={x} y2={chart.volumeBottom} />)}
              <line className="hero-volume-divider" x1={chart.left} y1="180" x2={chart.right} y2="180" />
            </g>
            <g className="hero-chart-axis-labels">
              <text x="563" y="33">152</text><text x="563" y="67">149</text><text x="563" y="101">146</text><text x="563" y="135">143</text><text x="563" y="168">140</text>
              <text x="25" y="260">09:00</text><text x="188" y="260">12:00</text><text x="352" y="260">15:00</text><text x="498" y="260">18:00</text>
              <text className="hero-volume-label" x="25" y="192">VOL</text>
            </g>
            <line className="hero-chart-current-line" x1={chart.left} y1={currentY} x2={chart.right} y2={currentY} />
            {candleSeries.map((candle, index) => {
              const x = candleX(index);
              const openY = priceY(candle.open);
              const closeY = priceY(candle.close);
              const highY = priceY(candle.high);
              const lowY = priceY(candle.low);
              const positive = candle.close >= candle.open;
              return (
                <g className={positive ? "hero-candle hero-candle-positive" : "hero-candle hero-candle-negative"} key={`${candle.open}-${index}`}>
                  <line x1={x} y1={highY} x2={x} y2={lowY} />
                  <rect x={x - 4} y={Math.min(openY, closeY)} width="8" height={Math.max(2, Math.abs(closeY - openY))} />
                  <rect className="hero-volume-bar" x={x - 4} y={chart.volumeBottom - volumeHeight(candle.volume)} width="8" height={volumeHeight(candle.volume)} />
                </g>
              );
            })}
            <circle className="hero-chart-current" cx={currentX} cy={currentY} r="3.5" />
            <g className="hero-current-label"><rect x="557" y={currentY - 8} width="40" height="16" rx="2" /><text x="561" y={currentY + 3}>147.28</text></g>
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
