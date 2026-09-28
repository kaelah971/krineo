import {
  RYO_PROVIDER_STATUSES,
  type RYOCallFailure,
  type RYOCallResult,
  type RYOCallSuccess,
  type RYODiscovery,
  type RYODiscoveryFailure,
  type RYODiscoveryResult,
  type RYODiscoverySuccess,
  type RYOInputSchema,
  type RYOProvenance,
  type RYOProviderError,
  type RYOProviderStatus,
  type RYOServerInfo,
  type RYOToolDefinition,
} from "./types";

export const RYO_MCP_PROTOCOL_VERSION = "2024-11-05" as const;
export const DEFAULT_RYO_TIMEOUT_MS = 20_000;

export interface RYOClientOptions {
  endpoint?: string;
  key?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface TransportSuccess {
  ok: true;
  body: unknown;
}

interface TransportFailure {
  ok: false;
  status: Exclude<RYOProviderStatus, "SUCCESS" | "PARTIAL">;
  error: RYOProviderError;
  raw?: unknown;
}

type TransportResult = TransportSuccess | TransportFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function sanitizeRawValue(value: unknown, secret: string): unknown {
  if (typeof value === "string") {
    return secret.length > 0 ? value.split(secret).join("[REDACTED]") : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRawValue(item, secret));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sensitiveKey =
    /authorization|api[_-]?key|mcp[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?token|secret|password|credential/i;
  const result: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    if (sensitiveKey.test(key)) {
      continue;
    }
    result[key] = sanitizeRawValue(child, secret);
  }

  return result;
}

function parseJSON(text: string): unknown | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const dataLines = trimmed
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .filter((line) => line.length > 0 && line !== "[DONE]");

    const lastDataLine = dataLines.at(-1);
    if (lastDataLine === undefined) {
      return undefined;
    }

    try {
      return JSON.parse(lastDataLine) as unknown;
    } catch {
      return undefined;
    }
  }
}

function extractJSONRPCResult(body: unknown): unknown | undefined {
  if (!isRecord(body) || body.jsonrpc !== "2.0") {
    return undefined;
  }

  return body.result;
}

function extractJSONRPCError(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body) || !isRecord(body.error)) {
    return null;
  }

  return body.error;
}

function classifyText(text: string): Exclude<RYOProviderStatus, "SUCCESS" | "PARTIAL"> {
  const normalized = text.toLowerCase();

  if (
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("invalid api key") ||
    normalized.includes("authentication")
  ) {
    return RYO_PROVIDER_STATUSES.UNAUTHORIZED;
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("credit limit") ||
    normalized.includes("monthly credit")
  ) {
    return RYO_PROVIDER_STATUSES.RATE_LIMITED;
  }

  if (
    normalized.includes("timed out") ||
    normalized.includes("timeout")
  ) {
    return RYO_PROVIDER_STATUSES.TIMEOUT;
  }

  if (
    normalized.includes("not found") ||
    normalized.includes("unknown token")
  ) {
    return RYO_PROVIDER_STATUSES.NOT_FOUND;
  }

  if (
    normalized.includes("unavailable") ||
    normalized.includes("temporarily")
  ) {
    return RYO_PROVIDER_STATUSES.UNAVAILABLE;
  }

  return RYO_PROVIDER_STATUSES.ERROR;
}

function classifyHTTPStatus(
  statusCode: number,
  body: unknown,
): Exclude<RYOProviderStatus, "SUCCESS" | "PARTIAL"> {
  if (statusCode === 401 || statusCode === 403) {
    return RYO_PROVIDER_STATUSES.UNAUTHORIZED;
  }
  if (statusCode === 404) {
    return RYO_PROVIDER_STATUSES.NOT_FOUND;
  }
  if (statusCode === 408 || statusCode === 504) {
    return RYO_PROVIDER_STATUSES.TIMEOUT;
  }
  if (statusCode === 429) {
    return RYO_PROVIDER_STATUSES.RATE_LIMITED;
  }
  if (statusCode >= 500) {
    return RYO_PROVIDER_STATUSES.UNAVAILABLE;
  }

  return classifyText(JSON.stringify(body ?? ""));
}

function classifyProviderError(value: unknown): Exclude<RYOProviderStatus, "SUCCESS" | "PARTIAL"> {
  const serialized = JSON.stringify(value ?? "").toLowerCase();
  return classifyText(serialized);
}

