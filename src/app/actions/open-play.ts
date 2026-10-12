"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  defaultDependencies,
  getActionRepository,
  getActivePlayerAccountId,
  requireOrganizer,
} from "@/app/actions/action-context";
import { getGuestPlayerIdForGroup } from "@/lib/auth/guest-session";
import type { ActionResult } from "@/app/actions/auth";
import type {
  AttendanceRecord,
  MatchPlayerRecord,
  MatchRecord,
  PlayerRecord,
  SessionRecord,
  StartedRoundRecord,
} from "@/lib/domain/types";
import { replayRatings } from "@/lib/domain/rating-replay";

const startOpenPlaySessionSchema = z.object({
  groupId: z.string().min(1),
});

export async function startOpenPlaySessionAction(
  input: unknown,
): Promise<ActionResult<SessionRecord>> {
  const parsed = startOpenPlaySessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid group identifier" };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const repository = getActionRepository();

    const existingSessions = await repository.listSessions(parsed.data.groupId);
    const activeSession = existingSessions.find((s) => s.status === "active");
    if (activeSession) {
      return { ok: false, error: "An active session is already in progress for this group." };
    }

    const callerAccountId = await getActivePlayerAccountId();
    const groupPlayers = await repository.listPlayers(parsed.data.groupId, { includeInactive: false });
    const callerPlayer = callerAccountId
      ? groupPlayers.find((p) => p.accountId === callerAccountId)
      : null;

    const now = defaultDependencies.now();
    const sessionId = defaultDependencies.nextId("session");

    const session: SessionRecord = {
      id: sessionId,
      groupId: parsed.data.groupId,
      courtCount: 1,
      courtPlayerCounts: [4],
      status: "active",
      currentRoundNumber: 1,
      startedAt: now,
      endedAt: null,
      version: 1,
      type: "open_play",
    };

    const attendance: AttendanceRecord[] = callerPlayer
      ? [{ sessionId, playerId: callerPlayer.id, joinedRound: 1, leftRound: null }]
      : [];

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
    return { ok: true, data: session };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to start open play session",
    };
  }
}

const joinOpenPlaySessionSchema = z.object({
  groupId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function joinOpenPlaySessionAction(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = joinOpenPlaySessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid parameters" };
  }

  try {
    const repository = getActionRepository();
    const [accountId, guestPlayerId] = await Promise.all([
      getActivePlayerAccountId(),
      getGuestPlayerIdForGroup(parsed.data.groupId),
    ]);

    const groupPlayers = await repository.listPlayers(parsed.data.groupId, { includeInactive: false });
    const player = accountId
      ? groupPlayers.find((p) => p.accountId === accountId)
      : (guestPlayerId ? groupPlayers.find((p) => p.id === guestPlayerId) : null);

    if (!player) {
      return { ok: false, error: "You must be a member of this group to join." };
    }

    const session = await repository.getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId || session.status !== "active") {
      return { ok: false, error: "Active open play session not found." };
    }

    await repository.saveAttendance({
      sessionId: session.id,
      playerId: player.id,
      joinedRound: 1,
      leftRound: null,
    });

    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${session.id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to join open play session",
    };
  }
}

const addOpenPlayPlayerSchema = z.object({
  groupId: z.string().min(1),
  sessionId: z.string().min(1),
  playerId: z.string().min(1),
});

export async function addOpenPlayPlayerAction(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = addOpenPlayPlayerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid parameters" };
  }

  try {
    const repository = getActionRepository();
    const session = await repository.getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId || session.status !== "active") {
      return { ok: false, error: "Active open play session not found." };
    }

    const groupPlayers = await repository.listPlayers(parsed.data.groupId, { includeInactive: false });
    const player = groupPlayers.find((p) => p.id === parsed.data.playerId);
    if (!player) {
      return { ok: false, error: "Player not found in group." };
    }

    await repository.saveAttendance({
      sessionId: session.id,
      playerId: player.id,
      joinedRound: 1,
      leftRound: null,
    });

    revalidatePath(`/g/${parsed.data.groupId}/sessions/${session.id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add player to session",
    };
  }
}

const addOpenPlayGuestSchema = z.object({
  groupId: z.string().min(1),
  sessionId: z.string().min(1),
  guestName: z.string().trim().min(1, "Guest name is required"),
});

export async function addOpenPlayGuestAction(
  input: unknown,
): Promise<ActionResult<PlayerRecord>> {
  const parsed = addOpenPlayGuestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid parameters" };
  }

  try {
    const repository = getActionRepository();
    const session = await repository.getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId || session.status !== "active") {
      return { ok: false, error: "Active open play session not found." };
    }

    const playerId = `p_${randomUUID().slice(0, 10)}`;
    const guestPlayer: PlayerRecord = {
      id: playerId,
      groupId: parsed.data.groupId,
      name: parsed.data.guestName,
      initialRating: 1000,
      rating: 1000,
      ratedGamesPlayed: 0,
      active: true,
    };

    await repository.createPlayer(guestPlayer);
    await repository.saveAttendance({
      sessionId: session.id,
      playerId: guestPlayer.id,
      joinedRound: 1,
      leftRound: null,
    });

    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${session.id}`);
    return { ok: true, data: guestPlayer };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to add guest to session",
    };
  }
}

const removeOpenPlayPlayerSchema = z.object({
  groupId: z.string().min(1),
  sessionId: z.string().min(1),
  playerId: z.string().min(1),
});

