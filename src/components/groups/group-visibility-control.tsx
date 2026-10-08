"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateGroupVisibilityAction } from "@/app/actions/group-settings";

export function GroupVisibilityControl({ groupId, initialIsPublic }: { groupId: string; initialIsPublic: boolean }) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const toggle = async (nextIsPublic: boolean) => {
    setPending(true);
    setError(null);
    const result = await updateGroupVisibilityAction({ groupId, isPublic: nextIsPublic });
    if (result.ok) {
      setIsPublic(nextIsPublic);
      router.refresh();
    } else setError(result.error ?? "Unable to update visibility.");
    setPending(false);
  };
  return <div className="mt-4 border-t-2 border-black/10 pt-4">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-wider">Player discovery</p><p className="text-xs font-bold text-neutral-600">{isPublic ? "Players can find and join this group." : "This group is private and hidden from search."}</p></div>
      <button type="button" onClick={() => toggle(!isPublic)} disabled={pending} className="rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047] disabled:opacity-60">{pending ? "Saving…" : isPublic ? "Make private" : "Make public"}</button>
    </div>
    {error && <p role="alert" className="mt-2 text-xs font-black text-red-700">{error}</p>}
  </div>;
}
