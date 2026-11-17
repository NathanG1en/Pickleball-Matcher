import { z } from "zod";
import { normalizeInitialRating } from "@/lib/domain/rating-display";

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

export const createAccountGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  isPublic: z.boolean().default(false),
}).strict();

export const groupOrganizerPermissionsSchema = z.object({
  edit_group_name: z.boolean(),
  edit_group_privacy: z.boolean(),
  manage_organizers: z.boolean(),
  delete_group: z.boolean(),
}).strict();

export const updateGroupPermissionsSchema = z.object({
  groupId: entityIdSchema,
  permissions: groupOrganizerPermissionsSchema,
}).strict();

export const updateGroupOrganizersSchema = z.object({
  groupId: entityIdSchema,
  addAccountIds: z.array(entityIdSchema).default([]),
  removeAccountIds: z.array(entityIdSchema).default([]),
}).strict();

export const addGroupOrganizerSchema = z.object({
  groupId: entityIdSchema,
  playerId: entityIdSchema,
}).strict();

export const removeGroupOrganizerSchema = z.object({
  groupId: entityIdSchema,
  playerId: entityIdSchema,
}).strict();

export const removeGroupPlayerSchema = z.object({
  groupId: entityIdSchema,
  playerId: entityIdSchema,
}).strict();

export const transferGroupHostSchema = z.object({
  groupId: entityIdSchema,
  playerId: entityIdSchema,
  confirmationName: z.string().trim().min(1, "Enter the group name to confirm."),
}).strict();

export const addGroupPlayerSchema = z.object({
  groupId: entityIdSchema,
  username: z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_]+$/),
}).strict();

export const linkGuestPlayerSchema = z.object({
  groupId: entityIdSchema,
  playerId: entityIdSchema,
  targetAccountId: entityIdSchema,
}).strict();

export const RESERVED_USERNAMES = new Set([
  "find",
  "groups",
  "search",
  "setup",
  "temporary",
  "login",
  "signup",
  "settings",
  "admin",
  "api",
]);

const usernameFieldSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[A-Za-z0-9_]+$/, "Use letters, numbers, and underscores only")
  .refine((val) => !RESERVED_USERNAMES.has(val.toLowerCase()), {
    message: "That username is reserved.",
  });

export const playerSignupSchema = z.object({
  username: usernameFieldSchema,
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email("Enter a valid email address.").max(254).optional().or(z.literal("")),
  gender: z.enum(["male", "female"], { message: "Select your gender (male or female)." }).default("male"),
  password: z.string().min(10).max(72),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]),
  customRating: z.boolean().default(false),
  initialRating: z.coerce
    .number()
    .finite()
    .refine((val) => (val >= 2.0 && val <= 8.0) || (val >= 100 && val <= 3_000), {
      message: "Initial rating must be between 2.000 and 8.000.",
    })
    .default(3.5)
    .transform(normalizeInitialRating),
}).strict();

export const requestPasswordResetSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email address."),
}).strict();

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required."),
  password: z.string().min(10, "Password must be at least 10 characters.").max(72, "Password must be 72 bytes or fewer."),
}).strict();

export const loginWithNetlifyIdentitySchema = z.object({
  id: z.string().min(1, "User ID is required."),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  name: z.string().trim().max(80).optional(),
  token: z.string().optional(),
}).strict();

export const playerLoginSchema = z
  .object({
    username: z.string().trim().min(1).max(254).optional(),
    email: z.string().trim().min(1).max(254).optional(),
    identifier: z.string().trim().min(1).max(254).optional(),
    password: z.string().min(1).max(72),
  })
  .strict()
  .refine(
    (data) => {
      const id = data.identifier ?? data.email ?? data.username;
      return typeof id === "string" && id.trim().length >= 3;
    },
    {
      message: "Enter a valid username or email address.",
    }
  );

export const updatePlayerProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  gender: z.enum(["male", "female"]).optional(),
}).strict().refine((data) => data.name !== undefined || data.gender !== undefined, {
  message: "At least one profile field must be provided.",
});

export const updatePlayerGenderSchema = z.object({
  gender: z.enum(["male", "female"], { message: "Select a valid gender." }),
}).strict();

export const updatePlayerUsernameSchema = z.object({
  username: usernameFieldSchema,
}).strict();

export const updatePlayerEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
}).strict();

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, "Verification token is required."),
}).strict();

export const updatePlayerPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required.").max(72),
    newPassword: z.string().min(10, "New password must be at least 10 characters.").max(72, "Password must be 72 bytes or fewer."),
    confirmPassword: z.string().min(1, "Confirm your new password.").max(72),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
  });

export const joinPublicGroupSchema = z.object({
  groupId: entityIdSchema,
}).strict();

export const joinGroupInviteSchema = z.object({
  groupId: entityIdSchema,
}).strict();

export const joinAsGuestSchema = z.object({
  groupId: entityIdSchema,
  name: z.string().trim().min(1, "Name is required").max(80, "Name must be 80 characters or fewer"),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional().default("intermediate"),
  initialRating: z.coerce
    .number()
    .finite()
    .refine((val) => (val >= 2.0 && val <= 8.0) || (val >= 100 && val <= 3_000), {
      message: "Initial rating must be between 2.000 and 8.000.",
    })
    .optional()
    .transform((val) => (val === undefined ? undefined : normalizeInitialRating(val))),
}).strict();

export const updateGroupVisibilitySchema = z.object({
  groupId: entityIdSchema,
  isPublic: z.boolean(),
}).strict();

export const updateGroupNameSchema = z.object({
  groupId: entityIdSchema,
  name: z.string().trim().min(1, "Group name cannot be blank.").max(80, "Group name must be 80 characters or fewer."),
}).strict();

export const deleteGroupSchema = z.object({
  groupId: entityIdSchema,
  confirmationName: z.string().trim().min(1, "Enter the group name to confirm."),
}).strict();

export const createPlayerSchema = z
  .object({
    groupId: entityIdSchema,
    name: z.string().trim().min(1).max(80),
    gender: z.enum(["male", "female"]).optional(),
    initialRating: z.coerce
      .number()
      .finite()
      .refine((val) => (val >= 2.0 && val <= 8.0) || (val >= 100 && val <= 3_000), {
        message: "Initial rating must be between 2.000 and 8.000.",
      })
      .default(3.5)
      .transform(normalizeInitialRating),
    idempotencyKey: entityIdSchema,
  })
  .strict();

export const updatePlayerSchema = z
  .object({
    groupId: entityIdSchema,
    playerId: entityIdSchema,
    name: z.string().trim().min(1).max(80).optional(),
    gender: z.enum(["male", "female"]).optional(),
    active: z.boolean().optional(),
    idempotencyKey: entityIdSchema,
  })
  .strict()
  .refine(
    ({ name, gender, active }) => name !== undefined || gender !== undefined || active !== undefined,
    { message: "At least one player field must change" },
  );

export const deletePlayerSchema = z
  .object({
    groupId: entityIdSchema,
    playerId: entityIdSchema,
    idempotencyKey: entityIdSchema.optional(),
  })
  .strict();

export const mergeGuestPlayersSchema = z
  .object({
    groupId: entityIdSchema,
    targetPlayerId: entityIdSchema,
    sourcePlayerIds: z.array(entityIdSchema).min(1, "Select at least one other guest player to merge."),
    mergedName: z.string().trim().min(1, "Player name cannot be empty.").max(80, "Name must be 80 characters or fewer."),
    idempotencyKey: entityIdSchema.optional(),
  })
  .strict();

