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
    isPublic: z.boolean().default(false),
  })
  .strict();

export const organizerLoginSchema = z
  .object({
    groupName: z.string().trim().min(1).max(80),
    pin: organizerPinSchema,
  })
  .strict();

export const playerSignupSchema = z.object({
  username: z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_]+$/, "Use letters, numbers, and underscores only"),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(10).max(72),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
  customRating: z.boolean().default(false),
  initialRating: z.coerce.number().finite().min(100).max(3_000).default(1_000),
}).strict();

export const playerLoginSchema = z.object({
  username: z.string().trim().min(3).max(24),
  password: z.string().min(1).max(72),
}).strict();

export const updatePlayerProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
}).strict();

export const joinPublicGroupSchema = z.object({
  groupId: entityIdSchema,
}).strict();

export const updateGroupVisibilitySchema = z.object({
  groupId: entityIdSchema,
  isPublic: z.boolean(),
}).strict();

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
