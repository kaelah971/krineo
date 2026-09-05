import type { DirectionalEvidenceDimension } from "../../evidence/types";
import { DM1_CONFIG } from "./config";
import { getDirectionalStateValue } from "./score";
import type {
  DM1Config,
  DM1EvidenceSnapshot,
  HardGateResult,
  ProvisionalDirection,
} from "./types";
import { REASON_CODES } from "./reason-codes";

export function deriveProvisionalDirection(
  directionalScore: number,
  config: DM1Config = DM1_CONFIG,
): ProvisionalDirection {
  if (directionalScore >= config.directionThreshold) {
    return "LONG";
  }

  if (directionalScore <= -config.directionThreshold) {
    return "SHORT";
  }

  return null;
}

function requiredEvidenceAvailable(
  snapshot: DM1EvidenceSnapshot,
  requiredDimensions: readonly DirectionalEvidenceDimension[],
): boolean {
  return requiredDimensions.every(
    (dimension) =>
      getDirectionalStateValue(snapshot.evidence[dimension]) !== null,
  );
}

export function evaluateHardGates(
  snapshot: DM1EvidenceSnapshot,
  coverage: number,
  config: DM1Config = DM1_CONFIG,
): HardGateResult[] {
  const requiredEvidencePasses = requiredEvidenceAvailable(
    snapshot,
    config.requiredDirectionalDimensions,
  );

  // DM-1 v1 keeps conflict diagnostic. A score-qualified thesis cannot
  // exceed 30% conflict under the 100-point, +/-60 policy, so HIGH conflict
  // is not an independent hard veto for this strategy version.
  return [
    {
      gate: "REQUIRED_DIRECTIONAL_EVIDENCE",
      passed: requiredEvidencePasses,
      ...(requiredEvidencePasses
        ? {}
        : { reasonCode: REASON_CODES.REQUIRED_EVIDENCE_UNAVAILABLE }),
    },
    {
      gate: "COVERAGE",
      passed: coverage >= config.minimumCoverage,
      ...(coverage >= config.minimumCoverage
        ? {}
        : { reasonCode: REASON_CODES.INSUFFICIENT_COVERAGE }),
    },
    {
      gate: "SAFETY",
      passed: snapshot.safety === "CLEAR",
      ...(snapshot.safety === "CLEAR"
        ? {}
        : {
            reasonCode:
              snapshot.safety === "VETO"
                ? REASON_CODES.SAFETY_VETO
                : REASON_CODES.SAFETY_EVIDENCE_UNAVAILABLE,
          }),
    },
    {
      gate: "RISK",
      passed: snapshot.risk !== "EXTREME" && snapshot.risk !== "UNKNOWN",
      ...(snapshot.risk === "EXTREME"
        ? { reasonCode: REASON_CODES.EXTREME_VOLATILITY }
        : snapshot.risk === "UNKNOWN"
          ? { reasonCode: REASON_CODES.REQUIRED_RISK_UNKNOWN }
          : {}),
    },
    {
      gate: "REGIME_FIT",
      passed: snapshot.regimeFit !== "BROKEN" && snapshot.regimeFit !== "UNKNOWN",
      ...(snapshot.regimeFit === "BROKEN"
        ? { reasonCode: REASON_CODES.REGIME_MISMATCH }
        : snapshot.regimeFit === "UNKNOWN"
          ? { reasonCode: REASON_CODES.REGIME_UNKNOWN }
          : {}),
    },
  ];
}
