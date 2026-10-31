import type { DomainRepository } from "@/lib/domain/repositories";
import type { PlayerRecord, PlayerSynergyRecord, RatingSnapshot, ReplayMatch } from "@/lib/domain/types";
import { calculateRatingReplay } from "@/lib/domain/rating-replay";
import { expectedScore } from "@/lib/matchmaking/rating";
import { updateSynergyState } from "@/lib/synergy/calculator";

/** Rebuild each pair from authoritative matches, never from its previous aggregate. */
export function calculateSynergyReplay(
  players: readonly PlayerRecord[],
  history: readonly ReplayMatch[],
  snapshots: ReadonlyMap<string, readonly RatingSnapshot[]>,
): readonly PlayerSynergyRecord[] {
  const playerMap = new Map(players.map(player => [player.id, player]));
  const pairs = new Map<string, PlayerSynergyRecord>();
  const matches = history.filter(match => match.status === "completed" && match.synergyEligible)
    .toSorted((a, b) => a.completedAt.getTime() - b.completedAt.getTime() || a.id.localeCompare(b.id));
  for (const match of matches) {
    if (match.team1.length !== 2 || match.team2.length !== 2) continue;
    const ratings = new Map((snapshots.get(match.id) ?? []).map(snapshot => [snapshot.playerId, snapshot.ratingBefore]));
    const before = (id: string) => ratings.get(id);
    const [a, b, c, d] = [...match.team1, ...match.team2].map(before);
    // An eligible doubles game must also have a complete rating replay snapshot.
    if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
    const probability = expectedScore((a + b) / 2, (c + d) / 2);
    for (const [team, ownScore, opponentScore, expected] of [
      [match.team1, match.team1Score, match.team2Score, probability],
      [match.team2, match.team2Score, match.team1Score, 1 - probability],
    ] as const) {
      const first = playerMap.get(team[0])?.accountId;
      const second = playerMap.get(team[1])?.accountId;
      if (!first || !second || first === second) continue;
      const [accountId1, accountId2] = [first, second].sort();
      const key = JSON.stringify([accountId1, accountId2]);
      const state = updateSynergyState(pairs.get(key), { won: ownScore > opponentScore,
        expectedWinProbability: expected, ownScore, opponentScore });
      pairs.set(key, { accountId1, accountId2, ...state, updatedAt: match.completedAt });
    }
  }
  return [...pairs.values()];
}

/**
 * Rebuild last in the mutation's transaction. The caller must acquire the same
 * reentrant lock before source/rating writes so concurrent replays lock in order.
 */
export async function replaySynergies(repository: DomainRepository): Promise<void> {
  await repository.lockSynergyState();
  const { players, history, replay } = await loadGlobalReplay(repository);
  await repository.replaceSynergyState(calculateSynergyReplay(players, history, replay.snapshots));
}

/**
 * Rebuild both states from one authoritative, transaction-local calculation.
 * Callers must hold the chemistry lock before changing source matches, just as
 * for replaySynergies. Keep this last, after every source mutation in the tx.
 */
export async function replayRatingsAndSynergies(groupId: string, repository: DomainRepository): Promise<void> {
  await repository.lockSynergyState();
  const { players, history, replay } = await loadGlobalReplay(repository);
  await repository.replaceRatingState(groupId, replay.players, replay.snapshots);
  await repository.replaceSynergyState(calculateSynergyReplay(players, history, replay.snapshots));
}

async function loadGlobalReplay(repository: DomainRepository) {
  const players = await repository.listPlayers(undefined, { includeInactive: true });
  const history = await repository.listReplayMatches();
  return { players, history, replay: calculateRatingReplay(players, history) };
}
