import { describe, expect, it } from "vitest";
import type { PlayerRecord, TournamentRecord } from "@/lib/domain/types";
import {
  autoBalanceTeams,
  computeTeamScore,
  generateDefaultLines,
} from "@/lib/tournament/team-tournament";

const createPlayer = (id: string, name: string, rating: number): PlayerRecord => ({
  id,
  groupId: "g1",
  name,
  initialRating: rating,
  rating,
  ratedGamesPlayed: 10,
  active: true,
  gender: "male",
});

describe("Team Tournament Domain Logic", () => {
  describe("autoBalanceTeams", () => {
    it("distributes pre-formed pairs to opposing teams to balance rating", () => {
      const p1 = createPlayer("p1", "Alice", 1200);
      const p2 = createPlayer("p2", "Bob", 1100); // Pair A: avg 1150
      const p3 = createPlayer("p3", "Charlie", 1050);
      const p4 = createPlayer("p4", "Dave", 1000); // Pair B: avg 1025
      const p5 = createPlayer("p5", "Eve", 900);   // Solo 1
      const p6 = createPlayer("p6", "Frank", 1150); // Solo 2

      const players = [p1, p2, p3, p4, p5, p6];
      const preFormedPairs: [string, string][] = [
        ["p1", "p2"],
        ["p3", "p4"],
      ];

      const { teams, pairs } = autoBalanceTeams(players, preFormedPairs, 2);

      expect(teams.length).toBe(2);
      expect(pairs.length).toBe(2);

      // Verify each team gets 1 pair
      expect(teams[0]!.pairIds.length).toBe(1);
      expect(teams[1]!.pairIds.length).toBe(1);

      // Verify pair partners stay together
      const team1Pair = pairs.find((p) => p.id === teams[0]!.pairIds[0])!;
      const team2Pair = pairs.find((p) => p.id === teams[1]!.pairIds[0])!;

      expect([team1Pair.player1Id, team1Pair.player2Id].sort()).not.toEqual(
        [team2Pair.player1Id, team2Pair.player2Id].sort()
      );

      // Verify solo players are distributed
      expect(teams[0]!.soloPlayerIds.length).toBe(1);
      expect(teams[1]!.soloPlayerIds.length).toBe(1);

      // Total player count per team must be 3
      expect(teams[0]!.pairIds.length * 2 + teams[0]!.soloPlayerIds.length).toBe(3);
      expect(teams[1]!.pairIds.length * 2 + teams[1]!.soloPlayerIds.length).toBe(3);
    });

    it("handles all solo players without pre-formed pairs", () => {
      const players = [
        createPlayer("p1", "P1", 1200),
        createPlayer("p2", "P2", 1100),
        createPlayer("p3", "P3", 1000),
        createPlayer("p4", "P4", 900),
      ];

      const { teams, pairs } = autoBalanceTeams(players, [], 2);
      expect(pairs.length).toBe(0);
      expect(teams[0]!.soloPlayerIds.length).toBe(2);
      expect(teams[1]!.soloPlayerIds.length).toBe(2);
    });
  });

  describe("generateDefaultLines", () => {
    it("generates doubles lines from team pairs and singles lines from solo players", () => {
      const pair1 = { id: "pr_1", player1Id: "p1", player2Id: "p2" };
      const pair2 = { id: "pr_2", player1Id: "p3", player2Id: "p4" };

      const teams = [
        {
          id: "team_1",
          name: "Team Fire",
          color: "#ef4444",
          pairIds: ["pr_1"],
          soloPlayerIds: ["p5"],
        },
        {
          id: "team_2",
          name: "Team Ice",
          color: "#3b82f6",
          pairIds: ["pr_2"],
          soloPlayerIds: ["p6"],
        },
      ];

      const lines = generateDefaultLines(teams, [pair1, pair2]);
      expect(lines.length).toBe(2);

      // Line 1: Doubles
      expect(lines[0]!.type).toBe("doubles");
      expect(lines[0]!.team1PlayerIds).toEqual(["p1", "p2"]);
      expect(lines[0]!.team2PlayerIds).toEqual(["p3", "p4"]);

      // Line 2: Singles
      expect(lines[1]!.type).toBe("singles");
      expect(lines[1]!.team1PlayerIds).toEqual(["p5"]);
      expect(lines[1]!.team2PlayerIds).toEqual(["p6"]);
    });
  });

  describe("computeTeamScore", () => {
    it("aggregates wins and point differentials and identifies leading team", () => {
      const tournament: TournamentRecord = {
        id: "tr_1",
        groupId: "g1",
        name: "Test Clash",
        status: "active",
        format: "team_dual",
        divisions: [],
        brackets: {},
        teamData: {
          pairs: [],
          teams: [
            { id: "team_1", name: "Team 1", color: "red", pairIds: [], soloPlayerIds: [] },
            { id: "team_2", name: "Team 2", color: "blue", pairIds: [], soloPlayerIds: [] },
          ],
          lines: [
            {
              id: "l1",
              lineNumber: 1,
              name: "Line 1",
              type: "doubles",
              team1PlayerIds: ["a", "b"],
              team2PlayerIds: ["c", "d"],
              team1Score: 11,
              team2Score: 9, // Team 1 wins
              status: "completed",
            },
            {
              id: "l2",
              lineNumber: 2,
              name: "Line 2",
              type: "doubles",
              team1PlayerIds: ["e", "f"],
              team2PlayerIds: ["g", "h"],
              team1Score: 8,
              team2Score: 11, // Team 2 wins
              status: "completed",
            },
            {
              id: "l3",
              lineNumber: 3,
              name: "Line 3",
              type: "singles",
              team1PlayerIds: ["a"],
              team2PlayerIds: ["c"],
              team1Score: 11,
              team2Score: 7, // Team 1 wins
              status: "completed",
            },
          ],
          format: "dual_meet",
          scoringType: "games_won",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const summary = computeTeamScore(tournament);

      expect(summary.completedLinesCount).toBe(3);
      expect(summary.totalLinesCount).toBe(3);
      expect(summary.teamScores["team_1"]!.wins).toBe(2);
      expect(summary.teamScores["team_2"]!.wins).toBe(1);
      expect(summary.teamScores["team_1"]!.points).toBe(30);
      expect(summary.teamScores["team_2"]!.points).toBe(27);
      expect(summary.leaderTeamId).toBe("team_1");
      expect(summary.isTied).toBe(false);
    });

    it("correctly flags tied state", () => {
      const tournament: TournamentRecord = {
        id: "tr_1",
        groupId: "g1",
        name: "Tied Clash",
        status: "active",
        format: "team_dual",
        divisions: [],
        brackets: {},
        teamData: {
          pairs: [],
          teams: [
            { id: "team_1", name: "Team 1", color: "red", pairIds: [], soloPlayerIds: [] },
            { id: "team_2", name: "Team 2", color: "blue", pairIds: [], soloPlayerIds: [] },
          ],
          lines: [
            {
              id: "l1",
              lineNumber: 1,
              name: "Line 1",
              type: "doubles",
              team1PlayerIds: ["a", "b"],
              team2PlayerIds: ["c", "d"],
              team1Score: 11,
              team2Score: 9, // Team 1 wins
              status: "completed",
            },
            {
              id: "l2",
              lineNumber: 2,
              name: "Line 2",
              type: "doubles",
              team1PlayerIds: ["e", "f"],
              team2PlayerIds: ["g", "h"],
              team1Score: 9,
              team2Score: 11, // Team 2 wins
              status: "completed",
            },
          ],
          format: "dual_meet",
          scoringType: "games_won",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const summary = computeTeamScore(tournament);
      expect(summary.isTied).toBe(true);
      expect(summary.leaderTeamId).toBeNull();
    });
  });
});

