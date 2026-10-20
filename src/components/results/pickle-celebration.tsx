"use client";

import { useEffect, useRef, useState } from "react";

export function isPickleScore(team1Score: number | null, team2Score: number | null): boolean {
  return (team1Score === 11 && team2Score === 0) || (team1Score === 0 && team2Score === 11);
}

/** Mount only after a successful score save; historical scores never trigger it. */
export function PickleCelebration() {
  const artRef = useRef<SVGSVGElement>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const art = artRef.current;
    if (!art || art.dataset.motion === "wiggle") return;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) art.dataset.motion = "wiggle";
  }, []);

  const replay = () => {
    const art = artRef.current;
    if (!art || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (art.dataset.motion !== "wiggle") art.dataset.motion = "wiggle";
  };

  if (dismissed) return null;

  return (
    <div data-testid="pickle-celebration" className="flex items-center gap-3 rounded-xl border-2 border-black bg-lime-50 px-3 py-2 text-black">
      <button type="button" aria-label="Replay pickle celebration" title="Replay pickle celebration" onClick={replay}
        className="inline-flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0">
        <svg ref={artRef} width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" focusable="false"
          data-testid="pickle-mascot" data-motion="still" className="pickle-mascot pointer-events-none block overflow-visible"
          onAnimationEnd={event => {
            if (event.animationName === "pickle-victory-wiggle") event.currentTarget.dataset.motion = "still";
          }}>
          <path d="m15 34-7-6m37 4 10-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38 7C25 3 14 13 14 27c0 15 9 28 20 30 9 2 17-4 16-13-1-6-5-9-7-14-3-5-3-8-2-13 2-5 2-9-3-10Z"
            fill="var(--neo-lime)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M28 12c-5 2-8 6-9 11" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
          <g fill="#4d7c0f">
            <circle cx="33" cy="16" r="1.8" /><circle cx="20" cy="35" r="1.8" />
            <circle cx="29" cy="44" r="2" /><circle cx="41" cy="46" r="1.8" />
          </g>
          <g fill="currentColor"><circle cx="26" cy="26" r="1.8" /><circle cx="35" cy="25" r="1.8" /></g>
          <path d="M26 33q5 6 10-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <p role="status" className="font-display text-2xl font-black uppercase leading-tight">Pickled! <span className="whitespace-nowrap">11–0</span></p>
      <button type="button" aria-label="Dismiss pickle celebration" onClick={() => setDismissed(true)}
        className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-2xl">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
