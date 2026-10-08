"use client";

import { useState } from "react";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";

export function GroupIdReveal({ groupId }: { groupId: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Group ID</span>
      <div className="relative min-w-0 rounded-lg border border-neutral-300 bg-neutral-50 py-1 pl-2 pr-10 font-mono text-xs font-bold">
        <span className="block truncate" aria-live="polite">{visible ? groupId : "••••••••••••••••"}</span>
        <VisibilityToggle visible={visible} onToggle={() => setVisible((current) => !current)} label="group ID" />
      </div>
    </div>
  );
}
