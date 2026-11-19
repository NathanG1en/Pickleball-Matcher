import { describe, expect, it } from "vitest";

import {
  BASE_MARGIN,
  INACTIVITY_GRACE_DAYS,
  K_MAX,
  K_MIN,
  MAX_MARGIN_MULTIPLIER,
  MIN_MARGIN_MULTIPLIER,
  expectedScore,
  kFactor,
  rateMatch,
  scoreMarginMultiplier,
  teamRating,
} from "@/lib/matchmaking/rating";

describe("Elo helpers", () => {
  it("gives equal teams an even expected result", () => {
    expect(expectedScore(1_000, 1_000)).toBe(0.5);
  });

  it("gives the higher-rated team the expected advantage", () => {
    expect(expectedScore(1_200, 1_000)).toBeCloseTo(0.7597469266479578, 12);
    expect(expectedScore(1_000, 1_200)).toBeCloseTo(0.2402530733520421, 12);
  });

  it("averages both teammates for the team rating", () => {
    expect(teamRating([1_100, 900])).toBe(1_000);
  });
});

describe("kFactor: gradual decay and bounds", () => {
  it("starts at K_MAX (40) for a brand new player", () => {
    expect(kFactor(0)).toBe(K_MAX);
  });

  it("reduces K gradually without an abrupt 10-game threshold", () => {
    const k0 = kFactor(0);
    const k1 = kFactor(1);
    const k5 = kFactor(5);
    const k9 = kFactor(9);
    const k10 = kFactor(10);
    const k11 = kFactor(11);
    const k20 = kFactor(20);
    const k30 = kFactor(30);

    expect(k0).toBe(40);
    expect(k1).toBeLessThan(k0);
    expect(k5).toBeLessThan(k1);
    expect(k9).toBeLessThan(k5);
    expect(k10).toBeLessThan(k9);
    expect(k11).toBeLessThan(k10);
    expect(k20).toBeLessThan(k11);
    expect(k30).toBeLessThan(k20);

    // Verify there is no cliff between game 9 and 10 (difference should be smooth and gradual)
    expect(Math.abs(k9 - k10)).toBeLessThan(1.5);
    expect(Math.abs(k10 - k11)).toBeLessThan(1.5);
  });

  it("approaches K_MIN (16) for established players with many games", () => {
    expect(kFactor(40)).toBeCloseTo(16.86, 1);
    expect(kFactor(60)).toBeCloseTo(16.16, 1);
    expect(kFactor(100)).toBeCloseTo(16.0, 1);
    expect(kFactor(100)).toBeGreaterThanOrEqual(K_MIN);
  });

  it("keeps base K strictly bounded between K_MIN (16) and K_MAX (40)", () => {
    for (let games = -5; games <= 150; games += 5) {
      const k = kFactor(games);
      expect(k).toBeGreaterThanOrEqual(K_MIN);
      expect(k).toBeLessThanOrEqual(K_MAX);
    }
  });
});

describe("kFactor: recency and inactivity uncertainty", () => {
  it("incurs no uncertainty increase within the 14-day grace period", () => {
    const baseK = kFactor(30);
    expect(kFactor(30, { daysInactive: 0 })).toBe(baseK);
    expect(kFactor(30, { daysInactive: 7 })).toBe(baseK);
    expect(kFactor(30, { daysInactive: INACTIVITY_GRACE_DAYS })).toBe(baseK);
  });

  it("increases responsiveness (K) smoothly with longer inactivity beyond the grace period", () => {
    const baseK = kFactor(30);
    const k20Days = kFactor(30, { daysInactive: 20 });
    const k45Days = kFactor(30, { daysInactive: 45 });
    const k90Days = kFactor(30, { daysInactive: 90 });
    const k180Days = kFactor(30, { daysInactive: 180 });

    expect(k20Days).toBeGreaterThan(baseK);
    expect(k45Days).toBeGreaterThan(k20Days);
    expect(k90Days).toBeGreaterThan(k45Days);
    expect(k180Days).toBeGreaterThan(k90Days);
    expect(k180Days).toBeLessThanOrEqual(K_MAX);
  });

  it("never exceeds K_MAX even after very long periods of inactivity", () => {
    expect(kFactor(30, { daysInactive: 1_000 })).toBeLessThanOrEqual(K_MAX);
    expect(kFactor(0, { daysInactive: 365 })).toBe(K_MAX);
  });

  it("accepts a raw number as the second argument", () => {
    expect(kFactor(30, 45)).toBe(kFactor(30, { daysInactive: 45 }));
  });
});

