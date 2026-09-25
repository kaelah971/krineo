import {
  DECISION_STATES,
  DIRECTIONAL_EVIDENCE_DIMENSIONS,
  DIRECTIONAL_EVIDENCE_STATES,
  REGIME_FIT_STATES,
  RISK_STATES,
  SAFETY_STATES,
  type DirectionalEvidenceDimension,
  type DirectionalEvidenceState,
  type RegimeFitState,
  type RiskState,
  type SafetyState,
} from "../evidence/types";
import type { DM1EvidenceSnapshot } from "../strategy/dm1/types";
import type {
  CaseSignature,
  DecisionCase,
  DecisionOutcomeMetadata,
  DecisionOutcomeStatus,
} from "./types";

const DIRECTIONAL_STATES = new Set<string>(
  Object.values(DIRECTIONAL_EVIDENCE_STATES),
);
const RISK_STATE_SET = new Set<string>(Object.values(RISK_STATES));
const SAFETY_STATE_SET = new Set<string>(Object.values(SAFETY_STATES));
const REGIME_FIT_STATE_SET = new Set<string>(Object.values(REGIME_FIT_STATES));
const DECISION_STATE_SET = new Set<string>(Object.values(DECISION_STATES));
const OUTCOME_STATUSES = new Set<string>([
  "PENDING",
  "POSITIVE",
  "NEGATIVE",
  "FLAT",
  "INVALIDATED",
  "UNKNOWN",
]);

