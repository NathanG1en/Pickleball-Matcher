"use server";

import { randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { getActionRepository, requirePlayer } from "@/app/actions/action-context";
import { createPlayerSession, PLAYER_SESSION_COOKIE, playerSessionCookieOptions } from "@/lib/auth/player-session";
import { joinPublicGroupSchema, playerLoginSchema, playerSignupSchema, updatePlayerProfileSchema } from "@/lib/validation/group";

const PASSWORD_HASH_COST = 12;
const DUMMY_PASSWORD_HASH = "$2b$12$yoKkl6R41eRMnWhvkZXPwee8aIS8qKjN5GbU0DiCsria7Dpjo5rDC";
const DEFAULT_RATING = { beginner: 900, intermediate: 1_000, advanced: 1_100 } as const;

export type PlayerActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function playerSignupAction(input: unknown): Promise<PlayerActionResult<{ accountId: string }>> {
  const parsed = playerSignupSchema.safeParse(input);
  const submittedUsername =
    input && typeof input === "object" && "username" in input && typeof input.username === "string"
      ? input.username.trim().toLowerCase()
      : "";
  const usernameValidation = playerSignupSchema.shape.username.safeParse(submittedUsername);
  const repository = getActionRepository();
  let usernameTaken = false;
  if (usernameValidation.success) {
    try {
      usernameTaken = Boolean(await repository.getPlayerAccountByUsername(submittedUsername));
    } catch {
      return { ok: false, error: "Unable to check username availability. Please try again." };
    }
  }
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (usernameTaken) fieldErrors.username = ["That username is already taken."];
    return { ok: false, error: "Please check your player details and try again.", fieldErrors };
  }
  if (Buffer.byteLength(parsed.data.password, "utf8") > 72) {
    const fieldErrors: Record<string, string[]> = { password: ["Password must be 72 bytes or fewer."] };
    if (usernameTaken) fieldErrors.username = ["That username is already taken."];
    return { ok: false, error: "Please check your player details and try again.", fieldErrors };
  }

  const username = parsed.data.username.toLowerCase();
  try {
    if (usernameTaken) {
      return { ok: false, error: "That username is already taken.", fieldErrors: { username: ["That username is already taken."] } };
    }
    const accountId = `usr_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const account = {
      id: accountId,
      username,
      name: parsed.data.name,
      passwordHash: await hash(parsed.data.password, PASSWORD_HASH_COST),
      skillLevel: parsed.data.skillLevel,
      initialRating: parsed.data.customRating ? parsed.data.initialRating : DEFAULT_RATING[parsed.data.skillLevel],
      createdAt: new Date(),
    };
    await repository.createPlayerAccount(account);
    const token = await createPlayerSession(accountId);
    try {
      (await cookies()).set(PLAYER_SESSION_COOKIE, token, playerSessionCookieOptions);
    } catch {
      // Non-request test contexts.
    }
    return { ok: true, data: { accountId } };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error.code === "23505" || error.code === "SQLITE_CONSTRAINT_UNIQUE")) {
      return { ok: false, error: "That username is already taken.", fieldErrors: { username: ["That username is already taken."] } };
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
    await getActionRepository().updatePlayerAccountName(accountId, parsed.data.name);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to update your profile." };
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
