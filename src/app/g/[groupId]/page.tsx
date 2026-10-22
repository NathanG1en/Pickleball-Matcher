import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getActionRepository,
  getActiveOrganizerSession,
  getActivePlayerAccountId,
} from "@/app/actions/action-context";
import { SessionSignOff } from "@/components/sessions/session-signoff";
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
import { EndSessionNowButton } from "@/components/groups/end-session-now-button";
import { GroupTournamentsList } from "@/components/tournaments/group-tournaments-list";
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

  const [initialPlayers, sessions, tournaments] = await Promise.all([
    repository.listPlayers(groupId),
    repository.listSessions(groupId),
    repository.listTournaments(groupId),
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
      redirect(`/player-login?next=%2Fg%2F${groupId}`);
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
  const latestCompletedSession = sessions.filter(s => s.status === "completed")
    .sort((a, b) => (b.endedAt ?? b.startedAt).getTime() - (a.endedAt ?? a.startedAt).getTime())[0];

  let currentRoundMatches: readonly MatchRecord[] = [];
  let currentMatchPlayers: readonly { matchId: string; playerId: string; team: 1 | 2 }[] = [];
  if (activeSession) {
    const startedRounds = await repository.listStartedRounds(activeSession.id);
    const latestStarted = startedRounds.at(-1);
    if (latestStarted && latestStarted.round.status === "started") {
      currentRoundMatches = latestStarted.matches.filter((m) => m.status !== "cancelled");
      currentMatchPlayers = latestStarted.matchPlayers;
    }
  }

  const pastSessionsData = await Promise.all(
    pastSessions.map(async (s) => {
      const startedRounds = await repository.listStartedRounds(s.id);
      let totalGames = 0;
      const rounds = startedRounds.map((sr) => {
        const roundMatches = sr.matches
          .filter((m) => m.status !== "cancelled")
          .map((m) => {
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
        type: s.type ?? "regular",
        name: s.name ?? null,
      };
    }),
  );

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 pb-24 text-black">
      <RecentGroupTracker groupId={groupId} groupName={group.name} isPartOfGroup={isPartOfGroup} />
      {/* Group Header */}
      <header className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
        <div className="mb-4 flex items-center justify-between">
          <BackButton href={accountId && isMember ? "/players" : "/"} />
          <div className="flex items-center gap-2">
            <ShareGroupButton groupId={groupId} groupName={group.name} />
            {isOrganizer ? (
              <GroupOptionsMenu
                groupId={groupId}
                groupName={group.name}
                isAccountOrganizer={isAccountOrganizer}
                isOrganizer={true}
              />
            ) : isMember && accountId && !isHost ? (
              <GroupOptionsMenu
                groupId={groupId}
                groupName={group.name}
                isAccountOrganizer={false}
                isOrganizer={false}
              />
            ) : null}
          </div>
        </div>
        <GroupNameEditor groupId={groupId} initialName={group.name} canEdit={isOrganizer} />
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs font-bold text-neutral-600">
            {players.length} {players.length === 1 ? "player" : "players"} on roster
          </p>
          {!activeSession && isOrganizer && latestCompletedSession && (
            <SessionSignOff key={latestCompletedSession.id} groupId={groupId} sessionId={latestCompletedSession.id} />
          )}
        </div>
        {isOrganizer && (
          <GroupVisibilityControl groupId={groupId} initialIsPublic={group.isPublic === true} />
        )}

        {isOrganizer && <GroupIdReveal groupId={groupId} />}

      </header>

      <GroupOrganizersPanel groupId={groupId} groupName={group.name} players={players} organizers={organizers} isHost={isHost} isOrganizer={isOrganizer} />

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
                <Badge variant="default" className="bg-black text-[#ccff00]">
                  {activeSession.type === "open_play" ? "Open Play" : "Active Game"}
                </Badge>
                <span className="text-xs font-black uppercase tracking-wider text-black">
                  {activeSession.type === "open_play" ? "Casual Games" : `Round ${activeSession.currentRoundNumber}`}
                </span>
              </div>
              <div>
                <h2 className="font-display text-2xl font-black uppercase text-black mb-1">
                  {activeSession.name || (activeSession.type === "open_play" ? "Open Play In Progress" : "Session In Progress")}
                </h2>
                <p className="text-sm font-bold text-neutral-900">
                  Started <span suppressHydrationWarning>{new Date(activeSession.startedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}</span>
                  {" · "}
                  {activeSession.type === "open_play"
                    ? "Check in and submit games."
                    : `Running on ${activeSession.courtCount} court${activeSession.courtCount > 1 ? "s" : ""}.`}
                </p>
              </div>

              {activeSession.type === "open_play" ? (
                (() => {
                  const recentGames = currentRoundMatches
                    .filter((m) => m.status === "completed")
                    .slice()
                    .reverse()
                    .slice(0, 5);
                  if (recentGames.length === 0) return null;
                  return (
                    <div className="space-y-2 pt-2 border-t-2 border-black/20">
                      <h3 className="text-xs font-black uppercase tracking-wider text-black">Recent Games</h3>
                      <div data-testid="open-play-recent-games" className="max-h-[136px] overflow-y-auto space-y-2 pr-1">
                        {recentGames.map((m) => {
                          const t1 = currentMatchPlayers
                            .filter((mp) => mp.matchId === m.id && mp.team === 1)
                            .map((mp) => playerNameMap[mp.playerId] ?? mp.playerId);
                          const t2 = currentMatchPlayers
                            .filter((mp) => mp.matchId === m.id && mp.team === 2)
                            .map((mp) => playerNameMap[mp.playerId] ?? mp.playerId);
                          return (
                            <div key={m.id} className="p-3 bg-white border-2 border-black rounded-xl text-xs flex items-center justify-between shadow-[2px_2px_0px_0px_#000]">
                              <div className="min-w-0 pr-2">
                                <span className="font-black text-black block">Court {m.courtNumber}</span>
                                <span className="font-bold text-neutral-800 truncate block">{t1.join(" & ")} vs {t2.join(" & ")}</span>
                              </div>
                              <Badge variant="success">
                                {m.team1Score} – {m.team2Score}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              ) : (
                currentRoundMatches.length > 0 && (
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
                            <Badge variant={m.status === "completed" ? "success" : "warning"}>
                              {m.status === "completed" ? `${m.team1Score} – ${m.team2Score}` : "In Play"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}

              {isOrganizer ? (
                <div className="grid grid-cols-4 gap-3 items-stretch">
                  <div className="col-span-1">
                    <EndSessionNowButton
                      groupId={groupId}
                      sessionId={activeSession.id}
                      sessionType={activeSession.type}
                      sessionVersion={activeSession.version}
                    />
                  </div>
                  <Link
                    href={`/g/${groupId}/sessions/${activeSession.id}`}
                    className="col-span-3 flex items-center justify-center text-center py-3.5 px-4 rounded-xl bg-black hover:bg-neutral-900 text-white font-display text-base sm:text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-transform active:translate-x-0.5 active:translate-y-0.5"
                  >
                    {activeSession.type === "open_play"
                      ? "Manage Open Play →"
                      : "Resume Session →"}
                  </Link>
                </div>
              ) : (
                <div>
                  <Link
                    href={`/g/${groupId}/sessions/${activeSession.id}`}
                    className="block text-center w-full py-3.5 px-4 rounded-xl bg-black hover:bg-neutral-900 text-white font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-transform active:translate-x-0.5 active:translate-y-0.5"
                  >
                    {activeSession.type === "open_play"
                      ? "View Open Play →"
                      : "View Live Session →"}
                  </Link>
                </div>
              )}
            </section>
          ) : isOrganizer ? (
            <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
              <h2 className="font-display text-2xl font-black uppercase text-black mb-1">Ready to Play?</h2>
              <p className="text-sm font-bold text-neutral-700 mb-5">
                Start a session with predetermined matchmaking or open play.
              </p>
              <div>
                <Link
                  href={`/g/${groupId}/sessions/new`}
                  data-testid="start-new-session-button"
                  className="inline-block text-center w-full py-3.5 px-6 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]"
                >
                  Start New Session
                </Link>
              </div>
            </section>
          ) : (
            <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
              <h2 className="font-display text-2xl font-black uppercase text-black mb-1">No Active Session</h2>
              <p className="text-sm font-bold text-neutral-700">
                There are no games in progress right now. Live matchups will appear here when an organizer starts a session.
              </p>
            </section>
          )}

          {/* Tournaments Section */}
          <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-black uppercase text-black">Tournaments</h2>
              {isOrganizer && (
                <Link
                  href={`/g/${groupId}/tournaments/new`}
                  className="px-3 py-1.5 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  + Create Tournament
                </Link>
              )}
            </div>
            <GroupTournamentsList
              groupId={groupId}
              tournaments={tournaments}
              isOrganizer={isOrganizer}
            />
          </section>

          {/* Past Sessions */}
          <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
            <h2 className="font-display text-xl font-black uppercase text-black mb-4">Past Sessions</h2>
            <PastSessionsList
              groupId={groupId}
              sessions={pastSessionsData}
              isOrganizer={Boolean(isOrganizer || isHost)}
            />
          </section>
        </>
      )}
    </main>
  );
}
