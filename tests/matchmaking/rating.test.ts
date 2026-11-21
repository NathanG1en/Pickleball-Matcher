import { describe, expect, it } from "vitest";

import {
  BASE_MARGIN,
  INACTIVITY_GRACE_DAYS,
  K_MAX,
  K_MIN,
  MAX_MARGIN_MULTIPLIER,
  MIN_MARGIN_MULTIPLIER,
  POINT_SHARE_WEIGHT,
  TIER_HIGH_RATING,
  TIER_LOW_RATING,
  ZERO_CHANGE_THRESHOLD,
  expectedScore,
  kFactor,
  rateMatch,
  ratingTierModifier,
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

  it("weights team rating toward the weaker partner to reflect weak-link targeting", () => {
    // Equal players: team rating equals individual rating
    expect(teamRating([1_000, 1_000])).toBe(1_000);
    // Mismatched players: 900 + 0.35 * (1100 - 900) = 970 (rather than naive arithmetic 1000)
    expect(teamRating([1_100, 900])).toBe(970);
    expect(teamRating([900, 1_100])).toBe(970);
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

describe("ratingTierModifier", () => {
  it("applies deflation to 4.5+ players (1400+ Elo)", () => {
    expect(ratingTierModifier(1450, true)).toBe(0.90);
    expect(ratingTierModifier(1450, false)).toBe(1.10);
    expect(TIER_HIGH_RATING).toBe(1400);
  });

  it("applies upward mobility boost to <3.0 players (<800 Elo)", () => {
    expect(ratingTierModifier(750, true)).toBe(1.08);
    expect(ratingTierModifier(750, false)).toBe(0.95);
    expect(TIER_LOW_RATING).toBe(800);
  });

  it("remains neutral (1.0) for intermediate and regular players", () => {
    expect(ratingTierModifier(1000, true)).toBe(1.0);
    expect(ratingTierModifier(1000, false)).toBe(1.0);
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

    const oldSwing = 20 * 0.5;
    const newBlowoutSwing = K_MIN * blowoutMultiplier * 0.5;
    expect(newBlowoutSwing).toBe(oldSwing);
  });

  it("exhibits diminishing returns as margin grows", () => {
    const m2 = scoreMarginMultiplier(11, 9);
    const m5 = scoreMarginMultiplier(11, 6);
    const m8 = scoreMarginMultiplier(11, 3);
    const m11 = scoreMarginMultiplier(11, 0);

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
    expect(scoreMarginMultiplier(11, 11)).toBe(1.0);
    expect(scoreMarginMultiplier(-1, 5)).toBe(1.0);
    expect(scoreMarginMultiplier(11.5, 7)).toBe(1.0);
  });
});

describe("rateMatch: individualized K factors and rating conservation", () => {
  it("applies individual K factors to teammates rather than an averaged team K", () => {
    const newPlayerGames = 0; // K = 40
    const establishedGames = 40; // K ≈ 16.86
    const opponentGames = 12; // K ≈ 24.83

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
      team2Score: 7,
    });

    const [newbieUpdate, veteranUpdate, opp1Update, opp2Update] = updates;

    // Both teammates won against equal team rating (E = 0.5)
    // Continuous performance S* = 0.65(1) + 0.35(11/18) ≈ 0.8639; surprise ≈ 0.3639
    const sStar = (1 - POINT_SHARE_WEIGHT) * 1 + POINT_SHARE_WEIGHT * (11 / 18);
    const expectedSurprise = sStar - 0.5;

    expect(newbieUpdate.delta).toBeCloseTo(40 * expectedSurprise, 2);
    expect(veteranUpdate.delta).toBeCloseTo(kFactor(40) * expectedSurprise, 2);
    expect(veteranUpdate.delta).toBeLessThan(newbieUpdate.delta);

    // Opponents lose according to their own K
    expect(opp1Update.delta).toBeCloseTo(-kFactor(12) * expectedSurprise, 2);
    expect(opp2Update.delta).toBeCloseTo(-kFactor(12) * expectedSurprise, 2);

    // Sum of deltas is non-zero when individual uncertainties differ
    const netDelta = updates.reduce((sum, u) => sum + u.delta, 0);
    expect(Math.abs(netDelta)).toBeGreaterThan(0);
  });

  it("conserves total rating points (sum = 0) when all players share equal experience and recency", () => {
    const updates = rateMatch({
      team1: [
        { id: "a", rating: 1_000, ratedGames: 15 },
        { id: "b", rating: 1_000, ratedGames: 15 },
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
    // 11-0 produces S* = 1.0 (surprise 0.50); 11-9 produces S* = 0.8425 (surprise 0.3425)
    expect(blowoutMatch[0].delta).toBeCloseTo(kFactor(20) * 0.50, 2);
    expect(narrowMatch[0].delta).toBeCloseTo(kFactor(20) * 0.3425, 2);
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

describe("rateMatch: Recreational-Safe DUPR Dynamics", () => {
  it("allows a heavy underdog to gain rating on a close loss when beating the point spread", () => {
    // 3.5 team (1000) plays 4.5 team (1400) -> Delta = -400, expected score E1 ≈ 0.0909
    const updates = rateMatch({
      team1: [
        { id: "underdog1", rating: 1_000, ratedGames: 20 },
        { id: "underdog2", rating: 1_000, ratedGames: 20 },
      ],
      team2: [
        { id: "favorite1", rating: 1_400, ratedGames: 20 },
        { id: "favorite2", rating: 1_400, ratedGames: 20 },
      ],
      team1Score: 9, // Underdog scores 9 points in an 11-9 loss
      team2Score: 11,
    });

    const [u1, u2, f1, f2] = updates;

    // Underdog scored 45% of points when expected to win only ~9% of game
    // Underdogs GAIN rating on this loss!
    expect(u1.delta).toBeGreaterThan(0);
    expect(u2.delta).toBeGreaterThan(0);

    // Recreational-safe guarantee: winning favorites NEVER lose rating on a win
    expect(f1.delta).toBeGreaterThanOrEqual(0);
    expect(f2.delta).toBeGreaterThanOrEqual(0);
  });

  it("penalizes an underdog on a blowout loss when failing to beat the spread", () => {
    // 3.5 team (1000) plays 4.5 team (1400), but loses 11-2 as expected
    const updates = rateMatch({
      team1: [
        { id: "underdog1", rating: 1_000, ratedGames: 20 },
        { id: "underdog2", rating: 1_000, ratedGames: 20 },
      ],
      team2: [
        { id: "favorite1", rating: 1_400, ratedGames: 20 },
        { id: "favorite2", rating: 1_400, ratedGames: 20 },
      ],
      team1Score: 2,
      team2Score: 11,
    });

    const [u1, u2, f1, f2] = updates;

    expect(u1.delta).toBeLessThan(0);
    expect(u2.delta).toBeLessThan(0);
    expect(f1.delta).toBeGreaterThan(0);
    expect(f2.delta).toBeGreaterThan(0);
  });

  it("applies deadband filter so micro-changes below ZERO_CHANGE_THRESHOLD result in exactly 0.000", () => {
    expect(ZERO_CHANGE_THRESHOLD).toBe(0.5);

    // Extreme favorite (1600) beats 800 underdog 11-1
    // Outcome provides virtually zero new information
    const updates = rateMatch({
      team1: [
        { id: "f1", rating: 1_600, ratedGames: 50 },
        { id: "f2", rating: 1_600, ratedGames: 50 },
      ],
      team2: [
        { id: "u1", rating: 800, ratedGames: 50 },
        { id: "u2", rating: 800, ratedGames: 50 },
      ],
      team1Score: 11,
      team2Score: 1,
    });

    // Favorites won as expected; delta is below threshold and filtered to exactly 0.000
    expect(updates[0].delta).toBe(0.0);
    expect(updates[1].delta).toBe(0.0);
  });

  it("shields the higher-rated partner on a loss to avoid penalizing them for weak-link targeting", () => {
    // Team 1: 4.5 player (1400) partnered with 3.5 player (1000)
    // Team 2: two 4.0 players (1200 each)
    const updates = rateMatch({
      team1: [
        { id: "star", rating: 1_400, ratedGames: 25 },
        { id: "rookie", rating: 1_000, ratedGames: 25 },
      ],
      team2: [
        { id: "opp1", rating: 1_200, ratedGames: 25 },
        { id: "opp2", rating: 1_200, ratedGames: 25 },
      ],
      team1Score: 6,
      team2Score: 11, // Team 1 loses
    });

    const [starUpdate, rookieUpdate] = updates;

    // Both partners lose rating, but the star (1400) is shielded from taking excess blame
    // Due to the 1400 tier deflation modifier (1.10) vs rookie (1.00), the star loses at most their tier-scaled share,
    // and neither player takes an inflated responsibility penalty.
    expect(starUpdate.delta).toBeLessThan(0);
    expect(rookieUpdate.delta).toBeLessThan(0);
    expect(Math.abs(starUpdate.delta)).toBeLessThan(6.5); // significantly less than the old -9.15 drop
  });

  it("assigns higher reward to the lower-rated partner on a victory", () => {
    // Team 1: 4.5 player (1400) partnered with 3.5 player (1000)
    // Team 2: two 4.0 players (1200 each)
    const updates = rateMatch({
      team1: [
        { id: "star", rating: 1_400, ratedGames: 25 },
        { id: "rookie", rating: 1_000, ratedGames: 25 },
      ],
      team2: [
        { id: "opp1", rating: 1_200, ratedGames: 25 },
        { id: "opp2", rating: 1_200, ratedGames: 25 },
      ],
      team1Score: 11,
      team2Score: 6, // Team 1 wins
    });

    const [starUpdate, rookieUpdate] = updates;

    // Lower-rated player overcame a greater challenge and gains more
    expect(rookieUpdate.delta).toBeGreaterThan(starUpdate.delta);
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
