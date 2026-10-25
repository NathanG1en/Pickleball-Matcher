"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { PlayerRecord, TournamentFormat } from "@/lib/domain/types";
import { TournamentCreationForm } from "./tournament-creation-form";
import { TeamTournamentCreationForm } from "./team-tournament-creation-form";

interface NewTournamentClientProps {
  readonly groupId: string;
  readonly groupName: string;
  readonly initialPlayers: readonly PlayerRecord[];
  readonly initialFormat?: TournamentFormat;
}

export function NewTournamentClient({
  groupId,
  groupName,
  initialPlayers,
  initialFormat,
}: NewTournamentClientProps) {
  const [selectedFormat, setSelectedFormat] = useState<TournamentFormat | null>(
    initialFormat ?? null
  );

  const handleSelectFormat = (format: TournamentFormat | null) => {
    setSelectedFormat(format);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (format) {
        url.searchParams.set("format", format);
      } else {
        url.searchParams.delete("format");
      }
      window.history.replaceState(null, "", url.toString());
    }
  };

  if (!selectedFormat) {
    return (
      <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 text-black">
        <div className="flex items-center justify-between">
          <Link
            href={`/g/${groupId}`}
            className="px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform"
          >
            ← Back to Group
          </Link>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            Step 1 of 2
          </span>
        </div>

        <header>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
            Choose Tournament Format
          </h1>
          <p className="text-sm font-bold text-neutral-700 mt-1">
            Select how you want your tournament to run.
          </p>
        </header>

        <div className="space-y-4">
          {/* Card 1: Division Brackets */}
          <div className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-4 transition-all">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider text-black bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                Single Elimination
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                Divisions
              </span>
            </div>

            <div>
              <h2 className="font-display text-2xl font-black uppercase text-black">
                Division Brackets
              </h2>
              <p className="text-sm font-bold text-neutral-700 mt-1 leading-snug">
                Traditional elimination brackets broken down by player divisions (Men&apos;s, Women&apos;s, Mixed).
              </p>
            </div>

            <ul className="text-xs font-bold text-neutral-800 space-y-1.5 bg-neutral-50 p-3.5 rounded-2xl border-2 border-black/10">
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Men&apos;s &amp; Women&apos;s Singles and Doubles
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Mixed Doubles bracket pairings
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Interactive bracket tree with visual progressions
              </li>
            </ul>

            <button
              type="button"
              data-testid="select-bracket-tournament-button"
              onClick={() => handleSelectFormat("bracket")}
              className="w-full py-3.5 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white font-display text-base font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              Select Division Brackets →
            </button>
          </div>

          {/* Card 2: Team Tournament */}
          <div className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-4 transition-all">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                Team Clash &amp; MLP
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                Teams &amp; Partners
              </span>
            </div>

            <div>
              <h2 className="font-display text-2xl font-black uppercase text-black">
                Team Tournament
              </h2>
              <p className="text-sm font-bold text-neutral-700 mt-1 leading-snug">
                Group players into 2 or more teams. Lock doubles partners together, battle across court lines, and crown a team champion.
              </p>
            </div>

            <ul className="text-xs font-bold text-neutral-800 space-y-1.5 bg-neutral-50 p-3.5 rounded-2xl border-2 border-black/10">
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Pre-formed doubles pairs stay locked on the same team
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Auto-balanced team rosters equalized by player DUPR
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Live team scoreboard with tiebreaker / Dreambreaker support
              </li>
            </ul>

            <button
              type="button"
              data-testid="select-team-tournament-button"
              onClick={() => handleSelectFormat("team_dual")}
              className="w-full py-3.5 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-base font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              Select Team Tournament →
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 text-black">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleSelectFormat(null)}
          className="px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer"
        >
          ← Change Format
        </button>
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          Step 2 of 2
        </span>
      </div>

      <header>
        <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
          {selectedFormat === "team_dual" ? "Create Team Tournament" : "Create Division Tournament"}
        </h1>
        <p className="text-sm font-bold text-neutral-700 mt-1">
          {selectedFormat === "team_dual"
            ? "Pair partners and balance teams for the clash."
            : "Select divisions and players to generate randomized tournament brackets."}
        </p>
      </header>

      {selectedFormat === "team_dual" ? (
        <TeamTournamentCreationForm
          groupId={groupId}
          groupName={groupName}
          initialPlayers={initialPlayers}
        />
      ) : (
        <TournamentCreationForm
          groupId={groupId}
          groupName={groupName}
          initialPlayers={initialPlayers}
        />
      )}
    </main>
  );
}

