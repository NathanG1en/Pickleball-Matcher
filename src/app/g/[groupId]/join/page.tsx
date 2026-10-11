import React from "react";
import { notFound } from "next/navigation";

import {
  getActionRepository,
  getActiveOrganizerSession,
  getActivePlayerAccountId,
} from "@/app/actions/action-context";
import { getGuestPlayerIdForGroup } from "@/lib/auth/guest-session";
import { JoinGroupClient } from "./join-group-client";

export default async function JoinGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const repository = getActionRepository();
  const group = await repository.getGroup(groupId);

  if (!group) {
    notFound();
  }

  const [players, accountId, guestPlayerId, organizerSession] = await Promise.all([
    repository.listPlayers(groupId),
    getActivePlayerAccountId(),
    getGuestPlayerIdForGroup(groupId),
    getActiveOrganizerSession(),
  ]);

  const account = accountId ? await repository.getPlayerAccount(accountId) : null;
  const isAccountOrganizer = Boolean(accountId && (await repository.isGroupOrganizer(groupId, accountId)));
  const isSessionOrganizer = Boolean(organizerSession && organizerSession.groupId === groupId);
  const isOrganizer = isAccountOrganizer || isSessionOrganizer;
  const isAccountMember = Boolean(accountId && players.some((p) => p.accountId === accountId && p.active));
  const guestPlayer = guestPlayerId ? players.find((p) => p.id === guestPlayerId && p.active) : null;

  return (
    <main className="min-h-screen p-4 sm:p-6 flex items-center justify-center text-black">
      <JoinGroupClient
        groupId={groupId}
        groupName={group.name}
        isPublic={group.isPublic === true}
        activePlayerCount={players.filter((p) => p.active).length}
        account={
          account
            ? {
                id: account.id,
                username: account.username,
                name: account.name,
                initialRating: account.initialRating,
              }
            : null
        }
        isOrganizer={isOrganizer}
        isAccountMember={isAccountMember}
        guestPlayer={guestPlayer ? { id: guestPlayer.id, name: guestPlayer.name } : null}
      />
    </main>
  );
}

