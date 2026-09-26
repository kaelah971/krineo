import type { DecisionCase, MemorySnapshot } from "../memory";
import type { PlaybookVersion } from "../playbook";
import {
  toDecisionCaseEntity,
  toMemorySnapshotEntity,
  toPlaybookVersionEntity,
} from "./mappings";
import {
  canonicalJsonStringify,
  createSafeDiagnostic,
  deepFreeze,
  validateJsonValue,
} from "./sanitize";
import {
  SIBYL_BODY_SCHEMA_VERSIONS,
  type SibylBridgePhase,
  type SibylBridgeResult,
  type SibylBridgeStatus,
  type SibylDiagnostic,
  type SibylEntity,
  type SibylEntityPayload,
  type SibylForgetInput,
  type SibylEventReceipt,
  type SibylForgetReceipt,
  type SibylGetStateInput,
  type SibylListInput,
  type SibylListResponse,
  type SibylMcpTransport,
  type SibylMemoryBridge,
  type SibylMirrorReceipt,
  type SibylRecallEntityInput,
  type SibylRecordEventInput,
  type SibylRememberEntityInput,
  type SibylRememberReceipt,
  type SibylSearchInput,
  type SibylSearchResponse,
  type SibylSetStateInput,
  type SibylState,
  type SibylStateReceipt,
  type SibylTransportError,
} from "./types";

function extractDiagnosticFromError(err: unknown): SibylDiagnostic {
  if (err && typeof err === "object" && "diagnosticCode" in err) {
    const transportErr = err as SibylTransportError;
    const code = transportErr.diagnosticCode;
    return createSafeDiagnostic(code, transportErr.message, { retryable: transportErr.retryable });
  }
  const msg = err instanceof Error ? err.message : String(err);
  return createSafeDiagnostic("ERROR", msg);
}

function failureFromResult<T>(diagnostic: SibylDiagnostic): SibylBridgeResult<T> {
  const code = diagnostic.code;
  if (code === "NOT_FOUND") {
    return { status: "NOT_FOUND", diagnostic };
  }
  if (code === "UNAVAILABLE" || code === "PROCESS_START_FAILED" || code === "PROCESS_EXITED" || code === "HANDSHAKE_FAILED") {
    return { status: "UNAVAILABLE", diagnostic };
  }
  if (code === "TIMEOUT") {
    return { status: "TIMEOUT", diagnostic };
  }
  if (code === "CAP_EXCEEDED" || code === "MESSAGE_TOO_LARGE") {
    return { status: "CAP_EXCEEDED", diagnostic };
  }
  if (code === "INVALID_RESPONSE" || code === "PROTOCOL_ERROR") {
    return { status: "INVALID_RESPONSE", diagnostic };
  }
  if (code === "CONFLICT") {
    return { status: "CONFLICT", entity: { category: "unknown", name: "unknown" }, diagnostic };
  }
  return { status: "ERROR", diagnostic };
}

function reasonFromTransportCode(code?: string): SibylBridgeStatus["reason"] {
  switch (code) {
    case "PROCESS_START_FAILED":
      return "NOT_INSTALLED";
    case "HANDSHAKE_FAILED":
      return "HANDSHAKE_FAILED";
    case "PROCESS_EXITED":
      return "PROCESS_EXITED";
    case "TIMEOUT":
      return "TIMED_OUT";
    case "CAP_EXCEEDED":
    case "MESSAGE_TOO_LARGE":
      return "CAP_EXCEEDED";
    case "PROTOCOL_ERROR":
    case "INVALID_RESPONSE":
      return "INVALID_RESPONSE";
    default:
      return "SERVER_ERROR";
  }
}
function normalizeEntity(value: unknown): SibylEntity | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const stringFields = ["id", "tenant_id", "category", "name", "status", "created_at", "updated_at"];
  if (stringFields.some((field) => typeof record[field] !== "string")) {
    return null;
  }
  try {
    const body = validateJsonValue(record["body"]);
    return deepFreeze({
      id: record["id"] as string,
      tenantId: record["tenant_id"] as string,
      category: record["category"] as string,
      name: record["name"] as string,
      status: record["status"] as string,
      body,
      createdAt: record["created_at"] as string,
      updatedAt: record["updated_at"] as string,
    });
  } catch {
    return null;
  }
}


