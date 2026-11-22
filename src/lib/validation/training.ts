import { z } from "zod";

export const challengeTrackingFormatSchema = z.enum([
  "highest_score",
  "accuracy",
  "wins",
  "completion",
  "timed",
]);

export const challengeParticipantFormatSchema = z.enum([
  "individual",
  "partner",
  "group",
]);

export const challengeSkillCategorySchema = z.enum([
  "dinking",
  "third_shot",
  "serving",
  "volleys",
  "resets",
  "conditioning",
  "strategy",
]);

export const recordTrainingResultSchema = z
  .object({
    challengeId: z.string().min(1, "Challenge is required"),
    groupId: z.string().nullable().optional(),
    planItemId: z.string().nullable().optional(),
    scorePrimary: z.number(),
    scoreSecondary: z.number().nullable().optional(),
    completed: z.boolean().default(true),
    notes: z.string().trim().max(500, "Notes cannot exceed 500 characters").nullable().optional(),
    participantPlayerIds: z.array(z.string()).default([]),
    clientSubmissionToken: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scorePrimary < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Score cannot be negative",
        path: ["scorePrimary"],
      });
    }
    if (data.scoreSecondary !== undefined && data.scoreSecondary !== null) {
      if (data.scoreSecondary <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Total attempts must be greater than zero",
          path: ["scoreSecondary"],
        });
      } else if (data.scorePrimary > data.scoreSecondary) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Successful shots cannot exceed total attempts",
          path: ["scorePrimary"],
        });
      }
    }
  });

export const publishWeeklyPlanSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
  year: z.number().int().min(2020).max(2100),
  weekNumber: z.number().int().min(1).max(53),
  title: z.string().trim().min(1, "Plan title is required").max(100, "Title is too long"),
  focusNotes: z.string().trim().max(500).nullable().optional(),
  challengeIds: z.array(z.string().min(1)).min(1, "Select at least 1 challenge").max(6, "Maximum 6 challenges per week"),
  customGoals: z.record(z.string(), z.string()).optional(),
});

export const personalWeeklyPlanSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  weekNumber: z.number().int().min(1).max(53),
  title: z.string().trim().min(1, "Plan title is required").max(100, "Title is too long"),
  focusNotes: z.string().trim().max(500).nullable().optional(),
  challengeIds: z.array(z.string().min(1)).min(1, "Select at least 1 challenge").max(6, "Maximum 6 challenges per week"),
  customGoals: z.record(z.string(), z.string()).optional(),
});
