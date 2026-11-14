"use client";

import Link from "next/link";
import type { PlayerAccountRecord } from "@/lib/domain/types";
import { formatDupr } from "@/lib/domain/rating-display";
import { EmptyState } from "@/components/ui";
import { GlobeIcon, LockIcon, UsersIcon } from "@/components/ui/icons";
import { parseProfileVisibilitySettings } from "@/lib/privacy/profile-visibility";

interface FindPlayerListProps {
  readonly players: readonly PlayerAccountRecord[];
  readonly currentAccountId?: string | null;
}

export function FindPlayerList({ players, currentAccountId }: FindPlayerListProps) {
  if (players.length === 0) {
    return <EmptyState description="No players match that search." />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {players.map((player) => {
        const isSelf = Boolean(currentAccountId && currentAccountId === player.id);
        const visibility = parseProfileVisibilitySettings(player.visibilitySettings, player.isPublic ?? true);
        const profileLevel = visibility.profile;
        const currentRating = player.rating ?? player.initialRating;
        const formattedRating = formatDupr(currentRating);
        const genderLabel = player.gender === "male" ? "Male" : player.gender === "female" ? "Female" : null;

        return (
          <article
            key={player.id}
            data-testid={`player-card-${player.username}`}
            className="flex items-center justify-between gap-4 rounded-2xl border-2 border-black bg-[#FFFDF7] p-4 shadow-[3px_3px_0px_0px_#000]"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="truncate font-display text-xl font-black uppercase text-black">
                  {player.name}
                </h2>
                {isSelf && (
                  <span className="rounded-md border-2 border-black bg-[#fde047] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                    You
                  </span>
                )}
                {profileLevel === "everyone" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border-2 border-black bg-[#ccff00] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black whitespace-nowrap">
                    <GlobeIcon className="h-2.5 w-2.5 shrink-0" />
                    <span>Everyone</span>
                  </span>
                ) : profileLevel === "group_members" ? (
                  <span className="inline-flex items-center gap-1 rounded-md border-2 border-black bg-[#e0e7ff] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black whitespace-nowrap">
                    <UsersIcon className="h-2.5 w-2.5 shrink-0" />
                    <span>Group Members</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md border-2 border-black bg-neutral-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black whitespace-nowrap">
                    <LockIcon className="h-2.5 w-2.5 shrink-0" />
                    <span>Private</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-neutral-600">
                <span className="text-black font-extrabold">@{player.username}</span>
                {/* For private players, hide gender and rating from other viewers */}
                {(isSelf || profileLevel !== "only_you") && (
                  <>
                    {genderLabel && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="uppercase">{genderLabel}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="uppercase text-neutral-700">
                      Rating: <span className="font-black text-black">{formattedRating}</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/players/${encodeURIComponent(player.username)}`}
                className="rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer transition-transform"
              >
                View Profile
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