export class DefaultSibylMemoryBridge implements SibylMemoryBridge {
  private readonly transport: SibylMcpTransport;
  private isStarted = false;
  private startPromise: Promise<SibylDiagnostic | null> | null = null;
  private readonly keyLocks = new Map<string, Promise<void>>();

  constructor(transport: SibylMcpTransport) {
    this.transport = transport;
  }

  private async ensureTransportStarted(): Promise<SibylDiagnostic | null> {
    if (this.isStarted) {
      return null;
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    const startPromise = (async (): Promise<SibylDiagnostic | null> => {
      try {
        await this.transport.start();
        this.isStarted = true;
        return null;
      } catch (err) {
        return extractDiagnosticFromError(err);
      }
    })();
    this.startPromise = startPromise;
    try {
      return await startPromise;
    } finally {
      if (this.startPromise === startPromise) {
        this.startPromise = null;
      }
    }
  }


  private async acquireKeyLock(key: string): Promise<() => void> {
    while (this.keyLocks.has(key)) {
      await this.keyLocks.get(key);
    }
    let releaseLock: () => void = () => {};
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.keyLocks.set(key, lockPromise);

    return () => {
      this.keyLocks.delete(key);
      releaseLock();
    };
  }

  async close(): Promise<void> {
    await this.transport.close();
  }

  getStatus(): SibylBridgeStatus {
    const tStatus = this.transport.getStatus();
    let phase: SibylBridgePhase = "UNINITIALIZED";
    if (tStatus.phase === "STARTING") phase = "STARTING";
    else if (tStatus.phase === "READY") phase = "READY";
    else if (tStatus.phase === "FAILED") phase = "DEGRADED";
    else if (tStatus.phase === "STOPPING") phase = "CLOSING";
    else if (tStatus.phase === "CLOSED") phase = "CLOSED";

    return deepFreeze({
      phase,
      available: tStatus.available,
      transport: tStatus,
      ...(tStatus.lastDiagnostic ? { lastDiagnostic: tStatus.lastDiagnostic } : {}),
      ...(tStatus.phase === "FAILED" ? { reason: reasonFromTransportCode(tStatus.lastDiagnostic?.code) } : {}),
    });
  }

  async rememberEntity(
    input: SibylRememberEntityInput,
  ): Promise<SibylBridgeResult<SibylRememberReceipt>> {
    const startErr = await this.ensureTransportStarted();
    if (startErr) {
      return failureFromResult(startErr);
    }
    try {
      const body = validateJsonValue(input.body);
      const res = (await this.transport.callTool("memory_remember", {
        category: input.category,
        name: input.name,
        body,
      })) as { category?: string; name?: string } | undefined;

      if (!res || typeof res.category !== "string" || typeof res.name !== "string") {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_remember response."),
        };
      }
      return deepFreeze({
        status: "SUCCESS",
        value: { category: res.category, name: res.name },
      });
    } catch (err) {
      const diag = extractDiagnosticFromError(err);
      return failureFromResult(diag);
    }
  }

