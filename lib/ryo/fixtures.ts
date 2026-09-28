import {
  LIVE_SANITIZED_RYO_FIXTURE,
  type RYOProvenance,
  type SanitizedRYOFixture,
} from "./types";

const SENSITIVE_KEY_PATTERN =
  /authorization|api[_-]?key|mcp[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?token|secret|password|credential/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasSensitiveKey);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, child]) =>
      SENSITIVE_KEY_PATTERN.test(key) || hasSensitiveKey(child),
  );
}

function cloneFixture(value: unknown): unknown {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}

function requireString(
  value: Record<string, unknown>,
  key: string,
): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new Error(`RYO fixture field ${key} must be a non-empty string.`);
  }

  return field;
}

function parseProvenance(value: unknown): SanitizedRYOFixture["provenance"] {
  if (!isRecord(value)) {
    throw new Error("RYO fixture provenance must be an object.");
  }

  const provider = requireString(value, "provider");
  if (provider !== "RYO") {
    throw new Error("RYO fixture provenance provider must be RYO.");
  }

  const provenance: RYOProvenance & { capturedAt: string } = {
    provider: "RYO",
    tool: requireString(value, "tool"),
    capturedAt: requireString(value, "capturedAt"),
  };

  for (const key of [
    "serverName",
    "serverVersion",
    "protocolVersion",
    "asOf",
  ] as const) {
    const optionalValue = value[key];
    if (optionalValue !== undefined) {
      if (typeof optionalValue !== "string" || optionalValue.length === 0) {
        throw new Error(`RYO fixture provenance field ${key} must be a string.`);
      }
      provenance[key] = optionalValue;
    }
  }

  return provenance;
}

export function parseSanitizedRYOFixture(
  input: unknown,
): SanitizedRYOFixture {
  if (!isRecord(input)) {
    throw new Error("RYO fixture must be an object.");
  }

  if (input.fixtureMarker !== LIVE_SANITIZED_RYO_FIXTURE) {
    throw new Error("RYO fixture is missing the live-sanitized marker.");
  }

  if (hasSensitiveKey(input)) {
    throw new Error("RYO fixture contains a prohibited credential field.");
  }

  const raw = input.raw;
  if (!isRecord(raw)) {
    throw new Error("RYO fixture raw provider response must be an object.");
  }

  return {
    fixtureMarker: LIVE_SANITIZED_RYO_FIXTURE,
    provenance: parseProvenance(input.provenance),
    raw: cloneFixture(raw) as Record<string, unknown>,
  };
}
