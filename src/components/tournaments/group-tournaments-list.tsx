import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
      <div className="text-center py-6 px-4 rounded-2xl bg-neutral-50 border-2 border-dashed border-neutral-300 space-y-3">
        <span className="text-2xl block">🏆</span>
        <p className="text-sm font-bold text-neutral-600">
          No tournaments created yet.
        </p>
        {isOrganizer && (
          <Link
            href={`/g/${groupId}/tournaments/new`}
            className="inline-block px-4 py-2 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-sm font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            Create First Tournament →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tournaments.map((tourney) => (
        <div
          key={tourney.id}
          className="p-4 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] space-y-3 hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-black uppercase text-black leading-tight">
                {tourney.name}
              </h3>
              <p className="text-xs font-bold text-neutral-500">
                Created {new Date(tourney.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Badge variant={tourney.status === "completed" ? "success" : "default"}>
              {tourney.status === "completed" ? "Completed" : "Active"}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {tourney.divisions.map((div) => (
              <span
                key={div}
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-black bg-neutral-100 text-black shadow-[1px_1px_0px_0px_#000]"
              >
                {TOURNAMENT_DIVISION_LABELS[div] ?? div}
              </span>
            ))}
          </div>

          <Link
            href={`/g/${groupId}/tournaments/${tourney.id}`}
            className="block text-center w-full py-2 px-3 rounded-xl bg-black hover:bg-neutral-800 text-white font-display text-sm font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
          >
            {isOrganizer ? "Manage Bracket →" : "View Bracket →"}
          </Link>
        </div>
      ))}
    </div>
  );
}

