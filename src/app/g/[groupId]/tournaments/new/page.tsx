import React from "react";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  getActivePlayerAccountId,
  requireOrganizer,
} from "@/app/actions/action-context";
import { NewTournamentClient } from "@/components/tournaments/new-tournament-client";
import type { TournamentFormat } from "@/lib/domain/types";

export default async function NewTournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<{ format?: string }>;
}) {
  const { groupId } = await params;
  try {
    await requireOrganizer(groupId);
  } catch {
    const accountId = await getActivePlayerAccountId();
    if (accountId) {
      redirect(`/g/${groupId}`);
    }
    redirect(`/player-login?next=%2Fg%2F${groupId}%2Ftournaments%2Fnew`);
  }

  const repository = getActionRepository();
  const [group, players, resolvedSearchParams] = await Promise.all([
    repository.getGroup(groupId),
    repository.listPlayers(groupId),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  if (!group) redirect("/setup");

  const initialFormat: TournamentFormat | undefined =
    resolvedSearchParams?.format === "bracket" || resolvedSearchParams?.format === "team_dual"
      ? resolvedSearchParams.format
      : undefined;

  return (
    <NewTournamentClient
      groupId={groupId}
      groupName={group.name}
      initialPlayers={players}
      initialFormat={initialFormat}
    />
  );
}

