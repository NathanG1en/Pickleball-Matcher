"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getActionRepository, getActivePlayerAccountId, requirePlayer } from "@/app/actions/action-context";
import { createPlayerSession, PLAYER_SESSION_COOKIE, playerSessionCookieOptions } from "@/lib/auth/player-session";
import { recordGuestPlayer } from "@/lib/auth/guest-session";
import {
  joinAsGuestSchema,
  joinGroupInviteSchema,
  joinPublicGroupSchema,
  playerLoginSchema,
  playerSignupSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  updatePlayerGenderSchema,
  updatePlayerProfileSchema,
  updatePlayerUsernameSchema,
  updateRecoveryEmailSchema,
  verifyEmailSchema,
} from "@/lib/validation/group";
import {
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from "@/lib/email/email-service";

const PASSWORD_HASH_COST = 12;
const DUMMY_PASSWORD_HASH = "$2b$12$yoKkl6R41eRMnWhvkZXPwee8aIS8qKjN5GbU0DiCsria7Dpjo5rDC";
const DEFAULT_RATING = { beginner: 900, intermediate: 1_000, advanced: 1_100 } as const;

function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.URL) return process.env.URL.replace(/\/$/, "");
  return "http://localhost:3000";
}

export type PlayerActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function playerSignupAction(input: unknown): Promise<PlayerActionResult<{ accountId: string }>> {
  const parsed = playerSignupSchema.safeParse(input);
  const submittedUsername =
    input && typeof input === "object" && "username" in input && typeof input.username === "string"
      ? input.username.trim().toLowerCase()
      : "";
  const submittedEmail =
    input && typeof input === "object" && "email" in input && typeof input.email === "string" && input.email.trim()
      ? input.email.trim().toLowerCase()
      : undefined;

  const usernameValidation = playerSignupSchema.shape.username.safeParse(submittedUsername);
  const repository = getActionRepository();
  let usernameTaken = false;
  let emailTaken = false;

  if (usernameValidation.success) {
    try {
      usernameTaken = Boolean(await repository.getPlayerAccountByUsername(submittedUsername));
    } catch {
      return { ok: false, error: "Unable to check username availability. Please try again." };
    }
  }

  if (submittedEmail) {
    try {
      emailTaken = Boolean(await repository.getPlayerAccountByEmail(submittedEmail));
    } catch {
      return { ok: false, error: "Unable to check email availability. Please try again." };
    }
  }

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (usernameTaken) fieldErrors.username = ["That username is already taken."];
    if (emailTaken) fieldErrors.email = ["That email is already registered."];
    return { ok: false, error: "Please check your player details and try again.", fieldErrors };
  }
  if (Buffer.byteLength(parsed.data.password, "utf8") > 72) {
    const fieldErrors: Record<string, string[]> = { password: ["Password must be 72 bytes or fewer."] };
    if (usernameTaken) fieldErrors.username = ["That username is already taken."];
    if (emailTaken) fieldErrors.email = ["That email is already registered."];
    return { ok: false, error: "Please check your player details and try again.", fieldErrors };
  }

  const username = parsed.data.username.toLowerCase();
  try {
    if (usernameTaken || emailTaken) {
      const fieldErrors: Record<string, string[]> = {};
      if (usernameTaken) fieldErrors.username = ["That username is already taken."];
      if (emailTaken) fieldErrors.email = ["That email is already registered."];
      return {
        ok: false,
        error: usernameTaken ? "That username is already taken." : "That email is already registered.",
        fieldErrors,
      };
    }
    const accountId = `usr_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const emailToSave = submittedEmail || null;
    const account = {
      id: accountId,
      username,
      name: parsed.data.name,
      gender: parsed.data.gender,
      passwordHash: await hash(parsed.data.password, PASSWORD_HASH_COST),
      skillLevel: parsed.data.skillLevel,
      initialRating: parsed.data.customRating ? parsed.data.initialRating : DEFAULT_RATING[parsed.data.skillLevel],
      email: emailToSave,
      emailVerified: false,
      createdAt: new Date(),
    };
    await repository.createPlayerAccount(account);

    if (emailToSave) {
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      await repository.createEmailVerificationToken({
        id: `vtok_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        accountId,
        email: emailToSave,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      });
      await sendEmailVerificationEmail({
        to: emailToSave,
        name: parsed.data.name,
        verifyUrl: `${getAppBaseUrl()}/verify-email?token=${rawToken}`,
      });
    }

    const token = await createPlayerSession(accountId);
    try {
      (await cookies()).set(PLAYER_SESSION_COOKIE, token, playerSessionCookieOptions);
    } catch {
      // Non-request test contexts.
    }
    return { ok: true, data: { accountId } };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error.code === "23505" || error.code === "SQLITE_CONSTRAINT_UNIQUE")) {
      return { ok: false, error: "That username or email is already taken.", fieldErrors: { username: ["That username is already taken."] } };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Unable to create player account." };
  }
}

