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
});
