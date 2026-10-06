import { z } from "zod";

import { entityIdSchema } from "@/lib/validation/group";

const aggregateVersionSchema = z.coerce.number().int().positive();
const idempotencyKeySchema = entityIdSchema;

export const startSessionSchema = z
  .object({
    groupId: entityIdSchema,
    courtCount: z.coerce.number().int().min(1).max(6),
    playerIds: z.array(entityIdSchema).min(4).max(24),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict()
  .refine(({ playerIds }) => new Set(playerIds).size === playerIds.length, {
    path: ["playerIds"],
    message: "Players must be unique",
  });

export const changeAttendanceSchema = z
  .object({
    groupId: entityIdSchema,
    sessionId: entityIdSchema,
    playerId: entityIdSchema,
    present: z.boolean(),
    sessionVersion: aggregateVersionSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const proposeRoundSchema = z
  .object({
    groupId: entityIdSchema,
    sessionId: entityIdSchema,
    sessionVersion: aggregateVersionSchema,
    seed: z.coerce.number().int().min(0).max(0xffff_ffff).optional(),
  })
  .strict();

export const startRoundSchema = proposeRoundSchema.extend({
  seed: z.coerce.number().int().min(0).max(0xffff_ffff),
  idempotencyKey: idempotencyKeySchema,
});

const existingSessionMutation = z
  .object({
    groupId: entityIdSchema,
    sessionId: entityIdSchema,
    sessionVersion: aggregateVersionSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const completeRoundSchema = existingSessionMutation.extend({
  roundId: entityIdSchema,
  roundVersion: aggregateVersionSchema,
});

export const undoLatestRoundSchema = existingSessionMutation.extend({
  roundId: entityIdSchema,
  roundVersion: aggregateVersionSchema,
});

export const endSessionSchema = existingSessionMutation;
