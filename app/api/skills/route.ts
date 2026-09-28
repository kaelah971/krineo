import { NextResponse } from "next/server";
import { STRATEGY_PREFLIGHT_DEFINITION } from "../../../lib/skills/strategy-preflight";

export function GET() {
  return NextResponse.json({
    skills: [STRATEGY_PREFLIGHT_DEFINITION],
  });
}
