import {
  type CaseSignature,
  type CaseSignatureDimension,
  type DecisionCase,
  type DecisionOutcomeStatus,
} from "./types";
import { validateDecisionCase } from "./signature";
import { validateRule, type PlaybookRule } from "../playbook";

export const MEMORY_LESSONS_ALGORITHM_VERSION = "memory-lessons-v1.1" as const;
export type MemoryLessonsAlgorithmVersion =
  typeof MEMORY_LESSONS_ALGORITHM_VERSION;

export const MEMORY_LESSON_V1_THRESHOLDS = Object.freeze({
  minimumMatchingCases: 3,
  minimumAdverseCases: 2,
  minimumAdverseRate: 2 / 3,
  minimumNonMatchingResolvedCases: 2,
  minimumAdverseRateLift: 0.2,
});

export interface MemoryLessonThresholds {
  readonly minimumMatchingCases: number;
  readonly minimumAdverseCases: number;
  readonly minimumAdverseRate: number;
  readonly minimumNonMatchingResolvedCases: number;
  readonly minimumAdverseRateLift: number;
}

export const MEMORY_LESSON_REASON_CODES = {
  REPEATED_ADVERSE_OUTCOMES: "REPEATED_ADVERSE_OUTCOMES",
  REPEATED_INVALIDATION_OUTCOMES: "REPEATED_INVALIDATION_OUTCOMES",
} as const;

export type MemoryLessonReasonCode =
  (typeof MEMORY_LESSON_REASON_CODES)[keyof typeof MEMORY_LESSON_REASON_CODES];

export type LessonClassification =
  | "REPEATED_ADVERSE_PATTERN"
  | "REPEATED_INVALIDATION_PATTERN";

export type LessonConditionField = CaseSignatureDimension;
export type LessonConditionValue = string;

export interface LessonCondition {
  readonly field: LessonConditionField;
  readonly value: LessonConditionValue;
}

export interface LessonCandidate {
  readonly algorithmVersion: MemoryLessonsAlgorithmVersion;
  readonly thresholds: MemoryLessonThresholds;
  readonly condition: LessonCondition;
  readonly matchingCaseIds: readonly string[];
  readonly matchingCaseCount: number;
  readonly adverseCaseIds: readonly string[];
  readonly adverseCount: number;
  readonly adverseRate: number;
  readonly nonMatchingResolvedCaseCount: number;
  readonly nonMatchingAdverseCount: number;
  readonly nonMatchingAdverseRate: number;
  readonly adverseRateLift: number;
  readonly proposedEffect: "CAUTION" | "WAIT";
  readonly reasonCode: MemoryLessonReasonCode;
  readonly classification: LessonClassification;
}

/** Only restrictive/risk states may create one-condition learned rules in V1. */
export const MEMORY_LESSON_LEARNABLE_CONDITIONS = [
  {
    field: "DIRECTIONAL_MOMENTUM",
    values: ["OPPOSING", "STRONGLY_OPPOSING"],
  },
  {
    field: "TECHNICAL_CONFLUENCE",
    values: ["OPPOSING", "STRONGLY_OPPOSING"],
  },
  {
    field: "RELATIVE_OPPORTUNITY",
    values: ["OPPOSING", "STRONGLY_OPPOSING"],
  },
  {
    field: "MARKET_ALIGNMENT",
    values: ["OPPOSING", "STRONGLY_OPPOSING"],
  },
  {
    field: "SENTIMENT_DERIVATIVES",
    values: ["OPPOSING", "STRONGLY_OPPOSING"],
  },
  { field: "regimeFit", values: ["DEGRADED", "BROKEN"] },
  { field: "risk", values: ["ELEVATED", "EXTREME"] },
  { field: "safety", values: ["VETO"] },
] as const satisfies readonly {
  field: CaseSignatureDimension;
  values: readonly string[];
}[];

export const MEMORY_LESSON_CONDITION_FIELDS: readonly LessonConditionField[] =
  MEMORY_LESSON_LEARNABLE_CONDITIONS.map((entry) => entry.field);

