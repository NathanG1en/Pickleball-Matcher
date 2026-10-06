import { describe, expect, it } from "vitest";

import { replayRatings } from "@/lib/domain/rating-replay";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

const players = ["a", "b", "c", "d"].map((id) => ({
  id,
  groupId: "group-1",
  name: id.toUpperCase(),
  initialRating: 1_000,
  rating: 1_000,
  ratedGamesPlayed: 0,
  active: true,
}));

function replayMatch(
  id: string,
  completedAt: string,
  winner: 1 | 2,
) {
  return {
    id,
    groupId: "group-1",
    status: "completed" as const,
    completedAt: new Date(completedAt),
    team1: ["a", "b"] as const,
    team2: ["c", "d"] as const,
    team1Score: winner === 1 ? 11 : 7,
    team2Score: winner === 2 ? 11 : 7,
  };
}

describe("replayRatings", () => {
  it("uses completion time then match ID for a stable chronological order", async () => {
    const repository = new InMemoryRepositories({
      players,
      replayMatches: [
        replayMatch("match-b", "2026-10-06T12:00:00.000Z", 1),
        replayMatch("match-a", "2026-10-06T12:00:00.000Z", 2),
        replayMatch("match-c", "2026-10-06T12:05:00.000Z", 1),
      ],
    });

    const result = await replayRatings("group-1", repository);

    expect(result.processedMatchIds).toEqual(["match-a", "match-b", "match-c"]);
  });

  it("recalculates later snapshots after an early edit and cancellation", async () => {
    const repository = new InMemoryRepositories({
      players,
      replayMatches: [
        replayMatch("match-1", "2026-10-06T12:00:00.000Z", 1),
        replayMatch("match-2", "2026-10-06T12:05:00.000Z", 1),
        replayMatch("match-3", "2026-10-06T12:10:00.000Z", 2),
      ],
    });
    await replayRatings("group-1", repository);
    const before = structuredClone(repository.state.ratingSnapshots.get("match-3"));
    repository.state.replayMatches = [
      replayMatch("match-1", "2026-10-06T12:00:00.000Z", 2),
      { ...replayMatch("match-2", "2026-10-06T12:05:00.000Z", 1), status: "cancelled" },
      replayMatch("match-3", "2026-10-06T12:10:00.000Z", 2),
    ];

    const result = await replayRatings("group-1", repository);

    expect(result.processedMatchIds).toEqual(["match-1", "match-3"]);
    expect(repository.state.ratingSnapshots.get("match-3")).not.toEqual(before);
    expect(repository.state.players.map((player) => player.ratedGamesPlayed)).toEqual([2, 2, 2, 2]);
  });

  it("is idempotent when authoritative match history has not changed", async () => {
    const repository = new InMemoryRepositories({
      players,
      replayMatches: [
        replayMatch("match-1", "2026-10-06T12:00:00.000Z", 1),
        replayMatch("match-2", "2026-10-06T12:05:00.000Z", 2),
      ],
    });

    await replayRatings("group-1", repository);
    const first = structuredClone({
      players: repository.state.players,
      snapshots: [...repository.state.ratingSnapshots],
    });
    await replayRatings("group-1", repository);

    expect({
      players: repository.state.players,
      snapshots: [...repository.state.ratingSnapshots],
    }).toEqual(first);
  });
});
