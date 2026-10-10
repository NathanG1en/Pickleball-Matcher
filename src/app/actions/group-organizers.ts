"use server";

import { revalidatePath } from "next/cache";
import {
  getActionRepository,
  getActiveOrganizerSession,
  getActivePlayerAccountId,
  requirePlayer,
} from "@/app/actions/action-context";
import {
  addGroupOrganizerSchema,
  addGroupPlayerSchema,
  removeGroupOrganizerSchema,
  removeGroupPlayerSchema,
} from "@/lib/validation/group";

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

export async function removeGroupOrganizerAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = removeGroupOrganizerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    const group = await repository.getGroup(parsed.data.groupId);
    if (!group || group.ownerAccountId !== accountId) return { ok: false, error: "Only the host can remove organizers." };
    const player = (await repository.listPlayers(group.id)).find(({ id }) => id === parsed.data.playerId);
    if (!player?.accountId) return { ok: false, error: "This player does not have an organizer account." };
    if (player.accountId === accountId) return { ok: false, error: "The host cannot be removed as an organizer." };
    await repository.removeGroupOrganizer(group.id, player.accountId);
    revalidatePath(`/g/${group.id}`);
    revalidatePath("/players");
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to remove this organizer." };
  }
}

export async function removeGroupPlayerAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = removeGroupPlayerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    const repository = getActionRepository();
    const group = await repository.getGroup(parsed.data.groupId);
    if (!group) return { ok: false, error: "Group not found." };

    const accountId = await getActivePlayerAccountId();
    const isHost = Boolean(accountId && group.ownerAccountId === accountId);
    const isAccountOrganizer = Boolean(accountId && (await repository.isGroupOrganizer(parsed.data.groupId, accountId)));
    const organizerSession = await getActiveOrganizerSession();
    const isSessionOrganizer = Boolean(organizerSession && organizerSession.groupId === parsed.data.groupId);

    if (!isHost && !isAccountOrganizer && !isSessionOrganizer) {
      return { ok: false, error: "Only the host or a group organizer can remove players." };
    }

    const player = (await repository.listPlayers(parsed.data.groupId, { includeInactive: true })).find(
      ({ id }) => id === parsed.data.playerId,
    );
    if (!player) return { ok: false, error: "Player not found." };

    if (player.accountId && player.accountId === group.ownerAccountId) {
      return { ok: false, error: "The host cannot be removed from the group." };
    }

    if (!isHost) {
      const isTargetOrganizer = Boolean(
        player.accountId && (await repository.isGroupOrganizer(parsed.data.groupId, player.accountId)),
      );
      if (isTargetOrganizer) {
        return { ok: false, error: "Only the host can remove organizers." };
      }
    }

    const removed = await repository.removePlayerFromGroup(parsed.data.playerId, parsed.data.groupId);
    if (!removed) return { ok: false, error: "Unable to remove this player." };

    revalidatePath(`/g/${group.id}`);
    revalidatePath(`/g/${group.id}/players`);
    revalidatePath("/players");
    revalidatePath("/players/groups");
    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to remove this player." };
  }
}
