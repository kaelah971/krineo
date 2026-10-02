import { marketingSnapshot } from "./fixtures";
import styles from "./landing.module.css";

export function TradingChart({ kind = "candles" }: { kind?: "candles" | "equity" }) {
  if (kind === "equity") {
    const values = marketingSnapshot.equityHistory;
    const min = Math.min(...values) - 5;
    const range = Math.max(...values) - min + 5;
    const points = values.map((value, index) => `${8 + (index / (values.length - 1)) * 264},${92 - ((value - min) / range) * 74}`).join(" ");
    return <svg className={styles.equityChart} viewBox="0 0 280 116" role="img" aria-label="Illustrative simulated equity path ending at $10,035.71">
      <path className={styles.chartGrid} d="M8 32H272 M8 62H272 M8 92H272" />
      <polygon points={`8,100 ${points} 272,100`} className={styles.chartArea} />
      <polyline points={points} className={styles.chartLine} />
      <g className={styles.chartLabels}><text x="8" y="113">09:00</text><text x="124" y="113">12:00</text><text x="241" y="113">15:45</text></g>
    </svg>;
  }

  const y = (price: number) => 148 - ((price - 138) / 9) * 135;
  return <svg className={styles.candleChart} viewBox="0 0 280 205" preserveAspectRatio="none" role="img" aria-label="Illustrative SOL 15-minute candles with volume, ending at $145.00. Not historical market data.">
    <g className={styles.chartGrid}>{[139, 141, 143, 145, 147].map((price) => <line key={price} x1="4" x2="244" y1={y(price)} y2={y(price)} />)}</g>
    <g className={styles.chartLabels}>{[139, 141, 143, 145, 147].map((price) => <text key={price} x="251" y={y(price) + 3}>{price.toFixed(0)}</text>)}<text x="4" y="201">09:00</text><text x="108" y="201">12:00</text><text x="216" y="201">15:45</text></g>
    <line x1="4" x2="244" y1={y(145)} y2={y(145)} className={styles.lastPriceLine} />
    {marketingSnapshot.candles.map((candle, index) => {
      const x = 7 + index * 8.6;
      const up = candle.close >= candle.open;
      return <g key={index} className={up ? styles.candleUp : styles.candleDown}>
        <line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} />
        <rect x={x - 2.5} width="5" y={Math.min(y(candle.open), y(candle.close))} height={Math.max(1.5, Math.abs(y(candle.open) - y(candle.close)))} />
        <rect x={x - 2.5} width="5" y={184 - candle.volume * 0.33} height={candle.volume * 0.33} opacity=".35" />
      </g>;
    })}
  </svg>;
}
