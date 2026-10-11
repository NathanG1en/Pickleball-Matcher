"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  getActionRepository,
  getActivePlayerAccountId,
  requireOrganizer,
} from "@/app/actions/action-context";
import type { ActionResult } from "@/app/actions/auth";
import type { PlayerRecord } from "@/lib/domain/types";
import { resolveProfileVisibility, type SanitizedProfileView } from "@/lib/privacy/profile-visibility";
import { createPlayerSchema, deletePlayerSchema, updatePlayerSchema } from "@/lib/validation/group";

export interface SearchPlayerResult extends SanitizedProfileView {
  readonly alreadyInGroup: boolean;
}

const searchPlayersSchema = z.object({
  query: z.string().trim().min(2, "Search query must be at least 2 characters"),
  groupId: z.string(),
});

const updatePrivacySchema = z.union([
  z.boolean().transform((isPublic) => ({ isPublic })),
  z.object({
    isPublic: z.boolean(),
  }),
]);

const addPlayerByAccountSchema = z.object({
  groupId: z.string(),
  accountId: z.string(),
});

export async function createPlayerAction(input: unknown): Promise<ActionResult<PlayerRecord>> {
  const parsed = createPlayerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid player data",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const repository = getActionRepository();
    const newPlayer: PlayerRecord = {
      id: `p_${randomUUID().slice(0, 10)}`,
      groupId: parsed.data.groupId,
      name: parsed.data.name,
      initialRating: parsed.data.initialRating,
      rating: parsed.data.initialRating,
      ratedGamesPlayed: 0,
      active: true,
    };
    await repository.createPlayer(newPlayer);
    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/players`);
    revalidatePath("/players");
    return { ok: true, data: newPlayer };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create player";
    return { ok: false, error: message };
  }
}

export async function updatePlayerAction(input: unknown): Promise<ActionResult> {
  const parsed = updatePlayerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid player update data",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const repository = getActionRepository();
    await repository.updatePlayer({
      id: parsed.data.playerId,
      groupId: parsed.data.groupId,
      name: parsed.data.name,
      active: parsed.data.active,
      initialRating: parsed.data.initialRating,
    });
    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update player";
    return { ok: false, error: message };
  }
}

export async function deletePlayerAction(input: unknown): Promise<ActionResult> {
  const parsed = deletePlayerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid player delete data",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const repository = getActionRepository();
    await repository.deletePlayer(parsed.data.playerId, parsed.data.groupId);
    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete player";
    return { ok: false, error: message };
  }
}

export async function searchPlayersByUsernameAction(
  input: unknown,
): Promise<ActionResult<readonly SearchPlayerResult[]>> {
  const parsed = searchPlayersSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid search query",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const repository = getActionRepository();
    const viewerAccountId = await getActivePlayerAccountId();
    const [matchingAccounts, groupPlayers] = await Promise.all([
      repository.searchPlayerAccounts(parsed.data.query, 10),
      repository.listPlayers(parsed.data.groupId),
    ]);

    const groupAccountIds = new Set(
      groupPlayers.map((p) => p.accountId).filter(Boolean) as string[],
    );

    const results: SearchPlayerResult[] = await Promise.all(
      matchingAccounts.map(async (account) => {
        const [bestPartner, pairSynergy] = await Promise.all([
          repository.getBestPartner(account.id),
          viewerAccountId && viewerAccountId !== account.id
            ? repository.getPairSynergy(viewerAccountId, account.id)
            : Promise.resolve(null),
        ]);

        const sanitized = resolveProfileVisibility(viewerAccountId, account, {
          bestPartner,
          viewerSynergyScore: pairSynergy?.synergyScore ?? null,
        });

        return {
          ...sanitized,
          alreadyInGroup: groupAccountIds.has(account.id),
        };
      }),
    );

    return { ok: true, data: results };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to search players";
    return { ok: false, error: message };
  }
}

export async function updatePlayerPrivacyAction(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = updatePrivacySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid privacy setting",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const accountId = await getActivePlayerAccountId();
    if (!accountId) {
      return { ok: false, error: "You must be signed in to change privacy settings." };
    }
    const repository = getActionRepository();
    await repository.updatePlayerPrivacy(accountId, parsed.data.isPublic);
    try {
      revalidatePath("/players");
    } catch {
      // Non-request test contexts.
    }
    return { ok: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update privacy";
    return { ok: false, error: message };
  }
}

export async function addPlayerByAccountIdAction(
  input: unknown,
): Promise<ActionResult<PlayerRecord>> {
  const parsed = addPlayerByAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const repository = getActionRepository();
    const player = await repository.addPlayerToGroup(parsed.data.accountId, parsed.data.groupId);
    if (!player) {
      return { ok: false, error: "Failed to add player to group roster." };
    }
    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/players`);
    revalidatePath("/players");
    revalidatePath("/players/groups");
    return { ok: true, data: player };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add player to group";
    return { ok: false, error: message };
  }
}
