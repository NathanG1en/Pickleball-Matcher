import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  getActiveOrganizerSession,
  getActivePlayerAccountId,
} from "@/app/actions/action-context";
import { PlayersClient } from "./players-client";

export default async function GroupPlayersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const repository = getActionRepository();
  const [group, players] = await Promise.all([
    repository.getGroup(groupId),
    repository.listPlayers(groupId),
  ]);

  if (!group) redirect("/setup");

  const [accountId, guestPlayerId] = await Promise.all([
    getActivePlayerAccountId(),
    (await import("@/lib/auth/guest-session")).getGuestPlayerIdForGroup(groupId),
  ]);
  const organizerSession = await getActiveOrganizerSession();
  const isSessionOrganizer = Boolean(organizerSession && organizerSession.groupId === groupId);
  const isAccountOrganizer = Boolean(accountId && await repository.isGroupOrganizer(groupId, accountId));
  const isOrganizer = isAccountOrganizer || isSessionOrganizer;
  const isGuestMember = Boolean(guestPlayerId && players.some((player) => player.id === guestPlayerId && player.active));
  const isMember = Boolean(accountId && players.some((player) => player.accountId === accountId && player.active)) || isGuestMember;
  const isPartOfGroup = isOrganizer || isMember;

  if (!isPartOfGroup && !group.isPublic) {
    if (!accountId) {
      redirect(`/player-login?next=%2Fg%2F${groupId}%2Fplayers`);
    }
    redirect("/players");
  }

  return (
    <main className="min-h-screen w-full min-w-0 p-4 sm:p-6 lg:p-8 max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto space-y-6 text-black">
      <div className="flex items-center justify-between">
        <Link
          href={`/g/${groupId}`}
          className="inline-flex min-h-11 items-center px-3 rounded-xl bg-white border-2 border-black font-bold text-sm text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform"
        >
          ← Back to Group
        </Link>
      </div>

      <header>
        <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black break-words [overflow-wrap:anywhere]">
          {group.name} Roster
        </h1>
        <p className="text-sm font-bold text-neutral-700 mt-1">
          {isOrganizer ? "Manage regular players and initial skill ratings." : "Group regular players and skill ratings."}
        </p>
      </header>

      <PlayersClient
        groupId={groupId}
        initialPlayers={players}
        canManage={isOrganizer}
        currentAccountId={accountId}
        isGroupMember={isPartOfGroup}
      />
    </main>
  );
}
