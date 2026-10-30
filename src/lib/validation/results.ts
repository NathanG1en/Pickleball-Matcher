import { z } from "zod";

import { entityIdSchema } from "@/lib/validation/group";

const requiredScore = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().min(0).max(99),
);

export const recordResultSchema = z
  .object({
    matchId: entityIdSchema,
    team1Score: requiredScore,
    team2Score: requiredScore,
  })
  .strict()
  .refine(({ team1Score, team2Score }) => team1Score !== team2Score, {
    path: ["team2Score"],
    message: "Pickleball matches cannot end in a tie",
  });

export const recordResultMutationSchema = recordResultSchema.extend({
  groupId: entityIdSchema,
  sessionId: entityIdSchema.optional(),
  matchVersion: z.coerce.number().int().positive(),
  idempotencyKey: entityIdSchema,
});

export const cancelMatchSchema = z
  .object({
    groupId: entityIdSchema,
    sessionId: entityIdSchema.optional(),
    matchId: entityIdSchema,
    matchVersion: z.coerce.number().int().positive().optional(),
    idempotencyKey: entityIdSchema.optional(),
  })
  .strict();

export const singleMatchResultSchema = z
  .object({
    matchId: entityIdSchema,
    team1Score: requiredScore,
    team2Score: requiredScore,
    matchVersion: z.coerce.number().int().positive().optional(),
  })
  .strict()
  .refine(({ team1Score, team2Score }) => team1Score !== team2Score, {
    path: ["team2Score"],
    message: "Pickleball matches cannot end in a tie",
  });

export const recordMultipleResultsMutationSchema = z
  .object({
    groupId: entityIdSchema,
    sessionId: entityIdSchema.optional(),
    results: z.array(singleMatchResultSchema).min(1),
    idempotencyKey: entityIdSchema.optional(),
  })
  .strict();

