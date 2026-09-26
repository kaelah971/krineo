import { REASON_CODES, type ReasonCode } from "../strategy/dm1/reason-codes";
import type { DecisionResult } from "../strategy/dm1/types";
import {
  PLAYBOOK_EFFECTS,
  type Effect,
} from "../playbook/types";

/**
 * M4's complete ReasonCode policy. Keep this map exhaustive when DM-1 adds a
 * reason code: the Record type intentionally makes that change compile-fail.
 */
export const REASON_CODE_EFFECTS: Readonly<Record<ReasonCode, Effect>> = {
  [REASON_CODES.STRONG_DIRECTIONAL_MOMENTUM]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.TECHNICAL_CONFLUENCE_SUPPORTIVE]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.RELATIVE_OPPORTUNITY_WINNER]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.MARKET_ALIGNMENT_SUPPORTIVE]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.INSUFFICIENT_DIRECTIONAL_EVIDENCE]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.HIGH_EVIDENCE_CONFLICT]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.INSUFFICIENT_COVERAGE]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.REQUIRED_EVIDENCE_UNAVAILABLE]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.EXTREME_VOLATILITY]: PLAYBOOK_EFFECTS.BLOCK,
  [REASON_CODES.REQUIRED_RISK_UNKNOWN]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.REGIME_MISMATCH]: PLAYBOOK_EFFECTS.BLOCK,
  [REASON_CODES.REGIME_UNKNOWN]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.SAFETY_VETO]: PLAYBOOK_EFFECTS.BLOCK,
  [REASON_CODES.SAFETY_EVIDENCE_UNAVAILABLE]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.NO_CLEAR_RELATIVE_WINNER]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.NARRATIVE_OVERHEATING]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.NARRATIVE_CONTRADICTION]: PLAYBOOK_EFFECTS.WAIT,
  [REASON_CODES.FRAGILE_EVIDENCE_BASE]: PLAYBOOK_EFFECTS.WAIT,
};

export function classifyReasonCode(reasonCode: ReasonCode): Effect {
  return REASON_CODE_EFFECTS[reasonCode];
}

function rank(effect: Effect): number {
  switch (effect) {
    case PLAYBOOK_EFFECTS.BLOCK:
      return 0;
    case PLAYBOOK_EFFECTS.WAIT:
      return 1;
    case PLAYBOOK_EFFECTS.CAUTION:
      return 2;
    case PLAYBOOK_EFFECTS.PASS:
      return 3;
  }
}

/**
 * Derives only the market-side effect. Warnings never restrict a directional
 * result; only failed hard gates do. An ABSTAIN without a reason remains WAIT.
 */
export function deriveMarketEffect(marketResult: DecisionResult): Effect {
  const failedGates = marketResult.hardGateResults.filter(
    (gate) => !gate.passed,
  );
  const classifiedReasons =
    marketResult.decision === "ABSTAIN"
      ? marketResult.reasonCodes
      : failedGates
          .filter((gate) => gate.reasonCode !== undefined)
          .map((gate) => gate.reasonCode as ReasonCode);

  if (marketResult.decision !== "ABSTAIN" && failedGates.length === 0) {
    return PLAYBOOK_EFFECTS.PASS;
  }

  if (classifiedReasons.length === 0) {
    return PLAYBOOK_EFFECTS.WAIT;
  }

  let effect: Effect = PLAYBOOK_EFFECTS.WAIT;
  for (const reasonCode of classifiedReasons) {
    const candidate = classifyReasonCode(reasonCode);
    if (rank(candidate) < rank(effect)) {
      effect = candidate;
    }
  }
  return effect;
}
