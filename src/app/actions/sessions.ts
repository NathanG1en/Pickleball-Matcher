"use server";

import { revalidatePath } from "next/cache";
import {
  getActionRepository,
  getActionSessionService,
  requireOrganizer,
} from "@/app/actions/action-context";
import type { ActionResult } from "@/app/actions/auth";
import type { RoundProposal, RoundRecord, SessionRecord } from "@/lib/domain/types";
import { replayRatings } from "@/lib/domain/rating-replay";
import {
  changeAttendanceSchema,
  completeRoundSchema,
  deleteSessionSchema,
  endSessionSchema,
  proposeRoundSchema,
  startRoundSchema,
  startSessionSchema,
  undoLatestRoundSchema,
  updateSessionNameSchema,
} from "@/lib/validation/session";

export async function startSessionAction(
  input: unknown,
): Promise<ActionResult<SessionRecord>> {
  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please select between 2 and 24 players and choose court sizes that fit.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const service = getActionSessionService();
    const session = await service.startSession({
      groupId: parsed.data.groupId,
      courtCount: parsed.data.courtCount,
      courtPlayerCounts: parsed.data.courtPlayerCounts as (2 | 3 | 4)[] | undefined,
      playerIds: parsed.data.playerIds,
    });
    revalidatePath(`/g/${parsed.data.groupId}`);
    return { ok: true, data: session };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to start session",
    };
  }
}

export async function changeAttendanceAction(input: unknown): Promise<ActionResult> {
  const parsed = changeAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid attendance parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const service = getActionSessionService();
    await service.changeAttendance({
      sessionId: parsed.data.sessionId,
      playerId: parsed.data.playerId,
      present: parsed.data.present,
    });
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${parsed.data.sessionId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to change attendance",
    };
  }
}

export async function proposeRoundAction(
  input: unknown,
): Promise<ActionResult<RoundProposal>> {
  const parsed = proposeRoundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid round proposal request",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const service = getActionSessionService();
    const proposal = await service.proposeRound(
      parsed.data.sessionId,
      parsed.data.seed,
    );
    return { ok: true, data: proposal };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to generate round proposal",
    };
  }
}

export async function startRoundAction(
  input: unknown,
): Promise<ActionResult<RoundRecord>> {
  const parsed = startRoundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid round start parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const service = getActionSessionService();
    let proposal: RoundProposal;
    if (parsed.data.manualCourts && parsed.data.manualSitting) {
      proposal = {
        courts: parsed.data.manualCourts.map((c) => ({
          courtNumber: c.courtNumber,
          team1: c.team1.length === 2 ? ([c.team1[0], c.team1[1]] as const) : ([c.team1[0]] as const),
          team2: c.team2.length === 2 ? ([c.team2[0], c.team2[1]] as const) : ([c.team2[0]] as const),
          matchType: c.team1.length + c.team2.length === 3 ? "team-vs-one" : c.team1.length === 2 ? "doubles" : "singles",
        })),
        sitting: parsed.data.manualSitting,
        seed: parsed.data.seed,
        score: 0,
        scoreBreakdown: {
          playingTime: 0,
          consecutiveSit: 0,
          partnerRepeat: 0,
          skillBalance: 0,
          opponentRepeat: 0,
          tieBreak: 0,
          total: 0,
        },
      };
    } else {
      // Re-generate deterministic proposal using seed
      proposal = await service.proposeRound(
        parsed.data.sessionId,
        parsed.data.seed,
      );
    }
    const started = await service.startRound(parsed.data.sessionId, proposal);
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${parsed.data.sessionId}`);
    return { ok: true, data: started };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to start round",
    };
  }
}

export async function completeRoundAction(
  input: unknown,
): Promise<ActionResult<RoundRecord>> {
  const parsed = completeRoundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid complete round parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const service = getActionSessionService();
    const completed = await service.completeRound(parsed.data.roundId);
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${parsed.data.sessionId}`);
    return { ok: true, data: completed };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to complete round",
    };
  }
}

export async function undoLatestRoundAction(
  input: unknown,
): Promise<ActionResult<RoundRecord>> {
  const parsed = undoLatestRoundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid undo round parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const service = getActionSessionService();
    const undone = await service.undoLatestRound(parsed.data.sessionId);
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${parsed.data.sessionId}`);
    return { ok: true, data: undone };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to undo round",
    };
  }
}

export async function endSessionAction(
  input: unknown,
): Promise<ActionResult<SessionRecord>> {
  const parsed = endSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid end session parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const service = getActionSessionService();
    const ended = await service.endSession(parsed.data.sessionId);
    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${parsed.data.sessionId}`);
    revalidatePath("/players");
    revalidatePath("/players/groups");
    return { ok: true, data: ended };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to end session",
    };
  }
}

export async function updateSessionNameAction(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = updateSessionNameSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Enter a valid session name.",
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const repository = getActionRepository();
    const session = await repository.getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId) {
      return { ok: false, error: "Session not found." };
    }

    const trimmed = parsed.data.name.trim();
    if (trimmed === (session.name ?? "").trim()) {
      return { ok: true };
    }

    await repository.updateSessionName(session.id, trimmed);
    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${session.id}`);
    revalidatePath("/players");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unable to update session name.",
    };
  }
}

export async function deleteSessionAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = deleteSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid session delete request.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const repository = getActionRepository();
    const session = await repository.getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId) {
      return { ok: false, error: "Session not found." };
    }

    await repository.deleteSession(session.id, session.groupId);
    await replayRatings(session.groupId, repository);

    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${parsed.data.sessionId}`);
    revalidatePath("/players");
    revalidatePath("/players/groups");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete session",
    };
  }
}


