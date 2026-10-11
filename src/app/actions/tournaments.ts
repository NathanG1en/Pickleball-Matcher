"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  getActionRepository,
  requireOrganizer,
} from "@/app/actions/action-context";
import type { ActionResult } from "@/app/actions/auth";
import type {
  TournamentBracket,
  TournamentRecord,
} from "@/lib/domain/types";
import {
  createParticipantsForDivision,
  generateBracket,
  reshuffleBracketMatchups,
  setMatchWinner,
  swapParticipants,
  updateMatchParticipant,
} from "@/lib/tournament/bracket";
import {
  createTournamentSchema,
  editParticipantSlotSchema,
  reshuffleDivisionSchema,
  swapTournamentSlotsSchema,
  updateTournamentMatchSchema,
  updateTournamentNameSchema,
  updateTournamentStatusSchema,
} from "@/lib/validation/tournament";

export async function createTournamentAction(
  input: unknown,
): Promise<ActionResult<TournamentRecord>> {
  const parsed = createTournamentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid tournament parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { groupId, name, divisions, playerIds, playerGenders } = parsed.data;
    await requireOrganizer(groupId);
    const repo = getActionRepository();

    const allPlayers = await repo.listPlayers(groupId, { includeInactive: false });

    // Apply gender overrides if provided
    if (playerGenders) {
      for (const [pId, gender] of Object.entries(playerGenders)) {
        const existing = allPlayers.find((p) => p.id === pId);
        if (existing && existing.gender !== gender) {
          existing.gender = gender;
          await repo.updatePlayer({ id: pId, groupId, gender });
        }
      }
    }

    const selectedPlayers = allPlayers.filter((p) => playerIds.includes(p.id));

    if (selectedPlayers.length < 2) {
      return {
        ok: false,
        error: "At least 2 players are required to create a tournament.",
      };
    }

    const brackets: Record<string, TournamentBracket> = {};
    for (const div of divisions) {
      const participants = createParticipantsForDivision(div, selectedPlayers);
      brackets[div] = generateBracket(div, participants, { randomize: true });
    }

    const now = new Date();
    const tournament: TournamentRecord = {
      id: `tr_${randomUUID().slice(0, 12)}`,
      groupId,
      name,
      status: "active",
      divisions,
      brackets,
      createdAt: now,
      updatedAt: now,
    };

    await repo.createTournament(tournament);
    revalidatePath(`/g/${groupId}`);
    return { ok: true, data: tournament };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create tournament",
    };
  }
}

export async function updateTournamentMatchAction(
  input: unknown,
): Promise<ActionResult<TournamentRecord>> {
  const parsed = updateTournamentMatchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid match update parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { tournamentId, groupId, division, matchId, winnerId, score1, score2 } = parsed.data;
    await requireOrganizer(groupId);
    const repo = getActionRepository();

    const tournament = await repo.getTournament(tournamentId);
    if (!tournament || tournament.groupId !== groupId) {
      return { ok: false, error: "Tournament not found" };
    }

    const bracket = tournament.brackets[division];
    if (!bracket) {
      return { ok: false, error: "Division bracket not found" };
    }

    const updatedBracket = setMatchWinner(
      bracket,
      matchId,
      winnerId ?? null,
      score1 !== undefined || score2 !== undefined ? { score1: score1 ?? null, score2: score2 ?? null } : undefined,
    );

    const updatedTournament: TournamentRecord = {
      ...tournament,
      brackets: {
        ...tournament.brackets,
        [division]: updatedBracket,
      },
      updatedAt: new Date(),
    };

    await repo.updateTournament(updatedTournament);
    revalidatePath(`/g/${groupId}/tournaments/${tournamentId}`);
    return { ok: true, data: updatedTournament };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update match",
    };
  }
}

export async function swapTournamentSlotsAction(
  input: unknown,
): Promise<ActionResult<TournamentRecord>> {
  const parsed = swapTournamentSlotsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid slot swap parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { tournamentId, groupId, division, match1Id, slot1, match2Id, slot2 } = parsed.data;
    await requireOrganizer(groupId);
    const repo = getActionRepository();

    const tournament = await repo.getTournament(tournamentId);
    if (!tournament || tournament.groupId !== groupId) {
      return { ok: false, error: "Tournament not found" };
    }

    const bracket = tournament.brackets[division];
    if (!bracket) {
      return { ok: false, error: "Division bracket not found" };
    }

    const updatedBracket = swapParticipants(bracket, match1Id, slot1, match2Id, slot2);

    const updatedTournament: TournamentRecord = {
      ...tournament,
      brackets: {
        ...tournament.brackets,
        [division]: updatedBracket,
      },
      updatedAt: new Date(),
    };

    await repo.updateTournament(updatedTournament);
    revalidatePath(`/g/${groupId}/tournaments/${tournamentId}`);
    return { ok: true, data: updatedTournament };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to swap slots",
    };
  }
}