export async function playerLoginAction(input: unknown): Promise<PlayerActionResult<{ accountId: string }>> {
  const parsed = playerLoginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid username and password." };
  try {
    const repository = getActionRepository();
    const account = await repository.getPlayerAccountByUsername(parsed.data.username.toLowerCase());
    const validPassword = await compare(parsed.data.password, account?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!account || !validPassword) return { ok: false, error: "Unable to sign in. Check your username and password." };
    const token = await createPlayerSession(account.id);
    try {
      (await cookies()).set(PLAYER_SESSION_COOKIE, token, playerSessionCookieOptions);
    } catch {
      // Non-request test contexts.
    }
    return { ok: true, data: { accountId: account.id } };
  } catch {
    return { ok: false, error: "Unable to sign in. Check your username and password." };
  }
}

export async function playerLogoutAction(): Promise<PlayerActionResult> {
  try {
    (await cookies()).delete(PLAYER_SESSION_COOKIE);
  } catch {
    // Non-request test contexts.
  }
  return { ok: true, data: undefined };
}

export async function updatePlayerProfileAction(input: unknown): Promise<PlayerActionResult> {
  const parsed = updatePlayerProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a display name." };
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    const existing = await repository.getPlayerAccount(accountId);
    if (parsed.data.name !== undefined && (!existing || existing.name !== parsed.data.name)) {
      await repository.updatePlayerAccountName(accountId, parsed.data.name);
    }
    if (parsed.data.gender !== undefined && (!existing || existing.gender !== parsed.data.gender)) {
      await repository.updatePlayerAccountGender(accountId, parsed.data.gender);
    }
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to update your profile." };
  }
}

export async function updatePlayerGenderAction(input: unknown): Promise<PlayerActionResult<{ gender: "male" | "female" }>> {
  const parsed = updatePlayerGenderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Select a valid gender." };
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    const existing = await repository.getPlayerAccount(accountId);
    if (existing && existing.gender === parsed.data.gender) {
      return { ok: true, data: { gender: parsed.data.gender } };
    }
    await repository.updatePlayerAccountGender(accountId, parsed.data.gender);
    return { ok: true, data: { gender: parsed.data.gender } };
  } catch {
    return { ok: false, error: "Unable to update your gender." };
  }
}

export async function updatePlayerUsernameAction(input: unknown): Promise<PlayerActionResult<{ username: string }>> {
  const raw =
    input && typeof input === "object" && "username" in input && typeof input.username === "string"
      ? input.username.replace(/^@/, "").trim()
      : typeof input === "string"
      ? input.replace(/^@/, "").trim()
      : "";
  const parsed = updatePlayerUsernameSchema.safeParse({ username: raw });
  if (!parsed.success) {
    return { ok: false, error: "Username must be 3 to 24 letters, numbers, or underscores." };
  }
  const username = parsed.data.username.toLowerCase();
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    const existing = await repository.getPlayerAccountByUsername(username);
    if (existing && existing.id !== accountId) {
      return { ok: false, error: "That username is already taken." };
    }
    await repository.updatePlayerAccountUsername(accountId, username);
    return { ok: true, data: { username } };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "23505" || error.code === "SQLITE_CONSTRAINT_UNIQUE")
    ) {
      return { ok: false, error: "That username is already taken." };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Unable to update username." };
  }
}

export async function checkUsernameAvailabilityAction(input: unknown): Promise<{ available: boolean }> {
  const raw =
    input && typeof input === "object" && "username" in input && typeof input.username === "string"
      ? input.username.replace(/^@/, "").trim()
      : typeof input === "string"
      ? input.replace(/^@/, "").trim()
      : "";
  const normalized = raw.toLowerCase();
  if (!normalized) {
    return { available: true };
  }
  try {
    const accountId = await getActivePlayerAccountId();
    const repository = getActionRepository();
    const existing = await repository.getPlayerAccountByUsername(normalized);
    if (existing && existing.id !== accountId) {
      return { available: false };
    }
    return { available: true };
  } catch {
    return { available: true };
  }
}

