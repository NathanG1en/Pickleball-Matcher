import { describe, expect, it } from "vitest";
import {
  areGamesDuplicate,
  detectDuplicateMatchPairs,
  type ExistingGameCandidate,
} from "@/lib/sessions/duplicate-games";

describe("duplicate-games utility", () => {
  describe("areGamesDuplicate", () => {
    it("returns true for identical doubles games with exact same teams and scores", () => {
      const g1 = {
        team1PlayerIds: ["p1", "p2"],
        team2PlayerIds: ["p3", "p4"],
        team1Score: 11,
        team2Score: 9,
      };
      const g2 = {
        team1PlayerIds: ["p1", "p2"],
        team2PlayerIds: ["p3", "p4"],
        team1Score: 11,
        team2Score: 9,
      };
      expect(areGamesDuplicate(g1, g2)).toBe(true);
    });

    it("returns true when players within a team are in different order", () => {
      const g1 = {
        team1PlayerIds: ["p1", "p2"],
        team2PlayerIds: ["p3", "p4"],
        team1Score: 11,
        team2Score: 7,
      };
      const g2 = {
        team1PlayerIds: ["p2", "p1"],
        team2PlayerIds: ["p4", "p3"],
        team1Score: 11,
        team2Score: 7,
      };
      expect(areGamesDuplicate(g1, g2)).toBe(true);
    });

    it("returns true when teams and scores are inverted (opponent submitted from their perspective)", () => {
      const g1 = {
        team1PlayerIds: ["p1", "p2"],
        team2PlayerIds: ["p3", "p4"],
        team1Score: 11,
        team2Score: 9,
      };
      const g2 = {
        team1PlayerIds: ["p4", "p3"],
        team2PlayerIds: ["p2", "p1"],
        team1Score: 9,
        team2Score: 11,
      };
      expect(areGamesDuplicate(g1, g2)).toBe(true);
    });

    it("returns true for singles games with swapped player order and scores", () => {
      const g1 = {
        team1PlayerIds: ["p1"],
        team2PlayerIds: ["p2"],
        team1Score: 11,
        team2Score: 4,
      };
      const g2 = {
        team1PlayerIds: ["p2"],
        team2PlayerIds: ["p1"],
        team1Score: 4,
        team2Score: 11,
      };
      expect(areGamesDuplicate(g1, g2)).toBe(true);
    });

    it("returns false when scores are different", () => {
      const g1 = {
        team1PlayerIds: ["p1", "p2"],
        team2PlayerIds: ["p3", "p4"],
        team1Score: 11,
        team2Score: 9,
      };
      const g2 = {
        team1PlayerIds: ["p1", "p2"],
        team2PlayerIds: ["p3", "p4"],
        team1Score: 11,
        team2Score: 8,
      };
      expect(areGamesDuplicate(g1, g2)).toBe(false);
    });

    it("returns false when one player is different", () => {
      const g1 = {
        team1PlayerIds: ["p1", "p2"],
        team2PlayerIds: ["p3", "p4"],
        team1Score: 11,
        team2Score: 9,
      };
      const g2 = {
        team1PlayerIds: ["p1", "p5"],
        team2PlayerIds: ["p3", "p4"],
        team1Score: 11,
        team2Score: 9,
      };
      expect(areGamesDuplicate(g1, g2)).toBe(false);
    });

    it("returns false if scores are null", () => {
      const g1 = {
        team1PlayerIds: ["p1"],
        team2PlayerIds: ["p2"],
        team1Score: null,
        team2Score: null,
      };
      const g2 = {
        team1PlayerIds: ["p1"],
        team2PlayerIds: ["p2"],
        team1Score: 11,
        team2Score: 9,
      };
      expect(areGamesDuplicate(g1, g2)).toBe(false);
    });

    it("returns false when comparing singles to doubles", () => {
      const g1 = {
        team1PlayerIds: ["p1"],
        team2PlayerIds: ["p2"],
        team1Score: 11,
        team2Score: 9,
      };
      const g2 = {
        team1PlayerIds: ["p1", "p3"],
        team2PlayerIds: ["p2", "p4"],
        team1Score: 11,
        team2Score: 9,
      };
      expect(areGamesDuplicate(g1, g2)).toBe(false);
    });
  });

  describe("detectDuplicateMatchPairs", () => {
    it("maps duplicate match pairs to each other with their respective game numbers", () => {
      const matches: ExistingGameCandidate[] = [
        {
          id: "m1",
          gameNumber: 1,
          team1PlayerIds: ["p1", "p2"],
          team2PlayerIds: ["p3", "p4"],
          team1Score: 11,
          team2Score: 9,
        },
        {
          id: "m2",
          gameNumber: 2,
          team1PlayerIds: ["p1", "p3"],
          team2PlayerIds: ["p2", "p4"],
          team1Score: 11,
          team2Score: 8,
        },
        {
          id: "m3",
          gameNumber: 3,
          team1PlayerIds: ["p3", "p4"],
          team2PlayerIds: ["p1", "p2"],
          team1Score: 9,
          team2Score: 11,
        },
      ];

      const duplicates = detectDuplicateMatchPairs(matches);

      expect(duplicates.size).toBe(2);
      expect(duplicates.get("m1")).toEqual({
        matchId: "m1",
        duplicateOfGameNumber: 3,
        otherMatchId: "m3",
      });
      expect(duplicates.get("m3")).toEqual({
        matchId: "m3",
        duplicateOfGameNumber: 1,
        otherMatchId: "m1",
      });
      expect(duplicates.has("m2")).toBe(false);
    });
  });
});

