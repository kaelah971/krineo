import type { DecisionCase, MemorySnapshot } from "../memory";
import type { PlaybookVersion, Proposal } from "../playbook";
import { deepFreeze, validateJsonValue } from "./sanitize";
import {
  SIBYL_BODY_SCHEMA_VERSIONS,
  SIBYL_EVENT_KINDS,
  type SibylEntityPayload,
  type SibylJsonObject,
  type SibylJsonValue,
  type SibylJournalEvent,
} from "./types";

export function toDecisionCaseEntity(caseItem: DecisionCase): SibylEntityPayload {
  const body: SibylJsonObject = {
    schemaVersion: SIBYL_BODY_SCHEMA_VERSIONS.DECISION_CASE,
    id: caseItem.id,
    thesisId: caseItem.thesisId,
    versionId: caseItem.versionId,
    evidenceSnapshotId: caseItem.evidenceSnapshotId,
    strategyId: caseItem.strategyId,
    strategyVersion: caseItem.strategyVersion,
    asset: caseItem.asset,
    decision: caseItem.decision,
    signature: {
      evidence: {
        DIRECTIONAL_MOMENTUM: caseItem.signature.evidence.DIRECTIONAL_MOMENTUM,
        TECHNICAL_CONFLUENCE: caseItem.signature.evidence.TECHNICAL_CONFLUENCE,
        RELATIVE_OPPORTUNITY: caseItem.signature.evidence.RELATIVE_OPPORTUNITY,
        MARKET_ALIGNMENT: caseItem.signature.evidence.MARKET_ALIGNMENT,
        SENTIMENT_DERIVATIVES: caseItem.signature.evidence.SENTIMENT_DERIVATIVES,
      },
      risk: caseItem.signature.risk,
      safety: caseItem.signature.safety,
      regimeFit: caseItem.signature.regimeFit,
    },
    committedAt: caseItem.committedAt,
    observedAt: caseItem.observedAt,
    ...(caseItem.outcome
      ? {
          outcome: {
            status: caseItem.outcome.status,
            ...(caseItem.outcome.resolvedAt ? { resolvedAt: caseItem.outcome.resolvedAt } : {}),
            ...(caseItem.outcome.observationId ? { observationId: caseItem.outcome.observationId } : {}),
          },
        }
      : {}),
  };
  validateJsonValue(body);
  return deepFreeze({
    category: "decision_case",
    name: caseItem.id,
    body,
  });
}

export function toMemorySnapshotEntity(snapshot: MemorySnapshot): SibylEntityPayload {
  const rankedCases = snapshot.rankedCases.map((rc) => ({
    rank: rc.rank,
    caseId: rc.caseId,
    overallSimilarity: rc.similarity.overallSimilarity,
    comparableSimilarity: rc.similarity.comparableSimilarity,
    comparisonCoverage: rc.similarity.comparisonCoverage,
    targetCompleteness: rc.similarity.targetCompleteness,
    candidateCompleteness: rc.similarity.candidateCompleteness,
    comparableWeight: rc.similarity.comparableWeight,
  }));
  const body: SibylJsonObject = {
    schemaVersion: SIBYL_BODY_SCHEMA_VERSIONS.MEMORY_SNAPSHOT,
    snapshotId: snapshot.snapshotId,
    algorithmVersion: snapshot.algorithmVersion,
    createdAt: snapshot.createdAt,
    targetCaseId: snapshot.targetCase ? snapshot.targetCase.id : null,
    targetSignature: {
      evidence: {
        DIRECTIONAL_MOMENTUM: snapshot.targetSignature.evidence.DIRECTIONAL_MOMENTUM,
        TECHNICAL_CONFLUENCE: snapshot.targetSignature.evidence.TECHNICAL_CONFLUENCE,
        RELATIVE_OPPORTUNITY: snapshot.targetSignature.evidence.RELATIVE_OPPORTUNITY,
        MARKET_ALIGNMENT: snapshot.targetSignature.evidence.MARKET_ALIGNMENT,
        SENTIMENT_DERIVATIVES: snapshot.targetSignature.evidence.SENTIMENT_DERIVATIVES,
      },
      risk: snapshot.targetSignature.risk,
      safety: snapshot.targetSignature.safety,
      regimeFit: snapshot.targetSignature.regimeFit,
    },
    rankedCases,
  };
  validateJsonValue(body);
  return deepFreeze({
    category: "memory_snapshot",
    name: snapshot.snapshotId,
    body,
  });
}

