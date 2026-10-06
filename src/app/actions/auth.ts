"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { getActionRepository } from "@/app/actions/action-context";
import { authenticateOrganizerPin, hashPin } from "@/lib/auth/pin";
import {
  createOrganizerSession,
  ORGANIZER_SESSION_COOKIE,
} from "@/lib/auth/session";
import { createGroupSchema, organizerLoginSchema } from "@/lib/validation/group";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createGroupAction(input: unknown): Promise<ActionResult<{ groupId: string; publicShareId: string; name: string }>> {
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
    return { ok: false, error: "Invalid or missing setup token" };
  }

  try {
    const repository = getActionRepository();
    const groupId = `grp_${randomUUID().slice(0, 10)}`;
    const publicShareId = `shr_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const pinHash = await hashPin(parsed.data.pin);

    await repository.insertGroup({
      id: groupId,
      name: parsed.data.name,
      organizerPinHash: pinHash,
      publicShareId,
      createdAt: new Date(),
    });

    const sessionSecret = process.env.ORGANIZER_SESSION_SECRET ?? process.env.SESSION_SECRET ?? "fallback-development-session-secret-32-chars!!";
    const session = await createOrganizerSession({
      groupId,
      secret: sessionSecret,
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
        publicShareId,
        name: parsed.data.name,
      },
    };
  } catch (error) {
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
      error: "Please enter a valid Group ID and PIN",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const repository = getActionRepository();
    const group = await repository.getGroup(parsed.data.groupId);

    const authResult = await authenticateOrganizerPin(
      parsed.data.pin,
      group?.organizerPinHash ?? null,
    );

    if (!authResult.ok) {
      return { ok: false, error: "Unable to sign in. Invalid PIN or group ID." };
    }

    const sessionSecret = process.env.ORGANIZER_SESSION_SECRET ?? process.env.SESSION_SECRET ?? "fallback-development-session-secret-32-chars!!";
    const session = await createOrganizerSession({
      groupId: parsed.data.groupId,
      secret: sessionSecret,
    });

    try {
      const cookieStore = await cookies();
      cookieStore.set(session.cookie.name, session.cookie.value, session.cookie.options);
    } catch {
      // Non-request test contexts
    }

    return { ok: true, data: { groupId: parsed.data.groupId } };
  } catch {
    return { ok: false, error: "Unable to sign in. Invalid PIN or group ID." };
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
