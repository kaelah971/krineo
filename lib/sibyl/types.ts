import type { DecisionCase, MemorySnapshot } from "../memory";
import type { PlaybookVersion } from "../playbook";

export const SIBYL_RESULT_STATUSES = {
  SUCCESS: "SUCCESS",
  NOT_FOUND: "NOT_FOUND",
  UNAVAILABLE: "UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
  CAP_EXCEEDED: "CAP_EXCEEDED",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  CONFLICT: "CONFLICT",
  ERROR: "ERROR",
} as const;
export type SibylResultStatus =
  (typeof SIBYL_RESULT_STATUSES)[keyof typeof SIBYL_RESULT_STATUSES];

export type SibylJsonPrimitive = string | number | boolean | null;
export type SibylJsonValue =
  | SibylJsonPrimitive
  | readonly SibylJsonValue[]
  | { readonly [key: string]: SibylJsonValue };
export type SibylJsonObject = {
  readonly [key: string]: SibylJsonValue;
};

export type SibylToolName =
  | "memory_remember"
  | "memory_recall"
  | "memory_search"
  | "memory_list"
  | "memory_forget"
  | "memory_set_state"
  | "memory_get_state"
  | "memory_record_event";

export const SIBYL_REQUIRED_TOOLS: readonly SibylToolName[] = [
  "memory_remember",
  "memory_recall",
  "memory_search",
  "memory_list",
  "memory_forget",
  "memory_set_state",
  "memory_get_state",
  "memory_record_event",
] as const;

export interface SibylToolArguments {
  readonly memory_remember: {
    readonly category: string;
    readonly name: string;
    readonly body: SibylJsonValue;
  };
  readonly memory_recall: {
    readonly category: string;
    readonly name: string;
  };
  readonly memory_search: {
    readonly query: string;
    readonly limit?: number;
    readonly tiers?: string | null;
  };
  readonly memory_list: {
    readonly category?: string | null;
    readonly limit?: number;
  };
  readonly memory_forget: {
    readonly category: string;
    readonly name: string;
    readonly reason?: string | null;
  };
  readonly memory_set_state: {
    readonly key: string;
    readonly body: SibylJsonValue;
  };
  readonly memory_get_state: {
    readonly key: string;
  };
  readonly memory_record_event: {
    readonly kind: string;
    readonly body: SibylJsonObject;
    readonly category?: string | null;
    readonly name?: string | null;
  };
}

export interface SibylEntityKey {
  readonly category: string;
  readonly name: string;
}

