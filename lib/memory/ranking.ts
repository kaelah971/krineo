import { compareCaseSimilarityV1 } from "./similarity";
import { validateCaseSignature, validateDecisionCase } from "./signature";
import type {
  CaseSignature,
  DecisionCase,
  RankedCase,
  RetrievalOptions,
} from "./types";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function compareLexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function resolveThreshold(
  value: number | undefined,
  field: "minimumSimilarity" | "minimumComparisonCoverage",
): number {
  if (value === undefined) {
    return 0;
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(
      `Invalid RetrievalOptions: ${field} must be a finite number in [0, 1].`,
    );
  }
  return value;
}

function resolveLimit(value: number | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      "Invalid RetrievalOptions: limit must be a positive integer.",
    );
  }
  return value;
}

/**
 * Ranks historical cases against a target signature.
 * Similarity uses signatures only; candidate outcome and decision
 * never participate in scoring or ranking.
 * Deterministic: input-order invariant, code-unit lexical tie-breaks.
 * The returned array and its entries are deeply frozen.
 */
export function rankComparableCases(
  target: CaseSignature,
  historicalCases: readonly DecisionCase[],
  options?: RetrievalOptions,
): readonly RankedCase[] {
  const validTarget = validateCaseSignature(target);
  if (!Array.isArray(historicalCases)) {
    throw new Error(
      "Invalid rankComparableCases input: historicalCases must be an array.",
    );
  }
  if (options !== undefined) {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
      throw new Error(
        "Invalid RetrievalOptions: options must be an object when present.",
      );
    }
  }
  const minimumSimilarity = resolveThreshold(
    options?.minimumSimilarity,
    "minimumSimilarity",
  );
  const minimumComparisonCoverage = resolveThreshold(
    options?.minimumComparisonCoverage,
    "minimumComparisonCoverage",
  );
  const limit = resolveLimit(options?.limit);

  const validated: DecisionCase[] = historicalCases.map((entry) =>
    validateDecisionCase(entry),
  );
  const seen = new Set<string>();
  for (const entry of validated) {
    if (seen.has(entry.id)) {
      throw new Error(
        `Invalid historicalCases: duplicate candidate id "${entry.id}".`,
      );
    }
    seen.add(entry.id);
  }
  const ordered = [...validated].sort((left, right) =>
    compareLexical(left.id, right.id),
  );

  const scored: Array<Omit<RankedCase, "rank">> = [];
  for (const decisionCase of ordered) {
    const similarity = compareCaseSimilarityV1(
      validTarget,
      decisionCase.signature,
    );
    if (similarity.overallSimilarity < minimumSimilarity) {
      continue;
    }
    if (similarity.comparisonCoverage < minimumComparisonCoverage) {
      continue;
    }
    scored.push({
      caseId: decisionCase.id,
      decisionCase,
      similarity,
    });
  }
  scored.sort((left, right) => {
    if (right.similarity.overallSimilarity !== left.similarity.overallSimilarity) {
      return right.similarity.overallSimilarity - left.similarity.overallSimilarity;
    }
    if (right.similarity.comparisonCoverage !== left.similarity.comparisonCoverage) {
      return right.similarity.comparisonCoverage - left.similarity.comparisonCoverage;
    }
    return compareLexical(left.caseId, right.caseId);
  });
  const limited = limit === null ? scored : scored.slice(0, limit);
  const ranked: RankedCase[] = limited.map((entry, index) => ({
    rank: index + 1,
    caseId: entry.caseId,
    decisionCase: entry.decisionCase,
    similarity: entry.similarity,
  }));
  return deepFreeze(ranked);
}
