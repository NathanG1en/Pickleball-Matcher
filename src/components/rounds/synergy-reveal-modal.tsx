"use client";

import React from "react";
import type { RoundCourtData } from "@/components/rounds/current-round";

export type TeamSynergyStatus = "calculated" | "new_duo" | "guest_ineligible" | "solo";

export interface TeamSynergyInfo {
  readonly score?: number;
  readonly matchesPlayed?: number;
  readonly status?: TeamSynergyStatus;
  readonly reason?: string;
  readonly hasGuest?: boolean;
}

export interface CourtSynergiesMap {
  [courtNumber: number]: {
    team1?: TeamSynergyInfo | null;
    team2?: TeamSynergyInfo | null;
  };
}

export interface SynergyRevealModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly courts: readonly RoundCourtData[];
  readonly courtSynergies: CourtSynergiesMap;
  readonly playerNames: Record<string, string>;
  readonly playerAccounts?: Record<string, string | null>;
}

function resolveTeamSynergy(
  teamPlayerIds: readonly string[],
  synInfo: TeamSynergyInfo | null | undefined,
  playerAccounts?: Record<string, string | null>,
  playerNames?: Record<string, string>
) {
  if (teamPlayerIds.length !== 2) {
    return {
      status: "solo" as const,
      badgeText: "Singles / Solo",
      badgeStyle: "border-neutral-300 bg-white text-neutral-500",
      message: "Doubles synergy requires a 2-player team.",
      icon: "ℹ️",
    };
  }

  const p1 = teamPlayerIds[0];
  const p2 = teamPlayerIds[1];
  const p1IsGuest = playerAccounts ? playerAccounts[p1] === null : synInfo?.hasGuest || synInfo?.status === "guest_ineligible";
  const p2IsGuest = playerAccounts ? playerAccounts[p2] === null : synInfo?.hasGuest || synInfo?.status === "guest_ineligible";
  const hasGuest = Boolean(p1IsGuest || p2IsGuest);

  if (hasGuest) {
    const p1Name = playerNames?.[p1] ?? p1;
    const p2Name = playerNames?.[p2] ?? p2;
    const guestNames = [p1IsGuest ? p1Name : null, p2IsGuest ? p2Name : null].filter(Boolean).join(" & ");
    const message =
      p1IsGuest && p2IsGuest
        ? "Both players are guests without accounts — cannot track synergy."
        : `${guestNames} is a guest without an account — cannot track synergy.`;

    return {
      status: "guest_ineligible" as const,
      badgeText: "⚠️ Guest Ineligible",
      badgeStyle: "border-amber-400 bg-amber-100 text-amber-900",
      message,
      icon: "⚠️",
    };
  }

  if (synInfo?.score !== undefined && synInfo?.matchesPlayed !== undefined) {
    return {
      status: "calculated" as const,
      badgeText: `⚡ ${synInfo.score}% (${synInfo.matchesPlayed} games)`,
      badgeStyle: "border-black bg-[#ccff00] text-black",
      message: undefined,
      icon: undefined,
    };
  }

  return {
    status: "new_duo" as const,
    badgeText: "New Duo (0 games)",
    badgeStyle: "border-neutral-300 bg-white text-neutral-600",
    message: "First match together — chemistry unlocks after 1st match.",
    icon: "ℹ️",
  };
}

export function SynergyRevealModal({
  isOpen,
  onClose,
  courts,
  courtSynergies,
  playerNames,
  playerAccounts,
}: SynergyRevealModalProps) {
  if (!isOpen) return null;

  const nameFor = (id: string) => playerNames[id] ?? id;

  const hasUncalculated = courts.some((c) => {
    const t1 = resolveTeamSynergy(c.team1, courtSynergies[c.courtNumber]?.team1, playerAccounts, playerNames);
    const t2 = resolveTeamSynergy(c.team2, courtSynergies[c.courtNumber]?.team2, playerAccounts, playerNames);
    return t1.status !== "calculated" || t2.status !== "calculated";
  });

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

        {hasUncalculated && (
          <div className="mb-4 rounded-2xl border-2 border-black bg-amber-50 p-4 shadow-[3px_3px_0px_0px_#000] text-black">
            <div className="flex items-start gap-2.5">
              <span className="text-xl select-none leading-none">⚠️</span>
              <div className="space-y-1 text-xs">
                <h4 className="font-display font-black uppercase tracking-wider text-amber-950">
                  Notice: Synergy Not Yet Available For Some Duos
                </h4>
                <p className="font-medium text-neutral-700">
                  Doubles synergy cannot be calculated when:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-neutral-600 font-semibold pl-1">
                  <li><strong>Guest Players:</strong> Players without a registered account cannot track chemistry across sessions.</li>
                  <li><strong>New Duos:</strong> Chemistry score unlocks after partners complete their 1st doubles match together.</li>
                  <li><strong>Singles:</strong> Solo matches do not track doubles chemistry.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {courts
            .filter((c) => c.team1.length > 0 && c.team2.length > 0)
            .map((court) => {
              const syn = courtSynergies[court.courtNumber];
              const t1Names = court.team1.map(nameFor).join(" & ");
              const t2Names = court.team2.map(nameFor).join(" & ");
              const t1Res = resolveTeamSynergy(court.team1, syn?.team1, playerAccounts, playerNames);
              const t2Res = resolveTeamSynergy(court.team2, syn?.team2, playerAccounts, playerNames);

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
                    <div className="rounded-xl border border-black/20 bg-[#e0f2fe] p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-sky-950 truncate">{t1Names}</span>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] ${t1Res.badgeStyle}`}>
                          {t1Res.badgeText}
                        </span>
                      </div>
                      {t1Res.message && (
                        <p className="text-[10px] font-bold text-neutral-700 flex items-center gap-1">
                          <span>{t1Res.icon}</span>
                          <span>{t1Res.message}</span>
                        </p>
                      )}
                    </div>

                    {/* Team 2 */}
                    <div className="rounded-xl border border-black/20 bg-[#ffedd5] p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-amber-950 truncate">{t2Names}</span>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] ${t2Res.badgeStyle}`}>
                          {t2Res.badgeText}
                        </span>
                      </div>
                      {t2Res.message && (
                        <p className="text-[10px] font-bold text-neutral-700 flex items-center gap-1">
                          <span>{t2Res.icon}</span>
                          <span>{t2Res.message}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl border-2 border-black bg-black py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:bg-neutral-900 active:translate-x-[1px] active:translate-y-[1px]"
        >
          Close Breakdown
        </button>
      </div>
    </div>
  );
}
