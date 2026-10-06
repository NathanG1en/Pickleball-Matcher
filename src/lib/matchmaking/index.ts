export { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
export { generateRound } from "@/lib/matchmaking/generate-round";
export { pairKey } from "@/lib/matchmaking/pairs";
export { expectedScore, kFactor, rateMatch, teamRating } from "@/lib/matchmaking/rating";
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
