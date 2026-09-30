import { describe, expect, it } from "vitest";
import { POST as runResearchRoute } from "../app/api/research/run/route";
import { createPersonalPlaybook } from "../lib/workspace/store";

function request(body: unknown) {
  return new Request("http://localhost/api/research/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("personal research pipeline", () => {
  it("accepts a locally-created PlaybookVersion for explicit replay", async () => {
    const playbook = createPersonalPlaybook(
      "Defensible Momentum Guardrails",
      "2026-09-01T12:00:00.000Z",
    );

    const response = await runResearchRoute(request({
      mode: "REPLAY",
      runId: "personal-replay-test",
      startedAt: "2026-09-01T12:01:00.000Z",
      replayFixtureId: "DETERMINISTIC_DIRECTIONAL",
      autoCommitPractice: false,
      playbookVersion: playbook.version,
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.mode).toBe("REPLAY");
    expect(result.provider.source).toBe("DETERMINISTIC_RESEARCH_FIXTURE");
    expect(result.playbookVersionId).toBe(playbook.version.id);
  });

  it("passes the same personal PlaybookVersion into a simulated commit", async () => {
    const playbook = createPersonalPlaybook(
      "Defensible Momentum Guardrails",
      "2026-09-01T12:00:00.000Z",
    );

    const response = await runResearchRoute(request({
      mode: "REPLAY",
      runId: "personal-commit-test",
      startedAt: "2026-09-01T12:02:00.000Z",
      replayFixtureId: "DETERMINISTIC_DIRECTIONAL",
      autoCommitPractice: true,
      practiceEntryPrice: 150,
      practiceCurrentPrice: 155,
      playbookVersion: playbook.version,
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.playbookVersionId).toBe(playbook.version.id);
    expect(result.commit?.receipt.canonicalHash).toEqual(expect.any(String));
    expect(result.commit?.practice.position.id).toEqual(expect.any(String));
  });
});
