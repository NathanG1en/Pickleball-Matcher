import type {
  PlayerRatingUpdate,
  RatedMatchInput,
  RatedPlayer,
} from "@/lib/matchmaking/types";

export function teamRating(ratings: readonly [number, number]): number {
  return (ratings[0] + ratings[1]) / 2;
}

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function kFactor(ratedGames: number): 40 | 20 {
  return ratedGames < 10 ? 40 : 20;
}

function commonTeamK(team: readonly [RatedPlayer, RatedPlayer]): number {
  return (kFactor(team[0].ratedGames) + kFactor(team[1].ratedGames)) / 2;
}

function updatesForTeam(
  team: readonly [RatedPlayer, RatedPlayer],
  delta: number,
): readonly [PlayerRatingUpdate, PlayerRatingUpdate] {
  const update = (player: RatedPlayer): PlayerRatingUpdate => ({
    playerId: player.id,
    ratingBefore: player.rating,
    ratingAfter: player.rating + delta,
    delta,
  });

  return [update(team[0]), update(team[1])];
}

export function rateMatch(input: RatedMatchInput): readonly PlayerRatingUpdate[] {
  const team1Rating = teamRating([input.team1[0].rating, input.team1[1].rating]);
  const team2Rating = teamRating([input.team2[0].rating, input.team2[1].rating]);
  const expectedTeam1 = expectedScore(team1Rating, team2Rating);
  const actualTeam1 = input.winner === 1 ? 1 : 0;
  const team1Delta = commonTeamK(input.team1) * (actualTeam1 - expectedTeam1);
  const team2Delta = commonTeamK(input.team2) * ((1 - actualTeam1) - (1 - expectedTeam1));

  return [
    ...updatesForTeam(input.team1, team1Delta),
    ...updatesForTeam(input.team2, team2Delta),
  ];
}
