import React from "react";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  getActionSessionService,
  getActiveOrganizerSession,
  getActivePlayerAccountId,
} from "@/app/actions/action-context";
import { SessionManagerClient } from "./session-manager-client";
import { OpenPlayManagerClient } from "./open-play-manager-client";
import type { RoundProposal } from "@/lib/domain/types";
import { buildPairSynergies } from "@/lib/synergy/lineup";

export default async function ActiveSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; sessionId: string }>;
  searchParams?: Promise<{ from?: string }>;
}) {
  const { groupId, sessionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isFromProfile = resolvedSearchParams?.from === "profile";
  const repository = getActionRepository();
  const [accountId, guestPlayerId] = await Promise.all([
    getActivePlayerAccountId(),
    (await import("@/lib/auth/guest-session")).getGuestPlayerIdForGroup(groupId),
  ]);
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
  const isGuestMember = Boolean(guestPlayerId && players.some((player) => player.id === guestPlayerId && player.active));
  const isMember = Boolean(accountId && players.some((player) => player.accountId === accountId && player.active)) || isGuestMember;
  const viewerPlayer = accountId
    ? players.find((p) => p.accountId === accountId)
    : (guestPlayerId ? players.find((p) => p.id === guestPlayerId) : undefined);

  if (!isOrganizer && !isMember) {
    if (!accountId) {
      redirect(`/g/${groupId}/login`);
    }
    redirect("/players");
  }

  const isHost = Boolean(accountId && group.ownerAccountId === accountId);

  if (sessionRecord.type === "open_play") {
    return (
      <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 text-black">
        <OpenPlayManagerClient
          groupId={groupId}
          groupName={group.name}
          session={sessionRecord}
          players={players}
          attendance={attendance}
          startedRounds={startedRounds}
          isOrganizer={isOrganizer}
          isHost={isHost}
          isMember={isMember}
          currentViewerPlayerId={viewerPlayer?.id ?? null}
          isFromProfile={isFromProfile}
        />
      </main>
    );
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

  const accountIds = [...new Set(players.flatMap((player) => player.accountId ? [player.accountId] : []))];
  const pairSynergies = initialProposal
    ? buildPairSynergies(await repository.listPairSynergies(accountIds))
    : {};

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
        pairSynergies={pairSynergies}
        isOrganizer={isOrganizer}
        isHost={isHost}
        isFromProfile={isFromProfile}
      />
    </main>
  );
}
