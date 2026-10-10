"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinPublicGroupAction } from "@/app/actions/player-account";

export function GroupJoinCard({
  groupId,
  groupName,
  isSignedIn,
}: {
  groupId: string;
  groupName: string;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setPending(true);
    setError(null);
    const result = await joinPublicGroupAction({ groupId });
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
    setPending(false);
  };

  return (
    <section className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
      <div>
        <h2 className="font-display text-2xl font-black uppercase text-black mb-1">
          Join {groupName}
        </h2>
        <p className="text-sm font-bold text-neutral-700">
          You are viewing this public group as a visitor. Join the group to participate in sessions, view live matchups, and track your match stats!
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border-2 border-black bg-[#ff6b6b] p-3 text-sm font-black">
          {error}
        </div>
      )}

      {isSignedIn ? (
        <button
          type="button"
          onClick={handleJoin}
          disabled={pending}
          className="block text-center w-full py-3.5 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] disabled:opacity-60 cursor-pointer"
        >
          {pending ? "Joining…" : "Join Group Now"}
        </button>
      ) : (
        <Link
          href="/player-login"
          className="block text-center w-full py-3.5 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] cursor-pointer"
        >
          Sign In to Join Group
        </Link>
      )}
    </section>
  );
}

