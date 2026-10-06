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

export function makePlayers(
  count: number,
  overrides: (index: number) => Partial<MatchmakingPlayer> = () => ({}),
): MatchmakingPlayer[] {
  return Array.from({ length: count }, (_, index) =>
    makePlayer({
      id: `player-${index + 1}`,
      name: `Player ${index + 1}`,
      ...overrides(index),
    }),
  );
}
