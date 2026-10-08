"use server";

import { revalidatePath } from "next/cache";
import { getActionRepository, requireOrganizer } from "@/app/actions/action-context";
import { updateGroupVisibilitySchema } from "@/lib/validation/group";

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
