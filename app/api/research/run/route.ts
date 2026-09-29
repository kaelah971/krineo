import { NextResponse } from "next/server";
import { createDemoPlaybook } from "../../../../lib/demo/governance";
import { getDemoScenarios, type DemoScenarioId } from "../../../../lib/demo/scenarios";
import { canonicalizeRules, type PlaybookVersion } from "../../../../lib/playbook";
import {
  createDeterministicResearchFixtureProvider,
  createLiveRYOResearchProvider,
  createSanitizedRYOReplayProvider,
  runResearch,
  type ResearchRun,
} from "../../../../lib/research";
const REPLAY_FIXTURE_IDS = [
  "RYO_SANITIZED",
  "DETERMINISTIC_DIRECTIONAL",
  "DETERMINISTIC_ABSTAIN",
  "DETERMINISTIC_CHANGED",
] as const;
type ReplayFixtureId = (typeof REPLAY_FIXTURE_IDS)[number];

const ALLOWED_FIELDS = new Set([
  "mode",
  "runId",
  "startedAt",
  "autoCommitPractice",
  "practiceEntryPrice",
  "practiceCurrentPrice",
  "replayFixtureId",
  "scenarioId",
  "playbookVersion",
]);

interface ParsedRequest {
  readonly mode: "LIVE" | "REPLAY";
  readonly runId?: string;
  readonly startedAt?: string;
  readonly autoCommitPractice: boolean;
  readonly practiceEntryPrice?: number;
  readonly practiceCurrentPrice?: number;
  readonly replayFixtureId: ReplayFixtureId;
  readonly scenarioId?: DemoScenarioId;
  readonly playbookVersion?: PlaybookVersion;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isScenarioId(value: unknown): value is DemoScenarioId {
  return value === "directional" || value === "abstain" || value === "changed";
}

function isReplayFixtureId(value: unknown): value is ReplayFixtureId {
  return typeof value === "string" && REPLAY_FIXTURE_IDS.includes(value as ReplayFixtureId);
}

function isPlaybookVersion(value: unknown): value is PlaybookVersion {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" && value.id.length > 0 &&
    typeof value.playbookId === "string" && value.playbookId.length > 0 &&
    typeof value.versionNumber === "number" && Number.isInteger(value.versionNumber) &&
    value.versionNumber > 0 &&
    typeof value.strategyId === "string" && value.strategyId.length > 0 &&
    typeof value.strategyVersion === "string" && value.strategyVersion.length > 0 &&
    Array.isArray(value.rules) &&
    typeof value.createdAt === "string" && value.createdAt.length > 0 &&
    typeof value.approvedAt === "string" && value.approvedAt.length > 0 &&
    value.approvedBy === "HUMAN" &&
    (() => {
      try {
        canonicalizeRules(value.rules);
        return true;
      } catch {
        return false;
      }
    })()
  );
}

