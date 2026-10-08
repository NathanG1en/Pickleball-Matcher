"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PublicGroupRecord } from "@/lib/domain/types";
import { joinPublicGroupAction } from "@/app/actions/player-account";

export function PublicGroupList({ groups, isSignedIn }: { groups: readonly PublicGroupRecord[]; isSignedIn: boolean }) {
  const router = useRouter();
  const [pendingGroup, setPendingGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const join = async (groupId: string) => {
    setPendingGroup(groupId);
    setError(null);
    const result = await joinPublicGroupAction({ groupId });
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
    setPendingGroup(null);
  };

  return <div className="space-y-3">
    {error && <div role="alert" className="rounded-xl border-2 border-black bg-[#ff6b6b] p-3 text-sm font-black">{error}</div>}
    {groups.length === 0 ? <p className="rounded-2xl border-2 border-dashed border-black p-6 text-center text-sm font-bold text-neutral-600">No public groups match that search.</p> : groups.map((group) => (
      <article key={group.id} className="flex items-center justify-between gap-4 rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0px_0px_#000]">
        <div className="min-w-0"><h2 className="truncate font-display text-xl font-black uppercase">{group.name}</h2><p className="text-xs font-bold text-neutral-600">{group.playerCount} active player{group.playerCount === 1 ? "" : "s"}</p></div>
        {group.isMember ? <span className="rounded-lg border-2 border-black bg-[#ccff00] px-3 py-2 text-xs font-black uppercase">Joined</span> : isSignedIn ? <button type="button" onClick={() => join(group.id)} disabled={pendingGroup !== null} className="rounded-xl border-2 border-black bg-[#ccff00] px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] disabled:opacity-60">{pendingGroup === group.id ? "Joining…" : "Join"}</button> : <Link href="/player-login" className="rounded-xl border-2 border-black bg-[#ccff00] px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000]">Sign in to join</Link>}
      </article>
    ))}
  </div>;
}
