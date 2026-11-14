"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PublicGroupRecord } from "@/lib/domain/types";
import { joinPublicGroupAction } from "@/app/actions/player-account";
import { saveRecentGroup } from "@/lib/storage/recent-groups";
import { Alert, EmptyState } from "@/components/ui";
import { LeaveGroupButton } from "@/components/players/player-profile-controls";

const emptyActionClass =
  "inline-flex min-h-11 items-center rounded-xl border-2 border-black px-4 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all";

export function PublicGroupList({
  groups,
  isSignedIn,
  query = "",
}: {
  groups: readonly PublicGroupRecord[];
  isSignedIn: boolean;
  query?: string;
}) {
  const trimmedQuery = query.trim();
  const router = useRouter();
  const [pendingGroup, setPendingGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const join = async (groupId: string, groupName: string) => {
    setPendingGroup(groupId);
    setError(null);
    const result = await joinPublicGroupAction({ groupId });
    if (result.ok) {
      saveRecentGroup({ id: groupId, name: groupName });
      router.refresh();
    } else {
      setError(result.error);
    }
    setPendingGroup(null);
  };

  return (
    <div className="space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}
      {groups.length === 0 ? (
        trimmedQuery ? (
          <EmptyState
            data-testid="public-groups-no-results"
            title={`No groups match “${trimmedQuery}”`}
            description="Check the spelling or try part of the name. Private groups never appear in search."
            action={
              <Link href="/players/groups" className={`${emptyActionClass} bg-white hover:bg-neutral-100`}>
                Clear search
              </Link>
            }
          />
        ) : (
          <EmptyState
            data-testid="public-groups-empty"
            title="No public groups yet"
            description="Most groups are private. Ask your organizer for an invite link, or start a group of your own."
            action={
              <Link
                href={isSignedIn ? "/setup" : `/player-signup?next=${encodeURIComponent("/setup")}`}
                className={`${emptyActionClass} bg-[#ccff00] hover:bg-[#b8eb00]`}
              >
                {isSignedIn ? "Create a group" : "Create an account"}
              </Link>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {groups.map((group) => (
            <article key={group.id} className="flex items-center justify-between gap-4 rounded-2xl border-2 border-black bg-[#FFFDF7] p-4 shadow-[3px_3px_0px_0px_#000]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="truncate font-display text-xl font-black uppercase">{group.name}</h2>
            {group.isHost ? (
              <span className="rounded-md border-2 border-black bg-[#fde047] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                Host
              </span>
            ) : group.isOrganizer ? (
              <span className="rounded-md border-2 border-black bg-[#bae6fd] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                Organizer
              </span>
            ) : group.isMember ? (
              <span className="rounded-md border-2 border-black bg-[#ccff00] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                Member
              </span>
            ) : null}
          </div>
          <p className="text-xs font-bold text-neutral-600">{group.playerCount} active player{group.playerCount === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/g/${group.id}`}
            className="rounded-xl border-2 border-black bg-white px-2.5 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            View Group
          </Link>
          {group.isMember ? (
            !group.isHost && <LeaveGroupButton groupId={group.id} groupName={group.name} />
          ) : isSignedIn ? (
            <button
              type="button"
              onClick={() => join(group.id, group.name)}
              disabled={pendingGroup !== null}
              className="rounded-xl border-2 border-black bg-[#ccff00] px-2.5 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8eb00] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60 cursor-pointer"
            >
              {pendingGroup === group.id ? "Joining…" : "Join"}
            </button>
          ) : (
            <Link
              href="/player-login"
              className="rounded-xl border-2 border-black bg-[#ccff00] px-2.5 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8eb00] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              Sign in to join
            </Link>
          )}
        </div>
      </article>
    ))}
        </div>
      )}
    </div>
  );
}
