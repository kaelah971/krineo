import { NextResponse } from "next/server";
import { commitDemoScenario } from "@/lib/demo/commit";
import {
  getDemoScenarios,
  type DemoScenarioPhase,
} from "@/lib/demo/scenarios";

interface DemoCommitRequest {
  readonly scenarioId?: unknown;
  readonly phase?: unknown;
}

export async function POST(request: Request) {
  let body: DemoCommitRequest | null = null;

  try {
    body = (await request.json()) as DemoCommitRequest;
  } catch {
    return NextResponse.json(
      { message: "A scenario ID is required." },
      { status: 400 },
    );
  }

  if (typeof body?.scenarioId !== "string") {
    return NextResponse.json(
      { message: "A scenario ID is required." },
      { status: 400 },
    );
  }

  const scenario = getDemoScenarios().find(
    (item) => item.id === body?.scenarioId,
  );

  if (scenario === undefined) {
    return NextResponse.json(
      { message: "That demo scenario is not available." },
      { status: 404 },
    );
  }

  const phase: DemoScenarioPhase = body.phase === "original" ? "original" : "current";
  return NextResponse.json(commitDemoScenario(scenario, phase));
}
