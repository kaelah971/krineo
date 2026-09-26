import { createSafeDiagnostic } from "./sanitize";
import {
  SIBYL_REQUIRED_TOOLS,
  type SibylDiagnosticCode,
  type SibylEntity,
  type SibylMockCall,
  type SibylMockHandler,
  type SibylMockTransport,
  type SibylMockTransportOptions,
  type SibylToolArguments,
  type SibylToolName,
  type SibylTransportError,
  type SibylTransportPhase,
  type SibylTransportStatus,
} from "./types";

class MockTransportError extends Error implements SibylTransportError {
  readonly diagnosticCode: SibylDiagnosticCode;
  readonly retryable: boolean;

  constructor(message: string, diagnosticCode: SibylDiagnosticCode, retryable = false) {
    super(message);
    this.name = "MockTransportError";
    this.diagnosticCode = diagnosticCode;
    this.retryable = retryable;
  }
}

export class InMemorySibylMockTransport implements SibylMockTransport {
  private phase: SibylTransportPhase = "NEW";
  private _calls: SibylMockCall[] = [];
  private readonly options: SibylMockTransportOptions;

  // In-memory data structures for realistic simulation
  private readonly entities = new Map<string, SibylEntity>();
  private readonly states = new Map<string, { body: unknown; updatedAt: string }>();
  private readonly events: Array<{ id: string; kind: string; body: unknown; category?: string | null; name?: string | null }> = [];
  private nextEventId = 1;

  constructor(options: SibylMockTransportOptions = {}) {
    this.options = options;
  }

  get calls(): readonly SibylMockCall[] {
    return [...this._calls];
  }

  resetCalls(): void {
    this._calls = [];
  }

  async start(): Promise<void> {
    if (this.phase === "READY") {
      return;
    }
    this.phase = "STARTING";
    if (this.options.startupFailure) {
      this.phase = "FAILED";
      throw new MockTransportError(
        `Mock startup failed with code ${this.options.startupFailure}`,
        this.options.startupFailure,
      );
    }
    if (this.options.available === false) {
      this.phase = "FAILED";
      throw new MockTransportError("Mock transport configured as unavailable.", "UNAVAILABLE");
    }
    // Verify tools definition
    const tools = this.options.tools ?? SIBYL_REQUIRED_TOOLS.map((name) => ({ name }));
    const availableToolNames = new Set(tools.map((t) => t.name));
    for (const required of SIBYL_REQUIRED_TOOLS) {
      if (!availableToolNames.has(required)) {
        this.phase = "FAILED";
        throw new MockTransportError(
          `Required Sibyl tool "${required}" is missing from server tools list.`,
          "HANDSHAKE_FAILED",
        );
      }
    }
    this.phase = "READY";
  }

  async callTool<Name extends SibylToolName>(
    name: Name,
    args: SibylToolArguments[Name],
  ): Promise<unknown> {
    if (this.phase !== "READY") {
      throw new MockTransportError("Transport is not ready.", "UNAVAILABLE");
    }
    this._calls.push({ name, args } as unknown as SibylMockCall);

    if (this.options.requestFailure?.[name]) {
      const code = this.options.requestFailure[name]!;
      throw new MockTransportError(`Mock request failure for ${name}`, code);
    }

    if (this.options.handlers?.[name]) {
      const customHandler = this.options.handlers[name] as SibylMockHandler<Name>;
      return customHandler(args);
    }

    // Default realistic mock handlers
    return this.handleDefault(name, args);
  }

