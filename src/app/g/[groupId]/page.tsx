import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  requireOrganizer,
} from "@/app/actions/action-context";
import { Badge } from "@/components/ui/badge";

export default async function GroupDashboardPage({
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
  const group = await repository.getGroup(groupId);
  if (!group) {
    redirect("/setup");
  }

  const [players, sessions] = await Promise.all([
    repository.listPlayers(groupId),
    repository.listSessions(groupId),
  ]);

  const activeSession = sessions.find((s) => s.status === "active");
  const recentSessions = sessions.slice(0, 10);

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 pb-24 text-slate-100">
      {/* Group Header */}
      <header className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase font-extrabold tracking-widest text-emerald-400">
            Courtside Organizer
          </p>
          <Badge variant="success">Unlocked</Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">{group.name}</h1>
        <p className="text-xs text-slate-400 mt-1">
          {players.filter((p) => p.active).length} active players on roster
        </p>

        {/* Share Link Banner */}
        <div className="mt-5 p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/60 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-xs uppercase font-bold text-slate-400 block">
              Player Spectator Link
            </span>
            <span className="text-xs text-emerald-300 truncate font-mono block">
              /s/{group.publicShareId}
            </span>
          </div>
          <Link
            href={`/s/${group.publicShareId}`}
            target="_blank"
            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold text-white whitespace-nowrap transition-colors"
          >
            View Live
          </Link>
        </div>
      </header>

      {/* Primary Action Card */}
      {activeSession ? (
        <section className="bg-emerald-950/40 border-2 border-emerald-600/80 rounded-3xl p-6 shadow-lg shadow-emerald-950/20">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="success">Active Game</Badge>
            <span className="text-xs font-semibold text-emerald-300">
              Round {activeSession.currentRoundNumber}
            </span>
          </div>
          <h2 className="text-xl font-black text-white mb-2">Session In Progress</h2>
          <p className="text-sm text-slate-300 mb-5">
            Running on {activeSession.courtCount} court{activeSession.courtCount > 1 ? "s" : ""}.
          </p>
          <Link
            href={`/g/${groupId}/sessions/${activeSession.id}`}
            className="block text-center w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-base shadow-md transition-colors"
          >
            Resume Session →
          </Link>
        </section>
      ) : (
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
          <h2 className="text-xl font-black text-white mb-2">Ready to Play?</h2>
          <p className="text-sm text-slate-400 mb-5">
            Check attendance and let the matchmaker generate fair courts.
          </p>
          <Link
            href={`/g/${groupId}/sessions/new`}
            className="block text-center w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-base shadow-md transition-colors"
          >
            Start New Session
          </Link>
        </section>
      )}

      {/* Quick Nav */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/g/${groupId}/players`}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-colors"
        >
          <span className="text-base font-bold text-white block">Roster</span>
          <span className="text-xs text-slate-400 mt-0.5 block">
            {players.length} registered players
          </span>
        </Link>
        <Link
          href={`/setup`}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-colors"
        >
          <span className="text-base font-bold text-white block">New Group</span>
          <span className="text-xs text-slate-400 mt-0.5 block">
            Create another group
          </span>
        </Link>
      </div>

      {/* Recent Sessions */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-white mb-4">Past Sessions</h2>
        {recentSessions.length === 0 ? (
          <p className="text-sm text-slate-400">No sessions played yet.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentSessions.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white text-sm block">
                    {new Date(s.startedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-xs text-slate-400">
                    {s.courtCount} court{s.courtCount > 1 ? "s" : ""} · {s.currentRoundNumber} rounds
                  </span>
                </div>
                <Badge variant={s.status === "active" ? "warning" : "muted"}>
                  {s.status === "active" ? "Active" : "Completed"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
