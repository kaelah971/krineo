import type {
  DirectionalEvidenceDimension,
  DirectionalEvidenceState,
  EvidenceItem,
  RiskState,
  SafetyState,
  RegimeFitState,
} from "../evidence/types";
import type { DM1EvidenceSnapshot } from "../strategy/dm1/types";

export const RYO_PROVIDER_STATUSES = {
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
  TIMEOUT: "TIMEOUT",
  UNAVAILABLE: "UNAVAILABLE",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  ERROR: "ERROR",
} as const;

export type RYOProviderStatus =
  (typeof RYO_PROVIDER_STATUSES)[keyof typeof RYO_PROVIDER_STATUSES];

export const LIVE_SANITIZED_RYO_FIXTURE = "LIVE_SANITIZED_RYO_FIXTURE" as const;

export interface RYOProvenance {
  provider: "RYO";
  serverName?: string;
  serverVersion?: string;
  protocolVersion?: string;
  tool: string;
  asOf?: string;
}

export interface RYOProviderError {
  code: string;
  message: string;
}

export interface RYOCallSuccess<T = unknown> {
  ok: true;
  status: "SUCCESS" | "PARTIAL";
  data: T;
  raw: unknown;
  provenance: RYOProvenance;
}

export interface RYOCallFailure {
  ok: false;
  status: Exclude<RYOProviderStatus, "SUCCESS" | "PARTIAL">;
  error: RYOProviderError;
  raw?: unknown;
  provenance: RYOProvenance;
}

export type RYOCallResult<T = unknown> =
  | RYOCallSuccess<T>
  | RYOCallFailure;

export interface RYOInputSchema extends Record<string, unknown> {
  type?: string;
  properties?: Record<string, RYOInputSchema>;
  required?: readonly string[];
  additionalProperties?: boolean;
  enum?: readonly unknown[];
  default?: unknown;
}

export interface RYOToolDefinition {
  name: string;
  description?: string;
  inputSchema: RYOInputSchema;
  outputSchema?: Record<string, unknown>;
}

export interface RYOServerInfo {
  name: string;
  version: string;
}

export interface RYODiscovery {
  protocolVersion: string;
  serverInfo: RYOServerInfo;
  capabilities: Record<string, unknown>;
  tools: readonly RYOToolDefinition[];
}

export interface RYODiscoverySuccess {
  ok: true;
  status: "SUCCESS";
  discovery: RYODiscovery;
  provenance: RYOProvenance;
}

export interface RYODiscoveryFailure {
  ok: false;
  status: Exclude<RYOProviderStatus, "SUCCESS" | "PARTIAL">;
  error: RYOProviderError;
  raw?: unknown;
  provenance: RYOProvenance;
}

export type RYODiscoveryResult =
  | RYODiscoverySuccess
  | RYODiscoveryFailure;

export interface SanitizedRYOFixture {
  fixtureMarker: typeof LIVE_SANITIZED_RYO_FIXTURE;
  provenance: RYOProvenance & {
    capturedAt: string;
  };
  raw: Record<string, unknown>;
}

export interface RYOCanonicalEvidenceSnapshot {
  asset: string;
  dm1: DM1EvidenceSnapshot;
  evidenceItems: readonly EvidenceItem[];
  provenance: RYOProvenance;
  providerStatus: RYOProviderStatus;
  normalizationNotes: Readonly<
    Record<DirectionalEvidenceDimension | "risk" | "safety" | "regimeFit", string>
  >;
}

export type RYOCanonicalEvidence = Readonly<
  Record<DirectionalEvidenceDimension, DirectionalEvidenceState>
>;

export interface RYOContextStates {
  risk: RiskState;
  safety: SafetyState;
  regimeFit: RegimeFitState;
}
