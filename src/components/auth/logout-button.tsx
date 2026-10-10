"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizerLogoutAction } from "@/app/actions/auth";
import { clearRecentGroups } from "@/lib/storage/recent-groups";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleLogout = async () => {
    setIsPending(true);
    clearRecentGroups();
    await organizerLogoutAction();
    router.replace("/");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="rounded-xl bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047] disabled:opacity-60"
    >
      {isPending ? "Signing Out…" : "Log Out"}
    </button>
  );
}