  async recallEntity(
    input: SibylRecallEntityInput,
  ): Promise<SibylBridgeResult<SibylEntity>> {
    const startErr = await this.ensureTransportStarted();
    if (startErr) {
      return failureFromResult(startErr);
    }
    try {
      const res = (await this.transport.callTool("memory_recall", {
        category: input.category,
        name: input.name,
      })) as { entity?: Record<string, unknown> } | undefined;

      if (!res || typeof res !== "object" || !res.entity || typeof res.entity !== "object") {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_recall response."),
        };
      }
      const normalized = normalizeEntity(res.entity);
      if (!normalized) {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_recall response."),
        };
      }
      return deepFreeze({
        status: "SUCCESS",
        value: normalized,
      });
    } catch (err) {
      const diag = extractDiagnosticFromError(err);
      return failureFromResult(diag);
    }
  }

  async search(
    input: SibylSearchInput,
  ): Promise<SibylBridgeResult<SibylSearchResponse>> {
    const startErr = await this.ensureTransportStarted();
    if (startErr) {
      return failureFromResult(startErr);
    }
    try {
      const res = (await this.transport.callTool("memory_search", {
        query: input.query,
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.tiers !== undefined ? { tiers: input.tiers } : {}),
      })) as { query?: string; count?: number; results?: unknown[]; verdict?: Record<string, unknown> } | undefined;

      if (
        !res ||
        typeof res !== "object" ||
        !Array.isArray(res.results) ||
        res.results.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry)) ||
        (res.verdict !== undefined &&
          (!res.verdict || typeof res.verdict !== "object" || Array.isArray(res.verdict)))
      ) {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_search response."),
        };
      }
      try {
        validateJsonValue(res.results);
        validateJsonValue(res.verdict ?? {});
      } catch {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_search response."),
        };
      }
      return deepFreeze({
        status: "SUCCESS",
        value: {
          query: typeof res.query === "string" ? res.query : input.query,
          count: typeof res.count === "number" ? res.count : res.results.length,
          results: res.results as SibylSearchResponse["results"],
          verdict: (res.verdict ?? {}) as SibylSearchResponse["verdict"],
        },
      });
    } catch (err) {
      const diag = extractDiagnosticFromError(err);
      return failureFromResult(diag);
    }
  }

  async list(
    input?: SibylListInput,
  ): Promise<SibylBridgeResult<SibylListResponse>> {
    const startErr = await this.ensureTransportStarted();
    if (startErr) {
      return failureFromResult(startErr);
    }
    try {
      const res = (await this.transport.callTool("memory_list", {
        ...(input?.category !== undefined ? { category: input.category } : {}),
        ...(input?.limit !== undefined ? { limit: input.limit } : {}),
      })) as { category?: string | null; count?: number; results?: unknown[] } | undefined;

      if (!res || typeof res !== "object" || !Array.isArray(res.results)) {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_list response."),
        };
      }
      const normalizedResults = res.results.map((entry) => normalizeEntity(entry));
      const validResults = normalizedResults.filter(
        (entry): entry is SibylEntity => entry !== null,
      );
      if (validResults.length !== normalizedResults.length) {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_list response."),
        };
      }
      return deepFreeze({
        status: "SUCCESS",
        value: {
          category: res.category ?? input?.category ?? null,
          count: typeof res.count === "number" ? res.count : validResults.length,
          results: validResults,
        },
      });
    } catch (err) {
      const diag = extractDiagnosticFromError(err);
      return failureFromResult(diag);
    }
  }

  async forget(
    input: SibylForgetInput,
  ): Promise<SibylBridgeResult<SibylForgetReceipt>> {
    const startErr = await this.ensureTransportStarted();
    if (startErr) {
      return failureFromResult(startErr);
    }
    try {
      const res = (await this.transport.callTool("memory_forget", {
        category: input.category,
        name: input.name,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      })) as { archived?: { category?: string; name?: string } } | undefined;

      if (!res || typeof res !== "object" || !res.archived) {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_forget response."),
        };
      }
      return deepFreeze({
        status: "SUCCESS",
        value: {
          category: String(res.archived.category ?? input.category),
          name: String(res.archived.name ?? input.name),
        },
      });
    } catch (err) {
      const diag = extractDiagnosticFromError(err);
      return failureFromResult(diag);
    }
  }

  async recordEvent(
    input: SibylRecordEventInput,
  ): Promise<SibylBridgeResult<SibylEventReceipt>> {
    const startErr = await this.ensureTransportStarted();
    if (startErr) {
      return failureFromResult(startErr);
    }
    try {
      const body = validateJsonValue(input.body);
      const res = (await this.transport.callTool("memory_record_event", {
        kind: input.kind,
        body: body as SibylRecordEventInput["body"],
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
      })) as { event_id?: string | number; kind?: string } | undefined;

      if (!res || res.event_id === undefined) {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_record_event response."),
        };
      }
      return deepFreeze({
        status: "SUCCESS",
        value: {
          eventId: String(res.event_id),
          kind: String(res.kind ?? input.kind),
        },
      });
    } catch (err) {
      const diag = extractDiagnosticFromError(err);
      return failureFromResult(diag);
    }
  }

  async setState(
    input: SibylSetStateInput,
  ): Promise<SibylBridgeResult<SibylStateReceipt>> {
    const startErr = await this.ensureTransportStarted();
    if (startErr) {
      return failureFromResult(startErr);
    }
    try {
      const body = validateJsonValue(input.body);
      const res = (await this.transport.callTool("memory_set_state", {
        key: input.key,
        body,
      })) as { key?: string } | undefined;

      if (!res || typeof res.key !== "string") {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_set_state response."),
        };
      }
      return deepFreeze({
        status: "SUCCESS",
        value: { key: res.key },
      });
    } catch (err) {
      const diag = extractDiagnosticFromError(err);
      return failureFromResult(diag);
    }
  }

  async getState(
    input: SibylGetStateInput,
  ): Promise<SibylBridgeResult<SibylState>> {
    const startErr = await this.ensureTransportStarted();
    if (startErr) {
      return failureFromResult(startErr);
    }
    try {
      const res = (await this.transport.callTool("memory_get_state", {
        key: input.key,
      })) as { key?: string; body?: unknown; updated_at?: string } | undefined;

      if (!res || typeof res.key !== "string" || typeof res.updated_at !== "string") {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_get_state response."),
        };
      }
      let body: SibylState["body"];
      try {
        body = validateJsonValue(res.body);
      } catch {
        return {
          status: "INVALID_RESPONSE",
          diagnostic: createSafeDiagnostic("INVALID_RESPONSE", "Invalid memory_get_state response."),
        };
      }
      return deepFreeze({
        status: "SUCCESS",
        value: {
          key: res.key,
          body,
          updatedAt: res.updated_at,
        },
      });
    } catch (err) {
      const diag = extractDiagnosticFromError(err);
      return failureFromResult(diag);
    }
  }

  // --- High-Level Immutable Mirror Protocol ---

  private async executeImmutableMirror(
    payload: SibylEntityPayload,
    bodySchemaVersion: string,
  ): Promise<SibylBridgeResult<SibylMirrorReceipt>> {
    const lockKey = `${payload.category}:${payload.name}`;
    const releaseLock = await this.acquireKeyLock(lockKey);
    try {
      // 1. Recall exact key first
      const recallRes = await this.recallEntity({
        category: payload.category,
        name: payload.name,
      });

      if (recallRes.status === "SUCCESS") {
        const existingCanonical = canonicalJsonStringify(recallRes.value.body);
        const newCanonical = canonicalJsonStringify(payload.body);

        if (existingCanonical === newCanonical) {
          // Idempotent duplicate write
          return deepFreeze({
            status: "SUCCESS",
            value: {
              entity: { category: payload.category, name: payload.name },
              outcome: "UNCHANGED",
              bodySchemaVersion,
            },
          });
        }
        // Conflict: entity exists with different content!
        return deepFreeze({
          status: "CONFLICT",
          entity: { category: payload.category, name: payload.name },
          diagnostic: createSafeDiagnostic(
            "CONFLICT",
            `Conflict: entity (${payload.category}, ${payload.name}) exists with different canonical content.`,
            { operation: "memory_remember" },
          ),
        });
      }

      if (recallRes.status === "NOT_FOUND") {
        // Entity not present yet; write it
        const rememberRes = await this.rememberEntity({
          category: payload.category,
          name: payload.name,
          body: payload.body,
        });

        if (rememberRes.status === "SUCCESS") {
          return deepFreeze({
            status: "SUCCESS",
            value: {
              entity: { category: payload.category, name: payload.name },
              outcome: "CREATED",
              bodySchemaVersion,
            },
          });
        }
        return rememberRes;
      }

      // Any other recall failure (TIMEOUT, UNAVAILABLE, CAP_EXCEEDED, ERROR, etc.)
      return recallRes;
    } finally {
      releaseLock();
    }
  }

  async mirrorDecisionCase(
    caseItem: DecisionCase,
  ): Promise<SibylBridgeResult<SibylMirrorReceipt>> {
    const payload = toDecisionCaseEntity(caseItem);
    return this.executeImmutableMirror(payload, SIBYL_BODY_SCHEMA_VERSIONS.DECISION_CASE);
  }

  async mirrorMemorySnapshot(
    snapshot: MemorySnapshot,
  ): Promise<SibylBridgeResult<SibylMirrorReceipt>> {
    const payload = toMemorySnapshotEntity(snapshot);
    return this.executeImmutableMirror(payload, SIBYL_BODY_SCHEMA_VERSIONS.MEMORY_SNAPSHOT);
  }

  async mirrorPlaybookVersion(
    version: PlaybookVersion,
  ): Promise<SibylBridgeResult<SibylMirrorReceipt>> {
    const payload = toPlaybookVersionEntity(version);
    return this.executeImmutableMirror(payload, SIBYL_BODY_SCHEMA_VERSIONS.PLAYBOOK_VERSION);
  }
}
