import type { MatchmakingPlayer } from "@/lib/matchmaking/types";

export function makePlayer(overrides: Partial<MatchmakingPlayer> = {}): MatchmakingPlayer {
  const id = overrides.id ?? "player-1";

  return {
    id,
    name: overrides.name ?? id,
    rating: overrides.rating ?? 1_000,
    gamesPlayed: overrides.gamesPlayed ?? 0,
    eligibleRounds: overrides.eligibleRounds ?? 0,
    satPreviousRound: overrides.satPreviousRound ?? false,
  };
}
