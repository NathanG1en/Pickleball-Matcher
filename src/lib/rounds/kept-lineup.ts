import type { RoundProposal, StartedRoundRecord } from "@/lib/domain/types";
import type { CourtAssignment, Team } from "@/lib/matchmaking/types";
import type { KeptLineup } from "@/lib/rounds/lineup-seed";

/**
 * The lineup of a started round, for sending it back to setup with Edit Lineup.
 * Pickup games (courts past the session's court count) are left out: they were
 * added on top of the round, not part of its lineup.
 */
export function keptLineupFromRound(round: StartedRoundRecord, courtCount: number): KeptLineup {
  const courts = round.matches
    .filter((match) => match.courtNumber <= courtCount)
    .toSorted((a, b) => a.courtNumber - b.courtNumber)
    .map((match) => {
      const players = round.matchPlayers.filter((mp) => mp.matchId === match.id);
      return {
        courtNumber: match.courtNumber,
        team1: players.filter((mp) => mp.team === 1).map((mp) => mp.playerId),
        team2: players.filter((mp) => mp.team === 2).map((mp) => mp.playerId),
      };
    });
  const onCourt = new Set(courts.flatMap((court) => [...court.team1, ...court.team2]));
  const sitting = [...new Set(round.sits.map((sit) => sit.playerId))].filter((id) => !onCourt.has(id));
  return { courts, sitting };
}

/** A kept lineup shown as the round's proposal, so setup starts from it unchanged. */
export function proposalFromKeptLineup(lineup: KeptLineup, seed: number): RoundProposal {
  const courts: CourtAssignment[] = lineup.courts.map((court) => {
    const team1 = court.team1 as unknown as Team;
    const team2 = court.team2 as unknown as Team;
    const size = team1.length + team2.length;
    const matchType = size === 4 ? "doubles" : size === 3 ? "team-vs-one" : "singles";
    return { courtNumber: court.courtNumber, team1, team2, matchType };
  });
  return {
    seed,
    score: 0,
    scoreBreakdown: {
      playingTime: 0,
      consecutiveSit: 0,
      partnerRepeat: 0,
      skillBalance: 0,
      opponentRepeat: 0,
      tieBreak: 0,
      total: 0,
    },
    courts,
    sitting: [...lineup.sitting],
  };
}

/** What Edit Lineup clears, for its confirmation. Only asked when something would be lost. */
export function editLineupWarning(savedScores: number, pickupGames: number): string {
  const lost = [
    savedScores > 0 ? `${savedScores} saved ${savedScores === 1 ? "score" : "scores"}` : null,
    pickupGames > 0 ? `${pickupGames} pickup ${pickupGames === 1 ? "game" : "games"}` : null,
  ].filter(Boolean);
  const cleared = lost.length > 0 ? ` This round's ${lost.join(" and ")} will be cleared.` : "";
  return `The round goes back to setup with the same matchups, so you can move players and start it again.${cleared}`;
}
