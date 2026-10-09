import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  requireOrganizer,
} from "@/app/actions/action-context";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/auth/logout-button";
import { GroupVisibilityControl } from "@/components/groups/group-visibility-control";
import { GroupIdReveal } from "@/components/groups/group-id-reveal";
import { RecentGroupTracker } from "@/components/groups/recent-group-tracker";
import { HomeScreenTip } from "@/components/groups/home-screen-tip";

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
    <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 pb-24 text-black">
      <RecentGroupTracker groupId={groupId} groupName={group.name} />
      {/* Group Header */}
      <header className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
        <div className="mb-2 flex justify-end"><LogoutButton /></div>
        <h1 className="font-display text-3xl sm:text-4xl font-black uppercase text-black tracking-tight">{group.name}</h1>
        <p className="text-xs font-bold text-neutral-600 mt-1">
          {players.filter((p) => p.active).length} active players on roster
        </p>
        <GroupIdReveal groupId={groupId} />

        <GroupVisibilityControl groupId={groupId} initialIsPublic={group.isPublic === true} />

      </header>

      {/* Mobile Add to Home Screen Tip */}
      <HomeScreenTip />

      {/* Primary Action Card */}
      {activeSession ? (
        <section className="bg-[#ccff00] border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="default" className="bg-black text-[#ccff00]">Active Game</Badge>
            <span className="text-xs font-black uppercase tracking-wider text-black">
              Round {activeSession.currentRoundNumber}
            </span>
          </div>
          <h2 className="font-display text-2xl font-black uppercase text-black mb-1">Session In Progress</h2>
          <p className="text-sm font-bold text-neutral-900 mb-5">
            Running on {activeSession.courtCount} court{activeSession.courtCount > 1 ? "s" : ""}.
          </p>
          <Link
            href={`/g/${groupId}/sessions/${activeSession.id}`}
            className="block text-center w-full py-3.5 px-4 rounded-xl bg-black hover:bg-neutral-900 text-white font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            Resume Session →
          </Link>
        </section>
      ) : (
        <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
          <h2 className="font-display text-2xl font-black uppercase text-black mb-1">Ready to Play?</h2>
          <p className="text-sm font-bold text-neutral-700 mb-5">
            Check attendance and let the matchmaker generate fair courts.
          </p>
          <Link
            href={`/g/${groupId}/sessions/new`}
            className="block text-center w-full py-3.5 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]"
          >
            Start New Session
          </Link>
        </section>
      )}

      {/* Quick Nav */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/g/${groupId}/players`}
          className="p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] text-left transition-all"
        >
          <span className="font-display text-lg font-black uppercase text-black block">Roster</span>
          <span className="text-xs font-bold text-neutral-600 mt-0.5 block">
            {players.length} registered players
          </span>
        </Link>
        <Link
          href={`/setup`}
          className="p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] text-left transition-all"
        >
          <span className="font-display text-lg font-black uppercase text-black block">New Group</span>
          <span className="text-xs font-bold text-neutral-600 mt-0.5 block">
            Create another group
          </span>
        </Link>
      </div>

      {/* Recent Sessions */}
      <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
        <h2 className="font-display text-xl font-black uppercase text-black mb-4">Past Sessions</h2>
        {recentSessions.length === 0 ? (
          <p className="text-sm font-bold text-neutral-600">No sessions played yet.</p>
        ) : (
          <div className="divide-y-2 divide-neutral-100">
            {recentSessions.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-black text-sm block">
                    {new Date(s.startedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-xs font-bold text-neutral-500">
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
