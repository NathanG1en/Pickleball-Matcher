"use server";

import { revalidatePath } from "next/cache";
import {
  defaultDependencies,
  getActionRepository,
  getActionSessionService,
  getActiveOrganizerSession,
  getActivePlayerAccountId,
  requireOrganizer,
} from "@/app/actions/action-context";
import type { ActionResult } from "@/app/actions/auth";
import type {
  AttendanceRecord,
  MatchPlayerRecord,
  MatchRecord,
  RoundProposal,
  RoundRecord,
  SessionRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";
import { replayRatings } from "@/lib/domain/rating-replay";
import { replaySynergies } from "@/lib/domain/synergy-replay";
import {
  changeAttendanceSchema,
  completeRoundSchema,
  deleteSessionSchema,
  duplicateSessionSchema,
  endSessionSchema,
  proposeRoundSchema,
  reshuffleRoundSchema,
  startRoundSchema,
  startSessionSchema,
  submitSessionPickupGameSchema,
  updateStayTogetherPairsSchema,
  undoLatestRoundSchema,
  updateCourtConfigSchema,
  updateSessionNameSchema,
} from "@/lib/validation/session";

async function requireSessionOrganizer(groupId: string, sessionId: string, roundId?: string): Promise<SessionRecord> {
  const repository = getActionRepository();
  const session = await repository.getSession(sessionId);
  if (!session || session.groupId !== groupId) throw new Error("Session not found.");
  if (roundId) {
    const round = await repository.getRound(roundId);
    if (!round || round.sessionId !== sessionId) throw new Error("Round not found in this session.");
  }
  await requireOrganizer(session.groupId);
  return session;
}

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
      stayTogetherPairs: parsed.data.stayTogetherPairs,
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

export async function updateStayTogetherPairsAction(input: unknown): Promise<ActionResult<SessionRecord>> {
  const parsed = updateStayTogetherPairsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose valid Stay Together pairs." };
  try {
    const session = await getActionRepository().getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId) return { ok: false, error: "Session not found." };
    await requireOrganizer(session.groupId);
    const updated = await getActionSessionService().updateStayTogetherPairs(parsed.data);
    revalidatePath(`/g/${session.groupId}/sessions/${session.id}`);
    return { ok: true, data: updated };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to save Stay Together pairs." };
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
    await requireSessionOrganizer(parsed.data.groupId, parsed.data.sessionId);
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

export async function updateCourtConfigAction(
  input: unknown,
): Promise<ActionResult<{ session: SessionRecord; proposal?: RoundProposal }>> {
  const parsed = updateCourtConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid court configuration parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireSessionOrganizer(parsed.data.groupId, parsed.data.sessionId);
    const service = getActionSessionService();
    const result = await service.updateCourtConfig({
      sessionId: parsed.data.sessionId,
      courtCount: parsed.data.courtCount,
      courtPlayerCounts: parsed.data.courtPlayerCounts as (2 | 3 | 4)[] | undefined,
    });
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${parsed.data.sessionId}`);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update court configuration",
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
    await requireSessionOrganizer(parsed.data.groupId, parsed.data.sessionId);
    const service = getActionSessionService();
    const proposal = await service.proposeRound(
      parsed.data.sessionId,
      parsed.data.seed,
      parsed.data.temperature,
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
    const session = await getActionRepository().getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId) return { ok: false, error: "Session not found." };
    await requireSessionOrganizer(parsed.data.groupId, parsed.data.sessionId);
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
    const started = await service.startRound(parsed.data.sessionId, proposal, parsed.data.sessionVersion);
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
    await requireSessionOrganizer(parsed.data.groupId, parsed.data.sessionId, parsed.data.roundId);
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
    await requireSessionOrganizer(parsed.data.groupId, parsed.data.sessionId, parsed.data.roundId);
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

export async function reshuffleRoundAction(
  input: unknown,
): Promise<ActionResult<RoundProposal>> {
  const parsed = reshuffleRoundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid reshuffle round parameters",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireSessionOrganizer(parsed.data.groupId, parsed.data.sessionId, parsed.data.roundId);
    const service = getActionSessionService();
    const proposal = await service.reshuffleRound(
      parsed.data.sessionId,
      parsed.data.seed,
      parsed.data.temperature,
    );
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${parsed.data.sessionId}`);
    return { ok: true, data: proposal };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to reshuffle matchups",
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
    await requireSessionOrganizer(parsed.data.groupId, parsed.data.sessionId);
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
    await requireSessionOrganizer(parsed.data.groupId, parsed.data.sessionId);
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
    await requireSessionOrganizer(parsed.data.groupId, parsed.data.sessionId);
    const repository = getActionRepository();
    const session = await repository.getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId) {
      return { ok: false, error: "Session not found." };
    }

    await repository.transaction(async transaction => {
      await transaction.lockSynergyState();
      await transaction.deleteSession(session.id, session.groupId);
      await replayRatings(session.groupId, transaction);
      await replaySynergies(transaction);
    });

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

export async function duplicateSessionAction(
  input: unknown,
): Promise<ActionResult<SessionRecord>> {
  const parsed = duplicateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid session duplicate request.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await requireSessionOrganizer(parsed.data.groupId, parsed.data.sessionId);
    const repository = getActionRepository();
    const sourceSession = await repository.getSession(parsed.data.sessionId);
    if (!sourceSession || sourceSession.groupId !== parsed.data.groupId) {
      return { ok: false, error: "Session not found." };
    }

    const existingSessions = await repository.listSessions(parsed.data.groupId);
    const activeSession = existingSessions.find((s) => s.status === "active");
    if (activeSession) {
      return {
        ok: false,
        error: "An active session is already in progress for this group. Please complete or delete it first.",
      };
    }

    const sourceAttendance = await repository.listAttendance(sourceSession.id);
    const groupPlayers = await repository.listPlayers(parsed.data.groupId, { includeInactive: false });
    const activePlayerIds = new Set(groupPlayers.filter((p) => p.active).map((p) => p.id));

    // Duplicate players who were attending / checked in at the end of the session
    const attendedPlayerIds = sourceAttendance
      .filter((a) => a.leftRound === null && activePlayerIds.has(a.playerId))
      .map((a) => a.playerId);

    const now = defaultDependencies.now();

    const isOp = sourceSession.type === "open_play";
    const sessionId = defaultDependencies.nextId("session");

    if (isOp) {
      const session: SessionRecord = {
        id: sessionId,
        groupId: parsed.data.groupId,
        courtCount: sourceSession.courtCount || 1,
        courtPlayerCounts: sourceSession.courtPlayerCounts ?? [4],
        status: "active",
        currentRoundNumber: 1,
        startedAt: now,
        endedAt: null,
        version: 1,
        type: "open_play",
        name: null,
      };

      const attendance: AttendanceRecord[] = attendedPlayerIds.map((playerId) => ({
        sessionId,
        playerId,
        joinedRound: 1,
        leftRound: null,
      }));

      await repository.insertSession(session, attendance);

      const roundId = defaultDependencies.nextId("round");
      const roundRecord: StartedRoundRecord = {
        round: {
          id: roundId,
          sessionId,
          roundNumber: 1,
          status: "started",
          seed: defaultDependencies.nextSeed(),
          scoreBreakdown: {
            playingTime: 0,
            consecutiveSit: 0,
            partnerRepeat: 0,
            skillBalance: 0,
            opponentRepeat: 0,
            tieBreak: 0,
            total: 0,
          },
          createdAt: now,
          startedAt: now,
          completedAt: null,
          version: 1,
        },
        matches: [],
        matchPlayers: [],
        sits: [],
      };
      await repository.insertStartedRound(roundRecord);

      revalidatePath(`/g/${parsed.data.groupId}`);
      revalidatePath(`/g/${parsed.data.groupId}/sessions/${sessionId}`);
      revalidatePath("/players");
      revalidatePath("/players/groups");
      return { ok: true, data: session };
    } else {
      if (attendedPlayerIds.length < 2) {
        return {
          ok: false,
          error: "Cannot duplicate session: at least 2 attending players are required.",
        };
      }

      let courtCount = sourceSession.courtCount;
      let courtPlayerCounts = sourceSession.courtPlayerCounts ? [...sourceSession.courtPlayerCounts] : undefined;

      const capacity = courtPlayerCounts
        ? courtPlayerCounts.reduce((sum, c) => sum + c, 0)
        : courtCount * 4;

      if (capacity > attendedPlayerIds.length || (courtPlayerCounts && courtPlayerCounts.length !== courtCount)) {
        courtCount = Math.max(1, Math.min(sourceSession.courtCount, Math.floor(attendedPlayerIds.length / 2)));
        let remaining = attendedPlayerIds.length;
        const sizes: (2 | 3 | 4)[] = [];
        for (let i = 0; i < courtCount; i++) {
          const size = Math.min(4, Math.max(2, remaining)) as 2 | 3 | 4;
          remaining -= size;
          sizes.push(size);
        }
        courtPlayerCounts = sizes;
      }

      const session: SessionRecord = {
        id: sessionId,
        groupId: parsed.data.groupId,
        courtCount,
        courtPlayerCounts,
        status: "active",
        currentRoundNumber: 0,
        startedAt: now,
        endedAt: null,
        version: 1,
        type: "regular",
        name: null,
      };

      const attendance: AttendanceRecord[] = attendedPlayerIds.map((playerId) => ({
        sessionId,
        playerId,
        joinedRound: 1,
        leftRound: null,
      }));

      await repository.insertSession(session, attendance);

      revalidatePath(`/g/${parsed.data.groupId}`);
      revalidatePath(`/g/${parsed.data.groupId}/sessions/${sessionId}`);
      revalidatePath("/players");
      revalidatePath("/players/groups");
      return { ok: true, data: session };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to duplicate session",
    };
  }
}

