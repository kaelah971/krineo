export const RESEARCH_INTENTS = {
  AUTONOMOUS_DISCOVERY: "AUTONOMOUS_DISCOVERY",
  ANALYZE_ASSET: "ANALYZE_ASSET",
  COMPARE_ASSETS: "COMPARE_ASSETS",
  REFRESH_THESIS: "REFRESH_THESIS",
} as const;

export type ResearchIntent =
  (typeof RESEARCH_INTENTS)[keyof typeof RESEARCH_INTENTS];

export const RESEARCH_RUN_STAGES = {
  CREATED: "CREATED",
  MARKET_CONTEXT: "MARKET_CONTEXT",
  DISCOVERY: "DISCOVERY",
  COMPARISON: "COMPARISON",
  DEEP_RESEARCH: "DEEP_RESEARCH",
  NORMALIZING: "NORMALIZING",
  PROVISIONAL: "PROVISIONAL",
  KILLSWITCH: "KILLSWITCH",
  COMMITTED: "COMMITTED",
  ABSTAINED: "ABSTAINED",
  FAILED: "FAILED",
} as const;

export type ResearchRunStage =
  (typeof RESEARCH_RUN_STAGES)[keyof typeof RESEARCH_RUN_STAGES];

export type ResearchRunStatus = ResearchRunStage;

export interface ResearchRun {
  id: string;
  intent: ResearchIntent;
  status: ResearchRunStatus;
  currentStage?: ResearchRunStage;
  createdAt: string;
  updatedAt: string;
}
