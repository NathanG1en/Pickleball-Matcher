"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { getActionRepository, requirePlayer } from "@/app/actions/action-context";
import { authenticateOrganizerPin, hashPin } from "@/lib/auth/pin";
import {
  createOrganizerSession,
  getOrganizerSessionSecret,
  ORGANIZER_SESSION_COOKIE,
} from "@/lib/auth/session";
import { createAccountGroupSchema, createGroupSchema, organizerLoginSchema } from "@/lib/validation/group";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createAccountGroupAction(input: unknown): Promise<ActionResult<{ groupId: string; name: string }>> {
  const parsed = createAccountGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid group name.", fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    if ((await repository.getGroupsByName(parsed.data.name)).length > 0) {
      return { ok: false, error: "A group with this exact name already exists.", fieldErrors: { name: ["This group name is already taken."] } };
    }
    const groupId = `grp_${randomUUID().slice(0, 10)}`;
    await repository.insertGroup({
      id: groupId,
      name: parsed.data.name,
      organizerPinHash: await hashPin(randomUUID()),
      createdAt: new Date(),
      isPublic: parsed.data.isPublic,
      ownerAccountId: accountId,
    });
    return { ok: true, data: { groupId, name: parsed.data.name } };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error.code === "23505" || error.code === "SQLITE_CONSTRAINT_UNIQUE")) {
      return { ok: false, error: "A group with this exact name already exists.", fieldErrors: { name: ["This group name is already taken."] } };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Unable to create group." };
  }
}

export async function createGroupAction(input: unknown): Promise<ActionResult<{ groupId: string; name: string }>> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    const errorMap = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: "Please correct the errors in the form.",
      fieldErrors: errorMap,
    };
  }

  const expectedSetupToken = process.env.SETUP_TOKEN;
  if (!expectedSetupToken || parsed.data.setupToken !== expectedSetupToken) {
    return { ok: false, error: "Invalid or missing setup token", fieldErrors: { setupToken: ["Check the setup token and try again."] } };
  }

  try {
    const repository = getActionRepository();
    if ((await repository.getGroupsByName(parsed.data.name)).length > 0) {
      return { ok: false, error: "A group with this exact name already exists.", fieldErrors: { name: ["This group name is already taken."] } };
    }
    const groupId = `grp_${randomUUID().slice(0, 10)}`;
    const pinHash = await hashPin(parsed.data.pin);

    await repository.insertGroup({
      id: groupId,
      name: parsed.data.name,
      organizerPinHash: pinHash,
      createdAt: new Date(),
      isPublic: parsed.data.isPublic,
    });

    const session = await createOrganizerSession({
      groupId,
      secret: getOrganizerSessionSecret(),
    });

    try {
      const cookieStore = await cookies();
      cookieStore.set(session.cookie.name, session.cookie.value, session.cookie.options);
    } catch {
      // In non-request test contexts cookies() may throw
    }

    return {
      ok: true,
      data: {
        groupId,
        name: parsed.data.name,
      },
    };
  } catch (error) {
    if (
      error && typeof error === "object" && "code" in error &&
      (error.code === "23505" || error.code === "SQLITE_CONSTRAINT_UNIQUE")
    ) {
      return { ok: false, error: "A group with this exact name already exists.", fieldErrors: { name: ["This group name is already taken."] } };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create group",
    };
  }
}

export async function organizerLoginAction(input: unknown): Promise<ActionResult<{ groupId: string }>> {
  const parsed = organizerLoginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please enter a valid group name and PIN",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const repository = getActionRepository();
    const groups = await repository.getGroupsByName(parsed.data.groupName);
    const matches = await Promise.all(
      groups.map(async (group) => ({
        group,
        auth: await authenticateOrganizerPin(parsed.data.pin, group.organizerPinHash),
      })),
    );
    const matchingGroups = matches.filter(({ auth }) => auth.ok);

    if (matchingGroups.length !== 1) {
      if (groups.length === 0) await authenticateOrganizerPin(parsed.data.pin, null);
      return { ok: false, error: "Unable to sign in. Check your group name and PIN." };
    }

    const groupId = matchingGroups[0].group.id;

    const session = await createOrganizerSession({
      groupId,
      secret: getOrganizerSessionSecret(),
    });

    try {
      const cookieStore = await cookies();
      cookieStore.set(session.cookie.name, session.cookie.value, session.cookie.options);
    } catch {
      // Non-request test contexts
    }

    return { ok: true, data: { groupId } };
  } catch {
    return { ok: false, error: "Unable to sign in. Check your group name and PIN." };
  }
}

export async function organizerLogoutAction(): Promise<ActionResult> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ORGANIZER_SESSION_COOKIE);
  } catch {
    // Non-request test contexts
  }
  return { ok: true, data: undefined };
}