export async function joinPublicGroupAction(input: unknown): Promise<PlayerActionResult<{ groupId: string }>> {
  const parsed = joinPublicGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid group." };
  try {
    const accountId = await requirePlayer();
    const player = await getActionRepository().joinPublicGroup(accountId, parsed.data.groupId);
    if (!player) return { ok: false, error: "This group is private or no longer available." };
    return { ok: true, data: { groupId: parsed.data.groupId } };
  } catch {
    return { ok: false, error: "Unable to join this group. Please sign in and try again." };
  }
}

export async function leavePublicGroupAction(input: unknown): Promise<PlayerActionResult<{ groupId: string }>> {
  const parsed = joinPublicGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid group." };
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    const group = await repository.getGroup(parsed.data.groupId);
    if (group?.ownerAccountId === accountId) {
      return { ok: false, error: "Hosts cannot leave their own group." };
    }
    const left = await repository.leavePublicGroup(accountId, parsed.data.groupId);
    if (!left) return { ok: false, error: "You are no longer a member of this group." };
    return { ok: true, data: { groupId: parsed.data.groupId } };
  } catch {
    return { ok: false, error: "Unable to leave this group. Please sign in and try again." };
  }
}

export async function joinGroupViaInviteAction(input: unknown): Promise<PlayerActionResult<{ groupId: string }>> {
  const parsed = joinGroupInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid group." };
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    const group = await repository.getGroup(parsed.data.groupId);
    if (!group) return { ok: false, error: "This group does not exist." };
    const player = await repository.addPlayerToGroup(accountId, parsed.data.groupId);
    if (!player) return { ok: false, error: "Unable to join this group." };
    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/join`);
    revalidatePath(`/g/${parsed.data.groupId}/players`);
    revalidatePath("/players");
    revalidatePath("/players/groups");
    return { ok: true, data: { groupId: parsed.data.groupId } };
  } catch {
    return { ok: false, error: "Unable to join this group. Please sign in and try again." };
  }
}

function normalizeGuestName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export async function joinAsGuestAction(
  input: unknown,
): Promise<PlayerActionResult<{ playerId: string; groupId: string; rejoined: boolean }>> {
  const parsed = joinAsGuestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { ok: false, error: "Please enter your name.", fieldErrors };
  }
  try {
    const repository = getActionRepository();
    const group = await repository.getGroup(parsed.data.groupId);
    if (!group) return { ok: false, error: "This group does not exist." };

    // Organizers often pre-add regulars as guests before sharing the invite link.
    // A guest who joins under the same name is that person: reuse their roster
    // spot instead of creating a twin who would be scheduled on two courts.
    const wantedName = normalizeGuestName(parsed.data.name);
    const roster = await repository.listPlayers(parsed.data.groupId);
    const existingGuest = roster.find(
      (player) => player.active && !player.accountId && normalizeGuestName(player.name) === wantedName,
    );
    if (existingGuest) {
      await recordGuestPlayer(parsed.data.groupId, existingGuest.id);
      revalidatePath(`/g/${parsed.data.groupId}`);
      return { ok: true, data: { playerId: existingGuest.id, groupId: parsed.data.groupId, rejoined: true } };
    }

    const initialRating = parsed.data.initialRating ?? DEFAULT_RATING[parsed.data.skillLevel ?? "intermediate"];
    const playerId = `ply_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const newPlayer = {
      id: playerId,
      groupId: parsed.data.groupId,
      name: parsed.data.name,
      initialRating,
      rating: initialRating,
      ratedGamesPlayed: 0,
      active: true,
      accountId: null,
    };
    await repository.createPlayer(newPlayer);
    await recordGuestPlayer(parsed.data.groupId, playerId);
    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/join`);
    revalidatePath(`/g/${parsed.data.groupId}/players`);
    return { ok: true, data: { playerId, groupId: parsed.data.groupId, rejoined: false } };
  } catch (error) {
    console.error("joinAsGuestAction failed", error);
    return { ok: false, error: "We couldn't add you to this group right now. Please try again in a moment." };
  }
}

export async function requestPasswordResetAction(input: unknown): Promise<PlayerActionResult<{ message: string }>> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid username or email address." };
  }
  const identifier = parsed.data.identifier.toLowerCase();
  try {
    const repository = getActionRepository();
    let account = await repository.getPlayerAccountByUsername(identifier);
    if (!account && identifier.includes("@")) {
      account = await repository.getPlayerAccountByEmail(identifier);
    }

    if (account && account.email) {
      await repository.deletePasswordResetTokensForAccount(account.id);
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      await repository.createPasswordResetToken({
        id: `rst_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        accountId: account.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        createdAt: new Date(),
      });

      await sendPasswordResetEmail({
        to: account.email,
        name: account.name,
        resetUrl: `${getAppBaseUrl()}/reset-password?token=${rawToken}`,
      });
    }

    return {
      ok: true,
      data: {
        message: "If an account matches that username or email address with recovery configured, we've sent a password reset link.",
      },
    };
  } catch {
    return { ok: false, error: "Unable to process password reset request right now." };
  }
}

