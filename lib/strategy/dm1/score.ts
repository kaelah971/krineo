import type {
  ConflictLabel,
  CoverageLabel,
  DirectionalEvidenceDimension,
  DirectionalEvidenceState,
} from "../../evidence/types";
import { DM1_CONFIG } from "./config";
import type {
  DM1Config,
  DM1EvidenceSnapshot,
  ProvisionalDirection,
} from "./types";

const DIRECTIONAL_STATE_VALUES: Record<
  DirectionalEvidenceState,
  number | null
> = {
  STRONGLY_SUPPORTIVE: 1,
  SUPPORTIVE: 0.5,
  NEUTRAL: 0,
  OPPOSING: -0.5,
  STRONGLY_OPPOSING: -1,
  UNKNOWN: null,
};

export interface DirectionalScoreMetrics {
  score: number;
  availableWeight: number;
  totalWeight: number;
  coverage: number;
}

function configuredDimensions(
  config: DM1Config,
): DirectionalEvidenceDimension[] {
  return Object.keys(
    config.directionalWeights,
  ) as DirectionalEvidenceDimension[];
}

export function getDirectionalStateValue(
  state: DirectionalEvidenceState | undefined,
): number | null {
  return state === undefined ? null : DIRECTIONAL_STATE_VALUES[state];
}

export function calculateDirectionalMetrics(
  snapshot: DM1EvidenceSnapshot,
  config: DM1Config = DM1_CONFIG,
): DirectionalScoreMetrics {
  let score = 0;
  let availableWeight = 0;
  let totalWeight = 0;

  for (const dimension of configuredDimensions(config)) {
    const weight = config.directionalWeights[dimension];
    const value = getDirectionalStateValue(snapshot.evidence[dimension]);

    totalWeight += weight;
    if (value === null) {
      continue;
    }

    score += value * weight;
    availableWeight += weight;
  }

  return {
    score,
    availableWeight,
    totalWeight,
    coverage: totalWeight === 0 ? 0 : availableWeight / totalWeight,
  };
}

export function calculateDirectionalScore(
  snapshot: DM1EvidenceSnapshot,
  config: DM1Config = DM1_CONFIG,
): number {
  return calculateDirectionalMetrics(snapshot, config).score;
}

export function calculateCoverage(
  snapshot: DM1EvidenceSnapshot,
  config: DM1Config = DM1_CONFIG,
): number {
  return calculateDirectionalMetrics(snapshot, config).coverage;
}

export function getCoverageLabel(
  coverage: number,
  config: DM1Config = DM1_CONFIG,
): CoverageLabel {
  if (coverage >= config.completeCoverageThreshold) {
    return "COMPLETE";
  }

  if (coverage >= config.minimumCoverage) {
    return "PARTIAL";
  }

  return "DEGRADED";
}

export function calculateConflict(
  snapshot: DM1EvidenceSnapshot,
  provisionalDirection: ProvisionalDirection,
  config: DM1Config = DM1_CONFIG,
): number | null {
  if (provisionalDirection === null) {
    return null;
  }

  let supportingMass = 0;
  let opposingMass = 0;

  for (const dimension of configuredDimensions(config)) {
    const value = getDirectionalStateValue(snapshot.evidence[dimension]);
    if (value === null || value === 0) {
      continue;
    }

    const contribution = value * config.directionalWeights[dimension];
    const supportsDirection =
      provisionalDirection === "LONG" ? contribution > 0 : contribution < 0;

    if (supportsDirection) {
      supportingMass += Math.abs(contribution);
    } else {
      opposingMass += Math.abs(contribution);
    }
  }

  const totalMass = supportingMass + opposingMass;
  return totalMass === 0 ? 0 : opposingMass / totalMass;
}

export function getConflictLabel(
  conflict: number | null,
  config: DM1Config = DM1_CONFIG,
): ConflictLabel | null {
  if (conflict === null) {
    return null;
  }

  if (conflict <= config.lowConflictThreshold) {
    return "LOW";
  }

  if (conflict <= config.maximumConflict) {
    return "MODERATE";
  }

  return "HIGH";
}
