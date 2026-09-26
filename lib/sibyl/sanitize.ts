import type {
  SibylDiagnostic,
  SibylDiagnosticCode,
  SibylDiagnosticDetails,
  SibylDiagnosticScalar,
  SibylJsonValue,
  SibylOperation,
} from "./types";

// Generic PII/token guards for defense-in-depth. Diagnostics never retain
// external text, but these guards reject sensitive content at the write path
// and redact obvious PII/token shapes from any diagnostic surface anyway.
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z0-9_-]+ PRIVATE KEY-----/i,
  /-----BEGIN CERTIFICATE-----/i,
  /bearer\s+[a-z0-9_.-]+/i,
  /session_token/i,
  /password/i,
  /api[_-]?key/i,
  /secret/i,
  /private[_-]?key/i,
  /credentials/i,
];

const PII_TOKEN_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  /\b(?:ghp|gho|github_pat|glpat|sk-(?:live|test)|xox[bpas]-)[a-zA-Z0-9_-]{8,}\b/i,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\b/,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
];

export function containsSecret(text: string): boolean {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

function containsPiiOrToken(text: string): boolean {
  for (const pattern of PII_TOKEN_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

function redactPiiAndTokens(text: string): string {
  let out = text;
  for (const pattern of PII_TOKEN_PATTERNS) {
    out = out.replace(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`), "[redacted]");
  }
  return out;
}

export function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value as object)) {
    return value;
  }
  seen.add(value as object);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      deepFreeze(value[i], seen);
    }
  } else {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      deepFreeze(record[key], seen);
    }
  }
  Object.freeze(value);
  return value;
}

export function deepClone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value as object)) {
    return seen.get(value as object) as T;
  }
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value as object, copy);
    for (let i = 0; i < value.length; i++) {
      copy.push(deepClone(value[i], seen));
    }
    return copy as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  seen.set(value as object, copy);
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    copy[key] = deepClone(record[key], seen);
  }
  return copy as unknown as T;
}

export function validateJsonValue(
  value: unknown,
  path = "$",
  seen = new WeakSet<object>(),
): SibylJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    if (typeof value === "string" && containsSecret(value)) {
      throw new Error(`Sanitization error at ${path}: contains secret or sensitive pattern.`);
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Sanitization error at ${path}: non-finite number ${value}.`);
    }
    return value;
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) {
      throw new Error(`Sanitization error at ${path}: circular reference detected.`);
    }
    seen.add(value as object);
    if (Array.isArray(value)) {
      const sanitizedArray: SibylJsonValue[] = [];
      for (let i = 0; i < value.length; i++) {
        sanitizedArray.push(validateJsonValue(value[i], `${path}[${i}]`, seen));
      }
      return deepFreeze(sanitizedArray);
    }
    const record = value as Record<string, unknown>;
    const sanitizedObj: Record<string, SibylJsonValue> = {};
    for (const key of Object.keys(record)) {
      if (typeof key !== "string" || key.length === 0) {
        throw new Error(`Sanitization error at ${path}: invalid empty key.`);
      }
      if (containsSecret(key)) {
        throw new Error(`Sanitization error at ${path}.${key}: key contains sensitive pattern.`);
      }
      const val = record[key];
      if (val !== undefined) {
        sanitizedObj[key] = validateJsonValue(val, `${path}.${key}`, seen);
      }
    }
    return deepFreeze(sanitizedObj);
  }
  throw new Error(`Sanitization error at ${path}: unsupported JSON type ${typeof value}.`);
}

export function canonicalJsonStringify(value: SibylJsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJsonStringify(entry)).join(",")}]`;
  }
  const obj = value as Record<string, SibylJsonValue>;
  const sortedKeys = Object.keys(obj).sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify(obj[key])}`,
  );
  return `{${pairs.join(",")}}`;
}

export function createSafeDiagnostic(
  code: SibylDiagnosticCode,
  message: string,
  options?: {
    operation?: SibylOperation;
    retryable?: boolean;
    details?: Record<string, SibylDiagnosticScalar>;
  },
): SibylDiagnostic {
  // Diagnostics are a control plane: never repeat external text. External
  // caller messages are replaced by a stable code message, and the detailed
  // envelope is never echoed. Generic PII/token shapes are redacted anyway.
  const safeMsg = `Operation failed with code ${code}.`;
  void message;
  const safeDetails: Record<string, SibylDiagnosticScalar> = {};
  if (options?.details) {
    for (const [k, v] of Object.entries(options.details)) {
      if (typeof k === "string" && !containsSecret(k) && !containsPiiOrToken(k)) {
        if (
          v === null ||
          typeof v === "boolean" ||
          (typeof v === "number" && Number.isFinite(v)) ||
          (typeof v === "string" && !containsSecret(v) && !containsPiiOrToken(v) && v.length <= 128)
        ) {
          safeDetails[k] = typeof v === "string" ? redactPiiAndTokens(v) : v;
        }
      }
    }
  }
  return deepFreeze({
    code,
    message: safeMsg,
    retryable: options?.retryable ?? false,
    ...(options?.operation ? { operation: options.operation } : {}),
    ...(Object.keys(safeDetails).length > 0 ? { details: safeDetails as SibylDiagnosticDetails } : {}),
  });
}
