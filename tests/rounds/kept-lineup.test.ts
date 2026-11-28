import { describe, expect, it } from "vitest";
import { editLineupWarning, keptLineupFromRound, proposalFromKeptLineup } from "@/lib/rounds/kept-lineup";
import type { StartedRoundRecord } from "@/lib/domain/types";

const breakdown = { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 };

function match(id: string, courtNumber: number, status: "pending" | "completed" = "pending") {
  return { id, roundId: "rnd_1", courtNumber, status, team1Score: null, team2Score: null, completedAt: null, version: 1 };
}

function players(matchId: string, team1: string[], team2: string[]) {
  return [
    ...team1.map((playerId) => ({ matchId, playerId, team: 1 as const, ratingBefore: null, ratingAfter: null })),
    ...team2.map((playerId) => ({ matchId, playerId, team: 2 as const, ratingBefore: null, ratingAfter: null })),
  ];
}

const round: StartedRoundRecord = {
  round: {
    id: "rnd_1", sessionId: "ses_1", roundNumber: 2, status: "started", seed: 77, scoreBreakdown: breakdown,
    createdAt: new Date(), startedAt: new Date(), completedAt: null, version: 1,
  },
  // Court 2 listed first to check ordering; court 3 is a pickup game on a two-court session.
  matches: [match("m2", 2, "completed"), match("m1", 1), match("m3", 3)],
  matchPlayers: [
    ...players("m1", ["a", "b"], ["c", "d"]),
    ...players("m2", ["e"], ["f"]),
    ...players("m3", ["g", "h"], ["i", "j"]),
  ],
  sits: [{ roundId: "rnd_1", playerId: "g" }, { roundId: "rnd_1", playerId: "h" }],
};

describe("keptLineupFromRound", () => {
  it("keeps every court's teams and who sat, leaving out pickup games", () => {
    expect(keptLineupFromRound(round, 2)).toEqual({
      courts: [
        { courtNumber: 1, team1: ["a", "b"], team2: ["c", "d"] },
        { courtNumber: 2, team1: ["e"], team2: ["f"] },
      ],
      sitting: ["g", "h"],
    });
  });
});

describe("proposalFromKeptLineup", () => {
  it("turns the kept lineup into a proposal with the round's seed and match types", () => {
    const proposal = proposalFromKeptLineup(keptLineupFromRound(round, 2), 77);
    expect(proposal.seed).toBe(77);
    expect(proposal.courts.map((c) => c.matchType)).toEqual(["doubles", "singles"]);
    expect(proposal.sitting).toEqual(["g", "h"]);
  });
});

describe("editLineupWarning", () => {
  it("names what will be cleared", () => {
    expect(editLineupWarning(1, 0)).toContain("This round's 1 saved score will be cleared.");
    expect(editLineupWarning(2, 1)).toContain("This round's 2 saved scores and 1 pickup game will be cleared.");
    expect(editLineupWarning(0, 0)).not.toContain("cleared");
  });
});
