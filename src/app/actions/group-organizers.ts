"use server";

import { revalidatePath } from "next/cache";
import { getActionRepository, requirePlayer } from "@/app/actions/action-context";
import { addGroupOrganizerSchema, addGroupPlayerSchema } from "@/lib/validation/group";

export async function addGroupPlayerByUsernameAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = addGroupPlayerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid username." };
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    const group = await repository.getGroup(parsed.data.groupId);
    if (!group || group.ownerAccountId !== accountId) return { ok: false, error: "Only the host can add players by username." };
    const account = await repository.getPlayerAccountByUsername(parsed.data.username.toLowerCase());
    if (!account) return { ok: false, error: "No player account uses that username." };
    const existing = (await repository.listPlayers(group.id)).find((player) => player.accountId === account.id);
    if (existing?.active) return { ok: false, error: "That player is already on the roster." };
    const player = await repository.joinPublicGroup(account.id, group.id);
    if (!player) return { ok: false, error: "Unable to add that player to the roster." };
    revalidatePath(`/g/${group.id}`);
    revalidatePath(`/g/${group.id}/players`);
    revalidatePath("/players");
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to look up that player." };
  }
}

export async function addGroupOrganizerAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = addGroupOrganizerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid player username." };
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    const group = await repository.getGroup(parsed.data.groupId);
    if (!group || group.ownerAccountId !== accountId) return { ok: false, error: "Only the host can add organizers." };
    const player = (await repository.listPlayers(group.id)).find(({ id }) => id === parsed.data.playerId);
    if (!player?.accountId) return { ok: false, error: "This player must have an account to become an organizer." };
    if (player.accountId === accountId) return { ok: false, error: "You are already the host." };
    await repository.addGroupOrganizer(group.id, player.accountId);
    revalidatePath(`/g/${group.id}`);
    revalidatePath("/players");
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to add this organizer." };
  }
}