export async function removeOpenPlayPlayerAction(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = removeOpenPlayPlayerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid parameters" };
  }

  try {
    const repository = getActionRepository();
    const session = await repository.getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId || session.status !== "active") {
      return { ok: false, error: "Active open play session not found." };
    }

    await repository.saveAttendance({
      sessionId: session.id,
      playerId: parsed.data.playerId,
      joinedRound: 1,
      leftRound: 1,
    });

    revalidatePath(`/g/${parsed.data.groupId}/sessions/${session.id}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to remove player from session",
    };
  }
}

const submitOpenPlayGameSchema = z
  .object({
    groupId: z.string().min(1),
    sessionId: z.string().min(1),
    team1PlayerIds: z.array(z.string().min(1)).min(1).max(2),
    team2PlayerIds: z.array(z.string().min(1)).min(1).max(2),
    team1Score: z.number().int().min(0, "Score cannot be negative"),
    team2Score: z.number().int().min(0, "Score cannot be negative"),
    courtNumber: z.number().int().min(1).optional(),
  })
  .refine((data) => data.team1PlayerIds.length === data.team2PlayerIds.length, {
    message: "Both teams must have the same number of players (singles or doubles).",
  })
  .refine((data) => data.team1Score !== data.team2Score, {
    message: "Scores cannot be tied. Enter two different scores.",
  })
  .refine(
    (data) => {
      const all = [...data.team1PlayerIds, ...data.team2PlayerIds];
      return new Set(all).size === all.length;
    },
    { message: "A player cannot be selected more than once in the same game." },
  );

export async function submitOpenPlayGameAction(
  input: unknown,
): Promise<ActionResult<MatchRecord>> {
  const parsed = submitOpenPlayGameSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid game submission.";
    return { ok: false, error: msg };
  }

  try {
    const repository = getActionRepository();
    const session = await repository.getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId || session.status !== "active") {
      return { ok: false, error: "Active open play session not found." };
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
          error: "All players in a game must be currently checked in to the open play session.",
        };
      }
    }

    const startedRounds = await repository.listStartedRounds(session.id);
    let targetRound = startedRounds[0]?.round;
    if (!targetRound) {
      const newRoundId = defaultDependencies.nextId("round");
      const newRound: StartedRoundRecord = {
        round: {
          id: newRoundId,
          sessionId: session.id,
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
          createdAt: defaultDependencies.now(),
          startedAt: defaultDependencies.now(),
          completedAt: null,
          version: 1,
        },
        matches: [],
        matchPlayers: [],
        sits: [],
      };
      await repository.insertStartedRound(newRound);
      targetRound = newRound.round;
    }

    const matchId = defaultDependencies.nextId("match");
    const match: MatchRecord = {
      id: matchId,
      roundId: targetRound.id,
      courtNumber: parsed.data.courtNumber ?? 1,
      status: "completed",
      team1Score: parsed.data.team1Score,
      team2Score: parsed.data.team2Score,
      completedAt: defaultDependencies.now(),
      version: 1,
      rated: true,
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

    await repository.insertMatch(match, matchPlayers);

    await replayRatings(parsed.data.groupId, repository);

    if (parsed.data.team1PlayerIds.length === 2 && parsed.data.team2PlayerIds.length === 2) {
      const groupPlayers = await repository.listPlayers(parsed.data.groupId, { includeInactive: true });
      const playerAccountMap = new Map<string, string | null>(
        groupPlayers.map((p) => [p.id, p.accountId ?? null]),
      );
      const pairResults: { accountIdA: string; accountIdB: string; won: boolean }[] = [];
      const [t1A, t1B] = parsed.data.team1PlayerIds;
      const [t2A, t2B] = parsed.data.team2PlayerIds;
      const t1AccA = playerAccountMap.get(t1A);
      const t1AccB = playerAccountMap.get(t1B);
      if (t1AccA && t1AccB) {
        pairResults.push({
          accountIdA: t1AccA,
          accountIdB: t1AccB,
          won: parsed.data.team1Score > parsed.data.team2Score,
        });
      }
      const t2AccA = playerAccountMap.get(t2A);
      const t2AccB = playerAccountMap.get(t2B);
      if (t2AccA && t2AccB) {
        pairResults.push({
          accountIdA: t2AccA,
          accountIdB: t2AccB,
          won: parsed.data.team2Score > parsed.data.team1Score,
        });
      }
      if (pairResults.length > 0) {
        await repository.recordMatchesSynergy(pairResults);
      }
    }

    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${session.id}`);
    return { ok: true, data: match };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to submit game score",
    };
  }
}

const endOpenPlaySessionSchema = z.object({
  groupId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function endOpenPlaySessionAction(
  input: unknown,
): Promise<ActionResult<SessionRecord>> {
  const parsed = endOpenPlaySessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid parameters" };
  }

  try {
    await requireOrganizer(parsed.data.groupId);
    const repository = getActionRepository();
    const session = await repository.getSession(parsed.data.sessionId);
    if (!session || session.groupId !== parsed.data.groupId) {
      return { ok: false, error: "Session not found." };
    }

    const startedRounds = await repository.listStartedRounds(session.id);
    for (const sr of startedRounds) {
      if (sr.round.status === "started") {
        await repository.updateRound({
          ...sr.round,
          status: "completed",
          completedAt: defaultDependencies.now(),
          version: sr.round.version + 1,
        });
      }
    }

    const updatedSession: SessionRecord = {
      ...session,
      status: "completed",
      endedAt: defaultDependencies.now(),
      version: session.version + 1,
    };
    await repository.updateSession(updatedSession);

    revalidatePath(`/g/${parsed.data.groupId}`);
    revalidatePath(`/g/${parsed.data.groupId}/sessions/${session.id}`);
    return { ok: true, data: updatedSession };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to end open play session",
    };
  }
}
