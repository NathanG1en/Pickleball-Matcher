import type { DomainRepository } from "@/lib/domain/repositories";

/** Hand-authored snapshots: an older empty session must not inherit a later rating. */
export async function seedRatingHistory(repository: DomainRepository) {
  await repository.createPlayerAccount({ id: "history-account", username: "history_player", name: "History Player", initialRating: 1000, rating: 1120, ratedGamesPlayed: 2,
    passwordHash: "fixture", skillLevel: "intermediate", createdAt: new Date("2026-10-01T00:00:00Z") });
  for (const groupId of ["history-a", "history-b"]) {
    await repository.insertGroup({ id: groupId, name: groupId, organizerPinHash: "fixture", createdAt: new Date("2026-10-01T00:00:00Z") });
    await repository.createPlayer({ id: `${groupId}-player`, groupId, accountId: "history-account", name: "History Player", initialRating: 1000, rating: 1120, ratedGamesPlayed: 2, active: true });
    for (let i = 1; i <= 3; i++) await repository.createPlayer({ id: `${groupId}-guest-${i}`, groupId, name: `Guest ${i}`, initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true });
  }
  const definitions = [
    { id: "before", groupId: "history-a", day: 1 },
    { id: "played", groupId: "history-a", day: 2, rating: 1068.3274659182405 },
    { id: "empty", groupId: "history-a", day: 3 },
    { id: "cross-group", groupId: "history-b", day: 4 },
    { id: "unrated", groupId: "history-b", day: 5, rated: false },
    { id: "future", groupId: "history-a", day: 6, rating: 1120 },
    { id: "latest-empty", groupId: "history-a", day: 7 },
  ];
  for (const definition of definitions) {
    const startedAt = new Date(`2026-10-0${definition.day}T08:00:00Z`);
    const completedAt = new Date(`2026-10-0${definition.day}T09:00:00Z`);
    await repository.insertSession({ id: definition.id, groupId: definition.groupId, courtCount: 1, status: definition.id === "latest-empty" ? "active" : "completed", currentRoundNumber: 1, version: 1,
      startedAt, endedAt: definition.id === "latest-empty" ? null : completedAt }, [{ sessionId: definition.id, playerId: `${definition.groupId}-player`, joinedRound: 1, leftRound: null }]);
    if (definition.rating !== undefined || definition.rated === false) {
      const matchId = `${definition.id}-match`;
      const roundId = `${definition.id}-round`;
      await repository.insertStartedRound({
        round: { id: roundId, sessionId: definition.id, roundNumber: 1, status: "completed", seed: 1, version: 1, createdAt: startedAt, startedAt, completedAt,
          scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 } },
        matches: [{ id: matchId, roundId, courtNumber: 1, status: "completed", team1Score: 11, team2Score: 7, completedAt, version: 1, rated: definition.rated ?? true }],
        matchPlayers: [`${definition.groupId}-player`, ...[1, 2, 3].map(i => `${definition.groupId}-guest-${i}`)].map((playerId, index) => ({ matchId, playerId, team: index < 2 ? 1 as const : 2 as const,
          ratingBefore: index === 0 && definition.rating !== undefined ? 1000 : null, ratingAfter: index === 0 ? definition.rating ?? null : null })),
        sits: [],
      });
    }
  }
}

export const expectedHistoryRatings = {
  before: 1000,
  played: 1068.3274659182405,
  empty: 1068.3274659182405,
  "cross-group": 1068.3274659182405,
  unrated: 1068.3274659182405,
  future: 1120,
  "latest-empty": 1120,
};
