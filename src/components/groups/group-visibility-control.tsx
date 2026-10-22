"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateGroupVisibilityAction } from "@/app/actions/group-settings";
import { InfoIcon } from "@/components/ui/icons";

export function GroupVisibilityControl({ groupId, initialIsPublic }: { groupId: string; initialIsPublic: boolean }) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const toggle = async (nextIsPublic: boolean) => {
    if (nextIsPublic === isPublic || pending) return;
    setPending(true);
    setError(null);
    const result = await updateGroupVisibilityAction({ groupId, isPublic: nextIsPublic });
    if (result.ok) {
      setIsPublic(nextIsPublic);
      router.refresh();
    } else setError(result.error ?? "Unable to update visibility.");
    setPending(false);
  };

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label="Group visibility"
          data-testid="group-visibility-toggle"
          className="inline-flex items-center rounded-md border-2 border-black bg-neutral-200 p-0.5 shadow-[1px_1px_0px_0px_#000]"
        >
          <button
            type="button"
            onClick={() => toggle(true)}
            disabled={pending}
            aria-pressed={isPublic}
            data-testid="group-visibility-public-button"
            className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              isPublic
                ? "bg-[#ccff00] text-black border border-black shadow-[0.5px_0.5px_0px_0px_#000]"
                : "border border-transparent text-neutral-600 hover:text-black hover:bg-black/5"
            } disabled:opacity-60`}
          >
            Public
          </button>
          <button
            type="button"
            onClick={() => toggle(false)}
            disabled={pending}
            aria-pressed={!isPublic}
            data-testid="group-visibility-private-button"
            className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              !isPublic
                ? "bg-[#ccff00] text-black border border-black shadow-[0.5px_0.5px_0px_0px_#000]"
                : "border border-transparent text-neutral-600 hover:text-black hover:bg-black/5"
            } disabled:opacity-60`}
          >
            Private
          </button>
        </div>

        <div
          className="relative inline-flex items-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <button
            type="button"
            onClick={() => setShowTooltip((prev) => !prev)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            aria-label="Group visibility details"
            title="Group visibility details"
            data-testid="group-visibility-info-button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-black transition-all cursor-pointer"
          >
            <InfoIcon className="h-2.5 w-2.5" />
          </button>

          {showTooltip && (
            <>
              <div
                className="fixed inset-0 z-40 sm:hidden"
                onClick={() => setShowTooltip(false)}
                aria-hidden="true"
              />
              <div
                role="tooltip"
                data-testid="group-visibility-tooltip"
                className="absolute left-0 sm:left-6 top-6 sm:top-1/2 sm:-translate-y-1/2 z-50 w-64 max-w-[calc(100vw-5rem)] rounded-xl border-2 border-black bg-white p-3 text-left shadow-[4px_4px_0px_0px_#000] text-black"
              >
                <div className="space-y-1.5 text-xs">
                  <p className="font-bold leading-snug">
                    <span className="font-black text-black uppercase">Public:</span>{" "}
                    <span className="text-neutral-700">Players can find and join this group.</span>
                  </p>
                  <p className="font-bold leading-snug">
                    <span className="font-black text-black uppercase">Private:</span>{" "}
                    <span className="text-neutral-700">This group is private and hidden from search.</span>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs font-black text-red-700">{error}</p>}
    </div>
  );
}