export interface SibylEntity {
  readonly id: string;
  readonly tenantId: string;
  readonly category: string;
  readonly name: string;
  readonly status: string;
  readonly body: SibylJsonValue;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SibylSearchHit {
  readonly id?: string;
  readonly category?: string;
  readonly name?: string;
  readonly status?: string;
  readonly body?: SibylJsonValue;
  readonly tier?: string;
  readonly [key: string]: SibylJsonValue | undefined;
}

export interface SibylSearchResponse {
  readonly query: string;
  readonly count: number;
  readonly results: readonly SibylSearchHit[];
  readonly verdict: SibylJsonObject;
}

export interface SibylListResponse {
  readonly category: string | null;
  readonly count: number;
  readonly results: readonly SibylEntity[];
}

export interface SibylRememberReceipt {
  readonly category: string;
  readonly name: string;
}

export interface SibylForgetReceipt {
  readonly category: string;
  readonly name: string;
}

export interface SibylEventReceipt {
  readonly eventId: string;
  readonly kind: string;
}

export interface SibylStateReceipt {
  readonly key: string;
}

export interface SibylState {
  readonly key: string;
  readonly body: SibylJsonValue;
  readonly updatedAt: string;
}

export type SibylDiagnosticScalar = string | number | boolean | null;
export type SibylDiagnosticDetails = Readonly<
  Record<string, SibylDiagnosticScalar>
>;

export type SibylDiagnosticCode =
  | "NOT_FOUND"
  | "CAP_EXCEEDED"
  | "TIER_GATED"
  | "VALIDATION_ERROR"
  | "PROCESS_START_FAILED"
  | "PROCESS_EXITED"
  | "HANDSHAKE_FAILED"
  | "RPC_ERROR"
  | "PROTOCOL_ERROR"
  | "MESSAGE_TOO_LARGE"
  | "SANITIZATION_REJECTED"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "CONFLICT"
  | "ERROR";

export interface SibylDiagnostic {
  readonly code: SibylDiagnosticCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly operation?: SibylOperation;
  readonly details?: SibylDiagnosticDetails;
}

export type SibylOperation =
  | SibylToolName
  | "initialize"
  | "tools/list"
  | "mirrorDecisionCase"
  | "mirrorMemorySnapshot"
  | "mirrorPlaybookVersion";

export interface SibylSuccess<T> {
  readonly status: "SUCCESS";
  readonly value: T;
}

export interface SibylFailure<S extends Exclude<SibylResultStatus, "SUCCESS">> {
  readonly status: S;
  readonly diagnostic: SibylDiagnostic;
}

export interface SibylConflictFailure extends SibylFailure<"CONFLICT"> {
  readonly entity: SibylEntityKey;
}

export type SibylBridgeResult<T> =
  | SibylSuccess<T>
  | SibylFailure<"NOT_FOUND">
  | SibylFailure<"UNAVAILABLE">
  | SibylFailure<"TIMEOUT">
  | SibylFailure<"CAP_EXCEEDED">
  | SibylFailure<"INVALID_RESPONSE">
  | SibylConflictFailure
  | SibylFailure<"ERROR">;

export type SibylTransportPhase =
  | "NEW"
  | "STARTING"
  | "READY"
  | "STOPPING"
  | "CLOSED"
  | "FAILED";

export interface SibylTransportStatus {
  readonly phase: SibylTransportPhase;
  readonly available: boolean;
  readonly protocolVersion?: string;
  readonly lastDiagnostic?: SibylDiagnostic;
}

export type SibylBridgePhase =
  | "UNINITIALIZED"
  | "STARTING"
  | "READY"
  | "DEGRADED"
  | "CLOSING"
  | "CLOSED";

export type SibylDegradedReason =
  | "NOT_CONFIGURED"
  | "NOT_INSTALLED"
  | "UNSUPPORTED_PLATFORM"
  | "START_FAILED"
  | "HANDSHAKE_FAILED"
  | "PROCESS_EXITED"
  | "TIMED_OUT"
  | "CAP_EXCEEDED"
  | "INVALID_RESPONSE"
  | "SERVER_ERROR";

export interface SibylBridgeStatus {
  readonly phase: SibylBridgePhase;
  readonly available: boolean;
  readonly reason?: SibylDegradedReason;
  readonly transport: SibylTransportStatus;
  readonly lastDiagnostic?: SibylDiagnostic;
}

export type SibylRpcId = number | string;

export interface SibylRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: SibylRpcId;
  readonly method: string;
  readonly params?: SibylJsonObject;
}

export interface SibylRpcNotification {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly params?: SibylJsonObject;
}

export interface SibylRpcErrorObject {
  readonly code: number;
  readonly message: string;
  readonly data?: SibylJsonValue;
}

export interface SibylRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: SibylRpcId | null;
  readonly result?: SibylJsonValue;
  readonly error?: SibylRpcErrorObject;
}

export interface SibylMcpToolDefinition {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: SibylJsonObject;
}

export interface SibylInitializeResult {
  readonly protocolVersion: string;
  readonly capabilities: SibylJsonObject;
  readonly serverInfo: { readonly name: string; readonly version: string };
}

export interface SibylMcpTransport {
  start(): Promise<void>;
  callTool<Name extends SibylToolName>(
    name: Name,
    args: SibylToolArguments[Name],
  ): Promise<unknown>;
  close(): Promise<void>;
  getStatus(): SibylTransportStatus;
}

export interface SibylStdioTransportConfig {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly protocolVersions: readonly string[];
  readonly clientInfo: { readonly name: string; readonly version: string };
  readonly startupTimeoutMs: number;
  readonly requestTimeoutMs: number;
  readonly shutdownGraceMs: number;
  readonly maxLineBytes: number;
  readonly shell?: false;
}

export interface SibylTransportError extends Error {
  readonly diagnosticCode: SibylDiagnosticCode;
  readonly retryable: boolean;
}

export interface SibylMockCall<Name extends SibylToolName = SibylToolName> {
  readonly name: Name;
  readonly args: SibylToolArguments[Name];
}

export type SibylMockHandler<Name extends SibylToolName> = (
  args: SibylToolArguments[Name],
) => unknown | Promise<unknown>;

