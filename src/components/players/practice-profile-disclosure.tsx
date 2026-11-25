"use client";

import React from "react";
import { applyPracticeBallLaunch, pickPracticeBallLaunch } from "@/lib/animations/practice-ball";

/**
 * Collapsible wrapper for the Practice Profile. Browsers skip style updates inside a closed
 * <details>, so CSS keyed on [open] alone would only animate the first time. Restarting the
 * card's CSS animations on each open replays the reveal every time, with a fresh random
 * launch point for the pickleball drop.
 */
export function PracticeProfileDisclosure({
  className,
  children,
  ...rest
}: React.DetailsHTMLAttributes<HTMLDetailsElement> & { readonly "data-testid"?: string }) {
  return (
    <details
      {...rest}
      className={className}
      onToggle={(event) => {
        const details = event.currentTarget;
        if (!details.open || typeof details.getAnimations !== "function") return;
        // Vary where the pickleball drops from on each open, before the reveal restarts.
        applyPracticeBallLaunch(details, pickPracticeBallLaunch());
        for (const animation of details.getAnimations({ subtree: true })) {
          if (typeof CSSAnimation !== "undefined" && animation instanceof CSSAnimation) {
            animation.cancel();
            animation.play();
          }
        }
      }}
    >
      {children}
    </details>
  );
}
