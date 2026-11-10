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
import { ClientDate } from "@/components/ui/client-date-time";
import { RecentGroupTracker } from "@/components/groups/recent-group-tracker";
import { HomeScreenTip } from "@/components/groups/home-screen-tip";
import { GroupOrganizersPanel } from "@/components/groups/group-organizers-panel";
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
            completedAt: m.completedAt ? m.completedAt.toISOString() : null,
          };
        });
        totalGames += roundMatches.length;

        const sittingNames = sr.sits.map((sit) => playerNameMap[sit.playerId] ?? sit.playerId);

        return {
          id: sr.round.id,
          roundNumber: sr.round.roundNumber,
          status: sr.round.status,
          startedAt: sr.round.startedAt ? sr.round.startedAt.toISOString() : null,
          completedAt: sr.round.completedAt ? sr.round.completedAt.toISOString() : null,
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
    <main className="min-h-screen p-4 sm:p-6 lg:p-8 max-w-xl md:max-w-2xl lg:max-w-6xl xl:max-w-7xl mx-auto space-y-6 pb-24 text-black">
      <RecentGroupTracker groupId={groupId} groupName={group.name} isPartOfGroup={isPartOfGroup} />
      {/* Group Header */}
      <header className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-6 lg:p-8">
        <div className="mb-4 flex items-center justify-between">
          <BackButton href={accountId && isMember ? "/players" : "/"} />
          <div className="flex items-center gap-2">
            <ShareGroupButton groupId={groupId} groupName={group.name} />
            {isOrganizer || (isMember && accountId && !isHost) ? (
              <GroupOptionsMenu
                groupId={groupId}
                groupName={group.name}
                isPublic={group.isPublic === true}
                isHost={isHost}
                isAccountOrganizer={isAccountOrganizer}
                isOrganizer={isOrganizer}
                organizerPermissions={group.organizerPermissions}
                players={players}
                organizers={organizers}
              />
            ) : null}
          </div>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-black uppercase text-black tracking-tight truncate">
          {group.name}
        </h1>
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={group.isPublic ? "success" : "default"} data-testid="group-privacy-badge">
              {group.isPublic ? "Public Group" : "Private Group"}
            </Badge>
            <span aria-hidden="true" className="text-xs font-bold text-neutral-400">·</span>
            <span className="text-xs font-bold text-neutral-600">
              {players.length} {players.length === 1 ? "player" : "players"} on roster
            </span>
          </div>
          {!activeSession && isOrganizer && latestCompletedSession && (
            <SessionSignOff key={latestCompletedSession.id} groupId={groupId} sessionId={latestCompletedSession.id} />
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Organizers and Roster panel: appears first on mobile stack, right column on desktop */}
        <div className="space-y-6 lg:col-span-5 xl:col-span-4 lg:order-2">
          <GroupOrganizersPanel groupId={groupId} groupName={group.name} players={players} organizers={organizers} isHost={isHost} isOrganizer={isOrganizer} />
          {/* Mobile Add to Home Screen Tip */}
          <HomeScreenTip />
        </div>

        {/* Primary Action and Sessions column: appears after roster on mobile, left column on desktop */}
        <div className="space-y-6 lg:col-span-7 xl:col-span-8 lg:order-1">
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
                <section
                  data-testid="active-session-card"
                  className="relative bg-[#ccff00] border-[3px] border-black rounded-3xl p-6 lg:p-7 space-y-4 cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
                >
              <Link
                href={`/g/${groupId}/sessions/${activeSession.id}`}
                data-testid="active-session-overlay-link"
                className="absolute inset-0 z-10 rounded-3xl"
                aria-label={
                  activeSession.type === "open_play"
                    ? (isOrganizer ? "Manage Open Play" : "View Open Play")
                    : (isOrganizer ? "Resume Session" : "View Live Session")
                }
              />
              {activeSession.type === "open_play" ? (
                <div>
                  <h2 className="font-display text-2xl font-black uppercase text-black mb-1">
                    Open Play In Progress
                  </h2>
                  <p className="text-sm font-bold text-neutral-900">
                    {activeSession.name || (
                      <ClientDate
                        date={activeSession.startedAt}
                        options={{
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }}
                      />
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-black">
                      Round {activeSession.currentRoundNumber}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-black uppercase text-black mb-1">
                      {activeSession.name || "Session In Progress"}
                    </h2>
                    <p className="text-sm font-bold text-neutral-900">
                      <ClientDate
                        date={activeSession.startedAt}
                        prefix="Started "
                        options={{
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }}
                      />
                      {" · "}
                      Running on {activeSession.courtCount} court{activeSession.courtCount > 1 ? "s" : ""}.
                    </p>
                  </div>
                </>
              )}

              {activeSession.type === "open_play" ? (
                (() => {
                  const recentGames = currentRoundMatches
                    .filter((m) => m.status === "completed")
                    .slice()
                    .reverse()
                    .slice(0, 5);
                  if (recentGames.length === 0) return null;
                  return (
                    <div className="relative z-20 space-y-2 pt-2 border-t-2 border-black/20">
                      <h3 className="text-xs font-black uppercase tracking-wider text-black">Recent Games</h3>
                      <div data-testid="open-play-recent-games" className="max-h-[136px] overflow-y-auto lg:max-h-72 space-y-2 pr-1">
                        {recentGames.map((m) => {
                          const t1 = currentMatchPlayers
                            .filter((mp) => mp.matchId === m.id && mp.team === 1)
                            .map((mp) => playerNameMap[mp.playerId] ?? mp.playerId);
                          const t2 = currentMatchPlayers
                            .filter((mp) => mp.matchId === m.id && mp.team === 2)
                            .map((mp) => playerNameMap[mp.playerId] ?? mp.playerId);
                          return (
                            <div key={m.id} className="p-3 bg-[#FFFDF7] border-2 border-black rounded-xl text-xs flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1 font-bold text-neutral-800 text-xs flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug">
                                <span className="break-words">{t1.join(" & ")}</span>
                                <span className="inline-flex items-center gap-1.5 break-words">
                                  <span className="text-[10px] font-black uppercase text-neutral-400 shrink-0">vs</span>
                                  <span>{t2.join(" & ")}</span>
                                </span>
                              </div>
                              <Badge variant="success" className="shrink-0 whitespace-nowrap font-mono font-bold">
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
                  <div className="relative z-20 space-y-2 pt-2 border-t-2 border-black/20">
                    <h3 className="text-xs font-black uppercase tracking-wider text-black">Current Matchups</h3>
                    <div data-testid="current-matchups" className="max-h-[136px] overflow-y-auto lg:max-h-72 space-y-2 pr-1">
                      {currentRoundMatches.map((m) => {
                        const t1 = currentMatchPlayers
                          .filter((mp) => mp.matchId === m.id && mp.team === 1)
                          .map((mp) => playerNameMap[mp.playerId] ?? mp.playerId);
                        const t2 = currentMatchPlayers
                          .filter((mp) => mp.matchId === m.id && mp.team === 2)
                          .map((mp) => playerNameMap[mp.playerId] ?? mp.playerId);
                        return (
                          <div key={m.id} className="p-3 bg-[#FFFDF7] border-2 border-black rounded-xl text-xs flex items-center justify-between gap-2">
                            <div>
                              <span className="font-black text-black block">Court {m.courtNumber}</span>
                              <span className="font-bold text-neutral-800">{t1.join(" & ")} vs {t2.join(" & ")}</span>
                            </div>
                            {m.status === "completed" && (
                              <Badge variant="success" className="shrink-0 whitespace-nowrap font-mono font-bold">
                                {m.team1Score} – {m.team2Score}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}

              {isOrganizer ? (
                <div className="grid grid-cols-4 gap-3 items-stretch relative z-20">
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
                    <span>
                      {activeSession.type === "open_play"
                        ? "Manage Open Play →"
                        : "Resume Session →"}
                    </span>
                  </Link>
                </div>
              ) : (
                <div className="relative z-20">
                  <Link
                    href={`/g/${groupId}/sessions/${activeSession.id}`}
                    className="block text-center w-full py-3.5 px-4 rounded-xl bg-black hover:bg-neutral-900 text-white font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-transform active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <span>
                      {activeSession.type === "open_play"
                        ? "View Open Play →"
                        : "View Live Session →"}
                    </span>
                  </Link>
                </div>
              )}
            </section>
          ) : isOrganizer ? (
            <section className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-6">
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
            <section className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-6">
              <h2 className="font-display text-2xl font-black uppercase text-black mb-1">No Active Session</h2>
              <p className="text-sm font-bold text-neutral-700">
                There are no games in progress right now. Live matchups will appear here when an organizer starts a session.
              </p>
            </section>
          )}

          {/* Tournaments Section */}
          <section className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-6 lg:p-7">
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
          <section className="bg-[#FFFDF7] border-[3px] border-black rounded-3xl p-6 lg:p-7">
            <h2 className="font-display text-xl font-black uppercase text-black mb-4">Past Sessions</h2>
            <PastSessionsList
              groupId={groupId}
              sessions={pastSessionsData}
              isOrganizer={Boolean(isOrganizer || isHost)}
            />
          </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
