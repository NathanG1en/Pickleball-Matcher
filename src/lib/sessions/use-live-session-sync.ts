"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSessionLiveStampAction } from "@/app/actions/sessions";

export const LIVE_SESSION_POLL_MS = 5_000;

/**
 * Keeps a watching device in step with a live session. While the tab is visible
 * it polls the session's live stamp, and asks the router for fresh server data
 * only when the stamp differs from what is on screen. It also checks straight
 * away when the tab becomes visible, the window regains focus, or the device
 * comes back online, so a phone pulled out of a pocket catches up immediately.
 */
export function useLiveSessionSync({
  enabled,
  groupId,
  sessionId,
  stamp,
  intervalMs = LIVE_SESSION_POLL_MS,
}: {
  enabled: boolean;
  groupId: string;
  sessionId: string;
  stamp: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const stampRef = useRef(stamp);
  const refreshRequestedForRef = useRef<string | null>(null);

  useEffect(() => {
    stampRef.current = stamp;
    refreshRequestedForRef.current = null;
  }, [stamp]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let inFlight = false;

    const check = async () => {
      if (inFlight || (typeof document !== "undefined" && document.hidden)) return;
      inFlight = true;
      try {
        const result = await getSessionLiveStampAction({ groupId, sessionId });
        if (cancelled || !result.ok) return;
        const serverStamp = result.data.stamp;
        // Ask for a refresh once per new server state, not on every tick while it loads.
        if (serverStamp !== stampRef.current && refreshRequestedForRef.current !== serverStamp) {
          refreshRequestedForRef.current = serverStamp;
          router.refresh();
        }
      } catch {
        // Background checks fail quietly; the next tick or focus retries.
      } finally {
        inFlight = false;
      }
    };

    const intervalId = setInterval(check, intervalMs);
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    const onWake = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [enabled, groupId, sessionId, intervalMs, router]);
}
