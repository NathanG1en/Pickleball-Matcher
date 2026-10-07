import { z } from "zod";

export const entityIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid identifier");

export const organizerPinSchema = z
  .string()
  .trim()
  .regex(/^\d{4,12}$/, "PIN must contain 4 to 12 digits");

export const createGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    pin: organizerPinSchema,
    setupToken: z.string().min(1).max(512),
  })
  .strict();

export const organizerLoginSchema = z
  .object({
    groupId: entityIdSchema,
    pin: organizerPinSchema,
  })
  .strict();

export const createPlayerSchema = z
  .object({
    groupId: entityIdSchema,
    name: z.string().trim().min(1).max(80),
    initialRating: z.coerce.number().finite().min(100).max(3_000).default(1_000),
    idempotencyKey: entityIdSchema,
  })
  .strict();

export const updatePlayerSchema = z
  .object({
    groupId: entityIdSchema,
    playerId: entityIdSchema,
    name: z.string().trim().min(1).max(80).optional(),
    active: z.boolean().optional(),
    initialRating: z.coerce.number().finite().min(100).max(3_000).optional(),
    idempotencyKey: entityIdSchema,
  })
  .strict()
  .refine(
    ({ name, active, initialRating }) =>
      name !== undefined || active !== undefined || initialRating !== undefined,
    { message: "At least one player field must change" },
  );

export const deletePlayerSchema = z
  .object({
    groupId: entityIdSchema,
    playerId: entityIdSchema,
    idempotencyKey: entityIdSchema.optional(),
  })
  .strict();

