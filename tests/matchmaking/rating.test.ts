import { describe, expect, it } from "vitest";

import { expectedScore, kFactor, rateMatch, teamRating } from "@/lib/matchmaking/rating";

describe("Elo helpers", () => {
  it("gives equal teams an even expected result", () => {
    expect(expectedScore(1_000, 1_000)).toBe(0.5);
  });

  it("gives the higher-rated team the expected advantage", () => {
    expect(expectedScore(1_200, 1_000)).toBeCloseTo(0.7597469266479578, 12);
    expect(expectedScore(1_000, 1_200)).toBeCloseTo(0.2402530733520421, 12);
  });

  it("uses the provisional K-factor for exactly the first ten rated games", () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(9)).toBe(40);
    expect(kFactor(10)).toBe(20);
  });

  it("averages both teammates for the team rating", () => {
    expect(teamRating([1_100, 900])).toBe(1_000);
  });
});

describe("rateMatch", () => {
  it("applies equal and opposite deltas when equally experienced teams are equal", () => {
    const updates = rateMatch({
      team1: [
        { id: "a", rating: 1_000, ratedGames: 10 },
        { id: "b", rating: 1_000, ratedGames: 10 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 10 },
        { id: "d", rating: 1_000, ratedGames: 10 },
      ],
      winner: 1,
    });

    expect(updates.map((update) => update.delta)).toEqual([10, 10, -10, -10]);
    expect(updates.map((update) => update.ratingAfter)).toEqual([1_010, 1_010, 990, 990]);
  });

  it("rewards an underdog upset more than an expected win", () => {
    const favoriteWins = rateMatch({
      team1: [
        { id: "a", rating: 1_200, ratedGames: 10 },
        { id: "b", rating: 1_200, ratedGames: 10 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 10 },
        { id: "d", rating: 1_000, ratedGames: 10 },
      ],
      winner: 1,
    });
    const underdogWins = rateMatch({
      team1: [
        { id: "a", rating: 1_200, ratedGames: 10 },
        { id: "b", rating: 1_200, ratedGames: 10 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 10 },
        { id: "d", rating: 1_000, ratedGames: 10 },
      ],
      winner: 2,
    });

    expect(favoriteWins[0].delta).toBeCloseTo(4.805061467040844, 12);
    expect(underdogWins[2].delta).toBeCloseTo(15.194938532959156, 12);
  });

  it("uses one averaged team K-factor for mixed-experience teammates", () => {
    const updates = rateMatch({
      team1: [
        { id: "new", rating: 1_000, ratedGames: 3 },
        { id: "established", rating: 1_000, ratedGames: 30 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 10 },
        { id: "d", rating: 1_000, ratedGames: 10 },
      ],
      winner: 1,
    });

    expect(updates[0].delta).toBe(15);
    expect(updates[1].delta).toBe(15);
    expect(updates[0].ratingAfter).toBe(1_015);
    expect(updates[1].ratingAfter).toBe(1_015);
  });

  it("preserves fractional rating precision", () => {
    const updates = rateMatch({
      team1: [
        { id: "a", rating: 1_200, ratedGames: 10 },
        { id: "b", rating: 1_200, ratedGames: 10 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 10 },
        { id: "d", rating: 1_000, ratedGames: 10 },
      ],
      winner: 2,
    });

    expect(Number.isInteger(updates[0].ratingAfter)).toBe(false);
    expect(updates[0].ratingBefore).toBe(1_200);
    expect(updates[0].ratingAfter).toBeCloseTo(1_184.8050614670408, 12);
  });
});