export async function submitSessionPickupGameAction(
  input: unknown,
): Promise<ActionResult<{ match: MatchRecord; matchPlayers: readonly MatchPlayerRecord[] }>> {
  const parsed = submitSessionPickupGameSchema.safeParse(input);
  if (!parsed.success) {
    const errorMap = parsed.error.flatten().fieldErrors;
    const msg =
      errorMap.team2Score?.[0] ??
      errorMap.team1Score?.[0] ??
      errorMap.team2PlayerIds?.[0] ??
      parsed.error.issues[0]?.message ??
      "Invalid pickup game submission.";
    return { ok: false, error: msg, fieldErrors: errorMap };
  }

  try {
    const repository = getActionRepository();
    const session = await repository.getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId) {
      return { ok: false, error: "Session not found." };
    }

    const isCompleted = session.status === "completed";
    const accountId = await getActivePlayerAccountId();
    const isOrganizer = accountId ? await repository.isGroupOrganizer(parsed.data.groupId, accountId) : false;
    const organizerSession = await getActiveOrganizerSession();
    const hasOrgSession = organizerSession?.groupId === parsed.data.groupId;
    const isOrganizerOrHost = isOrganizer || hasOrgSession;

    if (isCompleted && !isOrganizerOrHost) {
      return { ok: false, error: "Only organizers can add games to an ended session." };
    }

    const attendance = await repository.listAttendance(session.id);
    const presentPlayerIds = new Set(
      attendance.filter((a) => a.leftRound === null).map((a) => a.playerId),
    );

    const allGamePlayerIds = [...parsed.data.team1PlayerIds, ...parsed.data.team2PlayerIds];
    for (const pid of allGamePlayerIds) {
      if (!presentPlayerIds.has(pid)) {
        return {
          ok: false,
          error: "All players in a pickup game must be currently checked in to the session.",
        };
      }
    }

    const saved = await repository.transaction(async (repo) => {
      await repo.lockSynergyState();
      const startedRounds = await repo.listStartedRounds(session.id);

      // Prefer currently in-progress round, then latest round, or create initial round
      let targetRound = startedRounds.find((r) => r.round.status === "started")?.round;
      if (!targetRound) {
        targetRound = startedRounds.toSorted((a, b) => b.round.roundNumber - a.round.roundNumber)[0]?.round;
      }

      if (!targetRound) {
        const newRoundId = defaultDependencies.nextId("round");
        const newRound: StartedRoundRecord = {
          round: {
            id: newRoundId,
            sessionId: session.id,
            roundNumber: 1,
            status: "completed",
            seed: defaultDependencies.nextSeed(),
            scoreBreakdown: {
              playingTime: 0,
              consecutiveSit: 0,
              partnerRepeat: 0,
              skillBalance: 0,
              opponentRepeat: 0,
              tieBreak: 0,
              total: 0,
            },
            createdAt: defaultDependencies.now(),
            startedAt: defaultDependencies.now(),
            completedAt: defaultDependencies.now(),
            version: 1,
          },
          matches: [],
          matchPlayers: [],
          sits: [],
        };
        await repo.insertStartedRound(newRound);
        await repo.updateSession({
          ...session,
          currentRoundNumber: 1,
          version: session.version + 1,
        });
        targetRound = newRound.round;
      }

      const existingMatches = startedRounds.find((r) => r.round.id === targetRound.id)?.matches ?? [];
      const maxCourt = existingMatches.reduce((max, m) => Math.max(max, m.courtNumber), 0);
      const courtNumber = Math.max(maxCourt + 1, session.courtCount + 1);

      const matchId = defaultDependencies.nextId("match");
      const match: MatchRecord = {
        id: matchId,
        roundId: targetRound.id,
        courtNumber,
        status: "completed",
        team1Score: parsed.data.team1Score,
        team2Score: parsed.data.team2Score,
        completedAt: defaultDependencies.now(),
        version: 1,
        rated: parsed.data.rated,
      };

      const matchPlayers: MatchPlayerRecord[] = [
        ...parsed.data.team1PlayerIds.map((playerId) => ({
          matchId,
          playerId,
          team: 1 as const,
          ratingBefore: null,
          ratingAfter: null,
        })),
        ...parsed.data.team2PlayerIds.map((playerId) => ({
          matchId,
          playerId,
          team: 2 as const,
          ratingBefore: null,
          ratingAfter: null,
        })),
      ];

      await repo.insertMatch(match, matchPlayers);

      if (parsed.data.rated) {
        await replayRatings(session.groupId, repo);
      }
      await replaySynergies(repo);

      return { match, matchPlayers };
    });

    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${parsed.data.sessionId}`);
    return { ok: true, data: saved };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record pickup game.",
    };
  }
}



