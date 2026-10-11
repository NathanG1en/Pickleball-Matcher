import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  getActiveOrganizerSession,
  getActivePlayerAccountId,
} from "@/app/actions/action-context";
import { Badge } from "@/components/ui/badge";
import { GroupVisibilityControl } from "@/components/groups/group-visibility-control";
import { GroupIdReveal } from "@/components/groups/group-id-reveal";
import { RecentGroupTracker } from "@/components/groups/recent-group-tracker";
import { HomeScreenTip } from "@/components/groups/home-screen-tip";
import { GroupOrganizersPanel } from "@/components/groups/group-organizers-panel";
import { GroupNameEditor } from "@/components/groups/group-name-editor";
import { BackButton } from "@/components/groups/back-button";
import { GroupOptionsMenu } from "@/components/groups/group-options-menu";
import { ShareGroupButton } from "@/components/groups/share-group-modal";
import { GroupJoinCard } from "@/components/groups/group-join-card";
import { PastSessionsList } from "@/components/groups/past-sessions-list";
import { getGuestPlayerIdForGroup } from "@/lib/auth/guest-session";
import type { MatchRecord } from "@/lib/domain/types";

export default async function GroupDashboardPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const repository = getActionRepository();
  const group = await repository.getGroup(groupId);
  if (!group) {
    redirect("/setup");
  }

  const [initialPlayers, sessions] = await Promise.all([
    repository.listPlayers(groupId),
    repository.listSessions(groupId),
  ]);
  let players = initialPlayers;
  const [accountId, guestPlayerId] = await Promise.all([
    getActivePlayerAccountId(),
    getGuestPlayerIdForGroup(groupId),
  ]);
  const isAccountOrganizer = Boolean(accountId && await repository.isGroupOrganizer(groupId, accountId));
  const organizerSession = await getActiveOrganizerSession();
  const isSessionOrganizer = Boolean(organizerSession && organizerSession.groupId === groupId);
  const isOrganizer = isAccountOrganizer || isSessionOrganizer;
  const isHost = accountId === group.ownerAccountId;
  if (isHost && accountId && !players.some((player) => player.accountId === accountId)) {
    await repository.addPlayerToGroup(accountId, groupId);
    players = await repository.listPlayers(groupId);
  }

  const isGuestMember = Boolean(guestPlayerId && players.some((p) => p.id === guestPlayerId && p.active));
  const isMember = Boolean(accountId && players.some((player) => player.accountId === accountId && player.active)) || isGuestMember;
  const isPartOfGroup = isOrganizer || isMember;

  if (!isPartOfGroup && !group.isPublic) {
    if (!accountId) {
      redirect(`/g/${groupId}/login`);
    }
    redirect("/players");
  }

  const organizers = await repository.listGroupOrganizers(groupId);

  const playerNameMap: Record<string, string> = {};
  for (const p of players) {
    playerNameMap[p.id] = p.name;
  }

  const activeSession = sessions.find((s) => s.status === "active");
  const pastSessions = sessions.filter((s) => s.id !== activeSession?.id);

  let currentRoundMatches: readonly MatchRecord[] = [];
  let currentMatchPlayers: readonly { matchId: string; playerId: string; team: 1 | 2 }[] = [];
  if (activeSession) {
    const startedRounds = await repository.listStartedRounds(activeSession.id);
    const latestStarted = startedRounds.at(-1);
    if (latestStarted && latestStarted.round.status === "started") {
      currentRoundMatches = latestStarted.matches;
      currentMatchPlayers = latestStarted.matchPlayers;
    }
  }

  const pastSessionsData = await Promise.all(
    pastSessions.map(async (s) => {
      const startedRounds = await repository.listStartedRounds(s.id);
      let totalGames = 0;
      const rounds = startedRounds.map((sr) => {
        const roundMatches = sr.matches.map((m) => {
          const t1 = sr.matchPlayers
            .filter((mp) => mp.matchId === m.id && mp.team === 1)
            .map((mp) => playerNameMap[mp.playerId] ?? mp.playerId);
          const t2 = sr.matchPlayers
            .filter((mp) => mp.matchId === m.id && mp.team === 2)
            .map((mp) => playerNameMap[mp.playerId] ?? mp.playerId);
          return {
            id: m.id,
            courtNumber: m.courtNumber,
            team1Names: t1,
            team2Names: t2,
            team1Score: m.team1Score,
            team2Score: m.team2Score,
            status: m.status,
          };
        });
        totalGames += roundMatches.length;

        const sittingNames = sr.sits.map((sit) => playerNameMap[sit.playerId] ?? sit.playerId);

        return {
          id: sr.round.id,
          roundNumber: sr.round.roundNumber,
          status: sr.round.status,
          matches: roundMatches,
          sittingNames,
        };
      });

      return {
        id: s.id,
        courtCount: s.courtCount,
        currentRoundNumber: s.currentRoundNumber,
        status: s.status,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt ? s.endedAt.toISOString() : null,
        rounds,
        totalGames,
      };
    }),
  );

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 pb-24 text-black">
      <RecentGroupTracker groupId={groupId} groupName={group.name} />
      {/* Group Header */}
      <header className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
        <div className="mb-4 flex items-center justify-between">
          <BackButton fallbackHref={accountId && isMember ? "/players" : "/"} />
          <div className="flex items-center gap-2">
            <ShareGroupButton groupId={groupId} groupName={group.name} />
            {isOrganizer && (
              <GroupOptionsMenu
                groupId={groupId}
                groupName={group.name}
                isAccountOrganizer={isAccountOrganizer}
              />
            )}
          </div>
        </div>
        <GroupNameEditor groupId={groupId} initialName={group.name} canEdit={isOrganizer} />
        <p className="text-xs font-bold text-neutral-600 mt-1">
          {players.length} players on roster
        </p>
        {isOrganizer && <GroupIdReveal groupId={groupId} />}

        {isOrganizer && (
          <GroupVisibilityControl groupId={groupId} initialIsPublic={group.isPublic === true} />
        )}

      </header>

      <GroupOrganizersPanel groupId={groupId} players={players} organizers={organizers} isHost={isHost} isOrganizer={isOrganizer} />

      {/* Mobile Add to Home Screen Tip */}
      <HomeScreenTip />

      {!isPartOfGroup ? (
        <GroupJoinCard
          groupId={groupId}
          groupName={group.name}
          isSignedIn={Boolean(accountId)}
        />
      ) : (
        <>
          {/* Primary Action Card */}
          {activeSession ? (
            <section className="bg-[#ccff00] border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="default" className="bg-black text-[#ccff00]">Active Game</Badge>
                <span className="text-xs font-black uppercase tracking-wider text-black">
                  Round {activeSession.currentRoundNumber}
                </span>
              </div>
              <div>
                <h2 className="font-display text-2xl font-black uppercase text-black mb-1">Session In Progress</h2>
                <p className="text-sm font-bold text-neutral-900">
                  Running on {activeSession.courtCount} court{activeSession.courtCount > 1 ? "s" : ""}.
                </p>
              </div>

              {currentRoundMatches.length > 0 && (
                <div className="space-y-2 pt-2 border-t-2 border-black/20">
                  <h3 className="text-xs font-black uppercase tracking-wider text-black">Current Matchups</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {currentRoundMatches.map((m) => {
                      const t1 = currentMatchPlayers
                        .filter((mp) => mp.matchId === m.id && mp.team === 1)
                        .map((mp) => playerNameMap[mp.playerId] ?? mp.playerId);
                      const t2 = currentMatchPlayers
                        .filter((mp) => mp.matchId === m.id && mp.team === 2)
                        .map((mp) => playerNameMap[mp.playerId] ?? mp.playerId);
                      return (
                        <div key={m.id} className="p-3 bg-white border-2 border-black rounded-xl text-xs flex items-center justify-between shadow-[2px_2px_0px_0px_#000]">
                          <div>
                            <span className="font-black text-black block">Court {m.courtNumber}</span>
                            <span className="font-bold text-neutral-800">{t1.join(" & ")} vs {t2.join(" & ")}</span>
                          </div>
                          <Badge variant={m.status === "completed" ? "success" : m.status === "cancelled" ? "muted" : "warning"}>
                            {m.status === "completed" ? `${m.team1Score} – ${m.team2Score}` : m.status === "cancelled" ? "Cancelled" : "In Play"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Link
                href={`/g/${groupId}/sessions/${activeSession.id}`}
                className="block text-center w-full py-3.5 px-4 rounded-xl bg-black hover:bg-neutral-900 text-white font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-transform active:translate-x-0.5 active:translate-y-0.5"
              >
                {isOrganizer ? "Resume Session →" : "View Live Session →"}
              </Link>
            </section>
          ) : isOrganizer ? (
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
          ) : (
            <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
              <h2 className="font-display text-2xl font-black uppercase text-black mb-1">No Active Session</h2>
              <p className="text-sm font-bold text-neutral-700">
                There are no games in progress right now. Live matchups will appear here when an organizer starts a session.
              </p>
            </section>
          )}

          {/* Past Sessions */}
          <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
            <h2 className="font-display text-xl font-black uppercase text-black mb-4">Past Sessions</h2>
            <PastSessionsList groupId={groupId} sessions={pastSessionsData} />
          </section>
        </>
      )}
    </main>
  );
}