function providerStatus(
  payload: Record<string, unknown>,
): RYOProviderStatus | null {
  const status = safeString(payload.status)?.toLowerCase();
  if (status === undefined || status === null) {
    return null;
  }

  switch (status) {
    case "success":
      return RYO_PROVIDER_STATUSES.SUCCESS;
    case "partial":
      return RYO_PROVIDER_STATUSES.PARTIAL;
    case "not_found":
    case "not-found":
      return RYO_PROVIDER_STATUSES.NOT_FOUND;
    case "unauthorized":
      return RYO_PROVIDER_STATUSES.UNAUTHORIZED;
    case "rate_limited":
    case "rate-limited":
      return RYO_PROVIDER_STATUSES.RATE_LIMITED;
    case "timeout":
      return RYO_PROVIDER_STATUSES.TIMEOUT;
    case "unavailable": {
      const errorStatus = classifyProviderError(
        payload.error ?? payload.data,
      );
      return errorStatus === RYO_PROVIDER_STATUSES.RATE_LIMITED
        ? RYO_PROVIDER_STATUSES.RATE_LIMITED
        : RYO_PROVIDER_STATUSES.UNAVAILABLE;
    }
    case "invalid_response":
    case "invalid-response":
      return RYO_PROVIDER_STATUSES.INVALID_RESPONSE;
    case "error":
      return RYO_PROVIDER_STATUSES.ERROR;
    default:
      return null;
  }
}

function safeProviderPayload(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  const schemaVersion = safeString(value.schema_version);
  const tool = safeString(value.tool);
  const status = providerStatus(value);
  const asOf = safeString(value.as_of);

  return (
    schemaVersion !== null &&
    tool !== null &&
    status !== null &&
    asOf !== null &&
    hasOwn(value, "data")
  );
}

function errorForStatus(status: RYOProviderStatus): RYOProviderError {
  switch (status) {
    case RYO_PROVIDER_STATUSES.UNAUTHORIZED:
      return {
        code: "RYO_UNAUTHORIZED",
        message: "RYO authentication was rejected.",
      };
    case RYO_PROVIDER_STATUSES.RATE_LIMITED:
      return {
        code: "RYO_RATE_LIMITED",
        message: "RYO research is rate limited.",
      };
    case RYO_PROVIDER_STATUSES.TIMEOUT:
      return {
        code: "RYO_TIMEOUT",
        message: "RYO research timed out.",
      };
    case RYO_PROVIDER_STATUSES.NOT_FOUND:
      return {
        code: "RYO_NOT_FOUND",
        message: "RYO did not find the requested research target.",
      };
    case RYO_PROVIDER_STATUSES.UNAVAILABLE:
      return {
        code: "RYO_UNAVAILABLE",
        message: "RYO research is unavailable.",
      };
    case RYO_PROVIDER_STATUSES.INVALID_RESPONSE:
      return {
        code: "RYO_INVALID_RESPONSE",
        message: "RYO returned a malformed response.",
      };
    default:
      return {
        code: "RYO_ERROR",
        message: "RYO research failed.",
      };
  }
}

function discoveryFailure(
  status: Exclude<RYOProviderStatus, "SUCCESS" | "PARTIAL">,
  provenance: RYOProvenance,
  raw?: unknown,
): RYODiscoveryFailure {
  return {
    ok: false,
    status,
    error: errorForStatus(status),
    ...(raw === undefined ? {} : { raw }),
    provenance,
  };
}

function callFailure(
  status: Exclude<RYOProviderStatus, "SUCCESS" | "PARTIAL">,
  provenance: RYOProvenance,
  raw?: unknown,
): RYOCallFailure {
  return {
    ok: false,
    status,
    error: errorForStatus(status),
    ...(raw === undefined ? {} : { raw }),
    provenance,
  };
}

function makeInputError(
  tool: string,
  message = "RYO request validation failed.",
): RYOCallFailure {
  return {
    ok: false,
    status: RYO_PROVIDER_STATUSES.ERROR,
    error: { code: "RYO_INVALID_REQUEST", message },
    provenance: { provider: "RYO", tool },
  };
}

function makeProvenance(
  tool: string,
  discovery: RYODiscovery | null,
  asOf?: string,
): RYOProvenance {
  return {
    provider: "RYO",
    tool,
    ...(discovery === null
      ? {}
      : {
          serverName: discovery.serverInfo.name,
          serverVersion: discovery.serverInfo.version,
          protocolVersion: discovery.protocolVersion,
        }),
    ...(asOf === undefined ? {} : { asOf }),
  };
}

