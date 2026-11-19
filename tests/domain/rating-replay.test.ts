import { describe, expect, it } from "vitest";

import { calculateRatingReplay, replayRatings } from "@/lib/domain/rating-replay";
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
  it("calculates the same replay without writing or mutating the input", async () => {
    const matches = [replayMatch("match-1", "2026-10-06T12:00:00.000Z", 1)];
    const original = structuredClone({ players, matches });
    const calculated = calculateRatingReplay(players, matches);
    expect({ players, matches }).toEqual(original);
    const repository = new InMemoryRepositories({ players, replayMatches: matches });
    await replayRatings("group-1", repository);
    expect(calculated.players.map(p => p.rating)).toEqual(repository.state.players.map(p => p.rating));
    expect(calculated.snapshots).toEqual(repository.state.ratingSnapshots);
    expect(calculated.processedMatchIds).toEqual(["match-1"]);
  });
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

  it("maintains a unified rating across multiple groups for a player account", async () => {
    const repository = new InMemoryRepositories({
      playerAccounts: [
        {
          id: "account-user-1",
          username: "alice",
          name: "Alice",
          passwordHash: "hash",
          skillLevel: "intermediate",
          initialRating: 1_000,
          rating: 1_000,
          ratedGamesPlayed: 0,
          createdAt: new Date(),
        },
      ],
      players: [
        // Alice in Group 1
        {
          id: "p1-alice",
          groupId: "group-1",
          accountId: "account-user-1",
          name: "Alice",
          initialRating: 1_000,
          rating: 1_000,
          ratedGamesPlayed: 0,
          active: true,
        },
        // Alice in Group 2
        {
          id: "p2-alice",
          groupId: "group-2",
          accountId: "account-user-1",
          name: "Alice",
          initialRating: 1_000,
          rating: 1_000,
          ratedGamesPlayed: 0,
          active: true,
        },
        // Group 1 other players
        { id: "b1", groupId: "group-1", name: "B", initialRating: 1_000, rating: 1_000, ratedGamesPlayed: 0, active: true },
        { id: "c1", groupId: "group-1", name: "C", initialRating: 1_000, rating: 1_000, ratedGamesPlayed: 0, active: true },
        { id: "d1", groupId: "group-1", name: "D", initialRating: 1_000, rating: 1_000, ratedGamesPlayed: 0, active: true },
        // Group 2 other players
        { id: "b2", groupId: "group-2", name: "B2", initialRating: 1_000, rating: 1_000, ratedGamesPlayed: 0, active: true },
        { id: "c2", groupId: "group-2", name: "C2", initialRating: 1_000, rating: 1_000, ratedGamesPlayed: 0, active: true },
        { id: "d2", groupId: "group-2", name: "D2", initialRating: 1_000, rating: 1_000, ratedGamesPlayed: 0, active: true },
      ],
      replayMatches: [
        // Alice plays in group-1 and wins
        {
          id: "m-g1-1",
          groupId: "group-1",
          status: "completed",
          completedAt: new Date("2026-10-06T12:00:00.000Z"),
          team1: ["p1-alice", "b1"],
          team2: ["c1", "d1"],
          team1Score: 11,
          team2Score: 5,
        },
      ],
    });

    await replayRatings("group-1", repository);

    // Check account rating
    const account = await repository.getPlayerAccount("account-user-1");
    expect(account?.rating).toBeGreaterThan(1_000);
    expect(account?.ratedGamesPlayed).toBe(1);

    // Group 1 player record
    const g1Players = await repository.listPlayers("group-1");
    const aliceG1 = g1Players.find((p) => p.id === "p1-alice");
    expect(aliceG1?.rating).toBe(account?.rating);
    expect(aliceG1?.ratedGamesPlayed).toBe(1);

    // Group 2 player record should also reflect the same rating
    const g2Players = await repository.listPlayers("group-2");
    const aliceG2 = g2Players.find((p) => p.id === "p2-alice");
    expect(aliceG2?.rating).toBe(account?.rating);
    expect(aliceG2?.ratedGamesPlayed).toBe(1);

    // Now, if Alice plays in group-2, her rating progresses further and syncs back
    repository.state.replayMatches.push({
      id: "m-g2-1",
      groupId: "group-2",
      status: "completed",
      completedAt: new Date("2026-10-06T13:00:00.000Z"),
      team1: ["p2-alice", "b2"],
      team2: ["c2", "d2"],
      team1Score: 11,
      team2Score: 7,
    });

    await replayRatings("group-2", repository);

    const updatedAccount = await repository.getPlayerAccount("account-user-1");
    expect(updatedAccount?.rating).toBeGreaterThan(account!.rating!);
    expect(updatedAccount?.ratedGamesPlayed).toBe(2);

    const updatedG1Alice = (await repository.listPlayers("group-1")).find((p) => p.id === "p1-alice");
    const updatedG2Alice = (await repository.listPlayers("group-2")).find((p) => p.id === "p2-alice");
    expect(updatedG1Alice?.rating).toBe(updatedAccount?.rating);
    expect(updatedG2Alice?.rating).toBe(updatedAccount?.rating);
  });

  it("excludes singles (1v1) and team-vs-one (2v1) matches from rating updates and snapshots", () => {
    const mixedHistory = [
      {
        id: "match-singles",
        groupId: "group-1",
        status: "completed" as const,
        completedAt: new Date("2026-10-06T12:00:00.000Z"),
        team1: ["a"],
        team2: ["c"],
        team1Score: 11,
        team2Score: 7,
      },
      {
        id: "match-2v1",
        groupId: "group-1",
        status: "completed" as const,
        completedAt: new Date("2026-10-06T12:05:00.000Z"),
        team1: ["a", "b"],
        team2: ["c"],
        team1Score: 11,
        team2Score: 7,
      },
    ];

    const replay = calculateRatingReplay(players, mixedHistory);

    expect(replay.snapshots.has("match-singles")).toBe(false);
    expect(replay.snapshots.has("match-2v1")).toBe(false);
    expect(replay.players.every((p) => p.rating === 1_000)).toBe(true);
    expect(replay.players.every((p) => p.ratedGamesPlayed === 0)).toBe(true);
  });

  it("incorporates score margin into rating replay deltas", () => {
    const blowoutMatch = {
      id: "blowout",
      groupId: "group-1",
      status: "completed" as const,
      completedAt: new Date("2026-10-06T12:00:00.000Z"),
      team1: ["a", "b"] as const,
      team2: ["c", "d"] as const,
      team1Score: 11,
      team2Score: 0,
    };
    const narrowMatch = {
      id: "narrow",
      groupId: "group-1",
      status: "completed" as const,
      completedAt: new Date("2026-10-06T12:00:00.000Z"),
      team1: ["a", "b"] as const,
      team2: ["c", "d"] as const,
      team1Score: 11,
      team2Score: 9,
    };

    const blowoutReplay = calculateRatingReplay(players, [blowoutMatch]);
    const narrowReplay = calculateRatingReplay(players, [narrowMatch]);

    const blowoutWinnerRating = blowoutReplay.players.find((p) => p.id === "a")!.rating;
    const narrowWinnerRating = narrowReplay.players.find((p) => p.id === "a")!.rating;

    expect(blowoutWinnerRating).toBeGreaterThan(narrowWinnerRating);
  });

  it("tracks inactivity across matches without moving ratings during inactivity", () => {
    const match1 = {
      id: "match-1",
      groupId: "group-1",
      status: "completed" as const,
      completedAt: new Date("2026-06-01T12:00:00.000Z"),
      team1: ["a", "b"] as const,
      team2: ["c", "d"] as const,
      team1Score: 11,
      team2Score: 7,
    };
    // 90 days later: players return
    const match2 = {
      id: "match-2",
      groupId: "group-1",
      status: "completed" as const,
      completedAt: new Date("2026-08-30T12:00:00.000Z"),
      team1: ["a", "b"] as const,
      team2: ["c", "d"] as const,
      team1Score: 11,
      team2Score: 7,
    };
    // 30 minutes later on the same day: players play a second match
    const match3 = {
      id: "match-3",
      groupId: "group-1",
      status: "completed" as const,
      completedAt: new Date("2026-08-30T12:30:00.000Z"),
      team1: ["a", "b"] as const,
      team2: ["c", "d"] as const,
      team1Score: 11,
      team2Score: 7,
    };

    const replayAfterMatch1 = calculateRatingReplay(players, [match1]);
    const ratingAfterMatch1 = replayAfterMatch1.players.find((p) => p.id === "a")!.rating;

    // During the 90 days of inactivity, no rating drift occurs (ratings are solely match-driven)
    expect(ratingAfterMatch1).toBe(1_020);

    const fullReplay = calculateRatingReplay(players, [match1, match2, match3]);
    const snapMatch2 = fullReplay.snapshots.get("match-2")!;
    const snapMatch3 = fullReplay.snapshots.get("match-3")!;

    const playerADeltaMatch2 = snapMatch2.find((s) => s.playerId === "a")!.ratingAfter - snapMatch2.find((s) => s.playerId === "a")!.ratingBefore;
    const playerADeltaMatch3 = snapMatch3.find((s) => s.playerId === "a")!.ratingAfter - snapMatch3.find((s) => s.playerId === "a")!.ratingBefore;

    // Match 2 experienced ~90 days of inactivity, so K was boosted by uncertainty
    // Match 3 occurred 30 minutes later (0 days inactive), so K dropped back to base K
    expect(playerADeltaMatch2).toBeGreaterThan(playerADeltaMatch3);
  });

  it("produces strictly identical results regardless of input match order", () => {
    const m1 = replayMatch("match-1", "2026-10-01T12:00:00.000Z", 1);
    const m2 = replayMatch("match-2", "2026-10-02T12:00:00.000Z", 2);
    const m3 = replayMatch("match-3", "2026-10-03T12:00:00.000Z", 1);

    const replayForward = calculateRatingReplay(players, [m1, m2, m3]);
    const replayReverse = calculateRatingReplay(players, [m3, m2, m1]);
    const replayPermuted = calculateRatingReplay(players, [m2, m3, m1]);

    expect(replayForward.players).toEqual(replayReverse.players);
    expect(replayForward.players).toEqual(replayPermuted.players);
    expect([...replayForward.snapshots.entries()]).toEqual([...replayReverse.snapshots.entries()]);
    expect([...replayForward.snapshots.entries()]).toEqual([...replayPermuted.snapshots.entries()]);
  });
});
