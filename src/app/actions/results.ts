"use server";

import { revalidatePath } from "next/cache";
import {
  getActionRepository,
  getActionSessionService,
  requireOrganizer,
} from "@/app/actions/action-context";
import type { ActionResult } from "@/app/actions/auth";
import type { MatchRecord } from "@/lib/domain/types";
import {
  cancelMatchSchema,
  recordMultipleResultsMutationSchema,
  recordResultMutationSchema,
} from "@/lib/validation/results";


export async function recordResultAction(
  input: unknown,
): Promise<ActionResult<MatchRecord>> {
  const parsed = recordResultMutationSchema.safeParse(input);
  if (!parsed.success) {
    const errorMap = parsed.error.flatten().fieldErrors;
    const tieMessage = errorMap.team2Score?.[0] ?? errorMap.team1Score?.[0];
    return {
      ok: false,
      error: tieMessage ?? "Please enter valid scores for both teams (ties not allowed).",
      fieldErrors: errorMap,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const service = getActionSessionService();
    const match = await service.recordResult({
      matchId: parsed.data.matchId,
      team1Score: parsed.data.team1Score,
      team2Score: parsed.data.team2Score,
    });
    const sessionId =
      parsed.data.sessionId ??
      (await getActionRepository().getRound(match.roundId))?.sessionId;
    revalidatePath(`/g/${parsed.data.groupId}`);
    if (sessionId) {
      revalidatePath(`/g/${parsed.data.groupId}/sessions/${sessionId}`);
    }
    return { ok: true, data: match };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record match result",
    };
  }
}

export async function cancelMatchAction(
  input: unknown,
): Promise<ActionResult<MatchRecord>> {
  const parsed = cancelMatchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid match cancellation request",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const service = getActionSessionService();
    const match = await service.cancelMatch(parsed.data.matchId);
    const sessionId =
      parsed.data.sessionId ??
      (await getActionRepository().getRound(match.roundId))?.sessionId;
    revalidatePath(`/g/${parsed.data.groupId}`);
    if (sessionId) {
      revalidatePath(`/g/${parsed.data.groupId}/sessions/${sessionId}`);
    }
    return { ok: true, data: match };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to cancel match",
    };
  }
}

export async function recordMultipleResultsAction(
  input: unknown,
): Promise<ActionResult<MatchRecord[]>> {
  const parsed = recordMultipleResultsMutationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please enter valid scores for all matches (ties not allowed).",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const service = getActionSessionService();
    const matches = await service.recordMultipleResults(
      parsed.data.results.map((r) => ({
        matchId: r.matchId,
        team1Score: r.team1Score,
        team2Score: r.team2Score,
        matchVersion: r.matchVersion,
      })),
      { groupId: parsed.data.groupId, sessionId: parsed.data.sessionId },
    );
    const sessionId = parsed.data.sessionId;
    revalidatePath(`/g/${parsed.data.groupId}`);
    if (sessionId) {
      revalidatePath(`/g/${parsed.data.groupId}/sessions/${sessionId}`);
    }
    return { ok: true, data: matches };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record match results",
    };
  }
}

