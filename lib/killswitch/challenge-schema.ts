import {
  KILL_SWITCH_CHALLENGE_TYPES,
  type KillSwitchChallengeType,
} from "./types";

export function isKillSwitchChallengeType(
  value: string,
): value is KillSwitchChallengeType {
  return Object.values(KILL_SWITCH_CHALLENGE_TYPES).includes(
    value as KillSwitchChallengeType,
  );
}
