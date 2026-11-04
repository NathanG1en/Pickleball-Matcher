import { describe, expect, it } from "vitest";

import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import { scoreRound, scoreSkillBalance } from "@/lib/matchmaking/score-round";
import type {
  MatchmakingPlayer,
  PairHistory,
  RoundCandidate,
} from "@/lib/matchmaking/types";

function player(id: string, rating: number): MatchmakingPlayer {
  return {
    id,
    name: id,
    rating,
    gamesPlayed: 0,
    eligibleRounds: 0,
    satPreviousRound: false,
  };
}

const players = [player("a", 1_080), player("b", 920), player("c", 1_000), player("d", 1_000)];

const balanced: RoundCandidate = {
  courts: [{ courtNumber: 1, team1: ["a", "b"], team2: ["c", "d"] }],
  sitting: [],
};

const moderatelyUnbalanced: RoundCandidate = {
  courts: [{ courtNumber: 1, team1: ["a", "c"], team2: ["b", "d"] }],
  sitting: [],
};

describe("scoreSkillBalance", () => {
  it("prefers teams with closer average ratings", () => {
    expect(scoreSkillBalance(balanced.courts[0], players)).toBe(0);
    expect(scoreSkillBalance(moderatelyUnbalanced.courts[0], players)).toBe(80);
  });
});

