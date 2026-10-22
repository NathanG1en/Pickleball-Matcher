import React from "react";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  getActivePlayerAccountId,
  requireOrganizer,
} from "@/app/actions/action-context";
import { NewSessionClient, type SessionFormat } from "./new-session-client";

export default async function NewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<{ type?: string }>;
}) {
  const { groupId } = await params;
  try {
    await requireOrganizer(groupId);
  } catch {
    const accountId = await getActivePlayerAccountId();
    if (accountId) {
      redirect(`/g/${groupId}`);
    }
    redirect(`/player-login?next=%2Fg%2F${groupId}%2Fsessions%2Fnew`);
  }

  const repository = getActionRepository();
  const [group, players, resolvedSearchParams] = await Promise.all([
    repository.getGroup(groupId),
    repository.listPlayers(groupId),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  if (!group) redirect("/setup");

  const initialType: SessionFormat | undefined =
    resolvedSearchParams?.type === "normal" || resolvedSearchParams?.type === "open_play"
      ? resolvedSearchParams.type
      : undefined;

  return (
    <NewSessionClient
      groupId={groupId}
      initialPlayers={players}
      initialType={initialType}
    />
  );
}
