import type {
  DirectionalEvidenceState,
  RegimeFitState,
  RiskState,
  SafetyState,
} from "../../lib/evidence/types";
import { evaluateCandidate } from "../../lib/strategy/dm1/decision";
import {
  type CandidateEvaluation,
  type DM1EvidenceSnapshot,
} from "../../lib/strategy/dm1/types";
import {
  type KillSwitchComparisonCandidate,
  type KillSwitchComparisonState,
  type KillSwitchDecisionState,
  type KillSwitchEvidenceItem,
  type KillSwitchEvidenceSnapshot,
  type KillSwitchValidationInput,
  type StructuredChallenge,
} from "../../lib/killswitch/types";
import { makeDM1Fixture } from "./dm1";

const BASE_DIRECTIONAL_ITEMS: KillSwitchEvidenceItem[] = [
  {
    id: "evidence-momentum",
    kind: "DIRECTIONAL",
    dimension: "DIRECTIONAL_MOMENTUM",
    state: "STRONGLY_SUPPORTIVE",
    source: "momentum-source",
  },
  {
    id: "evidence-technical",
    kind: "DIRECTIONAL",
    dimension: "TECHNICAL_CONFLUENCE",
    state: "STRONGLY_SUPPORTIVE",
    source: "technical-source",
  },
  {
    id: "evidence-relative",
    kind: "DIRECTIONAL",
    dimension: "RELATIVE_OPPORTUNITY",
    state: "STRONGLY_SUPPORTIVE",
    source: "relative-source",
  },
  {
    id: "evidence-market",
    kind: "DIRECTIONAL",
    dimension: "MARKET_ALIGNMENT",
    state: "STRONGLY_SUPPORTIVE",
    source: "market-source",
  },
  {
    id: "evidence-sentiment",
    kind: "DIRECTIONAL",
    dimension: "SENTIMENT_DERIVATIVES",
    state: "STRONGLY_SUPPORTIVE",
    source: "sentiment-source",
  },
];

function policyEvidence(
  risk: RiskState = "ACCEPTABLE",
  safety: SafetyState = "CLEAR",
  regimeFit: RegimeFitState = "FIT",
): KillSwitchEvidenceItem[] {
  return [
    { id: "evidence-risk", kind: "RISK", state: risk, source: "risk-source" },
    {
      id: "evidence-safety",
      kind: "SAFETY",
      state: safety,
      source: "safety-source",
    },
    {
      id: "evidence-regime",
      kind: "REGIME_FIT",
      state: regimeFit,
      source: "regime-source",
    },
  ];
}

export function makeKillSwitchEvidenceSnapshot(
  dm1: DM1EvidenceSnapshot = makeDM1Fixture(),
  items: readonly KillSwitchEvidenceItem[] = [
    ...BASE_DIRECTIONAL_ITEMS,
    ...policyEvidence(),
  ],
): KillSwitchEvidenceSnapshot {
  return { dm1, items };
}

export function makeKillSwitchChallenge(
  overrides: Partial<StructuredChallenge> = {},
): StructuredChallenge {
  return {
    id: "challenge-1",
    challengeType: "DIRECTION_CONTRADICTION",
    claim: "The directional evidence opposes the thesis.",
    evidenceIds: ["evidence-momentum"],
    createdBy: "MODEL",
    ...overrides,
  };
}

function defaultCandidate(): CandidateEvaluation {
  return evaluateCandidate({ asset: "SOL", evidence: makeDM1Fixture() });
}

function defaultComparison(
  target: CandidateEvaluation,
  alternatives: readonly KillSwitchComparisonCandidate[] = [],
): KillSwitchComparisonState {
  return {
    available: true,
    selectedCandidateId: "candidate-sol",
    candidates: [
      { id: "candidate-sol", evaluation: target },
      ...alternatives,
    ],
  };
}

export function makeKillSwitchInput(overrides: {
  dm1?: DM1EvidenceSnapshot;
  items?: readonly KillSwitchEvidenceItem[];
  provisional?: CandidateEvaluation;
  final?: CandidateEvaluation | null;
  comparison?: KillSwitchComparisonState;
  challenge?: Partial<StructuredChallenge>;
} = {}): KillSwitchValidationInput {
  const provisional = overrides.provisional ?? defaultCandidate();
  const evidence = makeKillSwitchEvidenceSnapshot(
    overrides.dm1,
    overrides.items,
  );
  const decision: KillSwitchDecisionState = {
    provisional,
    final: overrides.final ?? null,
  };

  return {
    decision,
    evidence,
    comparison: overrides.comparison ?? defaultComparison(provisional),
    challenge: makeKillSwitchChallenge(overrides.challenge),
  };
}

export function makeEvidenceItem(
  id: string,
  state: DirectionalEvidenceState,
  source = "fixture-source",
): KillSwitchEvidenceItem {
  return {
    id,
    kind: "DIRECTIONAL",
    dimension: "DIRECTIONAL_MOMENTUM",
    state,
    source,
  };
}