describe("scoreMarginMultiplier", () => {
  it("returns exactly 1.0 for the baseline margin of 4 (e.g. 11-7 game)", () => {
    expect(scoreMarginMultiplier(11, 7)).toBe(1.0);
    expect(scoreMarginMultiplier(7, 11)).toBe(1.0);
    expect(BASE_MARGIN).toBe(4);
  });

  it("scales down for narrow margins (1-2 points)", () => {
    const narrow2 = scoreMarginMultiplier(11, 9); // margin 2
    const narrow1 = scoreMarginMultiplier(11, 10); // margin 1

    expect(narrow2).toBeCloseTo(0.8689, 3);
    expect(narrow1).toBeCloseTo(0.7759, 3);
    expect(narrow1).toBeLessThan(narrow2);
    expect(narrow2).toBeLessThan(1.0);
    expect(narrow1).toBeGreaterThanOrEqual(MIN_MARGIN_MULTIPLIER);
  });

  it("scales up for blowouts (e.g. 11-0) to MAX_MARGIN_MULTIPLIER (1.25)", () => {
    const blowout = scoreMarginMultiplier(11, 0); // margin 11
    expect(blowout).toBe(1.25);
    expect(blowout).toBe(MAX_MARGIN_MULTIPLIER);
  });

  it("caps the blowout swing so an established player (K=16) cannot exceed the old K=20 system's swing", () => {
    const blowoutMultiplier = scoreMarginMultiplier(11, 0);
    expect(blowoutMultiplier).toBe(1.25);

    // Old system: established K=20, even win swing = 20 * 0.5 = 10.0
    // New system: established K=16, blowout swing = 16 * 1.25 * 0.5 = 10.0
    const oldSwing = 20 * 0.5;
    const newBlowoutSwing = K_MIN * blowoutMultiplier * 0.5;
    expect(newBlowoutSwing).toBe(oldSwing);
  });

  it("exhibits diminishing returns as margin grows", () => {
    const m2 = scoreMarginMultiplier(11, 9); // margin 2
    const m5 = scoreMarginMultiplier(11, 6); // margin 5
    const m8 = scoreMarginMultiplier(11, 3); // margin 8
    const m11 = scoreMarginMultiplier(11, 0); // margin 11

    // Diminishing returns: incremental gain decreases with larger margins
    expect(m5 - m2).toBeGreaterThan(m11 - m8);
  });

  it("clamps to MIN_MARGIN_MULTIPLIER (0.75) and MAX_MARGIN_MULTIPLIER (1.25) bounds", () => {
    expect(scoreMarginMultiplier(100, 0)).toBe(MAX_MARGIN_MULTIPLIER);
    expect(scoreMarginMultiplier(11, 11 - 1)).toBeGreaterThanOrEqual(MIN_MARGIN_MULTIPLIER);
  });

  it("handles missing, negative, non-integer, or tied scores gracefully with 1.0 fallback", () => {
    expect(scoreMarginMultiplier()).toBe(1.0);
    expect(scoreMarginMultiplier(undefined, undefined)).toBe(1.0);
    expect(scoreMarginMultiplier(null, null)).toBe(1.0);
    expect(scoreMarginMultiplier(11, 11)).toBe(1.0); // tied scores
    expect(scoreMarginMultiplier(-1, 5)).toBe(1.0); // negative score
    expect(scoreMarginMultiplier(11.5, 7)).toBe(1.0); // non-integer
  });
});

describe("rateMatch: individualized K factors and rating conservation", () => {
  it("applies individual K factors to teammates rather than an averaged team K", () => {
    const newPlayerGames = 0; // K = 40
    const establishedGames = 40; // K ≈ 20.71
    const opponentGames = 12; // K ≈ 27.36

    const updates = rateMatch({
      team1: [
        { id: "newbie", rating: 1_000, ratedGames: newPlayerGames },
        { id: "veteran", rating: 1_000, ratedGames: establishedGames },
      ],
      team2: [
        { id: "opp1", rating: 1_000, ratedGames: opponentGames },
        { id: "opp2", rating: 1_000, ratedGames: opponentGames },
      ],
      team1Score: 11,
      team2Score: 7, // baseline margin multiplier 1.0
    });

    const [newbieUpdate, veteranUpdate, opp1Update, opp2Update] = updates;

    // Both teammates won against equal team rating (E = 0.5)
    // Newbie gets 40 * (1 - 0.5) * 1.0 = +20
    expect(newbieUpdate.delta).toBeCloseTo(20, 2);
    // Veteran gets kFactor(40) * (1 - 0.5) * 1.0 ≈ 10.36
    expect(veteranUpdate.delta).toBeCloseTo(kFactor(40) * 0.5, 2);
    expect(veteranUpdate.delta).toBeLessThan(newbieUpdate.delta);

    // Opponents lose according to their own K
    expect(opp1Update.delta).toBeCloseTo(-kFactor(12) * 0.5, 2);
    expect(opp2Update.delta).toBeCloseTo(-kFactor(12) * 0.5, 2);

    // Demonstrate rating conservation property: sum of deltas is non-zero when individual uncertainties differ
    const netDelta = updates.reduce((sum, u) => sum + u.delta, 0);
    expect(Math.abs(netDelta)).toBeGreaterThan(0);
  });

  it("conserves total rating points (sum = 0) when all players share equal experience and recency", () => {
    const updates = rateMatch({
      team1: [
        { id: "a", rating: 1_100, ratedGames: 15 },
        { id: "b", rating: 900, ratedGames: 15 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 15 },
        { id: "d", rating: 1_000, ratedGames: 15 },
      ],
      team1Score: 11,
      team2Score: 5,
    });

    const sumDelta = updates.reduce((sum, u) => sum + u.delta, 0);
    expect(sumDelta).toBeCloseTo(0, 10);
  });
});