// V1 only treats resolved lifecycle outcomes as evidence. NEGATIVE maps to
// CAUTION; INVALIDATED is the stronger lifecycle signal and maps to WAIT.
// BLOCK is intentionally unavailable to historical learning.
const RESOLVED_OUTCOME_STATUSES: readonly DecisionOutcomeStatus[] = [
  "POSITIVE",
  "NEGATIVE",
  "FLAT",
  "INVALIDATED",
];

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    if (Array.isArray(value)) {
      for (const entry of value) deepFreeze(entry);
    } else {
      for (const key of Object.keys(value as Record<string, unknown>)) {
        deepFreeze((value as Record<string, unknown>)[key]);
      }
    }
    Object.freeze(value);
  }
  return value;
}

function compareLexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function conditionKey(condition: LessonCondition): string {
  return `${condition.field}\u001f${condition.value}`;
}

function conditionValueFor(
  decisionCase: DecisionCase,
  field: LessonConditionField,
): LessonConditionValue {
  if (field === "risk") return decisionCase.signature.risk;
  if (field === "safety") return decisionCase.signature.safety;
  if (field === "regimeFit") return decisionCase.signature.regimeFit;
  return decisionCase.signature.evidence[
    field as keyof CaseSignature["evidence"]
  ];
}

function hasResolvedOutcome(decisionCase: DecisionCase): boolean {
  const status = decisionCase.outcome?.status;
  return status !== undefined && RESOLVED_OUTCOME_STATUSES.includes(status);
}

function isAdverse(decisionCase: DecisionCase): boolean {
  const status = decisionCase.outcome?.status;
  return status === "NEGATIVE" || status === "INVALIDATED";
}

function compareCandidates(left: LessonCandidate, right: LessonCandidate): number {
  if (right.adverseRateLift !== left.adverseRateLift) {
    return right.adverseRateLift - left.adverseRateLift;
  }
  if (right.adverseRate !== left.adverseRate) {
    return right.adverseRate - left.adverseRate;
  }
  if (right.adverseCount !== left.adverseCount) {
    return right.adverseCount - left.adverseCount;
  }
  if (right.matchingCaseCount !== left.matchingCaseCount) {
    return right.matchingCaseCount - left.matchingCaseCount;
  }
  const fieldOrder = compareLexical(left.condition.field, right.condition.field);
  if (fieldOrder !== 0) return fieldOrder;
  return compareLexical(left.condition.value, right.condition.value);
}

/**
 * Finds repeated, resolved historical conditions without reading P&L or
 * current decision outcomes. Input order is irrelevant; case IDs are the
 * canonical tie-break and evidence order.
 */
