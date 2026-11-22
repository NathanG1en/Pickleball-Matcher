import { describe, expect, it } from "vitest";
import { recordTrainingResultSchema, publishWeeklyPlanSchema } from "@/lib/validation/training";

describe("Training Validation Schemas", () => {
  describe("recordTrainingResultSchema", () => {
    it("validates valid individual attempt", () => {
      const res = recordTrainingResultSchema.safeParse({
        challengeId: "ch_wall_streak_100",
        scorePrimary: 45,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.scorePrimary).toBe(45);
        expect(res.data.completed).toBe(true);
      }
    });

    it("validates valid accuracy attempt", () => {
      const res = recordTrainingResultSchema.safeParse({
        challengeId: "ch_drop_accuracy_20",
        scorePrimary: 14,
        scoreSecondary: 20,
      });
      expect(res.success).toBe(true);
    });

    it("rejects negative score", () => {
      const res = recordTrainingResultSchema.safeParse({
        challengeId: "ch_drop_accuracy_20",
        scorePrimary: -1,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe("Score cannot be negative");
      }
    });

    it("rejects successful score greater than total attempts", () => {
      const res = recordTrainingResultSchema.safeParse({
        challengeId: "ch_drop_accuracy_20",
        scorePrimary: 22,
        scoreSecondary: 20,
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0]?.message).toBe("Successful shots cannot exceed total attempts");
      }
    });
  });

  describe("publishWeeklyPlanSchema", () => {
    it("validates valid weekly plan", () => {
      const res = publishWeeklyPlanSchema.safeParse({
        groupId: "grp_123",
        year: 2026,
        weekNumber: 47,
        title: "Week 47: Drop Mastery",
        challengeIds: ["ch_wall_streak_100", "ch_drop_accuracy_20"],
      });
      expect(res.success).toBe(true);
    });

    it("rejects empty challengeIds", () => {
      const res = publishWeeklyPlanSchema.safeParse({
        groupId: "grp_123",
        year: 2026,
        weekNumber: 47,
        title: "Week 47: Drop Mastery",
        challengeIds: [],
      });
      expect(res.success).toBe(false);
    });
  });
});

