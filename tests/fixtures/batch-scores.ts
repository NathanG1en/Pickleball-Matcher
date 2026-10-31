import type { DomainRepository } from "@/lib/domain/repositories";
import type { MatchRecord, RoundRecord } from "@/lib/domain/types";

export const batchNow = new Date("2026-10-31T12:00:00Z");
const breakdown = { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 };

export async function seedBatchScores(repository: DomainRepository, courts = 4) {
  await repository.insertGroup({ id: "batch-group", name: "Batch Scores", organizerPinHash: "fixture", createdAt: batchNow });
  const playerIds = Array.from({ length: courts * 4 }, (_, i) => `batch-player-${i}`);
  for (const [i, id] of playerIds.entries()) {
    await repository.createPlayerAccount({ id: `batch-account-${i}`, username: `batch_${i}`, name: id, passwordHash: "fixture", initialRating: 1000, skillLevel: "intermediate", createdAt: batchNow });
    await repository.createPlayer({ id, accountId: `batch-account-${i}`, groupId: "batch-group", name: id, initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true });
  }
  await repository.insertSession({ id: "batch-session", groupId: "batch-group", courtCount: courts, status: "active", currentRoundNumber: 1, startedAt: batchNow, endedAt: null, version: 1 },
    playerIds.map(playerId => ({ sessionId: "batch-session", playerId, joinedRound: 1, leftRound: null })));
  const round: RoundRecord = { id: "batch-round", sessionId: "batch-session", roundNumber: 1, status: "started", seed: 1, scoreBreakdown: breakdown, createdAt: batchNow, startedAt: batchNow, completedAt: null, version: 1 };
  const matches: MatchRecord[] = Array.from({ length: courts }, (_, i) => ({ id: `batch-match-${i}`, roundId: round.id, courtNumber: i + 1, status: "pending", team1Score: null, team2Score: null, completedAt: null, version: 1, rated: true }));
  await repository.insertStartedRound({ round, matches, matchPlayers: matches.flatMap((match, court) => [0, 1, 2, 3].map(i => ({ matchId: match.id, playerId: playerIds[court * 4 + i], team: i < 2 ? 1 as const : 2 as const, ratingBefore: null, ratingAfter: null }))), sits: [] });
  return { matches, round, inputs: matches.map(match => ({ matchId: match.id, team1Score: 11, team2Score: 7, matchVersion: 1 })) };
}

export async function addOtherSessionMatch(repository: DomainRepository, foreignGroup = false) {
  const groupId = foreignGroup ? "other-group" : "batch-group";
  if (foreignGroup) await repository.insertGroup({ id: groupId, name: groupId, organizerPinHash: "fixture", createdAt: batchNow });
  await repository.insertSession({ id: "other-session", groupId, courtCount: 1, status: "active", currentRoundNumber: 1, startedAt: batchNow, endedAt: null, version: 1 }, []);
  await repository.insertStartedRound({ round: { id: "other-round", sessionId: "other-session", roundNumber: 1, status: "started", seed: 1, scoreBreakdown: breakdown, createdAt: batchNow, startedAt: batchNow, completedAt: null, version: 1 }, matches: [{ id: "other-match", roundId: "other-round", courtNumber: 1, status: "pending", team1Score: null, team2Score: null, completedAt: null, version: 1, rated: true }], matchPlayers: [], sits: [] });
}
