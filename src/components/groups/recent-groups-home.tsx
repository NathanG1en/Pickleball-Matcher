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

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#e0f2fe] border-2 border-black shadow-[4px_4px_0px_0px_#000] text-left space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider text-black bg-white border border-black shadow-[1px_1px_0px_0px_#000]">
          Your Recent Groups ({groups.length})
        </span>
        <Link
          href="/players/groups"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider text-black bg-[#ccff00] hover:bg-[#b8eb00] border border-black shadow-[1px_1px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          Find groups
        </Link>
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
