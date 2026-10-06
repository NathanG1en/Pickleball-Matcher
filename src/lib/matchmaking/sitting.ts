import type {
  MatchmakingPlayer,
  PlayerId,
  ScoreBreakdown,
  SittingChoiceInput,
  SittingSelectionInput,
} from "@/lib/matchmaking/types";

export function participationLoad(
  player: MatchmakingPlayer,
  groupAverage: number,
): number {
  return (player.gamesPlayed + groupAverage) / (player.eligibleRounds + 1);
}

function currentGroupAverage(players: readonly MatchmakingPlayer[]): number {
  let games = 0;
  let rounds = 0;
  for (const player of players) {
    if (player.eligibleRounds <= 0) continue;
    games += player.gamesPlayed;
    rounds += player.eligibleRounds;
  }
  return rounds === 0 ? 0 : games / rounds;
}

export function scoreSittingChoice(
  input: SittingChoiceInput,
): Pick<ScoreBreakdown, "playingTime" | "consecutiveSit"> {
  const sitting = new Set(input.sitting);
  const groupAverage = currentGroupAverage(input.players);
  const projectedLoads = input.players.map((player) =>
    participationLoad(
      {
        ...player,
        gamesPlayed: player.gamesPlayed + (sitting.has(player.id) ? 0 : 1),
        eligibleRounds: player.eligibleRounds + 1,
      },
      groupAverage,
    ),
  );
  const spread =
    projectedLoads.length === 0
      ? 0
      : Math.max(...projectedLoads) - Math.min(...projectedLoads);
  const consecutiveSitCount = input.players.filter(
    (player) => sitting.has(player.id) && player.satPreviousRound,
  ).length;

  return {
    playingTime: spread,
    consecutiveSit: input.sitting.length === 0 ? 0 : consecutiveSitCount / input.sitting.length,
  };
}

export function chooseSittingPlayers(input: SittingSelectionInput): readonly PlayerId[] {
  if (!Number.isSafeInteger(input.sitCount) || input.sitCount < 0) {
    throw new RangeError("sitCount must be a non-negative integer");
  }
  if (input.sitCount > input.players.length) {
    throw new RangeError("sitCount cannot exceed the number of players");
  }
  if (input.sitCount === 0) return [];

  const groupAverage = currentGroupAverage(input.players);
  const ranked = input.random.shuffle(input.players).sort((first, second) => {
    if (first.satPreviousRound !== second.satPreviousRound) {
      return first.satPreviousRound ? 1 : -1;
    }

    const firstLoad = participationLoad(first, groupAverage);
    const secondLoad = participationLoad(second, groupAverage);
    const weightedDifference =
      (secondLoad - firstLoad) * input.config.weights.playingTime;
    return Math.abs(weightedDifference) < Number.EPSILON ? 0 : weightedDifference;
  });

  return ranked.slice(0, input.sitCount).map((player) => player.id);
}
