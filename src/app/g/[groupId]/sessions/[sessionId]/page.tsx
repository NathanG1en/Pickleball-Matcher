import React from "react";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  getActionSessionService,
  getActiveOrganizerSession,
  getActivePlayerAccountId,
} from "@/app/actions/action-context";
import { SessionManagerClient } from "./session-manager-client";
import type { RoundProposal } from "@/lib/domain/types";
import type { CourtSynergiesMap } from "@/components/rounds/synergy-reveal-modal";

export default async function ActiveSessionPage({
  params,
}: {
  params: Promise<{ groupId: string; sessionId: string }>;
}) {
  const { groupId, sessionId } = await params;
  const repository = getActionRepository();
  const accountId = await getActivePlayerAccountId();
  const [group, sessionRecord, players, startedRounds, attendance] = await Promise.all([
    repository.getGroup(groupId),
    repository.getSession(sessionId),
    repository.listPlayers(groupId, { includeInactive: true }),
    repository.listStartedRounds(sessionId),
    repository.listAttendance(sessionId),
  ]);

  if (!group || !sessionRecord) {
    redirect(`/g/${groupId}`);
  }

  const organizerSession = await getActiveOrganizerSession();
  const isSessionOrganizer = Boolean(organizerSession && organizerSession.groupId === groupId);
  const isAccountOrganizer = Boolean(accountId && (await repository.isGroupOrganizer(groupId, accountId)));
  const isOrganizer = isAccountOrganizer || isSessionOrganizer;
  const isMember = Boolean(accountId && players.some((player) => player.accountId === accountId && player.active));
  const viewerPlayer = players.find((p) => p.accountId === accountId);

  if (!isOrganizer && !isMember) {
    if (!accountId) {
      redirect(`/g/${groupId}/login`);
    }
    redirect("/players");
  }

  let initialProposal: RoundProposal | null = null;
  const latestStarted = startedRounds.at(-1);
  const isRoundInProgress = latestStarted && latestStarted.round.status === "started";

  if (sessionRecord.status !== "completed" && !isRoundInProgress && isOrganizer) {
    try {
      const sessionService = getActionSessionService();
      initialProposal = await sessionService.proposeRound(sessionId);
    } catch {
      // In case not enough players or state error, proposal will remain null
      initialProposal = null;
    }
  }

  const courtSynergies: CourtSynergiesMap = {};
  let partnerSynergy: { score: number; matchesPlayed: number } | null = null;

  if (initialProposal) {
    const playerAccountMap = new Map<string, string | null>(
      players.map((p) => [p.id, p.accountId ?? null]),
    );

    for (const c of initialProposal.courts) {
      let t1Syn: { score: number; matchesPlayed: number } | null = null;
      let t2Syn: { score: number; matchesPlayed: number } | null = null;

      if (c.team1.length === 2) {
        const a1 = playerAccountMap.get(c.team1[0]);
        const a2 = playerAccountMap.get(c.team1[1]);
        if (a1 && a2) {
          const syn = await repository.getPairSynergy(a1, a2);
          if (syn) t1Syn = { score: syn.synergyScore, matchesPlayed: syn.matchesPlayed };
        }
      }

      if (c.team2.length === 2) {
        const a1 = playerAccountMap.get(c.team2[0]);
        const a2 = playerAccountMap.get(c.team2[1]);
        if (a1 && a2) {
          const syn = await repository.getPairSynergy(a1, a2);
          if (syn) t2Syn = { score: syn.synergyScore, matchesPlayed: syn.matchesPlayed };
        }
      }

      courtSynergies[c.courtNumber] = { team1: t1Syn, team2: t2Syn };

      if (viewerPlayer) {
        if (c.team1.includes(viewerPlayer.id)) {
          partnerSynergy = t1Syn;
        } else if (c.team2.includes(viewerPlayer.id)) {
          partnerSynergy = t2Syn;
        }
      }
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 text-black">
      <SessionManagerClient
        groupId={groupId}
        groupName={group.name}
        session={sessionRecord}
        players={players}
        attendance={attendance}
        startedRounds={startedRounds}
        initialProposal={initialProposal}
        canManage={isOrganizer}
        currentViewerPlayerId={viewerPlayer?.id ?? null}
        partnerSynergy={partnerSynergy}
        courtSynergies={courtSynergies}
        isOrganizer={isOrganizer}
      />
    </main>
  );
}
