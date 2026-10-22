"use client";

import React, { useId, useMemo } from "react";
import { getSessionHighlights, type ClosestGame } from "@/lib/domain/session-highlights";
import type { PlayerRecord, StartedRoundRecord } from "@/lib/domain/types";

export function SessionHighlights({
  rounds,
  players,
  excludedMatchIds,
}: {
  readonly rounds: readonly StartedRoundRecord[];
  readonly players: readonly PlayerRecord[];
  readonly excludedMatchIds?: ReadonlySet<string>;
}) {
  const headingId = useId();
  const highlights = useMemo(() => getSessionHighlights(rounds, excludedMatchIds), [rounds, excludedMatchIds]);
  const names = new Map(players.map(player => [player.id, player.name]));
  const playerNames = (ids: readonly string[], separator = " · ") =>
    ids.map(id => names.get(id) ?? "Former player").sort((a, b) => a.localeCompare(b)).join(separator);
  const matchup = (game: ClosestGame) =>
    `${playerNames(game.team1, " & ") || "Team 1"} vs ${playerNames(game.team2, " & ") || "Team 2"}`;
  const closest = highlights.closestGames[0];
  if (!closest) return null;

  return (
    <section aria-labelledby={headingId} data-testid="session-highlights" className="rounded-3xl border-[3px] border-black bg-white p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-4 text-black">
      <div>
        <h2 id={headingId} className="font-display text-xl font-black uppercase tracking-wider">Session highlights</h2>
        <p className="mt-1 text-xs font-bold text-neutral-600">
          A few moments worth remembering. From {highlights.completedGames} completed game{highlights.completedGames === 1 ? "" : "s"}; ties shared.
        </p>
      </div>

      <div data-testid="highlight-closest-game" className="rounded-2xl border-2 border-black bg-[var(--neo-sky)] p-4 space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wide">Closest game</h3>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="font-display text-3xl font-black tabular-nums">{closest.team1Score} – {closest.team2Score}</p>
          <p className="text-xs font-bold">{Math.abs(closest.team1Score - closest.team2Score)}-point margin</p>
        </div>
        <p className="text-sm font-bold break-words">{matchup(closest)}</p>
        {highlights.closestGames.length > 1 && (
          <details className="text-xs font-bold">
            <summary className="cursor-pointer py-2 min-h-11 flex items-center underline underline-offset-4">
              {highlights.closestGames.length - 1} other game{highlights.closestGames.length === 2 ? "" : "s"} tied
            </summary>
            <ul className="space-y-2 pb-1">
              {highlights.closestGames.slice(1).map(game => (
                <li key={game.id} className="break-words">
                  <span className="font-black">{game.team1Score} – {game.team2Score}</span>{" · "}{matchup(game)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {highlights.mostWins && (
          <div data-testid="highlight-most-wins" className="rounded-2xl border-2 border-black bg-[var(--neo-yellow)] p-4 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wide">Most wins</h3>
            <p className="font-display text-2xl font-black">{highlights.mostWins.count} win{highlights.mostWins.count === 1 ? "" : "s"}</p>
            <p className="text-sm font-bold break-words">{playerNames(highlights.mostWins.playerIds)}</p>
          </div>
        )}
        {highlights.mostPartners && (
          <div data-testid="highlight-most-partners" className="rounded-2xl border-2 border-black bg-[#ecfccb] p-4 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wide">Most different partners</h3>
            <p className="font-display text-2xl font-black">{highlights.mostPartners.count} partner{highlights.mostPartners.count === 1 ? "" : "s"}</p>
            <p className="text-sm font-bold break-words">{playerNames(highlights.mostPartners.playerIds)}</p>
            <p className="text-xs font-bold text-neutral-700">Unique doubles teammates this session.</p>
          </div>
        )}
      </div>
    </section>
  );
}