export async function editTournamentSlotAction(
  input: unknown,
): Promise<ActionResult<TournamentRecord>> {
  const parsed = editParticipantSlotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid slot edit parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { tournamentId, groupId, division, matchId, slot, newParticipantId } = parsed.data;
    await requireOrganizer(groupId);
    const repo = getActionRepository();

    const tournament = await repo.getTournament(tournamentId);
    if (!tournament || tournament.groupId !== groupId) {
      return { ok: false, error: "Tournament not found" };
    }

    const bracket = tournament.brackets[division];
    if (!bracket) {
      return { ok: false, error: "Division bracket not found" };
    }

    const updatedBracket = updateMatchParticipant(bracket, matchId, slot, newParticipantId);

    const updatedTournament: TournamentRecord = {
      ...tournament,
      brackets: {
        ...tournament.brackets,
        [division]: updatedBracket,
      },
      updatedAt: new Date(),
    };

    await repo.updateTournament(updatedTournament);
    revalidatePath(`/g/${groupId}/tournaments/${tournamentId}`);
    return { ok: true, data: updatedTournament };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to edit slot",
    };
  }
}

export async function reshuffleTournamentDivisionAction(
  input: unknown,
): Promise<ActionResult<TournamentRecord>> {
  const parsed = reshuffleDivisionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid reshuffle parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { tournamentId, groupId, division } = parsed.data;
    await requireOrganizer(groupId);
    const repo = getActionRepository();

    const tournament = await repo.getTournament(tournamentId);
    if (!tournament || tournament.groupId !== groupId) {
      return { ok: false, error: "Tournament not found" };
    }

    const bracket = tournament.brackets[division];
    if (!bracket) {
      return { ok: false, error: "Division bracket not found" };
    }

    const updatedBracket = reshuffleBracketMatchups(bracket);

    const updatedTournament: TournamentRecord = {
      ...tournament,
      brackets: {
        ...tournament.brackets,
        [division]: updatedBracket,
      },
      updatedAt: new Date(),
    };

    await repo.updateTournament(updatedTournament);
    revalidatePath(`/g/${groupId}/tournaments/${tournamentId}`);
    return { ok: true, data: updatedTournament };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reshuffle matchups",
    };
  }
}

export async function updateTournamentNameAction(
  input: unknown,
): Promise<ActionResult<TournamentRecord>> {
  const parsed = updateTournamentNameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid tournament name",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { tournamentId, groupId, name } = parsed.data;
    await requireOrganizer(groupId);
    const repo = getActionRepository();

    const tournament = await repo.getTournament(tournamentId);
    if (!tournament || tournament.groupId !== groupId) {
      return { ok: false, error: "Tournament not found" };
    }

    const updatedTournament: TournamentRecord = {
      ...tournament,
      name,
      updatedAt: new Date(),
    };

    await repo.updateTournament(updatedTournament);
    revalidatePath(`/g/${groupId}/tournaments/${tournamentId}`);
    return { ok: true, data: updatedTournament };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update tournament name",
    };
  }
}

export async function updateTournamentStatusAction(
  input: unknown,
): Promise<ActionResult<TournamentRecord>> {
  const parsed = updateTournamentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid tournament status",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { tournamentId, groupId, status } = parsed.data;
    await requireOrganizer(groupId);
    const repo = getActionRepository();

    const tournament = await repo.getTournament(tournamentId);
    if (!tournament || tournament.groupId !== groupId) {
      return { ok: false, error: "Tournament not found" };
    }

    const updatedTournament: TournamentRecord = {
      ...tournament,
      status,
      updatedAt: new Date(),
    };

    await repo.updateTournament(updatedTournament);
    revalidatePath(`/g/${groupId}`);
    revalidatePath(`/g/${groupId}/tournaments/${tournamentId}`);
    return { ok: true, data: updatedTournament };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update tournament status",
    };
  }
}

export async function deleteTournamentAction(
  input: { tournamentId: string; groupId: string },
): Promise<ActionResult> {
  try {
    await requireOrganizer(input.groupId);
    const repo = getActionRepository();
    await repo.deleteTournament(input.tournamentId, input.groupId);
    revalidatePath(`/g/${input.groupId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete tournament",
    };
  }
}

