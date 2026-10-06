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
  matchVersion: z.coerce.number().int().positive(),
  idempotencyKey: entityIdSchema,
});

export const cancelMatchSchema = z
  .object({
    groupId: entityIdSchema,
    matchId: entityIdSchema,
    matchVersion: z.coerce.number().int().positive(),
    idempotencyKey: entityIdSchema,
  })
  .strict();
