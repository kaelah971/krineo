import {
  DECISION_STATES,
  DIRECTIONAL_EVIDENCE_DIMENSIONS,
  DIRECTIONAL_EVIDENCE_STATES,
  REGIME_FIT_STATES,
  RISK_STATES,
  SAFETY_STATES,
} from "../../evidence/types";
import {
  CONDITION_FIELD_ORDER,
  CONDITION_OPERATORS,
  PLAYBOOK_ACTORS,
  PLAYBOOK_EFFECTS,
} from "../../playbook";
import { REASON_CODES } from "../../strategy/dm1/reason-codes";
import {
  STRATEGY_PREFLIGHT_NAME,
  type StrategyPreflightDefinition,
} from "./types";

const enumSchema = (values: readonly string[]) => ({
  type: "string",
  enum: [...values],
});

const conditionSchema = {
  type: "object",
  oneOf: [
    {
      required: ["field", "operator", "value"],
      properties: {
        field: enumSchema(CONDITION_FIELD_ORDER),
        operator: {
          ...enumSchema([
            CONDITION_OPERATORS.EQUALS,
            CONDITION_OPERATORS.NOT_EQUALS,
            CONDITION_OPERATORS.GTE,
            CONDITION_OPERATORS.LTE,
          ]),
        },
        value: {},
      },
      additionalProperties: false,
    },
    {
      required: ["field", "operator", "values"],
      properties: {
        field: enumSchema(CONDITION_FIELD_ORDER),
        operator: enumSchema([CONDITION_OPERATORS.IN]),
        values: { type: "array", minItems: 1 },
      },
      additionalProperties: false,
    },
  ],
} as const;

const inputSchema = {
  type: "object",
  required: ["market_context", "playbook"],
  additionalProperties: false,
  properties: {
    market_context: {
      type: "object",
      required: [
        "decision",
        "reason_codes",
        "evidence",
        "risk",
        "safety",
        "regime",
        "coverage",
        "conflict",
      ],
      additionalProperties: false,
      properties: {
        decision: enumSchema(Object.values(DECISION_STATES)),
        reason_codes: {
          type: "array",
          items: enumSchema(Object.values(REASON_CODES)),
        },
        evidence: {
          type: "object",
          required: Object.values(DIRECTIONAL_EVIDENCE_DIMENSIONS),
          additionalProperties: false,
          properties: Object.fromEntries(
            Object.values(DIRECTIONAL_EVIDENCE_DIMENSIONS).map((dimension) => [
              dimension,
              enumSchema(Object.values(DIRECTIONAL_EVIDENCE_STATES)),
            ]),
          ),
        },
        risk: enumSchema(Object.values(RISK_STATES)),
        safety: enumSchema(Object.values(SAFETY_STATES)),
        regime: enumSchema(Object.values(REGIME_FIT_STATES)),
        coverage: { type: "number", minimum: 0, maximum: 1 },
        conflict: { type: ["number", "null"], minimum: 0, maximum: 1 },
      },
    },
    playbook: {
      type: "object",
      required: [
        "id",
        "playbookId",
        "versionNumber",
        "strategyId",
        "strategyVersion",
        "rules",
        "createdAt",
        "approvedAt",
        "approvedBy",
      ],
      additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 1 },
        playbookId: { type: "string", minLength: 1 },
        versionNumber: { type: "integer", minimum: 1 },
        strategyId: { type: "string", minLength: 1 },
        strategyVersion: { type: "string", minLength: 1 },
        rules: {
          type: "array",
          minItems: 0,
          items: {
            type: "object",
            required: ["id", "effect", "conditions"],
            additionalProperties: false,
            properties: {
              id: { type: "string", minLength: 1 },
              effect: enumSchema(Object.values(PLAYBOOK_EFFECTS)),
              conditions: {
                type: "array",
                minItems: 1,
                items: conditionSchema,
              },
            },
          },
        },
        createdAt: { type: "string", minLength: 1 },
        approvedAt: { type: "string", minLength: 1 },
        approvedBy: enumSchema([PLAYBOOK_ACTORS.HUMAN]),
        sourceProposalId: { type: "string", minLength: 1 },
        sourceProposalCreator: enumSchema(Object.values(PLAYBOOK_ACTORS)),
      },
    },
    memory: {
      type: "object",
      required: [
        "rankedCaseCount",
        "comparableCaseCount",
        "highSimilarityCaseCount",
      ],
      additionalProperties: false,
      properties: {
        rankedCaseCount: { type: "integer", minimum: 0 },
        comparableCaseCount: { type: "integer", minimum: 0 },
        highSimilarityCaseCount: { type: "integer", minimum: 0 },
      },
    },
  },
} as const;

export const STRATEGY_PREFLIGHT_DEFINITION: StrategyPreflightDefinition = {
  name: STRATEGY_PREFLIGHT_NAME,
  description:
    "Read-only deterministic eligibility evaluation: applies one approved Playbook version to supplied DM-1 market context through Krineo's existing Strategy Preflight engine.",
  input_schema: inputSchema,
  read_only: true,
};