function parseServerInfo(value: unknown): RYOServerInfo | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = safeString(value.name);
  const version = safeString(value.version);
  return name === null || version === null ? null : { name, version };
}

function parseTool(value: unknown): RYOToolDefinition | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = safeString(value.name);
  const inputSchema = value.inputSchema;
  if (name === null || !isRecord(inputSchema)) {
    return null;
  }

  const description = safeString(value.description);
  const outputSchema = isRecord(value.outputSchema)
    ? value.outputSchema
    : undefined;

  return {
    name,
    ...(description === null ? {} : { description }),
    inputSchema: inputSchema as RYOInputSchema,
    ...(outputSchema === undefined ? {} : { outputSchema }),
  };
}

function validateSchemaValue(
  value: unknown,
  schema: RYOInputSchema,
  path: string,
): string | null {
  if (schema.enum !== undefined && !schema.enum.some((entry) => Object.is(entry, value))) {
    return `${path} is outside the live RYO enum.`;
  }

  switch (schema.type) {
    case undefined:
      return null;
    case "string":
      return typeof value === "string" ? null : `${path} must be a string.`;
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? null
        : `${path} must be a finite number.`;
    case "boolean":
      return typeof value === "boolean" ? null : `${path} must be a boolean.`;
    case "object": {
      if (!isRecord(value)) {
        return `${path} must be an object.`;
      }
      return validateToolArguments(value, schema, path);
    }
    case "array":
      return Array.isArray(value) ? null : `${path} must be an array.`;
    default:
      return `${path} uses an unsupported live RYO schema type.`;
  }
}

function validateToolArguments(
  args: Record<string, unknown>,
  schema: RYOInputSchema,
  path = "arguments",
): string | null {
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];

  for (const key of required) {
    if (!hasOwn(args, key)) {
      return `${path}.${key} is required by the live RYO schema.`;
    }
  }

  if (schema.additionalProperties === false) {
    const unexpected = Object.keys(args).find(
      (key) => !hasOwn(properties, key),
    );
    if (unexpected !== undefined) {
      return `${path}.${unexpected} is not accepted by the live RYO schema.`;
    }
  }

  for (const [key, value] of Object.entries(args)) {
    const propertySchema = properties[key];
    if (propertySchema === undefined) {
      continue;
    }

    const error = validateSchemaValue(value, propertySchema, `${path}.${key}`);
    if (error !== null) {
      return error;
    }
  }

  return null;
}

function extractTextContent(result: unknown): string | null {
  if (!isRecord(result) || !Array.isArray(result.content)) {
    return null;
  }

  const text = result.content
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .filter((entry) => entry.type === "text" && typeof entry.text === "string")
    .map((entry) => entry.text as string)
    .join("\n")
    .trim();

  return text.length === 0 ? null : text;
}

function isAbortError(error: unknown): boolean {
  return (
    isRecord(error) && error.name === "AbortError"
  ) || (error instanceof Error && error.name === "AbortError");
}

export class RYOClient {
  private readonly endpoint: string | undefined;
  private readonly key: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private requestId = 0;
  private discovery: RYODiscovery | null = null;

