"use server";

import {
  getActionSessionService,
  requireOrganizer,
} from "@/app/actions/action-context";
import type { ActionResult } from "@/app/actions/auth";
import type { RoundProposal, RoundRecord, SessionRecord } from "@/lib/domain/types";
import {
  changeAttendanceSchema,
  completeRoundSchema,
  endSessionSchema,
  proposeRoundSchema,
  startRoundSchema,
  startSessionSchema,
  undoLatestRoundSchema,
} from "@/lib/validation/session";

export async function startSessionAction(
  input: unknown,
): Promise<ActionResult<SessionRecord>> {
  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please select between 4 and 24 players and 1 to 6 courts.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const service = getActionSessionService();
    const session = await service.startSession({
      groupId: parsed.data.groupId,
      courtCount: parsed.data.courtCount,
      playerIds: parsed.data.playerIds,
    });
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
    // Re-generate deterministic proposal using seed
    const proposal = await service.proposeRound(
      parsed.data.sessionId,
      parsed.data.seed,
    );
    const started = await service.startRound(parsed.data.sessionId, proposal);
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
    return { ok: true, data: ended };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to end session",
    };
  }
}
