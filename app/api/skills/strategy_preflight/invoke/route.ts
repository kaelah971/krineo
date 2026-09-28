import { NextResponse } from "next/server";
import {
  createStrategyPreflightErrorResponse,
  invokeStrategyPreflight,
  responseHttpStatus,
} from "../../../../../lib/skills/strategy-preflight";

export async function POST(request: Request) {
  const startedAt = Date.now();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const response = createStrategyPreflightErrorResponse(
      "INVALID_REQUEST",
      "Skill call request must be valid JSON.",
      startedAt,
    );
    return NextResponse.json(response, { status: 400 });
  }

  const response = invokeStrategyPreflight(body, startedAt);
  return NextResponse.json(response, { status: responseHttpStatus(response) });
}
