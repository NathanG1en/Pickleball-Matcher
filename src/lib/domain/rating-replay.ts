import type { DomainRepository } from "@/lib/domain/repositories";
import type { RatingReplayResult, RatingSnapshot } from "@/lib/domain/types";
import { rateMatch } from "@/lib/matchmaking/rating";

export async function replayRatings(
  groupId: string,
  repository: DomainRepository,
): Promise<RatingReplayResult> {
  const players = await repository.listPlayers(groupId);
  const current = new Map(
    players.map((player) => [
      player.id,
      { rating: player.initialRating, ratedGamesPlayed: 0 },
    ]),
  );
  const matches = (await repository.listReplayMatches(groupId))
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
    const team1 = match.team1.map((playerId) => ({
      id: playerId,
      rating: current.get(playerId)!.rating,
      ratedGames: current.get(playerId)!.ratedGamesPlayed,
    })) as [
      { id: string; rating: number; ratedGames: number },
      { id: string; rating: number; ratedGames: number },
    ];
    const team2 = match.team2.map((playerId) => ({
      id: playerId,
      rating: current.get(playerId)!.rating,
      ratedGames: current.get(playerId)!.ratedGamesPlayed,
    })) as [
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
      const player = current.get(update.playerId)!;
      current.set(update.playerId, {
        rating: update.ratingAfter,
        ratedGamesPlayed: player.ratedGamesPlayed + 1,
      });
    }
  }

  await repository.replaceRatingState(
    groupId,
    [...current].map(([id, state]) => ({ id, ...state })),
    snapshots,
  );

  return {
    processedMatchIds: matches.map((match) => match.id),
    playerRatings: new Map([...current].map(([id, state]) => [id, state.rating])),
  };
}