  public constructor(options: RYOClientOptions = {}) {
    this.endpoint = options.endpoint ?? process.env.RYO_MCP_URL;
    this.key = options.key ?? process.env.RYO_MCP_KEY;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_RYO_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private baseProvenance(tool: string): RYOProvenance {
    return makeProvenance(tool, this.discovery);
  }

  private async postJSONRPC(
    method: string,
    params: Record<string, unknown> | undefined,
    expectResponse: boolean,
  ): Promise<TransportResult> {
    if (this.endpoint === undefined || this.key === undefined) {
      return {
        ok: false,
        status: RYO_PROVIDER_STATUSES.UNAUTHORIZED,
        error: errorForStatus(RYO_PROVIDER_STATUSES.UNAUTHORIZED),
      };
    }

    let endpoint: URL;
    try {
      endpoint = new URL(this.endpoint);
      if (
        (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") ||
        endpoint.username.length > 0 ||
        endpoint.password.length > 0
      ) {
        throw new Error("invalid endpoint");
      }
    } catch {
      return {
        ok: false,
        status: RYO_PROVIDER_STATUSES.ERROR,
        error: { code: "RYO_INVALID_ENDPOINT", message: "RYO endpoint is invalid." },
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const request: Record<string, unknown> = {
      jsonrpc: "2.0",
      ...(expectResponse ? { id: ++this.requestId } : {}),
      method,
      ...(params === undefined ? {} : { params }),
    };

    try {
      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const text = await response.text();
      const body = parseJSON(text);

      if (!response.ok) {
        const status = classifyHTTPStatus(response.status, body);
        return {
          ok: false,
          status,
          error: errorForStatus(status),
          ...(body === undefined
            ? {}
            : { raw: sanitizeRawValue(body, this.key) }),
        };
      }

      if (!expectResponse && (response.status === 202 || body === undefined)) {
        return { ok: true, body };
      }

      if (body === undefined) {
        return {
          ok: false,
          status: RYO_PROVIDER_STATUSES.INVALID_RESPONSE,
          error: errorForStatus(RYO_PROVIDER_STATUSES.INVALID_RESPONSE),
        };
      }

      return { ok: true, body };
    } catch (error) {
      const status = isAbortError(error)
        ? RYO_PROVIDER_STATUSES.TIMEOUT
        : RYO_PROVIDER_STATUSES.UNAVAILABLE;
      return {
        ok: false,
        status,
        error: errorForStatus(status),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  public async discover(): Promise<RYODiscoveryResult> {
    const initialize = await this.postJSONRPC(
      "initialize",
      {
        protocolVersion: RYO_MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "krineo", version: "1.0.0" },
      },
      true,
    );

    if (!initialize.ok) {
      return discoveryFailure(
        initialize.status,
        makeProvenance("initialize", this.discovery),
        initialize.raw,
      );
    }

    const initializeResult = extractJSONRPCResult(initialize.body);
    if (!isRecord(initializeResult)) {
      const errorResult = extractJSONRPCError(initialize.body);
      const status =
        errorResult === null
          ? RYO_PROVIDER_STATUSES.INVALID_RESPONSE
          : classifyProviderError(errorResult);
      return discoveryFailure(
        status,
        makeProvenance("initialize", this.discovery),
        sanitizeRawValue(initialize.body, this.key ?? ""),
      );
    }

    const protocolVersion = safeString(initializeResult.protocolVersion);
    const serverInfo = parseServerInfo(initializeResult.serverInfo);
    const capabilities = initializeResult.capabilities;
    if (
      protocolVersion === null ||
      serverInfo === null ||
      !isRecord(capabilities)
    ) {
      return discoveryFailure(
        RYO_PROVIDER_STATUSES.INVALID_RESPONSE,
        makeProvenance("initialize", this.discovery),
        sanitizeRawValue(initialize.body, this.key ?? ""),
      );
    }

    const discoveredIdentity: RYODiscovery = {
      protocolVersion,
      serverInfo,
      capabilities,
      tools: [],
    };
    this.discovery = discoveredIdentity;

    const initialized = await this.postJSONRPC(
      "notifications/initialized",
      undefined,
      false,
    );
    if (!initialized.ok) {
      return discoveryFailure(
        initialized.status,
        makeProvenance("notifications/initialized", this.discovery),
        initialized.raw,
      );
    }

    const toolsList = await this.postJSONRPC("tools/list", {}, true);
    if (!toolsList.ok) {
      return discoveryFailure(
        toolsList.status,
        makeProvenance("tools/list", this.discovery),
        toolsList.raw,
      );
    }

    const toolsResult = extractJSONRPCResult(toolsList.body);
    if (!isRecord(toolsResult) || !Array.isArray(toolsResult.tools)) {
      return discoveryFailure(
        RYO_PROVIDER_STATUSES.INVALID_RESPONSE,
        makeProvenance("tools/list", this.discovery),
        sanitizeRawValue(toolsList.body, this.key ?? ""),
      );
    }

    const tools: RYOToolDefinition[] = [];
    for (const tool of toolsResult.tools) {
      const parsedTool = parseTool(tool);
      if (parsedTool === null) {
        return discoveryFailure(
          RYO_PROVIDER_STATUSES.INVALID_RESPONSE,
          makeProvenance("tools/list", this.discovery),
          sanitizeRawValue(toolsList.body, this.key ?? ""),
        );
      }
      tools.push(parsedTool);
    }

    this.discovery = { ...discoveredIdentity, tools };
    const provenance = makeProvenance("tools/list", this.discovery);
    const result: RYODiscoverySuccess = {
      ok: true,
      status: RYO_PROVIDER_STATUSES.SUCCESS,
      discovery: this.discovery,
      provenance,
    };
    return result;
  }

  public async callTool<T = unknown>(
    name: string,
    args: unknown = {},
  ): Promise<RYOCallResult<T>> {
    if (this.discovery === null) {
      return makeInputError(name, "RYO capabilities must be discovered first.");
    }

    const tool = this.discovery.tools.find((candidate) => candidate.name === name);
    if (tool === undefined) {
      return callFailure(
        RYO_PROVIDER_STATUSES.NOT_FOUND,
        this.baseProvenance(name),
      );
    }

    if (!isRecord(args)) {
      return makeInputError(name);
    }

    const validationError = validateToolArguments(args, tool.inputSchema);
    if (validationError !== null) {
      return makeInputError(name);
    }

    const transport = await this.postJSONRPC(
      "tools/call",
      { name, arguments: args },
      true,
    );
    const provenance = this.baseProvenance(name);
    if (!transport.ok) {
      return callFailure(transport.status, provenance, transport.raw);
    }

    const toolResult = extractJSONRPCResult(transport.body);
    if (!isRecord(toolResult)) {
      const errorResult = extractJSONRPCError(transport.body);
      const status =
        errorResult === null
          ? RYO_PROVIDER_STATUSES.INVALID_RESPONSE
          : classifyProviderError(errorResult);
      return callFailure(
        status,
        provenance,
        sanitizeRawValue(transport.body, this.key ?? ""),
      );
    }

    const text = extractTextContent(toolResult);
    if (text === null) {
      return callFailure(
        RYO_PROVIDER_STATUSES.INVALID_RESPONSE,
        provenance,
        sanitizeRawValue(transport.body, this.key ?? ""),
      );
    }

    if (toolResult.isError === true) {
      const status = classifyText(text);
      return callFailure(status, provenance);
    }

    const payload = parseJSON(text);
    if (!safeProviderPayload(payload)) {
      return callFailure(
        classifyText(text) === RYO_PROVIDER_STATUSES.ERROR
          ? RYO_PROVIDER_STATUSES.INVALID_RESPONSE
          : classifyText(text),
        provenance,
      );
    }

    const status = providerStatus(payload);
    if (status === null) {
      return callFailure(
        RYO_PROVIDER_STATUSES.INVALID_RESPONSE,
        provenance,
        sanitizeRawValue(payload, this.key ?? ""),
      );
    }

    const asOf = safeString(payload.as_of) ?? undefined;
    const resultProvenance = makeProvenance(name, this.discovery, asOf);
    const sanitizedPayload = sanitizeRawValue(payload, this.key ?? "");

    if (
      status === RYO_PROVIDER_STATUSES.SUCCESS ||
      status === RYO_PROVIDER_STATUSES.PARTIAL
    ) {
      if (!hasOwn(payload, "data")) {
        return callFailure(
          RYO_PROVIDER_STATUSES.INVALID_RESPONSE,
          resultProvenance,
          sanitizedPayload,
        );
      }

      const success: RYOCallSuccess<T> = {
        ok: true,
        status,
        data: sanitizedPayload as T,
        raw: sanitizedPayload,
        provenance: resultProvenance,
      };
      return success;
    }

    const failureStatus =
      status === RYO_PROVIDER_STATUSES.UNAVAILABLE
        ? classifyProviderError(payload.error ?? payload.data) ===
          RYO_PROVIDER_STATUSES.RATE_LIMITED
          ? RYO_PROVIDER_STATUSES.RATE_LIMITED
          : status
        : status;
    return callFailure(failureStatus, resultProvenance, sanitizedPayload);
  }
}

export function createRYOClient(options: RYOClientOptions = {}): RYOClient {
  return new RYOClient(options);
}

export function classifyRYOProviderPayload(
  payload: unknown,
): RYOProviderStatus {
  if (!isRecord(payload)) {
    return RYO_PROVIDER_STATUSES.INVALID_RESPONSE;
  }

  return providerStatus(payload) ?? RYO_PROVIDER_STATUSES.INVALID_RESPONSE;
}
