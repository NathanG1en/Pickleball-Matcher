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
});
