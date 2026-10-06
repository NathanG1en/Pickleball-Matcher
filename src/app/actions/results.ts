"use server";

import {
  getActionSessionService,
  requireOrganizer,
} from "@/app/actions/action-context";
import type { ActionResult } from "@/app/actions/auth";
import type { MatchRecord } from "@/lib/domain/types";
import {
  cancelMatchSchema,
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
    return { ok: true, data: match };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to cancel match",
    };
  }
}