export interface SibylMockTransportOptions {
  readonly handlers?: Partial<{
    [Name in SibylToolName]: SibylMockHandler<Name>;
  }>;
  readonly available?: boolean;
  readonly startupFailure?: SibylDiagnosticCode;
  readonly requestFailure?: Partial<Record<SibylToolName, SibylDiagnosticCode>>;
  readonly tools?: readonly SibylMcpToolDefinition[];
}

export interface SibylMockTransport extends SibylMcpTransport {
  readonly calls: readonly SibylMockCall[];
  resetCalls(): void;
}

export interface SibylRememberEntityInput {
  readonly category: string;
  readonly name: string;
  readonly body: SibylJsonValue;
}

export type SibylRecallEntityInput = SibylEntityKey;

export interface SibylSearchInput {
  readonly query: string;
  readonly limit?: number;
  readonly tiers?: string | null;
}

export interface SibylListInput {
  readonly category?: string | null;
  readonly limit?: number;
}

export interface SibylForgetInput extends SibylEntityKey {
  readonly reason?: string | null;
}

export interface SibylRecordEventInput {
  readonly kind: string;
  readonly body: SibylJsonObject;
  readonly category?: string | null;
  readonly name?: string | null;
}

export interface SibylSetStateInput {
  readonly key: string;
  readonly body: SibylJsonValue;
}

export interface SibylGetStateInput {
  readonly key: string;
}

export interface SibylMirrorReceipt {
  readonly entity: SibylEntityKey;
  readonly outcome: "CREATED" | "UNCHANGED";
  readonly bodySchemaVersion: string;
}

export interface SibylEntityPayload {
  readonly category: string;
  readonly name: string;
  readonly body: SibylJsonObject;
}

export const SIBYL_BODY_SCHEMA_VERSIONS = {
  DECISION_CASE: "krineo.sibyl.decision_case.v1",
  MEMORY_SNAPSHOT: "krineo.sibyl.memory_snapshot.v1",
  PLAYBOOK_VERSION: "krineo.sibyl.playbook_version.v1",
} as const;

export type SibylBodySchemaVersion =
  (typeof SIBYL_BODY_SCHEMA_VERSIONS)[keyof typeof SIBYL_BODY_SCHEMA_VERSIONS];

export const SIBYL_EVENT_KINDS = {
  DECISION_COMMITTED: "decision_committed",
  SNAPSHOT_CREATED: "snapshot_created",
  PROPOSAL_CREATED: "proposal_created",
  PROPOSAL_RESOLVED: "proposal_resolved",
} as const;

export type SibylEventKind =
  (typeof SIBYL_EVENT_KINDS)[keyof typeof SIBYL_EVENT_KINDS];

export interface SibylJournalEvent extends SibylRecordEventInput {
  readonly kind: SibylEventKind;
}
export interface SibylMemoryBridge {
  /** Idempotent. Terminates the underlying transport/process; safe to call multiple times. */
  close(): Promise<void>;
  rememberEntity(
    input: SibylRememberEntityInput,
  ): Promise<SibylBridgeResult<SibylRememberReceipt>>;
  recallEntity(
    input: SibylRecallEntityInput,
  ): Promise<SibylBridgeResult<SibylEntity>>;
  search(input: SibylSearchInput): Promise<SibylBridgeResult<SibylSearchResponse>>;
  list(input?: SibylListInput): Promise<SibylBridgeResult<SibylListResponse>>;
  forget(input: SibylForgetInput): Promise<SibylBridgeResult<SibylForgetReceipt>>;
  recordEvent(
    input: SibylRecordEventInput,
  ): Promise<SibylBridgeResult<SibylEventReceipt>>;
  setState(input: SibylSetStateInput): Promise<SibylBridgeResult<SibylStateReceipt>>;
  getState(input: SibylGetStateInput): Promise<SibylBridgeResult<SibylState>>;
  getStatus(): SibylBridgeStatus;
  mirrorDecisionCase(
    value: DecisionCase,
  ): Promise<SibylBridgeResult<SibylMirrorReceipt>>;
  mirrorMemorySnapshot(
    value: MemorySnapshot,
  ): Promise<SibylBridgeResult<SibylMirrorReceipt>>;
  mirrorPlaybookVersion(
    value: PlaybookVersion,
  ): Promise<SibylBridgeResult<SibylMirrorReceipt>>;
}
