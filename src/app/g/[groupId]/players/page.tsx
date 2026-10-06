import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  requireOrganizer,
} from "@/app/actions/action-context";
import { PlayersClient } from "./players-client";

export default async function GroupPlayersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  try {
    await requireOrganizer(groupId);
  } catch {
    redirect(`/g/${groupId}/login`);
  }

  const repository = getActionRepository();
  const [group, players] = await Promise.all([
    repository.getGroup(groupId),
    repository.listPlayers(groupId),
  ]);

  if (!group) redirect("/setup");

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 text-slate-100">
      <div className="flex items-center justify-between">
        <Link
          href={`/g/${groupId}`}
          className="text-xs font-semibold text-slate-400 hover:text-white"
        >
          ← Group Dashboard
        </Link>
        <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">
          Roster
        </span>
      </div>

      <header>
        <h1 className="text-2xl sm:text-3xl font-black text-white">{group.name} Roster</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage regular players and initial skill ratings.
        </p>
      </header>

      <PlayersClient groupId={groupId} initialPlayers={players} />
    </main>
  );
}
