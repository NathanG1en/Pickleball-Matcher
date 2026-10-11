import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  getActivePlayerAccountId,
  requireOrganizer,
} from "@/app/actions/action-context";
import { TournamentCreationForm } from "@/components/tournaments/tournament-creation-form";

export default async function NewTournamentPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  try {
    await requireOrganizer(groupId);
  } catch {
    const accountId = await getActivePlayerAccountId();
    if (accountId) {
      redirect(`/g/${groupId}`);
    }
    redirect(`/g/${groupId}/login`);
  }

  const repository = getActionRepository();
  const [group, players] = await Promise.all([
    repository.getGroup(groupId),
    repository.listPlayers(groupId),
  ]);

  if (!group) redirect("/setup");

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 text-black">
      <div className="flex items-center justify-between">
        <Link
          href={`/g/${groupId}`}
          className="px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform"
        >
          ← Back to Group
        </Link>
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          New Tournament
        </span>
      </div>

      <header>
        <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
          Create Tournament
        </h1>
        <p className="text-sm font-bold text-neutral-700 mt-1">
          Select divisions and players to generate randomized tournament brackets.
        </p>
      </header>

      <TournamentCreationForm
        groupId={groupId}
        groupName={group.name}
        initialPlayers={players}
      />
    </main>
  );
}

