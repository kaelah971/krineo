import type { PlaybookVersion } from "../playbook";
import type { ResearchRun } from "../research";

export type PersonalResearchRequest = {
  readonly mode: "LIVE" | "REPLAY";
  readonly runId: string;
  readonly startedAt: string;
  readonly autoCommitPractice: boolean;
  readonly practiceEntryPrice?: number;
  readonly practiceCurrentPrice?: number;
  readonly replayFixtureId?:
    | "DETERMINISTIC_DIRECTIONAL"
    | "DETERMINISTIC_ABSTAIN"
    | "DETERMINISTIC_CHANGED";
  readonly playbookVersion: PlaybookVersion;
};

export async function requestPersonalResearch(
  input: PersonalResearchRequest,
): Promise<ResearchRun> {
  const response = await fetch("/api/research/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "Research could not be completed.";
    throw new Error(message);
  }

  return payload as ResearchRun;
}
