"use server";

import { revalidatePath } from "next/cache";
import { getActionRepository, requireOrganizer } from "@/app/actions/action-context";
import {
  updateGroupNameSchema,
  updateGroupVisibilitySchema,
} from "@/lib/validation/group";

export async function updateGroupVisibilityAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = updateGroupVisibilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid group visibility setting." };
  try {
    await requireOrganizer(parsed.data.groupId);
    await getActionRepository().updateGroupVisibility(parsed.data.groupId, parsed.data.isPublic);
    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath("/players/groups");
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to update group visibility." };
  }
}

export async function updateGroupNameAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = updateGroupNameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid group name." };
  }
  try {
    await requireOrganizer(parsed.data.groupId);
    const repository = getActionRepository();
    const group = await repository.getGroup(parsed.data.groupId);
    if (!group) return { ok: false, error: "Group not found." };
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
  } catch {
    return { ok: false, error: "Unable to update group name." };
  }
}
