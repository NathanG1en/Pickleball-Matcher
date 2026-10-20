"use client";

import { useEffect } from "react";
import { removeRecentGroup, saveRecentGroup } from "@/lib/storage/recent-groups";

export function RecentGroupTracker({
  groupId,
  groupName,
  isPartOfGroup = true,
}: {
  groupId: string;
  groupName: string;
  isPartOfGroup?: boolean;
}) {
  useEffect(() => {
    if (!groupId) return;
    if (isPartOfGroup && groupName) {
      saveRecentGroup({ id: groupId, name: groupName });
    } else if (!isPartOfGroup) {
      removeRecentGroup(groupId);
    }
  }, [groupId, groupName, isPartOfGroup]);

  return null;
}
