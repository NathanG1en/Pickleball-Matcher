"use client";

import React from "react";
import type { RoundCourtData } from "@/components/rounds/current-round";

export interface TeamSynergyInfo {
  readonly score: number;
  readonly matchesPlayed: number;
}

export interface CourtSynergiesMap {
  [courtNumber: number]: {
    team1?: TeamSynergyInfo | null;
    team2?: TeamSynergyInfo | null;
  };
}

interface SynergyRevealModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly courts: readonly RoundCourtData[];
  readonly courtSynergies: CourtSynergiesMap;
  readonly playerNames: Record<string, string>;
  readonly playerAccounts?: Record<string, boolean>;
}

export function SynergyRevealModal({
  isOpen,
  onClose,
  courts,
  courtSynergies,
  playerNames,
  playerAccounts = {},
}: SynergyRevealModalProps) {
  if (!isOpen) return null;

  const nameFor = (id: string) => playerNames[id] ?? id;
  const isGuest = (id: string) => playerAccounts[id] === false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border-[3px] border-black bg-white p-6 shadow-[8px_8px_0px_0px_#000] text-black">
        <div className="mb-4 flex items-center justify-between border-b-2 border-neutral-100 pb-3">
          <div>
            <h2 className="font-display text-2xl font-black uppercase">⚡ Court Synergy &amp; Chemistry</h2>
            <p className="text-xs font-bold text-neutral-600">Historical doubles chemistry across active courts</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-black bg-neutral-100 px-3 py-1 text-sm font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-200 active:translate-x-[1px] active:translate-y-[1px]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {courts
            .filter((c) => c.team1.length > 0 && c.team2.length > 0)
            .map((court) => {
              const syn = courtSynergies[court.courtNumber];
              const t1Names = court.team1.map(nameFor).join(" & ");
              const t2Names = court.team2.map(nameFor).join(" & ");
              const t1HasGuest = court.team1.some(isGuest);
              const t2HasGuest = court.team2.some(isGuest);

              return (
                <div
                  key={court.courtNumber}
                  className="rounded-2xl border-2 border-black bg-neutral-50 p-4 shadow-[3px_3px_0px_0px_#000]"
                >
                  <h3 className="mb-2 font-display text-lg font-black uppercase">
                    Court {court.courtNumber}
                  </h3>

                  <div className="space-y-2 text-xs font-bold">
                    {/* Team 1 */}
                    <div className="flex items-center justify-between rounded-xl border border-black/20 bg-[#e0f2fe] p-2.5">
                      <span className="font-black text-sky-950">{t1Names}</span>
                      {court.team1.length === 2 && syn?.team1 ? (
                        <span className="rounded-full border border-black bg-[#ccff00] px-2 py-0.5 text-[10px] font-black uppercase text-black">
                          ⚡ {syn.team1.score}% ({syn.team1.matchesPlayed} games)
                        </span>
                      ) : court.team1.length === 2 && t1HasGuest ? (
                        <span
                          className="rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900"
                          title="At least one player is a guest without an account. Registered accounts are required to record synergy."
                        >
                          ⚠️ Ineligible (Guest Duo)
                        </span>
                      ) : court.team1.length === 2 ? (
                        <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                          ⚡ New Duo (0 games)
                        </span>
                      ) : (
                        <span className="text-neutral-500 text-[10px]">Singles / Solo</span>
                      )}
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center justify-between rounded-xl border border-black/20 bg-[#ffedd5] p-2.5">
                      <span className="font-black text-amber-950">{t2Names}</span>
                      {court.team2.length === 2 && syn?.team2 ? (
                        <span className="rounded-full border border-black bg-[#ccff00] px-2 py-0.5 text-[10px] font-black uppercase text-black">
                          ⚡ {syn.team2.score}% ({syn.team2.matchesPlayed} games)
                        </span>
                      ) : court.team2.length === 2 && t2HasGuest ? (
                        <span
                          className="rounded-full border border-amber-400 bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900"
                          title="At least one player is a guest without an account. Registered accounts are required to record synergy."
                        >
                          ⚠️ Ineligible (Guest Duo)
                        </span>
                      ) : court.team2.length === 2 ? (
                        <span className="rounded-full border border-neutral-300 bg-white px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                          ⚡ New Duo (0 games)
                        </span>
                      ) : (
                        <span className="text-neutral-500 text-[10px]">Singles / Solo</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        <div className="mt-4 rounded-xl border border-neutral-300 bg-neutral-100 p-2.5 text-[11px] font-semibold text-neutral-700">
          💡 <strong>Synergy Eligibility</strong>: Chemistry is tracked between registered player accounts. Matches involving guest players do not record doubles synergy.
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border-2 border-black bg-black py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px]"
        >
          Close Breakdown
        </button>
      </div>
    </div>
  );
}