export function detectLessonCandidates(
  historicalCases: readonly DecisionCase[],
): readonly LessonCandidate[] {
  if (!Array.isArray(historicalCases)) {
    throw new Error("Invalid lesson input: historicalCases must be an array.");
  }

  const validated = historicalCases.map((entry) => validateDecisionCase(entry));
  const ordered = [...validated].sort((left, right) =>
    compareLexical(left.id, right.id),
  );
  const seenIds = new Set<string>();
  for (const decisionCase of ordered) {
    if (seenIds.has(decisionCase.id)) {
      throw new Error(`Invalid lesson input: duplicate case id "${decisionCase.id}".`);
    }
    seenIds.add(decisionCase.id);
  }

  const resolvedCases = ordered.filter(hasResolvedOutcome);
  const groups = new Map<
    string,
    { readonly condition: LessonCondition; readonly cases: DecisionCase[] }
  >();

  for (const decisionCase of resolvedCases) {
    for (const policy of MEMORY_LESSON_LEARNABLE_CONDITIONS) {
      const value = conditionValueFor(decisionCase, policy.field);
      if (!(policy.values as readonly string[]).includes(value)) continue;
      const condition = { field: policy.field, value } satisfies LessonCondition;
      const key = conditionKey(condition);
      const group = groups.get(key);
      if (group === undefined) {
        groups.set(key, { condition, cases: [decisionCase] });
      } else {
        group.cases.push(decisionCase);
      }
    }
  }

  const candidates: LessonCandidate[] = [];
  for (const group of groups.values()) {
    const matchingCaseIds = group.cases.map((entry) => entry.id).sort(compareLexical);
    const adverseCaseIds = group.cases
      .filter(isAdverse)
      .map((entry) => entry.id)
      .sort(compareLexical);
    const nonMatchingCases = resolvedCases.filter((entry) => {
      const value = conditionValueFor(entry, group.condition.field);
      return value !== "UNKNOWN" && value !== group.condition.value;
    });
    const nonMatchingCaseIds = nonMatchingCases
      .map((entry) => entry.id)
      .sort(compareLexical);
    const nonMatchingAdverseCount = nonMatchingCases.filter(isAdverse).length;
    const matchingCaseCount = matchingCaseIds.length;
    const adverseCount = adverseCaseIds.length;
    const adverseRate = adverseCount / matchingCaseCount;
    const nonMatchingResolvedCaseCount = nonMatchingCaseIds.length;
    const nonMatchingAdverseRate =
      nonMatchingResolvedCaseCount === 0
        ? 0
        : nonMatchingAdverseCount / nonMatchingResolvedCaseCount;
    const adverseRateLift = adverseRate - nonMatchingAdverseRate;
    if (
      matchingCaseCount < MEMORY_LESSON_V1_THRESHOLDS.minimumMatchingCases ||
      adverseCount < MEMORY_LESSON_V1_THRESHOLDS.minimumAdverseCases ||
      adverseRate < MEMORY_LESSON_V1_THRESHOLDS.minimumAdverseRate ||
      nonMatchingResolvedCaseCount <
        MEMORY_LESSON_V1_THRESHOLDS.minimumNonMatchingResolvedCases ||
      adverseRateLift + Number.EPSILON <
        MEMORY_LESSON_V1_THRESHOLDS.minimumAdverseRateLift
    ) {
      continue;
    }

    const hasInvalidation = group.cases.some(
      (entry) => entry.outcome?.status === "INVALIDATED",
    );
    candidates.push({
      algorithmVersion: MEMORY_LESSONS_ALGORITHM_VERSION,
      thresholds: MEMORY_LESSON_V1_THRESHOLDS,
      condition: group.condition,
      matchingCaseIds,
      matchingCaseCount,
      adverseCaseIds,
      adverseCount,
      adverseRate,
      nonMatchingResolvedCaseCount,
      nonMatchingAdverseCount,
      nonMatchingAdverseRate,
      adverseRateLift,
      proposedEffect: hasInvalidation ? "WAIT" : "CAUTION",
      reasonCode: hasInvalidation
        ? MEMORY_LESSON_REASON_CODES.REPEATED_INVALIDATION_OUTCOMES
        : MEMORY_LESSON_REASON_CODES.REPEATED_ADVERSE_OUTCOMES,
      classification: hasInvalidation
        ? "REPEATED_INVALIDATION_PATTERN"
        : "REPEATED_ADVERSE_PATTERN",
    });
  }

  candidates.sort(compareCandidates);
  return deepFreeze(candidates);
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

/** Converts an inspected candidate into an existing, validated M2 rule. */
export function lessonCandidateToRule(candidate: LessonCandidate): PlaybookRule {
  return validateRule({
    id: `memory-lesson-${slug(candidate.condition.field)}-${slug(candidate.condition.value)}-${candidate.proposedEffect.toLowerCase()}`,
    effect: candidate.proposedEffect,
    conditions: [
      {
        field: candidate.condition.field,
        operator: "EQUALS",
        value: candidate.condition.value,
      },
    ],
  });
}

const LESSON_FIELD_LABELS: Readonly<Record<LessonConditionField, string>> = {
  DIRECTIONAL_MOMENTUM: "Directional momentum",
  TECHNICAL_CONFLUENCE: "Technical confluence",
  RELATIVE_OPPORTUNITY: "Relative opportunity",
  MARKET_ALIGNMENT: "Market alignment",
  SENTIMENT_DERIVATIVES: "Sentiment / derivatives",
  risk: "Risk",
  safety: "Safety",
  regimeFit: "Regime",
};

export function formatLessonCondition(condition: LessonCondition): string {
  return `${LESSON_FIELD_LABELS[condition.field]} = ${condition.value}`;
}
