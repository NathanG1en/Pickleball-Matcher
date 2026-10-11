"use client";

import { useState } from "react";

export function SynergyExplainerButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="How synergy is calculated"
        title="How synergy is calculated"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-white/80 text-[10px] font-black text-black hover:bg-white active:scale-95 transition-all cursor-pointer"
      >
        ℹ
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-6 z-50 w-64 rounded-xl border-2 border-black bg-white p-3 text-left shadow-[4px_4px_0px_0px_#000] text-black">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-1.5 mb-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider">How Synergy Works</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-black text-neutral-500 hover:text-black cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] font-medium leading-relaxed text-neutral-700">
              It&apos;s magic. Pure magic that measures the power of your friendship
            </p>
          </div>
        </>
      )}
    </div>
  );
}