describe("scoreRound", () => {
  it("returns every named and summed score component", () => {
    const score = scoreRound(balanced, {
      players,
      pairHistory: [],
      config: DEFAULT_MATCHMAKING_CONFIG,
      sittingPenalty: { playingTime: 0.25, consecutiveSit: 1 },
      tieBreak: 0.0005,
    });

    expect(score).toMatchObject({
      playingTime: 20,
      consecutiveSit: 100,
      partnerRepeat: 0,
      skillBalance: 0,
      opponentRepeat: 0,
      tieBreak: 0.0005,
    });
    expect(score.total).toBe(
      score.playingTime +
        score.consecutiveSit +
        score.partnerRepeat +
        score.skillBalance +
        score.opponentRepeat +
        (score.twoVsOneRepeat ?? 0) +
        (score.singlesRepeat ?? 0) +
        score.tieBreak,
    );
  });

  it("prefers balanced teams when pair history is equal", () => {
    const context = {
      players,
      pairHistory: [] as PairHistory[],
      config: DEFAULT_MATCHMAKING_CONFIG,
      sittingPenalty: { playingTime: 0, consecutiveSit: 0 },
      tieBreak: 0,
    };

    expect(scoreRound(balanced, context).total).toBeLessThan(
      scoreRound(moderatelyUnbalanced, context).total,
    );
  });

  it("lets a last-round partnership outweigh a modest skill improvement", () => {
    const pairHistory: PairHistory[] = [
      {
        player1Id: "a",
        player2Id: "b",
        sessionPartnerCount: 1,
        sessionOpponentCount: 0,
        roundsSincePartner: 1,
        roundsSinceOpponent: null,
        lifetimePartnerCount: 1,
        lifetimeOpponentCount: 0,
      },
    ];
    const context = {
      players,
      pairHistory,
      config: DEFAULT_MATCHMAKING_CONFIG,
      sittingPenalty: { playingTime: 0, consecutiveSit: 0 },
      tieBreak: 0,
    };

    expect(scoreRound(moderatelyUnbalanced, context).total).toBeLessThan(
      scoreRound(balanced, context).total,
    );
  });

  it("applies a penalty when players who already played 2v1 are assigned to 2v1 again", () => {
    const freshPlayers: MatchmakingPlayer[] = [
      { id: "p1", name: "p1", rating: 1000, gamesPlayed: 1, eligibleRounds: 1, satPreviousRound: false, timesPlayed2v1: 0 },
      { id: "p2", name: "p2", rating: 1000, gamesPlayed: 1, eligibleRounds: 1, satPreviousRound: false, timesPlayed2v1: 0 },
      { id: "p3", name: "p3", rating: 1000, gamesPlayed: 1, eligibleRounds: 1, satPreviousRound: false, timesPlayed2v1: 0 },
    ];
    const repeatedPlayers: MatchmakingPlayer[] = [
      { id: "p1", name: "p1", rating: 1000, gamesPlayed: 1, eligibleRounds: 1, satPreviousRound: false, timesPlayed2v1: 1 },
      { id: "p2", name: "p2", rating: 1000, gamesPlayed: 1, eligibleRounds: 1, satPreviousRound: false, timesPlayed2v1: 0 },
      { id: "p3", name: "p3", rating: 1000, gamesPlayed: 1, eligibleRounds: 1, satPreviousRound: false, timesPlayed2v1: 0 },
    ];

    const twoVsOneCandidate: RoundCandidate = {
      courts: [{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3"], matchType: "team-vs-one" }],
      sitting: [],
    };

    const freshScore = scoreRound(twoVsOneCandidate, {
      players: freshPlayers,
      pairHistory: [],
      config: DEFAULT_MATCHMAKING_CONFIG,
      sittingPenalty: { playingTime: 0, consecutiveSit: 0 },
      tieBreak: 0,
    });

    const repeatedScore = scoreRound(twoVsOneCandidate, {
      players: repeatedPlayers,
      pairHistory: [],
      config: DEFAULT_MATCHMAKING_CONFIG,
      sittingPenalty: { playingTime: 0, consecutiveSit: 0 },
      tieBreak: 0,
    });

    expect(freshScore.twoVsOneRepeat).toBe(0);
    expect(repeatedScore.twoVsOneRepeat).toBe(100);
    expect(repeatedScore.total).toBeGreaterThan(freshScore.total);
  });

  it.each([
    { count: 0, weight: undefined, expected: 0 },
    { count: 1, weight: undefined, expected: 100 },
    { count: 2, weight: undefined, expected: 400 },
    { count: 2, weight: 25, expected: 100 },
    { count: 2, weight: 0, expected: 0 },
  ])("penalizes singles repetitions independently of 2v1 history: $count previous, weight $weight", ({ count, weight, expected }) => {
    const participants = [
      { ...player("a", 1000), timesPlayedSingles: count, timesPlayed2v1: 9 },
      { ...player("b", 1000), timesPlayedSingles: 0 },
    ];
    const score = scoreRound({ courts: [{ courtNumber: 1, team1: ["a"], team2: ["b"] }], sitting: [] }, {
      players: participants, pairHistory: [],
      config: { ...DEFAULT_MATCHMAKING_CONFIG, weights: { ...DEFAULT_MATCHMAKING_CONFIG.weights, singlesRepeat: weight } },
      sittingPenalty: { playingTime: 0, consecutiveSit: 0 }, tieBreak: 0,
    });
    expect(score.singlesRepeat ?? 0).toBe(expected);
    expect(score.twoVsOneRepeat).toBe(0);
    expect(score.total).toBe(expected);
  });

  it("charges both singles participants but does not charge their doubles or 2v1 appearances", () => {
    const participants = [
      { ...player("a", 1000), timesPlayedSingles: 2 },
      { ...player("b", 1000), timesPlayedSingles: 1 },
      player("c", 1000), player("d", 1000),
    ];
    const context = { players: participants, pairHistory: [], config: DEFAULT_MATCHMAKING_CONFIG,
      sittingPenalty: { playingTime: 0, consecutiveSit: 0 }, tieBreak: 0 };
    const singles = scoreRound({ courts: [{ courtNumber: 1, team1: ["a"], team2: ["b"], matchType: "singles" }], sitting: ["c", "d"] }, context);
    expect(singles.singlesRepeat).toBe(500);
    expect(singles.total).toBe(500);
    for (const court of [
      { courtNumber: 1, team1: ["a", "b"] as const, team2: ["c", "d"] as const },
      { courtNumber: 1, team1: ["a", "b"] as const, team2: ["c"] as const },
    ]) expect(scoreRound({ courts: [court], sitting: [] }, context).total).toBe(0);
  });

});

