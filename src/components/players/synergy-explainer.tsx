"use client";

import { useState } from "react";
import { InfoIcon, XIcon } from "@/components/ui/icons";
import { useTooltipPosition } from "@/components/ui";

export function SynergyExplainerButton({
  description = "Play doubles matches with other registered accounts in your groups to discover your best partner and unlock mutual chemistry scores.",
}: {
  description?: string;
} = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const { triggerRef, tooltipRef, style } = useTooltipPosition(isOpen, () => setIsOpen(false));

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="How synergy is calculated"
        title="How synergy is calculated"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-white/80 text-black hover:bg-white active:scale-95 transition-all cursor-pointer"
      >
        <InfoIcon className="h-2.5 w-2.5" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={tooltipRef}
            role="tooltip"
            style={style}
            className="absolute left-0 top-6 sm:left-6 sm:top-1/2 sm:-translate-y-1/2 z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border-2 border-black bg-white p-3 text-left text-black tooltip-animate"
          >
            <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-1.5 mb-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider">How Synergy Works</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="text-neutral-500 hover:text-black cursor-pointer p-0.5"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] font-medium leading-relaxed text-neutral-700">
              {description}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
