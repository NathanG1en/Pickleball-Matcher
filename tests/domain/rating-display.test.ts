import { describe, expect, it } from "vitest";
import {
  DUPR_PRESETS,
  SKILL_TIERS,
  duprToElo,
  eloToDupr,
  formatDupr,
  formatDuprDelta,
  formatDuprValue,
  getSkillTier,
  normalizeInitialRating,
} from "@/lib/domain/rating-display";

describe("rating-display", () => {
  describe("eloToDupr", () => {
    it("maps 1000 Elo to exactly 3.500 DUPR", () => {
      expect(eloToDupr(1000)).toBe(3.5);
    });

    it("maps anchor points correctly with 400 Elo = 1.0 DUPR", () => {
      expect(eloToDupr(400)).toBe(2.0);
      expect(eloToDupr(600)).toBe(2.5);
      expect(eloToDupr(800)).toBe(3.0);
      expect(eloToDupr(1200)).toBe(4.0);
      expect(eloToDupr(1400)).toBe(4.5);
      expect(eloToDupr(1600)).toBe(5.0);
      expect(eloToDupr(2000)).toBe(6.0);
      expect(eloToDupr(2800)).toBe(8.0);
    });

    it("clamps ratings between 2.000 and 8.000", () => {
      expect(eloToDupr(100)).toBe(2.0);
      expect(eloToDupr(3500)).toBe(8.0);
    });
  });

  describe("duprToElo", () => {
    it("maps 3.500 DUPR to 1000 Elo", () => {
      expect(duprToElo(3.5)).toBe(1000);
    });

    it("maps preset DUPR ratings to corresponding Elo integers", () => {
      expect(duprToElo(2.0)).toBe(400);
      expect(duprToElo(2.5)).toBe(600);
      expect(duprToElo(3.0)).toBe(800);
      expect(duprToElo(4.0)).toBe(1200);
      expect(duprToElo(4.5)).toBe(1400);
      expect(duprToElo(5.0)).toBe(1600);
      expect(duprToElo(6.0)).toBe(2000);
      expect(duprToElo(8.0)).toBe(2800);
    });

    it("rounds cleanly to integers", () => {
      // 3.525 -> 1000 + 0.025 * 400 = 1010
      expect(duprToElo(3.525)).toBe(1010);
    });

    it("clamps input between 2.0 and 8.0", () => {
      expect(duprToElo(1.5)).toBe(400);
      expect(duprToElo(9.0)).toBe(2800);
    });
  });

  describe("formatDuprValue", () => {
    it("cuts off at 3 decimals and removes unnecessary trailing zeros", () => {
      expect(formatDuprValue(3.5)).toBe("3.5");
      expect(formatDuprValue(3.52)).toBe("3.52");
      expect(formatDuprValue(3.525)).toBe("3.525");
      expect(formatDuprValue(3.5256)).toBe("3.526");
      expect(formatDuprValue(4.0)).toBe("4");
    });
  });

  describe("formatDupr", () => {
    it("formats Elo as a string with up to 3 decimals without trailing zeros", () => {
      expect(formatDupr(1000)).toBe("3.5");
      expect(formatDupr(900)).toBe("3.25");
      expect(formatDupr(1100)).toBe("3.75");
      expect(formatDupr(1010)).toBe("3.525");
      expect(formatDupr(1008)).toBe("3.52");
      expect(formatDupr(1200)).toBe("4");
    });
  });

  describe("formatDuprDelta", () => {
    it("formats positive deltas with a plus sign and up to 3 decimals without trailing zeros", () => {
      expect(formatDuprDelta(10)).toBe("+0.025");
      expect(formatDuprDelta(20)).toBe("+0.05");
    });

    it("formats negative deltas with a minus sign and up to 3 decimals without trailing zeros", () => {
      expect(formatDuprDelta(-10)).toBe("-0.025");
      expect(formatDuprDelta(-20)).toBe("-0.05");
    });

    it("formats zero delta with a sign", () => {
      expect(formatDuprDelta(0)).toBe("+0");
    });
  });

  describe("normalizeInitialRating", () => {
    it("converts DUPR float input (<= 8.0) into Elo integer", () => {
      expect(normalizeInitialRating(3.5)).toBe(1000);
      expect(normalizeInitialRating(4.0)).toBe(1200);
      expect(normalizeInitialRating(2.5)).toBe(600);
    });

    it("preserves raw Elo integer input (> 8.0)", () => {
      expect(normalizeInitialRating(1000)).toBe(1000);
      expect(normalizeInitialRating(1200)).toBe(1200);
    });
  });

  describe("getSkillTier", () => {
    it("classifies all 9 tiers accurately by DUPR value", () => {
      expect(getSkillTier(2.0).name).toBe("Beginner");
      expect(getSkillTier(2.499).name).toBe("Beginner");

      expect(getSkillTier(2.5).name).toBe("Advanced Beginner");
      expect(getSkillTier(2.999).name).toBe("Advanced Beginner");

      expect(getSkillTier(3.0).name).toBe("Intermediate");
      expect(getSkillTier(3.499).name).toBe("Intermediate");

      expect(getSkillTier(3.5).name).toBe("Advanced Intermediate");
      expect(getSkillTier(3.999).name).toBe("Advanced Intermediate");

      expect(getSkillTier(4.0).name).toBe("Competitive");
      expect(getSkillTier(4.499).name).toBe("Competitive");

      expect(getSkillTier(4.5).name).toBe("Advanced Competitive");
      expect(getSkillTier(4.999).name).toBe("Advanced Competitive");

      expect(getSkillTier(5.0).name).toBe("Expert");
      expect(getSkillTier(5.499).name).toBe("Expert");

      expect(getSkillTier(5.5).name).toBe("Professional");
      expect(getSkillTier(5.999).name).toBe("Professional");

      expect(getSkillTier(6.0).name).toBe("World-Class Professional");
      expect(getSkillTier(7.5).name).toBe("World-Class Professional");
    });

    it("includes description and range in the tier object", () => {
      const tier = getSkillTier(3.5);
      expect(tier.description).toContain("good basic skills and can think strategically");
      expect(tier.range).toBe("3.500 - 3.999");
    });
  });

  describe("DUPR_PRESETS and SKILL_TIERS", () => {
    it("exports exactly 6 standard presets", () => {
      expect(DUPR_PRESETS).toEqual([2.0, 2.5, 3.0, 3.5, 4.0, 4.5]);
    });

    it("exports 9 tiers in SKILL_TIERS catalog", () => {
      expect(SKILL_TIERS).toHaveLength(9);
    });
  });
});
