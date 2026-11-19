export { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
export { generateRound } from "@/lib/matchmaking/generate-round";
export { pairKey } from "@/lib/matchmaking/pairs";
export {
  BASE_MARGIN,
  INACTIVITY_GRACE_DAYS,
  INACTIVITY_SCALE_DAYS,
  K_DECAY_RATE,
  K_MAX,
  K_MIN,
  MAX_MARGIN_MULTIPLIER,
  MIN_MARGIN_MULTIPLIER,
  expectedScore,
  kFactor,
  rateMatch,
  scoreMarginMultiplier,
  teamRating,
} from "@/lib/matchmaking/rating";
export type {
  GenerateRoundInput,
  GeneratedRound,
  GenerationResult,
  MatchmakingConfig,
  MatchmakingPlayer,
  PairHistory,
  PlayerRatingUpdate,
  RatedMatchInput,
} from "@/lib/matchmaking/types";
