import { describe, expect, it } from "vitest";

import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import { generateRound } from "@/lib/matchmaking/generate-round";
import { makePlayers } from "@/test-support/factories";

const TEST_CONFIG = { ...DEFAULT_MATCHMAKING_CONFIG, iterations: 120 };

describe("generateRound", () => {
  it.each([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 24])(
    "assigns every one of %i players exactly once",
    (playerCount) => {
      const players = makePlayers(playerCount);
      const courts = playerCount % 4 === 0 ? playerCount / 4 + 2 : 3;
      const result = generateRound({
        players,
        courts,
        pairHistory: [],
        config: TEST_CONFIG,
        seed: playerCount,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const expectedDoublesCourts = Math.min(Math.floor(playerCount / 4), courts);
      const leftovers = playerCount - expectedDoublesCourts * 4;
      const expectedSinglesCourts =
        leftovers >= 2 && courts - expectedDoublesCourts >= 1 ? 1 : 0;
      const expectedCourts = expectedDoublesCourts + expectedSinglesCourts;
      const expectedSitting =
        playerCount - (expectedDoublesCourts * 4 + expectedSinglesCourts * 2);

      expect(result.value.courts).toHaveLength(expectedCourts);
      expect(result.value.sitting).toHaveLength(expectedSitting);
      const assigned = result.value.courts.flatMap((court) => [
        ...court.team1,
        ...court.team2,
      ]);
      const allIds = [...assigned, ...result.value.sitting];

      expect(new Set(allIds).size).toBe(playerCount);
      expect(new Set(allIds)).toEqual(new Set(players.map((player) => player.id)));
      for (const court of result.value.courts) {
        if (court.matchType === "singles") {
          expect(new Set([...court.team1, ...court.team2]).size).toBe(2);
        } else {
          expect(new Set([...court.team1, ...court.team2]).size).toBe(4);
        }
      }
    },
  );

  it("does not use more courts than the players require", () => {
    const result = generateRound({
      players: makePlayers(8),
      courts: 4,
      pairHistory: [],
      config: TEST_CONFIG,
      seed: 8,
    });

    expect(result.ok && result.value.courts).toHaveLength(2);
  });

  it("creates a singles match on leftover court when 6 players on 2 courts", () => {
    const result = generateRound({
      players: makePlayers(6),
      courts: 2,
      pairHistory: [],
      config: TEST_CONFIG,
      seed: 42,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.courts).toHaveLength(2);
    expect(result.value.courts[0].matchType).toBe("doubles");
    expect(result.value.courts[1].matchType).toBe("singles");
    expect(result.value.sitting).toHaveLength(0);
  });

  it("plays configured 2v1 courts and sits out unassigned players", () => {
    const players = makePlayers(7);
    const result = generateRound({
      players,
      courts: 2,
      courtPlayerCounts: [4, 2],
      pairHistory: [],
      config: TEST_CONFIG,
      seed: 42,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.courts.map((court) => court.team1.length + court.team2.length)).toEqual([4, 2]);
    expect(result.value.courts[1].matchType).toBe("singles");
    expect(result.value.sitting).toHaveLength(1);
    expect(new Set([
      ...result.value.courts.flatMap((court) => [...court.team1, ...court.team2]),
      ...result.value.sitting,
    ])).toEqual(new Set(players.map((player) => player.id)));
  });

  it("marks three-player courts as scored team-vs-one assignments", () => {
    const result = generateRound({
      players: makePlayers(3),
      courts: 1,
      courtPlayerCounts: [3],
      pairHistory: [],
      config: TEST_CONFIG,
      seed: 43,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.courts[0].matchType).toBe("team-vs-one");
    expect(result.value.courts[0].team1.length + result.value.courts[0].team2.length).toBe(3);
  });

  it("reproduces a round from the same input and seed", () => {
    const input = {
      players: makePlayers(14),
      courts: 3,
      pairHistory: [],
      config: TEST_CONFIG,
      seed: 4242,
    };

    expect(generateRound(input)).toEqual(generateRound(input));
  });

  it("returns a typed error when fewer than two players are present", () => {
    const result = generateRound({
      players: makePlayers(1),
      courts: 1,
      pairHistory: [],
      config: TEST_CONFIG,
      seed: 1,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INSUFFICIENT_PLAYERS",
        message: "At least 2 players are required.",
      },
    });
  });

  it("returns a typed error when fewer than four players are present and singles is disabled", () => {
    const result = generateRound({
      players: makePlayers(3),
      courts: 1,
      pairHistory: [],
      config: TEST_CONFIG,
      seed: 3,
      allowSingles: false,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INSUFFICIENT_PLAYERS",
        message: "At least 4 players are required for doubles.",
      },
    });
  });

  it("returns a typed error for an invalid court count", () => {
    const result = generateRound({
      players: makePlayers(4),
      courts: 0,
      pairHistory: [],
      config: TEST_CONFIG,
      seed: 4,
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe("INVALID_COURT_COUNT");
  });

  it("avoids placing players who previously played 2v1 back onto a 2v1 court when fresh players are available", () => {
    // 7 players, 2 courts: court 1 has 4 players (doubles), court 2 has 3 players (2v1)
    // player-1, player-2, player-3 previously played 2v1 (timesPlayed2v1: 1)
    const players = makePlayers(7, (i) => ({
      gamesPlayed: 1,
      eligibleRounds: 1,
      timesPlayed2v1: i < 3 ? 1 : 0,
    }));
    const result = generateRound({
      players,
      courts: 2,
      courtPlayerCounts: [4, 3],
      pairHistory: [],
      config: TEST_CONFIG,
      seed: 99,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const twoVsOneCourt = result.value.courts.find((c) => c.matchType === "team-vs-one");
    expect(twoVsOneCourt).toBeDefined();
    const twoVsOnePlayers = [...twoVsOneCourt!.team1, ...twoVsOneCourt!.team2];
    for (const prior2v1Id of ["player-1", "player-2", "player-3"]) {
      expect(twoVsOnePlayers).not.toContain(prior2v1Id);
    }
  });

  it("produces valid rounds under varying temperature settings", () => {
    const players = makePlayers(8);
    const zeroTemp = generateRound({
      players,
      courts: 2,
      pairHistory: [],
      config: TEST_CONFIG,
      seed: 1234,
      temperature: 0,
    });
    const highTemp = generateRound({
      players,
      courts: 2,
      pairHistory: [],
      config: TEST_CONFIG,
      seed: 1234,
      temperature: 1.0,
    });

    expect(zeroTemp.ok).toBe(true);
    expect(highTemp.ok).toBe(true);
    if (!zeroTemp.ok || !highTemp.ok) return;

    expect(zeroTemp.value.courts).toHaveLength(2);
    expect(highTemp.value.courts).toHaveLength(2);
    // Both allocate all 8 players exactly once
    const zeroAssigned = zeroTemp.value.courts.flatMap((c) => [...c.team1, ...c.team2]);
    const highAssigned = highTemp.value.courts.flatMap((c) => [...c.team1, ...c.team2]);
    expect(new Set(zeroAssigned).size).toBe(8);
    expect(new Set(highAssigned).size).toBe(8);
  });
});
