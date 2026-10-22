import { describe, expect, it } from "vitest";
import { getSessionHighlights } from "@/lib/domain/session-highlights";
import type { MatchRecord, StartedRoundRecord } from "@/lib/domain/types";

function game(
  id: string,
  scores: readonly [number | null, number | null],
  teams: readonly [readonly string[], readonly string[]] = [["a", "b"], ["c", "d"]],
  status: MatchRecord["status"] = "completed",
): StartedRoundRecord {
  return {
    round: {
      id: `round-${id}`, sessionId: "session", roundNumber: 1, status: "completed",
      seed: 1, version: 1, createdAt: new Date(0), startedAt: new Date(0), completedAt: new Date(1),
      scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
    },
    matches: [{
      id, roundId: `round-${id}`, courtNumber: 1, status,
      team1Score: scores[0], team2Score: scores[1], completedAt: new Date(1), version: 1,
    }],
    matchPlayers: teams.flatMap((ids, index) => ids.map(playerId => ({
      matchId: id, playerId, team: index === 0 ? 1 as const : 2 as const,
      ratingBefore: null, ratingAfter: null,
    }))),
    sits: [],
  };
}

describe("session highlights", () => {
  it("keeps every game tied for the closest margin, including overtime and reversed winners", () => {
    const result = getSessionHighlights([
      game("wide", [11, 3]), game("close-b", [10, 12]), game("close-a", [15, 13]),
    ]);
    expect(result.completedGames).toBe(3);
    expect(result.closestGames.map(match => match.id)).toEqual(["close-a", "close-b"]);
    expect(result.closestGames[0]).toMatchObject({ team1Score: 15, team2Score: 13, team1: ["a", "b"], team2: ["c", "d"] });
  });

  it("counts wins on either side and shares the lead without ranking tied teammates", () => {
    const result = getSessionHighlights([
      game("one", [11, 7]), game("two", [2, 11]), game("three", [11, 6], [["a", "c"], ["b", "d"]]),
    ]);
    expect(result.mostWins).toEqual({ count: 2, playerIds: ["a", "c"] });
  });

  it("counts distinct doubles partners, never repeat partners, opponents, or singles", () => {
    const result = getSessionHighlights([
      game("one", [11, 7]), game("repeat", [11, 6]),
      game("new", [11, 8], [["a", "c"], ["b", "d"]]),
      game("singles", [11, 1], [["a"], ["e"]]),
      game("two-on-one", [11, 5], [["a", "e"], ["f"]]),
    ]);
    expect(result.mostPartners).toEqual({ count: 2, playerIds: ["a", "b", "c", "d"] });
  });

  it("ignores unplayed, cancelled, excluded, and invalid games in every highlight", () => {
    const cancelledRound = game("undone", [11, 10]);
    cancelledRound.round.status = "cancelled";
    const result = getSessionHighlights([
      game("saved", [11, 9]), game("pending", [11, 10], undefined, "pending"),
      game("cancelled", [11, 10], undefined, "cancelled"), cancelledRound,
      game("deleted", [11, 10]), game("missing", [11, null]), game("tied", [11, 11]),
      game("negative", [0, -1]), game("fraction", [11, 10.5]), game("infinite", [Infinity, 10]),
    ], new Set(["deleted"]));
    expect(result.completedGames).toBe(1);
    expect(result.closestGames.map(match => match.id)).toEqual(["saved"]);
    expect(result.mostWins).toEqual({ count: 1, playerIds: ["a", "b"] });
    expect(result.mostPartners).toEqual({ count: 1, playerIds: ["a", "b", "c", "d"] });
  });

  it("returns no awards for an empty session and no partner award for singles", () => {
    expect(getSessionHighlights([])).toEqual({ completedGames: 0, closestGames: [], mostWins: null, mostPartners: null });
    expect(getSessionHighlights([game("singles", [11, 9], [["a"], ["b"]])]).mostPartners).toBeNull();
  });

  it("keeps players on their own courts when a round contains several matches", () => {
    const court1 = game("court1", [11, 9]);
    const court2 = game("court2", [3, 11], [["e", "f"], ["g", "h"]]);
    const result = getSessionHighlights([{
      ...court1,
      matches: [...court1.matches, ...court2.matches],
      matchPlayers: [...court1.matchPlayers, ...court2.matchPlayers],
    }]);
    expect(result.mostWins?.playerIds).toEqual(["a", "b", "g", "h"]);
    expect(result.mostPartners?.count).toBe(1);
    expect(result.closestGames[0].team1).toEqual(["a", "b"]);
    expect(result.closestGames[0].team2).toEqual(["c", "d"]);
  });

  it("recomputes from score corrections and deletions without mutating the input", () => {
    const first = game("first", [11, 9]);
    const second = game("second", [11, 3]);
    const before = structuredClone([first, second]);
    getSessionHighlights([first, second]);
    expect([first, second]).toEqual(before);
    const edited = { ...first, matches: [{ ...first.matches[0], team1Score: 0, team2Score: 11 }] };
    expect(getSessionHighlights([edited, second]).closestGames[0].id).toBe("second");
    expect(getSessionHighlights([edited, second]).mostWins?.playerIds).toEqual(["a", "b", "c", "d"]);
    expect(getSessionHighlights([edited, second], new Set(["second"])).mostWins?.playerIds).toEqual(["c", "d"]);
  });
});
