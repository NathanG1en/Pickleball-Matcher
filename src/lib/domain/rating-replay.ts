import type { DomainRepository } from "@/lib/domain/repositories";
import type { PlayerRecord, ReplayMatch, RatingReplayResult, RatingSnapshot } from "@/lib/domain/types";
import { rateMatch } from "@/lib/matchmaking/rating";

export function calculateRatingReplay(
  players: readonly PlayerRecord[],
  history: readonly ReplayMatch[],
) {
  const playerMap = new Map(players.map((player) => [player.id, player]));

  const entityStates = new Map<string, { rating: number; ratedGamesPlayed: number }>();
  for (const player of players) {
    const key = player.accountId ?? player.id;
    if (!entityStates.has(key)) {
      entityStates.set(key, {
        rating: player.initialRating,
        ratedGamesPlayed: 0,
      });
    }
  }

  const matches = history
    .filter((match) => match.status === "completed")
    .toSorted(
      (first, second) =>
        first.completedAt.getTime() - second.completedAt.getTime() ||
        first.id.localeCompare(second.id),
    );
  const snapshots = new Map<string, readonly RatingSnapshot[]>();

  for (const match of matches) {
    if (match.team1.length !== 2 || match.team2.length !== 2) {
      continue;
    }
    const team1 = match.team1.map((playerId) => {
      const key = playerMap.get(playerId)?.accountId ?? playerId;
      const state = entityStates.get(key) ?? { rating: 1_000, ratedGamesPlayed: 0 };
      return {
        id: playerId,
        rating: state.rating,
        ratedGames: state.ratedGamesPlayed,
      };
    }) as [
      { id: string; rating: number; ratedGames: number },
      { id: string; rating: number; ratedGames: number },
    ];
    const team2 = match.team2.map((playerId) => {
      const key = playerMap.get(playerId)?.accountId ?? playerId;
      const state = entityStates.get(key) ?? { rating: 1_000, ratedGamesPlayed: 0 };
      return {
        id: playerId,
        rating: state.rating,
        ratedGames: state.ratedGamesPlayed,
      };
    }) as [
      { id: string; rating: number; ratedGames: number },
      { id: string; rating: number; ratedGames: number },
    ];
    const updates = rateMatch({
      team1,
      team2,
      winner: match.team1Score > match.team2Score ? 1 : 2,
    });
    snapshots.set(
      match.id,
      updates.map((update) => ({
        playerId: update.playerId,
        ratingBefore: update.ratingBefore,
        ratingAfter: update.ratingAfter,
      })),
    );
    for (const update of updates) {
      const key = playerMap.get(update.playerId)?.accountId ?? update.playerId;
      const playerState = entityStates.get(key) ?? { rating: update.ratingBefore, ratedGamesPlayed: 0 };
      entityStates.set(key, {
        rating: update.ratingAfter,
        ratedGamesPlayed: playerState.ratedGamesPlayed + 1,
      });
    }
  }

  const updatedPlayers = players.map((player) => {
    const key = player.accountId ?? player.id;
    const state = entityStates.get(key) ?? { rating: player.initialRating, ratedGamesPlayed: 0 };
    return {
      id: player.id,
      accountId: player.accountId,
      rating: state.rating,
      ratedGamesPlayed: state.ratedGamesPlayed,
    };
  });

  return { players: updatedPlayers, snapshots, processedMatchIds: matches.map(match => match.id) };
}

export async function replayRatings(
  groupId: string,
  repository: DomainRepository,
): Promise<RatingReplayResult> {
  const players = await repository.listPlayers(undefined, { includeInactive: true });
  const matches = await repository.listReplayMatches();
  const replay = calculateRatingReplay(players, matches);
  await repository.replaceRatingState(groupId, replay.players, replay.snapshots);
  const matchGroups = new Map(matches.map(match => [match.id, match.groupId]));
  const ratings = new Map(replay.players.map(player => [player.id, player.rating]));

  return {
    processedMatchIds: replay.processedMatchIds.filter(id => !groupId || matchGroups.get(id) === groupId),
    playerRatings: new Map(
      players
        .filter((player) => !groupId || player.groupId === groupId)
        .map((player) => {
          return [player.id, ratings.get(player.id) ?? player.initialRating];
        }),
    ),
  };
}
