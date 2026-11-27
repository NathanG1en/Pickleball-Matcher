import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TrophyIcon } from "@/components/ui/icons";
import {
  TOURNAMENT_DIVISION_LABELS,
  type TournamentRecord,
} from "@/lib/domain/types";

interface GroupTournamentsListProps {
  readonly groupId: string;
  readonly tournaments: readonly TournamentRecord[];
  readonly isOrganizer: boolean;
}

export function GroupTournamentsList({
  groupId,
  tournaments,
  isOrganizer,
}: GroupTournamentsListProps) {
  if (tournaments.length === 0) {
    return (
      <div className="flex items-center gap-3 py-2">
        <TrophyIcon className="h-6 w-6 shrink-0 text-neutral-600" />
        <p className="text-sm font-bold text-neutral-700">
          No tournaments yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tournaments.map((tourney) => (
        <div
          key={tourney.id}
          className="p-4 bg-[#FFFDF7] border-2 border-black rounded-2xl space-y-3 hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-black uppercase text-black leading-tight">
                {tourney.name}
              </h3>
              <p className="text-xs font-bold text-neutral-600">
                Created <span suppressHydrationWarning>{new Date(tourney.createdAt).toLocaleDateString()}</span>
              </p>
            </div>
            <Badge variant={tourney.status === "completed" ? "success" : "default"}>
              {tourney.status === "completed" ? "Completed" : "Active"}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {tourney.format === "team_dual" ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md border border-black bg-[#ccff00] text-black shadow-[1px_1px_0px_0px_#000]">
                Team Tournament
              </span>
            ) : (
              tourney.divisions.map((div) => (
                <span
                  key={div}
                  className="text-xs font-bold px-2 py-0.5 rounded-md border border-black bg-neutral-100 text-black shadow-[1px_1px_0px_0px_#000]"
                >
                  {TOURNAMENT_DIVISION_LABELS[div] ?? div}
                </span>
              ))
            )}
          </div>

          <Link
            href={`/g/${groupId}/tournaments/${tourney.id}`}
            className="block text-center w-full py-2 px-3 rounded-xl bg-black hover:bg-neutral-800 text-white text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
          >
            {isOrganizer ? "Manage Bracket →" : "View Bracket →"}
          </Link>
        </div>
      ))}
    </div>
  );
}

