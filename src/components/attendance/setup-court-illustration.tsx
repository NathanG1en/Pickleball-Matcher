"use client";

import { useEffect, useRef } from "react";
import { PickleballIcon } from "@/components/ui/icons";

const SESSION_KEY = "pickleball:setup-court:v1";

export function SetupCourtIllustration() {
  const courtRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const court = courtRef.current;
    // Keep the first animation running when Strict Mode reconnects this effect.
    if (!court || court.dataset.motion === "settle") return;
    court.dataset.motion = "still";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "played");
    } catch {
      return;
    }
    court.dataset.motion = "settle";
  }, []);

  const replay = () => {
    const court = courtRef.current;
    if (!court || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Let the current animation finish before accepting another replay.
    if (court.dataset.motion !== "settle") court.dataset.motion = "settle";
  };

  return (
    <button
      type="button"
      aria-label="Replay court animation"
      title="Replay court animation"
      className="inline-flex h-12 w-20 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-black"
      onClick={replay}
    >
      <svg
        ref={courtRef}
        width="80"
        height="48"
        viewBox="0 0 88 52"
        className="setup-court pointer-events-none block shrink-0 text-black"
        data-testid="setup-court"
        data-motion="rest"
        aria-hidden="true"
        focusable="false"
        onAnimationEnd={event => {
          if (event.target === event.currentTarget && event.animationName === "setup-court-arrive") {
            event.currentTarget.dataset.motion = "still";
          }
        }}
      >
        <rect x="4" y="7" width="64" height="38" rx="3" fill="#e0f2fe" stroke="currentColor" strokeWidth="2" />
        <path d="M26 7v38M46 7v38M4 26h22m20 0h22" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M36 5v42" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <g className="setup-court-ball">
          <g className="setup-court-ball-hop">
            <g className="setup-court-ball-spin">
              <PickleballIcon x="70" y="30" width="14" height="14" className="" />
            </g>
          </g>
        </g>
      </svg>
    </button>
  );
}
