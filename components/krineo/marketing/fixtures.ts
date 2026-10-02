/** Fixed campaign illustration based on the directional practice demo.
 * Chart paths are synthetic, not historical or current market observations.
 * No product state, storage or market connection is accessed here.
 */
export type Candle = Readonly<{
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}>;

const closes = [140, 140.8, 140.4, 141.5, 142.1, 141.2, 140.6, 141.1, 142.3, 142.7, 141.8, 142.2, 143.4, 143.1, 142.6, 143.5, 144.2, 143.6, 144.4, 143.8, 142.9, 143.6, 144.5, 144.1, 143.7, 144.6, 145.4, 145] as const;
const candles: readonly Candle[] = closes.map((close, index) => {
  const open = index === 0 ? 139.6 : closes[index - 1];
  return {
    open,
    close,
    high: Math.max(open, close) + 0.3 + (index % 3) * 0.15,
    low: Math.min(open, close) - 0.25 - (index % 4) * 0.12,
    volume: 24 + ((index * 17) % 57),
  };
});

const startingCapital = 10_000;
const notional = 1_000;
const entryPrice = 140;
const markPrice = 145;
const quantity = notional / entryPrice;
const positionValue = quantity * markPrice;
const positionPnl = positionValue - notional;
const unallocatedCapital = startingCapital - notional;
const equity = unallocatedCapital + positionValue;

export const marketingSnapshot = {
  fixtureDate: "2026-09-05",
  startingCapital,
  notional,
  entryPrice,
  markPrice,
  quantity,
  positionValue,
  positionPnl,
  unallocatedCapital,
  equity,
  positionReturn: (positionPnl / notional) * 100,
  portfolioReturn: (positionPnl / startingCapital) * 100,
  decision: "LONG",
  preflight: "CAUTION",
  killSwitch: "CLEAR",
  candles,
  equityHistory: closes.map((price) => unallocatedCapital + quantity * price),
} as const;

export function usd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Research story uses the separate, explicitly mixed-evidence demo case. */
export const marketingResearchCase = {
  decision: "ABSTAIN",
  preflight: "WAIT",
  momentum: "NEUTRAL",
  sentiment: "UNKNOWN",
} as const;

/** Separate changed fixture; never a live update of the hero snapshot. */
export const marketingMemorySnapshot = {
  scenario: "changed",
  before: "LONG",
  after: "SHORT",
} as const;
