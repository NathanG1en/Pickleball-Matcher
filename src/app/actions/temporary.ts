"use server";

import { randomUUID } from "node:crypto";
import { getActionRepository, requirePlayer } from "@/app/actions/action-context";
import { hashPin } from "@/lib/auth/pin";
import { replayRatings } from "@/lib/domain/rating-replay";
import type { AttendanceRecord, MatchPlayerRecord, MatchRecord, RoundRecord, RoundSitRecord, SessionRecord, StartedRoundRecord } from "@/lib/domain/types";
import type { ScoreBreakdown } from "@/lib/matchmaking/types";
import { saveTemporaryGroupSchema } from "@/lib/validation/temporary";

const emptyScore: ScoreBreakdown = { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 };

export async function saveTemporaryGroupAction(input: unknown): Promise<{ ok: boolean; groupId?: string; error?: string }> {
  const parsed = saveTemporaryGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The temporary group data is invalid. Review the group and scores, then try again." };
  try {
    const accountId = await requirePlayer();
    const repository = getActionRepository();
    if ((await repository.getGroupsByName(parsed.data.name)).length > 0) return { ok: false, error: "A group with this exact name already exists." };
    const groupId = `grp_${randomUUID().slice(0, 10)}`;
    const playerIds = new Map<string, string>();
    const account = await repository.getPlayerAccount(accountId);
    const matchingHostPlayers = parsed.data.players.filter((player) => player.name === account?.name);
    const hostPlayerId = matchingHostPlayers.length === 1 ? matchingHostPlayers[0].id : null;
    const now = new Date();

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

      const roundsToImport = parsed.data.currentRound
        ? [...parsed.data.rounds, parsed.data.currentRound]
        : parsed.data.rounds;
      if (roundsToImport.length > 0) {
        const sessionId = `ses_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
        const sessionStartedAt = new Date(now.getTime() - roundsToImport.length * 60_000);
        const hasCurrentRound = parsed.data.currentRound !== null && parsed.data.currentRound !== undefined;
        const sessionEndedAt = hasCurrentRound ? null : now;
        const session: SessionRecord = {
          id: sessionId,
          groupId,
          courtCount: parsed.data.courtPlayerCounts.length,
          courtPlayerCounts: parsed.data.courtPlayerCounts,
          status: hasCurrentRound ? "active" : "completed",
          currentRoundNumber: roundsToImport.length,
          startedAt: sessionStartedAt,
          endedAt: sessionEndedAt,
          version: roundsToImport.length + 1,
        };
        const attendance: AttendanceRecord[] = parsed.data.players.map((player) => ({
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
    });
    return { ok: true, groupId };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return { ok: false, error: "A group with this exact name already exists." };
    return { ok: false, error: error instanceof Error ? error.message : "Unable to save the temporary group." };
  }
}
