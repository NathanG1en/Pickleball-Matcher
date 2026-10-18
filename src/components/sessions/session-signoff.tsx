"use client";

import { useEffect, useRef } from "react";
import { PickleballIcon } from "@/components/ui/icons";
import { consumeSessionEnded } from "@/lib/animations/session-signoff";

export function SessionSignOff({
  groupId,
  sessionId,
  play = false,
}: {
  readonly groupId?: string;
  readonly sessionId?: string;
  readonly play?: boolean;
}) {
  const artRef = useRef<SVGSVGElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const art = artRef.current;
    if (!art || played.current) return;
    const justEnded = play || Boolean(groupId && sessionId && consumeSessionEnded(groupId, sessionId));
    if (!justEnded) return;
    played.current = true;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) art.dataset.motion = "roll";
  }, [groupId, sessionId, play]);

  const replay = () => {
    const art = artRef.current;
    if (!art || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Let the current animation finish before accepting another replay.
    if (art.dataset.motion !== "roll") art.dataset.motion = "roll";
  };

  return (
    <button
      type="button"
      aria-label="Replay session sign-off"
      title="Replay session sign-off"
      className="inline-flex h-11 w-[72px] shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-black"
      onClick={replay}
    >
      <svg
        ref={artRef}
        width="72"
        height="40"
        viewBox="0 0 72 40"
        className="session-signoff pointer-events-none block shrink-0 text-black"
        data-testid="session-signoff"
        data-motion="still"
        aria-hidden="true"
        focusable="false"
        onAnimationEnd={event => {
          if (event.animationName === "session-signoff-roll") event.currentTarget.dataset.motion = "still";
        }}
      >
        <g transform="translate(4 2) rotate(-18 17 18)">
          <rect x="8" y="3" width="22" height="24" rx="8" fill="var(--neo-sky)" stroke="currentColor" strokeWidth="2" />
          <path d="M16 27v9h6v-9" fill="var(--neo-yellow)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M13 11h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="session-signoff-ball">
          <PickleballIcon x="40" y="20" width="16" height="16" className="" />
        </g>
      </svg>
    </button>
  );
}
