import { describe, expect, it } from "vitest";
import { matchmakingPlayers } from "@/lib/matchmaking/proposal";
import { chooseSittingPlayers } from "@/lib/matchmaking/sitting";
import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import { createSeededRandom } from "@/lib/matchmaking/random";
import type {
  AttendanceRecord,
  PlayerRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";

describe("matchmakingPlayers - singles and 2v1 sit credit accounting", () => {
  const createPlayer = (id: string, name: string): PlayerRecord => ({
    id,
    groupId: "group-1",
    name,
    initialRating: 1200,
    rating: 1200,
    ratedGamesPlayed: 0,
    active: true,
  });

  const createAttendance = (ids: string[]): AttendanceRecord[] =>
    ids.map((id) => ({
      sessionId: "session-1",
      playerId: id,
      joinedRound: 1,
      leftRound: null,
    }));

  it("treats singles and 2v1 appearances as a sit credit for fairness while tracking format counts", () => {
    // 9 players in Round 1:
    // Court 1: Doubles (p1, p2 vs p3, p4) - rated standard doubles
    // Court 2: 2v1 (p5, p6 vs p7) - nonstandard
    // Court 3: Singles (p8 vs p9) - nonstandard
    // Physical sit: p10
    const allPlayerIds = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"];
    const players = allPlayerIds.map((id) => createPlayer(id, `Player ${id}`));
    const attendance = createAttendance(allPlayerIds);

    const round1: StartedRoundRecord = {
      round: {
        id: "round-1",
        sessionId: "session-1",
        roundNumber: 1,
        status: "completed",
        seed: 100,
        scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        version: 1,
      },
      matches: [
        { id: "m1", roundId: "round-1", courtNumber: 1, status: "completed", rated: true, team1Score: 11, team2Score: 9, completedAt: new Date(), version: 1 },
        { id: "m2", roundId: "round-1", courtNumber: 2, status: "completed", rated: false, team1Score: 11, team2Score: 7, completedAt: new Date(), version: 1 },
        { id: "m3", roundId: "round-1", courtNumber: 3, status: "completed", rated: false, team1Score: 11, team2Score: 8, completedAt: new Date(), version: 1 },
      ],
      matchPlayers: [
        // m1: Doubles (4 players)
        { matchId: "m1", playerId: "p1", team: 1, ratingBefore: 1200, ratingAfter: 1210 },
        { matchId: "m1", playerId: "p2", team: 1, ratingBefore: 1200, ratingAfter: 1210 },
        { matchId: "m1", playerId: "p3", team: 2, ratingBefore: 1200, ratingAfter: 1190 },
        { matchId: "m1", playerId: "p4", team: 2, ratingBefore: 1200, ratingAfter: 1190 },
        // m2: 2v1 (3 players)
        { matchId: "m2", playerId: "p5", team: 1, ratingBefore: null, ratingAfter: null },
        { matchId: "m2", playerId: "p6", team: 1, ratingBefore: null, ratingAfter: null },
        { matchId: "m2", playerId: "p7", team: 2, ratingBefore: null, ratingAfter: null },
        // m3: Singles (2 players)
        { matchId: "m3", playerId: "p8", team: 1, ratingBefore: null, ratingAfter: null },
        { matchId: "m3", playerId: "p9", team: 2, ratingBefore: null, ratingAfter: null },
      ],
      sits: [{ roundId: "round-1", playerId: "p10" }],
    };

    const derived = matchmakingPlayers(players, attendance, [round1], 1);
    const byId = new Map(derived.map((p) => [p.id, p]));

    // Doubles players: full game credit, satPreviousRound = false
    for (const id of ["p1", "p2", "p3", "p4"]) {
      const p = byId.get(id)!;
      expect(p.gamesPlayed).toBe(1);
      expect(p.satPreviousRound).toBe(false);
      expect(p.timesPlayed2v1).toBe(0);
      expect(p.timesPlayedSingles).toBe(0);
    }

    // 2v1 participants: sit credit (gamesPlayed = 0), satPreviousRound = true, timesPlayed2v1 = 1
    for (const id of ["p5", "p6", "p7"]) {
      const p = byId.get(id)!;
      expect(p.gamesPlayed).toBe(0);
      expect(p.satPreviousRound).toBe(true);
      expect(p.timesPlayed2v1).toBe(1);
      expect(p.timesPlayedSingles).toBe(0);
    }

    // Singles participants: sit credit (gamesPlayed = 0), satPreviousRound = true, timesPlayedSingles = 1
    for (const id of ["p8", "p9"]) {
      const p = byId.get(id)!;
      expect(p.gamesPlayed).toBe(0);
      expect(p.satPreviousRound).toBe(true);
      expect(p.timesPlayed2v1).toBe(0);
      expect(p.timesPlayedSingles).toBe(1);
    }

    // Physical sitter: gamesPlayed = 0, satPreviousRound = true
    const p10 = byId.get("p10")!;
    expect(p10.gamesPlayed).toBe(0);
    expect(p10.satPreviousRound).toBe(true);

    // Verify next-round sitting priority:
    // When 2 players need to sit in Round 2, only prior doubles players should be selected!
    // Prior singles (p8, p9), 2v1 (p5, p6, p7), and physical sitter (p10) all have satPreviousRound=true and gamesPlayed=0.
    const chosenSitters = chooseSittingPlayers({
      players: derived,
      sitCount: 2,
      random: createSeededRandom(42),
      config: DEFAULT_MATCHMAKING_CONFIG,
    });

    expect(chosenSitters).toHaveLength(2);
    // Both chosen sitters must be from the doubles players (p1, p2, p3, p4)
    for (const sitterId of chosenSitters) {
      expect(["p1", "p2", "p3", "p4"]).toContain(sitterId);
      expect(["p5", "p6", "p7", "p8", "p9", "p10"]).not.toContain(sitterId);
    }
  });

  it("does not count cancelled matches towards games played or sit credits", () => {
    const players = ["p1", "p2", "p3", "p4"].map((id) => createPlayer(id, `Player ${id}`));
    const attendance = createAttendance(["p1", "p2", "p3", "p4"]);

    const roundWithCancelledMatch: StartedRoundRecord = {
      round: {
        id: "round-1",
        sessionId: "session-1",
        roundNumber: 1,
        status: "completed",
        seed: 1,
        scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        version: 1,
      },
      matches: [
        { id: "m_cancelled", roundId: "round-1", courtNumber: 1, status: "cancelled", rated: false, team1Score: null, team2Score: null, completedAt: null, version: 1 },
      ],
      matchPlayers: [
        { matchId: "m_cancelled", playerId: "p1", team: 1, ratingBefore: null, ratingAfter: null },
        { matchId: "m_cancelled", playerId: "p2", team: 2, ratingBefore: null, ratingAfter: null },
      ],
      sits: [{ roundId: "round-1", playerId: "p3" }],
    };

    const derived = matchmakingPlayers(players, attendance, [roundWithCancelledMatch], 1);
    const byId = new Map(derived.map((p) => [p.id, p]));

    // Cancelled match players do not get credit as satPreviousRound
    expect(byId.get("p1")?.satPreviousRound).toBe(false);
    expect(byId.get("p1")?.timesPlayedSingles).toBe(0);
    // Physical sitter gets satPreviousRound
    expect(byId.get("p3")?.satPreviousRound).toBe(true);
  });
});
