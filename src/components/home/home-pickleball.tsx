"use client";

import { useEffect, useRef } from "react";
import { PickleballIcon } from "@/components/ui/icons";

const SESSION_KEY = "pickleball:home-dink:v1";

export function HomePickleball() {
  const ballRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const ball = ballRef.current;
    // React Strict Mode may reconnect the same effect; leave its one-shot motion running.
    if (!ball || ball.dataset.motion === "dink") return;
    ball.dataset.motion = "still";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "played");
    } catch {
      // Keep the illustration static when storage is unavailable.
      return;
    }
    ball.dataset.motion = "dink";
  }, []);

  const replayBounce = () => {
    const ball = ballRef.current;
    if (!ball || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Finish one bounce before accepting another; repeated input cannot stack motion.
    if (ball.dataset.motion !== "dink") ball.dataset.motion = "dink";
  };

  return (
    <button
      type="button"
      aria-label="Bounce pickleball"
      className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-black"
      onPointerEnter={event => {
        if (event.pointerType === "mouse" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) replayBounce();
      }}
      onClick={replayBounce}
    >
      <svg
        ref={ballRef}
        className="home-pickleball block shrink-0 overflow-visible"
        data-testid="home-pickleball"
        data-motion="rest"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        onAnimationEnd={event => {
          if (event.animationName === "home-pickleball-dink") event.currentTarget.dataset.motion = "still";
        }}
      >
        <g className="home-pickleball-hop">
          <PickleballIcon width="24" height="24" className="" />
        </g>
      </svg>
    </button>
  );
}
