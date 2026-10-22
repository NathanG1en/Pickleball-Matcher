"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { endSessionAction } from "@/app/actions/sessions";
import { endOpenPlaySessionAction } from "@/app/actions/open-play";
import { createIdempotencyKey } from "@/lib/utils/idempotency";
import { markSessionEnded } from "@/lib/animations/session-signoff";

export interface EndSessionNowButtonProps {
  readonly groupId: string;
  readonly sessionId: string;
  readonly sessionType?: string | null;
  readonly sessionVersion?: number;
}

export function EndSessionNowButton({
  groupId,
  sessionId,
  sessionType,
  sessionVersion = 1,
}: EndSessionNowButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEndSession = async () => {
    setIsPending(true);
    setError(null);
    try {
      const res =
        sessionType === "open_play"
          ? await endOpenPlaySessionAction({ groupId, sessionId })
          : await endSessionAction({
              groupId,
              sessionId,
              sessionVersion,
              idempotencyKey: createIdempotencyKey("end_now"),
            });

      if (res.ok) {
        markSessionEnded(groupId, sessionId);
        router.refresh();
      } else {
        setError(res.error ?? "Failed to end session.");
      }
    } catch {
      setError("Failed to end session.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="h-full flex flex-col justify-stretch">
      <button
        type="button"
        onClick={handleEndSession}
        disabled={isPending}
        data-testid="end-session-now-button"
        aria-label="End session"
        className="flex items-center justify-center text-center w-full h-full py-2 sm:py-3.5 px-2 sm:px-3 rounded-xl bg-[#ff6b6b] hover:bg-[#ff5252] text-black border-2 border-black font-display text-xs sm:text-sm font-black uppercase tracking-wider leading-tight shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {isPending ? "Ending..." : "End Session"}
      </button>
      {error && (
        <p role="alert" className="text-[10px] font-bold text-red-600 mt-1 text-center">
          {error}
        </p>
      )}
    </div>
  );
}
