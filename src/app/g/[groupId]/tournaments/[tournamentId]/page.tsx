import React from "react";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  getActiveOrganizerSession,
  getActivePlayerAccountId,
} from "@/app/actions/action-context";
import { TournamentBracketManager } from "@/components/tournaments/tournament-bracket-manager";

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ groupId: string; tournamentId: string }>;
}) {
  const { groupId, tournamentId } = await params;
  const repository = getActionRepository();

  const [group, tournament] = await Promise.all([
    repository.getGroup(groupId),
    repository.getTournament(tournamentId),
  ]);

  if (!group || !tournament || tournament.groupId !== groupId) {
    redirect(`/g/${groupId}`);
  }

  const accountId = await getActivePlayerAccountId();
  const isAccountOrganizer = Boolean(
    accountId && (await repository.isGroupOrganizer(groupId, accountId)),
  );
  const organizerSession = await getActiveOrganizerSession();
  const isSessionOrganizer = Boolean(
    organizerSession && organizerSession.groupId === groupId,
  );
  const isOrganizer = isAccountOrganizer || isSessionOrganizer;

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-6 text-black">
      <TournamentBracketManager
        initialTournament={tournament}
        isOrganizer={isOrganizer}
      />
    </main>
  );
}