export function toPlaybookVersionEntity(version: PlaybookVersion): SibylEntityPayload {
  const rules: SibylJsonObject[] = version.rules.map((r) => {
    const conditions: SibylJsonObject[] = r.conditions.map((c) => {
      const record = c as unknown as Record<string, unknown>;
      const field = typeof record["field"] === "string" ? record["field"] : "";
      const operator = typeof record["operator"] === "string" ? record["operator"] : "";
      const out: Record<string, SibylJsonValue> = { field, operator };
      if ("values" in record && Array.isArray(record["values"])) {
        const vals: SibylJsonValue[] = [];
        for (const v of record["values"]) {
          if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            if (typeof v === "number" && !Number.isFinite(v)) {
              throw new Error("Non-finite condition value.");
            }
            vals.push(v);
          } else if (typeof v !== "undefined") {
            vals.push(JSON.stringify(v));
          }
        }
        out["values"] = vals;
      } else if (record["value"] !== undefined) {
        const value = record["value"];
        if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          if (typeof value === "number" && !Number.isFinite(value)) {
            throw new Error("Non-finite condition value.");
          }
          out["value"] = value;
        } else {
          out["value"] = JSON.stringify(value);
        }
      } else {
        out["value"] = null;
      }
      return out;
    });
    return { id: r.id, effect: r.effect, conditions };
  });
  const body: SibylJsonObject = {
    schemaVersion: SIBYL_BODY_SCHEMA_VERSIONS.PLAYBOOK_VERSION,
    id: version.id,
    playbookId: version.playbookId,
    versionNumber: version.versionNumber,
    strategyId: version.strategyId,
    strategyVersion: version.strategyVersion,
    createdAt: version.createdAt,
    approvedAt: version.approvedAt,
    approvedBy: version.approvedBy,
    sourceProposalId: version.sourceProposalId ?? null,
    sourceProposalCreator: version.sourceProposalCreator ?? null,
    rules,
  };
  validateJsonValue(body);
  return deepFreeze({
    category: "playbook_version",
    name: `${version.playbookId}:v${version.versionNumber}`,
    body,
  });
}

export function toDecisionCommittedEvent(caseItem: DecisionCase): SibylJournalEvent {
  const body: SibylJsonObject = {
    eventSchemaVersion: "krineo.sibyl.event.decision_committed.v1",
    caseId: caseItem.id,
    decision: caseItem.decision,
    strategyId: caseItem.strategyId,
    strategyVersion: caseItem.strategyVersion,
    asset: caseItem.asset,
    committedAt: caseItem.committedAt,
  };
  validateJsonValue(body);
  return deepFreeze({
    kind: SIBYL_EVENT_KINDS.DECISION_COMMITTED,
    category: "decision_case",
    name: caseItem.id,
    body,
  });
}

export function toSnapshotCreatedEvent(snapshot: MemorySnapshot): SibylJournalEvent {
  const body: SibylJsonObject = {
    eventSchemaVersion: "krineo.sibyl.event.snapshot_created.v1",
    snapshotId: snapshot.snapshotId,
    algorithmVersion: snapshot.algorithmVersion,
    createdAt: snapshot.createdAt,
    rankedCaseCount: snapshot.rankedCases.length,
    targetCaseId: snapshot.targetCase ? snapshot.targetCase.id : null,
  };
  validateJsonValue(body);
  return deepFreeze({
    kind: SIBYL_EVENT_KINDS.SNAPSHOT_CREATED,
    category: "memory_snapshot",
    name: snapshot.snapshotId,
    body,
  });
}

export function toProposalCreatedEvent(proposal: Proposal): SibylJournalEvent {
  const body: SibylJsonObject = {
    eventSchemaVersion: "krineo.sibyl.event.proposal_created.v1",
    proposalId: proposal.id,
    playbookId: proposal.playbookId,
    proposedVersionId: proposal.proposedVersionId,
    parentVersionId: proposal.parentVersionId,
    parentVersionNumber: proposal.parentVersionNumber,
    strategyId: proposal.strategyId,
    strategyVersion: proposal.strategyVersion,
    createdBy: proposal.createdBy,
    createdAt: proposal.createdAt,
  };
  validateJsonValue(body);
  return deepFreeze({
    kind: SIBYL_EVENT_KINDS.PROPOSAL_CREATED,
    category: "playbook_proposal",
    name: proposal.id,
    body,
  });
}

export function toProposalResolvedEvent(proposal: Proposal): SibylJournalEvent {
  const body: SibylJsonObject = {
    eventSchemaVersion: "krineo.sibyl.event.proposal_resolved.v1",
    proposalId: proposal.id,
    playbookId: proposal.playbookId,
    proposedVersionId: proposal.proposedVersionId,
    status: proposal.status,
    resolvedAt: proposal.resolvedAt ?? null,
    resolvedBy: proposal.resolvedBy ?? null,
  };
  validateJsonValue(body);
  return deepFreeze({
    kind: SIBYL_EVENT_KINDS.PROPOSAL_RESOLVED,
    category: "playbook_proposal",
    name: proposal.id,
    body,
  });
}
