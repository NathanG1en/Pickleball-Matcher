import { describe, expect, it } from "vitest";
import { buildPlayCounts } from "@/lib/sessions/play-count";
import type { AttendanceRecord, StartedRoundRecord } from "@/lib/domain/types";

const round = (id: string, matches: { id: string; status: "pending" | "completed" | "cancelled"; players: string[] }[], sits: string[]): StartedRoundRecord => ({
  round: { id, sessionId: "s", roundNumber: 1, status: "completed", seed: 1, scoreBreakdown: {} as StartedRoundRecord["round"]["scoreBreakdown"], createdAt: new Date(), startedAt: new Date(), completedAt: null, version: 1 },
  matches: matches.map((m, i) => ({ id: m.id, roundId: id, courtNumber: i + 1, status: m.status, team1Score: null, team2Score: null, completedAt: null, version: 1 })),
  matchPlayers: matches.flatMap((m) => m.players.map((playerId, i) => ({ matchId: m.id, playerId, team: (i < 2 ? 1 : 2) as 1 | 2, ratingBefore: null, ratingAfter: null }))),
  sits: sits.map((playerId) => ({ roundId: id, playerId })) as StartedRoundRecord["sits"],
});

describe("buildPlayCounts", () => {
  it("counts games played and rounds sat, ignoring cancelled games, most-owed first", () => {
    const rounds = [
      round("r1", [{ id: "m1", status: "completed", players: ["a", "b", "c", "d"] }], ["e"]),
      round("r2", [{ id: "m2", status: "cancelled", players: ["a", "b", "e", "d"] }], ["c"]),
    ];
    const attendance = ["a", "b", "c", "d", "e", "f"].map((playerId) => ({ sessionId: "s", playerId, joinedRound: 1, leftRound: null }) as AttendanceRecord);
    const rows = buildPlayCounts(rounds, attendance);
    expect(rows.find((r) => r.playerId === "a")).toEqual({ playerId: "a", played: 1, sat: 0 });
    expect(rows.find((r) => r.playerId === "e")).toEqual({ playerId: "e", played: 0, sat: 1 });
    expect(rows.find((r) => r.playerId === "c")).toEqual({ playerId: "c", played: 1, sat: 1 });
    // A late arrival with nothing yet is listed, and the most-owed players come first.
    expect(rows[0]).toEqual({ playerId: "e", played: 0, sat: 1 });
    expect(rows[1]).toEqual({ playerId: "f", played: 0, sat: 0 });
  });
});
