import { describe, expect, it } from "vitest";

import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import { candidateKey, generateRound, RESHUFFLE_SCORE_TOLERANCE } from "@/lib/matchmaking/generate-round";
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

  it.each(["automatic", "configured", "stay together"])("rotates previous singles players into doubles with %s courts", (mode) => {
    const participants = makePlayers(6).map((p, i) => ({ ...p, gamesPlayed: 1, eligibleRounds: 1, timesPlayedSingles: i < 2 ? 1 : 0 }));
    for (const seed of [1, 4, 17, 99]) {
      const result = generateRound({
        players: participants, courts: 2, pairHistory: [], config: TEST_CONFIG, seed,
        courtPlayerCounts: mode === "automatic" ? undefined : [4, 2],
        stayTogetherPairs: mode === "stay together" ? [["player-3", "player-4"]] : undefined,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error.message);
      const singles = result.value.courts.find(court => court.team1.length === 1 && court.team2.length === 1);
      expect(singles).toBeDefined();
      expect([...singles!.team1, ...singles!.team2]).not.toContain("player-1");
      expect([...singles!.team1, ...singles!.team2]).not.toContain("player-2");
      if (mode === "stay together") expect(result.value.courts.some(court => [court.team1, court.team2].some(team => team.includes("player-3") && team.includes("player-4")))).toBe(true);
    }
  });


  it("derives a reproducible default seed from singles participation history", () => {
    const input = { players: makePlayers(6), courts: 2, pairHistory: [], config: TEST_CONFIG };
    const original = generateRound(input);
    const historyInput = { ...input, players: input.players.map((p, i) => ({ ...p, timesPlayedSingles: i === 0 ? 1 : 0 })) };
    const withHistory = generateRound(historyInput);
    expect(original.ok).toBe(true);
    expect(withHistory.ok).toBe(true);
    if (!original.ok || !withHistory.ok) throw new Error("Expected valid rounds");
    expect(withHistory.value.seed).not.toBe(original.value.seed);
    expect(generateRound(historyInput)).toEqual(withHistory);
  });

  describe("reshuffle behavior", () => {
    it("produces different lineups with different seeds when alternatives exist, staying within score tolerance", () => {
      const players = makePlayers(8);
      const inputBase = {
        players,
        courts: 2,
        pairHistory: [],
        config: TEST_CONFIG,
      };

      const lineups = new Set<string>();
      const scores: number[] = [];
      const seeds = [10, 42, 99, 1337, 8888, 54321];

      for (const seed of seeds) {
        const result = generateRound({ ...inputBase, seed });
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const key = candidateKey(result.value);
        lineups.add(key);
        scores.push(result.value.score);

        // Verify round is valid: all 8 players allocated once
        const assigned = result.value.courts.flatMap((c) => [...c.team1, ...c.team2]);
        expect(assigned).toHaveLength(8);
        expect(new Set(assigned).size).toBe(8);

        // Verify same seed reproduces the exact same lineup
        const duplicate = generateRound({ ...inputBase, seed });
        expect(duplicate.ok).toBe(true);
        if (!duplicate.ok) return;
        expect(candidateKey(duplicate.value)).toBe(key);
        expect(duplicate.value.score).toBe(result.value.score);
      }

      // Multiple distinct lineups must be generated across the seeds
      expect(lineups.size).toBeGreaterThan(1);

      // All chosen lineups must stay within RESHUFFLE_SCORE_TOLERANCE of the best candidate
      const bestScore = Math.min(...scores);
      for (const score of scores) {
        expect(score).toBeLessThanOrEqual(bestScore + RESHUFFLE_SCORE_TOLERANCE);
      }
    });

    it("returns identical lineup across seeds when only one valid/fair lineup exists", () => {
      const players = makePlayers(2);
      const inputBase = {
        players,
        courts: 1,
        courtPlayerCounts: [2] as const,
        pairHistory: [],
        config: TEST_CONFIG,
      };

      const keys = new Set<string>();
      for (const seed of [1, 2, 3, 4, 5]) {
        const result = generateRound({ ...inputBase, seed });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        keys.add(candidateKey(result.value));
      }

      expect(keys.size).toBe(1);
    });

    it("gives prior singles players the same next-round play priority as physical sitters", () => {
      // 6 players, 2 courts: Court 1 has 4 players (doubles), Court 2 has 2 players (singles)
      // player-1 sat out previously (satPreviousRound: true)
      // player-2 played singles previously (satPreviousRound: true)
      // player-3 through player-6 played doubles (satPreviousRound: false, gamesPlayed: 1)
      const players = makePlayers(6).map((p, i) => {
        if (i === 0) return { ...p, gamesPlayed: 0, eligibleRounds: 1, satPreviousRound: true };
        if (i === 1) return { ...p, gamesPlayed: 0, eligibleRounds: 1, satPreviousRound: true, timesPlayedSingles: 1 };
        return { ...p, gamesPlayed: 1, eligibleRounds: 1, satPreviousRound: false };
      });

      // Both player-1 (prior sitter) and player-2 (prior singles) should play doubles on Court 1
      for (const seed of [1, 7, 21, 42, 99]) {
        const result = generateRound({
          players,
          courts: 2,
          courtPlayerCounts: [4, 2],
          pairHistory: [],
          config: TEST_CONFIG,
          seed,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const doublesCourt = result.value.courts.find((c) => c.matchType === "doubles");
        expect(doublesCourt).toBeDefined();
        const doublesPlayers = [...doublesCourt!.team1, ...doublesCourt!.team2];
        expect(doublesPlayers).toContain("player-1");
        expect(doublesPlayers).toContain("player-2");

        const singlesCourt = result.value.courts.find((c) => c.matchType === "singles");
        expect(singlesCourt).toBeDefined();
        const singlesPlayers = [...singlesCourt!.team1, ...singlesCourt!.team2];
        expect(singlesPlayers).not.toContain("player-1");
        expect(singlesPlayers).not.toContain("player-2");
      }
    });
  });
});
