"use server";

import { randomUUID } from "node:crypto";

import { getActionRepository, requireOrganizer } from "@/app/actions/action-context";
import type { ActionResult } from "@/app/actions/auth";
import type { PlayerRecord } from "@/lib/domain/types";
import { createPlayerSchema, updatePlayerSchema } from "@/lib/validation/group";

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