function parseRequest(body: unknown):
  | { ok: true; value: ParsedRequest }
  | { ok: false; message: string } {
  if (!isRecord(body)) {
    return { ok: false, message: "Research run request must be an object." };
  }

  const unsupported = Object.keys(body).find((key) => !ALLOWED_FIELDS.has(key));
  if (unsupported !== undefined) {
    return {
      ok: false,
      message: `Research run request contains unsupported field "${unsupported}".`,
    };
  }

  if (body.mode !== "LIVE" && body.mode !== "REPLAY") {
    return { ok: false, message: "Research run mode must be LIVE or REPLAY." };
  }

  const runId = body.runId;
  if (runId !== undefined && (typeof runId !== "string" || runId.length === 0)) {
    return { ok: false, message: "runId must be a non-empty string when supplied." };
  }
  const startedAt = body.startedAt;
  if (
    startedAt !== undefined &&
    (typeof startedAt !== "string" || startedAt.length === 0)
  ) {
    return { ok: false, message: "startedAt must be a non-empty string when supplied." };
  }

  const autoCommitPractice = body.autoCommitPractice ?? false;
  if (typeof autoCommitPractice !== "boolean") {
    return { ok: false, message: "autoCommitPractice must be a boolean." };
  }

  let practiceEntryPrice: number | undefined;
  if (body.practiceEntryPrice !== undefined) {
    if (!isPositiveFiniteNumber(body.practiceEntryPrice)) {
      return { ok: false, message: "practiceEntryPrice must be a positive finite number." };
    }
    practiceEntryPrice = body.practiceEntryPrice;
  }
  let practiceCurrentPrice: number | undefined;
  if (body.practiceCurrentPrice !== undefined) {
    if (!isPositiveFiniteNumber(body.practiceCurrentPrice)) {
      return { ok: false, message: "practiceCurrentPrice must be a positive finite number." };
    }
    practiceCurrentPrice = body.practiceCurrentPrice;
  }
  if (autoCommitPractice && practiceEntryPrice === undefined) {
    return {
      ok: false,
      message: "practiceEntryPrice is required when autoCommitPractice is true.",
    };
  }

  const scenarioId = body.scenarioId;
  if (scenarioId !== undefined && !isScenarioId(scenarioId)) {
    return { ok: false, message: "scenarioId is not a supported demo scenario." };
  }
  const replayFixtureId = body.replayFixtureId ??
    (scenarioId === "directional"
      ? "DETERMINISTIC_DIRECTIONAL"
      : scenarioId === "abstain"
        ? "DETERMINISTIC_ABSTAIN"
        : scenarioId === "changed"
          ? "DETERMINISTIC_CHANGED"
          : "DETERMINISTIC_DIRECTIONAL");
  if (!isReplayFixtureId(replayFixtureId)) {
    return {
      ok: false,
      message: "replayFixtureId is not a supported replay fixture.",
    };
  }
  const scenarioFixture = scenarioId === "directional"
    ? "DETERMINISTIC_DIRECTIONAL"
    : scenarioId === "abstain"
      ? "DETERMINISTIC_ABSTAIN"
      : scenarioId === "changed"
        ? "DETERMINISTIC_CHANGED"
        : null;
  if (
    scenarioFixture !== null &&
    replayFixtureId !== scenarioFixture
  ) {
    return {
      ok: false,
      message: "scenarioId and replayFixtureId must refer to the same fixture.",
    };
  }
  if (body.mode === "LIVE" && (body.replayFixtureId !== undefined || scenarioId !== undefined)) {
    return {
      ok: false,
      message: "Replay fixture selection is only valid in REPLAY mode.",
    };
  }

  const playbookValue = body.playbookVersion;
  if (playbookValue !== undefined && !isPlaybookVersion(playbookValue)) {
    return {
      ok: false,
      message: "playbookVersion must be a human-approved Playbook version.",
    };
  }

  return {
    ok: true,
    value: {
      mode: body.mode,
      ...(runId === undefined ? {} : { runId }),
      ...(startedAt === undefined ? {} : { startedAt }),
      autoCommitPractice,
      ...(practiceEntryPrice === undefined ? {} : { practiceEntryPrice }),
      ...(practiceCurrentPrice === undefined ? {} : { practiceCurrentPrice }),
      replayFixtureId,
      ...(scenarioId === undefined ? {} : { scenarioId }),
      ...(playbookValue === undefined
        ? {}
        : { playbookVersion: playbookValue }),
    },
  };
}

function replayConfiguration(request: ParsedRequest): {
  provider: ReturnType<typeof createSanitizedRYOReplayProvider>;
  playbookVersion: PlaybookVersion;
  memorySnapshot: ReturnType<typeof getDemoScenarios>[number]["originalGovernance"]["memorySnapshot"] | null;
} {
  if (request.replayFixtureId === "RYO_SANITIZED") {
    const demo = createDemoPlaybook();
    return {
      provider: createSanitizedRYOReplayProvider(),
      playbookVersion: request.playbookVersion ?? demo.version,
      memorySnapshot: null,
    };
  }

  const scenarioId = request.scenarioId ??
    (request.replayFixtureId === "DETERMINISTIC_ABSTAIN"
      ? "abstain"
      : request.replayFixtureId === "DETERMINISTIC_CHANGED"
        ? "changed"
        : "directional");
  const scenario = getDemoScenarios().find((item) => item.id === scenarioId);
  if (scenario === undefined) {
    throw new Error("The selected deterministic research fixture is unavailable.");
  }
  return {
    provider: createDeterministicResearchFixtureProvider(scenarioId),
    playbookVersion: request.playbookVersion ?? scenario.originalGovernance.playbookVersion,
    memorySnapshot: scenario.originalGovernance.memorySnapshot,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Research run request must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = parseRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const requestValue = parsed.value;
    const configuration = requestValue.mode === "REPLAY"
      ? replayConfiguration(requestValue)
      : {
          provider: createLiveRYOResearchProvider(),
          playbookVersion:
            requestValue.playbookVersion ?? createDemoPlaybook().version,
          memorySnapshot: null,
        };

    const result: ResearchRun = await runResearch({
      provider: configuration.provider,
      playbookVersion: configuration.playbookVersion,
      memorySnapshot: configuration.memorySnapshot,
      ...(requestValue.runId === undefined ? {} : { runId: requestValue.runId }),
      ...(requestValue.startedAt === undefined
        ? {}
        : { startedAt: requestValue.startedAt }),
      autoCommitPractice: requestValue.autoCommitPractice,
      ...(requestValue.practiceEntryPrice === undefined
        ? {}
        : { practiceEntryPrice: requestValue.practiceEntryPrice }),
      ...(requestValue.practiceCurrentPrice === undefined
        ? {}
        : { practiceCurrentPrice: requestValue.practiceCurrentPrice }),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Research run could not be created.",
      },
      { status: 400 },
    );
  }
}
