import type { MatchmakingConfig } from "@/lib/matchmaking/types";

export const DEFAULT_MATCHMAKING_CONFIG: MatchmakingConfig = Object.freeze({
  iterations: 5_000,
  weights: Object.freeze({
    consecutiveSit: 100,
    playingTime: 80,
    partnerRepeat: 50,
    skillBalance: 20,
    opponentRepeat: 10,
  }),
  partnerRecency: Object.freeze({ 1: 100, 2: 70, 3: 50, 5: 25, 10: 5 }),
  opponentRecency: Object.freeze({ 1: 25, 2: 15, 3: 10, 5: 3 }),
  longTermPartnerFactor: 0.25,
  longTermOpponentFactor: 0.1,
  tieBreakMaximum: 0.001,
});
