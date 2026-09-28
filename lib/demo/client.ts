import type { DemoCommitResult } from "./commit";
import type { DemoRefreshResult } from "./refresh";
import type { DemoScenarioId, DemoScenarioPhase } from "./scenarios";

export async function requestDemoCommit(
  scenarioId: DemoScenarioId,
  phase: DemoScenarioPhase = "current",
): Promise<DemoCommitResult> {
  const response = await fetch("/api/demo/commit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId, phase }),
  });

  if (!response.ok) {
    throw new Error("The offline commitment check could not be completed.");
  }

  return (await response.json()) as DemoCommitResult;
}

export async function requestDemoRefresh(
  scenarioId: DemoScenarioId,
  committedVersionId: string,
): Promise<DemoRefreshResult> {
  const response = await fetch("/api/demo/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId, committedVersionId }),
  });

  if (!response.ok) {
    throw new Error("The offline evidence refresh could not be completed.");
  }

  return (await response.json()) as DemoRefreshResult;
}