export const CANONICAL_UTC_RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isCanonicalRfc3339Timestamp(value: unknown): value is string {
  if (typeof value !== "string" || !CANONICAL_UTC_RFC3339_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      deepFreeze(record[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}


function readDirectionalState(
  source: Record<string, unknown>,
  dimension: DirectionalEvidenceDimension,
  strict: boolean,
): DirectionalEvidenceState {
  const raw = source[dimension];
  if (raw === undefined) {
    if (strict) {
      throw new Error(
        `Invalid CaseSignature: evidence.${dimension} is required.`,
      );
    }
    return DIRECTIONAL_EVIDENCE_STATES.UNKNOWN;
  }
  if (typeof raw !== "string" || !DIRECTIONAL_STATES.has(raw)) {
    throw new Error(
      `Invalid CaseSignature: evidence.${dimension} must be a valid DirectionalEvidenceState.`,
    );
  }
  return raw as DirectionalEvidenceState;
}

function readRiskState(source: Record<string, unknown>): RiskState {
  const raw = source["risk"];
  if (typeof raw !== "string" || !RISK_STATE_SET.has(raw)) {
    throw new Error(
      "Invalid CaseSignature: risk must be a valid RiskState.",
    );
  }
  return raw as RiskState;
}

function readSafetyState(source: Record<string, unknown>): SafetyState {
  const raw = source["safety"];
  if (typeof raw !== "string" || !SAFETY_STATE_SET.has(raw)) {
    throw new Error(
      "Invalid CaseSignature: safety must be a valid SafetyState.",
    );
  }
  return raw as SafetyState;
}

function readRegimeFitState(source: Record<string, unknown>): RegimeFitState {
  const raw = source["regimeFit"];
  if (typeof raw !== "string" || !REGIME_FIT_STATE_SET.has(raw)) {
    throw new Error(
      "Invalid CaseSignature: regimeFit must be a valid RegimeFitState.",
    );
  }
  return raw as RegimeFitState;
}

function buildSignature(
  evidenceSource: Record<string, unknown>,
  contextSource: Record<string, unknown>,
  strict: boolean,
): CaseSignature {
  const evidence: Record<DirectionalEvidenceDimension, DirectionalEvidenceState> =
    {
      [DIRECTIONAL_EVIDENCE_DIMENSIONS.DIRECTIONAL_MOMENTUM]:
        readDirectionalState(
          evidenceSource,
          DIRECTIONAL_EVIDENCE_DIMENSIONS.DIRECTIONAL_MOMENTUM,
          strict,
        ),
      [DIRECTIONAL_EVIDENCE_DIMENSIONS.TECHNICAL_CONFLUENCE]:
        readDirectionalState(
          evidenceSource,
          DIRECTIONAL_EVIDENCE_DIMENSIONS.TECHNICAL_CONFLUENCE,
          strict,
        ),
      [DIRECTIONAL_EVIDENCE_DIMENSIONS.RELATIVE_OPPORTUNITY]:
        readDirectionalState(
          evidenceSource,
          DIRECTIONAL_EVIDENCE_DIMENSIONS.RELATIVE_OPPORTUNITY,
          strict,
        ),
      [DIRECTIONAL_EVIDENCE_DIMENSIONS.MARKET_ALIGNMENT]:
        readDirectionalState(
          evidenceSource,
          DIRECTIONAL_EVIDENCE_DIMENSIONS.MARKET_ALIGNMENT,
          strict,
        ),
      [DIRECTIONAL_EVIDENCE_DIMENSIONS.SENTIMENT_DERIVATIVES]:
        readDirectionalState(
          evidenceSource,
          DIRECTIONAL_EVIDENCE_DIMENSIONS.SENTIMENT_DERIVATIVES,
          strict,
        ),
    };
  return deepFreeze({
    evidence,
    risk: readRiskState(contextSource),
    safety: readSafetyState(contextSource),
    regimeFit: readRegimeFitState(contextSource),
  });
}

/**
 * Maps a DM-1 evidence snapshot to a case signature.
 * Missing directional dimensions canonicalize to UNKNOWN.
 * The returned signature is deeply frozen.
 */
export function toCaseSignature(
  snapshot: DM1EvidenceSnapshot,
): CaseSignature {
  if (!isRecord(snapshot)) {
    throw new Error("Invalid DM1EvidenceSnapshot: snapshot must be an object.");
  }
  const evidenceSource =
    snapshot.evidence === undefined
      ? {}
      : isRecord(snapshot.evidence)
        ? snapshot.evidence
        : null;
  if (evidenceSource === null) {
    throw new Error(
      "Invalid DM1EvidenceSnapshot: evidence must be an object.",
    );
  }
  return buildSignature(
    evidenceSource,
    snapshot as unknown as Record<string, unknown>,
    false,
  );
}

/**
 * Validates an unknown value as a CaseSignature.
 * All five directional dimensions must exist and be valid states;
 * UNKNOWN is accepted as an explicit known-incomplete marker.
 * The returned signature is a deeply frozen copy.
 */
export function validateCaseSignature(signature: unknown): CaseSignature {
  if (!isRecord(signature)) {
    throw new Error("Invalid CaseSignature: signature must be an object.");
  }
  const topKeys = Object.keys(signature);
  const expectedTopKeys: Record<string, true> = {
    evidence: true,
    risk: true,
    safety: true,
    regimeFit: true,
  };
  if (topKeys.length !== 4) {
    throw new Error(
      "Invalid CaseSignature: must contain exactly evidence, risk, safety, regimeFit.",
    );
  }
  for (const k of topKeys) {
    if (!expectedTopKeys[k]) {
      throw new Error(`Invalid CaseSignature: unexpected property '${k}'.`);
    }
  }
  if (!isRecord(signature["evidence"])) {
    throw new Error("Invalid CaseSignature: evidence must be an object.");
  }
  const evidenceKeys = Object.keys(signature["evidence"]);
  const expectedDimensions: Record<string, true> = {
    DIRECTIONAL_MOMENTUM: true,
    TECHNICAL_CONFLUENCE: true,
    RELATIVE_OPPORTUNITY: true,
    MARKET_ALIGNMENT: true,
    SENTIMENT_DERIVATIVES: true,
  };
  if (evidenceKeys.length !== 5) {
    throw new Error(
      "Invalid CaseSignature: evidence must contain exactly the 5 canonical directional dimensions.",
    );
  }
  for (const key of evidenceKeys) {
    if (!expectedDimensions[key]) {
      throw new Error(
        `Invalid CaseSignature: unexpected evidence dimension '${key}'.`,
      );
    }
  }
  return buildSignature(
    signature["evidence"],
    signature,
    true,
  );
}

function validateOutcome(outcome: unknown): DecisionOutcomeMetadata {
  if (!isRecord(outcome)) {
    throw new Error(
      "Invalid DecisionCase: outcome must be an object when present.",
    );
  }
  if (typeof outcome["status"] !== "string" || !OUTCOME_STATUSES.has(outcome["status"])) {
    throw new Error(
      "Invalid DecisionCase: outcome.status must be a valid DecisionOutcomeStatus.",
    );
  }
  const validated: {
    status: DecisionOutcomeStatus;
    resolvedAt?: string;
    observationId?: string;
    realizedPnlUsd?: number;
    realizedPnlPercent?: number;
    closeReason?: string;
  } = {
    status: outcome["status"] as DecisionOutcomeStatus,
  };
  if (outcome["resolvedAt"] !== undefined) {
    if (!isCanonicalRfc3339Timestamp(outcome["resolvedAt"])) {
      throw new Error(
        "Invalid DecisionCase: outcome.resolvedAt must be a valid RFC3339 timestamp when present.",
      );
    }
    validated.resolvedAt = outcome["resolvedAt"];
  }
  if (outcome["observationId"] !== undefined) {
    if (!isNonEmptyString(outcome["observationId"])) {
      throw new Error(
        "Invalid DecisionCase: outcome.observationId must be a non-empty string when present.",
      );
    }
    validated.observationId = outcome["observationId"];
  }
  if (outcome["realizedPnlUsd"] !== undefined) {
    if (
      typeof outcome["realizedPnlUsd"] !== "number" ||
      !Number.isFinite(outcome["realizedPnlUsd"])
    ) {
      throw new Error(
        "Invalid DecisionCase: outcome.realizedPnlUsd must be a finite number when present.",
      );
    }
    validated.realizedPnlUsd = outcome["realizedPnlUsd"];
  }
  if (outcome["realizedPnlPercent"] !== undefined) {
    if (
      typeof outcome["realizedPnlPercent"] !== "number" ||
      !Number.isFinite(outcome["realizedPnlPercent"])
    ) {
      throw new Error(
        "Invalid DecisionCase: outcome.realizedPnlPercent must be a finite number when present.",
      );
    }
    validated.realizedPnlPercent = outcome["realizedPnlPercent"];
  }
  if (outcome["closeReason"] !== undefined) {
    if (!isNonEmptyString(outcome["closeReason"])) {
      throw new Error(
        "Invalid DecisionCase: outcome.closeReason must be a non-empty string when present.",
      );
    }
    validated.closeReason = outcome["closeReason"];
  }
  return deepFreeze(validated);
}

const CASE_STRING_FIELDS = [
  "id",
  "thesisId",
  "versionId",
  "evidenceSnapshotId",
  "strategyId",
  "strategyVersion",
  "asset",
] as const;

/**
 * Validates an unknown value as a DecisionCase.
 * Outcome, when present, is validated as quarantined historical context only.
 * The returned case is a deeply frozen copy.
 */
export function validateDecisionCase(decisionCase: unknown): DecisionCase {
  if (!isRecord(decisionCase)) {
    throw new Error("Invalid DecisionCase: case must be an object.");
  }
  for (const field of CASE_STRING_FIELDS) {
    if (!isNonEmptyString(decisionCase[field])) {
      throw new Error(
        `Invalid DecisionCase: ${field} must be a non-empty string.`,
      );
    }
  }
  if (
    typeof decisionCase["decision"] !== "string" ||
    !DECISION_STATE_SET.has(decisionCase["decision"])
  ) {
    throw new Error(
      'Invalid DecisionCase: decision must be one of "LONG", "SHORT", "ABSTAIN".',
    );
  }
  const signature = validateCaseSignature(decisionCase["signature"]);
  if (!isCanonicalRfc3339Timestamp(decisionCase["committedAt"])) {
    throw new Error(
      "Invalid DecisionCase: committedAt must be a valid RFC3339 timestamp.",
    );
  }
  if (!isCanonicalRfc3339Timestamp(decisionCase["observedAt"])) {
    throw new Error(
      "Invalid DecisionCase: observedAt must be a valid RFC3339 timestamp.",
    );
  }
  if (Date.parse(decisionCase["observedAt"]) > Date.parse(decisionCase["committedAt"])) {
    throw new Error(
      "Invalid DecisionCase: observedAt must not be later than committedAt.",
    );
  }
  const validated: {
    id: string;
    thesisId: string;
    versionId: string;
    evidenceSnapshotId: string;
    strategyId: string;
    strategyVersion: string;
    asset: string;
    decision: "LONG" | "SHORT" | "ABSTAIN";
    signature: CaseSignature;
    committedAt: string;
    observedAt: string;
    outcome?: DecisionOutcomeMetadata;
  } = {
    id: decisionCase["id"] as string,
    thesisId: decisionCase["thesisId"] as string,
    versionId: decisionCase["versionId"] as string,
    evidenceSnapshotId: decisionCase["evidenceSnapshotId"] as string,
    strategyId: decisionCase["strategyId"] as string,
    strategyVersion: decisionCase["strategyVersion"] as string,
    asset: decisionCase["asset"] as string,
    decision: decisionCase["decision"] as "LONG" | "SHORT" | "ABSTAIN",
    signature,
    committedAt: decisionCase["committedAt"] as string,
    observedAt: decisionCase["observedAt"] as string,
  };
  if (decisionCase["outcome"] !== undefined) {
    validated.outcome = validateOutcome(decisionCase["outcome"]);
  }
  return deepFreeze(validated);
}
