import type { DomainRepository } from "@/lib/domain/repositories";
import type { StartedRoundRecord } from "@/lib/domain/types";

const early = new Date("2026-10-31T08:00:00Z");
const later = new Date("2026-10-31T09:00:00Z");
const finished = new Date("2026-10-31T08:30:00Z");
const score = { playingTime: 1, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 2, opponentRepeat: 0, tieBreak: 0, total: 3 };

export const expectedSessionHistory: readonly StartedRoundRecord[] = [
  {
    round: { id: "z-round-one", sessionId: "history-main", roundNumber: 1, status: "completed", seed: 4294967295, scoreBreakdown: score, createdAt: early, startedAt: early, completedAt: finished, version: 3 },
    matches: [
      { id: "z-completed", roundId: "z-round-one", courtNumber: 1, status: "completed", team1Score: 11, team2Score: 7, completedAt: finished, version: 3, rated: true },
      { id: "a-cancelled", roundId: "z-round-one", courtNumber: 2, status: "cancelled", team1Score: null, team2Score: null, completedAt: null, version: 2, rated: false },
    ],
    matchPlayers: [
      { matchId: "a-cancelled", playerId: "p5", team: 1, ratingBefore: null, ratingAfter: null },
      { matchId: "a-cancelled", playerId: "p6", team: 2, ratingBefore: null, ratingAfter: null },
      { matchId: "z-completed", playerId: "p1", team: 1, ratingBefore: 1000, ratingAfter: 1020 },
      { matchId: "z-completed", playerId: "p2", team: 1, ratingBefore: 1000, ratingAfter: 1020 },
      { matchId: "z-completed", playerId: "p3", team: 2, ratingBefore: 1000, ratingAfter: 980 },
      { matchId: "z-completed", playerId: "p4", team: 2, ratingBefore: 1000, ratingAfter: 980 },
    ],
    sits: [{ roundId: "z-round-one", playerId: "p7" }, { roundId: "z-round-one", playerId: "p8" }],
  },
  {
    round: { id: "a-round-two", sessionId: "history-main", roundNumber: 2, status: "started", seed: 7, scoreBreakdown: score, createdAt: later, startedAt: later, completedAt: null, version: 1 },
    matches: [{ id: "pending", roundId: "a-round-two", courtNumber: 3, status: "pending", team1Score: null, team2Score: null, completedAt: null, version: 4, rated: false }],
    matchPlayers: [{ matchId: "pending", playerId: "p1", team: 1, ratingBefore: null, ratingAfter: null }, { matchId: "pending", playerId: "p8", team: 2, ratingBefore: null, ratingAfter: null }],
    sits: [{ roundId: "a-round-two", playerId: "p2" }, { roundId: "a-round-two", playerId: "p7" }],
  },
  {
    round: { id: "empty-round", sessionId: "history-main", roundNumber: 3, status: "cancelled", seed: 9, scoreBreakdown: score, createdAt: later, startedAt: later, completedAt: null, version: 2 },
    matches: [], matchPlayers: [], sits: [],
  },
];

export async function seedSessionHistory(repository: DomainRepository) {
  await repository.insertGroup({ id: "history-group", name: "History fixture", organizerPinHash: "fixture", createdAt: early });
  for (let i = 1; i <= 8; i++) await repository.createPlayer({ id: `p${i}`, groupId: "history-group", name: `Player ${i}`, initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true });
  for (const id of ["history-main", "history-other", "history-empty", "history-only-empty"]) await repository.insertSession({ id, groupId: "history-group", courtCount: 3, status: "active", currentRoundNumber: id === "history-main" ? 3 : 0, startedAt: early, endedAt: null, version: 1 }, []);
  // Deliberately insert rounds and children out of display order.
  for (const record of [expectedSessionHistory[1], expectedSessionHistory[0], expectedSessionHistory[2]]) {
    await repository.insertStartedRound({ ...record, matches: [...record.matches].reverse(), matchPlayers: [...record.matchPlayers].reverse(), sits: [...record.sits].reverse() });
  }
  await repository.insertStartedRound({
    round: { ...expectedSessionHistory[1].round, id: "foreign-round", sessionId: "history-other", roundNumber: 1 },
    matches: [{ ...expectedSessionHistory[1].matches[0], id: "foreign-match", roundId: "foreign-round" }],
    matchPlayers: [{ matchId: "foreign-match", playerId: "p3", team: 1, ratingBefore: null, ratingAfter: null }],
    sits: [{ roundId: "foreign-round", playerId: "p1" }],
  });
  await repository.insertStartedRound({ ...expectedSessionHistory[2], round: {
    ...expectedSessionHistory[2].round, id: "only-empty-round", sessionId: "history-only-empty", roundNumber: 1,
  } });
}
