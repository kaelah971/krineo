import { NextResponse } from "next/server";
import { commitDemoScenario } from "@/lib/demo/commit";
import { refreshDemoScenario } from "@/lib/demo/refresh";
import { getDemoScenarios } from "@/lib/demo/scenarios";

interface DemoRefreshRequest {
  readonly scenarioId?: unknown;
  readonly committedVersionId?: unknown;
}

export async function POST(request: Request) {
  let body: DemoRefreshRequest | null = null;

  try {
    body = (await request.json()) as DemoRefreshRequest;
  } catch {
    return NextResponse.json(
      { message: "A scenario ID and committed version are required." },
      { status: 400 },
    );
  }

  if (
    typeof body?.scenarioId !== "string" ||
    typeof body.committedVersionId !== "string"
  ) {
    return NextResponse.json(
      { message: "A scenario ID and committed version are required." },
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

  const committed = commitDemoScenario(scenario, "original");
  if (!committed.ok) {
    return NextResponse.json(committed, { status: 409 });
  }

  if (committed.version.id !== body.committedVersionId) {
    return NextResponse.json(
      { message: "The committed version does not match this demo scenario." },
      { status: 409 },
    );
  }

  return NextResponse.json(refreshDemoScenario(scenario, committed));
}
