import type { MatchPlayerRecord, StartedRoundRecord } from "@/lib/domain/types";

export interface ClosestGame {
  readonly id: string;
  readonly roundNumber: number;
  readonly courtNumber: number;
  readonly team1Score: number;
  readonly team2Score: number;
  readonly team1: readonly string[];
  readonly team2: readonly string[];
}

interface SharedLead {
  readonly count: number;
  readonly playerIds: readonly string[];
}

function sharedLead(counts: ReadonlyMap<string, number>): SharedLead | null {
  let count = 0;
  let playerIds: string[] = [];
  for (const [playerId, value] of counts) {
    if (value > count) {
      count = value;
      playerIds = [playerId];
    } else if (value === count && value > 0) {
      playerIds.push(playerId);
    }
  }
  return count > 0 ? { count, playerIds: playerIds.sort() } : null;
}

/** Derive the recap from saved scores, including optimistic corrections and deletions. */
export function getSessionHighlights(
  rounds: readonly StartedRoundRecord[],
  excludedMatchIds?: ReadonlySet<string>,
) {
  let completedGames = 0;
  let closestMargin = Infinity;
  let closestGames: ClosestGame[] = [];
  const wins = new Map<string, number>();
  const partners = new Map<string, Set<string>>();

  for (const { round, matches, matchPlayers } of rounds) {
    if (round.status === "cancelled") continue;
    const playersByMatch = new Map<string, MatchPlayerRecord[]>();
    for (const player of matchPlayers ?? []) {
      const entries = playersByMatch.get(player.matchId) ?? [];
      entries.push(player);
      playersByMatch.set(player.matchId, entries);
    }

    for (const match of matches) {
      const { team1Score, team2Score } = match;
      if (
        match.status !== "completed" || excludedMatchIds?.has(match.id) ||
        team1Score === null || team2Score === null ||
        !Number.isInteger(team1Score) || !Number.isInteger(team2Score) ||
        team1Score < 0 || team2Score < 0 || team1Score === team2Score
      ) continue;

      completedGames++;
      const participants = playersByMatch.get(match.id) ?? [];
      const team1 = participants.filter(p => p.team === 1).map(p => p.playerId);
      const team2 = participants.filter(p => p.team === 2).map(p => p.playerId);
      const margin = Math.abs(team1Score - team2Score);
      const game: ClosestGame = {
        id: match.id, roundNumber: round.roundNumber, courtNumber: match.courtNumber,
        team1Score, team2Score, team1, team2,
      };
      if (margin < closestMargin) {
        closestMargin = margin;
        closestGames = [game];
      } else if (margin === closestMargin) {
        closestGames.push(game);
      }

      const winners = team1Score > team2Score ? team1 : team2;
      for (const playerId of new Set(winners)) {
        wins.set(playerId, (wins.get(playerId) ?? 0) + 1);
      }

      // Singles and uneven teams do not count as doubles partnerships.
      if (team1.length === 2 && team2.length === 2 && new Set([...team1, ...team2]).size === 4) {
        for (const [a, b] of [team1, team2]) {
          const aPartners = partners.get(a) ?? new Set<string>();
          const bPartners = partners.get(b) ?? new Set<string>();
          aPartners.add(b);
          bPartners.add(a);
          partners.set(a, aPartners);
          partners.set(b, bPartners);
        }
      }
    }
  }

  closestGames.sort((a, b) => a.roundNumber - b.roundNumber || a.courtNumber - b.courtNumber || a.id.localeCompare(b.id));
  return {
    completedGames,
    closestGames,
    mostWins: sharedLead(wins),
    mostPartners: sharedLead(new Map([...partners].map(([id, teammates]) => [id, teammates.size]))),
  };
}
