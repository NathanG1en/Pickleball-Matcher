"use server";

import { revalidatePath } from "next/cache";
import {
  getActionRepository,
  requireGroupPermission,
  requireGroupHost,
} from "@/app/actions/action-context";
import {
  deleteGroupSchema,
  updateGroupNameSchema,
  updateGroupPermissionsSchema,
  updateGroupVisibilitySchema,
} from "@/lib/validation/group";

export async function updateGroupVisibilityAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = updateGroupVisibilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid group visibility setting." };
  try {
    await requireGroupPermission(parsed.data.groupId, "edit_group_privacy");
    await getActionRepository().updateGroupVisibility(parsed.data.groupId, parsed.data.isPublic);
    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath("/players/groups");
    return { ok: true };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AuthorizationError") {
      return { ok: false, error: "You do not have permission to edit group privacy." };
    }
    return { ok: false, error: "Unable to update group visibility." };
  }
}

export async function updateGroupNameAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = updateGroupNameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid group name." };
  }
  try {
    const { group } = await requireGroupPermission(parsed.data.groupId, "edit_group_name");
    const repository = getActionRepository();
    const trimmed = parsed.data.name.trim();
    if (trimmed === group.name.trim()) return { ok: true };

    const existing = await repository.getGroupsByName(trimmed);
    if (existing.some((g) => g.id !== group.id)) {
      return { ok: false, error: "A group with this exact name already exists." };
    }

    await repository.updateGroupName(group.id, trimmed);
    revalidatePath(`/g/${group.id}`);
    revalidatePath("/players");
    revalidatePath("/players/groups");
    return { ok: true };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AuthorizationError") {
      return { ok: false, error: "You do not have permission to edit the group name." };
    }
    return { ok: false, error: "Unable to update group name." };
  }
}

export async function updateGroupPermissionsAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = updateGroupPermissionsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid permissions data." };
  }
  try {
    await requireGroupHost(parsed.data.groupId);
    await getActionRepository().updateGroupOrganizerPermissions(
      parsed.data.groupId,
      parsed.data.permissions,
    );
    revalidatePath(`/g/${parsed.data.groupId}`);
    return { ok: true };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AuthorizationError") {
      return { ok: false, error: "Only the host can configure organizer permissions." };
    }
    return { ok: false, error: "Unable to update organizer permissions." };
  }
}

export async function deleteGroupAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = deleteGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter the group name to confirm." };
  }
  try {
    const { group } = await requireGroupPermission(parsed.data.groupId, "delete_group");
    const repository = getActionRepository();
    if (group.name.trim() !== parsed.data.confirmationName.trim()) {
      return { ok: false, error: "Group name does not match." };
    }

    await repository.deleteGroup(group.id);
    revalidatePath("/players");
    revalidatePath("/players/groups");
    revalidatePath("/");
    return { ok: true };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AuthorizationError") {
      return { ok: false, error: "You do not have permission to delete this group." };
    }
    return { ok: false, error: "Unable to delete group." };
  }
}
