import type { DM1Config } from "./types";

export const DM1_CONFIG = {
  strategyId: "dm-1",
  name: "Defensible Momentum",
  version: "1.0.0",
  directionalWeights: {
    DIRECTIONAL_MOMENTUM: 30,
    TECHNICAL_CONFLUENCE: 20,
    RELATIVE_OPPORTUNITY: 20,
    MARKET_ALIGNMENT: 15,
    SENTIMENT_DERIVATIVES: 15,
  },
  directionThreshold: 60,
  minimumCoverage: 0.8,
  completeCoverageThreshold: 0.95,
  maximumConflict: 0.3,
  lowConflictThreshold: 0.15,
  minimumRelativeEdge: 5,
  narrativeDirectionalWeight: 0,
  requiredDirectionalDimensions: [
    "DIRECTIONAL_MOMENTUM",
    "RELATIVE_OPPORTUNITY",
    "MARKET_ALIGNMENT",
  ],
  requiredEvidence: ["risk", "safety", "regimeFit"],
} as const satisfies DM1Config;
