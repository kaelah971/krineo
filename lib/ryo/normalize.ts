import type {
  DirectionalEvidenceDimension,
  DirectionalEvidenceState,
  EvidenceItem,
} from "../evidence/types";
import { REASON_CODES } from "../strategy/dm1/reason-codes";
import type { DM1EvidenceSnapshot } from "../strategy/dm1/types";
import { parseSanitizedRYOFixture } from "./fixtures";
import {
  RYO_PROVIDER_STATUSES,
  type RYOCallResult,
  type RYOCanonicalEvidence,
  type RYOCanonicalEvidenceSnapshot,
  type RYOContextStates,
  type RYOProvenance,
  type RYOProviderStatus,
  type SanitizedRYOFixture,
} from "./types";

const DIMENSIONS: readonly DirectionalEvidenceDimension[] = [
  "DIRECTIONAL_MOMENTUM",
  "TECHNICAL_CONFLUENCE",
  "RELATIVE_OPPORTUNITY",
  "MARKET_ALIGNMENT",
  "SENTIMENT_DERIVATIVES",
];

export const RYO_NORMALIZATION_NOTES: Readonly<
  Record<DirectionalEvidenceDimension | "risk" | "safety" | "regimeFit", string>
> = {
  DIRECTIONAL_MOMENTUM:
    "The captured market overview has no asset-level momentum measurement.",
  TECHNICAL_CONFLUENCE:
    "The captured market overview has no asset-level technical measurements.",
  RELATIVE_OPPORTUNITY:
    "The captured scan returned no ranked candidates, so no relative winner is asserted.",
  MARKET_ALIGNMENT:
    "The captured structured market regime is mapped only when it is explicitly neutral.",
  SENTIMENT_DERIVATIVES:
    "The captured sentiment lane is null or unavailable; no stance is inferred.",
  risk: "The captured response has no target-specific risk state.",
  safety: "The captured response has no target-specific safety state.",
  regimeFit: "A market regime is not enough to assert target-specific regime fit.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validAsset(asset: string): string {
  const normalized = asset.trim();
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(normalized)) {
    throw new Error("RYO asset must be a short token symbol or slug.");
  }

  return normalized;
}

function statusFromProviderPayload(
  payload: Record<string, unknown>,
): RYOProviderStatus {
  const status = typeof payload.status === "string"
    ? payload.status.toLowerCase()
    : "";
  if (status === "success") return RYO_PROVIDER_STATUSES.SUCCESS;
  if (status === "partial") return RYO_PROVIDER_STATUSES.PARTIAL;
  if (status === "not_found" || status === "not-found") {
    return RYO_PROVIDER_STATUSES.NOT_FOUND;
  }
  if (status === "unauthorized") return RYO_PROVIDER_STATUSES.UNAUTHORIZED;
  if (status === "rate_limited" || status === "rate-limited") {
    return RYO_PROVIDER_STATUSES.RATE_LIMITED;
  }
  if (status === "timeout") return RYO_PROVIDER_STATUSES.TIMEOUT;
  if (status === "invalid_response" || status === "invalid-response") {
    return RYO_PROVIDER_STATUSES.INVALID_RESPONSE;
  }
  if (status === "error") return RYO_PROVIDER_STATUSES.ERROR;
  if (status === "unavailable") {
    const serialized = JSON.stringify(payload.data ?? payload.error ?? "").toLowerCase();
    return serialized.includes("credit limit") || serialized.includes("rate limit")
      ? RYO_PROVIDER_STATUSES.RATE_LIMITED
      : RYO_PROVIDER_STATUSES.UNAVAILABLE;
  }

  return RYO_PROVIDER_STATUSES.INVALID_RESPONSE;
}

function asOfFromPayload(
  payload: Record<string, unknown>,
  provenance: RYOProvenance,
): string {
  return typeof payload.as_of === "string" && payload.as_of.length > 0
    ? payload.as_of
    : provenance.asOf ?? "unknown";
}

function sourceFor(provenance: RYOProvenance): string {
  return `RYO/${provenance.tool}`;
}

