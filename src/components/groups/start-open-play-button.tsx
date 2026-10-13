"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { startOpenPlaySessionAction } from "@/app/actions/open-play";

export function StartOpenPlayButton({
  groupId,
}: {
  groupId: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setIsPending(true);
    setError(null);
    try {
      const res = await startOpenPlaySessionAction({ groupId });
      if (res.ok) {
        router.push(`/g/${groupId}/sessions/${res.data.id}`);
      } else {
        setError(res.error ?? "Failed to start open play session");
        setIsPending(false);
      }
    } catch {
      setError("An unexpected error occurred.");
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={handleStart}
        disabled={isPending}
        data-testid="start-open-play-button"
        className="inline-block text-center w-full sm:w-auto min-w-[200px] py-3.5 px-6 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] disabled:opacity-60 cursor-pointer"
      >
        {isPending ? "Starting..." : "Start Open Play"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-red-600 text-center">
          {error}
        </p>
      )}
    </div>
  );
}

