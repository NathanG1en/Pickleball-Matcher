import { DomainError } from "@/lib/domain/errors";
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
import { defaultLineupSeed } from "@/lib/rounds/lineup-seed";

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

  if (!group || !sessionRecord || sessionRecord.groupId !== groupId) {
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
      redirect(`/player-login?next=%2Fg%2F${groupId}%2Fsessions%2F${sessionId}`);
    }
    redirect("/players");
  }

  const isHost = Boolean(accountId && group.ownerAccountId === accountId);

  const activePlayerIds = new Set(players.filter((p) => p.active).map((p) => p.id));
  const sanitizedAttendance = sessionRecord.status === "active"
    ? attendance.map((a) => {
        if (a.leftRound === null && !activePlayerIds.has(a.playerId)) {
          return { ...a, leftRound: sessionRecord.currentRoundNumber + 1 };
        }
        return a;
      })
    : attendance;

  if (sessionRecord.type === "open_play") {
    return (
      <main className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-xl md:max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto space-y-6 text-black">
        <OpenPlayManagerClient
          groupId={groupId}
          groupName={group.name}
          session={sessionRecord}
          players={players}
          attendance={sanitizedAttendance}
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

  const accountIds = [...new Set(players.flatMap((player) => player.accountId ? [player.accountId] : []))];
  const [allRequests, rawPairSynergies] = await Promise.all([
    repository.listPartnerRequests(sessionId),
    accountIds.length >= 2 ? repository.listPairSynergies(accountIds) : Promise.resolve([]),
  ]);
  const partnerRequests = isOrganizer ? allRequests : allRequests.filter(request => request.requesterPlayerId === viewerPlayer?.id || request.partnerPlayerId === viewerPlayer?.id);
  const pairSynergies = buildPairSynergies(rawPairSynergies);

  let initialProposal: RoundProposal | null = null;
  let initialProposalError: string | null = null;
  const latestStarted = startedRounds.at(-1);
  const isRoundInProgress = latestStarted && latestStarted.round.status === "started";

  if (sessionRecord.status !== "completed" && !isRoundInProgress && isOrganizer) {
    try {
      const sessionService = getActionSessionService();
      // Same seed on every load (and every organizer device) until the inputs change.
      const nextRoundNumber = (startedRounds.at(-1)?.round.roundNumber ?? 0) + 1;
      initialProposal = sessionService.proposeRoundFromSnapshot(
        { session: sessionRecord, players, attendance, rounds: startedRounds },
        defaultLineupSeed(sessionRecord.id, nextRoundNumber),
      );
    } catch (error) {
      if (error instanceof DomainError) initialProposalError = error.message;
      // In case not enough players or state error, proposal will remain null
      initialProposal = null;
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-xl md:max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto space-y-6 text-black">
      <SessionManagerClient
        groupId={groupId}
        groupName={group.name}
        session={sessionRecord}
        players={players}
        attendance={sanitizedAttendance}
        startedRounds={startedRounds}
        partnerRequests={partnerRequests}
        initialProposal={initialProposal}
        initialProposalError={initialProposalError}
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
