"use client";

import React, { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  getRecentGroupsSnapshot,
  removeRecentGroup,
  subscribeRecentGroups,
  type RecentGroup,
} from "@/lib/storage/recent-groups";

export function RecentGroupsHome({ excludeGroupId }: { excludeGroupId?: string } = {}) {
  const json = useSyncExternalStore(
    subscribeRecentGroups,
    getRecentGroupsSnapshot,
    getRecentGroupsSnapshot
  );

  const groups: RecentGroup[] = useMemo(() => {
    try {
      const parsed: RecentGroup[] = JSON.parse(json);
      if (!excludeGroupId) return parsed;
      return parsed.filter((g) => g.id !== excludeGroupId);
    } catch {
      return [];
    }
  }, [json, excludeGroupId]);

  if (!groups || groups.length === 0) {
    return null;
  }

  // If there's only 1 recent group, show a featured quick-resume hero card
  if (groups.length === 1) {
    const group = groups[0];
    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-[#fef08a] border-2 border-black shadow-[4px_4px_0px_0px_#000] text-left space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider text-black bg-[#ccff00] border border-black shadow-[1px_1px_0px_0px_#000]">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
            Your Group on this Device
          </span>
          <button
            type="button"
            onClick={() => removeRecentGroup(group.id)}
            title="Forget this group on this device"
            aria-label="Forget group"
            className="text-xs font-black text-neutral-500 hover:text-black px-1.5 py-0.5 rounded border border-transparent hover:border-black hover:bg-white transition-all cursor-pointer"
          >
            ×
          </button>
        </div>

        <div>
          <h2 className="font-display text-2xl font-black uppercase text-black leading-tight truncate">
            {group.name}
          </h2>
          <p className="text-xs font-bold text-neutral-700 mt-0.5">
            Ready to run your next session?
          </p>
        </div>

        <Link
          href={`/g/${group.id}`}
          className="block w-full py-3 px-4 rounded-xl bg-black hover:bg-neutral-900 text-[#ccff00] font-black text-center text-sm uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.25)] active:translate-x-0.5 active:translate-y-0.5 transition-all font-display"
        >
          Open Group Dashboard →
        </Link>
      </div>
    );
  }

  // If multiple groups are stored, show a list
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#e0f2fe] border-2 border-black shadow-[4px_4px_0px_0px_#000] text-left space-y-3">
      <div className="flex items-center justify-between">
        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider text-black bg-white border border-black shadow-[1px_1px_0px_0px_#000]">
          Your Groups ({groups.length})
        </span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
        {groups.map((group) => (
          <div
            key={group.id}
            className="p-2.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-between gap-2"
          >
            <div className="min-w-0 flex-1">
              <span className="font-display text-base font-black uppercase text-black block truncate">
                {group.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href={`/g/${group.id}`}
                className="px-3 py-1.5 rounded-lg bg-[#ccff00] hover:bg-[#b8eb00] text-black text-xs font-black uppercase border border-black shadow-[1px_1px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all font-display"
              >
                Open →
              </Link>
              <button
                type="button"
                onClick={() => removeRecentGroup(group.id)}
                title="Forget"
                aria-label={`Forget ${group.name}`}
                className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-black font-black text-sm cursor-pointer"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
