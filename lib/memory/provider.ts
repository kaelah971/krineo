import {
  CASE_SIMILARITY_ALGORITHM_VERSION,
  type DecisionCase,
  type MemoryProvider,
  type MemorySnapshot,
} from "./types";
import { validateDecisionCase } from "./signature";
import { createMemorySnapshot } from "./snapshot";

function deepFreezeValue<T>(value: T, seen: WeakSet<object>): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  const target = value as unknown as Record<string, unknown>;
  if (seen.has(target)) {
    return value;
  }
  seen.add(target);
  for (const key of Object.keys(target)) {
    const child = target[key];
    if (child !== null && typeof child === "object") {
      deepFreezeValue(child, seen);
    }
  }
  Object.freeze(value);
  return value;
}

function deepClone<T>(value: T, seen: WeakMap<object, unknown>): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value as object)) {
    return seen.get(value as object) as T;
  }
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (let i = 0; i < value.length; i++) {
      copy[i] = deepClone(value[i], seen);
    }
    return copy as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  seen.set(value as object, copy);
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    copy[key] = deepClone(source[key], seen);
  }
  return copy as unknown as T;
}

function clone<T>(value: T): T {
  return deepClone(value, new WeakMap());
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (
    left === null ||
    typeof left !== "object" ||
    right === null ||
    typeof right !== "object"
  ) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    return false;
  }
  if (Array.isArray(left)) {
    const rightArray = right as unknown[];
    if (left.length !== rightArray.length) {
      return false;
    }
    for (let i = 0; i < left.length; i++) {
      if (!deepEqual(left[i], rightArray[i])) {
        return false;
      }
    }
    return true;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key) &&
      deepEqual(leftRecord[key], rightRecord[key]),
  );
}

export class InMemoryMemoryProvider implements MemoryProvider {
  private readonly cases = new Map<string, DecisionCase>();
  private readonly snapshots = new Map<string, MemorySnapshot>();

  async storeCase(decisionCase: DecisionCase): Promise<void> {
    const validated = validateDecisionCase(decisionCase);
    const existing = this.cases.get(validated.id);
    if (existing !== undefined) {
      if (deepEqual(existing, validated)) {
        return;
      }
      throw new Error(
        `Case with id ${validated.id} already exists with different content.`,
      );
    }
    for (const other of this.cases.values()) {
      if (
        other.thesisId === validated.thesisId &&
        other.versionId === validated.versionId &&
        other.id !== validated.id
      ) {
        throw new Error(
          `Case with (thesisId, versionId) = (${validated.thesisId}, ${validated.versionId}) already exists under id ${other.id}.`,
        );
      }
    }
    this.cases.set(
      validated.id,
      deepFreezeValue(clone(validated), new WeakSet()),
    );
  }

  async getCase(caseId: string): Promise<DecisionCase | null> {
    const stored = this.cases.get(caseId);
    if (stored === undefined) {
      return null;
    }
    return deepFreezeValue(clone(stored), new WeakSet());
  }

  async listCases(): Promise<readonly DecisionCase[]> {
    const sorted = Array.from(this.cases.values()).sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
    return deepFreezeValue(
      sorted.map((decisionCase) => clone(decisionCase)),
      new WeakSet(),
    );
  }

  async storeSnapshot(snapshot: MemorySnapshot): Promise<void> {
    if (snapshot.algorithmVersion !== CASE_SIMILARITY_ALGORITHM_VERSION) {
      throw new Error(
        `Invalid MemorySnapshot: algorithmVersion must be "${CASE_SIMILARITY_ALGORITHM_VERSION}".`,
      );
    }
    const validated = createMemorySnapshot(snapshot);
    const existing = this.snapshots.get(validated.snapshotId);
    if (existing !== undefined) {
      if (deepEqual(existing, validated)) {
        return;
      }
      throw new Error(
        `Snapshot with id ${validated.snapshotId} already exists with different content.`,
      );
    }
    this.snapshots.set(
      validated.snapshotId,
      deepFreezeValue(clone(validated), new WeakSet()),
    );
  }

  async getSnapshot(snapshotId: string): Promise<MemorySnapshot | null> {
    const stored = this.snapshots.get(snapshotId);
    if (stored === undefined) {
      return null;
    }
    return deepFreezeValue(clone(stored), new WeakSet());
  }

  clear(): void {
    this.cases.clear();
    this.snapshots.clear();
  }
}
