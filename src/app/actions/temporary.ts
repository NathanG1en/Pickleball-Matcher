"use server";

import { randomUUID } from "node:crypto";
import { getActionRepository, requirePlayer } from "@/app/actions/action-context";
import { hashPin } from "@/lib/auth/pin";
import { replayRatings } from "@/lib/domain/rating-replay";
import type { DomainRepository } from "@/lib/domain/repositories";
import type { AttendanceRecord, MatchPlayerRecord, MatchRecord, PlayerRecord, RoundRecord, RoundSitRecord, SessionRecord, StartedRoundRecord } from "@/lib/domain/types";
import type { ScoreBreakdown } from "@/lib/matchmaking/types";
import { saveTemporaryGroupSchema } from "@/lib/validation/temporary";

const emptyScore: ScoreBreakdown = { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, twoVsOneRepeat: 0, tieBreak: 0, total: 0 };

async function recordSessionRounds(
  transaction: DomainRepository,
  groupId: string,
  courtPlayerCounts: readonly (2 | 3 | 4)[],
  players: readonly { id: string; name: string }[],
  roundsToImport: readonly {
    roundNumber: number;
    seed: number;
    courts: readonly {
      courtNumber: number;
      team1: readonly string[];
      team2: readonly string[];
      team1Score: number | null;
      team2Score: number | null;
    }[];
    sitting: readonly string[];
  }[],
  hasCurrentRound: boolean,
  playerIds: Map<string, string>,
  now: Date,
) {
  if (roundsToImport.length === 0) return;
  const sessionId = `ses_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const sessionStartedAt = new Date(now.getTime() - roundsToImport.length * 60_000);
  const sessionEndedAt = hasCurrentRound ? null : now;
  const session: SessionRecord = {
    id: sessionId,
    groupId,
    courtCount: courtPlayerCounts.length,
    courtPlayerCounts,
    status: hasCurrentRound ? "active" : "completed",
    currentRoundNumber: roundsToImport.length,
    startedAt: sessionStartedAt,
    endedAt: sessionEndedAt,
    version: roundsToImport.length + 1,
  };
  const attendance: AttendanceRecord[] = players.map((player) => ({
    sessionId,
    playerId: playerIds.get(player.id)!,
    joinedRound: 1,
    leftRound: null,
  }));
  await transaction.insertSession(session, attendance);

  for (const savedRound of roundsToImport) {
    const isActiveRound = hasCurrentRound && savedRound.roundNumber === roundsToImport.length;
    const roundId = `rnd_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const startedAt = new Date(sessionStartedAt.getTime() + (savedRound.roundNumber - 1) * 60_000);
    const round: RoundRecord = {
      id: roundId,
      sessionId,
      roundNumber: savedRound.roundNumber,
      status: isActiveRound ? "started" : "completed",
      seed: savedRound.seed,
      scoreBreakdown: emptyScore,
      createdAt: startedAt,
      startedAt,
      completedAt: isActiveRound ? null : startedAt,
      version: 1,
    };
    const matches: MatchRecord[] = [];
    const matchPlayers: MatchPlayerRecord[] = [];
    for (const court of savedRound.courts) {
      const matchId = `mch_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const hasScore = court.team1Score !== null && court.team2Score !== null;
      matches.push({
        id: matchId,
        roundId,
        courtNumber: court.courtNumber,
        rated: court.team1.length === 2 && court.team2.length === 2,
        status: hasScore ? "completed" : "pending",
        team1Score: court.team1Score,
        team2Score: court.team2Score,
        completedAt: hasScore ? startedAt : null,
        version: 1,
      });
      for (const playerId of court.team1) matchPlayers.push({ matchId, playerId: playerIds.get(playerId)!, team: 1, ratingBefore: null, ratingAfter: null });
      for (const playerId of court.team2) matchPlayers.push({ matchId, playerId: playerIds.get(playerId)!, team: 2, ratingBefore: null, ratingAfter: null });
    }
    const sits: RoundSitRecord[] = savedRound.sitting.map((playerId) => ({ roundId, playerId: playerIds.get(playerId)! }));
    const started: StartedRoundRecord = { round, matches, matchPlayers, sits };
    await transaction.insertStartedRound(started);
  }
  await replayRatings(groupId, transaction);
}

export async function saveTemporaryGroupAction(input: unknown): Promise<{ ok: boolean; groupId?: string; error?: string }> {
  const parsed = saveTemporaryGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The quick session data is invalid. Review the group and scores, then try again." };
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    const now = new Date();
    const account = await repository.getPlayerAccount(accountId);
    const roundsToImport = parsed.data.currentRound
      ? [...parsed.data.rounds, parsed.data.currentRound]
      : parsed.data.rounds;
    const hasCurrentRound = parsed.data.currentRound !== null && parsed.data.currentRound !== undefined;

    // Path 1: Attach to an existing group
    if (parsed.data.targetGroupId) {
      const targetGroupId = parsed.data.targetGroupId;
      const targetGroup = await repository.getGroup(targetGroupId);
      if (!targetGroup) return { ok: false, error: "The selected group was not found." };
      const isOrganizer = await repository.isGroupOrganizer(targetGroupId, accountId);
      if (!isOrganizer) return { ok: false, error: "You do not have permission to add sessions to this group." };

      const existingPlayers = await repository.listPlayers(targetGroupId);
      const existingById = new Map<string, PlayerRecord>();
      for (const p of existingPlayers) {
        if (p.active) existingById.set(p.id, p);
      }

      const playerIds = new Map<string, string>();
      const mappings = parsed.data.playerMappings ?? {};

      await repository.transaction(async (transaction) => {
        for (const player of parsed.data.players) {
          const mappedTargetId = mappings[player.id];
          const existing = mappedTargetId ? existingById.get(mappedTargetId) : undefined;
          if (existing) {
            playerIds.set(player.id, existing.id);
          } else {
            const playerId = `ply_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
            const isMatchingHost = player.name.trim() === account?.name.trim();
            await transaction.createPlayer({
              id: playerId,
              groupId: targetGroupId,
              name: player.name.trim(),
              initialRating: player.rating,
              rating: player.rating,
              ratedGamesPlayed: 0,
              active: true,
              accountId: isMatchingHost ? accountId : null,
            });
            playerIds.set(player.id, playerId);
          }
        }

        await recordSessionRounds(
          transaction,
          targetGroupId,
          parsed.data.courtPlayerCounts,
          parsed.data.players,
          roundsToImport,
          hasCurrentRound,
          playerIds,
          now,
        );
      });

      return { ok: true, groupId: targetGroupId };
    }

    // Path 2: Create a brand new group
    if ((await repository.getGroupsByName(parsed.data.name)).length > 0) return { ok: false, error: "A group with this exact name already exists." };
    const groupId = `grp_${randomUUID().slice(0, 10)}`;
    const playerIds = new Map<string, string>();
    const matchingHostPlayers = parsed.data.players.filter((player) => player.name === account?.name);
    const hostPlayerId = matchingHostPlayers.length === 1 ? matchingHostPlayers[0].id : null;

    await repository.transaction(async (transaction) => {
      await transaction.insertGroup({
        id: groupId,
        name: parsed.data.name,
        organizerPinHash: await hashPin(randomUUID()),
        createdAt: now,
        isPublic: parsed.data.isPublic,
        ownerAccountId: accountId,
      });

      for (const player of parsed.data.players) {
        const playerId = `ply_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
        playerIds.set(player.id, playerId);
        await transaction.createPlayer({
          id: playerId,
          groupId,
          name: player.name,
          initialRating: player.rating,
          rating: player.rating,
          ratedGamesPlayed: 0,
          active: true,
          accountId: player.id === hostPlayerId ? accountId : null,
        });
      }

      await recordSessionRounds(
        transaction,
        groupId,
        parsed.data.courtPlayerCounts,
        parsed.data.players,
        roundsToImport,
        hasCurrentRound,
        playerIds,
        now,
      );
    });

    return { ok: true, groupId };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return { ok: false, error: "A group with this exact name already exists." };
    return { ok: false, error: error instanceof Error ? error.message : "Unable to save the session." };
  }
}