export async function resetPasswordAction(input: unknown): Promise<PlayerActionResult<{ success: boolean }>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Password must be at least 10 characters." };
  }
  if (Buffer.byteLength(parsed.data.password, "utf8") > 72) {
    return { ok: false, error: "Password must be 72 bytes or fewer." };
  }
  try {
    const repository = getActionRepository();
    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const tokenRecord = await repository.getPasswordResetToken(tokenHash);

    if (!tokenRecord || new Date() > tokenRecord.expiresAt) {
      return { ok: false, error: "This password reset link is invalid or has expired. Please request a new one." };
    }

    const newPasswordHash = await hash(parsed.data.password, PASSWORD_HASH_COST);
    await repository.updatePlayerAccountPassword(tokenRecord.accountId, newPasswordHash);
    await repository.deletePasswordResetToken(tokenRecord.id);

    return { ok: true, data: { success: true } };
  } catch {
    return { ok: false, error: "Unable to reset password. Please try again." };
  }
}

export async function updateRecoveryEmailAction(input: unknown): Promise<PlayerActionResult<{ email: string }>> {
  const parsed = updateRecoveryEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    const account = await repository.getPlayerAccount(accountId);
    if (!account) throw new Error("Player account not found.");
    const normalizedEmail = parsed.data.email.toLowerCase();

    const existing = await repository.getPlayerAccountByEmail(normalizedEmail);
    if (existing && existing.id !== account.id) {
      return {
        ok: false,
        error: "That email is already registered to another account.",
        fieldErrors: { email: ["That email is already registered."] },
      };
    }

    await repository.updatePlayerAccountEmail(account.id, normalizedEmail, false);

    await repository.deleteEmailVerificationTokensForAccount(account.id);
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await repository.createEmailVerificationToken({
      id: `vtok_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      accountId: account.id,
      email: normalizedEmail,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
    });

    const emailResult = await sendEmailVerificationEmail({
      to: normalizedEmail,
      name: account.name,
      verifyUrl: `${getAppBaseUrl()}/verify-email?token=${rawToken}`,
    });

    if (!emailResult.success) {
      return { ok: false, error: emailResult.error || "Failed to deliver verification email. Please check your email configuration." };
    }

    try {
      revalidatePath("/players");
      revalidatePath("/");
    } catch {
      // Non-request test contexts.
    }
    return { ok: true, data: { email: normalizedEmail } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to update recovery email." };
  }
}

export async function verifyEmailAction(input: unknown): Promise<PlayerActionResult<{ email: string }>> {
  const parsed = verifyEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid verification link." };
  }
  try {
    const repository = getActionRepository();
    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const tokenRecord = await repository.getEmailVerificationToken(tokenHash);

    if (!tokenRecord || new Date() > tokenRecord.expiresAt) {
      return { ok: false, error: "This email verification link is invalid or has expired." };
    }

    await repository.updatePlayerAccountEmail(tokenRecord.accountId, tokenRecord.email, true);
    await repository.deleteEmailVerificationToken(tokenRecord.id);

    try {
      revalidatePath("/players");
      revalidatePath("/");
    } catch {
      // Non-request test contexts.
    }
    return { ok: true, data: { email: tokenRecord.email } };
  } catch {
    return { ok: false, error: "Unable to verify email." };
  }
}

export async function resendVerificationEmailAction(): Promise<PlayerActionResult<void>> {
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    const account = await repository.getPlayerAccount(accountId);
    if (!account) throw new Error("Player account not found.");
    if (!account.email) {
      return { ok: false, error: "No recovery email found. Please add an email address first." };
    }
    if (account.emailVerified) {
      return { ok: true, data: undefined };
    }
    await repository.deleteEmailVerificationTokensForAccount(account.id);
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await repository.createEmailVerificationToken({
      id: `vtok_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      accountId: account.id,
      email: account.email,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });

    const emailResult = await sendEmailVerificationEmail({
      to: account.email,
      name: account.name,
      verifyUrl: `${getAppBaseUrl()}/verify-email?token=${rawToken}`,
    });

    if (!emailResult.success) {
      return { ok: false, error: emailResult.error || "Failed to deliver verification email. Please check your email configuration." };
    }

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to send verification email." };
  }
}