describe("rateMatch: score margin effects", () => {
  it("awards a larger rating adjustment for a blowout win than a narrow win", () => {
    const narrowMatch = rateMatch({
      team1: [
        { id: "a", rating: 1_000, ratedGames: 20 },
        { id: "b", rating: 1_000, ratedGames: 20 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 20 },
        { id: "d", rating: 1_000, ratedGames: 20 },
      ],
      team1Score: 11,
      team2Score: 9, // narrow margin = 2
    });

    const blowoutMatch = rateMatch({
      team1: [
        { id: "a", rating: 1_000, ratedGames: 20 },
        { id: "b", rating: 1_000, ratedGames: 20 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 20 },
        { id: "d", rating: 1_000, ratedGames: 20 },
      ],
      team1Score: 11,
      team2Score: 0, // blowout margin = 11
    });

    expect(blowoutMatch[0].delta).toBeGreaterThan(narrowMatch[0].delta);
    expect(blowoutMatch[0].delta / narrowMatch[0].delta).toBeCloseTo(
      scoreMarginMultiplier(11, 0) / scoreMarginMultiplier(11, 9),
      5,
    );
  });

  it("determines winner from scores when scores are valid, overriding contradictory winner flags", () => {
    const updates = rateMatch({
      team1: [
        { id: "a", rating: 1_000, ratedGames: 20 },
        { id: "b", rating: 1_000, ratedGames: 20 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 20 },
        { id: "d", rating: 1_000, ratedGames: 20 },
      ],
      team1Score: 7,
      team2Score: 11,
      winner: 1, // Contradictory winner flag, valid scores take precedence
    });

    // Team 2 won (11 > 7)
    expect(updates[0].delta).toBeLessThan(0);
    expect(updates[2].delta).toBeGreaterThan(0);
  });

  it("rewards an underdog upset more than an expected win", () => {
    const favoriteWins = rateMatch({
      team1: [
        { id: "a", rating: 1_200, ratedGames: 20 },
        { id: "b", rating: 1_200, ratedGames: 20 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 20 },
        { id: "d", rating: 1_000, ratedGames: 20 },
      ],
      team1Score: 11,
      team2Score: 7,
    });
    const underdogWins = rateMatch({
      team1: [
        { id: "a", rating: 1_200, ratedGames: 20 },
        { id: "b", rating: 1_200, ratedGames: 20 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 20 },
        { id: "d", rating: 1_000, ratedGames: 20 },
      ],
      team1Score: 7,
      team2Score: 11,
    });

    expect(favoriteWins[0].delta).toBeLessThan(underdogWins[2].delta);
  });

  it("preserves fractional rating precision", () => {
    const updates = rateMatch({
      team1: [
        { id: "a", rating: 1_200, ratedGames: 20 },
        { id: "b", rating: 1_200, ratedGames: 20 },
      ],
      team2: [
        { id: "c", rating: 1_000, ratedGames: 20 },
        { id: "d", rating: 1_000, ratedGames: 20 },
      ],
      team1Score: 7,
      team2Score: 11,
    });

    expect(Number.isInteger(updates[0].ratingAfter)).toBe(false);
    expect(updates[0].ratingBefore).toBe(1_200);
  });
});

describe("rateMatch: recency and inactivity behavior", () => {
  it("gives an inactive player higher responsiveness than an active teammate", () => {
    const matchDate = new Date("2026-10-01T12:00:00Z");
    const recentDate = new Date("2026-09-28T12:00:00Z"); // 3 days ago (active)
    const longAgoDate = new Date("2026-06-01T12:00:00Z"); // 122 days ago (inactive)

    const updates = rateMatch({
      team1: [
        { id: "active", rating: 1_000, ratedGames: 30, lastMatchAt: recentDate },
        { id: "inactive", rating: 1_000, ratedGames: 30, lastMatchAt: longAgoDate },
      ],
      team2: [
        { id: "opp1", rating: 1_000, ratedGames: 30, lastMatchAt: recentDate },
        { id: "opp2", rating: 1_000, ratedGames: 30, lastMatchAt: recentDate },
      ],
      completedAt: matchDate,
      team1Score: 11,
      team2Score: 7,
    });

    const activeDelta = updates.find((u) => u.playerId === "active")!.delta;
    const inactiveDelta = updates.find((u) => u.playerId === "inactive")!.delta;

    expect(inactiveDelta).toBeGreaterThan(activeDelta);
  });
});