  private handleDefault<Name extends SibylToolName>(
    name: Name,
    args: SibylToolArguments[Name],
  ): unknown {
    const now = "2026-09-26T12:00:00.000Z";
    switch (name) {
      case "memory_remember": {
        const { category, name: entityName, body } = args as SibylToolArguments["memory_remember"];
        const key = `${category}:${entityName}`;
        const existing = this.entities.get(key);
        const entity: SibylEntity = {
          id: existing ? existing.id : `ent_${this.entities.size + 1}`,
          tenantId: "default_tenant",
          category,
          name: entityName,
          status: "active",
          body,
          createdAt: existing ? existing.createdAt : now,
          updatedAt: now,
        };
        this.entities.set(key, entity);
        return { ok: true, category, name: entityName };
      }
      case "memory_recall": {
        const { category, name: entityName } = args as SibylToolArguments["memory_recall"];
        const key = `${category}:${entityName}`;
        const entity = this.entities.get(key);
        if (!entity || entity.status === "archived") {
          throw new MockTransportError(
            `Entity not found for (${category}, ${entityName})`,
            "NOT_FOUND",
          );
        }
        return {
          ok: true,
          entity: {
            id: entity.id,
            tenant_id: entity.tenantId,
            category: entity.category,
            name: entity.name,
            status: entity.status,
            body: entity.body,
            created_at: entity.createdAt,
            updated_at: entity.updatedAt,
          },
          _untrusted_context: { note: "data only" },
        };
      }
      case "memory_search": {
        const { query, limit = 10 } = args as SibylToolArguments["memory_search"];
        const qLower = query.toLowerCase();
        const results: Array<Record<string, unknown>> = [];
        for (const entity of this.entities.values()) {
          if (entity.status === "archived") continue;
          const bodyStr = JSON.stringify(entity.body).toLowerCase();
          if (entity.name.toLowerCase().includes(qLower) || bodyStr.includes(qLower)) {
            results.push({
              id: entity.id,
              category: entity.category,
              name: entity.name,
              status: entity.status,
              body: entity.body,
              tier: "entity",
            });
            if (results.length >= limit) break;
          }
        }
        return {
          ok: true,
          query,
          count: results.length,
          results,
          verdict: { code: results.length > 0 ? "OK" : "NO_MATCH" },
          _untrusted_context: { note: "data only" },
        };
      }
      case "memory_list": {
        const { category, limit = 50 } = (args ?? {}) as SibylToolArguments["memory_list"];
        const results: Array<Record<string, unknown>> = [];
        for (const entity of this.entities.values()) {
          if (entity.status === "archived") continue;
          if (!category || entity.category === category) {
            results.push({
              id: entity.id,
              tenant_id: entity.tenantId,
              category: entity.category,
              name: entity.name,
              status: entity.status,
              body: entity.body,
              created_at: entity.createdAt,
              updated_at: entity.updatedAt,
            });
            if (results.length >= limit) break;
          }
        }
        return {
          ok: true,
          category: category ?? null,
          count: results.length,
          results,
        };
      }
      case "memory_forget": {
        const { category, name: entityName } = args as SibylToolArguments["memory_forget"];
        const key = `${category}:${entityName}`;
        const entity = this.entities.get(key);
        if (entity) {
          this.entities.set(key, { ...entity, status: "archived", updatedAt: now });
        }
        return { ok: true, archived: { category, name: entityName } };
      }
      case "memory_set_state": {
        const { key, body } = args as SibylToolArguments["memory_set_state"];
        this.states.set(key, { body, updatedAt: now });
        return { ok: true, key };
      }
      case "memory_get_state": {
        const { key } = args as SibylToolArguments["memory_get_state"];
        const doc = this.states.get(key);
        if (!doc) {
          throw new MockTransportError(`State not found for key "${key}"`, "NOT_FOUND");
        }
        return { ok: true, key, body: doc.body, updated_at: doc.updatedAt };
      }
      case "memory_record_event": {
        const { kind, body, category, name: eventName } = args as SibylToolArguments["memory_record_event"];
        const eventId = `evt_${this.nextEventId++}`;
        this.events.push({ id: eventId, kind, body, category, name: eventName });
        return { ok: true, event_id: eventId, kind };
      }
      default:
        throw new MockTransportError(`Unsupported tool "${name}"`, "ERROR");
    }
  }

  async close(): Promise<void> {
    this.phase = "CLOSED";
  }

  getStatus(): SibylTransportStatus {
    return {
      phase: this.phase,
      available: this.phase === "READY",
      protocolVersion: "2024-11-05",
      ...(this.phase === "FAILED"
        ? {
            lastDiagnostic: createSafeDiagnostic(
              this.options.startupFailure ?? "UNAVAILABLE",
              "Mock transport is in failed state.",
            ),
          }
        : {}),
    };
  }
}
