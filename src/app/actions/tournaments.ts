"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import {
  getActionRepository,
  requireOrganizer,
} from "@/app/actions/action-context";
import type { ActionResult } from "@/app/actions/auth";
import type {
  TeamTournamentLine,
  TeamTournamentPair,
  TeamTournamentTeam,
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
import { generateDefaultLines } from "@/lib/tournament/team-tournament";
import {
  addTeamTournamentLineSchema,
  createTeamTournamentSchema,
  createTournamentSchema,
  editParticipantSlotSchema,
  reshuffleDivisionSchema,
  swapTournamentSlotsSchema,
  updateTeamTournamentLineSchema,
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

export async function createTeamTournamentAction(
  input: unknown,
): Promise<ActionResult<TournamentRecord>> {
  const parsed = createTeamTournamentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid team tournament parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { groupId, name, teams: inputTeams, scoringType } = parsed.data;
    await requireOrganizer(groupId);
    const repo = getActionRepository();

    const pairs: TeamTournamentPair[] = [];
    const teams: TeamTournamentTeam[] = [];

    for (let i = 0; i < inputTeams.length; i++) {
      const t = inputTeams[i]!;
      const teamPairIds: string[] = [];

      for (const [p1, p2] of t.pairPlayerIds) {
        const pairId = `pair_${randomUUID().slice(0, 8)}`;
        pairs.push({
          id: pairId,
          player1Id: p1,
          player2Id: p2,
        });
        teamPairIds.push(pairId);
      }

      teams.push({
        id: `team_${i + 1}`,
        name: t.name,
        color: t.color,
        pairIds: teamPairIds,
        soloPlayerIds: t.soloPlayerIds,
      });
    }

    const lines = generateDefaultLines(teams, pairs);

    const now = new Date();
    const tournament: TournamentRecord = {
      id: `tr_${randomUUID().slice(0, 12)}`,
      groupId,
      name,
      status: "active",
      format: "team_dual",
      divisions: [],
      brackets: {},
      teamData: {
        pairs,
        teams,
        lines,
        format: "dual_meet",
        scoringType,
      },
      createdAt: now,
      updatedAt: now,
    };

    await repo.createTournament(tournament);
    revalidatePath(`/g/${groupId}`);
    return { ok: true, data: tournament };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create team tournament",
    };
  }
}

export async function updateTeamTournamentLineAction(
  input: unknown,
): Promise<ActionResult<TournamentRecord>> {
  const parsed = updateTeamTournamentLineSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid line update parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const {
      tournamentId,
      groupId,
      lineId,
      team1Score,
      team2Score,
      team1PlayerIds,
      team2PlayerIds,
    } = parsed.data;
    await requireOrganizer(groupId);
    const repo = getActionRepository();

    const tournament = await repo.getTournament(tournamentId);
    if (!tournament || tournament.groupId !== groupId || !tournament.teamData) {
      return { ok: false, error: "Team tournament not found" };
    }

    const lines = tournament.teamData.lines.map((line) => {
      if (line.id !== lineId) return line;

      const isCompleted = team1Score !== null && team2Score !== null;
      const isInProgress = !isCompleted && (team1Score !== null || team2Score !== null);
      const status: "completed" | "in_progress" | "pending" = isCompleted
        ? "completed"
        : isInProgress
        ? "in_progress"
        : "pending";

      return {
        ...line,
        team1Score,
        team2Score,
        team1PlayerIds: team1PlayerIds ?? line.team1PlayerIds,
        team2PlayerIds: team2PlayerIds ?? line.team2PlayerIds,
        status,
      };
    });

    const updatedTournament: TournamentRecord = {
      ...tournament,
      teamData: {
        ...tournament.teamData,
        lines,
      },
      updatedAt: new Date(),
    };

    await repo.updateTournament(updatedTournament);
    revalidatePath(`/g/${groupId}`);
    revalidatePath(`/g/${groupId}/tournaments/${tournamentId}`);
    return { ok: true, data: updatedTournament };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update match line",
    };
  }
}

export async function addTeamTournamentLineAction(
  input: unknown,
): Promise<ActionResult<TournamentRecord>> {
  const parsed = addTeamTournamentLineSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid line parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { tournamentId, groupId, name, type, team1PlayerIds, team2PlayerIds } = parsed.data;
    await requireOrganizer(groupId);
    const repo = getActionRepository();

    const tournament = await repo.getTournament(tournamentId);
    if (!tournament || tournament.groupId !== groupId || !tournament.teamData) {
      return { ok: false, error: "Team tournament not found" };
    }

    const newLine: TeamTournamentLine = {
      id: `line_${randomUUID().slice(0, 8)}`,
      lineNumber: tournament.teamData.lines.length + 1,
      name,
      type,
      team1PlayerIds,
      team2PlayerIds,
      team1Score: null,
      team2Score: null,
      status: "pending",
    };

    const updatedTournament: TournamentRecord = {
      ...tournament,
      teamData: {
        ...tournament.teamData,
        lines: [...tournament.teamData.lines, newLine],
      },
      updatedAt: new Date(),
    };

    await repo.updateTournament(updatedTournament);
    revalidatePath(`/g/${groupId}`);
    revalidatePath(`/g/${groupId}/tournaments/${tournamentId}`);
    return { ok: true, data: updatedTournament };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add match line",
    };
  }
}

