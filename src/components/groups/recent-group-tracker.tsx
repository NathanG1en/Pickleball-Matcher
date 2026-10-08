"use client";

import { useEffect } from "react";
import { saveRecentGroup } from "@/lib/storage/recent-groups";

export function RecentGroupTracker({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  useEffect(() => {
    if (groupId && groupName) {
      saveRecentGroup({ id: groupId, name: groupName });
    }
  }, [groupId, groupName]);

  return null;
}