function makeEvidenceItem(
  asset: string,
  dimension: DirectionalEvidenceDimension,
  state: DirectionalEvidenceState,
  provenance: RYOProvenance,
  observedAt: string,
): EvidenceItem {
  const knownState = state !== "UNKNOWN";
  return {
    id: `ryo-${provenance.tool}-${asset}-${dimension.toLowerCase()}`,
    dimension,
    state,
    source: sourceFor(provenance),
    observedAt,
    reasonCode: knownState
      ? "MARKET_ALIGNMENT_SUPPORTIVE"
      : REASON_CODES.REQUIRED_EVIDENCE_UNAVAILABLE,
    explanation: knownState
      ? "RYO reported an explicit structured market regime for this snapshot."
      : RYO_NORMALIZATION_NOTES[dimension],
    rawReference: knownState
      ? `RYO.${provenance.tool}.data.regime`
      : `RYO.${provenance.tool}.data unavailable`,
  };
}

function makeUnknownEvidence(): RYOCanonicalEvidence {
  return {
    DIRECTIONAL_MOMENTUM: "UNKNOWN",
    TECHNICAL_CONFLUENCE: "UNKNOWN",
    RELATIVE_OPPORTUNITY: "UNKNOWN",
    MARKET_ALIGNMENT: "UNKNOWN",
    SENTIMENT_DERIVATIVES: "UNKNOWN",
  };
}

function makeContextStates(): RYOContextStates {
  return {
    risk: "UNKNOWN",
    safety: "UNKNOWN",
    regimeFit: "UNKNOWN",
  };
}

function normalizePayload(
  asset: string,
  payload: Record<string, unknown>,
  provenance: RYOProvenance,
  fallbackStatus?: RYOProviderStatus,
): RYOCanonicalEvidenceSnapshot {
  const providerStatus = fallbackStatus ?? statusFromProviderPayload(payload);
  const evidence: Record<
    DirectionalEvidenceDimension,
    DirectionalEvidenceState
  > = makeUnknownEvidence();
  const asOf = asOfFromPayload(payload, provenance);
  const data = isRecord(payload.data) ? payload.data : null;

  // This is the only directional mapping supported by the captured live
  // response: data.regime was a structured "neutral" value. It is market
  // context, not target-specific risk or regime fit.
  if (
    (providerStatus === RYO_PROVIDER_STATUSES.SUCCESS ||
      providerStatus === RYO_PROVIDER_STATUSES.PARTIAL) &&
    data !== null &&
    data.regime === "neutral"
  ) {
    evidence.MARKET_ALIGNMENT = "NEUTRAL";
  }

  const evidenceItems = DIMENSIONS.map((dimension) =>
    makeEvidenceItem(
      asset,
      dimension,
      evidence[dimension],
      provenance,
      asOf,
    ),
  );
  const context = makeContextStates();
  const dm1: DM1EvidenceSnapshot = {
    evidence,
    ...context,
  };

  return {
    asset,
    dm1,
    evidenceItems,
    provenance,
    providerStatus,
    normalizationNotes: RYO_NORMALIZATION_NOTES,
  };
}

function unknownPayloadForFailure(result: RYOCallResult<unknown>): Record<string, unknown> {
  return {
    status: result.status.toLowerCase(),
    data: null,
  };
}

export function normalizeRYOResult(
  result: RYOCallResult<unknown>,
  asset: string,
): RYOCanonicalEvidenceSnapshot {
  const normalizedAsset = validAsset(asset);
  if (!result.ok) {
    return normalizePayload(
      normalizedAsset,
      unknownPayloadForFailure(result),
      result.provenance,
      result.status,
    );
  }

  if (!isRecord(result.data)) {
    return normalizePayload(
      normalizedAsset,
      { status: "invalid_response", data: null },
      result.provenance,
      RYO_PROVIDER_STATUSES.INVALID_RESPONSE,
    );
  }

  return normalizePayload(
    normalizedAsset,
    result.data,
    result.provenance,
    result.status,
  );
}

export function normalizeRYOFixture(
  input: SanitizedRYOFixture | unknown,
  asset: string,
): RYOCanonicalEvidenceSnapshot {
  const fixture = parseSanitizedRYOFixture(input);
  return normalizePayload(
    validAsset(asset),
    fixture.raw,
    fixture.provenance,
  );
}

export function isRYOProviderPayload(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.schema_version === "string" &&
    typeof value.tool === "string" &&
    typeof value.status === "string" &&
    typeof value.as_of === "string" &&
    hasOwn(value, "data")
  );
}
