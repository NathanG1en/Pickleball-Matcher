import React from "react";
import { notFound } from "next/navigation";

import { getActionRepository } from "@/app/actions/action-context";
import {
  SharedSessionView,
  type SharedCourtData,
} from "@/components/rounds/shared-session";

export default async function SharedSessionPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const repository = getActionRepository();

  const group = await repository.getGroupByShareId(shareId);
  if (!group) {
    notFound();
  }

  const [sessions, players] = await Promise.all([
    repository.listSessions(group.id),
    repository.listPlayers(group.id),
  ]);

  const playerNames: Record<string, string> = {};
  for (const p of players) {
    playerNames[p.id] = p.name;
  }

  const activeSession = sessions.find((s) => s.status === "active") ?? sessions[0];

  if (!activeSession) {
    return (
      <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto flex items-center justify-center text-black">
        <div className="bg-white border-[3px] border-black rounded-3xl p-8 text-center space-y-3 shadow-[8px_8px_0px_0px_#000]">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            {group.name}
          </span>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight text-black">No Active Session</h1>
          <p className="text-sm font-bold text-neutral-700">
            The organizer has not started a session yet. Refresh when play begins!
          </p>
        </div>
      </main>
    );
  }

  const startedRounds = await repository.listStartedRounds(activeSession.id);
  const latestRound = startedRounds.at(-1);

  const courts: SharedCourtData[] = latestRound
    ? latestRound.matches.map((m) => {
        const team1 = latestRound.matchPlayers
          .filter((mp) => mp.matchId === m.id && mp.team === 1)
          .map((mp) => playerNames[mp.playerId] ?? mp.playerId);
        const team2 = latestRound.matchPlayers
          .filter((mp) => mp.matchId === m.id && mp.team === 2)
          .map((mp) => playerNames[mp.playerId] ?? mp.playerId);

        return {
          courtNumber: m.courtNumber,
          team1Names: [team1[0] ?? "Player 1", team1[1] ?? "Player 2"],
          team2Names: [team2[0] ?? "Player 3", team2[1] ?? "Player 4"],
          team1Score: m.team1Score,
          team2Score: m.team2Score,
          status: m.status,
        };
      })
    : [];

  const sittingPlayerNames: string[] = latestRound
    ? latestRound.sits.map((s) => playerNames[s.playerId] ?? s.playerId)
    : [];

  return (
    <main className="min-h-screen p-4 sm:p-6 text-black">
      <SharedSessionView
        groupName={group.name}
        sessionStatus={activeSession.status}
        currentRoundNumber={latestRound?.round.roundNumber ?? 0}
        courts={courts}
        sittingPlayerNames={sittingPlayerNames}
      />
    </main>
  );
}
