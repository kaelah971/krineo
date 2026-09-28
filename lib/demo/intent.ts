import type { DemoScenario, DemoScenarioId } from "./scenarios";

const DEMO_INTENT_TERMS: Readonly<Record<DemoScenarioId, readonly string[]>> = {
  directional: ["sol", "directional", "long opportunity"],
  abstain: ["abstain", "mixed", "uncertain", "unknown", "no direction", "no clear"],
  changed: ["changed", "reversed", "reversal", "invalidate", "close the loop"],
};

function hasIntentTerm(query: string, term: string): boolean {
  return term.includes(" ") ? query.includes(term) : query.split(/[^a-z0-9]+/).includes(term);
}

/** Resolve natural-language demo requests without pretending to perform live research. */
export function resolveDemoIntent(
  input: string,
  scenarios: readonly DemoScenario[],
): DemoScenarioId | null {
  const query = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!query) return null;

  const exactMatch = scenarios.find(
    (scenario) => scenario.request.toLowerCase() === query,
  );
  if (exactMatch) return exactMatch.id;

  for (const scenarioId of ["abstain", "changed", "directional"] as const) {
    if (
      scenarios.some((scenario) => scenario.id === scenarioId) &&
      DEMO_INTENT_TERMS[scenarioId].some((term) => hasIntentTerm(query, term))
    ) {
      return scenarioId;
    }
  }

  return null;
}
