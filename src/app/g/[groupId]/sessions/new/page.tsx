import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  requireOrganizer,
} from "@/app/actions/action-context";
import { NewSessionClient } from "./new-session-client";

export default async function NewSessionPage({
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
          className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1"
        >
          ← Back to Group
        </Link>
        <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">
          Step 1 of 2
        </span>
      </div>

      <header>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Start Matchmaking</h1>
        <p className="text-sm text-slate-400 mt-1">
          Pick available courts and who showed up to play.
        </p>
      </header>

      <NewSessionClient groupId={groupId} initialPlayers={players} />
    </main>
  );
}
