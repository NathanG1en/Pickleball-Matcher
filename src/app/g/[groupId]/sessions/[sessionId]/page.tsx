import React from "react";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  getActionSessionService,
  requireOrganizer,
} from "@/app/actions/action-context";
import { SessionManagerClient } from "./session-manager-client";
import type { RoundProposal } from "@/lib/domain/types";

export default async function ActiveSessionPage({
  params,
}: {
  params: Promise<{ groupId: string; sessionId: string }>;
}) {
  const { groupId, sessionId } = await params;
  try {
    await requireOrganizer(groupId);
  } catch {
    redirect(`/g/${groupId}/login`);
  }

  const repository = getActionRepository();
  const [group, sessionRecord, players, startedRounds, attendance] = await Promise.all([
    repository.getGroup(groupId),
    repository.getSession(sessionId),
    repository.listPlayers(groupId),
    repository.listStartedRounds(sessionId),
    repository.listAttendance(sessionId),
  ]);

  if (!group || !sessionRecord) {
    redirect(`/g/${groupId}`);
  }

  // If completed, redirect back to dashboard
  if (sessionRecord.status === "completed") {
    redirect(`/g/${groupId}`);
  }

  let initialProposal: RoundProposal | null = null;
  const latestStarted = startedRounds.at(-1);
  const isRoundInProgress = latestStarted && latestStarted.round.status === "started";

  if (!isRoundInProgress) {
    try {
      const sessionService = getActionSessionService();
      initialProposal = await sessionService.proposeRound(sessionId);
    } catch {
      // In case not enough players or state error, proposal will remain null
      initialProposal = null;
    }
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 text-slate-100">
      <SessionManagerClient
        groupId={groupId}
        session={sessionRecord}
        players={players}
        attendance={attendance}
        startedRounds={startedRounds}
        initialProposal={initialProposal}
        shareId={group.publicShareId}
      />
    </main>
  );
}
