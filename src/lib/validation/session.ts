import { z } from "zod";

import { entityIdSchema } from "@/lib/validation/group";

const aggregateVersionSchema = z.coerce.number().int().positive();
const idempotencyKeySchema = entityIdSchema;

export const startSessionSchema = z
  .object({
    groupId: entityIdSchema,
    courtCount: z.coerce.number().int().min(1).max(6),
    courtPlayerCounts: z.array(z.coerce.number().int().min(2).max(4)).max(6).optional(),
    playerIds: z.array(entityIdSchema).min(2).max(24),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict()
  .refine(({ playerIds }) => new Set(playerIds).size === playerIds.length, {
    path: ["playerIds"],
    message: "Players must be unique",
  })
  .refine(({ courtCount, courtPlayerCounts, playerIds }) =>
    !courtPlayerCounts || (courtPlayerCounts.length === courtCount && courtPlayerCounts.reduce((sum, size) => sum + size, 0) <= playerIds.length), {
      path: ["courtPlayerCounts"],
      message: "Court sizes must match the court count and cannot exceed the selected players.",
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

export const manualCourtSchema = z
  .object({
    courtNumber: z.coerce.number().int().positive(),
    team1: z.array(entityIdSchema).min(1).max(2),
    team2: z.array(entityIdSchema).min(1).max(2),
  })
  .strict()
  .refine(({ team1, team2 }) => team1.length + team2.length !== 3 || (team1.length === 2 || team2.length === 2), {
    message: "A court must be 1v1, 2v2, or 2v1.",
  });

export const startRoundSchema = z
  .object({
    groupId: entityIdSchema,
    sessionId: entityIdSchema,
    sessionVersion: aggregateVersionSchema,
    seed: z.coerce.number().int().min(0).max(0xffff_ffff),
    idempotencyKey: idempotencyKeySchema,
    manualCourts: z.array(manualCourtSchema).optional(),
    manualSitting: z.array(entityIdSchema).optional(),
  })
  .strict()
  .refine(
    ({ manualCourts, manualSitting }) => {
      if (!manualCourts && !manualSitting) return true;
      if (!manualCourts || !manualSitting) return false;
      const allPlayers = [
        ...manualCourts.flatMap((c) => [...c.team1, ...c.team2]),
        ...manualSitting,
      ];
      return new Set(allPlayers).size === allPlayers.length;
    },
    {
      message: "All players across courts and sitting must be unique",
    },
  );

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
